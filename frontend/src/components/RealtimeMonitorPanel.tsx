import React, { useState, useEffect, useCallback, useRef } from 'react';
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

function MetricCard({ data }: { data: MetricCardData }) {
  const { status, color, bg } = getStatusColor(data.value);
  const maxVal = data.label.includes('网络') ? Math.max(...data.history, 100) : 100;

  const chartOption = {
    grid: { top: 5, right: 5, bottom: 5, left: 0 },
    xAxis: { type: 'category', show: false, data: data.history.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: 0, max: maxVal },
    series: [{
      type: 'line',
      data: data.history,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: data.color },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: data.color.replace(')', ',0.3)').replace('rgb', 'rgba').replace('#10b981', 'rgba(16,185,129,0.3)').replace('#3b82f6', 'rgba(59,130,246,0.3)').replace('#8b5cf6', 'rgba(139,92,246,0.3)').replace('#06b6d4', 'rgba(6,182,212,0.3)') },
            { offset: 1, color: 'transparent' }
          ]
        }
      }
    }]
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 border ${bg} hover:shadow-lg transition-all duration-300`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${status === 'normal' ? 'bg-emerald-100 text-emerald-600' : status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
          {data.icon}
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status === 'normal' ? 'bg-emerald-100 text-emerald-700' : status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
          {status === 'normal' ? '正常' : status === 'warning' ? '警告' : '异常'}
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-800 mb-1">{data.label}</p>
      <p className="text-2xl font-bold text-gray-900 mb-2">
        <span className={color}>{data.value}</span>
        <span className="text-sm font-normal text-gray-500 ml-1">{data.unit}</span>
      </p>

      <div className="h-12 mt-2">
        <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
      </div>
    </div>
  );
}

function RealtimeChart({ title, data, color, unit = '%' }: {
  title: string;
  data: number[];
  color: string;
  unit?: string;
}) {
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      textStyle: { color: '#374151', fontSize: 12 }
    },
    grid: { top: 30, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((_, i) => `${(data.length - i) * 3}s`),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      axisLabel: { color: '#9ca3af', fontSize: 11, formatter: `{value}${unit}` }
    },
    series: [{
      name: title,
      type: 'line',
      data: data,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2.5, color },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color.replace('#10b981', 'rgba(16,185,129,0.25)').replace('#3b82f6', 'rgba(59,130,246,0.25)') },
            { offset: 1, color: 'transparent' }
          ]
        }
      }
    }]
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
        <Activity size={14} className={color === '#10b981' ? 'text-emerald-500' : 'text-blue-500'} />
        {title}
      </h3>
      <ReactECharts option={option} style={{ height: 220 }} opts={{ renderer: 'svg' }} notMerge />
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const [cpuRes, memRes, gpuRes, netRes] = await Promise.all([
        fetch('/api/cpu/info').then(r => r.json()),
        fetch('/api/memory/info').then(r => r.json()),
        fetch('/api/gpu/info').then(r => r.json()),
        fetch('/api/network/info').then(r => r.json())
      ]);

      const newMetrics = { ...defaultMetrics };

      if (cpuRes.status === 'success') {
        newMetrics.cpu = {
          overall_percent: cpuRes.overall_percent || 0,
          per_core: cpuRes.per_core || [],
          temperature_celsius: cpuRes.temperature_celsius ?? null,
          freq_current_mhz: cpuRes.freq_current_mhz || 0,
          load_avg_1m: cpuRes.load_avg_1m || 0
        };
        setCpuHistory(prev => [...prev.slice(-59), cpuRes.overall_percent || 0]);
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
        setMemHistory(prev => [...prev.slice(-59), Math.round(percent)]);
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
        setNetHistory(prev => [...prev.slice(-59), Math.round(totalRecv / 1024)]);
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
    intervalRef.current = setInterval(fetchMetrics, 3000);
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
      icon: <Cpu size={18} />,
      color: '#10b981',
      history: cpuHistory
    },
    {
      label: '内存使用率',
      value: metrics.memory.percent,
      unit: '%',
      status: getStatusColor(metrics.memory.percent).status,
      icon: <MemoryStick size={18} />,
      color: '#3b82f6',
      history: memHistory
    },
    ...(metrics.gpu.has_gpu && metrics.gpu.devices.length > 0 ? [{
      label: `GPU (${metrics.gpu.devices[0].name?.split(' ')[0] || 'NVIDIA'})`,
      value: metrics.gpu.devices[0].utilization_percent,
      unit: '%',
      status: getStatusColor(metrics.gpu.devices[0].utilization_percent).status,
      icon: <Zap size={18} />,
      color: '#8b5cf6',
      history: Array(60).fill(metrics.gpu.devices[0].utilization_percent)
    }] : []),
    {
      label: '网络流量',
      value: metrics.network.interfaces.length > 0
        ? Math.round((metrics.network.interfaces.reduce((sum, i) => sum + (i.bytes_recv_sec || 0), 0)) / 1024)
        : 0,
      unit: 'KB/s',
      status: 'normal',
      icon: <Wifi size={18} />,
      color: '#06b6d4',
      history: netHistory
    }
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
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-emerald-700">实时</span>
            </div>

            <button
              onClick={fetchMetrics}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="立即刷新"
            >
              <RefreshCw size={16} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <span className="text-xs text-gray-400">
              更新于 {lastUpdate.toLocaleTimeString('zh-CN')}
            </span>
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
            <MetricCard key={card.label} data={card} />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RealtimeChart title="CPU 使用率趋势" data={cpuHistory} color="#10b981" />
          <RealtimeChart title="内存使用率趋势" data={memHistory} color="#3b82f6" />
        </div>

        {/* Network Chart */}
        <div className="mb-8">
          <RealtimeChart title="网络接收流量趋势" data={netHistory} color="#06b6d4" unit=" KB/s" />
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
