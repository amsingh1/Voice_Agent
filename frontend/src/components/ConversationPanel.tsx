import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { Bot, User } from 'lucide-react';
import type { TranscriptEntry } from '../types';

interface Props {
  entries: TranscriptEntry[];
}

export function ConversationPanel({ entries }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-center text-sm">
          Start a session and begin speaking.
          <br />
          The conversation will appear here.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={clsx('flex gap-3 max-w-[85%]', {
            'ml-auto flex-row-reverse': entry.role === 'user',
          })}
        >
          <div
            className={clsx(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              {
                'bg-blue-500/20 text-blue-400': entry.role === 'assistant',
                'bg-gray-700 text-gray-400': entry.role === 'user',
              }
            )}
          >
            {entry.role === 'assistant' ? (
              <Bot className="w-4 h-4" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>

          <div
            className={clsx('rounded-2xl px-4 py-2.5 text-sm leading-relaxed', {
              'bg-blue-500/10 text-blue-100 rounded-tl-sm': entry.role === 'assistant',
              'bg-gray-800 text-gray-200 rounded-tr-sm': entry.role === 'user',
            })}
          >
            {entry.text}
            {entry.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-400 animate-pulse rounded-sm" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
