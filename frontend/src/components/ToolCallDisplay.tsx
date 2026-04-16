import { clsx } from 'clsx';
import { Wrench, Check, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ToolCall } from '../types';

interface Props {
  toolCalls: ToolCall[];
}

export function ToolCallDisplay({ toolCalls }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (toolCalls.length === 0) return null;

  return (
    <div className="px-4 py-2 space-y-2">
      <div className="text-xs text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
        <Wrench className="w-3 h-3" />
        Tool Activity
      </div>

      {toolCalls.map((tc) => {
        const isExpanded = expandedId === tc.id;

        return (
          <div
            key={tc.id}
            className={clsx(
              'rounded-lg border text-xs transition-colors',
              {
                'border-amber-500/30 bg-amber-500/5': tc.status === 'pending',
                'border-green-500/20 bg-green-500/5': tc.status === 'complete' && tc.success,
                'border-red-500/20 bg-red-500/5': tc.status === 'complete' && !tc.success,
              }
            )}
          >
            <button
              onClick={() => setExpandedId(isExpanded ? null : tc.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              {tc.status === 'pending' ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0" />
              ) : tc.success ? (
                <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              )}

              <span className="font-mono text-gray-300 flex-1 truncate">{tc.name}</span>

              {isExpanded ? (
                <ChevronUp className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-gray-500" />
              )}
            </button>

            {isExpanded && (
              <div className="px-3 pb-2 space-y-1.5 border-t border-gray-800">
                <div className="pt-1.5">
                  <span className="text-gray-500">Args: </span>
                  <code className="text-gray-400 break-all">
                    {formatJson(tc.arguments)}
                  </code>
                </div>
                {tc.result && (
                  <div>
                    <span className="text-gray-500">Result: </span>
                    <code className="text-gray-400 break-all">
                      {formatJson(tc.result).substring(0, 500)}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
