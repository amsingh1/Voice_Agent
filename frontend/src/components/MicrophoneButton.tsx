import { clsx } from 'clsx';
import { Mic, MicOff, Power } from 'lucide-react';
import type { SessionStatus, SpeechState } from '../types';

interface Props {
  status: SessionStatus;
  speechState: SpeechState;
  isRecording: boolean;
  onToggleRecording: () => void;
  onStartSession: () => void;
  onEndSession: () => void;
}

export function MicrophoneButton({
  status,
  speechState,
  isRecording,
  onToggleRecording,
  onStartSession,
  onEndSession,
}: Props) {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  if (!isConnected && !isConnecting) {
    return (
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onStartSession}
          className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200 active:scale-95"
        >
          <Power className="w-10 h-10" />
        </button>
        <span className="text-sm text-gray-400">Start Session</span>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gray-700 text-gray-400">
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <Mic className="w-10 h-10" />
        </div>
        <span className="text-sm text-gray-400">Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Pulse ring when listening */}
        {isRecording && speechState === 'listening' && (
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse-ring" />
        )}
        {isRecording && speechState === 'processing' && (
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse-ring" />
        )}

        <button
          onClick={onToggleRecording}
          className={clsx(
            'relative z-10 flex items-center justify-center w-24 h-24 rounded-full text-white shadow-lg transition-all duration-200 active:scale-95',
            {
              'bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/30 hover:shadow-red-500/50':
                isRecording,
              'bg-gradient-to-br from-green-500 to-green-700 shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105':
                !isRecording,
            }
          )}
        >
          {isRecording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
        </button>
      </div>

      {/* Sound wave visualization */}
      {isRecording && (
        <div className="flex items-center gap-1 h-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={clsx('w-1 rounded-full transition-colors', {
                'bg-green-400': speechState === 'listening',
                'bg-amber-400': speechState === 'processing',
                'bg-gray-500': speechState === 'idle',
              })}
              style={{
                animation: speechState !== 'idle' ? `sound-wave 1.2s ease-in-out ${i * 0.15}s infinite` : 'none',
                height: speechState !== 'idle' ? undefined : '8px',
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">
          {!isRecording
            ? 'Click to start talking'
            : speechState === 'listening'
              ? 'Listening...'
              : speechState === 'processing'
                ? 'MARVIN is thinking...'
                : 'Ready'}
        </span>
      </div>

      {/* End session button */}
      <button
        onClick={onEndSession}
        className="mt-2 px-4 py-1.5 text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-500/50 rounded-full transition-colors"
      >
        End Session
      </button>
    </div>
  );
}
