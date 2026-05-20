import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Thermometer, Zap, Clock, Activity,
  TrendingUp, MemoryStick, Server, Gauge,
  ArrowUpRight, Cpu as ChipIcon, ChevronDown,
} from 'lucide-react';

interface CoreData {
  core_id: number;
  percent: number;
  frequency_mhz: number;
}

interface ProcessData {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  status: string;
}

interface CPUInfoResponse {
  status: string;
  overall_percent: number;
  per_core: CoreData[];
  count_physical: number;
  count_logical: number;
  freq_current_mhz: number;
  freq_min_mhz: number;
  freq_max_mhz: number;
  load_avg_1m: number;
  load_avg_5m: number;
  load_avg_15m: number;
  ctx_switches: number;
  interrupts: number;
  temperature_celsius: number | null;
  top_processes: ProcessData[];
  uptime_seconds: number;
  timestamp: string;
}

const CHART_POINTS = 60;

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function formatNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

function getLoadColor(pct: number): { bg: string; border: string; text: string; bar: string; glow: string } {
  if (pct < 30) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', bar: '#3b82f6', glow: 'rgba(59,130,246,0.15)' };
  if (pct < 60) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', bar: '#10b981', glow: 'rgba(16,185,129,0.15)' };
  if (pct < 80) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', bar: '#f59e0b', glow: 'rgba(245,158,11,0.18)' };
  return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', bar: '#ef4444', glow: 'rgba(239,68,68,0.2)' };
}


function CPUGauge({ value, size = 120 }: { value: number; size?: number }) {
  const pct = Math.min(value, 100);
  const colors = pct < 30 ? ['#93c5fd', '#3b82f6'] : pct < 60 ? ['#6ee7b7', '#10b981'] : pct < 80 ? ['#fcd34d', '#f59e0b'] : ['#fca5a5', '#ef4444'];
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (pct / 100) * circ * 0.85;
  const c = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`cg-${value}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#f1f5f9" strokeWidth={10} strokeLinecap="round" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#cg-${value})`} strokeWidth={10}
          strokeLinecap="round" strokeDasharray={`${circ * 0.85} ${circ}`} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums tracking-tight" style={{ color: colors[1] }}>{value.toFixed(1)}</span>
        <span className="text-[10px] text-gray-400 font-medium -mt-0.5">%</span>
      </div>
    </div>
  );
}


function LiveAreaChart({ dataPoints }: { dataPoints: number[] }) {
  const w = 520;
  const h = 110;
  const pad = 6;
  const cw = w - pad * 2;
  const ch = h - pad * 2;

  if (dataPoints.length < 2) {
    return (
      <div className="w-full rounded-xl bg-gradient-to-b from-slate-50 to-white border border-gray-100 flex items-center justify-center" style={{ width: w, height: h }}>
        <span className="text-xs text-gray-300">等待数据...</span>
      </div>
    );
  }

  const maxV = Math.max(...dataPoints, 20);
  const pts = dataPoints.map((v, i) => ({
    x: pad + (i / (CHART_POINTS - 1)) * cw,
    y: pad + ch - (v / maxV) * ch,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(pad + ch).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pad + ch).toFixed(1)} Z`;

  const lastPct = dataPoints[dataPoints.length - 1];
  const lastColor = lastPct < 30 ? '#3b82f6' : lastPct < 60 ? '#10b981' : lastPct < 80 ? '#f59e0b' : '#ef4444';
  const gradId = `area-${Date.now()}`;

  return (
    <div className="w-full rounded-xl bg-gradient-to-b from-slate-50/80 to-white border border-gray-100 overflow-hidden relative" style={{ width: w, height: h }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lastColor} stopOpacity="0.25" />
            <stop offset="70%" stopColor={lastColor} stopOpacity="0.06" />
            <stop offset="100%" stopColor={lastColor} stopOpacity="0" />
          </linearGradient>
          <filter id="glow-cpu">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path d={areaPath} fill={`url(#${gradId})`} />

        <path d={linePath} fill="none" stroke={lastColor} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          filter="url(#glow-cpu)"
          style={{ transition: 'stroke 0.3s ease' }}
        />

        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.5}
          fill={lastColor} stroke="#fff" strokeWidth={1.5}
          style={{ transition: 'all 0.3s ease' }}
        />

        {[0.25, 0.5, 0.75].map(ratio => (
          <g key={ratio}>
            <line x1={pad} y1={pad + ch * (1 - ratio)} x2={w - pad} y2={pad + ch * (1 - ratio)}
              stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5} />
            <text x={pad + 2} y={pad + ch * (1 - ratio) - 2} fontSize={8} fill="#cbd5e1">{Math.round(maxV * ratio)}%</text>
          </g>
        ))}
      </svg>

      <div className="absolute bottom-1 left-3 flex items-center gap-1">
        <Activity size={8} className="text-gray-400" />
        <span className="text-[9px] text-gray-400">实时曲线</span>
      </div>
      <div className="absolute top-1 right-3 px-1.5 py-0.5 rounded text-[9px] font-bold"
           style={{ backgroundColor: `${lastColor}18`, color: lastColor }}>
        {lastPct.toFixed(1)}%
      </div>
    </div>
  );
}


function CoreBar({ core }: { core: CoreData }) {
  const cfg = getLoadColor(core.percent);
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${cfg.bg} border ${cfg.border} transition-all duration-500`}>
      <span className={`text-[10px] font-bold ${cfg.text} w-7 shrink-0`}>C{core.core_id}</span>
      <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(core.percent, 100)}%`, backgroundColor: cfg.bar }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent rounded-full pointer-events-none" />
      </div>
      <span className={`text-[10px] font-bold tabular-nums w-9 text-right shrink-0 ${cfg.text}`}>{core.percent}%</span>
      <span className="text-[9px] text-gray-400 tabular-nums w-12 text-right shrink-0">{core.frequency_mhz > 0 ? `${core.frequency_mhz}` : ''}</span>
    </div>
  );
}


export default function CPUMonitor() {
  const [cpuData, setCpuData] = useState<CPUInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartHistory, setChartHistory] = useState<number[]>([]);
  const [expandedProcesses, setExpandedProcesses] = useState(false);
  const [allProcesses, setAllProcesses] = useState<ProcessData[] | null>(null);
  const [processesLoading, setProcessesLoading] = useState(false);

  const fetchCPU = useCallback(async () => {
    try {
      const res = await fetch('/api/cpu/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CPUInfoResponse = await res.json();
      if (data.status === 'error') throw new Error('Unknown error');
      setCpuData(data);
      setChartHistory(prev => [...prev.slice(-CHART_POINTS + 1), data.overall_percent]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取CPU数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCPU(); const iv = setInterval(fetchCPU, 2500); return () => clearInterval(iv); }, [fetchCPU]);

  const toggleExpandProcesses = useCallback(async () => {
    if (expandedProcesses) {
      setExpandedProcesses(false);
      setAllProcesses(null);
      return;
    }
    setProcessesLoading(true);
    try {
      const res = await fetch('/api/cpu/processes?limit=50');
      const data = await res.json();
      if (data.status === 'success') {
        setAllProcesses(data.processes);
        setExpandedProcesses(true);
      }
    } catch (err) {
      console.error('Failed to load processes:', err);
    } finally {
      setProcessesLoading(false);
    }
  }, [expandedProcesses]);

  if (loading && !cpuData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="relative">
          <Cpu size={36} className="text-indigo-300 animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping" />
        </div>
        <span className="text-sm text-gray-400">正在采集 CPU 实时数据...</span>
      </div>
    );
  }

  if (error && !cpuData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Cpu size={32} className="text-red-300" />
        <span className="text-sm text-red-500">{error}</span>
        <button onClick={fetchCPU} className="mt-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100">重试</button>
      </div>
    );
  }

  if (!cpuData) return null;

  const d = cpuData;
  const loadCfg = getLoadColor(d.overall_percent);
  const historyArr = chartHistory.length > 0 ? chartHistory : Array(CHART_POINTS).fill(d.overall_percent);

  return (
    <div className="space-y-4">

      {/* Top Row: Gauge + Key Metrics */}
      <div className="flex items-start gap-5 p-4 rounded-xl bg-gradient-to-br from-indigo-50/60 via-blue-50/40 to-purple-50/30 border border-indigo-100/60">
        {/* Gauge */}
        <CPUGauge value={d.overall_percent} size={130} />

        {/* Metrics Grid */}
        <div className="flex-1 grid grid-cols-3 gap-x-4 gap-y-2.5 min-w-0">
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <ChipIcon size={11} className="text-indigo-400" />
              <span className="text-[9px] text-gray-400">物理/逻辑核心</span>
            </div>
            <div className="text-base font-black text-gray-800 tabular-nums">
              <span className="text-indigo-600">{d.count_physical}</span>
              <span className="text-gray-300 mx-0.5">/</span>
              <span className="text-purple-600">{d.count_logical}</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <Zap size={11} className="text-amber-400" />
              <span className="text-[9px] text-gray-400">当前频率</span>
            </div>
            <div className="text-base font-black text-amber-600 tabular-nums">{d.freq_current_mhz > 0 ? d.freq_current_mhz : '--'}
              <span className="text-[10px] font-normal text-gray-400 ml-0.5">MHz</span>
            </div>
            <div className="text-[8px] text-gray-300 mt-0.5">{d.freq_min_mhz}-{d.freq_max_mhz} MHz</div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <Clock size={11} className="text-teal-400" />
              <span className="text-[9px] text-gray-400">运行时间</span>
            </div>
            <div className="text-base font-black text-teal-600">{formatUptime(d.uptime_seconds)}</div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={11} className="text-blue-400" />
              <span className="text-[9px] text-gray-400">系统负载 (1/5/15min)</span>
            </div>
            <div className="text-xs font-bold text-gray-700 tabular-nums space-x-1">
              <span className={d.load_avg_1m > d.count_physical ? 'text-red-500' : 'text-blue-600'}>{d.load_avg_1m}</span>
              <span className="text-gray-300">/</span>
              <span>{d.load_avg_5m}</span>
              <span className="text-gray-300">/</span>
              <span>{d.load_avg_15m}</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <Server size={11} className="text-violet-400" />
              <span className="text-[9px] text-gray-400">上下文切换</span>
            </div>
            <div className="text-base font-black text-violet-600 tabular-nums">{formatNum(d.ctx_switches)}</div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2.5 border border-white shadow-sm">
            <div className="flex items-center gap-1 mb-1">
              <Thermometer size={11} className={d.temperature_celsius !== null ? 'text-orange-400' : 'text-gray-300'} />
              <span className="text-[9px] text-gray-400">温度</span>
            </div>
            <div className="text-base font-black tabular-nums" style={{ color: d.temperature_celsius !== null ? (d.temperature_celsius > 70 ? '#ef4444' : d.temperature_celsius > 50 ? '#f59e0b' : '#10b981') : '#d1d5db' }}>
              {d.temperature_celsius !== null ? `${d.temperature_celsius}°C` : '--'}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Chart */}
      <LiveAreaChart dataPoints={historyArr} />

      {/* Core Grid */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
            <Cpu size={13} className="text-indigo-500" />
            各核心使用率 ({d.per_core.length} 核心)
          </span>
          <span className="text-[9px] text-gray-400">每 2.5 秒刷新</span>
        </div>
        <div className={`grid gap-1.5 ${d.per_core.length <= 8 ? 'grid-cols-4' : d.per_core.length <= 12 ? 'grid-cols-5' : 'grid-cols-6'}`}>
          {d.per_core.map(core => (
            <CoreBar key={core.core_id} core={core} />
          ))}
        </div>
      </div>

      {/* Top Processes */}
      {d.top_processes.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
              <MemoryStick size={13} className="text-purple-500" />
              CPU 占用 Top 进程
              {expandedProcesses && allProcesses && (
                <span className="text-[9px] text-gray-400 font-normal ml-1">({allProcesses.length} 个进程)</span>
              )}
            </span>
            <button
              onClick={toggleExpandProcesses}
              disabled={processesLoading}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                expandedProcesses
                  ? 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              } ${processesLoading ? 'opacity-60 cursor-wait' : ''}`}
            >
              {processesLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                  加载中...
                </>
              ) : expandedProcesses ? (
                <>
                  <ChevronDown size={11} className="rotate-180" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown size={11} />
                  展开全部
                </>
              )}
            </button>
          </div>
          <div className={`rounded-xl overflow-hidden border border-gray-100 ${expandedProcesses ? 'max-h-[400px] overflow-y-auto' : ''}`}>
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50/95 backdrop-blur-sm">
                  <th className="py-1.5 px-3 text-left font-medium text-gray-500">#</th>
                  <th className="py-1.5 px-2 text-left font-medium text-gray-500">进程名称</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-500">CPU</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-500">内存</th>
                  <th className="py-1.5 px-2 text-right font-medium text-gray-500 hidden sm:table-cell">PID</th>
                </tr>
              </thead>
              <tbody>
                {(expandedProcesses && allProcesses ? allProcesses : d.top_processes).map((proc, i) => {
                  const pcfg = getLoadColor(proc.cpu_percent);
                  return (
                    <tr key={`${proc.pid}-${i}`} className="border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                      <td className="py-1.5 px-3 font-mono text-gray-400">{i + 1}</td>
                      <td className="py-1.5 px-2 font-medium text-gray-700 truncate max-w-[160px]" title={proc.name}>{proc.name}</td>
                      <td className="py-1.5 px-2 text-right">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${pcfg.bg} ${pcfg.text}`}>
                          {proc.cpu_percent}%
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-gray-500">{proc.memory_percent}%</td>
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