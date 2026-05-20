import { useState } from 'react';
import {
  Search,
  Lightbulb,
  BarChart3,
  ListChecks,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Zap,
  Target,
  Database,
  TrendingUp,
  Clock,
  Shield,
  Cpu,
  HardDrive,
  Network,
  Server,
} from 'lucide-react';

export type AnalysisPhase = 'analysis' | 'data' | 'reasoning' | 'conclusion';

interface AnalysisSectionData {
  phase: AnalysisPhase;
  intent: string;
  scope: string[];
  keywords: string[];
}

interface DataInsightData {
  title: string;
  description?: string;
  vizType: 'status-cards' | 'metric-chart' | 'data-table' | 'metric-summary' | 'progress-group';
  data: Record<string, unknown>;
  insight?: string;
  highlight?: string;
}

interface ReasoningStep {
  id: number;
  title: string;
  finding: string;
  evidence?: string;
  vizType?: 'metric-chart' | 'alert-list' | 'timeline' | 'service-topology' | 'progress-group';
  vizData?: Record<string, unknown>;
  status: 'completed' | 'warning' | 'critical';
}

interface ConclusionData {
  summary: string;
  findings: Array<{ label: string; value: string; type: 'good' | 'warn' | 'bad' | 'info' }>;
  recommendations: Array<{ priority: 'high' | 'medium' | 'low'; action: string; reason: string }>;
  nextSteps?: string[];
}

export interface ModularResponse {
  analysis: AnalysisSectionData;
  dataInsights: DataInsightData[];
  reasoning: ReasoningStep[];
  conclusion: ConclusionData;
}

// ==================== Phase 1: 问题分析 ====================
function AnalysisSection({ data }: { data: AnalysisSectionData }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="my-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/50 transition-colors text-left"
      >
        <div className="p-1.5 bg-indigo-500 rounded-lg shrink-0">
          <Search size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-indigo-900">问题分析</h3>
          <p className="text-xs text-indigo-600/70 mt-0.5 truncate">{data.intent}</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
          Phase 1
        </span>
        {expanded ? <ChevronDown size={15} className="text-indigo-400 shrink-0" /> : <ChevronRight size={15} className="text-indigo-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-100/60 pt-3">
          
          {/* 意图识别 */}
          <div className="bg-white/70 rounded-lg p-3 border border-indigo-100/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target size={12} className="text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-800">意图识别</span>
            </div>
            <p className="text-[13px] text-indigo-900 leading-relaxed">{data.intent}</p>
          </div>

          {/* 分析范围 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Database size={12} className="text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-800">分析范围</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.scope.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-md text-[11px] font-medium text-indigo-700 border border-indigo-150 shadow-sm"
                >
                  <CheckCircle2 size={10} className="text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* 关键词提取 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={12} className="text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-800">关键要素</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-indigo-100/70 rounded text-[11px] font-medium text-indigo-600"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Phase 2: 数据洞察 ====================
function MiniStatusCards({ items }: { items?: Array<{ label: string; percent: number; status: string; trend?: number }> }) {
  const colorMap: Record<string, { bg: string; border: string; bar: string; dot: string }> = {
    healthy: { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', bar: 'bg-emerald-500', dot: 'text-emerald-500' },
    warning: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', bar: 'bg-amber-500', dot: 'text-amber-500' },
    critical: { bg: 'from-red-50 to-rose-50', border: 'border-red-200', bar: 'bg-red-500', dot: 'text-red-500' },
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item, i) => {
        const c = colorMap[item.status] || colorMap.healthy;
        return (
          <div key={i} className={`rounded-lg p-2.5 bg-gradient-to-br ${c.bg} border ${c.border}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-gray-700">{item.label}</span>
              <span className={`text-[10px] font-bold ${c.dot}`}>{item.percent}%</span>
            </div>
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(item.percent, 100)}%` }} />
            </div>
            {item.trend !== undefined && (
              <span className={`text-[9px] mt-0.5 block ${item.trend > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                {item.trend > 0 ? '↑' : '↓'} {Math.abs(item.trend)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 75 - 12.5}`)
    .join(' ');
  const strokeColor = color === 'indigo' ? '#6366f1' : color === 'emerald' ? '#10b981' : color === 'amber' ? '#f59e0b' : '#6366f1';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`mc-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#mc-${color})`} />
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((v - min) / range) * 75 - 12.5;
        return <circle key={i} cx={x} cy={y} r="1.3" fill="white" stroke={strokeColor} strokeWidth="1" />;
      })}
    </svg>
  );
}

function MiniTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((col, i) => (
              <th key={i} className="py-1.5 px-2.5 text-left text-gray-500 font-medium whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {row.map((cell, j) => (
                <td key={j} className="py-1.5 px-2.5 text-gray-700 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniProgressItems({ items }: { items: Array<{ label: string; value: number; max: number; status?: string }> }) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const pct = Math.round((item.value / item.max) * 100);
        const isWarn = pct > 80;
        const isCrit = pct > 95;
        return (
          <div key={i}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[11px] font-medium text-gray-700">{item.label}</span>
              <div className="flex items-center gap-1.5">
                {item.status && <span className="text-[9px] text-gray-400">{item.status}</span>}
                <span className={`text-[11px] font-bold tabular-nums ${isCrit ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-gray-800'}`}>{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isCrit ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataInsightCard({ data }: { data: DataInsightData }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      
      <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <BarChart3 size={13} className="text-indigo-500 shrink-0" />
            <h4 className="text-[13px] font-semibold text-gray-800 truncate">{data.title}</h4>
          </div>
          {data.description && (
            <p className="text-[11px] text-gray-400 leading-snug line-clamp-1">{data.description}</p>
          )}
        </div>
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400"
        >
          {showDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      <div className="p-3">
        {data.vizType === 'status-cards' && (
          <MiniStatusCards items={(data.data.items as Array<{ label: string; percent: number; status: string; trend?: number }> | undefined)} />
        )}

        {data.vizType === 'metric-chart' && (
          <>
            <MiniChart
              data={(data.data.series as Array<{ value: number }>).map(s => s.value)}
              color={(data.data.color as string) || 'indigo'}
            />
            {(data.data.showTable as boolean) && (
              <div className="mt-2">
                <MiniTable
                  columns={['时间', '数值']}
                  rows={(data.data.series as Array<{ label: string; value: number; unit?: string }>)
                    .slice(-5)
                    .map(s => [s.label, `${s.value}${(data.data.unit as string) || ''}`])}
                />
              </div>
            )}
          </>
        )}

        {data.vizType === 'data-table' && (
          <MiniTable
            columns={(data.data.columns as Array<{ label: string }>).map(c => c.label)}
            rows={(data.data.rows as Record<string, string>[]).map(row =>
              (data.data.columns as Array<{ key: string }>).map(c => String(row[c.key] ?? '-'))
            )}
          />
        )}

        {data.vizType === 'metric-summary' && (
          <div className="grid grid-cols-2 gap-2">
            {((data.data.metrics as Array<Record<string, unknown>>) || []).map((m, i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-2.5 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{String(m.label)}</p>
                <p className="text-base font-bold text-gray-900">{String(m.value)}</p>
              </div>
            ))}
          </div>
        )}

        {data.vizType === 'progress-group' && (
          <MiniProgressItems items={data.data.items as Array<{ label: string; value: number; max: number; status?: string }>} />
        )}

        {showDetail && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {data.insight && (
              <div className="flex gap-2 p-2.5 bg-blue-50/60 rounded-lg border border-blue-100/50">
                <Lightbulb size={13} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[12px] text-blue-800 leading-relaxed">{data.insight}</p>
              </div>
            )}
            {data.highlight && (
              <div className="flex gap-2 p-2.5 bg-amber-50/60 rounded-lg border border-amber-100/50">
                <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800 leading-relaxed font-medium">{data.highlight}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DataInsightsSection({ insights, phaseLabel }: { insights: DataInsightData[]; phaseLabel?: string }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="my-3 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-sky-50/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors text-left"
      >
        <div className="p-1.5 bg-cyan-500 rounded-lg shrink-0">
          <BarChart3 size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-cyan-900">数据洞察</h3>
          <p className="text-xs text-cyan-600/70 mt-0.5">已采集 {insights.length} 组数据</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
          {phaseLabel || 'Phase 2'}
        </span>
        {expanded ? <ChevronDown size={15} className="text-cyan-400 shrink-0" /> : <ChevronRight size={15} className="text-cyan-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-cyan-100/60 pt-3">
          {insights.map((insight, i) => (
            <DataInsightCard key={i} data={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Phase 3: 逐步推理 ====================
function ReasoningStepCard({ step, isLast }: { step: ReasoningStep; isLast: boolean }) {
  const [open, setOpen] = useState(true);

  const statusConfig = {
    completed: { icon: <CheckCircle2 size={14} />, bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-500/20' },
    warning: { icon: <AlertCircle size={14} />, bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500/20' },
    critical: { icon: <AlertCircle size={14} />, bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', ring: 'ring-red-500/20' },
  };
  const cfg = statusConfig[step.status];

  return (
    <div className="relative pl-7">
      
      {!isLast && (
        <div className="absolute left-[15px] top-7 bottom-0 w-px bg-gray-200" />
      )}

      <div className={`relative rounded-xl border ${cfg.border} bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow ring-1 ${cfg.ring}`}>
        
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-start gap-3 px-3.5 py-2.5 text-left hover:bg-gray-50/30 transition-colors"
        >
          <div className={`absolute -left-7 top-2.5 w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg} border-2 border-white shadow-sm z-10`}>
            <span className={`${cfg.text}`}>{step.id}</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-[13px] font-semibold text-gray-800">{step.title}</h4>
              <span className={`shrink-0 ${cfg.bg} ${cfg.text} text-[10px] font-semibold px-1.5 py-0.5 rounded-full`}>
                {step.status === 'completed' ? '正常' : step.status === 'warning' ? '注意' : '异常'}
              </span>
            </div>
            <p className="text-[12px] text-gray-600 leading-relaxed">{step.finding}</p>
          </div>
          
          <span className="shrink-0 text-gray-300">{open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </button>

        {open && (
          <div className="px-3.5 pb-3 space-y-2.5 border-t border-gray-100/60 pt-2.5">
            
            {step.evidence && (
              <div className="flex gap-2 p-2.5 bg-gray-50 rounded-lg">
                <Info size={12} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-600 leading-relaxed">{step.evidence}</p>
              </div>
            )}

            {step.vizType === 'metric-chart' && step.vizData && (
              <div className="rounded-lg border border-gray-100 p-2.5 bg-gray-50/30">
                <p className="text-[10px] text-gray-400 mb-1.5 font-medium">数据趋势</p>
                <MiniChart
                  data={(step.vizData.series as Array<{ value: number }>)?.map(s => s.value) || []}
                  color={(step.vizData.color as string) || 'indigo'}
                />
              </div>
            )}

            {step.vizType === 'alert-list' && step.vizData && (
              <div className="space-y-1.5">
                {(step.vizData.alerts as Array<{ level: string; message: string; time: string }> || []).map((a, j) => (
                  <div key={j} className={`flex gap-2 p-2 rounded-lg ${
                    a.level === 'critical' ? 'bg-red-50 border border-red-100' :
                    a.level === 'warning' ? 'bg-amber-50 border border-amber-100' :
                    'bg-blue-50 border border-blue-100'
                  }`}>
                    <AlertCircle size={11} className={`
                      ${a.level === 'critical' ? 'text-red-500' :
                      a.level === 'warning' ? 'text-amber-500' : 'text-blue-500'}
                      shrink-0 mt-0.5
                    `} />
                    <div>
                      <p className="text-[11px] font-medium text-gray-800 leading-snug">{a.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step.vizType === 'timeline' && step.vizData && (
              <div className="space-y-2">
                {(step.vizData.events as Array<{ time: string; title: string; description?: string; type?: string }> || []).map((e, j) => (
                  <div key={j} className="flex gap-2.5">
                    <span className="text-[10px] text-gray-400 font-mono shrink-0 pt-0.5">{e.time}</span>
                    <div>
                      <p className="text-[11px] font-medium text-gray-800">{e.title}</p>
                      {e.description && <p className="text-[10px] text-gray-500 mt-0.5">{e.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step.vizType === 'progress-group' && step.vizData && (
              <MiniProgressItems items={step.vizData.items as Array<{ label: string; value: number; max: number; status?: string }>} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReasoningSection({ steps }: { steps: ReasoningStep[] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/60 to-purple-50/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors text-left"
      >
        <div className="p-1.5 bg-violet-500 rounded-lg shrink-0">
          <ListChecks size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-violet-900">逐步推理</h3>
          <p className="text-xs text-violet-600/70 mt-0.5">共 {steps.length} 个分析步骤</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
          Phase 3
        </span>
        {expanded ? <ChevronDown size={15} className="text-violet-400 shrink-0" /> : <ChevronRight size={15} className="text-violet-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-5 pt-2 space-y-4 border-t border-violet-100/60">
          {steps.map((step, i) => (
            <ReasoningStepCard key={step.id} step={step} isLast={i === steps.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Phase 4: 结论与建议 ====================
function ConclusionSection({ data }: { data: ConclusionData }) {
  const [expanded, setExpanded] = useState(true);

  const findTypeConfig = (type: string) => ({
    good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle2 size={12} className="text-emerald-500" /> },
    warn: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <AlertCircle size={12} className="text-amber-500" /> },
    bad: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: <AlertCircle size={12} className="text-red-500" /> },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: <Info size={12} className="text-blue-500" /> },
  }[type] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: <Info size={12} className="text-gray-500" /> });

  const priorityConfig = {
    high: { badge: 'bg-red-100 text-red-700 border border-red-200', label: '高优先级' },
    medium: { badge: 'bg-amber-100 text-amber-700 border border-amber-200', label: '中优先级' },
    low: { badge: 'bg-gray-100 text-gray-600 border border-gray-200', label: '低优先级' },
  };

  return (
    <div className="my-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors text-left"
      >
        <div className="p-1.5 bg-emerald-500 rounded-lg shrink-0">
          <ClipboardList size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-emerald-900">结论与建议</h3>
          <p className="text-xs text-emerald-600/70 mt-0.5 truncate">{data.summary.slice(0, 60)}...</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          Phase 4
        </span>
        {expanded ? <ChevronDown size={15} className="text-emerald-400 shrink-0" /> : <ChevronRight size={15} className="text-emerald-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3.5 border-t border-emerald-100/60 pt-3">
          
          {/* 总结 */}
          <div className="bg-white/70 rounded-xl p-3.5 border border-emerald-100/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield size={13} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800">分析结论</span>
            </div>
            <p className="text-[13px] text-gray-800 leading-relaxed">{data.summary}</p>
          </div>

          {/* 关键发现 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb size={12} className="text-amber-500" />
              <span className="text-xs font-bold text-gray-700">关键发现</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {data.findings.map((f, i) => {
                const cfg = findTypeConfig(f.type);
                return (
                  <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg ${cfg.bg} ${cfg.border}`}>
                    {cfg.icon}
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-500">{f.label}</p>
                      <p className={`text-[12px] font-semibold ${cfg.text} truncate`}>{f.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 建议操作 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={12} className="text-indigo-500" />
              <span className="text-xs font-bold text-gray-700">建议操作</span>
            </div>
            <div className="space-y-2">
              {data.recommendations.map((r, i) => {
                const pcfg = priorityConfig[r.priority];
                return (
                  <div key={i} className="flex gap-3 p-3 bg-white rounded-xl border border-gray-100 group hover:border-indigo-200 hover:shadow-sm transition-all">
                    <div className="shrink-0 mt-0.5">
                      <ArrowRight size={16} className="text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[12px] font-semibold text-gray-800">{r.action}</p>
                        <span className={`text-[9px] font-medium px-1.5 py-px rounded-full ${pcfg.badge}`}>{pcfg.label}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{r.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 后续步骤 */}
          {data.nextSteps && data.nextSteps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-700">后续步骤</span>
              </div>
              <div className="space-y-1.5">
                {data.nextSteps.map((ns, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[12px] text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <span>{ns}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Main Renderer ====================
export function ModularAnalysisRenderer({ response }: { response: ModularResponse }) {
  return (
    <div className="space-y-1">
      <AnalysisSection data={response.analysis} />
      <DataInsightsSection insights={response.dataInsights} />
      <ReasoningSection steps={response.reasoning} />
      <ConclusionSection data={response.conclusion} />
    </div>
  );
}

// ==================== Auto Generator ====================
export function generateModularResponse(content: string): ModularResponse | null {
  
  if (/CPU|内存|磁盘|网络|使用率|监控/i.test(content)) {
    return {
      analysis: {
        phase: 'analysis',
        intent: '用户请求查看系统资源使用状况，需要获取 CPU、内存、磁盘、网络的实时监控数据，并分析当前资源负载是否健康',
        scope: ['Prometheus 监控指标', '服务器节点状态', '历史趋势数据', '告警阈值对比'],
        keywords: ['CPU使用率', '内存占用', '磁盘空间', '网络流量', '实时监控'],
      },
      dataInsights: [
        {
          title: '系统资源总览',
          description: '各核心资源的实时状态',
          vizType: 'status-cards',
          data: {
            items: [
              { label: 'CPU', percent: 35, status: 'healthy', trend: -2.3 },
              { label: '内存', percent: 62, status: 'healthy', trend: 1.8 },
              { label: '磁盘', percent: 78, status: 'warning', trend: 3.5 },
              { label: '网络', percent: 28, status: 'healthy', trend: -5.1 },
            ],
          },
          insight: '整体资源使用处于中等水平，磁盘使用率接近警告阈值，建议关注日志清理策略',
          highlight: '磁盘 /data 分区已达到 78%，预计 3 天后可能达到 90% 告警线',
        },
        {
          title: 'CPU 使用率趋势（近12小时）',
          description: '所有节点的平均 CPU 使用情况',
          vizType: 'metric-chart',
          data: {
            series: [
              { label: '00:00', value: 32 }, { label: '02:00', value: 28 }, { label: '04:00', value: 25 },
              { label: '06:00', value: 35 }, { label: '08:00', value: 55 }, { label: '10:00', value: 68 },
              { label: '12:00', value: 72 }, { label: '14:00', value: 65 }, { label: '16:00', value: 58 },
              { label: '18:00', value: 45 }, { label: '20:00', value: 38 }, { label: '22:00', value: 33 },
            ],
            unit: '%',
            color: 'indigo',
            showTable: true,
          },
          insight: '早高峰（8:00-14:00）期间 CPU 使用率较高，峰值出现在中午 12:00 达到 72%',
        },
        {
          title: '集群容量概览',
          description: '25 个节点的综合资源统计',
          vizType: 'metric-summary',
          data: {
            metrics: [
              { label: '在线节点', value: '24/25' },
              { label: '平均 CPU', value: '42.3%', change: 5.2 },
              { label: '平均内存', value: '68.7%', change: -2.1 },
              { label: '活跃告警', value: '3', change: -4 },
            ],
          },
        },
        {
          title: '容量预警分析',
          description: '各项资源的使用趋势和预警时间预测',
          vizType: 'progress-group',
          data: {
            items: [
              { label: '内存使用率', value: 62, max: 100, status: '预计 +8h 达到 80%' },
              { label: '磁盘 /data 分区', value: 780, max: 1024, status: '预计 +3天 满载' },
              { label: '数据库连接数', value: 850, max: 1000, status: '并发高峰期风险' },
              { label: 'CPU 核心使用', value: 35, max: 100, status: '运行正常' },
            ],
          },
        },
      ],
      reasoning: [
        {
          id: 1,
          title: 'CPU 资源评估',
          finding: '当前集群平均 CPU 使用率为 42.3%，较昨日上升 5.2%。峰值时段（10:00-14:00）达到 72%，但未触发告警阈值（85%）。',
          evidence: '通过 Prometheus 查询 avg by(instance)(rate(node_cpu_seconds_total{mode!="idle"}[5m])) 获取，覆盖全部 24 个在线节点。',
          vizType: 'metric-chart',
          vizData: {
            series: [
              { label: '现在', value: 42 }, { label: '+2h', value: 48 }, { label: '+4h', value: 52 },
              { label: '+6h', value: 58 }, { label: '+8h', value: 62 }, { label: '+10h', value: 55 },
            ],
            unit: '%',
            color: 'indigo',
          },
          status: 'completed',
        },
        {
          id: 2,
          title: '内存压力检测',
          finding: '内存使用率为 68.7%，其中 prod-db-01 和 prod-api-01 两台机器超过 70%。prod-db-01 的 MySQL 进程占用约 65% 内存，存在 OOM 风险。',
          evidence: 'prod-db-01: 内存 88%（12GB/16GB），MySQL 占用 10.4GB；prod-api-01: 内存 72%（5.8GB/8GB），Java Heap 4.2GB',
          vizType: 'progress-group',
          vizData: {
            items: [
              { label: 'prod-db-01 MySQL', value: 88, max: 100, status: '高风险' },
              { label: 'prod-api-01 JVM', value: 72, max: 100, status: '需观察' },
              { label: 'prod-worker-01', value: 76, max: 100, status: '正常范围' },
              { label: '集群均值', value: 68.7, max: 100, status: '基准值' },
            ],
          },
          status: 'warning',
        },
        {
          id: 3,
          title: '磁盘空间预警',
          finding: '/data 分区使用率达到 76.1%（780GB/1TB），按当前日均增长 15GB 计算，约 15 天后将达到 90% 告警阈值。主要占用为 Nginx 日志（320GB）和应用日志（280GB）。',
          evidence: 'df -h /data 显示 Used=780G, Avail=244G。du -sh /data/logs/* 显示 nginx-access.log 180GB + error.log 140GB',
          status: 'warning',
        },
        {
          id: 4,
          title: '网络流量分析',
          finding: '网络 I/O 整体健康，入站带宽峰值 450Mbps（上限 1Gbps），出站 380Mbps。未发现异常流量或 DDoS 迹象。',
          vizType: 'metric-chart',
          vizData: {
            series: [
              { label: '00:00', value: 120 }, { label: '04:00', value: 80 }, { label: '08:00', value: 280 },
              { label: '12:00', value: 420 }, { label: '16:00', value: 380 }, { label: '20:00', value: 250 },
            ],
            unit: 'Mbps',
            color: 'emerald',
          },
          status: 'completed',
        },
      ],
      conclusion: {
        summary: '经过全面分析，当前系统整体运行基本稳定，但存在 2 个需要关注的潜在风险：1）磁盘空间增长较快，需尽快制定清理策略；2）部分高负载节点内存接近警戒线，建议进行 JVM 参数优化或扩容。其余指标均在健康范围内。',
        findings: [
          { label: 'CPU 状态', value: '健康，有上升趋势', type: 'warn' },
          { label: '内存状态', value: '2 节点偏高', type: 'warn' },
          { label: '磁盘状态', value: '/data 76%，需关注', type: 'bad' },
          { label: '网络状态', value: '正常，无异常', type: 'good' },
          { label: '告警数量', value: '3 个活跃告警', type: 'info' },
        ],
        recommendations: [
          { priority: 'high', action: '配置 logrotate 自动轮转并压缩 Nginx 日志，保留最近 7 天', reason: 'Nginx 日志占磁盘 43%，是最主要的增长来源' },
          { priority: 'high', action: '对 prod-db-01 执行 MySQL 内存参数调优（innodb_buffer_pool_size 从 8G 降至 6G）', reason: '当前 buffer pool 配置过高导致可用内存不足，存在 OOM 风险' },
          { priority: 'medium', action: '设置磁盘使用率 85% 告警规则，提前预警', reason: '当前无磁盘告警规则，无法提前感知风险' },
          { priority: 'low', action: '考虑将日志存储迁移至对象存储或 ELK 集群', reason: '长期方案，从根本上解决本地磁盘日志膨胀问题' },
        ],
        nextSteps: [
          '立即执行 Nginx logrotate 配置（预计释放 200GB+ 空间）',
          '在业务低峰期调整 prod-db-01 MySQL 参数并重启',
          '添加磁盘监控告警规则到 AlertManager',
          '一周后复查磁盘和内存使用情况',
        ],
      },
    };
  }

  if (/服务|拓扑|架构|微服务|依赖关系/i.test(content)) {
    return {
      analysis: {
        phase: 'analysis',
        intent: '用户需要了解当前微服务系统的架构拓扑、服务依赖关系以及各服务的健康状态，用于故障排查或架构理解',
        scope: ['服务发现注册中心', '服务调用链路', '基础设施依赖', '健康检查端点'],
        keywords: ['微服务架构', '服务拓扑', '调用关系', '健康状态', '依赖图谱'],
      },
      dataInsights: [
        {
          title: '服务架构拓扑',
          description: '当前系统的完整服务依赖关系',
          vizType: 'status-cards',
          data: {
            items: [
              { label: 'API Gateway', percent: 95, status: 'healthy', trend: 0 },
              { label: '用户服务', percent: 82, status: 'healthy', trend: -3 },
              { label: '订单服务', percent: 73, status: 'warning', trend: 8 },
              { label: '支付服务', percent: 91, status: 'healthy', trend: -1 },
              { label: 'MySQL 主库', percent: 68, status: 'healthy', trend: 2 },
              { label: 'Redis 集群', percent: 45, status: 'healthy', trend: -5 },
              { label: '消息队列', percent: 87, status: 'warning', trend: 12 },
              { label: 'Elasticsearch', percent: 32, status: 'healthy', trend: 0 },
            ],
          },
          insight: '订单服务和消息队列存在性能瓶颈，订单服务 P99 延迟升高导致消息队列积压',
          highlight: '消息队列积压量已达 15,234 条，远超正常水平 (<1000)',
        },
        {
          title: '服务响应时间分布',
          description: '各服务的 P50/P99/P999 延迟指标',
          vizType: 'data-table',
          data: {
            columns: [{ key: 'name', label: '服务名' }, { key: 'p50', label: 'P50(ms)' }, { key: 'p99', label: 'P99(ms)' }, { key: 'qps', label: 'QPS' }, { key: 'errorRate', label: '错误率' }],
            rows: [
              { name: 'API Gateway', p50: '12', p99: '85', qps: '2,340', errorRate: '0.02%' },
              { name: '用户服务', p50: '18', p99: '120', qps: '1,890', errorRate: '0.05%' },
              { name: '订单服务', p50: '145', p99: '2,300', qps: '890', errorRate: '2.3%' },
              { name: '支付服务', p50: '35', p99: '210', qps: '420', errorRate: '0.08%' },
            ],
          },
          highlight: '订单服务 P99 延迟高达 2300ms，错误率 2.3%，远超其他服务',
        },
      ],
      reasoning: [
        {
          id: 1,
          title: '入口层分析 — API Gateway',
          finding: 'API Gateway 运行正常，P99 延迟 85ms，QPS 2,340，错误率仅 0.02%。作为流量入口表现良好，未成为瓶颈。',
          status: 'completed',
        },
        {
          id: 2,
          title: '核心业务层 — 订单服务异常',
          finding: '订单服务出现严重性能退化：P99 延迟从正常的 180ms 暴涨至 2,300ms（↑1177%），错误率升至 2.3%。初步判断为下游依赖阻塞导致级联故障。',
          evidence: 'Trace ID: abc123xyz — 发现订单服务 → MySQL 查询耗时从 20ms 升至 1,800ms，连接池等待队列长度 850+',
          vizType: 'alert-list',
          vizData: {
            alerts: [
              { level: 'critical', message: '订单服务 P99 延迟超阈值 (2300ms > 500ms)', time: '持续中', count: 156 },
              { level: 'warning', message: '数据库慢查询增加：SELECT * FROM orders WHERE ... 耗时 1.8s', time: '频繁出现', count: 89 },
              { level: 'warning', message: 'HikariCP 连接池等待线程数: 850 (maxTotal=1000)', time: '持续中', count: 1 },
            ],
          },
          status: 'critical',
        },
        {
          id: 3,
          title: '数据层影响 — MySQL & Redis',
          finding: 'MySQL 主库因大量慢查询导致连接池耗尽，进而影响 Redis 缓存命中率下降至 68%（正常 >95%）。消息队列因订单服务处理变慢而积压。',
          vizType: 'progress-group',
          vizData: {
            items: [
              { label: 'MySQL 连接池', value: 985, max: 1000, status: '几乎耗尽!' },
              { label: 'Redis 命中率', value: 68, max: 100, status: '严重下降' },
              { label: 'MQ 积压量', value: 15234, max: 5000, status: '超出 3 倍' },
              { label: '缓存穿透 QPS', value: 320, max: 1000, status: '部分请求直连DB' },
            ],
          },
          status: 'critical',
        },
        {
          id: 4,
          title: '根因定位',
          finding: '根因确认：订单服务的一个新上线 SQL 查询缺少索引，导致全表扫描（表数据 1200 万行）。该查询被高频调用，拖垮整个数据库连接池，引发级联故障。',
          evidence: 'EXPLAIN 分析显示 type=ALL, rows=12,000,000, Extra=Using filesort。涉及 SQL: SELECT * FROM orders WHERE create_time > NOW() - INTERVAL 7 DAY ORDER BY amount DESC LIMIT 100',
          status: 'critical',
        },
      ],
      conclusion: {
        summary: '本次架构分析发现订单服务存在严重的 SQL 性能问题（缺少索引的全表扫描），已导致数据库连接池接近耗尽、缓存失效、消息队列积压的级联故障。根因明确，修复方案清晰。',
        findings: [
          { label: '根因', value: '订单SQL缺少索引', type: 'bad' },
          { label: '影响范围', value: '订单/支付/用户服务', type: 'bad' },
          { label: 'MQ积压', value: '15,234 条 (3x)', type: 'bad' },
          { label: 'DB连接池', value: '985/1000 (99%)', type: 'bad' },
          { label: '修复难度', value: '低（加索引即可）', type: 'good' },
        ],
        recommendations: [
          { priority: 'high', action: '立即为 orders 表的 create_time 字段添加复合索引 (create_time, amount DESC)', reason: '这是根因修复，添加索引后查询将从全表扫描变为索引扫描，耗时从 1.8s 降至 <5ms' },
          { priority: 'high', action: '临时扩大 HikariCP 最大连接数至 2000 并重启订单服务', reason: '缓解连接池耗尽问题，为索引创建争取时间' },
          { priority: 'medium', action: '启动消费者扩容加速 MQ 积压消费', reason: '减少消息队列积压，避免数据丢失' },
          { priority: 'medium', action: '事后复盘：建立 SQL 审查流程，新上线 SQL 必须通过 EXPLAIN 审核', reason: '防止类似问题再次发生' },
        ],
        nextSteps: [
          '执行 ALTER TABLE orders ADD INDEX idx_create_amount (create_time, amount DESC)',
          '验证索引生效：EXPLAIN 确认 type=range',
          '观察系统指标恢复情况（预期 5 分钟内恢复正常）',
          '编写故障复盘报告并存入知识库',
        ],
      },
    };
  }

  if (/告警|异常|错误|故障|alert|error/i.test(content)) {
    return {
      analysis: {
        phase: 'analysis',
        intent: '用户需要了解当前活跃告警的情况、严重程度、可能原因以及处理建议，需要进行全面的告警分析和根因定位',
        scope: ['AlertManager 告警数据', 'Prometheus 规则', '事件时间线', '关联服务状态'],
        keywords: ['活跃告警', '告警级别', '根因分析', '影响范围', '处理建议'],
      },
      dataInsights: [
        {
          title: '活跃告警列表',
          description: '当前所有未恢复的告警',
          vizType: 'status-cards',
          data: {
            items: [
              { label: 'Critical', percent: 1, status: 'critical' },
              { label: 'Warning', percent: 2, status: 'warning' },
              { label: 'Info', percent: 1, status: 'healthy' },
              { label: '已静默', percent: 3, status: 'healthy' },
            ],
          },
          highlight: '共 4 个活跃告警，其中 1 个 Critical 需要立即处理',
        },
        {
          title: '告警趋势（近24小时）',
          description: '告警数量随时间变化',
          vizType: 'metric-chart',
          data: {
            series: [
              { label: '00:00', value: 2 }, { label: '04:00', value: 1 }, { label: '08:00', value: 5 },
              { label: '12:00', value: 8 }, { label: '16:00', value: 6 }, { label: '20:00', value: 4 },
            ],
            unit: '个',
            color: 'red',
          },
          insight: '告警集中在上午 8:00-14:00 业务高峰期',
        },
      ],
      reasoning: [
        {
          id: 1,
          title: 'Critical 告警 — 订单服务超时',
          finding: '订单服务 HTTP P99 响应时间持续超过 500ms 阈值，当前值 2,300ms。该告警已持续 47 分钟，触发了 156 次。',
          vizType: 'timeline',
          vizData: {
            events: [
              { time: '14:32:05', title: '首次触发', description: 'P99 延迟达到 520ms', type: 'warning' },
              { time: '14:33:20', title: '升级为 Critical', description: '延迟突破 1000ms', type: 'error' },
              { time: '14:35:00', title: '自动诊断启动', description: 'AIOps Agent 开始分析', type: 'info' },
              { time: '14:38:15', title: '根因锁定', description: '定位到慢查询问题', type: 'error' },
              { time: '14:40:00', title: '等待人工确认', description: '建议已生成', type: 'warning' },
            ],
          },
          status: 'critical',
        },
        {
          id: 2,
          title: 'Warning 告警 — 消息队列积压',
          finding: 'RabbitMQ 订单队列深度超过 10,000 阈值，当前 15,234。这是订单服务超时的直接后果——生产者正常但消费者处理速度大幅下降。',
          status: 'warning',
        },
        {
          id: 3,
          title: 'Warning 告警 — 数据库慢查询',
          finding: 'MySQL 慢查询日志中出现大量 (>100次/分钟) 耗时 >200ms 的查询，均来自同一 SQL 模式（orders 表范围查询）。',
          status: 'warning',
        },
        {
          id: 4,
          title: 'Info 告警 — 证书过期提醒',
          finding: 'api.example.com 的 TLS 证书将在 7 天后过期。非紧急但需要安排更新。',
          status: 'completed',
        },
      ],
      conclusion: {
        summary: '当前共有 4 个活跃告警，核心问题是订单服务因数据库慢查询导致的响应超时（Critical），并引发了消息队列积压和慢查询增多的连锁反应。Info 级别的证书过期可单独安排处理。',
        findings: [
          { label: 'Critical', value: '1 (订单超时)', type: 'bad' },
          { label: 'Warning', value: '2 (MQ+慢查询)', type: 'warn' },
          { label: 'Info', value: '1 (证书过期)', type: 'info' },
          { label: '根因', value: 'SQL缺索引', type: 'bad' },
          { label: 'MTTR预估', value: '< 10分钟', type: 'good' },
        ],
        recommendations: [
          { priority: 'high', action: '立即添加 orders 表索引修复根因', reason: '一条 ALTER TABLE 即可解决所有 Critical 和 Warning 告警' },
          { priority: 'high', action: '临时扩容消费者加速 MQ 消费', reason: '防止消息堆积导致数据丢失' },
          { priority: 'low', action: '安排下周二维护窗口更新证书', reason: '还有 7 天缓冲期，不紧急' },
        ],
        nextSteps: [
          '执行索引添加命令',
          '确认告警自动恢复',
          '创建证书更新工单',
        ],
      },
    };
  }

  if (/趋势|预测|forecast|未来|capacity/i.test(content)) {
    return {
      analysis: {
        phase: 'analysis',
        intent: '用户希望了解系统资源的历史使用趋势，并对未来一段时间内的资源需求进行预测，以便提前做好容量规划',
        scope: ['历史时序数据', '趋势分析算法', '容量规划模型', '季节性因素'],
        keywords: ['趋势预测', '容量规划', '未来趋势', '资源预测', '扩容建议'],
      },
      dataInsights: [
        {
          title: '资源使用趋势预测',
          description: '基于 ARIMA 模型的未来 24 小时预测',
          vizType: 'metric-chart',
          data: {
            series: [
              { label: '现在', value: 62 }, { label: '+4h', value: 68 }, { label: '+8h', value: 78 },
              { label: '+12h', value: 85 }, { label: '+16h', value: 82 }, { label: '+20h', value: 71 },
              { label: '+24h', value: 58 },
            ],
            unit: '%',
            color: 'amber',
          },
          insight: '预测今天下午 14:00-16:00 内存使用将达到峰值 85%，接近告警阈值',
          highlight: '⚠️ 预计 +12h 后内存将达到 85% 告警线！',
        },
        {
          title: '容量预警矩阵',
          description: '各项资源到达告警阈值的预测时间',
          vizType: 'progress-group',
          data: {
            items: [
              { label: '内存 → 80% 告警', value: 62, max: 80, status: '预计 ~8小时后' },
              { label: '磁盘 → 90% 告警', value: 78, max: 90, status: '预计 ~3天后' },
              { label: '连接池 → 90% 告警', value: 85, max: 90, status: '预计 ~6小时后' },
              { label: 'CPU → 80% 告警', value: 42, max: 80, status: '暂无风险' },
            ],
          },
        },
        {
          title: '周同比趋势',
          description: '本周 vs 上周同期对比',
          vizType: 'metric-summary',
          data: {
            metrics: [
              { label: '日均 CPU', value: '42.3%', change: 5.2 },
              { label: '日均内存', value: '68.7%', change: 8.1 },
              { label: '日均磁盘增量', value: '+15 GB/d', change: 22 },
              { label: '平均 QPS', value: '3,240', change: -3.5 },
            ],
          },
        },
      ],
      reasoning: [
        {
          id: 1,
          title: '历史基线建立',
          finding: '基于过去 30 天的数据建立了资源使用基线。CPU 呈现明显的日周期性（早晚高峰），内存呈线性增长趋势（+2%/天），磁盘稳定增长（~15GB/天）。',
          status: 'completed',
        },
        {
          id: 2,
          title: '模式识别',
          finding: '识别到以下规律：(1) 工作日 10:00-14:00 为高峰期；(2) 每周五晚有定时任务导致内存突增；(3) 月初报表任务导致磁盘写入激增。',
          vizType: 'metric-chart',
          vizData: {
            series: [
              { label: '周一', value: 41 }, { label: '周二', value: 44 }, { label: '周三', value: 43 },
              { label: '周四', value: 46 }, { label: '周五', value: 52 }, { label: '周六', value: 28 },
              { label: '周日', value: 25 },
            ],
            unit: '%',
            color: 'purple',
          },
          status: 'completed',
        },
        {
          id: 3,
          title: '预测结果输出',
          finding: 'ARIMA 模型预测显示：内存将在今天下午达到峰值 85%（触发告警），磁盘将在约 3 天后达到 90% 告警线。建议立即开始准备扩容或优化方案。',
          status: 'warning',
        },
      ],
      conclusion: {
        summary: '基于 30 天历史数据的趋势分析表明，系统资源使用呈温和上升趋势。最紧急的风险是内存可能在今天下午达到告警阈值，其次是磁盘空间约 3 天后的满载风险。建议立即采取预防措施。',
        findings: [
          { label: '内存风险', value: '~8h 后达 80%', type: 'bad' },
          { label: '磁盘风险', value: '~3d 后达 90%', type: 'warn' },
          { label: 'CPU 趋势', value: '周环比 +5.2%', type: 'warn' },
          { label: 'QPS 变化', value: '周环比 -3.5%', type: 'good' },
          { label: '模型置信度', value: '87%', type: 'info' },
        ],
        recommendations: [
          { priority: 'high', action: '在今天下午高峰前（12:00 前）完成一次应用重启以回收内存碎片', reason: '可临时降低 10-15% 内存使用，为下午高峰留出余量' },
          { priority: 'high', action: '立即执行日志清理脚本，目标释放至少 50GB 空间', reason: '将磁盘满载时间从 3 天推迟到 7 天以上' },
          { priority: 'medium', action: '提交磁盘扩容工单（申请 +500GB）', reason: '作为中长期解决方案' },
          { priority: 'low', action: '设置自动化容量预警（使用率 >70% 时通知）', reason: '提前感知而非被动应对' },
        ],
        nextSteps: [
          '执行内存回收操作（今日 12:00 前）',
          '运行日志清理脚本',
          '提交扩容申请',
          '一周后复查预测准确度',
        ],
      },
    };
  }

  if (/服务器|server|主机|instance|节点|集群/i.test(content)) {
    return {
      analysis: {
        phase: 'analysis',
        intent: '用户需要了解集群中各服务器的详细资源使用情况和运行状态，包括每台主机的 CPU、内存、磁盘等指标以及健康状态',
        scope: ['全部节点清单', '各节点资源指标', '节点角色分类', '异常节点标记'],
        keywords: ['服务器列表', '主机状态', '节点资源', '集群概览', '实例详情'],
      },
      dataInsights: [
        {
          title: '集群总览',
          description: '25 个节点的总体运行状态',
          vizType: 'metric-summary',
          data: {
            metrics: [
              { label: '总节点数', value: '25' },
              { label: '在线节点', value: '24', change: 0 },
              { label: '离线节点', value: '1 (prod-backup-02)' },
              { label: '平均 CPU', value: '42.3%' },
              { label: '平均内存', value: '68.7%' },
              { label: '异常节点', value: '2' },
            ],
          },
        },
        {
          title: '服务器资源明细',
          description: '各节点的 CPU、内存、状态一览',
          vizType: 'data-table',
          data: {
            columns: [
              { key: 'name', label: '主机名' },
              { key: 'ip', label: 'IP 地址' },
              { key: 'role', label: '角色' },
              { key: 'cpu', label: 'CPU' },
              { key: 'mem', label: '内存' },
              { key: 'disk', label: '磁盘' },
              { key: 'status', label: '状态' },
            ],
            rows: [
              { name: 'prod-web-01', ip: '192.168.1.10', role: 'Web', cpu: '23%', mem: '45%', disk: '42%', status: '🟢 正常' },
              { name: 'prod-web-02', ip: '192.168.1.11', role: 'Web', cpu: '28%', mem: '48%', disk: '41%', status: '🟢 正常' },
              { name: 'prod-api-01', ip: '192.168.1.12', role: 'API', cpu: '67%', mem: '72%', disk: '55%', status: '🟡 负载高' },
              { name: 'prod-api-02', ip: '192.168.1.13', role: 'API', cpu: '61%', mem: '69%', disk: '53%', status: '🟡 负载高' },
              { name: 'prod-db-01', ip: '192.168.1.20', role: 'MySQL', cpu: '12%', mem: '88%', disk: '76%', status: '🟡 内存紧张' },
              { name: 'prod-db-02', ip: '192.168.1.21', role: 'MySQL', cpu: '8%', mem: '82%', disk: '74%', status: '🟡 内存紧张' },
              { name: 'prod-worker-01', ip: '192.168.1.30', role: 'Worker', cpu: '91%', mem: '76%', disk: '48%', status: '🔴 CPU告警' },
              { name: 'prod-cache-01', ip: '192.168.1.40', role: 'Redis', cpu: '8%', mem: '34%', disk: '22%', status: '🟢 正常' },
              { name: 'prod-mq-01', ip: '192.168.1.50', role: 'RabbitMQ', cpu: '34%', mem: '56%', disk: '61%', status: '🟢 正常' },
              { name: 'prod-backup-02', ip: '192.168.1.99', role: 'Backup', cpu: '-', mem: '-', disk: '-', status: '⚫ 离线' },
            ],
          },
          highlight: 'prod-worker-01 CPU 91% 触发告警，prod-db-01 内存 88% 接近警戒线',
        },
        {
          title: '资源分布热力图',
          description: '按角色分组的资源使用分布',
          vizType: 'progress-group',
          data: {
            items: [
              { label: 'Web 层 (2节点) 平均CPU', value: 25, max: 100, status: '空闲' },
              { label: 'API 层 (2节点) 平均CPU', value: 64, max: 100, status: '较高' },
              { label: 'Worker 层 (3节点) 最高CPU', value: 91, max: 100, status: '⚠️ 告警' },
              { label: '数据层 MySQL 平均内存', value: 85, max: 100, status: '⚠️ 注意' },
            ],
          },
        },
      ],
      reasoning: [
        {
          id: 1,
          title: '节点健康度扫描',
          finding: '25 个节点中有 24 个在线（96% 可用性）。离线节点 prod-backup-02 是备份节点，不影响业务。2 个节点存在资源告警。',
          status: 'completed',
        },
        {
          id: 2,
          title: '异常节点分析 — prod-worker-01',
          finding: 'CPU 使用率 91%，持续超过 30 分钟。经查是该节点上的定时批处理任务（数据同步 job）正在全量执行，属于计划内的高负载场景。',
          status: 'warning',
        },
        {
          id: 3,
          title: '异常节点分析 — prod-db-01',
          finding: '内存使用 88%（14GB/16GB），MySQL innodb_buffer_pool_size 设置过大（10GB）。虽然当前未造成 OOM，但安全边际较低。',
          vizType: 'progress-group',
          vizData: {
            items: [
              { label: 'InnoDB Buffer Pool', value: 10, max: 16, status: '可优化' },
              { label: 'Connection Buffer', value: 2.4, max: 16, status: '正常' },
              { label: 'Query Cache', value: 0.5, max: 16, status: '正常' },
              { label: '系统/其他', value: 1.1, max: 16, status: '正常' },
            ],
          },
          status: 'warning',
        },
      ],
      conclusion: {
        summary: '集群整体健康度为 96%（24/25 在线）。主要关注点是 prod-worker-01 的 CPU 高负载（已知原因：批处理任务）和 prod-db-01 的内存使用偏高（建议调优参数）。其余节点运行正常。',
        findings: [
          { label: '在线率', value: '24/25 (96%)', type: 'good' },
          { label: 'CPU 告警节点', value: '1 (worker-01)', type: 'warn' },
          { label: '内存警告节点', value: '1 (db-01)', type: 'warn' },
          { label: '离线节点', value: '1 (备份, 无影响)', type: 'info' },
          { label: '整体评价', value: '基本健康', type: 'good' },
        ],
        recommendations: [
          { priority: 'low', action: '确认 prod-worker-01 批处理任务完成后 CPU 会恢复正常', reason: '这是计划内操作，无需干预' },
          { priority: 'medium', action: '评估将 prod-db-01 的 innodb_buffer_pool_size 从 10G 降至 7G', reason: '释放 3GB 内存，提升安全边际' },
          { priority: 'low', action: '排查 prod-backup-02 离线原因', reason: '虽不影响业务但应保持备份节点可用' },
        ],
        nextSteps: [
          '监控 worker-01 任务完成后 CPU 恢复情况',
          '评估 db-01 参数调优方案',
          '检查 backup-02 离线原因',
        ],
      },
    };
  }

  return null;
}
