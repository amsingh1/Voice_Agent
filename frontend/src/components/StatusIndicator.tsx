import { clsx } from 'clsx';
import { Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react';
import type { SessionStatus } from '../types';

interface Props {
  status: SessionStatus;
  error: string | null;
}

export function StatusIndicator({ status, error }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium', {
          'bg-gray-800 text-gray-400': status === 'disconnected',
          'bg-blue-900/50 text-blue-300': status === 'connecting',
          'bg-green-900/50 text-green-300': status === 'connected',
          'bg-red-900/50 text-red-300': status === 'error',
        })}
      >
        {status === 'disconnected' && <WifiOff className="w-3 h-3" />}
        {status === 'connecting' && <Loader2 className="w-3 h-3 animate-spin" />}
        {status === 'connected' && <Wifi className="w-3 h-3" />}
        {status === 'error' && <AlertCircle className="w-3 h-3" />}

        <span className="capitalize">{status}</span>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-900/30 text-red-300 text-xs max-w-xs truncate">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
    </div>
  );
}
