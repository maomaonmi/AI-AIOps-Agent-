import React, { useState, useCallback, useRef } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, AlertTriangle, Clock, Download, Eye, FileText, Sparkles, Star, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { SlaReport as SlaReportType } from '../types/moduleData';

interface SlaReportProps {
  onExportPdf?: (elementId: string, filename: string) => void;
}

export default function SlaReport({ onExportPdf }: SlaReportProps) {
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<SlaReportType | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setReport(generateSlaReportData(periodType));
    setIsGenerating(false);
  }, [periodType]);

  const handleExportPdf = useCallback(() => {
    if (reportRef.current && onExportPdf) {
      onExportPdf('sla-report-content', `SLA报告_${report?.period || 'report'}`);
    }
  }, [onExportPdf, report]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
            <BarChart3 size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-gray-800">SLA 可用性报告</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['monthly', 'quarterly'] as const).map(type => (
              <button key={type} onClick={() => { setPeriodType(type); setReport(null); }}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${periodType === type ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {type === 'monthly' ? '📅 月度' : '📆 季度'}
              </button>
            ))}
          </div>
          <button onClick={generateReport} disabled={isGenerating}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center gap-1.5 disabled:opacity-50">
            {isGenerating ? <Sparkles size={12} className="animate-pulse" /> : <FileText size={12} />}
            {isGenerating ? '生成中...' : '生成 SLA 报告'}
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
      <div className="flex-1 overflow-y-auto p-4" id="sla-report-scroll">
        {isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-blue-200" />
              <BarChart3 size={28} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-bounce" />
            </div>
            <p className="text-sm font-medium text-gray-600">正在计算 SLA 数据...</p>
            <p className="text-[11px] mt-1 text-gray-400">汇总停机事件 · 计算可用性 · 生成报告</p>
          </div>
        )}

        {!isGenerating && !report && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-4">
              <BarChart3 size={32} className="text-blue-300" />
            </div>
            <p className="text-sm">点击"生成 SLA 报告"</p>
            <p className="text-[11px] mt-1 max-w-[260px] text-center">自动汇总所有停机事件，计算各服务可用性，生成合规报告</p>
          </div>
        )}

        {report && !isGenerating && (
          <div ref={reportRef} id="sla-report-content" className="space-y-4 print:p-0">
            {/* Report Header */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">{report.title}</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">目标可用性: {report.targetAvailability}% · 统计周期: {getPeriodLabel(report.period)}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${report.isMet ? 'bg-green-100' : 'bg-red-100'}`}>
                    {report.isMet ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-600" />}
                    <span className={`text-xs font-bold ${report.isMet ? 'text-green-700' : 'text-red-700'}`}>
                      {report.actualAvailability.toFixed(2)}% {report.isMet ? '✓ 达标' : '✗ 未达标'}
                    </span>
                    <Star size={12} className={report.isMet ? 'text-yellow-500' : 'text-gray-300'} />
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* SLA Gauge */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">SLA 可用性</p>
                    <span className={`text-[10px] font-medium ${report.slaTrend === 'improving' ? 'text-green-600' : report.slaTrend === 'declining' ? 'text-red-600' : 'text-gray-500'}`}>
                      趋势: {report.slaTrend === 'improving' ? '📈 向好' : report.slaTrend === 'declining' ? '📉 恶化' : '➡️ 稳定'}
                    </span>
                  </div>
                  <div className="relative bg-gray-50 rounded-xl p-6">
                    <div className="relative w-full max-w-[280px] mx-auto">
                      <svg viewBox="0 0 280 140" className="w-full">
                        <defs>
                          <linearGradient id="slaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                        <path d="M 20 130 A 120 120 0 0 1 260 130" fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
                        {(() => {
                          const pct = Math.min(Math.max((report.actualAvailability - 99) / 1 * 100, 0), 100);
                          const endAngle = Math.PI + (pct / 100) * Math.PI;
                          const x = 140 + 120 * Math.cos(endAngle);
                          const y = 130 - 120 * Math.sin(endAngle);
                          const largeArc = pct > 50 ? 1 : 0;
                          return (
                            <path d={`M 20 130 A 120 120 0 ${largeArc} 1 ${x} ${y}`} fill="none"
                              stroke={report.isMet ? "url(#slaGrad)" : "#ef4444"} strokeWidth="14" strokeLinecap="round" />
                          );
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                        <span className={`text-3xl font-bold tabular-nums ${report.isMet ? 'text-blue-600' : 'text-red-600'}`}>
                          {report.actualAvailability.toFixed(2)}%
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">实际可用性</span>
                        <span className="text-[10px] text-gray-400 mt-1">目标: {report.targetAvailability}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200">
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-gray-800">{formatMinutes(report.actualDowntimeMinutes)}</p>
                        <p className="text-[10px] text-gray-500">总停机时间</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-gray-800">{formatMinutes(report.allowedDowntimeMinutes)}</p>
                        <p className="text-[10px] text-gray-500">允许停机</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-lg font-bold tabular-nums ${report.breachAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {report.breachAmount > 0 ? `+${formatMinutes(report.breachAmount)}` : '达标'}
                        </p>
                        <p className="text-[10px] text-gray-500">{report.breachAmount > 0 ? '超出额度' : '状态'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Service Details Table */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">各服务 SLA 明细</p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-2.5 px-3 text-gray-500 font-semibold">服务名</th>
                          <th className="text-right py-2.5 px-3 text-gray-500 font-semibold">目标</th>
                          <th className="text-right py-2.5 px-3 text-gray-500 font-semibold">实际</th>
                          <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">状态</th>
                          <th className="text-right py-2.5 px-3 text-gray-500 font-semibold">停机</th>
                          <th className="text-right py-2.5 px-3 text-gray-500 font-semibold">故障数</th>
                          <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">趋势</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.services.map((svc, i) => (
                          <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50/50 ${i % 2 === 0 ? '' : 'bg-white'}`}>
                            <td className="py-2.5 px-3 font-medium text-gray-800">{svc.name}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{svc.targetAvailability}%</td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{svc.actualAvailability.toFixed(2)}%</td>
                            <td className="py-2.5 px-3 text-center">
                              {svc.isMet
                                ? <CheckCircle2 size={14} className="inline text-green-500" />
                                : <XCircle size={14} className="inline text-red-500" />}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{formatMinutes(svc.downtimeMinutes)}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{svc.incidents}</td>
                            <td className="py-2.5 px-3 text-center">
                              {svc.trend === 'up' ? <ArrowUpRight size={13} className="inline text-green-500" />
                               : svc.trend === 'down' ? <ArrowDownRight size={13} className="inline text-red-500" />
                               : <Minus size={13} className="inline text-gray-400" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Downtime Events */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Clock size={11} /> 停机事件明细 ({report.downtimeEvents.length})
                  </p>
                  <div className="space-y-1.5">
                    {report.downtimeEvents.map((event, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                        event.planned ? 'bg-blue-50/60 border-blue-100' :
                        event.severity === 'P0' ? 'bg-red-50/60 border-red-100' :
                        event.severity === 'P1' ? 'bg-orange-50/60 border-orange-100' :
                        'bg-yellow-50/60 border-yellow-100'
                      }`}>
                        <span className={`shrink-0 w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold ${
                          event.severity === 'P0' ? 'bg-red-100 text-red-600' :
                          event.severity === 'P1' ? 'bg-orange-100 text-orange-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{event.severity}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-gray-800 truncate">{event.service}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{event.date}</span>
                            <span className={`text-[9px] px-1.5 py-0 rounded shrink-0 ${
                              event.planned ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                            }`}>{event.planned ? '计划内' : '非计划'}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{event.cause}</p>
                        </div>
                        <span className="text-[11px] font-bold tabular-nums text-gray-700 shrink-0">{formatMinutes(event.duration)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monthly Comparison */}
                {report.monthlyComparison.length > 1 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <TrendingUp size={11} /> 月度趋势对比
                    </p>
                    <div className="grid grid-cols-{report.monthlyComparison.length} gap-2">
                      {report.monthlyComparison.map((m, i) => {
                        const isLast = i === report.monthlyComparison.length - 1;
                        const prev = i > 0 ? report.monthlyComparison[i - 1].availability : null;
                        const diff = prev !== null ? m.availability - prev : 0;
                        return (
                          <div key={i} className={`${isLast ? 'ring-2 ring-blue-200 ring-offset-1' : ''} bg-gray-50 rounded-lg p-3 text-center`}>
                            <p className="text-[10px] text-gray-500 mb-1">{m.month}</p>
                            <p className={`text-base font-bold tabular-nums ${m.availability >= 99.9 ? 'text-green-600' : m.availability >= 99.5 ? 'text-amber-600' : 'text-red-600'}`}>
                              {m.availability.toFixed(2)}%
                            </p>
                            {prev !== null && (
                              <p className={`text-[9px] mt-0.5 ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {diff >= 0 ? `↑${diff.toFixed(2)}` : `${diff.toFixed(2)}`}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Recommendations */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Sparkles size={11} /> AI 建议
                    <span className="normal-case text-violet-500 font-normal ml-1">LLM 驱动</span>
                  </p>
                  <div className="space-y-2">
                    {report.recommendations.map((rec, i) => (
                      <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                        rec.startsWith('⚠️') ? 'bg-red-50/60 border-red-100' :
                        rec.startsWith('💡') ? 'bg-violet-50/60 border-violet-100' :
                        rec.startsWith('🎯') ? 'bg-emerald-50/60 border-emerald-100' :
                        'bg-blue-50/60 border-blue-100'
                      }`}>
                        <Sparkles size={14} className="shrink-0 mt-0.5 text-violet-500" />
                        <p className="text-[11px] leading-relaxed text-gray-700">{rec}</p>
                      </div>
                    ))}
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

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function getPeriodLabel(period: string): string {
  if (period.startsWith('W')) return `第${period.replace('W', '')}周`;
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-');
    return `${y}年${parseInt(m)}月`;
  }
  return period;
}

function generateSlaReportData(periodType: 'monthly' | 'quarterly'): SlaReportType {
  const now = new Date();
  const monthStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  const actualAvail = 99.85 + Math.random() * 0.14;
  const target = 99.9;
  const isMet = actualAvail >= target;

  const totalMinutesInMonth = 30 * 24 * 60;
  const allowedDowntime = totalMinutesInMonth * (1 - target / 100);
  const actualDowntime = totalMinutesInMonth * (1 - actualAvail / 100);

  return {
    id: `sla-${Date.now()}`,
    type: 'sla',
    title: `📈 SLA 可用性报告 · ${monthStr}`,
    period: now.toISOString().split('T')[0],
    generatedAt: Date.now(),
    status: 'ready',
    targetAvailability: target,
    actualAvailability: actualAvail,
    isMet,
    periodType,
    services: [
      { name: 'api-gateway', targetAvailability: 99.9, actualAvailability: 99.98, isMet: true, downtimeMinutes: 9, incidents: 2, trend: 'up' },
      { name: 'order-svc', targetAvailability: 99.95, actualAvailability: 99.91, isMet: false, downtimeMinutes: 39, incidents: 3, trend: 'down' },
      { name: 'user-svc', targetAvailability: 99.9, actualAvailability: 99.99, isMet: true, downtimeMinutes: 4, incidents: 1, trend: 'stable' },
      { name: 'payment-svc', targetAvailability: 99.99, actualAvailability: 99.97, isMet: false, downtimeMinutes: 22, incidents: 2, trend: 'down' },
      { name: 'notification-svc', targetAvailability: 99.5, actualAvailability: 99.98, isMet: true, downtimeMinutes: 9, incidents: 1, trend: 'up' },
      { name: 'inventory-svc', targetAvailability: 99.9, actualAvailability: 99.96, isMet: true, downtimeMinutes: 18, incidents: 1, trend: 'stable' },
      { name: 'search-svc', targetAvailability: 99.8, actualAvailability: 99.92, isMet: true, downtimeMinutes: 35, incidents: 2, trend: 'up' },
      { name: 'auth-svc', targetAvailability: 99.99, actualAvailability: 9999.95, isMet: true, downtimeMinutes: 2, incidents: 0, trend: 'stable' },
    ],
    downtimeEvents: [
      { date: '04-28', service: 'order-service', duration: 24, severity: 'P0', cause: '数据库连接池耗尽（连接泄漏）', planned: false },
      { date: '04-15', service: 'payment-service', duration: 18, severity: 'P1', cause: '第三方支付 API 超时', planned: false },
      { date: '04-03', service: 'MySQL 主从集群', duration: 8, severity: 'P1', cause: '计划内主从切换', planned: true },
      { date: '04-22', service: 'order-service', duration: 15, severity: 'P2', cause: '缓存节点重启', planned: true },
      { date: '04-10', service: 'payment-service', duration: 4, severity: 'P2', cause: '证书续期短暂中断', planned: true },
      { date: '04-18', service: 'search-svc', duration: 22, severity: 'P1', cause: 'Elasticsearch 索引重建', planned: true },
      { date: '04-25', service: 'order-service', duration: 8, severity: 'P2', cause: '配置热更新导致短暂不可用', planned: false },
    ],
    monthlyComparison: [
      { month: '1月', availability: 99.94 },
      { month: '2月', availability: 99.91 },
      { month: '3月', availability: 99.96 },
      { month: '4月', availability: actualAvail },
    ],
    allowedDowntimeMinutes: allowedDowntime,
    actualDowntimeMinutes: actualDowntime,
    breachAmount: Math.max(0, actualDowntime - allowedDowntime),
    slaTrend: actualAvail >= 99.94 ? 'improving' : actualAvail >= 99.90 ? 'stable' : 'declining',
    recommendations: [
      '⚠️ order-svc 本月未达 SLA 目标（99.91% vs 99.95%），主要原因是 4/28 的 P0 故障（连接池耗尽）导致 24 分钟停机。建议优先落实改进措施中的连接池参数调整。',
      '💡 payment-svc 连续两个月接近 SLA 边界，建议将目标从 99.99% 下调至 99.97%，或引入多活架构提升容灾能力。',
      '🎯 整体 SLA 呈现向好趋势（本月 vs 上月 +0.02%），但 order-svc 和 payment-svc 是主要风险点。建议为这两个核心服务建立专项优化小组。',
      '💡 本月计划内维护占比 43%（92min 中 40min 为计划内），建议进一步优化维护窗口的执行效率，减少对用户的影响。',
    ],
  };
}
