import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  FileText,
  GitBranch,
  HardDrive,
  Network,
  Server,
  Shield,
  Zap,
  TrendingUp,
  RotateCcw,
  Star,
  Users,
  Bookmark,
  Tag,
  Archive,
  Lightbulb,
} from 'lucide-react';
import type {
  MonitoringModuleData,
  PredictionModuleData,
  DiagnosisModuleData,
  KnowledgeModuleData,
  AutomationModuleData,
} from '../types/moduleData';

function getStatusColor(status: string) {
  switch (status) {
    case 'normal':
    case 'healthy':
      return 'text-emerald-600';
    case 'warning':
      return 'text-amber-600';
    case 'critical':
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

function getStatusBg(status: string) {
  switch (status) {
    case 'normal':
    case 'healthy':
      return 'bg-emerald-100 text-emerald-700';
    case 'warning':
      return 'bg-amber-100 text-amber-700';
    case 'critical':
    case 'error':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function MiniChart({ data, color }: { data: Array<{ time: string; value: number }>; color: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((val.value - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor = color === 'emerald' ? '#10b981' : color === 'amber' ? '#f59e0b' : color === 'red' ? '#ef4444' : '#6366f1';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#grad-${color})`} />
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MonitoringModule({ data }: { data: MonitoringModuleData['data'] }) {
  const metrics = data?.metrics ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Activity size={16} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">实时监控面板</h3>
            <p className="text-xs text-gray-500">时间范围: {data?.timeRange ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-200">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-emerald-700">实时</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.length === 0 ? (
          <div className="col-span-2 rounded-xl border border-gray-200 p-6 bg-white text-center text-sm text-gray-500">暂无指标数据</div>
        ) : (
          metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-gray-200 p-3 bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">{metric.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBg(metric.status)}`}>
                  {metric.status === 'normal' ? '正常' : metric.status === 'warning' ? '警告' : '严重'}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-lg font-bold text-gray-900">{metric.current}</span>
                <span className="text-xs text-gray-500">{metric.unit}</span>
              </div>
              <MiniChart data={metric.history ?? []} color={metric.status === 'normal' ? 'emerald' : metric.status === 'warning' ? 'amber' : 'red'} />
            </div>
          ))
        )}
      </div>

      {data.topology && (
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-gray-700">服务拓扑</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.topology.nodes.map((node) => (
              <div key={node.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className={`w-2 h-2 rounded-full ${
                  node.status === 'healthy' ? 'bg-emerald-500' : node.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="text-xs font-medium text-gray-700">{node.name}</span>
                {node.latency !== undefined && (
                  <span className={`text-xs ${
                    node.latency > 1000 ? 'text-red-600 font-bold' : node.latency > 100 ? 'text-amber-600' : 'text-gray-500'
                  }`}>
                    {node.latency}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            <span className="text-xs font-semibold text-gray-700">活跃告警 ({data.alerts.length})</span>
          </div>
          {data.alerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-800 font-medium">{alert.message}</p>
                <p className="text-[11px] text-red-400 mt-0.5">{alert.timestamp}{alert.source ? ` · ${alert.source}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PredictionModule({ data }: { data: PredictionModuleData['data'] }) {
  const actualPoints = data.predictions.filter((p) => !p.isPredicted);
  const predictedPoints = data.predictions.filter((p) => p.isPredicted);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Brain size={16} className="text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{data.targetLabel}趋势预测</h3>
            <p className="text-xs text-gray-500">算法: {data.algorithm}</p>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
          AI 预测
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <p className="text-[11px] text-gray-500">当前值</p>
          <p className="text-lg font-bold text-gray-900">{data.current}<span className="text-xs font-normal text-gray-500 ml-1">{data.unit}</span></p>
        </div>
        <div className="rounded-lg bg-violet-50 p-3 text-center">
          <p className="text-[11px] text-violet-500">预测范围</p>
          <p className="text-sm font-bold text-violet-700">{data.predictionHorizon}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <p className="text-[11px] text-gray-500">数据点</p>
          <p className="text-lg font-bold text-gray-900">{data.predictions.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-700">趋势图表</span>
        </div>
        <div className="p-3">
          {actualPoints.length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] text-gray-500 mb-1">实际数据 ({actualPoints.length} 个点)</p>
              <div className="h-20">
                <MiniChart data={actualPoints.map((p) => ({ time: p.timestamp, value: p.value }))} color="violet" />
              </div>
            </div>
          )}
          {predictedPoints.length > 0 && (
            <div>
              <p className="text-[11px] text-violet-500 mb-1">预测数据 ({predictedPoints.length} 个点)</p>
              <div className="h-20">
                <MiniChart data={predictedPoints.map((p) => ({ time: p.timestamp, value: p.value }))} color="violet" />
              </div>
            </div>
          )}
        </div>
      </div>

      {data.risks && data.risks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">风险预警 ({data.risks.length})</span>
          </div>
          {data.risks.map((risk, i) => (
            <div key={i} className={`rounded-xl border p-3 ${
              risk.severity === 'critical' ? 'bg-red-50 border-red-200' :
              risk.severity === 'high' ? 'bg-orange-50 border-orange-200' :
              risk.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-800">{risk.type}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                  risk.severity === 'critical' ? 'bg-red-200 text-red-800' :
                  risk.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                  risk.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-blue-200 text-blue-800'
                }`}>
                  {(risk.probability * 100).toFixed(0)}% 概率
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-1">{risk.impact}</p>
              <p className="text-[11px] text-gray-500">建议: {risk.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DiagnosisModule({ data }: { data: DiagnosisModuleData['data'] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Shield size={16} className="text-rose-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">故障诊断报告</h3>
            <p className="text-xs text-gray-500">服务: {data.service}</p>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
          置信度 {(data.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-rose-600" />
          <span className="text-xs font-semibold text-rose-800">症状</span>
        </div>
        <p className="text-sm text-rose-700 font-medium">{data.symptom}</p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={14} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-800">根因分析</span>
        </div>
        <p className="text-sm text-emerald-700 font-medium">{data.rootCause}</p>
      </div>

      {data.evidence && data.evidence.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-gray-700">证据 ({data.evidence.length})</span>
          </div>
          {data.evidence.map((ev, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3 bg-white">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                  ev.type === 'metric' ? 'bg-blue-100 text-blue-700' :
                  ev.type === 'log' ? 'bg-orange-100 text-orange-700' :
                  ev.type === 'trace' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {ev.type.toUpperCase()}
                </span>
                <span className="text-[11px] text-gray-500">相关度 {(ev.relevance * 100).toFixed(0)}%</span>
              </div>
              <p className="text-xs text-gray-600 font-mono mt-1">{ev.content}</p>
              {ev.timestamp && <p className="text-[11px] text-gray-400 mt-1">{ev.timestamp} · {ev.source}</p>}
            </div>
          ))}
        </div>
      )}

      {data.suggestedActions && data.suggestedActions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">建议操作 ({data.suggestedActions.length})</span>
          </div>
          {data.suggestedActions.map((action, i) => (
            <div key={i} className={`rounded-xl border p-3 ${getPriorityColor(action.priority)} bg-white`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-800">{action.action}</span>
                  {action.automated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">可自动执行</span>
                  )}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                  action.priority === 'critical' ? 'bg-red-100 text-red-700' :
                  action.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {(action.confidence * 100).toFixed(0)}% 置信
                </span>
              </div>
              <p className="text-xs text-gray-600">{action.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgeModule({ data }: { data: KnowledgeModuleData['data'] }) {
  const incidentSources = data.sources?.filter(s => s.type === 'incident_record') || [];
  const practiceSources = data.sources?.filter(s => s.type === 'best_practice') || [];
  const otherSources = data.sources?.filter(s => s.type !== 'incident_record' && s.type !== 'best_practice') || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Archive size={16} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">知识库检索结果</h3>
            <p className="text-xs text-gray-500">查询: {data.query.slice(0, 30)}...</p>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
          匹配度 {(data.confidence * 100).toFixed(0)}%
        </span>
      </div>

      {incidentSources.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Archive size={14} className="text-rose-500" />
            <span className="text-xs font-semibold text-gray-700">故障案例</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">{incidentSources.length}</span>
          </div>
          {incidentSources.map((source, i) => (
            <div key={`inc-${i}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800">{source.title}</span>
                <div className="flex items-center gap-2">
                  {source.successRate && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-600">
                      <Star size={10} fill="currentColor" />
                      {source.successRate}%
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                    {(source.similarity * 100).toFixed(0)}% 相似
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-600 whitespace-pre-line">{source.content}</p>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                  {source.contributor && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Users size={10} />
                      {source.contributor}
                    </span>
                  )}
                  {source.appliedCount !== undefined && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Bookmark size={10} />
                      应用 {source.appliedCount} 次
                    </span>
                  )}
                  {source.lastVerifiedAt && (
                    <span className="text-[11px] text-gray-400">验证于 {source.lastVerifiedAt}</span>
                  )}
                </div>
                {source.tags && source.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {source.tags.map((tag, ti) => (
                      <span key={ti} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        <Tag size={8} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {practiceSources.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">最佳实践</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">{practiceSources.length}</span>
          </div>
          {practiceSources.map((source, i) => (
            <div key={`bp-${i}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">{source.title}</span>
                <div className="flex items-center gap-2">
                  {source.appliedCount !== undefined && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      应用 {source.appliedCount} 次
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                    {(source.similarity * 100).toFixed(0)}% 相似
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-600 whitespace-pre-line">{source.content}</p>
                {source.contributor && (
                  <div className="flex items-center gap-1 mt-2 text-[11px] text-gray-500">
                    <Users size={10} />
                    {source.contributor}
                  </div>
                )}
                {source.tags && source.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {source.tags.map((tag, ti) => (
                      <span key={ti} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        <Tag size={8} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {otherSources.length > 0 && (
        <div className="space-y-3">
          {otherSources.map((source, i) => (
            <div key={`other-${i}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-800">{source.title}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                  {(source.similarity * 100).toFixed(0)}% 相似
                </span>
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-600 whitespace-pre-line">{source.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.relatedQuestions && data.relatedQuestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-700">相关问题</span>
          </div>
          {data.relatedQuestions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-600">{q}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AutomationModule({ data }: { data: AutomationModuleData['data'] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Zap size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{data.operationLabel}</h3>
            <p className="text-xs text-gray-500">目标: {data.target}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          data.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
          data.status === 'running' ? 'bg-blue-100 text-blue-700' :
          data.status === 'failed' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {data.status === 'success' ? '执行成功' :
           data.status === 'running' ? '执行中' :
           data.status === 'failed' ? '执行失败' :
           data.status === 'rolled_back' ? '已回滚' : '等待中'}
        </span>
      </div>

      {data.result && (
        <div className={`rounded-xl border p-3 ${
          data.status === 'success' ? 'bg-emerald-50 border-emerald-200' :
          data.status === 'failed' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <p className="text-xs font-medium text-gray-800">{data.result}</p>
        </div>
      )}

      {data.logs && data.logs.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-700">执行日志 ({data.logs.length})</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-900 p-3 max-h-48 overflow-y-auto">
            {data.logs.map((log, i) => (
              <div key={i} className="font-mono text-xs flex gap-2">
                <span className="text-gray-500 shrink-0">{log.timestamp}</span>
                <span className={`shrink-0 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warning' ? 'text-yellow-400' :
                  'text-emerald-400'
                }`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.duration && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>执行时长: {data.duration}s</span>
          {data.rollbackAvailable && (
            <span className="text-amber-600 font-medium">支持回滚</span>
          )}
        </div>
      )}
    </div>
  );
}
