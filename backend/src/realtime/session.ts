import { AzureOpenAI } from 'openai';
import { OpenAIRealtimeWS } from 'openai/beta/realtime/ws';
import { WebSocket as WS } from 'ws';
import { config } from '../config.js';
import { getMCPToolDefinitions, executeMCPTool } from '../mcp/client.js';
import { addMessage, addToolCall, createConversation, getRecentContext } from '../memory/store.js';

export class RealtimeSession {
  private realtimeClient: OpenAIRealtimeWS | null = null;
  private frontendWs: WS;
  private conversationId: string;
  private isSessionReady = false;
  private assistantTranscript = '';
  // Maps item_id → function name, populated from response.output_item.added
  private pendingFunctionNames = new Map<string, string>();

  constructor(frontendWs: WS) {
    this.frontendWs = frontendWs;
    this.conversationId = createConversation();
  }

  async start(): Promise<void> {
    if (!config.azure.apiKey) {
      this.sendToFrontend({
        type: 'error',
        message: 'AZURE_OPENAI_API_KEY is not configured. Set it in the .env file.',
      });
      return;
    }

    try {
      const endpoint = config.azure.endpoint.replace(/\/$/, '');
      console.log(`[Realtime] Connecting to Azure: ${endpoint}`);
      console.log(`[Realtime] Deployment: ${config.azure.deploymentName}`);

      // AzureOpenAI client handles endpoint + api-version construction
      const azureClient = new AzureOpenAI({
        endpoint,
        apiKey: config.azure.apiKey,
        apiVersion: '2025-04-01-preview',
        deployment: config.azure.deploymentName,
      });

      this.realtimeClient = await OpenAIRealtimeWS.azure(azureClient, {
        deploymentName: config.azure.deploymentName,
        options: {
          headers: {
            'api-key': config.azure.apiKey,
          },
        },
      });

      this.setupEventHandlers();
    } catch (error) {
      const message = (error as Error).message;
      console.error('[Realtime] Connection failed:', message);
      this.sendToFrontend({ type: 'error', message: `Connection failed: ${message}` });
    }
  }

  private setupEventHandlers(): void {
    const client = this.realtimeClient!;

    // Session lifecycle
    client.on('session.created', (event) => {
      console.log('[Realtime] Session created:', event.session.id);
      this.configureSession();
    });

    client.on('session.updated', () => {
      console.log('[Realtime] Session configured with tools');
      this.isSessionReady = true;
      this.sendToFrontend({ type: 'session.ready' });
    });

    // Audio output delta
    client.on('response.audio.delta', (event) => {
      this.sendToFrontend({ type: 'audio.delta', data: event.delta });
    });

    // Capture function name when output item is added (function_call items)
    client.on('response.output_item.added', (event) => {
      const item = event.item;
      if (item.type === 'function_call' && item.id && item.name) {
        this.pendingFunctionNames.set(item.id, item.name);
      }
    });

    // Transcript delta (streaming text)
    client.on('response.audio_transcript.delta', (event) => {
      this.assistantTranscript += event.delta;
      this.sendToFrontend({ type: 'transcript.delta', role: 'assistant', delta: event.delta });
    });

    // User speech transcript (after VAD completes)
    client.on('conversation.item.input_audio_transcription.completed', (event) => {
      const text = event.transcript || '';
      if (text.trim()) {
        this.sendToFrontend({ type: 'transcript.user', text });
        addMessage(this.conversationId, 'user', text);
      }
    });

    // Function/tool call — model wants to invoke an MCP tool
    client.on('response.function_call_arguments.done', async (event) => {
      const toolName = this.pendingFunctionNames.get(event.item_id) ?? 'unknown';
      this.pendingFunctionNames.delete(event.item_id);
      await this.handleFunctionCall({
        call_id: event.call_id,
        name: toolName,
        arguments: event.arguments,
      });
    });

    // Response complete
    client.on('response.done', () => {
      if (this.assistantTranscript.trim()) {
        addMessage(this.conversationId, 'assistant', this.assistantTranscript);
      }
      this.assistantTranscript = '';
      this.sendToFrontend({ type: 'response.done' });
    });

    // VAD events — relay to frontend for UI feedback
    client.on('input_audio_buffer.speech_started', () => {
      this.sendToFrontend({ type: 'speech.started' });
    });

    client.on('input_audio_buffer.speech_stopped', () => {
      this.sendToFrontend({ type: 'speech.stopped' });
    });

    // Error handler
    client.on('error', (err) => {
      console.error('[Realtime] Error:', err.message);
      this.sendToFrontend({ type: 'error', message: err.message || 'Azure Realtime API error' });
    });
  }

  private configureSession(): void {
    const mcpTools = getMCPToolDefinitions();
    console.log(`[Realtime] Configuring session with ${mcpTools.length} tools`);

    // Inject cross-session memory context so MARVIN remembers past interactions
    const recentContext = getRecentContext(20);
    let instructions = config.agent.personality;
    if (recentContext) {
      instructions += '\n\nBelow is a summary of recent conversations for context. Use this to recall prior interactions:\n' + recentContext;
    }

    this.realtimeClient!.send({
      type: 'session.update',
      session: {
        instructions,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        },
        tools: mcpTools,
        tool_choice: 'auto',
      },
    });
  }

  private async handleFunctionCall(event: { call_id: string; name: string; arguments: string }): Promise<void> {
    const callId = event.call_id;
    const name = event.name;
    const argsStr = event.arguments || '{}';

    console.log(`[Tool] Calling "${name}" with: ${argsStr.substring(0, 200)}`);
    this.sendToFrontend({
      type: 'tool_call.start',
      callId,
      name,
      arguments: argsStr,
    });

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argsStr);
    } catch {
      args = {};
    }

    const { result, success } = await executeMCPTool(name, args);
    console.log(`[Tool] "${name}" ${success ? 'succeeded' : 'failed'}: ${result.substring(0, 200)}`);

    addToolCall(
      this.conversationId,
      name,
      argsStr,
      result,
      success ? 'success' : 'error'
    );

    this.sendToFrontend({
      type: 'tool_call.result',
      callId,
      name,
      result,
      success,
    });

    // Send function output back to Azure
    this.realtimeClient!.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: result,
      },
    });

    // Request model to generate a response with the tool result
    this.realtimeClient!.send({ type: 'response.create' });
  }

  sendAudio(base64Audio: string): void {
    if (!this.isSessionReady || !this.realtimeClient) return;

    this.realtimeClient.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    });
  }

  commitAudio(): void {
    if (!this.isSessionReady || !this.realtimeClient) return;

    this.realtimeClient.send({ type: 'input_audio_buffer.commit' });
    this.realtimeClient.send({ type: 'response.create' });
  }

  cancelResponse(): void {
    if (!this.isSessionReady || !this.realtimeClient) return;
    this.realtimeClient.send({ type: 'response.cancel' });
  }

  private sendToFrontend(message: Record<string, unknown>): void {
    if (this.frontendWs.readyState === WS.OPEN) {
      this.frontendWs.send(JSON.stringify(message));
    }
  }

  close(): void {
    if (this.realtimeClient) {
      try {
        this.realtimeClient.close();
      } catch {
        // Ignore close errors
      }
      this.realtimeClient = null;
    }
    this.isSessionReady = false;
    console.log(`[Realtime] Session closed (conversation: ${this.conversationId})`);
  }
}
