import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MemoryStick, HardDrive, BarChart3, AlertTriangle,
  Bell, Clock, ChevronDown, ChevronRight, Settings2,
  RefreshCw, ShieldCheck, TrendingUp, Zap, Activity,
} from 'lucide-react';
import ReactEChartsCore from 'echarts-for-react';
import * as echarts from 'echarts';

interface MemInfoData {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  free_gb: number;
  cached_gb: number;
  buffer_gb: number;
  percent: number;
  swap_total_gb: number;
  swap_used_gb: number;
  swap_free_gb: number;
  swap_percent: number;
  timestamp: string;
}

interface MemProcData {
  pid: number;
  name: string;
  memory_mb: number;
  memory_percent: number;
  status: string;
}

interface MemInfoResponse {
  status: string;
  info: MemInfoData;
  top_processes: MemProcData[];
}

type TimeRange = '5m' | '1h' | '24h';

const MAX_HISTORY = 360;

const timeRangeLabels: Record<TimeRange, string> = { '5m': '近5分钟', '1h': '近1小时', '24h': '近24小时' };
const timeRangeWindows: Record<TimeRange, number> = { '5m': 60, '1h': 120, '24h': 360 };

function formatGB(gb: number): string { return `${gb.toFixed(1)} GB`; }
function formatMB(mb: number): string { return `${mb.toFixed(0)} MB`; }

function getMemColor(pct: number): string {
  if (pct < 60) return '#10b981';
  if (pct < 80) return '#f59e0b';
  if (pct < 90) return '#f97316';
  return '#ef4444';
}

function getMemBg(pct: number): string {
  if (pct < 60) return 'bg-emerald-50 border-emerald-200';
  if (pct < 80) return 'bg-amber-50 border-amber-200';
  if (pct < 90) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function getMemText(pct: number): string {
  if (pct < 60) return 'text-emerald-600';
  if (pct < 80) return 'text-amber-600';
  if (pct < 90) return 'text-orange-600';
  return 'text-red-600';
}

function MemGauge({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = Math.min((value / total) * 100, 100);
  const color = getMemColor(pct);
  const size = 130;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (pct / 100) * circ * 0.82;
  const c = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="mg-mem" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} strokeLinecap="round" />
        <circle cx={c} cy={c} r={r} fill="none" stroke="url(#mg-mem)" strokeWidth={12}
          strokeLinecap="round" strokeDasharray={`${circ * 0.82} ${circ}`} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums tracking-tight" style={{ color }}>{pct.toFixed(1)}</span>
        <span className="text-[10px] text-gray-400 font-medium -mt-0.5">%</span>
        <span className="text-[9px] text-gray-400 mt-0.5">{label}</span>
      </div>
    </div>
  );
}

interface HistoryPoint {
  time: string;
  used: number;
  available: number;
  total: number;
  percent: number;
}

export default function MemoryMonitor() {
  const [memData, setMemData] = useState<MemInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('5m');
  const [showThreshold, setShowThreshold] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(85);
  const [isAlerting, setIsAlerting] = useState(false);
  const [expandedProcs, setExpandedProcs] = useState(false);
  const echartsRef = useRef<any>(null);

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch('/api/memory/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MemInfoResponse = await res.json();
      if (data.status === 'error') throw new Error('Memory info API returned error status');
      setMemData(data);

      const now = new Date();
      const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      setHistory(prev => {
        const pt: HistoryPoint = {
          time: ts,
          used: data.info.used_gb,
          available: data.info.available_gb,
          total: data.info.total_gb,
          percent: data.info.percent,
        };
        const next = [...prev, pt];
        if (next.length > MAX_HISTORY) return next.slice(-MAX_HISTORY);
        return next;
      });

      if (data.info.percent >= alertThreshold) {
        setIsAlerting(true);
      } else {
        setIsAlerting(false);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取内存数据失败');
    } finally {
      setLoading(false);
    }
  }, [alertThreshold]);

  useEffect(() => { fetchMemory(); const iv = setInterval(fetchMemory, 3000); return () => clearInterval(iv); }, [fetchMemory]);

  if (loading && !memData) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <div className="relative">
          <MemoryStick size={36} className="text-purple-300 animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping" />
        </div>
        <span className="text-sm text-gray-400">正在采集内存实时数据...</span>
      </div>
    );
  }

  if (error && !memData) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <MemoryStick size={32} className="text-red-300" />
        <span className="text-sm text-red-500">{error}</span>
        <button onClick={fetchMemory} className="mt-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100">重试</button>
      </div>
    );
  }

  if (!memData) return null;

  const m = memData.info;
  const windowSize = timeRangeWindows[timeRange];
  const visibleHistory = history.slice(-windowSize);

  const chartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      borderRadius: 12,
      padding: [12, 16],
      textStyle: { color: '#334155', fontSize: 12, fontFamily: 'inherit' },
      formatter: (params: any) => {
        const pts = Array.isArray(params) ? params : [params];
        const time = pts[0]?.axisValue || '';
        let html = `<div style="font-weight:700;margin-bottom:6px;color:#64748b;">${time}</div>`;
        pts.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
            <span style="color:#64748b;">${p.seriesName}:</span>
            <span style="font-weight:700;color:#1e293b;">${p.value} GB</span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 12, itemHeight: 8,
      itemGap: 20,
    },
    grid: { top: 12, right: 20, bottom: 32, left: 48 },
    xAxis: {
      type: 'category',
      data: visibleHistory.map(h => h.time),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 9, interval: Math.max(Math.floor(visibleHistory.length / 6), 1) },
    },
    yAxis: [
      {
        type: 'value',
        name: 'GB',
        nameTextStyle: { color: '#94a3b8', fontSize: 9 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 9, formatter: '{value}' },
      },
      {
        type: 'value',
        name: '%',
        nameTextStyle: { color: '#94a3b8', fontSize: 9 },
        min: 0, max: 100,
        splitLine: { show: false },
        axisLabel: { color: '#ef4444', fontSize: 9, formatter: '{value}%' },
      },
    ],
    series: [
      {
        name: '已使用',
        type: 'line',
        data: visibleHistory.map(h => h.used),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#f59e0b' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245,158,11,0.25)' },
            { offset: 1, color: 'rgba(245,158,11,0.02)' },
          ]),
        },
        markLine: alertThreshold < 100 ? {
          silent: true,
          data: [{ yAxis: m.total_gb * alertThreshold / 100, label: { formatter: `${alertThreshold}% 阈值`, fontSize: 9, color: '#ef4444' }, lineStyle: { color: '#ef4444', type: 'dashed', width: 1 } }],
        } : undefined,
      },
      {
        name: '可用内存',
        type: 'line',
        data: visibleHistory.map(h => h.available),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#10b981' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16,185,129,0.2)' },
            { offset: 1, color: 'rgba(16,185,129,0.01)' },
          ]),
        },
      },
      {
        name: '总量',
        type: 'line',
        data: visibleHistory.map(h => h.total),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#94a3b8', type: 'dashed', opacity: 0.7 },
        areaStyle: { color: 'transparent' },
      },
      {
        name: '使用率',
        type: 'line',
        yAxisIndex: 1,
        data: visibleHistory.map(h => h.percent),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#ef4444', opacity: 0.5 },
        areaStyle: { color: 'transparent' },
      },
    ],
  };

  const procsToShow = expandedProcs ? memData.top_processes : memData.top_processes.slice(0, 6);

  return (
    <div className="space-y-4">

      {/* Alert Banner */}
      {isAlerting && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 animate-pulse">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-700">内存使用率达到 {alertThreshold}% 阈值！当前 {m.percent}%</span>
        </div>
      )}

      {/* Top Row: Gauge + Key Metrics */}
      <div className="flex items-start gap-5 p-4 rounded-xl bg-gradient-to-br from-purple-50/60 via-violet-50/40 to-pink-50/30 border border-purple-100/60">
        <MemGauge value={m.used_gb} total={m.total_gb} label="物理内存" />

        <div className="flex-1 grid grid-cols-3 gap-x-4 gap-y-2.5 min-w-0">
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <HardDrive size={11} className="text-purple-400" />
              <span className="text-[9px] text-gray-400">总内存</span>
            </div>
            <div className="text-base font-black text-purple-600 tabular-nums">{m.total_gb.toFixed(1)}
              <span className="text-[10px] font-normal text-gray-400 ml-0.5">GB</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={11} className="text-amber-400" />
              <span className="text-[9px] text-gray-400">已使用</span>
            </div>
            <div className="text-base font-black text-amber-600 tabular-nums">{m.used_gb.toFixed(1)}
              <span className="text-[10px] font-normal text-gray-400 ml-0.5">GB</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span className="text-[9px] text-gray-400">可用内存</span>
            </div>
            <div className="text-base font-black text-emerald-600 tabular-nums">{m.available_gb.toFixed(1)}
              <span className="text-[10px] font-normal text-gray-400 ml-0.5">GB</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <Zap size={11} className="text-blue-400" />
              <span className="text-[9px] text-gray-400">空闲 / 缓存</span>
            </div>
            <div className="text-xs font-bold text-gray-700 tabular-nums space-x-1">
              <span className="text-blue-600">{m.free_gb.toFixed(1)}</span>
              <span className="text-gray-300">/</span>
              <span className="text-violet-600">{m.cached_gb.toFixed(1)} GB</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <RefreshCw size={11} className="text-pink-400" />
              <span className="text-[9px] text-gray-400">交换分区用量</span>
            </div>
            <div className="text-xs font-bold text-gray-700 tabular-nums">
              <span className={m.swap_percent > 10 ? 'text-red-500' : 'text-pink-600'}>
                {m.swap_used_gb.toFixed(1)}
              </span>
              <span className="text-gray-300"> / </span>
              <span>{m.swap_total_gb.toFixed(1)} GB</span>
              {m.swap_total_gb > 0 && (
                <span className={`ml-1 text-[9px] ${m.swap_percent > 10 ? 'text-red-400' : 'text-gray-400'}`}>({m.swap_percent}%)</span>
              )}
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <BarChart3 size={11} className="text-indigo-400" />
              <span className="text-[9px] text-gray-400">缓冲</span>
            </div>
            <div className="text-base font-black text-indigo-600 tabular-nums">{m.buffer_gb.toFixed(2)}
              <span className="text-[10px] font-normal text-gray-400 ml-0.5">GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Threshold Settings */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setShowThreshold(!showThreshold)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/80 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-[11px] font-semibold text-gray-600">
            <Settings2 size={13} className="text-gray-400" />
            告警阈值设置
          </span>
          {showThreshold ? <ChevronDown size={14} className="text-gray-400 rotate-180" /> : <ChevronRight size={14} className="text-gray-400" />}
        </button>
        {showThreshold && (
          <div className="px-4 py-3 bg-white flex items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Bell size={15} className={isAlerting ? 'text-red-500' : 'text-gray-400'} />
              <span className="text-xs text-gray-500">内存使用率超过</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={alertThreshold}
                  onChange={e => setAlertThreshold(Number(e.target.value))}
                  className="w-32 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                />
                <span className="text-sm font-black text-purple-600 tabular-nums w-10">{alertThreshold}%</span>
              </div>
            </div>
            <div className="text-[10px] text-gray-400">
              当前: <span className={isAlerting ? 'text-red-500 font-bold' : 'text-gray-500'}>{m.percent}%</span>
              {isAlerting && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-medium">已触发</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ECharts Dynamic Curve */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
            <Activity size={13} className="text-purple-500" />
            内存使用趋势
          </span>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(Object.keys(timeRangeLabels) as TimeRange[]).map(key => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  timeRange === key ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {timeRangeLabels[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <ReactEChartsCore
            ref={echartsRef}
            echarts={echarts}
            option={chartOption}
            style={{ height: 240, width: '100%' }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      </div>

      {/* Top Mem Processes */}
      {memData.top_processes.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
              <MemoryStick size={13} className="text-purple-500" />
              内存占用 Top 进程
            </span>
            <button
              onClick={() => setExpandedProcs(!expandedProcs)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                expandedProcs
                  ? 'bg-purple-50 text-purple-600 border-purple-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <ChevronDown size={11} className={expandedProcs ? 'rotate-180' : ''} />
              {expandedProcs ? '收起' : '展开全部'}
            </button>
          </div>
          <div className={`rounded-xl overflow-hidden border border-gray-100 ${expandedProcs ? 'max-h-[360px] overflow-y-auto' : ''}`}>
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50/95 backdrop-blur-sm">
                  <th className="py-1.5 px-3 text-left font-medium text-gray-500">#</th>
                  <th className="py-1.5 px-2 text-left font-medium text-gray-500">进程名称</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-500">内存</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-500">占比</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-500 hidden sm:table-cell">PID</th>
                </tr>
              </thead>
              <tbody>
                {procsToShow.map((proc, i) => {
                  const pct = proc.memory_percent;
                  const barColor = pct > 5 ? '#ef4444' : pct > 2 ? '#f59e0b' : '#3b82f6';
                  return (
                    <tr key={`${proc.pid}-${i}`} className="border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                      <td className="py-1.5 px-3 font-mono text-gray-400">{i + 1}</td>
                      <td className="py-1.5 px-2 font-medium text-gray-700 truncate max-w-[140px]" title={proc.name}>
                        {proc.name}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                          </div>
                          <span className="tabular-nums text-gray-700 font-medium">{proc.memory_mb.toFixed(0)} MB</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                          style={{ backgroundColor: `${barColor}15`, color: barColor }}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-400 hidden sm:table-cell">{proc.pid}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}