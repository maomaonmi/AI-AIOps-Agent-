import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cpu, Thermometer, Zap, MemoryStick, Activity,
  Gauge, Fan, AlertTriangle, CheckCircle2, XCircle,
  Server, Monitor, Wifi, Radio, Clock,
  HardDrive, TrendingUp, ArrowUp, ArrowDown, Info,
} from 'lucide-react';
import ReactEChartsCore from 'echarts-for-react';
import * as echarts from 'echarts';

interface GPUMemoryInfo {
  total_mb: number;
  used_mb: number;
  free_mb: number;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

interface GPUTemperatureInfo {
  gpu_celsius: number;
  max_threshold: number;
  slowdown_threshold: number;
  shutdown_threshold: number;
}

interface GPUClockInfo {
  graphics_mhz: number;
  sm_mhz: number;
  mem_mhz: number;
  video_mhz: number;
}

interface GPUPowerInfo {
  current_watts: number;
  limit_watts: number;
  usage_percent: number;
}

interface GPUUtilization {
  gpu_percent: number;
  memory_percent: number;
  encoder_percent: number;
  decoder_percent: number;
}

interface GPUProcessInfo {
  pid: number;
  name: string;
  used_memory_mb: number;
  used_memory_str: string;
}

interface GPUDeviceInfo {
  index: number;
  name: string;
  uuid: string;
  pci_bus_id: string;
  driver_version: string;
  cuda_version: string;
  memory: GPUMemoryInfo;
  temperature: GPUTemperatureInfo;
  clocks: GPUClockInfo;
  power: GPUPowerInfo;
  utilization: GPUUtilization;
  processes: GPUProcessInfo[];
  fan_speed_percent: number;
  performance_state: string;
  display_active: boolean;
  persistence_mode: boolean;
  compute_mode: string;
  ecc_mode: boolean;
  total_ecc_errors: number;
  is_available: boolean;
}

interface GPUInfoResponse {
  status: string;
  has_gpu: boolean;
  devices: GPUDeviceInfo[];
  timestamp: string;
}

const MAX_HISTORY = 90;

interface HistoryPoint {
  time: string;
  gpu_util: number;
  mem_util: number;
  temp: number;
  power: number;
  mem_used_gb: number;
}

function getTempColor(celsius: number): { bg: string; text: string; border: string } {
  if (celsius >= 85) return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' };
  if (celsius >= 70) return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' };
  if (celsius >= 55) return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' };
  return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
}

function getUtilColor(pct: number): { color: string; areaColor: string } {
  if (pct >= 85) return { color: '#ef4444', areaColor: 'rgba(239,68,68,0.18)' };
  if (pct >= 60) return { color: '#f59e0b', areaColor: 'rgba(245,158,11,0.16)' };
  return { color: '#10b981', areaColor: 'rgba(16,185,129,0.14)' };
}

export default function GPUMonitor() {
  const [gpuData, setGpuData] = useState<GPUInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const echartsRef = useRef<any>(null);

  const fetchGPU = useCallback(async () => {
    try {
      const res = await fetch('/api/gpu/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GPUInfoResponse = await res.json();
      if (data.status === 'error') throw new Error((data as any).message || 'Unknown error');
      setGpuData(data);

      if (data.has_gpu && data.devices.length > 0) {
        const dev = data.devices[0];
        if (dev.is_available) {
          const now = new Date();
          const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          setHistory(prev => {
            const pt: HistoryPoint = {
              time: ts,
              gpu_util: dev.utilization.gpu_percent,
              mem_util: dev.utilization.memory_percent,
              temp: dev.temperature.gpu_celsius,
              power: dev.power.current_watts,
              mem_used_gb: dev.memory.used_gb,
            };
            const next = [...prev, pt];
            if (next.length > MAX_HISTORY) return next.slice(-MAX_HISTORY);
            return next;
          });
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取GPU数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGPU(); const iv = setInterval(fetchGPU, 1500); return () => clearInterval(iv); }, [fetchGPU]);

  if (loading && !gpuData) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <div className="relative">
          <Cpu size={36} className="text-violet-300 animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-violet-400/20 animate-ping" />
        </div>
        <span className="text-sm text-gray-400">正在检测 GPU 状态...</span>
      </div>
    );
  }

  if (error && !gpuData) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <XCircle size={32} className="text-red-300" />
        <span className="text-sm text-red-500">{error}</span>
        <button onClick={fetchGPU} className="mt-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100">重试</button>
      </div>
    );
  }

  if (!gpuData || !gpuData.has_gpu) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <Cpu size={36} className="text-gray-300" />
        <span className="text-sm font-medium text-gray-500">未检测到 NVIDIA GPU</span>
        <span className="text-xs text-gray-400">请确认已安装 NVIDIA 驱动</span>
      </div>
    );
  }

  const dev = gpuData.devices.find(d => d.is_available);
  if (!dev) return null;

  const tempStyle = getTempColor(dev.temperature.gpu_celsius);
  const isHighTemp = dev.temperature.gpu_celsius >= 80;
  const isHighPower = dev.power.limit_watts > 0 && dev.power.usage_percent >= 80;
  const hasAlert = isHighTemp || isHighPower || dev.total_ecc_errors > 0;

  const chartOption = history.length < 2 ? {} : {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      borderRadius: 12,
      padding: [12, 16],
      textStyle: { color: '#334155', fontSize: 11, fontFamily: 'inherit' },
      formatter: (params: any) => {
        const pts = Array.isArray(params) ? params : [params];
        const time = pts[0]?.axisValue || '';
        let html = `<div style="font-weight:700;margin-bottom:6px;color:#64748b;">${time}</div>`;
        pts.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
            <span style="color:#64748b;">${p.seriesName}:</span>
            <span style="font-weight:700;color:#1e293b;">${typeof p.value === 'number' ? p.value.toFixed(1) : p.value}${p.seriesName.includes('温度') ? '°C' : p.seriesName.includes('功耗') ? ' W' : '%'}</span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 12, itemHeight: 8, itemGap: 20,
    },
    grid: { top: 12, right: 16, bottom: 34, left: 44 },
    xAxis: {
      type: 'category',
      data: history.map(h => h.time),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 9, interval: Math.max(Math.floor(history.length / 7), 1) },
    },
    yAxis: [
      {
        type: 'value',
        name: '% / °C',
        nameTextStyle: { color: '#94a3b8', fontSize: 9 },
        max: 100,
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 9, formatter: '{value}' },
      },
      {
        type: 'value',
        name: 'W',
        nameTextStyle: { color: '#94a3b8', fontSize: 9 },
        splitLine: { show: false },
        axisLabel: { color: '#f59e0b', fontSize: 9, formatter: '{value}W' },
      },
    ],
    series: [
      {
        name: 'GPU 使用率',
        type: 'line',
        data: history.map(h => h.gpu_util),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#8b5cf6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139,92,246,0.22)' },
            { offset: 1, color: 'rgba(139,92,246,0.01)' },
          ]),
        },
      },
      {
        name: '显存使用率',
        type: 'line',
        data: history.map(h => h.mem_util),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#06b6d4' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(6,182,212,0.18)' },
            { offset: 1, color: 'rgba(6,182,212,0.01)' },
          ]),
        },
      },
      {
        name: '温度',
        type: 'line',
        yAxisIndex: 0,
        data: history.map(h => h.temp),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#ef4444', type: 'dashed' },
      },
      {
        name: '功耗',
        type: 'line',
        yAxisIndex: 1,
        data: history.map(h => h.power),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#f59e0b' },
      },
    ],
  };

  return (
    <div className="space-y-4">

      {/* Header + Alert */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Cpu size={18} className="text-violet-500" />
            GPU
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{dev.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dev.is_available ? (
            <CheckCircle2 size={14} className="text-emerald-500" />
          ) : (
            <XCircle size={14} className="text-red-400" />
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${dev.is_available ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {dev.is_available ? '正常' : '离线'}
          </span>
        </div>
      </div>

      {/* Temperature/Power Alert Banner */}
      {hasAlert && (
        <div className={`rounded-xl px-4 py-3 border ${isHighTemp ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} flex items-center gap-2`}>
          <AlertTriangle size={15} className={isHighTemp ? 'text-red-500' : 'text-amber-500'} />
          <span className={`text-xs font-medium ${isHighTemp ? 'text-red-700' : 'text-amber-700'}`}>
            {isHighTemp && `⚠ GPU 温度过高: ${dev.temperature.gpu_celsius}°C（上限 ${dev.temperature.max_threshold}°C）`}
            {!isHighTemp && isHighPower && `⚠ 功耗偏高: ${dev.power.current_watts}W / ${dev.power.limit_watts}W (${dev.power.usage_percent}%)`}
            {dev.total_ecc_errors > 0 && ` | ECC 错误: ${dev.total_ecc_errors}`}
          </span>
        </div>
      )}

      {/* Core Metrics Row */}
      <div className="grid grid-cols-4 gap-3">

        {/* Utilization */}
        <div className="col-span-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-violet-700 flex items-center gap-1">
              <Activity size={13} /> 利用率
            </span>
            <span className="text-[9px] text-violet-400">Utilization</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums" style={{ color: getUtilColor(dev.utilization.gpu_percent).color }}>
              {dev.utilization.gpu_percent}
            </span>
            <span className="text-sm text-violet-400">%</span>
          </div>
          <div className="mt-2 w-full bg-white/60 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(dev.utilization.gpu_percent, 100)}%`,
                backgroundColor: getUtilColor(dev.utilization.gpu_percent).color,
              }}
            />
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1 text-cyan-600">
              <MemoryStick size={10} /> 显存: {dev.utilization.memory_percent}%
            </div>
            {(dev.utilization.encoder_percent > 0 || dev.utilization.decoder_percent > 0) && (
              <div className="flex items-center gap-1 text-indigo-500">
                <Monitor size={10} /> 编码:{dev.utilization.encoder_percent}% 解码:{dev.utilization.decoder_percent}%
              </div>
            )}
          </div>
        </div>

        {/* Temperature */}
        <div className={`rounded-xl ${tempStyle.bg} border ${tempStyle.border} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-semibold ${tempStyle.text} flex items-center gap-1`}>
              <Thermometer size={13} /> 温度
            </span>
            <span className={`text-[9px] opacity-60 ${tempStyle.text}`}>Temperature</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-black tabular-nums ${tempStyle.text}`}>
              {dev.temperature.gpu_celsius}
            </span>
            <span className={`text-sm ${tempStyle.text}`}>°C</span>
          </div>
          {dev.temperature.max_threshold > 0 && (
            <div className={`mt-1.5 text-[9px] ${tempStyle.text} opacity-70`}>
              上限 {dev.temperature.max_threshold}°C · 慢速 {dev.temperature.slowdown_threshold}°C
            </div>
          )}
        </div>

        {/* Power */}
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
              <Zap size={13} /> 功耗
            </span>
            <span className="text-[9px] text-amber-400">Power</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tabular-nums text-amber-600">
              {dev.power.current_watts > 0 ? dev.power.current_watts.toFixed(1) : '--'}
            </span>
            <span className="text-sm text-amber-400">W</span>
          </div>
          {dev.power.limit_watts > 0 && (
            <div className="mt-1.5 w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-700"
                style={{ width: `${Math.min(dev.power.usage_percent, 100)}%` }}
              />
            </div>
          )}
          {dev.power.limit_watts > 0 && (
            <div className="mt-0.5 text-[9px] text-amber-500/70">{dev.power.limit_watts}W 上限 ({dev.power.usage_percent}%)</div>
          )}
        </div>
      </div>

      {/* Memory Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 border border-cyan-100 p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-cyan-700 flex items-center gap-1">
              <HardDrive size={12} /> 专用显存
            </span>
            <span className="text-[9px] text-cyan-400">Dedicated VRAM</span>
          </div>
          <div className="text-lg font-bold text-cyan-700 tabular-nums">
            {dev.memory.used_gb}/{dev.memory.total_gb} GB
          </div>
          <div className="mt-1.5 w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-700"
              style={{ width: `${Math.min(dev.memory.percent, 100)}%` }}
            />
          </div>
          <div className="mt-0.5 text-[9px] text-cyan-500/70">{dev.memory.percent}% 已用</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-teal-700 flex items-center gap-1">
              <Server size={12} /> GPU 内存总量
            </span>
            <span className="text-[9px] text-teal-400">Total Memory</span>
          </div>
          <div className="text-lg font-bold text-teal-700 tabular-nums">
            {dev.memory.used_gb} GB
          </div>
          <div className="text-[9px] text-teal-500/70 mt-1">总计 {dev.memory.total_gb} GB · 可用 {dev.memory.free_gb} GB</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-indigo-700 flex items-center gap-1">
              <Gauge size={12} /> 频率
            </span>
            <span className="text-[9px] text-indigo-400">Clocks</span>
          </div>
          <div className="space-y-0.5 mt-1">
            <div className="text-xs font-bold text-indigo-700 tabular-nums">
              Graphics <span className="font-normal">{dev.clocks.graphics_mhz > 0 ? `${dev.clocks.graphics_mhz} MHz` : '--'}</span>
            </div>
            <div className="text-[10px] text-indigo-500 tabular-nums">
              SM {dev.clocks.sm_mhz > 0 ? `${dev.clocks.sm_mhz} MHz` : '--'} · Mem {dev.clocks.mem_mhz > 0 ? `${dev.clocks.mem_mhz} MHz` : '--'}
            </div>
          </div>
          <div className="mt-1 text-[9px] text-indigo-400/70">P-State: {dev.performance_state}</div>
        </div>
      </div>

      {/* Real-time Chart */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-violet-500" />
            实时性能图谱
          </span>
          <span className="text-[9px] text-gray-400">每 1.5 秒刷新 · 共 {history.length} 点</span>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          {history.length >= 2 ? (
            <ReactEChartsCore
              ref={echartsRef}
              echarts={echarts}
              option={chartOption}
              style={{ height: 220, width: '100%' }}
              notMerge={true}
              lazyUpdate={true}
            />
          ) : (
            <div className="flex items-center justify-center h-[220px] text-gray-300 text-xs">
              <Activity size={14} className="mr-2 animate-pulse" />
              收集数据中...
            </div>
          )}
        </div>
      </div>

      {/* Detail Info Grid - matches screenshot layout */}
      <div className="grid grid-cols-4 gap-x-4 gap-y-2.5 text-[11px]">
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">驱动程序版本</span>
          <span className="font-semibold text-gray-800">{dev.driver_version}</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">CUDA 版本</span>
          <span className="font-semibold text-gray-800">{dev.cuda_version}</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">PCI 总线位置</span>
          <span className="font-mono text-[10px] font-semibold text-gray-800">{dev.pci_bus_id || '--'}</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">计算模式</span>
          <span className="font-semibold text-gray-800">{dev.compute_mode}</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">显示输出</span>
          <span className={`font-semibold ${dev.display_active ? 'text-emerald-600' : 'text-gray-400'}`}>
            {dev.display_active ? '活跃' : '未连接'}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">持久模式</span>
          <span className={`font-semibold ${dev.persistence_mode ? 'text-emerald-600' : 'text-gray-400'}`}>
            {dev.persistence_mode ? '开启' : '关闭'}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">ECC 校验</span>
          <span className={`font-semibold ${dev.ecc_mode ? 'text-emerald-600' : 'text-gray-400'}`}>
            {dev.ecc_mode ? '启用' : '禁用'}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-gray-400 block">风扇转速</span>
          <span className="font-semibold text-gray-800">
            {dev.fan_speed_percent > 0 ? `${dev.fan_speed_percent}%` : '自动'}
          </span>
        </div>
      </div>

      {/* Processes using GPU */}
      {dev.processes.length > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Server size={13} className="text-gray-500" />
            <span className="text-[11px] font-semibold text-gray-700">GPU 进程占用</span>
            <span className="text-[9px] text-gray-400 ml-auto">{dev.processes.length} 个进程</span>
          </div>
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
            {dev.processes.map((proc, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-gray-400 shrink-0">PID {proc.pid}</span>
                  <span className="font-medium text-gray-700 truncate">{proc.name || 'Unknown'}</span>
                </div>
                <span className="shrink-0 font-semibold text-violet-600 tabular-nums">{proc.used_memory_str}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}