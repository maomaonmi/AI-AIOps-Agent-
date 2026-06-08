import { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Brain,
  BarChart3,
  Target,
  RefreshCw,
  Pause,
  Play,
  Minus,
  TrendingDown as TrendingDownIcon,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// ==================== Real-time Data Simulator ====================
function generateTimeSeriesData(points: number = 30, baseValue: number = 50, volatility: number = 8, trend: number = 0): Array<{ time: string; value: number; predicted?: number; upper?: number; lower?: number }> {
  const now = new Date();
  const data: Array<{ time: string; value: number; predicted?: number; upper?: number; lower?: number }> = [];
  let current = baseValue;

  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const noise = (Math.random() - 0.5) * volatility * 2;
    const seasonal = Math.sin(i / 5) * volatility * 0.3;
    current = Math.max(5, Math.min(95, current + noise + seasonal + trend * 0.1));
    
    const isPredicted = i < 8;
    if (isPredicted) {
      const predNoise = (Math.random() - 0.5) * volatility;
      const predVal = Math.max(5, Math.min(95, current + predNoise + trend * 0.15));
      data.push({
        time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
        value: null as unknown as number,
        predicted: parseFloat(predVal.toFixed(1)),
        upper: parseFloat(Math.min(99, predVal + volatility * 1.5).toFixed(1)),
        lower: parseFloat(Math.max(1, predVal - volatility * 1.5).toFixed(1)),
      });
    } else {
      data.push({
        time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
        value: parseFloat(current.toFixed(1)),
      });
    }
  }
  
  return data;
}

function generateAnomalyData(): Array<{ time: string; value: number; baseline: number; status: 'normal' | 'warning' | 'anomaly' }> {
  const now = new Date();
  const data: ReturnType<typeof generateAnomalyData> = [];
  let base = 45;

  for (let i = 29; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 30000);
    const noise = (Math.random() - 0.5) * 12;
    const val = base + noise;
    let status: 'normal' | 'warning' | 'anomaly' = 'normal';
    
    if (i === 3 || i === 12) {
      status = 'anomaly';
      base += 25;
    } else if (i === 7 || i === 20) {
      status = 'warning';
      base += 12;
    } else {
      base += (Math.random() - 0.5) * 3;
    }

    data.push({
      time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
      value: parseFloat(val.toFixed(1)),
      baseline: parseFloat((45 + Math.sin(i / 4) * 8).toFixed(1)),
      status,
    });
  }
  
  return data;
}

function generateCapacityData(): Array<{ date: string; cpu: number; memory: number; disk: number; diskUsed: number; diskTotal: number }> {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const today = new Date().getDay();
  const idx = today === 0 ? 6 : today - 1;
  
  return days.map((day, i) => {
    const isFuture = i > idx;
    const dayOffset = i - idx;
    return {
      date: day,
      cpu: isFuture ? parseFloat((42 + dayOffset * 3 + Math.random() * 10).toFixed(1)) : parseFloat((35 + Math.random() * 20).toFixed(1)),
      memory: isFuture ? parseFloat((65 + dayOffset * 2.5 + Math.random() * 8).toFixed(1)) : parseFloat((55 + Math.random() * 18).toFixed(1)),
      disk: isFuture ? parseFloat(Math.min(95, 76 + dayOffset * 2 + Math.random() * 4).toFixed(1)) : parseFloat((72 + Math.random() * 8).toFixed(1)),
      diskUsed: isFuture ? Math.round(780 + dayOffset * 28 + Math.random() * 50) : Math.round(720 + Math.random() * 80),
      diskTotal: 1024,
    };
  });
}

// ==================== SVG Chart Components ====================
interface LiveLineChartProps {
  data: Array<{ time: string; value: number | null; predicted?: number; upper?: number; lower?: number }>;
  width?: number;
  height?: number;
  color?: string;
  showPrediction?: boolean;
  title?: string;
  unit?: string;
  currentValue?: number;
}

export function LiveLineChart({ 
  data, width = 400, height = 140, color = '#6366f1', 
  showPrediction = true, title, unit = '%', currentValue 
}: LiveLineChartProps) {
  const values = data.filter(d => d.value !== null).map(d => d.value as number);
  const allValues = [...values, ...data.filter(d => d.predicted !== undefined).map(d => d.predicted!)];
  const maxVal = Math.max(...allValues) * 1.15 || 100;
  const minVal = Math.min(...allValues) * 0.85 || 0;
  const range = maxVal - minVal || 1;

  // Use full width of viewBox with small padding
  const padX = width * 0.03;
  const padY = height * 0.08;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const actualPoints = data
    .filter(d => d.value !== null)
    .map((d, i, arr) => {
      const x = padX + (i / (arr.length - 1 || 1)) * chartW;
      const y = padY + chartH - ((d.value! - minVal) / range) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  const predictPoints = data
    .filter(d => d.predicted !== undefined)
    .map((d, i, arr) => {
      const actualCount = data.filter(x => x.value !== null).length;
      const x = padX + ((actualCount + i) / (data.length - 1)) * chartW;
      const y = padY + chartH - ((d.predicted! - minVal) / range) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  const upperPoints = data
    .filter(d => d.upper !== undefined)
    .map((d, i, arr) => {
      const actualCount = data.filter(x => x.value !== null).length;
      const x = padX + ((actualCount + i) / (data.length - 1)) * chartW;
      const y = padY + chartH - ((d.upper! - minVal) / range) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  const lowerPoints = data
    .filter(d => d.lower !== undefined)
    .map((d, i, arr) => {
      const actualCount = data.filter(x => x.value !== null).length;
      const x = padX + ((actualCount + i) / (data.length - 1)) * chartW;
      const y = padY + chartH - ((d.lower! - minVal) / range) * chartH;
      return `${x},${y}`;
    })
    .reverse()
    .join(' ');

  // Find split point between actual and predicted
  const lastActualIdx = data.findLastIndex(d => d.value !== null);
  const splitX = lastActualIdx >= 0 ? padX + ((lastActualIdx) / (data.length - 1)) * chartW : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      {title && (
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-gray-700">{title}</span>
          {currentValue !== undefined && (
            <span className="text-sm font-bold" style={{ color }}>{currentValue}{unit}</span>
          )}
        </div>
      )}
      <div className="flex-1 min-h-[140px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`liveGrad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`predGrad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = padY + chartH - pct * chartH;
          return <line key={pct} x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#f3f4f6" strokeWidth="1" />;
        })}
        
        {/* Current time divider */}
        {showPrediction && (
          <>
            <line x1={splitX} y1={padY} x2={splitX} y2={padY + chartH} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,3" />
            <text x={splitX} y={padY + chartH + 12} fontSize="10" fill="#9ca3af" textAnchor="middle">现在</text>
          </>
        )}

        {/* Prediction confidence band */}
        {showPrediction && upperPoints && lowerPoints && (
          <polygon
            points={`${upperPoints} ${lowerPoints}`}
            fill={`url(#predGrad-${color.replace('#','')})`}
          />
        )}

        {/* Actual area */}
        {actualPoints && (
          <polygon
            points={`${padX},${padY + chartH} ${actualPoints} ${padX + chartW},${padY + chartH}`}
            fill={`url(#liveGrad-${color.replace('#','')})`}
          />
        )}

        {/* Predicted line (dashed) */}
        {showPrediction && predictPoints && (
          <polyline
            points={predictPoints}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5,4"
            opacity="0.7"
          />
        )}

        {/* Actual line */}
        {actualPoints && (
          <polyline
            points={actualPoints}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points - actual */}
        {data.filter(d => d.value !== null).map((d, i) => {
          const arr = data.filter(x => x.value !== null);
          const x = padX + (i / (arr.length - 1 || 1)) * chartW;
          const y = padY + chartH - ((d.value! - minVal) / range) * chartH;
          return (
            <circle key={`a-${i}`} cx={x} cy={y} r="3" fill="white" stroke={color} strokeWidth="2" />
          );
        })}

        {/* Data points - predicted */}
        {showPrediction && data.filter(d => d.predicted !== undefined).map((d, i) => {
          const actualCount = data.filter(x => x.value !== null).length;
          const x = padX + ((actualCount + i) / (data.length - 1)) * chartW;
          const y = padY + chartH - ((d.predicted! - minVal) / range) * chartH;
          return (
            <circle key={`p-${i}`} cx={x} cy={y} r="2.5" fill={color} opacity="0.5" />
          );
        })}

        {/* X-axis labels */}
        {data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((d, i) => {
          const allFiltered = data.filter((_, j) => j % 5 === 0 || j === data.length - 1);
          const pos = allFiltered.findIndex(x => x.time === d.time);
          const x = padX + (pos / (allFiltered.length - 1 || 1)) * chartW;
          return (
            <text key={i} x={x} y={padY + chartH + 15} fontSize="9" fill="#9ca3af" textAnchor="middle">{d.time}</text>
          );
        })}
        </svg>
      </div>

      {showPrediction && (
        <div className="px-3 pb-2 flex items-center gap-4 text-[10px] text-gray-500 shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-current rounded" style={{ color }}></span>
            实际值
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-current rounded border-dashed border-t-2" style={{ color, borderColor: color }}></span>
            预测值
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-2 rounded" style={{ backgroundColor: color, opacity: 0.15 }}></span>
            置信区间
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Anomaly Detection Chart ====================
export function AnomalyDetectionChart({ data }: { data: Array<{ time: string; value: number; baseline: number; status: 'normal' | 'warning' | 'anomaly' }> }) {
  const width = 500;
  const height = 180;
  const values = data.map(d => Math.max(d.value, d.baseline));
  const maxVal = Math.max(...values) * 1.15 || 100;
  const minVal = Math.min(...values, ...data.map(d => d.baseline)) * 0.85 || 0;
  const range = maxVal - minVal || 1;

  const padX = width * 0.05;
  const padY = height * 0.15;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const baselinePoints = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padY + chartH - ((d.baseline - minVal) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const valuePoints = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padY + chartH - ((d.value - minVal) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const std = 12;
  const upperBound = data.map((_, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
    const b = data[i].baseline;
    const y = padY + chartH - (((b + std * 2) - minVal) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');
  
  const lowerBound = data.map((_, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
    const b = data[i].baseline;
    const y = padY + chartH - (((b - std * 2) - minVal) / range) * chartH;
    return `${x},${y}`;
  }).reverse().join(' ');

  const hasAnomaly = data.some(d => d.status === 'anomaly');
  const hasWarning = data.some(d => d.status === 'warning');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl">
            <Activity size={16} className="text-red-500" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-800">异常检测 — 实时监控</span>
            {hasAnomaly && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                检测到异常
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-100"></span> 正常</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-100"></span> 偏离</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-100"></span> 异常</span>
        </div>
      </div>

      <div className="p-4 pb-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="anomalyBandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#fca5a5" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#fca5a5" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="valueLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
          <filter id="glowAnomaly" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shadowDrop">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08"/>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={`grid-${pct}`} x1={padX} y1={padY + chartH * (1-pct)} x2={padX + chartW} y2={padY + chartH * (1-pct)} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4,4" />
        ))}

        {/* Confidence band */}
        <polygon points={`${upperBound} ${lowerBound}`} fill="url(#anomalyBandGrad)" />

        {/* Area fill under value line */}
        <polygon points={`${padX},${padY + chartH} ${valuePoints} ${padX + chartW},${padY + chartH}`} fill="url(#areaFill)" />

        {/* Baseline */}
        <polyline points={baselinePoints} fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeDasharray="6,4" strokeLinecap="round" />

        {/* Value line with gradient */}
        <polyline points={valuePoints} fill="none" stroke="url(#valueLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#shadowDrop)" />

        {/* Anomaly highlight zones */}
        {data.map((d, i) => {
          if (d.status === 'normal') return null;
          const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
          const zoneWidth = chartW / Math.max(data.length, 1) * 0.7;
          return (
            <rect key={i} x={x - zoneWidth/2} y={padY} width={zoneWidth} height={chartH} rx="4" 
              fill={d.status === 'anomaly' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.05)'}
              stroke={d.status === 'anomaly' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'} strokeWidth="1"
            >
              {d.status === 'anomaly' && (
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
              )}
            </rect>
          );
        })}

        {/* Data points with status coloring */}
        {data.map((d, i) => {
          const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
          const y = padY + chartH - ((d.value - minVal) / range) * chartH;
          
          if (d.status === 'anomaly') return (
            <g key={i}>
              <circle cx={x} cy={y} r="10" fill="#ef4444" opacity="0.15">
                <animate attributeName="r" values="8;14;8" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.08;0.25" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r="5" fill="#fff" stroke="#ef4444" strokeWidth="2.5" filter="url(#glowAnomaly)" />
              <circle cx={x} cy={y} r="2" fill="#ef4444" />
            </g>
          );
          
          if (d.status === 'warning') return (
            <g key={i}>
              <circle cx={x} cy={y} r="7" fill="#f59e0b" opacity="0.12">
                <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r="4" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
              <circle cx={x} cy={y} r="1.5" fill="#f59e0b" />
            </g>
          );

          return (
            <circle key={i} cx={x} cy={y} r="2.5" fill="#6366f1" opacity="0.7" stroke="#fff" strokeWidth="1" />
          );
        })}

        {/* Time labels */}
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => {
          const filtered = data.filter((_, j) => j % Math.ceil(data.length / 6) === 0);
          const pos = filtered.indexOf(d);
          const x = padX + (pos / Math.max(filtered.length - 1, 1)) * chartW;
          return <text key={i} x={x} y={padY + chartH + 16} fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="500">{d.time}</text>;
        })}
        </svg>
      </div>

      {/* Anomaly alerts */}
      <div className="px-5 pb-4 space-y-2">
        {data.filter(d => d.status !== 'normal').slice(0, 4).map((d, i) => (
          <div key={i} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${
            d.status === 'anomaly' 
              ? 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-100/60' 
              : 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100/60'
          }`}>
            <div className={`p-1.5 rounded-lg ${
              d.status === 'anomaly' ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <AlertCircle size={13} className={
                d.status === 'anomaly' ? 'text-red-500' : 'text-amber-500'
              } />
            </div>
            <span className="font-bold text-gray-700 w-12">{d.time}</span>
            <span className="flex-1 font-medium">
              {d.status === 'anomaly' ? (
                <><span className="text-red-600 font-bold">异常!</span> <span className="text-gray-600">值=<span className="font-mono font-bold">{d.value}</span>，基线=<span className="font-mono">{d.baseline}</span></span></>
              ) : (
                <><span className="text-amber-600 font-semibold">偏离警告</span> <span className="text-gray-500">偏差=</span><span className="font-mono font-bold text-amber-700">{(d.value - d.baseline).toFixed(1)}</span></>
              )}
            </span>
          </div>
        ))}
        {!hasAnomaly && !hasWarning && (
          <div className="flex items-center justify-center gap-2 py-3 px-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100/50">
            <CheckCircle size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">系统运行正常，未检测到异常</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Capacity Planning Chart ====================
export function CapacityPlanningChart({ data }: { data: Array<{ date: string; cpu: number; memory: number; disk: number; diskUsed: number; diskTotal: number }> }) {
  const todayIdx = data.findIndex((_, i) => {
    const day = new Date().getDay();
    const target = day === 0 ? 6 : day - 1;
    return i === target;
  });

  const metrics = [
    { label: 'CPU 使用率', key: 'cpu' as const, color: '#6366f1', gradientFrom: '#818cf8', gradientTo: '#c7d2fe', warn: 80, crit: 90, icon: '⚡' },
    { label: '内存使用率', key: 'memory' as const, color: '#8b5cf6', gradientFrom: '#a78bfa', gradientTo: '#ddd6fe', warn: 85, crit: 95, icon: '🧠' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl">
            <BarChart3 size={16} className="text-violet-500" />
          </div>
          <span className="text-sm font-bold text-gray-800">容量规划预测（未来7天）</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700">
          <Sparkles size={12} />
          AI 预测
        </span>
      </div>

      <div className="p-5 space-y-5">
        
        {/* CPU & Memory bars */}
        {metrics.map(metric => {
          const todayVal = data[todayIdx]?.[metric.key] ?? 0;
          const futureVal = data[data.length - 1]?.[metric.key] ?? 0;
          const isCritical = futureVal >= metric.crit;
          const isWarning = futureVal >= metric.warn && futureVal < metric.crit;
          const trend = futureVal - todayVal;
          
          return (
            <div key={metric.key} className="group">
              <div className="flex justify-between items-center mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{metric.icon}</span>
                  <span className="text-xs font-bold text-gray-700">{metric.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block leading-tight">今日</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: metric.color }}>{todayVal.toFixed(1)}%</span>
                  </div>
                  <div className={`flex flex-col items-center ${trend > 5 ? 'text-red-400' : trend > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    <svg width="16" height="10" viewBox="0 0 16 10">
                      <path d={trend >= 0 ? "M1 9L8 2L15 9" : "M1 1L8 8L15 1"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[10px] font-bold tabular-nums">{trend > 0 ? '+' : ''}{trend.toFixed(1)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block leading-tight">预测</span>
                    <span className={`text-sm font-bold tabular-nums ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : ''}`} style={{ color: !isCritical && !isWarning ? metric.color : undefined }}>
                      {futureVal.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="relative h-4 bg-gray-50 rounded-full overflow-hidden ring-1 ring-gray-100">
                {/* Background zones */}
                <div className="absolute inset-y-0 left-0 rounded-l-full transition-all" style={{ 
                  width: `${metric.warn}%`, 
                  background: `linear-gradient(90deg, ${metric.color}08, ${metric.color}15)`,
                }} />
                <div className="absolute inset-y-0 rounded-r-full transition-all" style={{ 
                  width: `${metric.crit - metric.warn}%`, 
                  left: `${metric.warn}%`,
                  background: `linear-gradient(90deg, ${metric.color}20, ${metric.color}30)`,
                }} />
                
                {/* Progress bars for each day */}
                {data.map((d, i) => {
                  const val = d[metric.key];
                  const isToday = i === todayIdx;
                  const isFuture = i > todayIdx;
                  const pct = Math.min(val, 100);
                  
                  return (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 rounded-full transition-all duration-300 ${
                        isToday ? 'z-30 shadow-lg scale-y-110 origin-left' : isFuture ? 'z-10 opacity-60' : 'z-5'
                      }`}
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: `linear-gradient(90deg, ${metric.gradientFrom}, ${metric.color})`,
                        left: 0,
                        boxShadow: isToday ? `0 0 12px ${metric.color}40` : undefined,
                      }}
                    >
                      {isToday && (
                        <>
                          <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-40">
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm" 
                              style={{ 
                                background: `linear-gradient(135deg, ${metric.color}, ${metric.gradientFrom})`, 
                                color: 'white',
                                fontSize: '10px'
                              }}>
                              今天
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                
                {/* Threshold markers */}
                <div className="absolute top-0 bottom-0 flex items-center justify-center z-20" style={{ left: `${metric.warn}%` }}>
                  <div className="w-0.5 h-full bg-amber-400/50"></div>
                  <div className="absolute -bottom-4 w-1 h-1 rounded-full bg-amber-400"></div>
                </div>
                <div className="absolute top-0 bottom-0 flex items-center justify-center z-20" style={{ left: `${metric.crit}%` }}>
                  <div className="w-0.5 h-full bg-red-400/50"></div>
                  <div className="absolute -bottom-4 w-1 h-1 rounded-full bg-red-400"></div>
                </div>
              </div>
              
              <div className="flex justify-between mt-1.5 px-1">
                <span className="text-[9px] text-gray-300 font-medium">0%</span>
                <span className="text-[9px] font-medium" style={{ color: metric.color, opacity: 0.7 }}>⚠ {metric.warn}%</span>
                <span className="text-[9px] text-red-400 font-medium">● {metric.crit}%</span>
                <span className="text-[9px] text-gray-300 font-medium">100%</span>
              </div>
              
              {(isCritical || isWarning) && (
                <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${
                  isCritical 
                    ? 'bg-red-50 text-red-600 border border-red-100' 
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  <AlertTriangle size={11} />
                  {isCritical 
                    ? `预计第${data.length - 1}天将达到临界值 ${futureVal.toFixed(1)}%`
                    : `预计第${data.length - 1}天将接近警告阈值 ${futureVal.toFixed(1)}%`
                  }
                </div>
              )}
            </div>
          );
        })}

        {/* Disk gauge */}
        <div className="pt-4 mt-2 border-t border-gray-100/80">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">💾</span>
              <span className="text-xs font-bold text-gray-700">磁盘空间</span>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              <span className="font-bold text-gray-700">{data[todayIdx]?.diskUsed ?? 0}</span> / <span>{data[todayIdx]?.diskTotal ?? 1024} GB</span>
            </span>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {data.map((d, i) => {
              const pct = (d.diskUsed / Math.max(d.diskTotal, 1)) * 100;
              const isToday = i === todayIdx;
              const isFuture = i > todayIdx;
              const willFull = pct >= 90;
              const willWarn = pct >= 85 && pct < 90;
              
              let bgColor: string;
              let textColor: string;
              if (willFull) {
                bgColor = `conic-gradient(from 180deg, #ef4444 ${pct * 0.98}%, #fef2f2 ${pct}%)`;
                textColor = '#ef4444';
              } else if (willWarn) {
                bgColor = `conic-gradient(from 180deg, #f59e0b ${pct * 0.98}%, #fffbeb ${pct}%)`;
                textColor = '#f59e0b';
              } else {
                bgColor = `conic-gradient(from 180deg, #6366f1 ${pct * 0.98}%, #eef2ff ${pct}%)`;
                textColor = '#374151';
              }
              
              return (
                <div key={i} className="group relative">
                  <div className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-300 ${
                    isToday 
                      ? 'ring-2 ring-indigo-400 ring-offset-2 scale-105 shadow-lg z-10 bg-white' 
                      : isFuture 
                        ? 'opacity-65' 
                        : ''
                  }`} style={{
                    background: isToday ? 'white' : undefined,
                  }}>
                    {!isToday && (
                      <div className="absolute inset-0 rounded-xl" style={{ background: bgColor }}></div>
                    )}
                    {isToday && (
                      <div className="absolute inset-0 rounded-xl" style={{ background: bgColor }}></div>
                    )}
                    
                    <span className="text-[11px] font-bold tabular-nums relative z-10" style={{ color: isToday ? '#4f46e5' : textColor }}>
                      {pct.toFixed(0)}%
                    </span>
                    
                    {isToday && (
                      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full ring-2 ring-white z-20">
                        <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75"></span>
                      </span>
                    )}
                    
                    {(willFull || willWarn) && !isToday && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full z-20"
                        style={{ backgroundColor: willFull ? '#ef4444' : '#f59e0b' }}
                      ></div>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1.5 block text-center ${
                    isToday ? 'font-bold text-indigo-600' : willFull ? 'font-semibold text-red-500' : willWarn ? 'font-medium text-amber-500' : 'text-gray-400'
                  }`}>
                    {d.date}
                  </span>
                </div>
              );
            })}
          </div>
          
          {data.some(d => (d.diskUsed / d.diskTotal) * 100 >= 90) && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50/70 rounded-xl border border-red-100/60">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-red-700">
                <span className="font-bold">磁盘容量预警：</span>
                预计未来7天内磁盘使用率将超过90%，建议提前清理或扩容
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Auto-refreshing Container ====================
interface AutoRefreshChartProps {
  children: React.ReactNode;
  interval?: number;
  title?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function AutoRefreshContainer({ 
  children, interval = 10000, title, onRefresh, isRefreshing = false, className = ''
}: AutoRefreshChartProps) {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<number>(interval);

  useEffect(() => {
    if (isPaused) return;
    
    const timer = setInterval(() => {
      setLastUpdate(new Date());
      onRefresh?.();
    }, interval);

    return () => clearInterval(timer);
  }, [interval, isPaused, onRefresh]);

  useEffect(() => {
    if (!isPaused) return;
    const timer = setInterval(() => {
      countdownRef.current -= 1000;
      if (countdownRef.current <= 0) {
        countdownRef.current = interval;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, interval]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  const formatTimeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}秒前`;
    return `${Math.floor(diff / 3600000)}分钟前`;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div 
      ref={containerRef}
      className={`rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-[9999] rounded-2xl shadow-2xl' : ''
      } ${className}`}
    >
      <div className="px-3 py-2 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title && <span className="text-xs font-semibold text-gray-700">{title}</span>}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">
              {isRefreshing ? '刷新中...' : formatTimeAgo(lastUpdate)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
            title={isPaused ? '继续刷新' : '暂停刷新'}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            onClick={() => { setLastUpdate(new Date()); onRefresh?.(); }}
            className="p-1 rounded hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors"
            title="立即刷新"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={toggleFullscreen}
            className={`p-1 rounded transition-colors ${
              isFullscreen 
                ? 'hover:bg-gray-200 text-gray-500 hover:text-gray-700' 
                : 'hover:bg-violet-50 text-violet-400 hover:text-violet-600'
            }`}
            title={isFullscreen ? '退出全屏' : '全屏查看'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
      <div className={`p-3 ${isFullscreen ? 'p-6 overflow-auto max-h-[calc(100vh-60px)]' : ''}`}>
        {children}
      </div>
    </div>
  );
}

// ==================== Prediction Score Card ====================
interface PredictionScoreProps {
  score: number;
  confidence: number;
  label: string;
  description: string;
  trend: 'up' | 'down' | 'stable';
  icon?: React.ReactNode;
}

export function PredictionScoreCard({ score, confidence, label, description, trend, icon }: PredictionScoreProps) {
  const scoreColor = score > 80 ? 'text-red-600' : score > 60 ? 'text-amber-600' : score > 40 ? 'text-yellow-600' : 'text-emerald-600';
  const bgColor = score > 80 ? 'from-red-50 to-rose-50 border-red-200' : score > 60 ? 'from-amber-50 to-orange-50 border-amber-200' : score > 40 ? 'from-yellow-50 to-amber-50/50 border-yellow-200' : 'from-emerald-50 to-teal-50 border-emerald-200';

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${bgColor} p-3.5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/80 shadow-sm">
            {icon || <Brain size={14} className="text-indigo-500" />}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-800">{label}</p>
            <p className="text-[10px] text-gray-500 leading-snug">{description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold tabular-nums ${scoreColor}`}>{score}</p>
          <p className="text-[9px] text-gray-400">风险指数</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-gray-500">AI 置信度</span>
            <span className="text-[10px] font-bold text-gray-700">{confidence}%</span>
          </div>
          <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-indigo-500 transition-all duration-1000"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 text-[10px] font-medium">
          {trend === 'up' && (
            <>
              <TrendingUp size={11} className="text-red-500" />
              <span className="text-red-600">上升</span>
            </>
          )}
          {trend === 'down' && (
            <>
              <TrendingDownIcon size={11} className="text-emerald-500" />
              <span className="text-emerald-600">下降</span>
            </>
          )}
          {trend === 'stable' && (
            <>
              <Minus size={11} className="text-blue-500" />
              <span className="text-blue-600">稳定</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Prediction Timeline ====================
interface PredictionEvent {
  time: string;
  event: string;
  type: 'predicted' | 'warning' | 'action' | 'info';
  probability?: number;
}

export function PredictionTimeline({ events }: { events: PredictionEvent[] }) {
  return (
    <div className="space-y-0">
      {events.map((evt, i) => {
        const typeConfig = {
          predicted: { dot: 'bg-indigo-500', border: 'border-indigo-200', bg: 'bg-indigo-50', textColor: 'text-indigo-700', icon: <Brain size={11} /> },
          warning: { dot: 'bg-amber-500', border: 'border-amber-200', bg: 'bg-amber-50', textColor: 'text-amber-700', icon: <AlertTriangle size={11} /> },
          action: { dot: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', textColor: 'text-emerald-700', icon: <Target size={11} /> },
          info: { dot: 'bg-gray-400', border: 'border-gray-200', bg: 'bg-gray-50', textColor: 'text-gray-600', icon: <Clock size={11} /> },
        };
        const cfg = typeConfig[evt.type];
        
        return (
          <div key={i} className="flex gap-3 group">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border} shrink-0`}>
                {cfg.icon}
              </div>
              {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
            </div>
            
            <div className={`flex-1 p-2.5 rounded-lg border ${cfg.border} ${cfg.bg} hover:shadow-sm transition-shadow mb-1`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[11px] font-semibold ${cfg.textColor}`}>{evt.event}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono">{evt.time}</span>
                  {evt.probability !== undefined && (
                    <span className="text-[10px] font-medium px-1.5 py-px rounded-full bg-white/80 text-indigo-600">
                      {evt.probability}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>);
}

// ==================== Data Generators (for external use) ====================
export const RealTimeDataGenerators = {
  timeSeries: generateTimeSeriesData,
  anomaly: generateAnomalyData,
  capacity: generateCapacityData,
};


