import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';

interface ToolCallEntry {
  step: number;
  tool: string;
  input: any;
  output: string;
  success: boolean;
  elapsedMs?: number;
}

interface ToolCallPanelProps {
  calls: ToolCallEntry[];
  isStreaming?: boolean;
}

const TOOL_ICONS: Record<string, string> = {
  prometheus_query: '📊',
  elasticsearch_query: '🔍',
  ssh_command: '💻',
  db_query: '🗄️',
  alertmanager_get: '🚨',
  rag_search: '📚',
  cpu_check: '⚡',
  memory_check: '💾',
  disk_check: '💿',
  network_check: '🌐',
  service_check: '🔧',
};

function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName] || '🔧';
}

function formatElapsed(ms: number | undefined): string {
  if (ms === undefined) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function truncate(str: string, maxLen: number = 200): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '\n... (truncated)';
}

function formatInput(input: any): string {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return input;
    }
  }
  if (input === null || input === undefined) return '';
  return JSON.stringify(input, null, 2);
}

export default function ToolCallPanel({ calls, isStreaming = false }: ToolCallPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [collapsedCalls, setCollapsedCalls] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedOutput, setExpandedOutput] = useState<Record<number, boolean>>({});

  if (!calls || calls.length === 0) return null;

  const successCount = calls.filter(c => c.success).length;

  const toggleCall = (step: number) => {
    setCollapsedCalls(prev => ({ ...prev, [step]: !prev[step] }));
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const toggleOutputExpand = (step: number) => {
    setExpandedOutput(prev => ({ ...prev, [step]: !prev[step] }));
  };

  const isLongOutput = (output: string) => output.length > 400;

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 w-full text-left bg-gradient-to-r from-gray-50 via-white to-gray-50 hover:from-gray-100/70 hover:via-white hover:to-gray-100/70 transition-all group"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm shadow-sky-500/20">
          {isExpanded ? (
            <ChevronDown size={13} className="text-white" />
          ) : (
            <ChevronRight size={13} className="text-white" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Wrench size={15} className="text-sky-600" />
          <span className="text-[13px] font-semibold text-gray-800">工具调用</span>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            successCount === calls.length
              ? 'bg-emerald-100 text-emerald-700'
              : successCount > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
          } font-medium`}>
            {successCount}/{calls.length} 成功
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
            {calls.length} 次调用
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-600 font-medium animate-pulse-subtle">
              <Zap size={10} />
              执行中
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/40 to-transparent p-3 space-y-2.5">
          {calls.map((call, idx) => {
            const isCollapsed = collapsedCalls[call.step] ?? false;
            const outputExpanded = expandedOutput[call.step] ?? false;
            const displayOutput = outputExpanded ? call.output : truncate(call.output);

            return (
              <div key={call.step}>
                <div className={`rounded-lg border overflow-hidden transition-colors ${
                  call.success
                    ? 'border-emerald-200/60 bg-emerald-50/30 hover:border-emerald-300'
                    : 'border-red-200/60 bg-red-50/20 hover:border-red-300'
                }`}>
                  <button
                    onClick={() => toggleCall(call.step)}
                    className="flex items-center gap-2.5 px-3 py-2 w-full text-left group/call"
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                      call.success
                        ? 'bg-emerald-500/12 text-emerald-600'
                        : 'bg-red-500/12 text-red-600'
                    }`}>
                      {isCollapsed ? (
                        <ChevronRight size={11} />
                      ) : (
                        <ChevronDown size={11} />
                      )}
                    </div>

                    <span className="text-sm shrink-0">{getToolIcon(call.tool)}</span>

                    <code className="text-[12px] font-mono font-semibold text-gray-800 px-1.5 py-0.5 rounded bg-gray-900/80 text-green-400">
                      {call.tool}
                    </code>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      {call.success ? (
                        <CheckCircle2 size={13} className="text-emerald-500" />
                      ) : (
                        <XCircle size={13} className="text-red-400" />
                      )}

                      {call.elapsedMs !== undefined && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Clock size={9} />
                          {formatElapsed(call.elapsedMs)}
                        </span>
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="px-3 pb-2.5 pt-0.5 space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Input</span>
                        </div>
                        <pre className="text-[11px] p-2.5 rounded-lg bg-gray-950 text-gray-200 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words relative group/input">
                          {formatInput(call.input) || '(empty)'}
                          <button
                            onClick={() => copyToClipboard(formatInput(call.input), `input-${call.step}`)}
                            className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover/input:opacity-100 hover:bg-gray-800 transition-opacity"
                            title="复制"
                          >
                            {copiedKey === `input-${call.step}` ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} className="text-gray-400" />
                            )}
                          </button>
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                            <Terminal size={10} /> Output
                          </span>
                          <div className="flex items-center gap-1">
                            {isLongOutput(call.output) && (
                              <button
                                onClick={() => toggleOutputExpand(call.step)}
                                className="flex items-center gap-0.5 text-[10px] text-sky-600 hover:text-sky-700 px-1.5 py-0.5 rounded hover:bg-sky-50 transition-colors"
                              >
                                {outputExpanded ? (
                                  <><Minimize2 size={9} /> 收起</>
                                ) : (
                                  <><Maximize2 size={9} /> 展开</>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => copyToClipboard(call.output, `output-${call.step}`)}
                              className="p-1 rounded hover:bg-gray-100 transition-colors"
                              title="复制输出"
                            >
                              {copiedKey === `output-${call.step}` ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <Copy size={11} className="text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>
                        <pre className={`text-[11px] p-2.5 rounded-lg bg-gray-900/90 text-gray-200 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words ${
                          outputExpanded ? '' : 'max-h-[180px] overflow-y-auto'
                        }`}>
                          {displayOutput || '(no output)'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {idx < calls.length - 1 && (
                  <div className="flex justify-start ml-3 py-0.5">
                    <div className="w-px h-2 bg-gray-200" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}