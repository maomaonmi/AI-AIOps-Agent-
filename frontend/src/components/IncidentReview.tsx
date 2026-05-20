import React, { useState, useCallback, useRef } from 'react';
import { Search, AlertCircle, AlertTriangle, CheckCircle2, Clock, Target, Wrench, Shield, Users, DollarSign, Timer, Download, Eye, FileText, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import type { IncidentReport, ImprovementAction } from '../types/moduleData';

interface IncidentReviewProps {
  onExportPdf?: (elementId: string, filename: string) => void;
}

const TIMELINE_TYPE_CONFIG = {
  alert: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100', border: 'border-red-300', label: '告警' },
  acknowledged: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-300', label: '确认' },
  response: { icon: Users, color: 'text-blue-500', bg: 'bg-blue-100', border: 'border-blue-300', label: '响应' },
  diagnosis: { icon: Target, color: 'text-violet-500', bg: 'bg-violet-100', border: 'border-violet-300', label: '诊断' },
  fix: { icon: Wrench, color: 'text-emerald-500', bg: 'bg-emerald-100', border: 'border-emerald-300', label: '修复' },
  recovery: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100', border: 'border-green-300', label: '恢复' },
};

const PRIORITY_CONFIG = {
  urgent: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: '紧急' },
  short_term: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: '短期' },
  long_term: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: '长期' },
};

const SEVERITY_COLORS = {
  P0: 'bg-red-500 text-white',
  P1: 'bg-orange-500 text-white',
  P2: 'bg-yellow-500 text-gray-800',
  P3: 'bg-blue-400 text-white',
};

export default function IncidentReview({ onExportPdf }: IncidentReviewProps) {
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<string>('default');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    setReport(generateIncidentReportData(selectedIncident));
    setIsGenerating(false);
  }, [selectedIncident]);

  const handleExportPdf = useCallback(() => {
    if (reportRef.current && onExportPdf) {
      onExportPdf('incident-report-content', `故障复盘_${report?.incidentId || 'report'}`);
    }
  }, [onExportPdf, report]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
            <Search size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-gray-800">故障复盘</span>
        </div>

        <div className="flex items-center gap-3">
          <select value={selectedIncident} onChange={e => setSelectedIncident(e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-300 bg-white min-w-[180px]">
            <option value="default">#INC-20260428-001 order-service不可用</option>
            <option value="payment">#INC-20260415-002 payment-svc超时故障</option>
            <option value="db">#INC-20260403-003 DB主从切换异常</option>
            <option value="cache">#INC-20260328-004 缓存雪崩事件</option>
          </select>
          <button onClick={generateReport} disabled={isGenerating}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 transition-all flex items-center gap-1.5 disabled:opacity-50">
            {isGenerating ? <Sparkles size={12} className="animate-pulse" /> : <FileText size={12} />}
            {isGenerating ? '生成中...' : '生成复盘报告'}
          </button>
          {report && (
            <>
              <button onClick={handleExportPdf}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-1.5">
                <Download size={12} /> 导出PDF
              </button>
              <button
                className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex items-center gap-1.5">
                <Eye size={12} /> 预览
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4" id="incident-report-scroll">
        {isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-red-200" />
              <Search size={28} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 animate-spin" />
            </div>
            <p className="text-sm font-medium text-gray-600">正在生成复盘报告...</p>
            <p className="text-[11px] mt-1 text-gray-400">分析时间线 · 定位根因 · 生成改进建议</p>
          </div>
        )}

        {!isGenerating && !report && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center mb-4">
              <Search size={32} className="text-red-300" />
            </div>
            <p className="text-sm">选择故障事件，生成复盘报告</p>
            <p className="text-[11px] mt-1 max-w-[260px] text-center">自动分析故障时间线、根因和改进措施，AI 辅助生成复盘文档</p>
          </div>
        )}

        {report && !isGenerating && (
          <div ref={reportRef} id="incident-report-content" className="space-y-4 print:p-0">
            {/* Report Header */}
            <div className="rounded-xl border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${SEVERITY_COLORS[report.severity]}`}>{report.severity}</span>
                      <h3 className="text-sm font-bold text-gray-800">{report.title}</h3>
                    </div>
                    <p className="text-[11px] text-gray-500">{report.incidentId} · 影响范围: {report.impactScope}</p>
                  </div>
                  <div className="text-right text-[10px] text-gray-500 space-y-0.5">
                    <p>开始: {new Date(report.startTime).toLocaleString('zh-CN')}</p>
                    <p>结束: {new Date(report.endTime).toLocaleString('zh-CN')}</p>
                    <p className="font-semibold text-red-600">持续: {formatDuration(report.duration)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Impact Assessment */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-red-50 rounded-lg p-2.5 text-center">
                    <Timer size={13} className="mx-auto mb-1 text-red-500" />
                    <p className="text-xs font-bold text-red-700 tabular-nums">{formatDuration(report.impactAssessment.mttr)}</p>
                    <p className="text-[10px] text-red-500">MTTR</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2.5 text-center">
                    <Clock size={13} className="mx-auto mb-1 text-orange-500" />
                    <p className="text-xs font-bold text-orange-700 tabular-nums">{formatDuration(report.impactAssessment.mttd)}</p>
                    <p className="text-[10px] text-orange-500">MTTD</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                    <Users size={13} className="mx-auto mb-1 text-blue-500" />
                    <p className="text-xs font-bold text-blue-700 tabular-nums">{(report.impactAssessment.affectedUsers / 1000).toFixed(1)}K</p>
                    <p className="text-[10px] text-blue-500">受影响用户</p>
                  </div>
                  <div className={`${report.impactAssessment.slaBreach ? 'bg-red-50' : 'bg-green-50'} rounded-lg p-2.5 text-center`}>
                    <Shield size={13} className={`mx-auto mb-1 ${report.impactAssessment.slaBreach ? 'text-red-500' : 'text-green-500'}`} />
                    <p className={`text-xs font-bold ${report.impactAssessment.slaBreach ? 'text-red-700' : 'text-green-700'}`}>
                      {report.impactAssessment.slaBreach ? '违约' : '达标'}
                    </p>
                    <p className={`text-[10px] ${report.impactAssessment.slaBreach ? 'text-red-500' : 'text-green-500'}`}>SLA状态</p>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock size={11} /> 故障时间线
                  </p>
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-red-300 via-orange-300 to-green-300" />
                    {report.timeline.map((event, i) => {
                      const cfg = TIMELINE_TYPE_CONFIG[event.type];
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className="relative pb-4 last:pb-0">
                          <div className={`absolute -left-4 w-4 h-4 rounded-full ${cfg.bg} border-2 ${cfg.border} flex items-center justify-center`}>
                            <Icon size={8} className={cfg.color} />
                          </div>
                          <div className={`ml-2 px-3 py-2.5 rounded-lg border ${cfg.bg.replace('100', '50')} ${cfg.border.replace('300', '200')}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <code className="text-[11px] font-mono font-semibold text-gray-700">{event.time}</code>
                              <span className={`text-[9px] px-1.5 py-0 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                            </div>
                            <p className="text-[12px] font-medium text-gray-800">{event.title}</p>
                            <p className="text-[11px] text-gray-600 mt-0.5">{event.description}</p>
                            {event.operator && <p className="text-[10px] text-gray-400 mt-0.5">操作人: {event.operator}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Root Cause Analysis */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Target size={11} /> 根因分析
                  </p>
                  <div className="space-y-2">
                    {[
                      { level: '🔴 直接原因', content: report.rootCauseAnalysis.directCause, color: 'border-red-200 bg-red-50/40' },
                      { level: '🟡 间接原因', content: report.rootCauseAnalysis.indirectCause, color: 'border-amber-200 bg-amber-50/40' },
                      { level: '🟢 根本原因', content: report.rootCauseAnalysis.rootCause, color: 'border-emerald-200 bg-emerald-50/40' },
                    ].map((item, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${item.color}`}>
                        <p className="text-[11px] font-semibold text-gray-700 mb-1">{item.level}</p>
                        <p className="text-[12px] leading-relaxed text-gray-700">{item.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Improvement Actions */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Wrench size={11} /> 改进建议
                    <span className="normal-case text-violet-500 font-normal ml-auto text-[9px]">AI 生成</span>
                  </p>
                  <div className="space-y-2">
                    {report.improvementActions.map(action => {
                      const cfg = PRIORITY_CONFIG[action.priority];
                      return (
                        <div key={action.id} className={`rounded-lg border ${cfg.bg} ${cfg.border} overflow-hidden`}>
                          <button onClick={() => setExpandedActionId(expandedActionId === action.id ? null : action.id)}
                            className="w-full px-3 py-2.5 flex items-start gap-3 text-left">
                            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${action.priority === 'urgent' ? 'bg-red-100 text-red-600' : action.priority === 'short_term' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                              {action.priority === 'urgent' ? '急' : action.priority === 'short_term' ? '短' : '长'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-gray-800">{action.title}</span>
                                <span className={`text-[9px] px-1.5 py-0 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                              </div>
                              <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">{action.description}</p>
                            </div>
                            {expandedActionId === action.id ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                          </button>
                          {expandedActionId === action.id && (
                            <div className="px-3 pb-3 pt-0 ml-9 space-y-2">
                              <p className="text-[11px] text-gray-600 leading-relaxed">{action.description}</p>
                              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                {action.assignee && <span>负责人: {action.assignee}</span>}
                                {action.dueDate && <span>截止: {action.dueDate}</span>}
                                <span className={`ml-auto px-1.5 py-0.5 rounded ${
                                  action.status === 'done' ? 'bg-green-100 text-green-700' :
                                  action.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {action.status === 'done' ? '✅ 已完成' : action.status === 'in_progress' ? '🔄 进行中' : '⏳ 待处理'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tags */}
                {report.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {report.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">#{tag}</span>
                    ))}
                  </div>
                )}

                {/* Estimated Loss */}
                {report.impactAssessment.estimatedLoss && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-lg border border-red-100">
                    <DollarSign size={14} className="text-red-500" />
                    <span className="text-[12px] text-red-700">预估损失: <strong>${report.impactAssessment.estimatedLoss.toLocaleString()}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function generateIncidentReportData(type: string): IncidentReport {
  const incidents: Record<string, Partial<IncidentReport>> = {
    default: {
      incidentId: 'INC-20260428-001',
      severity: 'P0',
      service: 'order-service',
      impactScope: '订单模块 · 下单功能完全不可用',
      duration: 24,
      timeline: [
        { time: '14:23:15', type: 'alert', title: '告警触发', description: 'order-svc 错误率从 0.02% 突增至 45%，P99 延迟从 120ms 升至 8s。触发 P0 告警规则。' },
        { time: '14:24:30', type: 'acknowledged', title: '故障确认', description: '运维值班人员确认服务完全不可用，所有订单接口返回 503 错误。影响范围评估为全量下单用户。', operator: '张三（值班）' },
        { time: '14:26:00', type: 'response', title: '应急响应', description: '启动 P0 应急响应流程。拉取最新日志、检查 Pod 状态、查看数据库连接池指标。', operator: '李四（SRE）' },
        { time: '14:31:22', type: 'diagnosis', title: '根因定位', description: '通过链路追踪发现瓶颈在数据库层：连接池 max=100 已全部耗尽，大量请求排队等待。进一步排查发现新版本引入的慢查询未设置超时导致连接泄漏。', operator: '王五（DBA）' },
        { time: '14:35:00', type: 'fix', title: '修复执行', description: '① 紧急重启 order-svc 实例释放连接 ② 将连接池 max 从 100 调整到 300 ③ 为慢查询添加 5s 超时限制', operator: '李四（SRE）' },
        { time: '14:38:45', type: 'fix', title: '修复完成', description: '所有修复操作已执行完毕，服务实例已重启并恢复正常配置。', operator: '李四（SRE）' },
        { time: '14:47:00', type: 'recovery', title: '服务恢复', description: '所有监控指标恢复到正常水平：错误率 < 0.05%，P99 延迟 < 150ms，连接池使用率 < 30%。确认服务完全恢复。', operator: '张三（值班）' },
      ],
      rootCauseAnalysis: {
        directCause: '数据库连接池配置过小(max=100)，在高并发场景下连接全部被占用，新请求无法获取连接导致 503 错误。',
        indirectCause: '新版本 v2.4.0 引入的订单聚合查询未设置查询超时，当数据量增大时慢查询长时间占用连接不释放，最终耗尽连接池。',
        rootCause: '发布流程缺少性能基线验证环节。新版本上线前未进行压力测试和慢 SQL 扫描，导致性能问题在生产环境暴露后才被发现。',
      },
      improvementActions: [
        { id: 'ia1', priority: 'urgent', title: '紧急: 调整数据库连接池参数', description: '将 order-service 数据库连接池 max 从 100 提升到 300，设置 idle_timeout=30s，max_lifetime=30min。同时增加连接池监控告警（使用率>70%时触发）。', assignee: '王五(DBA)', dueDate: '2026-04-29', status: 'in_progress' },
        { id: 'ia2', priority: 'urgent', title: '紧急: 添加全局查询超时保护', description: '为 order-service 所有数据库查询添加 5s 超时限制。在 MyBatis/Hibernate 配置层添加 defaultStatementTimeout 参数，防止慢查询无限占用资源。', assignee: '赵六(开发)', dueDate: '2026-04-29', status: 'open' },
        { id: 'ia3', priority: 'short_term', title: '短期: CI 流程加入慢查询检测', description: '在 CI/CD 流水线中集成 SQL 性能扫描工具（如 SOAR），对每个 PR 的 SQL 变更进行审查。超过 1s 的查询必须经过 DBA review 后才能合并。', assignee: '钱七(CI)', dueDate: '2026-05-10', status: 'open' },
        { id: 'ia4', priority: 'long_term', title: '长期: 建立发布前性能基线测试', description: '建立标准化的发布前验证流程：金丝雀发布 → 10%流量压测 → 对比关键指标（QPS、延迟、错误率）→ 达标后逐步放量。未达标则自动回滚。', assignee: '孙八(SRE)', dueDate: '2026-06-01', status: 'open' },
        { id: 'ia5', priority: 'long_term', title: '长期: 引入数据库连接池可观测性', description: '部署 HikariCP/JDBC 连接池 Prometheus Exporter，在 Grafana 中建设连接池仪表盘。实现连接获取等待时间、活跃连接数、创建速率等指标的实时可视化。', assignee: '周九(平台)', dueDate: '2026-06-15', status: 'open' },
      ],
      impactAssessment: { mttr: 24, mttd: 3, affectedUsers: 12000, estimatedLoss: 8500, slaBreach: false },
      tags: ['order-service', '数据库', '连接池', 'P0', '慢查询'],
    },
    payment: {
      incidentId: 'INC-20260415-002',
      severity: 'P1',
      service: 'payment-service',
      impactScope: '支付模块 · 第三方支付超时',
      duration: 18,
      rootCauseAnalysis: {
        directCause: '第三方支付网关 API 响应超时（目标 2s，实际 15s+）。',
        indirectCause: '支付服务未配置合理的重试策略和降级方案，超时后直接返回失败。',
        rootCause: '第三方依赖缺乏熔断机制和服务健康检查。',
      },
      improvementActions: [
        { id: 'pa1', priority: 'urgent', title: '添加第三方 API 熔断器', description: '为支付网关调用引入 Resilience4j CircuitBreaker，失败率>50% 时自动熔断并降级为本地缓存结果。', status: 'done' },
        { id: 'pa2', priority: 'short_term', title: '优化超时和重试策略', description: '设置分级超时：connect=1s, read=3s, total=5s；指数退避重试最多 3 次。', status: 'in_progress' },
      ],
      impactAssessment: { mttr: 18, mttd: 5, affectedUsers: 3500, estimatedLoss: 2200, slaBreach: false },
      tags: ['payment', '第三方API', 'P1', '超时'],
    },
    db: {
      incidentId: 'INC-20260403-003',
      severity: 'P1',
      service: 'MySQL 主从集群',
      impactScope: '数据库读取延迟升高',
      duration: 8,
      rootCauseAnalysis: {
        directCause: '计划内 DB 主从切换期间，从库尚未完成数据同步就开始承接读流量。',
        indirectCause: '切换脚本缺少同步状态校验步骤。',
        rootCause: '数据库运维自动化流程不够完善。',
      },
      improvementActions: [
        { id: 'da1', priority: 'short_term', title: '增强切换脚本的状态检查', description: '在切换流程中增加 Seconds_Behind_Master == 0 的强制校验。', status: 'done' },
      ],
      impactAssessment: { mttr: 8, mttd: 2, affectedUsers: 8000, slaBreach: false },
      tags: ['MySQL', '主从切换', 'P1', '计划内维护'],
    },
    cache: {
      incidentId: 'INC-20260328-004',
      severity: 'P0',
      service: 'Redis 缓存集群',
      impactScope: '全站缓存失效 · 数据库被打满',
      duration: 42,
      rootCauseAnalysis: {
        directCause: 'Redis Cluster 进行 slot 迁移期间大量 key 失效，引发缓存雪崩。',
        indirectCause: '应用层缺少多级缓存保护和限流机制。',
        rootCause: '缓存架构设计存在单点风险，缺少本地缓存兜底方案。',
      },
      improvementActions: [
        { id: 'ca1', priority: 'urgent', title: '引入 Caffeine 本地一级缓存', description: '热点数据增加 JVM 本地缓存作为 L1 缓存，减少 Redis 访问压力。', status: 'done' },
        { id: 'ca2', priority: 'short_term', title: '缓存 Key 设置随机过期时间', description: '避免大量 Key 同时过期，基础 TTL 上加随机偏移（±20%）。', status: 'done' },
        { id: 'ca3', priority: 'long_term', title: '实施缓存预热和降级策略', description: '构建缓存预热管道，缓存不可用时降级到 DB 并触发限流。', status: 'open' },
      ],
      impactAssessment: { mttr: 42, mttd: 8, affectedUsers: 50000, estimatedLoss: 15000, slaBreach: true },
      tags: ['Redis', '缓存雪崩', 'P0', '架构优化'],
    },
  };

  const base = incidents[type] || incidents.default;
  const now = new Date();
  const startTime = new Date(now.getTime() - base.duration! * 60000);

  return {
    id: `incident-report-${Date.now()}`,
    type: 'incident',
    title: `${base.severity}级故障 · ${base.service}`,
    period: now.toISOString().split('T')[0],
    generatedAt: Date.now(),
    status: 'ready',
    ...base as Omit<IncidentReport, 'id' | 'type' | 'title' | 'period' | 'generatedAt' | 'status'>,
    startTime: startTime.getTime(),
    endTime: now.getTime(),
  };
}
