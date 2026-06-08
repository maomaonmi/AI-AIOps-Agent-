import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Cpu, HardDrive, Wifi, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp,
  Server, Database, Globe, Monitor, Clock, Zap, AlertCircle
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

interface HealthCategory {
  category: string;
  icon: string;
  items: Array<{
    name: string;
    status: string;
    value: string;
    detail: string;
    score: number;
    weight: number;
  }>;
  category_score: number;
  status: string;
}

interface HealthReport {
  overall_score: number;
  grade: string;
  grade_color: string;
  categories: HealthCategory[];
  recommendations: string[];
  check_time: string;
  hostname: string;
  os_info: string;
  uptime: string;
}

export function HealthCheckPanel() {
  const [data, setData] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/health');
      const json = await res.json();
      if (json.status === 'success') {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch health data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="ml-3 text-gray-500">正在扫描系统状态...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500 py-8">无法获取系统健康状态</div>;
  }

  const scoreColor = data.grade_color === 'emerald' ? 'text-emerald-500' :
                     data.grade_color === 'green' ? 'text-green-500' :
                     data.grade_color === 'amber' ? 'text-amber-500' :
                     data.grade_color === 'orange' ? 'text-orange-500' : 'text-red-500';

  const scoreBg = data.grade_color === 'emerald' ? 'from-emerald-500 to-emerald-600' :
                  data.grade_color === 'green' ? 'from-green-500 to-green-600' :
                  data.grade_color === 'amber' ? 'from-amber-500 to-amber-600' :
                  data.grade_color === 'orange' ? 'from-orange-500 to-orange-600' : 'from-red-500 to-red-600';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-900">{data.hostname}</div>
            <div className="text-xs text-gray-500">{data.os_info} · 运行 {data.uptime}</div>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          重新检测
        </button>
      </div>

      <div className="flex items-center justify-center py-6">
        <div className="relative">
          <div className={`w-36 h-36 rounded-full bg-gradient-to-br ${scoreBg} p-1 shadow-lg`}>
            <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${scoreColor}`}>{data.overall_score}</span>
              <span className="text-sm text-gray-500 mt-1">{data.grade}</span>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow text-xs text-gray-600">
            综合健康评分
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {data.categories.map((cat) => {
          const catColor = cat.category_score >= 80 ? 'emerald' :
                          cat.category_score >= 60 ? 'amber' : 'red';
          return (
            <div
              key={cat.category}
              onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                expandedCategory === cat.category 
                  ? 'border-emerald-300 bg-emerald-50' 
                  : 'border-gray-100 hover:border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">{cat.category}</span>
                <span className={`text-xs font-bold text-${catColor}-600`}>{cat.category_score}</span>
              </div>
              <div className={`h-1.5 rounded-full bg-${catColor}-100 overflow-hidden`}>
                <div 
                  className={`h-full bg-${catColor}-500 rounded-full transition-all`}
                  style={{ width: `${cat.category_score}%` }}
                />
              </div>
              <div className={`mt-1 text-[10px] text-${catColor}-600`}>{cat.status}</div>
            </div>
          );
        })}
      </div>

      {expandedCategory && (
        <div className="bg-gray-50 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
          <h4 className="font-medium text-gray-800 mb-3">
            {data.categories.find(c => c.category === expandedCategory)?.category} 详细检查
          </h4>
          <div className="space-y-2">
            {data.categories.find(c => c.category === expandedCategory)?.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
                <div className="flex items-center gap-2">
                  {item.score >= 80 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : item.score >= 60 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-700">{item.name}</div>
                    {item.detail && <div className="text-xs text-gray-400">{item.detail}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">{item.value}</div>
                  <div className="text-xs text-gray-500">{item.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          优化建议
        </h4>
        <div className="space-y-2">
          {data.recommendations.map((rec, idx) => (
            <div key={idx} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-amber-800">{rec}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        检测时间: {data.check_time}
      </div>
    </div>
  );
}


interface PredictionPoint {
  timestamp: string;
  value: number;
  is_predicted: boolean;
  confidence_lower?: number;
  confidence_upper?: number;
}

interface MetricPrediction {
  metric_name: string;
  unit: string;
  current_value: number;
  predicted_change: number;
  trend: string;
  points: PredictionPoint[];
  warning_threshold: number;
  will_exceed_threshold: boolean;
  exceed_time: string;
  color: string;
}

interface AnomalyWarning {
  metric: string;
  severity: string;
  description: string;
  predicted_time: string;
  confidence: number;
}

interface TrendPredictionReport {
  predictions: MetricPrediction[];
  anomalies: AnomalyWarning[];
  summary: string;
  prediction_time: string;
  time_horizon_hours: number;
}

export function TrendPredictPanel() {
  const [data, setData] = useState<TrendPredictionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState(0);
  const [timeRange, setTimeRange] = useState(24);
  const [liveBuffer, setLiveBuffer] = useState<Record<string, number[]>>({});
  const [liveTimestamps, setLiveTimestamps] = useState<Record<string, string[]>>({});
  const [isLive, setIsLive] = useState(true);

  const MAX_LIVE_POINTS = 40;
  const LIVE_INTERVAL_MS = 2000;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prediction/trend?hours=${timeRange}`);
      const json = await res.json();
      if (json.status === 'success') {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch prediction data:', e);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const fetchLiveTick = useCallback(async () => {
    try {
      const res = await fetch('/api/prediction/realtime');
      const json = await res.json();
      if (json.status === 'success' && json.metrics) {
        const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLiveBuffer(prev => {
          const next = { ...prev };
          for (const [key, val] of Object.entries(json.metrics)) {
            if (val !== null) {
              const arr = [...(prev[key] || []), val as number];
              next[key] = arr.slice(-MAX_LIVE_POINTS);
            }
          }
          return next;
        });
        setLiveTimestamps(prev => {
          const next = { ...prev };
          for (const key of Object.keys(json.metrics)) {
            const arr = [...(prev[key] || []), now];
            next[key] = arr.slice(-MAX_LIVE_POINTS);
          }
          return next;
        });
        if (data) {
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              predictions: prev.predictions.map(p => {
                const keyMap: Record<string, string> = { 'CPU 使用率': 'cpu', '内存使用率': 'memory', '磁盘使用率': 'disk', 'GPU 使用率': 'gpu', '网络流量': 'network' };
                const mKey = keyMap[p.metric_name];
                if (!mKey) return p;
                const liveVal = json.metrics[mKey];
                if (liveVal === null || liveVal === undefined) return p;
                const newPoints = [...p.points.filter(pt => !pt.is_predicted)];
                if (newPoints.length > MAX_LIVE_POINTS) newPoints.shift();
                newPoints.push({ timestamp: now, value: Math.round(liveVal * 10) / 10, is_predicted: false });
                return { ...p, current_value: Math.round(liveVal * 10) / 10, points: newPoints };
              }),
              timestamp: new Date().toISOString(),
            };
          });
        }
      }
    } catch { }
  }, [data]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isLive || loading) return;
    fetchLiveTick();
    const timer = setInterval(fetchLiveTick, LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isLive, loading, fetchLiveTick]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500">正在分析趋势数据...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500 py-8">无法获取趋势预测数据</div>;
  }

  const currentPrediction = data.predictions[activeMetric];
  const seriesColor = currentPrediction?.color || '#3b82f6';
  const points = currentPrediction?.points || [];
  const actualPoints = points.filter(p => !p.is_predicted);
  const predPoints = points.filter(p => p.is_predicted);
  const splitIndex = actualPoints.length;
  const hasActualData = actualPoints.length > 0;

  const hexToRgba = (hex: string, alpha: number): string => {
    if (!hex || !hex.startsWith('#')) return `rgba(59,130,246,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const chartOption: any = {
    animation: true,
    animationDuration: 500,
    animationEasingUpdate: 'cubicInOut',
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      confine: true,
      enterable: true,
      backgroundColor: 'rgba(15,23,42,0.92)',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderRadius: 10,
      padding: [12, 16],
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      extraCssText: 'box-shadow: 0 10px 40px rgba(0,0,0,0.25);',
      formatter: (params: any) => {
        const pt = params[0];
        const idx = pt.dataIndex;
        const isPred = idx >= splitIndex;
        const pointData = points[idx];
        let html = `<div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#f1f5f9;">${pt.axisValue}</div>`;
        html += `<div style="display:flex;align-items:center;gap:6px;">`;
        html += `<span style="width:8px;height:8px;border-radius:50%;background:${isPred ? seriesColor : '#10b981'};display:inline-block;"></span>`;
        html += `<span style="color:#94a3b8;">${currentPrediction.metric_name}</span>`;
        html += `<span style="font-weight:700;color:${isPred ? seriesColor : '#10b981'};margin-left:auto;">${pt.value.toFixed(1)}${currentPrediction.unit}</span>`;
        html += `</div>`;
        if (isPred && pointData?.confidence_lower !== undefined) {
          html += `<div style="color:#64748b;font-size:11px;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08);">`;
          html += `置信区间: <span style="color:#94a3b8;">${pointData.confidence_lower.toFixed(1)}</span> ~ <span style="color:#94a3b8;">${pointData.confidence_upper.toFixed(1)}</span></div>`;
        }
        html += `<div style="font-size:11px;margin-top:4px;color:${isPred ? '#fbbf24' : '#34d399'};">● ${isPred ? 'AI 预测值' : '实时采样'}</div>`;
        return html;
      },
    },
    grid: { top: 35, right: 22, bottom: 32, left: 50, containLabel: false },
    xAxis: {
      type: 'category',
      data: points.map(p => p.timestamp),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
      axisTick: { show: false },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 10,
        fontFamily: 'monospace',
        interval: Math.max(1, Math.floor(points.length / 12)),
        rotate: 0,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(100 * 1.15 / 5) * 5,
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed', width: 1 } },
      axisLabel: { color: '#94a3b8', fontSize: 10, formatter: '{value}%' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      show: false,
      pieces: [
        { lte: splitIndex - 1, color: '#10b981' },
        { gt: splitIndex - 1, color: seriesColor },
      ],
      seriesIndex: 0,
    },
    series: [
      {
        name: currentPrediction.metric_name,
        type: 'line',
        data: points.map((p, i) => ({
          value: p.value,
          itemStyle: {
            color: i >= splitIndex
              ? hexToRgba(seriesColor, 1)
              : (i === splitIndex - 1 ? '#10b981' : 'transparent'),
            borderColor: i === splitIndex - 1 ? '#fff' : 'transparent',
            borderWidth: i === splitIndex - 1 ? 2 : 0,
            shadowBlur: i === splitIndex - 1 ? 8 : 0,
            shadowColor: i === splitIndex - 1 ? 'rgba(16,185,129,0.5)' : 'transparent',
          }
        })),
        smooth: 0.35,
        symbol: (val: number, params: any) => {
          const idx = params.dataIndex;
          if (!hasActualData) return 'none';
          if (idx === splitIndex - 1) return 'circle';
          if (idx === splitIndex && predPoints.length > 0) return 'diamond';
          return 'none';
        },
        symbolSize: (val: number, params: any) => {
          const idx = params.dataIndex;
          if (idx === splitIndex - 1) return 7;
          if (idx === splitIndex && predPoints.length > 0) return 5;
          return 0;
        },
        lineStyle: {
          width: 2.5,
          cap: 'round',
          join: 'round',
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#10b981' },
              { offset: hasActualData ? Math.max(0.01, (splitIndex - 1) / Math.max(points.length, 1)) : 0.5, color: '#10b981' },
              { offset: hasActualData ? Math.min(0.99, splitIndex / Math.max(points.length, 1)) : 0.5, color: seriesColor },
              { offset: 1, color: seriesColor },
            ]
          } as any,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba('#10b981', 0.18) },
            { offset: hasActualData ? (splitIndex / Math.max(points.length, 1)) * 0.7 + 0.2 : 0.5, color: hexToRgba(seriesColor, 0.12) },
            { offset: 1, color: 'rgba(0,0,0,0)' },
          ]),
        },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { type: 'dashed', width: 1, color: '#ef4444' },
          label: { show: true, position: 'insideEndTop', fontSize: 9, color: '#ef4444', fontWeight: 'bold', formatter: '⚠ 阈线' },
          data: [{ yAxis: currentPrediction.warning_threshold }],
        },
        markArea: hasActualData && predPoints.length > 0 ? {
          silent: true,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: hexToRgba(seriesColor, 0.06) },
              { offset: 1, color: hexToRgba(seriesColor, 0.02) },
            ]),
          },
          data: [[
            { xAxis: points[splitIndex]?.timestamp || '' },
            { xAxis: points[points.length - 1]?.timestamp || '' },
          ]],
        } : undefined,
        markPoint: hasActualData ? {
          data: [
            {
              coord: [splitIndex - 1, actualPoints[actualPoints.length - 1]?.value || 0],
              symbol: 'none',
              label: {
                show: true,
                position: 'right',
                offset: [5, 0],
                color: '#10b981',
                fontSize: 10,
                fontWeight: 'bold',
                formatter: '▎ 实时',
                backgroundColor: 'rgba(16,185,129,0.08)',
                borderRadius: 4,
                padding: [2, 6],
              }
            },
            ...(predPoints.length > 0 ? [{
              coord: [splitIndex, predPoints[0]?.value || 0],
              symbol: 'none',
              label: {
                show: true,
                position: 'left',
                offset: [-5, 0],
                color: seriesColor,
                fontSize: 10,
                fontWeight: 'bold',
                formatter: '预测 ▎',
                backgroundColor: hexToRgba(seriesColor, 0.08),
                borderRadius: 4,
                padding: [2, 6],
              }
            }] : []),
          ],
          animation: true,
          animationDelay: 300,
        } : undefined,
      },
      ...(predPoints.some(p => p.confidence_lower !== undefined) ? [{
        name: '置信上限',
        type: 'line',
        data: points.map(p => p.is_predicted ? p.confidence_upper ?? null : null),
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { width: 1, type: 'dotted', color: hexToRgba(seriesColor, 0.35) },
      }, {
        name: '置信下限',
        type: 'line',
        data: points.map(p => p.is_predicted ? p.confidence_lower ?? null : null),
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { width: 1, type: 'dotted', color: hexToRgba(seriesColor, 0.35) },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba(seriesColor, 0.1) },
            { offset: 1, color: hexToRgba(seriesColor, 0.02) },
          ]),
        },
      }] : []),
    ],
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[6, 12, 24, 48].map(h => (
            <button
              key={h}
              onClick={() => setTimeRange(h)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                timeRange === h
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {h}小时
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg transition-colors ${
              isLive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`relative flex h-2 w-2 ${isLive ? '' : 'opacity-30'}`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLive ? 'bg-emerald-400' : 'bg-gray-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
            </span>
            实时{isLive ? `(${LIVE_INTERVAL_MS / 1000}s)` : '(已暂停)'}
          </button>
          <button
            onClick={() => { fetchData(); setLiveBuffer({}); setLiveTimestamps({}); }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {data.predictions.map((pred, idx) => {
          const keyMap: Record<string, string> = { 'CPU 使用率': 'cpu', '内存使用率': 'memory', '磁盘使用率': 'disk', 'GPU 使用率': 'gpu', '网络流量': 'network' };
          const mKey = keyMap[pred.metric_name];
          const hasLiveData = mKey && (liveBuffer[mKey] || []).length > 0;
          return (
            <div
              key={pred.metric_name}
              onClick={() => setActiveMetric(idx)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeMetric === idx 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-100 hover:border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-600">{pred.metric_name}</span>
                  {isLive && hasLiveData && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                {pred.trend === '上升' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                ) : pred.trend === '下降' ? (
                  <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-gray-400" />
                )}
              </div>
              <div className="text-lg font-bold text-gray-800">
                {pred.current_value.toFixed(1)}<span className="text-xs text-gray-400 ml-1">{pred.unit}</span>
              </div>
              <div className={`text-xs mt-1 ${pred.predicted_change > 0 ? 'text-red-500' : pred.predicted_change < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                预测 {pred.predicted_change > 0 ? '+' : ''}{pred.predicted_change.toFixed(1)}{pred.unit}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex items-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-0.5 bg-emerald-500 rounded-full"></span>
              <span className="text-emerald-600">实时采样</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: seriesColor }}></span>
              <span style={{ color: seriesColor }}>趋势预测</span>
            </span>
            {predPoints.some(p => p.confidence_lower !== undefined) && (
              <span className="flex items-center gap-1.5 font-medium text-gray-400">
                <span className="w-6 border-t border-dashed" style={{ borderColor: hexToRgba(seriesColor, 0.35) }}></span>
                置信区间
              </span>
            )}
          </div>
          {isLive && hasActualData && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE
            </span>
          )}
        </div>
        <ReactECharts option={chartOption} style={{ height: 280 }} opts={{ renderer: 'canvas' }} notMerge />
      </div>

      {data.anomalies.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            异常预警
          </h4>
          <div className="space-y-2">
            {data.anomalies.map((anomaly, idx) => (
              <div key={idx} className={`p-3 rounded-lg border ${
                anomaly.severity === '高' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${
                    anomaly.severity === '高' ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    {anomaly.severity}风险
                  </span>
                  <span className="text-xs text-gray-500">{anomaly.predicted_time}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{anomaly.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800">{data.summary}</p>
      </div>

      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100 flex items-center justify-center gap-3">
        {isLive && (
          <span className="flex items-center gap-1 text-emerald-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            实时更新中
          </span>
        )}
        <span>预测时间: {data.prediction_time}</span>
        <span>·</span>
        <span>预测范围: {data.time_horizon_hours}小时</span>
        {isLive && <span>· 刷新间隔: {LIVE_INTERVAL_MS / 1000}s</span>}
      </div>
    </div>
  );
}


interface ArchitectureReport {
  os: {
    system: string;
    release: string;
    version: string;
    hostname: string;
    architecture: string;
    machine: string;
    kernel: string;
    uptime: string;
    boot_time: string;
  };
  cpu: {
    processor: string;
    architecture: string;
    cores_physical: number;
    cores_logical: number;
    frequency_mhz: number;
    frequency_ghz: number;
    usage_percent: number;
    temperature: number;
  };
  memory: {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    type: string;
    speed_mhz: number;
  };
  disks: Array<{
    device: string;
    mount_point: string;
    fstype: string;
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
    is_ssd: boolean;
  }>;
  gpus: Array<{
    name: string;
    memory_total_gb: number;
    driver_version: string;
    cuda_version: string;
    is_available: boolean;
  }>;
  networks: Array<{
    name: string;
    nic_type: string;
    is_up: boolean;
    speed_mbps: number;
    ipv4_addresses: string[];
    ipv6_addresses: string[];
    mtu: number;
  }>;
  runtime: {
    python_version: string;
    python_path: string;
    node_version: string;
    pip_version: string;
  };
  hostname: string;
  report_time: string;
}

export function ArchitectureReportPanel() {
  const [data, setData] = useState<ArchitectureReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/system/architecture');
        const json = await res.json();
        if (json.status === 'success') {
          setData(json);
        }
      } catch (e) {
        console.error('Failed to fetch architecture data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-3 text-gray-500">正在采集系统架构信息...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500 py-8">无法获取系统架构信息</div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl p-4 text-white">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6" />
          <div>
            <div className="font-bold text-lg">{data.os.hostname}</div>
            <div className="text-sm text-white/80">{data.os.system} {data.os.release}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/20">
          <div>
            <div className="text-xs text-white/60">架构</div>
            <div className="font-medium">{data.os.architecture}</div>
          </div>
          <div>
            <div className="text-xs text-white/60">运行时间</div>
            <div className="font-medium">{data.os.uptime}</div>
          </div>
          <div>
            <div className="text-xs text-white/60">启动时间</div>
            <div className="font-medium text-sm">{data.os.boot_time}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-gray-800">CPU</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">处理器</span>
              <span className="font-mono text-gray-800 text-xs">{data.cpu.processor.slice(0, 35)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">核心数</span>
              <span className="text-gray-800">{data.cpu.cores_physical} 物理 / {data.cpu.cores_logical} 逻辑</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">频率</span>
              <span className="text-gray-800">{data.cpu.frequency_ghz} GHz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">使用率</span>
              <span className="text-gray-800">{data.cpu.usage_percent}%</span>
            </div>
            {data.cpu.temperature > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">温度</span>
                <span className="text-gray-800">{data.cpu.temperature}°C</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-gray-800">内存</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">总容量</span>
              <span className="text-gray-800">{data.memory.total_gb} GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">已使用</span>
              <span className="text-gray-800">{data.memory.used_gb} GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">可用</span>
              <span className="text-gray-800">{data.memory.available_gb} GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">使用率</span>
              <span className="text-gray-800">{((data.memory.used_gb / data.memory.total_gb) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-gray-800">磁盘</span>
        </div>
        <div className="space-y-2">
          {data.disks.map((disk, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
              <div>
                <div className="font-mono text-xs text-gray-600">{disk.mount_point}</div>
                <div className="text-xs text-gray-400">{disk.fstype} · {disk.is_ssd ? 'SSD' : 'HDD'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-800">
                  {disk.used_gb.toFixed(1)} / {disk.total_gb.toFixed(1)} GB
                </div>
                <div className={`text-xs ${disk.percent > 80 ? 'text-red-500' : 'text-gray-500'}`}>
                  {disk.percent.toFixed(1)}% 已用
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.gpus.some(g => g.is_available) && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-violet-500" />
            <span className="font-medium text-gray-800">GPU</span>
          </div>
          <div className="space-y-2">
            {data.gpus.filter(g => g.is_available).map((gpu, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg">
                <div className="font-medium text-gray-800">{gpu.name}</div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-gray-400">显存</span>
                    <div className="font-medium text-gray-700">{gpu.memory_total_gb} GB</div>
                  </div>
                  <div>
                    <span className="text-gray-400">驱动</span>
                    <div className="font-medium text-gray-700">{gpu.driver_version}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">CUDA</span>
                    <div className="font-medium text-gray-700">{gpu.cuda_version}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-4 h-4 text-green-500" />
          <span className="font-medium text-gray-800">网络</span>
        </div>
        <div className="space-y-2">
          {data.networks.slice(0, 3).map((net, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-700">{net.name}</div>
                <div className="text-xs text-gray-400">{net.nic_type}</div>
              </div>
              <div className="text-right">
                {net.ipv4_addresses.length > 0 && (
                  <div className="font-mono text-xs text-gray-600">{net.ipv4_addresses[0]}</div>
                )}
                <div className="text-xs text-gray-400">{net.speed_mbps > 0 ? `${net.speed_mbps} Mbps` : '已连接'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-cyan-500" />
          <span className="font-medium text-gray-800">运行时环境</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 bg-white rounded-lg">
            <div className="text-xs text-gray-400">Python</div>
            <div className="font-mono text-gray-700">{data.runtime.python_version}</div>
          </div>
          <div className="p-2 bg-white rounded-lg">
            <div className="text-xs text-gray-400">Node.js</div>
            <div className="font-mono text-gray-700">{data.runtime.node_version}</div>
          </div>
          <div className="p-2 bg-white rounded-lg">
            <div className="text-xs text-gray-400">pip</div>
            <div className="font-mono text-gray-700">{data.runtime.pip_version}</div>
          </div>
          <div className="p-2 bg-white rounded-lg">
            <div className="text-xs text-gray-400">内核</div>
            <div className="font-mono text-gray-700 text-xs">{data.os.kernel || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        报告生成时间: {data.report_time}
      </div>
    </div>
  );
}


interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

interface LogLevelStats {
  level: string;
  count: number;
  percent: number;
  color: string;
}

interface TimeHeatmapPoint {
  hour: number;
  level: string;
  count: number;
}

interface TopError {
  message: string;
  count: number;
  source: string;
  last_seen: string;
}

interface LogSummary {
  total_logs: number;
  level_stats: LogLevelStats[];
  time_heatmap: TimeHeatmapPoint[];
  top_errors: TopError[];
  recent_logs: LogEntry[];
  sources: string[];
  time_range: string;
  scan_time: string;
}

export function LogVisualizationPanel() {
  const [data, setData] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/logs/summary?hours=24');
        const json = await res.json();
        if (json.status === 'success') {
          setData(json);
        }
      } catch (e) {
        console.error('Failed to fetch log data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
        <span className="ml-3 text-gray-500">正在分析日志数据...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500 py-8">无法获取日志数据</div>;
  }

  const pieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#64748b', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: { show: false },
      data: data.level_stats.map(s => ({
        value: s.count,
        name: s.level,
        itemStyle: { color: s.color },
      })),
    }],
  };

  const heatmapData: [number, string, number][] = data.time_heatmap.map(p => [p.hour, p.level, p.count]);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'OTHER'];

  const heatmapOption = {
    tooltip: {
      position: 'top',
      formatter: (params: any) => `${params.data[0]}:00 - ${params.data[1]}: ${params.data[2]}条`,
    },
    grid: { top: 10, right: 10, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: hours,
      splitArea: { show: true },
      axisLabel: { color: '#94a3b8', fontSize: 9, interval: 2 },
    },
    yAxis: {
      type: 'category',
      data: levels,
      axisLabel: { color: '#94a3b8', fontSize: 9 },
    },
    visualMap: {
      min: 0,
      max: Math.max(...data.time_heatmap.map(p => p.count), 10),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: ['#f1f5f9', '#fecaca', '#fca5a5', '#f87171', '#ef4444'],
      },
      textStyle: { color: '#64748b', fontSize: 9 },
      itemWidth: 10,
      itemHeight: 80,
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
      },
    }],
  };

  const barOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 10, right: 20, bottom: 20, left: 120 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 9 },
    },
    yAxis: {
      type: 'category',
      data: data.top_errors.slice(0, 5).map(e => e.message.slice(0, 20) + '...'),
      axisLabel: { color: '#64748b', fontSize: 9 },
    },
    series: [{
      type: 'bar',
      data: data.top_errors.slice(0, 5).map(e => e.count),
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#fecaca' },
          { offset: 1, color: '#ef4444' },
        ]),
      },
    }],
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">共 {data.total_logs} 条日志 · {data.time_range}</span>
        </div>
        <span className="text-xs text-gray-400">{data.scan_time}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">日志级别分布</h4>
          <ReactECharts option={pieOption} style={{ height: 180 }} opts={{ renderer: 'svg' }} />
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">时间热力图</h4>
          <ReactECharts option={heatmapOption} style={{ height: 180 }} opts={{ renderer: 'svg' }} />
        </div>
      </div>

      {data.top_errors.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">高频错误 Top 5</h4>
          <ReactECharts option={barOption} style={{ height: 140 }} opts={{ renderer: 'svg' }} />
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          最近日志
        </h4>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {data.recent_logs.slice(0, 15).map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg text-xs">
              <span className={`px-1.5 py-0.5 rounded font-medium ${
                log.level === 'ERROR' ? 'bg-red-100 text-red-700' :
                log.level === 'WARN' ? 'bg-amber-100 text-amber-700' :
                log.level === 'INFO' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {log.level}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-gray-800 truncate">{log.message}</div>
                <div className="text-gray-400 mt-0.5">{log.timestamp} · {log.source}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        日志来源: {data.sources.slice(0, 5).join(', ') || '系统日志'}
      </div>
    </div>
  );
}