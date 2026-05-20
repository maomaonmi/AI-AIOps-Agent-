import { useState } from 'react';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Target,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Activity,
  BarChart3,
} from 'lucide-react';
import {
  LiveLineChart,
  AnomalyDetectionChart,
  CapacityPlanningChart,
  AutoRefreshContainer,
  PredictionScoreCard,
  PredictionTimeline,
  RealTimeDataGenerators,
} from './RealTimeCharts';
import { useAppStore } from '../store';

export type PredictionPhase = 'model-input' | 'prediction-output' | 'risk-assessment' | 'action-plan';

interface ModelInputData {
  phase: PredictionPhase;
  dataSource: string[];
  timeRange: string;
  modelType: string;
  parameters: Array<{ key: string; value: string }>;
}

interface PredictionOutputData {
  title: string;
  description?: string;
  chartType: 'line-prediction' | 'anomaly' | 'capacity' | 'score-cards';
  data: Record<string, unknown>;
  keyFinding?: string;
}

interface RiskItem {
  resource: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  currentVal: number;
  predictedVal: number;
  threshold: number;
  timeToThreshold: string;
  confidence: number;
}

interface ActionPlanData {
  summary: string;
  risks: RiskItem[];
  actions: Array<{ priority: 'immediate' | 'short' | 'long'; action: string; impact: string; effort: string }>;
  nextPredictions: Array<{ time: string; event: string; probability: number }>;
}

export interface PredictionResponse {
  modelInput: ModelInputData;
  predictions: PredictionOutputData[];
  riskAssessment: ActionPlanData;
  suggestions?: Array<{ icon: string; label: string; query: string; type: 'deep-dive' | 'action' | 'compare' }>;
}

// ==================== Phase 1: 模型输入 ====================
function ModelInputSection({ data }: { data: ModelInputData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-sky-50/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/50 transition-colors text-left"
      >
        <div className="p-1.5 bg-blue-500 rounded-lg shrink-0">
          <Brain size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blue-900">预测模型输入</h3>
          <p className="text-xs text-blue-600/70 mt-0.5">{data.modelType}</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Phase 1</span>
        {expanded ? <ChevronDown size={15} className="text-blue-400 shrink-0" /> : <ChevronRight size={15} className="text-blue-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-blue-100/60 pt-3">
          
          {/* Data Sources */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={12} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-800">数据源</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.dataSource.map((src, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-md text-[11px] font-medium text-blue-700 border border-blue-150 shadow-sm">
                  <CheckCircle2 size={10} className="text-emerald-500" />
                  {src}
                </span>
              ))}
            </div>
          </div>

          {/* Time Range & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-lg p-2.5 border border-blue-100/50">
              <p className="text-[10px] text-gray-500 mb-0.5">时间范围</p>
              <p className="text-[13px] font-semibold text-blue-900">{data.timeRange}</p>
            </div>
            <div className="bg-white/70 rounded-lg p-2.5 border border-blue-100/50">
              <p className="text-[10px] text-gray-500 mb-0.5">预测模型</p>
              <p className="text-[13px] font-semibold text-blue-900">{data.modelType}</p>
            </div>
          </div>

          {/* Parameters */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={12} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-800">模型参数</span>
            </div>
            <div className="bg-white/70 rounded-lg p-2.5 border border-blue-100/50">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {data.parameters.map((param, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-500">{param.key}</span>
                    <span className="text-[11px] font-mono font-medium text-blue-800">{param.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Phase 2: 预测输出（含实时图表）====================
function LivePredictionCard({ data }: { data: PredictionOutputData }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
      
      <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TrendingUp size={13} className="text-indigo-500" />
            <h4 className="text-[13px] font-semibold text-gray-800">{data.title}</h4>
          </div>
          {data.description && (
            <p className="text-[11px] text-gray-400 leading-snug line-clamp-1">{data.description}</p>
          )}
        </div>
        <button onClick={() => setShowDetail(!showDetail)} className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400">
          {showDetail ? <ChevronDown size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      <div className="p-3">
        
        {data.chartType === 'line-prediction' && (
          <>
            <LiveLineChart
              data={(data.data.series as Array<{ time: string; value: number | null; predicted?: number; upper?: number; lower?: number }> || [])}
              color={(data.data.color as string) || '#6366f1'}
              showPrediction={true}
              unit={(data.data.unit as string) || '%'}
              currentValue={(data.data.currentValue as number)}
            />
            {(data.data.showTable as boolean) && (
              <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-[11px]">
                  <thead><tr className="bg-gray-50"><th className="py-1.5 px-2.5 text-left text-gray-500 font-medium">时间</th><th className="py-1.5 px-2.5 text-right text-gray-500 font-medium">实际值</th><th className="py-1.5 px-2.5 text-right text-gray-500 font-medium">预测值</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {((data.data.series as Array<{ label?: string; time: string; value: number | null; predicted?: number }>) || [])
                      .filter(s => s.value !== null).slice(-6)
                      .map((s, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="py-1 px-2.5 text-gray-600">{s.label || s.time}</td>
                          <td className="py-1 px-2.5 text-right font-mono font-medium text-gray-800">{s.value}</td>
                          <td className="py-1 px-2.5 text-right font-mono text-indigo-500">-</td>
                        </tr>
                      ))
                    }
                    {((data.data.series as Array<{ time: string; predicted?: number }>) || [])
                      .filter(s => s.predicted !== undefined)
                      .slice(-4)
                      .map((s, i) => (
                        <tr key={`pred-${i}`} className="hover:bg-gray-50/50 bg-indigo-50/30">
                          <td className="py-1 px-2.5 text-gray-400">{s.time}</td>
                          <td className="py-1 px-2.5 text-right text-gray-300">—</td>
                          <td className="py-1 px-2.5 text-right font-mono font-bold text-indigo-600">{s.predicted}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {data.chartType === 'anomaly' && (
          <AnomalyDetectionChart data={(data.data.anomalyData as Parameters<typeof AnomalyDetectionChart>[0]['data']) || RealTimeDataGenerators.anomaly()} />
        )}

        {data.chartType === 'capacity' && (
          <CapacityPlanningChart data={(data.data.capacityData as Parameters<typeof CapacityPlanningChart>[0]['data']) || RealTimeDataGenerators.capacity()} />
        )}

        {data.chartType === 'score-cards' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {((data.data.scores as Array<{ score: number; confidence: number; label: string; description: string; trend: 'up' | 'down' | 'stable' }>) || []).map((s, i) => (
              <PredictionScoreCard key={i} {...s} />
            ))}
          </div>
        )}

        {showDetail && data.keyFinding && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div className="flex gap-2 p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100/50">
              <Lightbulb size={13} className="text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-indigo-800 leading-relaxed">{data.keyFinding}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PredictionsSection({ predictions, phaseLabel }: { predictions: PredictionOutputData[]; phaseLabel?: string }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="my-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors text-left"
      >
        <div className="p-1.5 bg-indigo-500 rounded-lg shrink-0">
          <TrendingUp size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-indigo-900">预测结果</h3>
          <p className="text-xs text-indigo-600/70 mt-0.5">已生成 {predictions.length} 组预测</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{phaseLabel || 'Phase 2'}</span>
        {expanded ? <ChevronDown size={15} className="text-indigo-400 shrink-0" /> : <ChevronRight size={15} className="text-indigo-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-100/60 pt-3">
          {predictions.map((pred, i) => (
            <LivePredictionCard key={i} data={pred} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Phase 3: 风险评估与行动方案 ====================
function RiskBar({ risk }: { risk: RiskItem }) {
  const levelConfig = {
    low: { color: 'emerald', label: '低风险', barColor: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
    medium: { color: 'amber', label: '中风险', barColor: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
    high: { color: 'orange', label: '高风险', barColor: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50' },
    critical: { color: 'red', label: '严重', barColor: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' },
  };
  const cfg = levelConfig[risk.riskLevel];
  const progressPct = Math.min((risk.predictedVal / risk.threshold) * 100, 100);

  return (
    <div className={`rounded-xl p-3 ${cfg.bgColor} border border-${cfg.color}-200`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-gray-800">{risk.resource}</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bgColor.replace('bg-', 'bg-').replace('/50','')} ${cfg.textColor} border`}>
            {cfg.label}
          </span>
        </div>
        <span className="text-[10px] text-gray-500">置信度 {risk.confidence}%</span>
      </div>
      
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[11px] text-gray-500 w-16 shrink-0">当前</span>
        <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${cfg.barColor}`} style={{ width: `${(risk.currentVal / risk.threshold) * 100}%` }} />
        </div>
        <span className="text-[11px] font-bold tabular-nums w-10 text-right text-gray-700">{risk.currentVal}%</span>
      </div>
      
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-indigo-500 font-medium w-16 shrink-0">预测 →</span>
        <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden relative">
          <div className={`h-full rounded-full ${cfg.barColor} animate-pulse`} style={{ width: `${progressPct}%` }} />
          <div className="absolute top-0 bottom-0 left-0 right-0 flex items-center justify-end pr-1">
            <span className={`text-[9px] font-bold ${cfg.textColor}`}>{risk.threshold}%</span>
          </div>
        </div>
        <span className="text-[11px] font-bold tabular-nums w-10 text-right text-indigo-600">{risk.predictedVal}%</span>
      </div>
      
      <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
        <Clock size={9} />
        预计 {risk.timeToThreshold} 后达到阈值
      </p>
    </div>
  );
}

function RiskAssessmentSection({ data }: { data: ActionPlanData }) {
  const [expanded, setExpanded] = useState(true);
  const { setActiveModuleType } = useAppStore();
  
  const handleActionClick = (query: string) => {
    setActiveModuleType('prediction');
    
    const input = document.querySelector<HTMLTextAreaElement>('textarea');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  };

  const priorityConfig = {
    immediate: { badge: 'bg-red-100 text-red-700 border border-red-200', icon: '🔴', label: '立即执行' },
    short: { badge: 'bg-amber-100 text-amber-700 border border-amber-200', icon: '🟡', label: '短期计划' },
    long: { badge: 'bg-blue-100 text-blue-700 border border-blue-200', icon: '🔵', label: '长期规划' },
  };

  return (
    <div className="my-3 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/60 to-orange-50/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors text-left"
      >
        <div className="p-1.5 bg-rose-500 rounded-lg shrink-0">
          <AlertTriangle size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-rose-900">风险评估与行动方案</h3>
          <p className="text-xs text-rose-600/70 mt-0.5 truncate">{data.summary.slice(0, 50)}...</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Phase 3</span>
        {expanded ? <ChevronDown size={15} className="text-rose-400 shrink-0" /> : <ChevronRight size={15} className="text-rose-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3.5 border-t border-rose-100/60 pt-3">
          
          {/* Summary */}
          <div className="bg-white/70 rounded-xl p-3.5 border border-rose-100/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Target size={13} className="text-rose-600" />
              <span className="text-xs font-bold text-rose-800">AI 综合评估</span>
            </div>
            <p className="text-[13px] text-gray-800 leading-relaxed">{data.summary}</p>
          </div>

          {/* Risk Bars */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-xs font-bold text-gray-700">资源风险评估</span>
            </div>
            <div className="space-y-2">
              {data.risks.map((risk, i) => (
                <RiskBar key={i} risk={risk} />
              ))}
            </div>
          </div>

          {/* Action Plan */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={12} className="text-indigo-500" />
              <span className="text-xs font-bold text-gray-700">建议行动</span>
            </div>
            <div className="space-y-2">
              {data.actions.map((action, i) => {
                const pcfg = priorityConfig[action.priority];
                return (
                  <button
                    key={i}
                    onClick={() => handleActionClick(action.action)}
                    className="w-full flex gap-3 p-3 bg-white rounded-xl border border-gray-100 group hover:border-indigo-200 hover:shadow-sm transition-all text-left"
                  >
                    <div className="shrink-0 mt-0.5 w-6 text-center">
                      <ArrowRight size={14} className="text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all mx-auto" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[12px] font-semibold text-gray-800">{action.action}</p>
                        <span className={`text-[9px] font-medium px-1.5 py-px rounded-full ${pcfg.badge}`}>{pcfg.icon} {pcfg.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        <span>影响: {action.impact}</span>
                        <span>·</span>
                        <span>工作量: {action.effort}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Future Predictions Timeline */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={12} className="text-violet-500" />
              <span className="text-xs font-bold text-gray-700">未来预测时间线</span>
            </div>
            <PredictionTimeline events={
              data.nextPredictions.map(p => ({
                time: p.time,
                event: p.event,
                type: (p.probability > 85 ? 'warning' : 'predicted') as 'predicted' | 'warning',
                probability: p.probability,
              }))
            } />
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Phase 4: 建议与灵感 ====================
function SuggestionsSection({ suggestions }: { suggestions: Array<{ icon: string; label: string; query: string; type: 'deep-dive' | 'action' | 'compare' }> }) {
  const { setActiveModuleType } = useAppStore();

  const handleSuggestionClick = (query: string) => {
    setActiveModuleType('prediction');
    
    const input = document.querySelector<HTMLTextAreaElement>('textarea');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  };

  const typeConfig = {
    'deep-dive': { color: 'violet', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: '深入分析' },
    'action': { color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: '执行操作' },
    'compare': { color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: '对比分析' },
  };

  return (
    <div className="my-3 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Lightbulb size={14} className="text-amber-500" />
        <span className="text-sm font-semibold text-gray-800">继续探索</span>
        <span className="text-[10px] text-gray-400">选择以下方向深入了解</span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {suggestions.map((s, i) => {
          const cfg = typeConfig[s.type];
          return (
            <button
              key={i}
              onClick={() => handleSuggestionClick(s.query)}
              className={`flex items-center gap-2.5 p-3 rounded-xl ${cfg.bg} ${cfg.border} border hover:shadow-md transition-all text-left group`}
            >
              <span className={`text-lg`}>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold ${cfg.text}`}>{s.label}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.border} border ${cfg.text} opacity-70 inline-block mt-1`}>
                  {cfg.badge}
                </span>
              </div>
              <ArrowRight size={12} className={`text-gray-400 group-hover:${cfg.text} group-hover:translate-x-0.5 transition-all shrink-0`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Main Renderer ====================
export function ModularPredictionRenderer({ response }: { response: PredictionResponse }) {
  return (
    <div className="space-y-1">
      <ModelInputSection data={response.modelInput} />
      <PredictionsSection predictions={response.predictions.slice(0, 2)} />
      <RiskAssessmentSection data={response.riskAssessment} />
      {response.suggestions && response.suggestions.length > 0 && (
        <SuggestionsSection suggestions={response.suggestions} />
      )}
    </div>
  );
}

// ==================== Auto Generator ====================
export function generatePredictionResponse(content: string): PredictionResponse | null {
  
  if (/CPU.*预测|预测.*CPU|CPU.*趋势/i.test(content)) {
    const cpuSeries = RealTimeDataGenerators.timeSeries(30, 42, 8, 0.5);
    
    return {
      modelInput: {
        phase: 'model-input',
        dataSource: ['Prometheus node_cpu_seconds_total', 'node_cpu_usage_percentage'],
        timeRange: '过去 7 天历史数据 + 实时流',
        modelType: 'LSTM 时序预测 + Prophet 趋势分解',
        parameters: [
          { key: '序列长度', value: '168h' },
          { key: '预测窗口', value: '24h' },
          { key: '置信区间', value: '95%' },
          { key: '学习率', value: '0.001' },
          { key: '隐藏层', value: '128 units × 2' },
        ],
      },
      predictions: [
        {
          title: 'CPU 使用率 — LSTM 预测',
          description: '基于过去7天训练的时序模型，预测未来趋势',
          chartType: 'line-prediction',
          data: {
            series: cpuSeries,
            unit: '%',
            color: '#6366f1',
            currentValue: cpuSeries.filter(d => d.value !== null).slice(-1)[0]?.value,
            showTable: true,
          },
          keyFinding: '预测显示 CPU 在今天下午 14:00-16:00 将达到峰值 ~72%，主要受业务高峰影响。整体趋势平稳，无异常突增信号。',
        },
        {
          title: '各节点 CPU 预测对比',
          description: '集群内各节点的独立预测结果',
          chartType: 'score-cards',
          data: {
            scores: [
              { score: 28, confidence: 92, label: 'prod-web-01', description: 'Web层节点', trend: 'stable' },
              { score: 45, confidence: 88, label: 'prod-api-01', description: 'API服务节点', trend: 'up' },
              { score: 72, confidence: 81, label: 'prod-worker-01', description: '计算工作节点', trend: 'up' },
              { score: 18, confidence: 95, label: 'prod-cache-01', description: '缓存节点', trend: 'down' },
            ],
          },
        },
      ],
      riskAssessment: {
        summary: 'CPU 整体风险较低。当前平均使用率 42%，预测峰值 72%（未超 85% 告警线）。唯一关注点是 prod-worker-01 的批处理任务可能导致短暂高峰，但属于计划内操作。',
        risks: [
          { resource: '集群平均 CPU', riskLevel: 'low', currentVal: 42, predictedVal: 58, threshold: 85, timeToThreshold: '>24小时', confidence: 91 },
          { resource: 'prod-worker-01', riskLevel: 'medium', currentVal: 68, predictedVal: 82, threshold: 90, timeToThreshold: '~6小时', confidence: 78 },
          { resource: 'prod-api-01', riskLevel: 'low', currentVal: 52, predictedVal: 65, threshold: 85, timeToThreshold: '>20小时', confidence: 88 },
        ],
        actions: [
          { priority: 'short', action: '将 prod-worker-01 批处理任务调整到凌晨低峰期执行', impact: '降低峰值 15-20%', effort: '配置修改' },
          { priority: 'long', action: '考虑在业务高峰前增加 API 节点水平扩容', impact: '分散流量压力', effort: 'K8s HPA 配置' },
        ],
        nextPredictions: [
          { time: '+2小时', event: 'CPU 将逐步上升至 ~55%', probability: 89 },
          { time: '+6小时', event: '下午高峰开始，预计达到 ~68%', probability: 82 },
          { time: '+14小时', event: '晚间回落至 ~35% 以下', probability: 91 },
          { time: '+24小时', event: '明日同期预计相似模式', probability: 76 },
        ],
      },
      suggestions: [
        { icon: '📊', label: '深入分析 CPU 热点进程', query: '分析当前CPU消耗最高的进程和原因', type: 'deep-dive' },
        { icon: '⚡', label: '设置自动扩容策略', query: '基于CPU预测配置K8s HPA自动扩容规则', type: 'action' },
        { icon: '🔄', label: '对比上周同期数据', query: '对比本周与上周同期的CPU使用趋势差异', type: 'compare' },
        { icon: '🔍', label: '预测异常场景影响', query: '如果流量突增50%对CPU的影响预测', type: 'deep-dive' },
      ],
    };
  }

  if (/内存.*预测|预测.*内存|memory.*forecast/i.test(content)) {
    const memSeries = RealTimeDataGenerators.timeSeries(30, 65, 5, 0.8);
    
    return {
      modelInput: {
        phase: 'model-input',
        dataSource: ['Prometheus node_memory_MemAvailable_bytes', 'process_resident_memory_bytes'],
        timeRange: '过去 14 天历史数据',
        modelType: 'Prophet 季节性分解 + ARIMA 残差修正',
        parameters: [
          { key: '季节周期', value: 'daily + weekly' },
          { key: '预测窗口', value: '48h' },
          { key: '置信区间', value: '90%' },
          { key: 'Changepoint灵敏度', value: '0.05' },
        ],
      },
      predictions: [
        {
          title: '内存使用率 — Prophet 预测',
          description: '含日周期性和周周期性分解的趋势预测',
          chartType: 'line-prediction',
          data: {
            series: memSeries,
            unit: '%',
            color: '#8b5cf6',
            currentValue: memSeries.filter(d => d.value !== null).slice(-1)[0]?.value,
          },
          keyFinding: '⚠️ 内存呈持续上升趋势！预测将在约 6 小时后达到 85% 告警阈值。主要增长源：MySQL buffer pool 配置过大 + 应用 JVM heap 缓存累积。',
        },
        {
          title: '容量耗尽预测',
          description: '按当前增长率推算的容量耗尽时间点',
          chartType: 'capacity',
          data: {},
        },
      ],
      riskAssessment: {
        summary: '内存是当前系统最大的风险点！当前使用率 65%，以每小时 +1.5% 的速度增长。若不干预，预计 6 小时后触发告警，14 小时后可能 OOM。',
        risks: [
          { resource: '集群总内存', riskLevel: 'high', currentVal: 65, predictedVal: 85, threshold: 85, timeToThreshold: '~6小时', confidence: 84 },
          { resource: 'prod-db-01 MySQL', riskLevel: 'critical', currentVal: 88, predictedVal: 95, threshold: 95, timeToThreshold: '~3小时', confidence: 79 },
          { resource: 'prod-api-01 JVM', riskLevel: 'medium', currentVal: 72, predictedVal: 83, threshold: 90, timeToThreshold: '~8小时', confidence: 81 },
        ],
        actions: [
          { priority: 'immediate', action: '调整 prod-db-01 innodb_buffer_pool_size 从 10G 降至 6G 并重启', impact: '立即释放 4GB，推迟告警 8+ 小时', effort: '参数修改+重启' },
          { priority: 'immediate', action: '对 API 服务执行 GC 优化或重启回收碎片内存', impact: '临时降低 5-10% 内存占用', effort: '运维操作' },
          { priority: 'short', action: '增加物理内存或新增节点分摊负载', impact: '根本性解决方案', effort: '硬件采购/部署' },
        ],
        nextPredictions: [
          { time: '+3小时', event: 'prod-db-01 可能触发内存告警 (95%)', probability: 79 },
          { time: '+6小时', event: '集群平均内存达到 85% 告警线', probability: 84 },
          { time: '+14小时', event: '部分节点可能出现 OOM 风险', probability: 67 },
          { time: '+24小时', event: '若无干预，系统可能不稳定', probability: 71 },
        ],
      },
      suggestions: [
        { icon: '🧠', label: '分析 JVM 内存泄漏', query: '分析Java应用JVM堆内存使用情况和GC日志', type: 'deep-dive' },
        { icon: '🗄️', label: '优化 MySQL 配置', query: '优化MySQL innodb_buffer_pool和其他内存参数', type: 'action' },
        { icon: '📈', label: '对比各节点内存分布', query: '对比集群内各节点的内存使用分布和趋势', type: 'compare' },
        { icon: '🚨', label: '制定 OOM 应急预案', query: '制定内存耗尽时的应急处理和恢复方案', type: 'action' },
      ],
    };
  }

  if (/磁盘.*预测|预测.*磁盘|disk.*forecast|容量规划/i.test(content)) {
    return {
      modelInput: {
        phase: 'model-input',
        dataSource: ['Prometheus node_filesystem_avail_bytes', 'df -h 系统命令'],
        timeRange: '过去 30 天历史数据',
        modelType: '线性回归 + 日均增量分析',
        parameters: [
          { key: '日均增量', value: '~15 GB/day' },
          { key: '预测窗口', value: '14 天' },
          { key: '告警阈值', value: '90%' },
          { key: '满载阈值', value: '98%' },
        ],
      },
      predictions: [
        {
          title: '磁盘空间 — 14天预测',
          description: '/data 分区使用趋势及容量预警',
          chartType: 'capacity',
          data: {},
        },
        {
          title: '各分区预测概览',
          description: '所有挂载点的空间预测',
          chartType: 'score-cards',
          data: {
            scores: [
              { score: 76, confidence: 94, label: '/data 分区', description: '应用日志存储', trend: 'up' },
              { score: 45, confidence: 91, label: '/var/log', description: '系统日志', trend: 'up' },
              { score: 22, confidence: 97, label: '/', description: '根分区', trend: 'stable' },
              { score: 38, confidence: 92, label: '/home', description: '用户目录', trend: 'stable' },
            ],
          },
        },
      ],
      riskAssessment: {
        summary: '磁盘空间是中长期风险。/data 分区当前使用 76%（780GB/1TB），按日均 15GB 增长，预计 3 天后达 90% 告警线，约 16 天后接近满载。需立即启动清理策略。',
        risks: [
          { resource: '/data 分区', riskLevel: 'high', currentVal: 76, predictedVal: 90, threshold: 90, timeToThreshold: '~3天', confidence: 94 },
          { resource: '/var/log', riskLevel: 'medium', currentVal: 45, predictedVal: 75, threshold: 85, timeToThreshold: '~8天', confidence: 87 },
        ],
        actions: [
          { priority: 'immediate', action: '立即执行 logrotate 清理 Nginx 访问日志（保留 3 天）', impact: '预计释放 180GB+', effort: '脚本执行' },
          { priority: 'immediate', action: '清理应用运行日志（保留 7 天）', impact: '预计释放 80GB+', effort: '脚本执行' },
          { priority: 'short', action: '配置自动日志轮转策略并设置磁盘使用率 >70% 告警', impact: '防止再次发生', effort: 'logrotate + alertmanager' },
          { priority: 'long', action: '迁移日志存储至对象存储或 ELK 集群', impact: '根本解决本地磁盘膨胀', effort: '架构改造' },
        ],
        nextPredictions: [
          { time: '+3天', event: '/data 达到 90% 告警线', probability: 94 },
          { time: '+7天', event: '预计使用率达到 96%', probability: 88 },
          { time: '+14天', event: '可能触发写入阻塞', probability: 73 },
          { time: '+16天', event: '预测接近满载 (98%)', probability: 69 },
        ],
      },
      suggestions: [
        { icon: '📁', label: '分析大文件占用', query: '分析/data分区下占用空间最大的目录和文件', type: 'deep-dive' },
        { icon: '🗑️', label: '配置自动清理策略', query: '配置logrotate和定时清理脚本自动释放磁盘空间', type: 'action' },
        { icon: '☁️', label: '迁移至对象存储方案', query: '评估将日志迁移到OSS/S3对象存储的方案和成本', type: 'compare' },
        { icon: '📊', label: '预测不同清理效果', query: '模拟执行不同清理策略后的磁盘使用率变化', type: 'deep-dive' },
      ],
    };
  }

  if (/异常.*预警|提前.*预警|anomaly.*detect|潜在.*问题/i.test(content)) {
    const anomalyData = RealTimeDataGenerators.anomaly();
    
    return {
      modelInput: {
        phase: 'model-input',
        dataSource: ['Prometheus 全部指标', '自定义规则引擎', '统计基线'],
        timeRange: '实时流 + 过去 24h 基线',
        modelType: 'Isolation Forest 异常检测 + Z-Score 统计',
        parameters: [
          { key: '检测算法', value: 'Isolation Forest' },
          { key: '异常阈值', value: 'Z > 2.5 或 Z < -2.5' },
          { key: '提前预警窗口', value: '30 分钟' },
          { key: '误报率目标', value: '< 5%' },
        ],
      },
      predictions: [
        {
          title: '实时异常检测面板',
          description: '基于 Isolation Forest 的实时异常监控',
          chartType: 'anomaly',
          data: { anomalyData },
          keyFinding: '检测到 2 个异常点和 2 个偏离点。最近一次异常发生在 1.5 分钟前，涉及订单服务的响应时间突增。建议立即关注。',
        },
      ],
      riskAssessment: {
        summary: '异常检测系统发现当前存在 2 个活跃异常和 2 个偏离警告。最紧急的是订单服务响应时间异常升高（+1177%），其次是消息队列积压量异常。这些异常之间存在因果关联链。',
        risks: [
          { resource: '订单服务 P99延迟', riskLevel: 'critical', currentVal: 2300, predictedVal: 3500, threshold: 500, timeToThreshold: '已超标!', confidence: 96 },
          { resource: 'MQ积压量', riskLevel: 'high', currentVal: 15234, predictedVal: 25000, threshold: 10000, timeToThreshold: '已超标!', confidence: 89 },
          { resource: 'DB连接池等待', riskLevel: 'medium', currentVal: 850, predictedVal: 980, threshold: 1000, timeToThreshold: '~30分钟', confidence: 82 },
        ],
        actions: [
          { priority: 'immediate', action: '检查订单服务最近的 SQL 变更或部署', impact: '定位根因', effort: '排查' },
          { priority: 'immediate', action: '临时扩容消费者加速 MQ 消费', impact: '缓解积压', effort: 'K8s scale up' },
          { priority: 'short', action: '添加更多异常检测规则覆盖关键指标', impact: '提升覆盖面', effort: '规则配置' },
        ],
        nextPredictions: [
          { time: '现在', event: '订单服务 P99 延迟异常 (2300ms)', probability: 96 },
          { time: '+15分钟', event: 'MQ 积压可能翻倍 (→30000)', probability: 82 },
          { time: '+30分钟', event: '数据库连接池可能耗尽', probability: 78 },
          { time: '+1小时', event: '级联故障可能扩散到支付服务', probability: 65 },
        ],
      },
      suggestions: [
        { icon: '🔍', label: '追踪调用链路', query: '追踪订单服务的完整调用链路定位慢查询根因', type: 'deep-dive' },
        { icon: '🚨', label: '触发自动扩容', query: '立即对订单服务和消费者执行紧急扩容操作', type: 'action' },
        { icon: '📊', label: '对比历史异常模式', query: '对比历史上类似的异常事件和处理方式', type: 'compare' },
        { icon: '🛡️', label: '设置熔断降级策略', query: '为受影响的服务配置熔断和降级保护机制', type: 'action' },
      ],
    };
  }

  return null;
}
