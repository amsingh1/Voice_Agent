import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  SessionStatus,
  SpeechState,
  TranscriptEntry,
  ToolCall,
  ServerMessage,
} from '../types';
import { AudioRecorder, AudioPlayer } from '../lib/audio';

let nextTranscriptId = 0;
let nextToolCallId = 0;

export function useVoiceSession() {
  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const assistantBufferRef = useRef<string>('');
  const streamingEntryIdRef = useRef<string | null>(null);

  const handleServerMessage = useCallback((event: MessageEvent) => {
    const msg: ServerMessage = JSON.parse(event.data);

    switch (msg.type) {
      case 'session.ready': {
        setStatus('connected');
        setError(null);
        break;
      }

      case 'session.ended': {
        setStatus('disconnected');
        break;
      }

      case 'audio.delta': {
        playerRef.current?.playChunk(msg.data);
        setSpeechState('processing');
        break;
      }

      case 'transcript.delta': {
        assistantBufferRef.current += msg.delta;
        const currentText = assistantBufferRef.current;

        if (!streamingEntryIdRef.current) {
          const id = `t-${++nextTranscriptId}`;
          streamingEntryIdRef.current = id;
          setTranscript((prev) => [
            ...prev,
            { id, role: 'assistant', text: currentText, timestamp: new Date(), isStreaming: true },
          ]);
        } else {
          const entryId = streamingEntryIdRef.current;
          setTranscript((prev) =>
            prev.map((e) => (e.id === entryId ? { ...e, text: currentText } : e))
          );
        }
        break;
      }

      case 'transcript.user': {
        const id = `t-${++nextTranscriptId}`;
        setTranscript((prev) => [
          ...prev,
          { id, role: 'user', text: msg.text, timestamp: new Date() },
        ]);
        break;
      }

      case 'tool_call.start': {
        const id = `tc-${++nextToolCallId}`;
        setToolCalls((prev) => [
          ...prev,
          {
            id,
            callId: msg.callId,
            name: msg.name,
            arguments: msg.arguments,
            status: 'pending',
            timestamp: new Date(),
          },
        ]);
        break;
      }

      case 'tool_call.result': {
        setToolCalls((prev) =>
          prev.map((tc) =>
            tc.callId === msg.callId
              ? { ...tc, result: msg.result, success: msg.success, status: 'complete' as const }
              : tc
          )
        );
        break;
      }

      case 'response.done': {
        // Finalize the streaming assistant entry
        if (streamingEntryIdRef.current) {
          const entryId = streamingEntryIdRef.current;
          setTranscript((prev) =>
            prev.map((e) => (e.id === entryId ? { ...e, isStreaming: false } : e))
          );
        }
        assistantBufferRef.current = '';
        streamingEntryIdRef.current = null;
        setSpeechState('idle');
        break;
      }

      case 'speech.started': {
        setSpeechState('listening');
        // Clear playback when user starts speaking (barge-in)
        playerRef.current?.clear();
        break;
      }

      case 'speech.stopped': {
        setSpeechState('processing');
        break;
      }

      case 'error': {
        setError(msg.message);
        console.error('[Voice] Server error:', msg.message);
        break;
      }
    }
  }, []);

  const startSession = useCallback(async () => {
    try {
      setError(null);
      setStatus('connecting');
      setTranscript([]);
      setToolCalls([]);

      // Initialize audio player
      const player = new AudioPlayer();
      await player.init();
      playerRef.current = player;

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'session.start' }));
      };

      ws.onmessage = handleServerMessage;

      ws.onerror = () => {
        setError('WebSocket connection failed. Is the backend running?');
        setStatus('error');
      };

      ws.onclose = () => {
        if (isRecording) {
          recorderRef.current?.stop();
          setIsRecording(false);
        }
        setStatus('disconnected');
      };
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }, [handleServerMessage, isRecording]);

  const endSession = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
      setIsRecording(false);
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'session.end' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }

    assistantBufferRef.current = '';
    streamingEntryIdRef.current = null;
    setSpeechState('idle');
    setStatus('disconnected');
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      recorderRef.current?.stop();
      recorderRef.current = null;
      setIsRecording(false);
      setSpeechState('idle');
    } else {
      // Start recording
      try {
        const recorder = new AudioRecorder();
        await recorder.start((base64Chunk) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'audio.chunk', data: base64Chunk }));
          }
        });
        recorderRef.current = recorder;
        setIsRecording(true);
        setSpeechState('listening');
      } catch (err) {
        setError(`Microphone access denied: ${(err as Error).message}`);
      }
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      playerRef.current?.close();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    status,
    speechState,
    isRecording,
    transcript,
    toolCalls,
    error,
    startSession,
    endSession,
    toggleRecording,
  };
}
