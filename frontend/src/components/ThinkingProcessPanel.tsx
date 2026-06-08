import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Loader2,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import type { ThinkingStepType } from '../types';

interface ThinkingStep {
  step: number;
  subtype: ThinkingStepType;
  content: string;
  data?: {
    next_action?: string;
    action_input?: string;
    tool?: string;
    input?: string;
    success?: boolean;
    elapsed_ms?: number;
    result_size_bytes?: number;
    llm_elapsed_ms?: number;
    has_interpretation?: boolean;
  };
  collapsed: boolean;
  elapsed?: number;
}

interface ThinkingProcessPanelProps {
  steps: Record<number, ThinkingStep>;
  isStreaming?: boolean;
  autoExpand?: boolean;
}

const STEP_CONFIG: Record<ThinkingStepType, {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgClass: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
}> = {
  thought: {
    icon: <Brain size={14} />,
    label: '推理',
    color: '#8b5cf6',
    bgClass: 'bg-purple-50/80',
    borderClass: 'border-purple-200/60 hover:border-purple-300',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
  },
  tool_call: {
    icon: <Wrench size={14} />,
    label: '调用工具',
    color: '#f59e0b',
    bgClass: 'bg-amber-50/60',
    borderClass: 'border-amber-200/60 hover:border-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  tool_result: {
    icon: <Lightbulb size={14} />,
    label: '分析结果',
    color: '#10b981',
    bgClass: 'bg-emerald-50/60',
    borderClass: 'border-emerald-200/60 hover:border-emerald-300',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
};

function formatElapsed(ms: number | undefined): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ThinkingProcessPanel({
  steps,
  isStreaming = false,
  autoExpand = false,
}: ThinkingProcessPanelProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<number, boolean>>({});

  const stepList = Object.values(steps)
    .filter(s => s.subtype === 'thought' || s.subtype === 'tool_call' || s.subtype === 'tool_result')
    .sort((a, b) => a.step - b.step);

  if (stepList.length === 0) return null;

  const thoughtCount = stepList.filter(s => s.subtype === 'thought').length;
  const toolCallCount = stepList.filter(s => s.subtype === 'tool_call').length;
  const analysisCount = stepList.filter(s => s.subtype === 'tool_result').length;

  const toggleStep = (step: number) => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 w-full text-left bg-gradient-to-r from-violet-50 via-white to-violet-50 hover:from-violet-100/50 hover:via-white hover:to-violet-100/50 transition-all group"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shadow-purple-500/20">
          {isExpanded ? (
            <ChevronDown size={13} className="text-white" />
          ) : (
            <ChevronRight size={13} className="text-white" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Brain size={15} className="text-violet-600" />
          <span className="text-[13px] font-semibold text-gray-800">深度思考</span>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          {thoughtCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STEP_CONFIG.thought.badgeBg} ${STEP_CONFIG.thought.badgeText} font-medium`}>
              推理 {thoughtCount}
            </span>
          )}
          {toolCallCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STEP_CONFIG.tool_call.badgeBg} ${STEP_CONFIG.tool_call.badgeText} font-medium`}>
              工具 {toolCallCount}
            </span>
          )}
          {analysisCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STEP_CONFIG.tool_result.badgeBg} ${STEP_CONFIG.tool_result.badgeText} font-medium`}>
              分析 {analysisCount}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isStreaming ? (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium animate-pulse-subtle">
              <Loader2 size={10} className="animate-spin" />
              思考中
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              共 {stepList.length} 步
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-violet-50/20 to-transparent p-3 space-y-1.5">
          {stepList.map((step, idx) => {
            const config = STEP_CONFIG[step.subtype];
            const isCollapsed = collapsedSteps[step.step] ?? false;
            const isToolResult = step.subtype === 'tool_result';

            return (
              <div key={step.step}>
                <div
                  className={`rounded-lg border ${config.borderClass} ${config.bgClass} overflow-hidden transition-colors ${
                    isToolResult ? 'border-l-2 border-l-emerald-400' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleStep(step.step)}
                    className="flex items-center gap-2.5 px-3 py-2 w-full text-left group/step"
                  >
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${config.color}12`, color: config.color }}
                    >
                      {isCollapsed ? (
                        <ChevronRight size={11} />
                      ) : (
                        <ChevronDown size={11} />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" style={{ color: config.color }}>
                      {config.icon}
                    </div>

                    <span className="text-[12px] font-medium text-gray-700">
                      {config.label}
                    </span>

                    {step.subtype === 'tool_call' && step.data?.next_action && (
                      <>
                        <ArrowRight size={10} className="text-gray-300 mx-0.5" />
                        <code className="text-[11px] font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          {step.data.next_action}
                        </code>
                      </>
                    )}

                    <span className="text-[10px] text-gray-400 font-mono ml-auto">#{step.step}</span>

                    <div className="flex items-center gap-2 shrink-0 ml-1">
                      {step.data?.success !== undefined && (
                        step.data.success ? (
                          <CheckCircle2 size={12} className="text-emerald-500" />
                        ) : (
                          <XCircle size={12} className="text-red-400" />
                        )
                      )}

                      {step.data?.elapsed_ms !== undefined && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Zap size={9} />
                          {formatElapsed(step.data.elapsed_ms)}
                        </span>
                      )}

                      {step.data?.llm_elapsed_ms !== undefined && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Clock size={9} />
                          {formatElapsed(step.data.llm_elapsed_ms)}
                        </span>
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="px-3 pb-2.5 pt-0.5">
                      {step.content && (
                        <p className={`text-[12px] leading-relaxed whitespace-pre-wrap pl-[27px] ${
                          isToolResult
                            ? 'text-emerald-700 font-medium'
                            : 'text-gray-600'
                        }`}>
                          {step.content}
                        </p>
                      )}

                      {step.subtype === 'tool_call' && step.data?.action_input && (
                        <div className="pl-[27px] mt-1.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide mr-1.5">参数</span>
                          <code className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono max-w-[300px] inline-block truncate align-middle">
                            {typeof step.data.action_input === 'string'
                              ? step.data.action_input.slice(0, 60)
                              : JSON.stringify(step.data.action_input).slice(0, 60)
                            }
                            {(typeof step.data.action_input === 'string' ? step.data.action_input : JSON.stringify(step.data.action_input)).length > 60 ? '...' : ''}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {idx < stepList.length - 1 && (
                  <div className="flex justify-start ml-3 py-0.5">
                    <div className="w-px h-2.5 bg-violet-200/60" />
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