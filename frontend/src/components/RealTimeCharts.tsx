import { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  AlertCircle,
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
  const width = 420;
  const height = 140;
  const values = data.map(d => Math.max(d.value, d.baseline));
  const maxVal = Math.max(...values) * 1.2 || 100;
  const minVal = Math.min(...values) * 0.8 || 0;
  const range = maxVal - minVal || 1;

  // Use full width of viewBox with small padding
  const padX = width * 0.03;
  const padY = height * 0.1;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const baselinePoints = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + chartH - ((d.baseline - minVal) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const valuePoints = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + chartH - ((d.value - minVal) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');

  // Upper/lower bounds (baseline ± 2*std)
  const std = 10;
  const upperBound = data.map((_, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const b = data[i].baseline;
    const y = padY + chartH - (((b + std * 2) - minVal) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');
  
  const lowerBound = data.map((_, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const b = data[i].baseline;
    const y = padY + chartH - (((b - std * 2) - minVal) / range) * chartH;
    return `${x},${y}`;
  }).reverse().join(' ');

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Activity size={13} className="text-red-500" />
          异常检测 — 实时监控
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> 正常</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 偏离</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 异常</span>
        </div>
      </div>

      <div className="flex-1 min-h-[120px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="anomalyBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Confidence band */}
        <polygon points={`${upperBound} ${lowerBound}`} fill="url(#anomalyBand)" />

        {/* Baseline */}
        <polyline points={baselinePoints} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4,3" />

        {/* Value line */}
        <polyline points={valuePoints} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Anomaly highlight zones */}
        {data.map((d, i) => {
          if (d.status === 'normal') return null;
          const x = padX + (i / (data.length - 1)) * chartW;
          const bgColor = d.status === 'anomaly' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)';
          const zoneWidth = chartW / data.length * 0.8;
          return (
            <rect key={i} x={x - zoneWidth/2} y={padY} width={zoneWidth} height={chartH} rx="2" fill={bgColor} />
          );
        })}

        {/* Data points with status coloring */}
        {data.map((d, i) => {
          const x = padX + (i / (data.length - 1)) * chartW;
          const y = padY + chartH - ((d.value - minVal) / range) * chartH;
          const dotColor = d.status === 'anomaly' ? '#ef4444' : d.status === 'warning' ? '#f59e0b' : '#6366f1';
          return (
            <circle key={i} cx={x} cy={y} r={d.status !== 'normal' ? 4 : 2.5} 
              fill={dotColor}
              stroke="white" strokeWidth={d.status !== 'normal' ? 2 : 1.5}
              opacity={d.status === 'normal' ? 0.8 : 1}
            >
              {d.status !== 'normal' && (
                <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
              )}
            </circle>
          );
        })}

        {/* Time labels */}
        {data.filter((_, i) => i % 4 === 0).map((d, i) => {
          const filtered = data.filter((_, j) => j % 4 === 0);
          const pos = filtered.indexOf(d);
          const x = padX + (pos / (filtered.length - 1)) * chartW;
          return <text key={i} x={x} y={padY + chartH + 12} fontSize="9" fill="#9ca3af" textAnchor="middle">{d.time}</text>;
        })}
        </svg>
      </div>

      {/* Anomaly alerts */}
      <div className="mt-2 space-y-1.5 shrink-0">
        {data.filter(d => d.status !== 'normal').slice(0, 3).map((d, i) => (
          <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
            d.status === 'anomaly' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
          }`}>
            <AlertCircle size={12} className={
              d.status === 'anomaly' ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'
            } />
            <span className="font-medium text-gray-800">{d.time}</span>
            <span className={
              d.status === 'anomaly' ? 'text-red-600' : 'text-amber-600'
            }>
              {d.status === 'anomaly' ? `异常! 值=${d.value}，基线=${d.baseline}` : `偏离警告 偏差=${(d.value - d.baseline).toFixed(1)}`}
            </span>
          </div>
        ))}
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <BarChart3 size={13} className="text-purple-500" />
          容量规划预测（未来7天）
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
          AI 预测
        </span>
      </div>

      <div className="p-3 space-y-3">
        
        {/* CPU & Memory bars */}
        {[
          { label: 'CPU 使用率', key: 'cpu' as const, color: '#6366f1', warn: 80, crit: 90 },
          { label: '内存使用率', key: 'memory' as const, color: '#8b5cf6', warn: 85, crit: 95 },
        ].map(metric => (
          <div key={metric.key}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-medium text-gray-600">{metric.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">今日 {(data[todayIdx]?.[metric.key] ?? 0).toFixed(1)}%</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: metric.color }}>
                  → {(data[data.length - 1]?.[metric.key] ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
              {/* Warning zone */}
              <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ 
                width: `${metric.warn}%`, backgroundColor: `${metric.color}15`,
                right: `${100-metric.warn}%`
              }} />
              {/* Critical zone */}
              <div className="absolute inset-y-0 rounded-r-full" style={{ 
                width: `${metric.crit - metric.warn}%`, backgroundColor: `${metric.color}25`,
                left: `${metric.warn}%`
              }} />
              
              {data.map((d, i) => {
                const val = d[metric.key];
                const isToday = i === todayIdx;
                const isFuture = i > todayIdx;
                const pct = Math.min(val, 100);
                
                return (
                  <div
                    key={i}
                    className={`absolute top-0 bottom-0 rounded-full transition-all ${
                      isToday ? 'z-20 ring-2 ring-offset-1' : isFuture ? 'opacity-70 z-10' : ''
                    }`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: metric.color,
                      left: 0,
                      ...(isToday ? { ringColor: metric.color, '--tw-ring-offset-color': 'white' } : {}),
                    }}
                  >
                    {isToday && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: metric.color, color: 'white' }}>
                          今天
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gray-400">0%</span>
              <span className="text-[9px]" style={{ color: metric.color }}>⚠ {metric.warn}%</span>
              <span className="text-[9px] text-red-400">🔴 {metric.crit}%</span>
              <span className="text-[9px] text-gray-400">100%</span>
            </div>
          </div>
        ))}

        {/* Disk gauge */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-medium text-gray-600">磁盘空间</span>
            <span className="text-[10px] text-gray-400">
              {data[todayIdx]?.diskUsed ?? 0} / {data[todayIdx]?.diskTotal ?? 1024} GB
            </span>
          </div>
          
          <div className="grid grid-cols-7 gap-1.5">
            {data.map((d, i) => {
              const pct = (d.diskUsed / d.diskTotal) * 100;
              const isToday = i === todayIdx;
              const isFuture = i > todayIdx;
              const willFull = pct >= 90;
              
              return (
                <div key={i} className="text-center">
                  <div className={`relative w-full aspect-square rounded-lg flex items-end justify-center pb-0.5 transition-all ${
                    isToday ? 'ring-2 ring-indigo-400 scale-105 z-10' : isFuture ? '' : ''
                  }`} style={{
                    background: willFull 
                      ? `conic-gradient(${pct > 95 ? '#ef4444' : pct > 85 ? '#f59e0b' : '#6366f1'} ${pct}%, #f3f4f6 ${pct}%)`
                      : `conic-gradient(#6366f1 ${pct}%, #f3f4f6 ${pct}%)`,
                    opacity: isFuture ? 0.7 : 1,
                  }}>
                    <span className="text-[9px] font-bold tabular-nums" style={{
                      color: willFull ? (pct > 95 ? '#ef4444' : '#f59e0b') : '#374151'
                    }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <span className={`text-[9px] mt-1 block ${isToday ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>
                    {d.date}
                  </span>
                </div>
              );
            })}
          </div>
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

  const formatTimeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}秒前`;
    return `${Math.floor(diff / 3600000)}分钟前`;
  };

  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`}>
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
      </div>
      <div className="p-3">
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


