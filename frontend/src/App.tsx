import { Bot, Wifi, WifiOff, Loader, PersonStanding, ArrowDownToLine, Armchair } from 'lucide-react';
import { useCallback } from 'react';
import { useVoiceSession } from './hooks/useVoiceSession';
import { useNaoSession } from './hooks/useNaoSession';
import { MicrophoneButton } from './components/MicrophoneButton';
import { ConversationPanel } from './components/ConversationPanel';
import { StatusIndicator } from './components/StatusIndicator';
import { ToolCallDisplay } from './components/ToolCallDisplay';

export default function App() {
  const nao = useNaoSession();

  const handleNaoConfig = useCallback(
    (ip: string) => {
      console.log(`[App] Received NAO IP from backend: ${ip}`);
      nao.connect(ip);
    },
    [nao]
  );

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
  } = useVoiceSession({
    onResponseComplete: nao.scheduleBehaviors,
    onNaoConfig: handleNaoConfig,
  });

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

        {/* NAO robot connection badge */}
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-700/60 bg-gray-900/60">
          {nao.isConnecting ? (
            <Loader className="w-3 h-3 text-yellow-400 animate-spin" />
          ) : nao.isConnected ? (
            <Wifi className="w-3 h-3 text-green-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-gray-500" />
          )}
          <span className={nao.isConnected ? 'text-green-400' : nao.isConnecting ? 'text-yellow-400' : 'text-gray-500'}>
            NAO
          </span>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Conversation + Tool calls */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ConversationPanel entries={transcript} />
          <ToolCallDisplay toolCalls={toolCalls} />
        </div>

        {/* Microphone control */}
        <div className="flex-shrink-0 flex flex-col items-center gap-4 py-6 border-t border-gray-800/50 bg-gray-950/80 backdrop-blur-sm">
          <MicrophoneButton
            status={status}
            speechState={speechState}
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            onStartSession={startSession}
            onEndSession={endSession}
          />

          {/* NAO posture controls — only shown when NAO is connected */}
          {nao.isConnected && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 mr-1">NAO:</span>
              <button
                onClick={nao.standUp}
                title="Stand up"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-green-900/60 border border-gray-700 hover:border-green-600 text-gray-300 hover:text-green-300 transition-colors"
              >
                <PersonStanding className="w-3.5 h-3.5" />
                Stand
              </button>
              <button
                onClick={nao.sit}
                title="Sit down"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-blue-900/60 border border-gray-700 hover:border-blue-600 text-gray-300 hover:text-blue-300 transition-colors"
              >
                <Armchair className="w-3.5 h-3.5" />
                Sit
              </button>
              <button
                onClick={nao.rest}
                title="Rest / crouch"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-orange-900/60 border border-gray-700 hover:border-orange-600 text-gray-300 hover:text-orange-300 transition-colors"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Rest
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
