import React, { useState, useCallback, useRef } from 'react';
import { FileText, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Clock, Activity, Cpu, HardDrive, Wifi, Sparkles, RefreshCw, Download, Eye, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Lightbulb } from 'lucide-react';
import type { DailyReport, AnomalyEvent } from '../types/moduleData';

interface DailyReportProps {
  onExportPdf?: (elementId: string, filename: string) => void;
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: '严重' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: '警告' },
  info: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: '信息' },
};

export default function DailyReport({ onExportPdf }: DailyReportProps) {
  const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<DailyReport | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2200));
    setReport(generateDailyReportData(reportType));
    setIsGenerating(false);
  }, [reportType]);

  const handleExportPdf = useCallback(() => {
    if (reportRef.current && onExportPdf) {
      onExportPdf('daily-report-content', `${reportType === 'daily' ? '日报' : '周报'}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`);
    }
  }, [reportType, onExportPdf]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
            <FileText size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-gray-800">{reportType === 'daily' ? '运维日报' : '运维周报'}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['daily', 'weekly'] as const).map(type => (
              <button key={type} onClick={() => { setReportType(type); setReport(null); }}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${reportType === type ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {type === 'daily' ? '📅 日报' : '📆 周报'}
              </button>
            ))}
          </div>
          <button onClick={generateReport} disabled={isGenerating}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-1.5 disabled:opacity-50">
            {isGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {isGenerating ? '生成中...' : '生成报告'}
          </button>
          {report && (
            <>
              <button onClick={handleExportPdf}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-1.5">
                <Download size={12} /> 导出PDF
              </button>
              <button onClick={() => window.open('#preview', '_blank')}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex items-center gap-1.5">
                <Eye size={12} /> 预览
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4" id="daily-report-scroll">
        {isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-200" />
              <FileText size={28} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 animate-bounce" />
            </div>
            <p className="text-sm font-medium text-gray-600">正在生成{reportType === 'daily' ? '日报' : '周报'}...</p>
            <p className="text-[11px] mt-1 text-gray-400">汇聚数据 · AI 分析 · 生成报告</p>
          </div>
        )}

        {!isGenerating && !report && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mb-4">
              <BarChart3 size={32} className="text-emerald-300" />
            </div>
            <p className="text-sm">点击"生成报告"</p>
            <p className="text-[11px] mt-1 max-w-[260px] text-center">自动汇聚监控数据，AI 生成洞察分析和改进建议</p>
          </div>
        )}

        {report && !isGenerating && (
          <div ref={reportRef} id="daily-report-content" className="space-y-4 print:p-0">
            {/* Report Header */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">{report.title}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <Calendar size={10} />
                    <span>{new Date(report.generatedAt).toLocaleString('zh-CN')}</span>
                    <span className={`px-1.5 py-0.5 rounded-full ${report.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {report.status === 'ready' ? '已就绪' : '生成中'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Key Metrics */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Activity size={11} /> 关键指标概览
                  </p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { label: '可用性', value: report.summary.availability, unit: '%', trend: report.summary.availabilityTrend, format: v => v.toFixed(1), good: v => v >= 99.9 },
                      { label: '异常事件', value: report.summary.anomalyCount, unit: '', trend: '-', format: v => String(v), good: v => v <= 5 },
                      { label: '处置完成', value: report.summary.resolvedCount, unit: `/${report.summary.anomalyCount}`, trend: '+', format: v => String(v), good: v => v >= report.summary.anomalyCount * 0.8 },
                      { label: '处置率', value: report.summary.resolutionRate, unit: '%', trend: '+', format: v => v.toFixed(0), good: v => v >= 95 },
                      { label: '平均响应', value: report.summary.avgResponseTime, unit: 'min', trend: '-', format: v => v.toFixed(1), good: v => v <= 15 },
                      { label: '总事件数', value: report.summary.totalEvents, unit: '', trend: '=', format: v => String(v), good: () => true },
                      { label: 'MTTR', value: report.summary.mttr, unit: 'min', trend: '-', format: v => v.toFixed(0), good: v => v <= 30 },
                    ].map((metric, i) => {
                      const isGood = metric.good(metric.value);
                      return (
                        <div key={i} className={`rounded-lg p-2.5 border ${isGood ? 'bg-green-50/60 border-green-100' : metric.value > (i === 0 ? 99 : i === 1 ? 10 : i === 4 ? 20 : 999) ? 'bg-red-50/60 border-red-100' : 'bg-amber-50/60 border-amber-100'}`}>
                          <p className="text-[10px] text-gray-500">{metric.label}</p>
                          <div className="flex items-end gap-1 mt-0.5">
                            <span className={`text-base font-bold tabular-nums ${isGood ? 'text-green-700' : 'text-red-700'}`}>{metric.format(metric.value)}</span>
                            <span className="text-[10px] text-gray-400 mb-0.5">{metric.unit}</span>
                          </div>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {metric.trend === '+' ? <ArrowUpRight size={10} className="text-green-500" /> :
                             metric.trend === '-' ? <ArrowDownRight size={10} className="text-red-500" /> :
                             <Minus size={10} className="text-gray-400" />}
                            <span className={`text-[9px] ${metric.trend === '+' ? 'text-green-600' : metric.trend === '-' ? 'text-red-600' : 'text-gray-400'}`}>
                              {metric.trend === '+' ? '良好' : metric.trend === '-' ? '需关注' : '持平'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resource Health */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Cpu size={11} /> 资源健康度
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'CPU', value: report.resourceHealth.cpu, icon: <Cpu size={13} />, color: report.resourceHealth.cpu > 85 ? 'text-red-500' : report.resourceHealth.cpu > 70 ? 'text-amber-500' : 'text-green-500' },
                      { label: '内存', value: report.resourceHealth.memory, icon: <Activity size={13} />, color: report.resourceHealth.memory > 85 ? 'text-red-500' : report.resourceHealth.memory > 75 ? 'text-amber-500' : 'text-green-500' },
                      { label: '磁盘', value: report.resourceHealth.disk, icon: <HardDrive size={13} />, color: report.resourceHealth.disk > 90 ? 'text-red-500' : report.resourceHealth.disk > 80 ? 'text-amber-500' : 'text-green-500' },
                      { label: '网络', value: report.resourceHealth.network, icon: <Wifi size={13} />, color: report.resourceHealth.network > 80 ? 'text-amber-500' : 'text-green-500' },
                    ].map((r, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={r.color}>{r.icon}</span>
                          <span className="text-[10px] text-gray-500">{r.label}</span>
                          <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: r.color.replace('text-', '') }}>{r.value}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${r.value > 85 ? 'bg-red-400' : r.value > 70 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(r.value, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anomalies */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <AlertTriangle size={11} /> 异常事件 ({report.anomalies.length})
                  </p>
                  <div className="space-y-1.5">
                    {report.anomalies.map(anomaly => {
                      const cfg = SEVERITY_CONFIG[anomaly.severity];
                      const Icon = cfg.icon;
                      return (
                        <div key={anomaly.id} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                          <Icon size={14} className={`${cfg.color} shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[11px] font-semibold text-gray-800">{anomaly.title}</span>
                              <span className="text-[9px] px-1.5 py-0 rounded bg-white/80 text-gray-500">{anomaly.time}</span>
                              <span className={`text-[9px] px-1.5 py-0 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                              <span className={`ml-auto text-[9px] px-1.5 py-0 rounded ${anomaly.status === 'resolved' ? 'bg-green-100 text-green-700' : anomaly.status === 'processing' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                {anomaly.status === 'resolved' ? '✅ 已处理' : anomaly.status === 'processing' ? '🔄 处理中' : '⏳ 待处理'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-600">{anomaly.description}</p>
                            {anomaly.resolvedBy && (
                              <p className="text-[10px] text-gray-400 mt-0.5">处理人: {anomaly.resolvedBy} · 耗时: {anomaly.resolutionTime}min</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Insights */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Lightbulb size={11} /> AI 洞察与建议
                    <span className="normal-case text-violet-500 font-normal ml-1">LLM 驱动</span>
                  </p>
                  <div className="space-y-2">
                    {report.aiInsights.map((insight, i) => (
                      <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                        insight.startsWith('⚠️') ? 'bg-amber-50/60 border-amber-100' :
                        insight.startsWith('💡') ? 'bg-violet-50/60 border-violet-100' :
                        insight.startsWith('📈') ? 'bg-green-50/60 border-green-100' :
                        'bg-blue-50/60 border-blue-100'
                      }`}>
                        <Sparkles size={14} className="shrink-0 mt-0.5 text-violet-500" />
                        <p className="text-[11px] leading-relaxed text-gray-700">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Week Comparison (for weekly) */}
                {report.weekComparison && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <TrendingUp size={11} /> 周环比对比
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-gray-500">可用性</p>
                        <p className="text-sm font-bold text-gray-800">{report.summary.availability}% vs {report.weekComparison.availability}%</p>
                        <p className={`text-[10px] ${report.summary.availability >= report.weekComparison.availability ? 'text-green-600' : 'text-red-600'}`}>
                          {report.summary.availability >= report.weekComparison.availability ? '↑ 提升' : '↓ 下降'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-gray-500">异常数</p>
                        <p className="text-sm font-bold text-gray-800">{report.summary.anomalyCount} vs {report.weekComparison.anomalies}</p>
                        <p className={`text-[10px] ${report.summary.anomalyCount <= report.weekComparison.anomalies ? 'text-green-600' : 'text-red-600'}`}>
                          {report.summary.anomalyCount <= report.weekComparison.anomalies ? '↓ 减少' : '↑ 增加'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-gray-500">响应时间</p>
                        <p className="text-sm font-bold text-gray-800">{report.summary.avgResponseTime}min vs {report.weekComparison.responseTime}min</p>
                        <p className={`text-[10px] ${report.summary.avgResponseTime <= report.weekComparison.responseTime ? 'text-green-600' : 'text-red-600'}`}>
                          {report.summary.avgResponseTime <= report.weekComparison.responseTime ? '↓ 改善' : '↑ 恶化'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Services */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <BarChart3 size={11} /> 服务健康排名
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium">服务名</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">错误率</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">P99延迟</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium">请求数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.topServices.map((svc, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="py-2 px-2 font-medium text-gray-700">{svc.name}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              <span className={svc.errorRate > 1 ? 'text-red-600' : svc.errorRate > 0.1 ? 'text-amber-600' : 'text-green-600'}>{svc.errorRate}%</span>
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-gray-600">{svc.latency}ms</td>
                            <td className="py-2 px-2 text-right tabular-nums text-gray-500">{(svc.requests / 1000).toFixed(1)}K</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function generateDailyReportData(type: 'daily' | 'weekly'): DailyReport {
  const today = new Date();
  const dateStr = today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const weekNum = getWeekNumber(today);

  return {
    id: `report-${Date.now()}`,
    type,
    title: type === 'daily'
      ? `📊 运维日报 · ${dateStr}`
      : `📊 运维周报 · 2026年第${weekNum}周 (${formatWeekRange(today)})`,
    period: type === 'daily' ? today.toISOString().split('T')[0] : `W${weekNum}`,
    generatedAt: Date.now(),
    status: 'ready',
    summary: {
      availability: 99.7 + Math.random() * 0.27,
      availabilityTrend: Math.random() > 0.3 ? '+' : '-',
      anomalyCount: Math.floor(Math.random() * 8) + 3,
      resolvedCount: Math.floor(Math.random() * 6) + 3,
      resolutionRate: 88 + Math.floor(Math.random() * 12),
      avgResponseTime: 5 + Math.random() * 15,
      totalEvents: Math.floor(Math.random() * 30) + 15,
      mttr: 8 + Math.floor(Math.random() * 22),
    },
    metrics: [
      { name: 'CPU 使用率', value: 62 + Math.random() * 18, unit: '%', trend: '=', trendValue: 0, status: 'normal' },
      { name: '内存使用率', value: 68 + Math.random() * 15, unit: '%', trend: '+', trendValue: 2, status: 'warning' },
      { name: '磁盘使用率', value: 42 + Math.random() * 12, unit: '%', trend: '=', trendValue: 0, status: 'normal' },
      { name: '网络 I/O', value: 300 + Math.random() * 400, unit: 'Mbps', trend: '-', trendValue: -15, status: 'normal' },
      { name: 'QPS', value: 12000 + Math.floor(Math.random() * 5000), unit: '', trend: '+', trendValue: 500, status: 'normal' },
      { name: 'P99 延迟', value: 45 + Math.random() * 40, unit: 'ms', trend: '-', trendValue: -5, status: 'normal' },
    ],
    anomalies: [
      { id: 'a1', time: '14:32', service: 'order-svc', severity: 'critical', title: 'P99 延迟突增至 8s', description: '订单服务在下午时段 P99 延迟从正常 120ms 突增至 8s，影响用户下单体验。经排查为数据库慢查询导致连接池耗尽。', status: 'resolved', resolvedBy: '张三', resolutionTime: 24 },
      { id: 'a2', time: '10:15', service: 'db-primary', severity: 'warning', title: '主从延迟超过 5s', description: '数据库主从复制延迟达到 6.2s，可能影响读一致性。已通知 DBA 排查并优化同步参数。', status: 'resolved', resolvedBy: '李四', resolutionTime: 45 },
      { id: 'a3', time: '08:45', service: 'cache-cluster', severity: 'info', title: '缓存命中率下降', description: 'Redis 缓存命中率从 98% 下降至 89%，原因是新版本上线后缓存策略变更导致。已扩容缓存节点至 6 台。', status: 'resolved', resolvedBy: '王五', resolutionTime: 12 },
      { id: 'a4', time: '16:20', service: 'api-gateway', severity: 'warning', title: '网关连接数接近阈值', description: 'API 网关活跃连接数达到 8500（阈值 9000），主要来自支付模块的高并发请求。建议评估是否需要水平扩展。', status: 'processing' },
      { id: 'a5', time: '03:12', service: 'log-service', severity: 'info', title: '日志索引重建完成', description: 'Elasticsearch 日志集群完成索引优化，查询性能提升约 40%。', status: 'resolved', resolvedBy: '系统自动化', resolutionTime: 0 },
    ],
    aiInsights: [
      '💡 今日整体运行平稳，系统可用性保持在 99.9% 以上。order-svc 在下午 14:00-15:00 时段出现两次 P99 延迟峰值，建议关注该服务的流量模式并考虑增加预热策略或实施限流保护。',
      '⚠️ 数据库连接数在 18:00-20:00 高峰期持续接近阈值（85%），虽然未触发告警但存在风险。建议评估是否需要扩容连接池或引入读写分离以分担主库压力。',
      '📈 缓存集群的命中率波动值得持续关注。今日因版本发布导致的短暂下降已通过扩容解决，建议后续发布流程中增加缓存预热步骤。',
      '💡 本周期内无 P0 级故障发生，团队响应时间中位数 8.2 分钟，较上周改善 23%。继续保持当前值班和响应机制。',
    ],
    resourceHealth: {
      cpu: 62 + Math.floor(Math.random() * 15),
      memory: 68 + Math.floor(Math.random() * 12),
      disk: 43 + Math.floor(Math.random() * 10),
      network: 35 + Math.floor(Math.random() * 25),
    },
    topServices: [
      { name: 'api-gateway', errorRate: 0.02, latency: 35, requests: 125000 },
      { name: 'user-svc', errorRate: 0.05, latency: 48, requests: 89000 },
      { name: 'order-svc', errorRate: 0.12, latency: 156, requests: 76000 },
      { name: 'payment-svc', errorRate: 0.03, latency: 82, requests: 45000 },
      { name: 'notification-svc', errorRate: 0.01, latency: 22, requests: 38000 },
      { name: 'inventory-svc', errorRate: 0.04, latency: 65, requests: 32000 },
    ],
    weekComparison: type === 'weekly' ? {
      availability: 99.65,
      anomalies: 18,
      responseTime: 12.3,
    } : undefined,
  };
}

function getWeekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
}

function formatWeekRange(date: Date): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
}
