import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { config } from '../config.js';

interface RealtimeTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

let mcpClient: MultiServerMCPClient | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let toolsCache: any[] = [];

export async function initMCPClient(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mcpClient = new MultiServerMCPClient({
      throwOnLoadError: false,
      prefixToolNameWithServerName: false,
      useStandardContentBlocks: true,
      onConnectionError: 'ignore',
      mcpServers: {
        local: {
          url: config.mcp.serverUrl,
        },
      },
    } as any);

    toolsCache = await mcpClient.getTools();
    console.log(`[MCP] Loaded ${toolsCache.length} tools from MCP server at ${config.mcp.serverUrl}`);
    for (const tool of toolsCache) {
      console.log(`  - ${tool.name}: ${tool.description?.substring(0, 80) || 'No description'}`);
    }
  } catch (error) {
    console.warn('[MCP] Failed to connect to MCP server:', (error as Error).message);
    console.warn('[MCP] Voice agent will run without tool support');
    toolsCache = [];
  }
}

export function getMCPToolDefinitions(): RealtimeTool[] {
  return toolsCache.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description || '',
    parameters: tool.schema || { type: 'object', properties: {} },
  }));
}

export async function executeMCPTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ result: string; success: boolean }> {
  const tool = toolsCache.find((t) => t.name === name);
  if (!tool) {
    return { result: JSON.stringify({ error: `Tool "${name}" not found` }), success: false };
  }

  try {
    const result = await tool.invoke(args);
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    return { result: resultStr, success: true };
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[MCP] Tool "${name}" execution error:`, message);
    return { result: JSON.stringify({ error: message }), success: false };
  }
}

export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    toolsCache = [];
    console.log('[MCP] Client closed');
  }
}
