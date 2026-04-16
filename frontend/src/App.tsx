import { Bot } from 'lucide-react';
import { useVoiceSession } from './hooks/useVoiceSession';
import { MicrophoneButton } from './components/MicrophoneButton';
import { ConversationPanel } from './components/ConversationPanel';
import { StatusIndicator } from './components/StatusIndicator';
import { ToolCallDisplay } from './components/ToolCallDisplay';

export default function App() {
  const {
    status,
    speechState,
    isRecording,
    transcript,
    toolCalls,
    error,
    startSession,
    endSession,
    toggleRecording,
  } = useVoiceSession();

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">MARVIN</h1>
            <p className="text-xs text-gray-500">Voice Agent</p>
          </div>
        </div>

        <StatusIndicator status={status} error={error} />
      </header>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Conversation + Tool calls */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ConversationPanel entries={transcript} />
          <ToolCallDisplay toolCalls={toolCalls} />
        </div>

        {/* Microphone control */}
        <div className="flex-shrink-0 flex items-center justify-center py-8 border-t border-gray-800/50 bg-gray-950/80 backdrop-blur-sm">
          <MicrophoneButton
            status={status}
            speechState={speechState}
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            onStartSession={startSession}
            onEndSession={endSession}
          />
        </div>
      </div>
    </div>
  );
}
