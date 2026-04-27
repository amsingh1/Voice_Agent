export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SpeechState = 'idle' | 'listening' | 'processing';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ToolCall {
  id: string;
  callId: string;
  name: string;
  arguments: string;
  result?: string;
  success?: boolean;
  status: 'pending' | 'complete';
  timestamp: Date;
}

// Messages sent from frontend to backend
export type ClientMessage =
  | { type: 'session.start' }
  | { type: 'audio.chunk'; data: string }
  | { type: 'audio.commit' }
  | { type: 'response.cancel' }
  | { type: 'session.end' };

// Messages received from backend
export type ServerMessage =
  | { type: 'session.ready' }
  | { type: 'session.ended' }
  | { type: 'audio.delta'; data: string }
  | { type: 'transcript.delta'; role: string; delta: string }
  | { type: 'transcript.user'; text: string }
  | { type: 'tool_call.start'; callId: string; name: string; arguments: string }
  | { type: 'tool_call.result'; callId: string; name: string; result: string; success: boolean }
  | { type: 'response.done' }
  | { type: 'speech.started' }
  | { type: 'speech.stopped' }
  | { type: 'nao.config'; ip: string }
  | { type: 'error'; message: string };
