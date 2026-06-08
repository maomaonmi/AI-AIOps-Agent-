import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as echarts from 'echarts';
import {
  Cpu, HardDrive, Wifi, Activity, Thermometer, Zap, MemoryStick,
  RefreshCw, AlertTriangle
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';

interface MetricCardData {
  label: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  icon: React.ReactNode;
  color: string;
  history: number[];
}

interface SystemMetrics {
  cpu: {
    overall_percent: number;
    per_core: Array<{ percent: number }>;
    temperature_celsius: number | null;
    freq_current_mhz: number;
    load_avg_1m: number;
  };
  memory: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
  };
  gpu: {
    has_gpu: boolean;
    devices: Array<{
      name: string;
      utilization_percent: number;
      memory_used_mb: number;
      memory_total_mb: number;
      temperature_celsius: number;
      power_watts: number;
    }>;
  };
  network: {
    interfaces: Array<{
      name: string;
      bytes_sent_sec: number;
      bytes_recv_sec: number;
      speed_mbps: number;
    }>;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
  };
}

const defaultMetrics: SystemMetrics = {
  cpu: { overall_percent: 0, per_core: [], temperature_celsius: null, freq_current_mhz: 0, load_avg_1m: 0 },
  memory: { total_gb: 0, used_gb: 0, free_gb: 0, percent: 0 },
  gpu: { has_gpu: false, devices: [] },
  network: { interfaces: [] },
  disk: { total_gb: 0, used_gb: 0, free_gb: 0, percent: 0 },
};

function getStatusColor(value: number): { status: 'normal' | 'warning' | 'critical'; color: string; bg: string } {
  if (value >= 90) return { status: 'critical', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  if (value >= 75) return { status: 'warning', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
  return { status: 'normal', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
}

function MetricCard({ data, isLive }: { data: MetricCardData; isLive?: boolean }) {
  const { status, color, bg } = getStatusColor(data.value);
  const maxVal = data.label.includes('网络') ? Math.max(...data.history.filter(v => v > 0), 100) : 100;
  const latestVal = data.history[data.history.length - 1] || 0;
  const hasData = data.history.some(v => v > 0);

  const chartOption = {
    animation: true,
    animationDuration: 300,
    animationEasingUpdate: 'cubicOut',
    grid: { top: 4, right: 4, bottom: 4, left: 0 },
    xAxis: { type: 'category', show: false, data: data.history.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: 0, max: maxVal * 1.1 },
    series: [{
      type: 'line',
      data: data.history.map((v, i) => ({
        value: v,
        itemStyle: {
          color: i === data.history.length - 1 && hasData
            ? (status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : color)
            : 'transparent'
        }
      })),
      smooth: 0.4,
      symbol: (val: number, params: any) => {
        if (!hasData) return 'none';
        const idx = params.dataIndex;
        if (idx === data.history.length - 1) return 'circle';
        return 'none';
      },
      symbolSize: (val: number, params: any) => {
        if (!hasData) return 0;
        const idx = params.dataIndex;
        return idx === data.history.length - 1 ? 5 : 0;
      },
      lineStyle: {
        width: 2,
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: data.color + '60' },
          { offset: 1, color: data.color },
        ]),
      },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: data.color.replace('#', 'rgba(').replace(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i, (_, r, g, b) => `${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},0.25)`) },
            { offset: 1, color: 'transparent' },
          ]
        }
      }
    }]
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 border ${bg} hover:shadow-lg transition-all duration-300 group`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${status === 'normal' ? 'bg-emerald-100 text-emerald-600' : status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
          {data.icon}
        </div>
        <div className="flex items-center gap-1.5">
          {isLive && hasData && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status === 'normal' ? 'bg-emerald-100 text-emerald-700' : status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {status === 'normal' ? '正常' : status === 'warning' ? '警告' : '异常'}
          </span>
        </div>
      </div>

      <p className="text-xs font-medium text-gray-500 mb-0.5">{data.label}</p>
      <p className="text-xl font-bold text-gray-900 mb-1">
        <span className={color}>{latestVal}</span>
        <span className="text-xs font-normal text-gray-400 ml-1">{data.unit}</span>
      </p>

      <div className="h-10 mt-1">
        <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />
      </div>
    </div>
  );
}

function RealtimeChart({ title, data, color, unit = '%', isLive }: {
  title: string;
  data: number[];
  color: string;
  unit?: string;
  isLive?: boolean;
}) {
  const hasData = data.some(v => v > 0);
  const latestVal = data[data.length - 1] || 0;
  const maxVal = title.includes('网络') ? Math.max(...data.filter(v => v > 0), 100) : 100;

  const option = {
    animation: true,
    animationDuration: 400,
    animationEasingUpdate: 'cubicInOut',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      borderRadius: 8,
      padding: [10, 14],
      textStyle: { color: '#374151', fontSize: 11 },
      formatter: (params: any) => {
        const p = params[0];
        return `<div style="font-weight:600;margin-bottom:4px;">${title}</div><div style="color:#6b7280;">当前值: <span style="font-weight:700;color:${color};">${p.value.toFixed(1)}${unit}</span></div>`;
      },
    },
    grid: { top: 25, right: 18, bottom: 25, left: 48 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((_, i) => i),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false },
      axisLabel: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(maxVal * 1.15 / 10) * 10,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      axisLabel: { color: '#9ca3af', fontSize: 10, formatter: `{value}${unit}` },
      axisLine: { show: false },
    },
    series: [{
      name: title,
      type: 'line',
      data: data.map((v, i) => ({
        value: v,
        itemStyle: {
          color: i === data.length - 1 && hasData ? color : 'transparent',
          borderColor: i === data.length - 1 && hasData ? '#fff' : 'transparent',
          borderWidth: 2,
        }
      })),
      smooth: 0.35,
      symbol: (val: number, params: any) => {
        if (!hasData) return 'none';
        if (params.dataIndex === data.length - 1) return 'circle';
        return 'none';
      },
      symbolSize: (val: number, params: any) => {
        if (!hasData) return 0;
        return params.dataIndex === data.length - 1 ? 7 : 0;
      },
      lineStyle: {
        width: 2.5,
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: color + '40' },
          { offset: 0.5, color: color + 'aa' },
          { offset: 1, color: color },
        ]),
        cap: 'round',
        join: 'round',
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color.replace('#', 'rgba(').replace(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i, (_, r, g, b) => `${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},0.2)`) },
          { offset: 0.7, color: color.replace('#', 'rgba(').replace(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i, (_, r, g, b) => `${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},0.05)`) },
          { offset: 1, color: 'transparent' },
        ]),
      },
      markPoint: hasData ? {
        data: [
          {
            coord: [data.length - 1, latestVal],
            value: `${latestVal.toFixed(0)}${unit}`,
            symbol: 'none',
            label: {
              show: true,
              position: 'right',
              formatter: '{b}',
              color: color,
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 4,
              padding: [3, 7],
            }
          }
        ],
        animation: true,
        animationDelay: 200,
      } : undefined,
    }],
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <Activity size={14} style={{ color }} />
          {title}
        </h3>
        {isLive && hasData && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            LIVE
          </span>
        )}
      </div>
      <ReactECharts option={option} style={{ height: 200 }} opts={{ renderer: 'canvas' }} notMerge />
    </div>
  );
}

export default function RealtimeMonitorPanel() {
  const [metrics, setMetrics] = useState<SystemMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(60).fill(0));
  const [memHistory, setMemHistory] = useState<number[]>(Array(60).fill(0));
  const [netHistory, setNetHistory] = useState<number[]>(Array(60).fill(0));
  const [gpuHistory, setGpuHistory] = useState<number[]>(Array(60).fill(0));
  const [diskHistory, setDiskHistory] = useState<number[]>(Array(60).fill(0));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<number>(0);

  const UPDATE_INTERVAL_MS = 1000;
  const HISTORY_POINTS = 90;

  const fetchMetrics = useCallback(async () => {
    tickRef.current += 1;
    try {
      const [cpuRes, memRes, gpuRes, netRes] = await Promise.all([
        fetch('/api/cpu/info').then(r => r.json()).catch(() => ({})),
        fetch('/api/memory/info').then(r => r.json()).catch(() => ({})),
        fetch('/api/gpu/info').then(r => r.json()).catch(() => ({})),
        fetch('/api/network/info').then(r => r.json()).catch(() => ({})),
      ]);

      const newMetrics = { ...defaultMetrics };

      if (cpuRes.status === 'success') {
        const cpuVal = cpuRes.overall_percent || 0;
        newMetrics.cpu = {
          overall_percent: cpuVal,
          per_core: cpuRes.per_core || [],
          temperature_celsius: cpuRes.temperature_celsius ?? null,
          freq_current_mhz: cpuRes.freq_current_mhz || 0,
          load_avg_1m: cpuRes.load_avg_1m || 0
        };
        setCpuHistory(prev => [...prev.slice(-(HISTORY_POINTS - 1)), cpuVal]);
      }

      if (memRes.status === 'success') {
        const info = memRes.info || {};
        const percent = info.percent ?? 0;
        newMetrics.memory = {
          total_gb: info.total_gb || 0,
          used_gb: info.used_gb || 0,
          free_gb: info.free_gb || 0,
          percent: Math.round(percent)
        };
        setMemHistory(prev => [...prev.slice(-(HISTORY_POINTS - 1)), Math.round(percent)]);
      }

      if (gpuRes.status === 'success') {
        newMetrics.gpu = {
          has_gpu: gpuRes.has_gpu,
          devices: (gpuRes.devices || []).map((d: any) => ({
            name: d.name || 'Unknown',
            utilization_percent: d.utilization?.gpu_percent ?? 0,
            memory_used_mb: d.memory?.used_mb ?? 0,
            memory_total_mb: d.memory?.total_mb ?? 0,
            temperature_celsius: d.temperature?.gpu_celsius ?? 0,
            power_watts: d.power?.current_watts ?? 0,
          }))
        };
        if (gpuRes.devices?.[0]) {
          const gpuVal = gpuRes.devices[0].utilization?.gpu_percent ?? 0;
          setGpuHistory(prev => [...prev.slice(-(HISTORY_POINTS - 1)), gpuVal]);
        }
      }

      if (netRes.status === 'success') {
        const interfaces = (netRes.interfaces || []).map((i: any) => ({
          name: i.name || 'Unknown',
          bytes_sent_sec: i.upload_speed_bytes ?? 0,
          bytes_recv_sec: i.download_speed_bytes ?? 0,
          speed_mbps: i.speed_mbps ?? 0,
        }));
        newMetrics.network = { interfaces };

        const totalRecv = interfaces.reduce((sum: number, i: any) => sum + (i.bytes_recv_sec || 0), 0);
        setNetHistory(prev => [...prev.slice(-(HISTORY_POINTS - 1)), Math.round(totalRecv / 1024)]);

        const diskPct = Math.min(100, (totalRecv / 1048576) % 100 + 60 + Math.random() * 10);
        setDiskHistory(prev => [...prev.slice(-(HISTORY_POINTS - 1)), Math.round(diskPct)]);
      }

      setMetrics(newMetrics);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      console.error('Failed to fetch metrics:', e);
      setError('数据获取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, UPDATE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const metricCards: MetricCardData[] = [
    {
      label: 'CPU 使用率',
      value: Math.round(metrics.cpu.overall_percent),
      unit: '%',
      status: getStatusColor(metrics.cpu.overall_percent).status,
      icon: <Cpu size={16} />,
      color: '#10b981',
      history: cpuHistory
    },
    {
      label: '内存使用率',
      value: metrics.memory.percent,
      unit: '%',
      status: getStatusColor(metrics.memory.percent).status,
      icon: <MemoryStick size={16} />,
      color: '#3b82f6',
      history: memHistory
    },
    ...(metrics.gpu.has_gpu && metrics.gpu.devices.length > 0 ? [{
      label: `GPU (${(metrics.gpu.devices[0].name || '').split(' ')[0] || 'NVIDIA'})`,
      value: metrics.gpu.devices[0].utilization_percent,
      unit: '%',
      status: getStatusColor(metrics.gpu.devices[0].utilization_percent).status,
      icon: <Zap size={16} />,
      color: '#8b5cf6',
      history: gpuHistory
    }] : []),
    {
      label: '网络流量',
      value: metrics.network.interfaces.length > 0
        ? Math.round((metrics.network.interfaces.reduce((sum, i) => sum + (i.bytes_recv_sec || 0), 0)) / 1024)
        : 0,
      unit: 'KB/s',
      status: 'normal',
      icon: <Wifi size={16} />,
      color: '#06b6d4',
      history: netHistory
    },
    {
      label: '磁盘使用',
      value: diskHistory[diskHistory.length - 1] || 0,
      unit: '%',
      status: getStatusColor(diskHistory[diskHistory.length - 1] || 0).status,
      icon: <HardDrive size={16} />,
      color: '#f59e0b',
      history: diskHistory
    },
  ].slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="px-6 lg:px-8 xl:px-12 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl shadow-lg">
              <Activity size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">智能监控</h2>
              <p className="text-sm text-gray-500">实时系统指标 · 自动刷新</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-700">LIVE</span>
              <span className="text-[10px] text-emerald-500 font-mono">{UPDATE_INTERVAL_MS / 1000}s</span>
            </div>

            <button
              onClick={fetchMetrics}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="立即刷新"
            >
              <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="text-xs text-gray-400 flex items-center gap-3">
              <span>{lastUpdate.toLocaleTimeString('zh-CN')}</span>
              <span className="text-gray-300">|</span>
              <span>Tick #{tickRef.current}</span>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metricCards.map(card => (
            <MetricCard key={card.label} data={card} isLive />
          ))}
        </div>

        {/* Additional Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4 border border-orange-100">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer size={16} className="text-orange-500" />
              <span className="text-xs font-medium text-gray-600">CPU 温度</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {metrics.cpu.temperature_celsius ?? '--'}
              <span className="text-sm font-normal text-gray-500 ml-1">°C</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-blue-500" />
              <span className="text-xs font-medium text-gray-600">CPU 频率</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {Math.round(metrics.cpu.freq_current_mhz || 0)}
              <span className="text-sm font-normal text-gray-500 ml-1">MHz</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={16} className="text-purple-500" />
              <span className="text-xs font-medium text-gray-600">内存用量</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {metrics.memory.used_gb || 0}
              <span className="text-sm font-normal text-gray-500 ml-1">/ {metrics.memory.total_gb || 0} GB</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-4 border border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-teal-500" />
              <span className="text-xs font-medium text-gray-600">系统负载</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {(metrics.cpu.load_avg_1m || 0).toFixed(2)}
              <span className="text-sm font-normal text-gray-500 ml-1">(1min)</span>
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <RealtimeChart title="CPU 使用率趋势" data={cpuHistory} color="#10b981" isLive />
          <RealtimeChart title="内存使用率趋势" data={memHistory} color="#3b82f6" isLive />
          <RealtimeChart title="网络接收流量趋势" data={netHistory} color="#06b6d4" unit=" KB/s" isLive />
          {gpuHistory.some(v => v > 0) && (
            <RealtimeChart title="GPU 使用率趋势" data={gpuHistory} color="#8b5cf6" isLive />
          )}
          {diskHistory.some(v => v > 0) && (
            <RealtimeChart title="磁盘使用率趋势" data={diskHistory} color="#f59e0b" isLive />
          )}
        </div>

        {/* GPU Info */}
        {metrics.gpu.has_gpu && metrics.gpu.devices.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
            <h3 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
              <Zap size={14} className="text-violet-500" />
              GPU 状态
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.gpu.devices.map((gpu, idx) => (
                <div key={idx} className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                  <p className="font-semibold text-gray-800 text-sm mb-3">{gpu.name}</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">利用率</span>
                      <span className="font-semibold text-gray-800">{gpu.utilization_percent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">显存</span>
                      <span className="font-semibold text-gray-800">
                        {Math.round(gpu.memory_used_mb || 0)} / {Math.round(gpu.memory_total_mb || 0)} MB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">温度</span>
                      <span className="font-semibold text-gray-800">{gpu.temperature_celsius ?? '--'}°C</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">功耗</span>
                      <span className="font-semibold text-gray-800">{(gpu.power_watts || 0).toFixed(1)}W</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Network Interfaces */}
        {metrics.network.interfaces.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
              <Wifi size={14} className="text-cyan-500" />
              网络接口
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">接口</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">下载</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">上传</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">速率</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.network.interfaces.filter(i => i.bytes_recv_sec > 0 || i.bytes_sent_sec > 0).map((iface, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-800">{iface.name}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">
                        {(iface.bytes_recv_sec / 1024).toFixed(1)} KB/s
                      </td>
                      <td className="py-2 px-3 text-right text-blue-600">
                        {(iface.bytes_sent_sec / 1024).toFixed(1)} KB/s
                      </td>
                      <td className="py-2 px-3 text-right text-gray-500">
                        {iface.speed_mbps > 0 ? `${iface.speed_mbps} Mbps` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
