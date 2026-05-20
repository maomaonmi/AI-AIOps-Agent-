import {
  Cpu,
  HardDrive,
  Database,
  Network,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Activity,
  Wifi,
  Zap,
} from 'lucide-react';

export type VisualizationType =
  | 'status-cards'
  | 'metric-chart'
  | 'service-topology'
  | 'alert-list'
  | 'data-table'
  | 'progress-group'
  | 'timeline'
  | 'metric-summary';

export interface VisualizationData {
  type: VisualizationType;
  data: Record<string, unknown>;
}

// ==================== Status Cards ====================
interface StatusItem {
  label: string;
  value: string;
  percent: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  icon?: string;
  trend?: number;
  chartData?: number[];
}

function StatusIcon({ type }: { type: string }) {
  const map: Record<string, React.ReactNode> = {
    cpu: <Cpu size={14} />,
    disk: <HardDrive size={14} />,
    memory: <Database size={14} />,
    network: <Network size={14} />,
    server: <Server size={14} />,
  };
  return <span className="text-inherit">{map[type] || <Activity size={14} />}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    healthy: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '正常' },
    warning: { bg: 'bg-amber-100', text: 'text-amber-700', label: '警告' },
    critical: { bg: 'bg-red-100', text: 'text-red-700', label: '严重' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-600', label: '未知' },
  };
  const c = config[status] || config.unknown;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(' ');
  const colors: Record<string, string> = {
    emerald: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6',
  };
  const strokeColor = colors[color] || colors.emerald;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#sg-${color})`} />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatusCards({ data }: { data: { items: StatusItem[]; title?: string } }) {
  const { items, title } = data;

  const statusColors: Record<string, string> = {
    healthy: 'emerald',
    warning: 'amber',
    critical: 'red',
    unknown: 'gray',
  };

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Activity size={15} className="text-indigo-500" />
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
        </div>
      )}
      <div className={`grid ${items.length <= 4 ? 'grid-cols-' + Math.min(items.length, 4) : 'grid-cols-4'} gap-3 p-4`}>
        {items.map((item, i) => {
          const color = statusColors[item.status] || 'emerald';
          const gradients: Record<string, string> = {
            emerald: 'from-emerald-50 to-teal-50 border-emerald-100',
            amber: 'from-amber-50 to-orange-50 border-amber-100',
            red: 'from-red-50 to-rose-50 border-red-100',
            gray: 'from-gray-50 to-slate-50 border-gray-200',
          };
          const iconColors: Record<string, string> = {
            emerald: 'bg-emerald-100 text-emerald-600',
            amber: 'bg-amber-100 text-amber-600',
            red: 'bg-red-100 text-red-600',
            gray: 'bg-gray-100 text-gray-500',
          };

          return (
            <div
              key={i}
              className={`rounded-xl p-3 bg-gradient-to-br ${gradients[color]} border hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${iconColors[color]}`}>
                  <StatusIcon type={item.icon || item.label.toLowerCase()} />
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-[13px] font-semibold text-gray-800">{item.label}</p>
              <div className="flex items-center justify-between mt-1.5 mb-1">
                <span className="text-[11px] text-gray-500 font-medium">{item.percent}%</span>
                {item.trend !== undefined && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${
                    item.trend > 0 ? 'text-red-500' : item.trend < 0 ? 'text-emerald-500' : 'text-gray-400'
                  }`}>
                    {item.trend > 0 ? <TrendingUp size={10} /> : item.trend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {Math.abs(item.trend)}%
                  </span>
                )}
              </div>
              <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    color === 'emerald' ? 'bg-emerald-500' :
                    color === 'amber' ? 'bg-amber-500' :
                    color === 'red' ? 'bg-red-500' : 'bg-gray-400'
                  }`}
                  style={{ width: `${Math.min(item.percent, 100)}%` }}
                />
              </div>
              {item.chartData && (
                <div className="mt-2 opacity-70">
                  <MiniSparkline
                    data={item.chartData}
                    color={color}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Metric Chart ====================
interface ChartDataPoint {
  label: string;
  value: number;
  value2?: number;
}

export function MetricChart({
  data,
}: {
  data: {
    title: string;
    subtitle?: string;
    series: ChartDataPoint[];
    type?: 'line' | 'bar';
    unit?: string;
    color?: string;
    showTable?: boolean;
  };
}) {
  const { title, subtitle, series, type = 'line', unit = '', color = 'indigo', showTable = false } = data;
  const values = series.map(s => s.value);
  const maxVal = Math.max(...values) * 1.15 || 100;
  const minVal = Math.min(...values) * 0.85 || 0;
  const range = maxVal - minVal || 1;

  const chartColor = color === 'emerald' ? '#10b981' : color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : '#6366f1';
  const bgColor = color === 'emerald' ? 'bg-emerald-50' : color === 'red' ? 'bg-red-50' : color === 'amber' ? 'bg-amber-50' : 'bg-indigo-50';
  const textColor = color === 'emerald' ? 'text-emerald-700' : color === 'red' ? 'text-red-700' : color === 'amber' ? 'text-amber-700' : 'text-indigo-700';

  const points = series
    .map((s, i) => {
      const x = (i / (series.length - 1)) * 95 + 2.5;
      const y = 90 - ((s.value - minVal) / range) * 75;
      return `${x},${y}`;
    })
    .join(' ');

  const barWidth = 80 / series.length;

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
            {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className={`px-2.5 py-1 rounded-lg ${bgColor}`}>
            <span className={`text-xs font-bold ${textColor}`}>
              {series[series.length - 1]?.value}{unit}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-4">
        <svg viewBox="0 0 100 100" className="w-full h-40" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`cg-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#f3f4f6" strokeWidth="0.3" />
          ))}

          {type === 'line' ? (
            <>
              <polygon points={`2.5,90 ${points} 97.5,90`} fill={`url(#cg-${color})`} />
              <polyline points={points} fill="none" stroke={chartColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {series.map((s, i) => {
                const x = (i / (series.length - 1)) * 95 + 2.5;
                const y = 90 - ((s.value - minVal) / range) * 75;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="1.5" fill="white" stroke={chartColor} strokeWidth="1" />
                  </g>
                );
              })}
            </>
          ) : (
            series.map((s, i) => {
              const x = (i / series.length) * 92 + 4;
              const barH = ((s.value - minVal) / range) * 75;
              const y = 90 - barH;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={Math.max(barWidth - 2, 1)}
                  height={barH}
                  rx="1"
                  fill={chartColor}
                  opacity="0.85"
                />
              );
            })
          )}

          {/* X-axis labels */}
          {series.map((s, i) => {
            if (series.length > 8 && i % 2 !== 0) return null;
            const x = (i / (series.length - 1)) * 95 + 2.5;
            return (
              <text key={i} x={x} y="97" fontSize="3.5" fill="#9ca3af" textAnchor="middle">
                {s.label}
              </text>
            );
          })}
        </svg>

        {/* Data Table */}
        {showTable && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">时间</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">数值</th>
                  {series[0]?.value2 !== undefined && (
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">对比</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {series.slice(-5).map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 px-2 text-gray-600">{s.label}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-medium text-gray-800">{s.value}{unit}</td>
                    {s.value2 !== undefined && (
                      <td className="py-1.5 px-2 text-right font-mono text-gray-400">{s.value2}{unit}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Service Topology ====================
interface TopologyNode {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'down';
  x: number;
  y: number;
  type?: string;
}

interface TopologyLink {
  from: number;
  to: number;
  active?: boolean;
}

export function ServiceTopology({
  data,
}: {
  data: {
    title?: string;
    nodes: TopologyNode[];
    links?: TopologyLink[];
  };
}) {
  const { title, nodes, links = [] } = data;

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={15} className="text-indigo-500" />
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
          </div>
          <div className="flex items-center gap-3">
            {['healthy', 'warning', 'critical'].map(s => (
              <div key={s} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  s === 'healthy' ? 'bg-emerald-500' :
                  s === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="text-[10px] text-gray-400">
                  {s === 'healthy' ? '健康' : s === 'warning' ? '警告' : '异常'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="relative bg-gradient-to-br from-slate-50 to-gray-50 p-5 h-[220px] rounded-b-2xl">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {links.map((link, i) => {
            const fromNode = nodes[link.from];
            const toNode = nodes[link.to];
            if (!fromNode || !toNode) return null;
            return (
              <line
                key={i}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={link.active ? '#6366f1' : '#d1d5db'}
                strokeWidth={link.active ? 0.8 : 0.4}
                strokeDasharray={link.active ? 'none' : '2,2'}
              />
            );
          })}
        </svg>
        {nodes.map((node, i) => {
          const statusStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
            healthy: { bg: 'bg-white', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
            warning: { bg: 'bg-white', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
            critical: { bg: 'bg-white', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
            down: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-400', dot: 'bg-gray-400' },
          };
          const style = statusStyles[node.status] || statusStyles.down;
          return (
            <div
              key={i}
              className="absolute flex flex-col items-center gap-1 transform -translate-x-1/2 -translate-y-1/2 transition-all hover:z-10"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shadow-sm border ${style.bg} ${style.border} ${style.text}`}>
                {node.name}
              </div>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Alert List ====================
interface AlertItem {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source?: string;
  time: string;
  count?: number;
}

export function AlertList({ data }: { data: { title?: string; alerts: AlertItem[] } }) {
  const { title, alerts } = data;

  const levelConfig: Record<string, { bg: string; border: string; iconBg: string; iconColor: string }> = {
    info: { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
    error: { bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
    critical: { bg: 'bg-rose-50', border: 'border-rose-200', iconBg: 'bg-rose-100', iconColor: 'text-rose-600' },
  };

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-500" />
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
          </div>
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
            {alerts.length}
          </span>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {alerts.map((alert, i) => {
          const cfg = levelConfig[alert.level] || levelConfig.warning;
          return (
            <div key={i} className={`flex items-start gap-3 p-3.5 ${cfg.bg} hover:bg-opacity-80 transition-colors`}>
              <div className={`p-1.5 rounded-lg shrink-0 ${cfg.iconBg}`}>
                <AlertTriangle size={13} className={cfg.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800 leading-snug">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  {alert.source && (
                    <span className="text-[11px] text-gray-400">{alert.source}</span>
                  )}
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                    <Clock size={9} />
                    {alert.time}
                  </span>
                  {alert.count && alert.count > 1 && (
                    <>
                      <span className="text-[11px] text-gray-400">·</span>
                      <span className="text-[11px] font-medium text-gray-500">×{alert.count}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Data Table ====================
interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (val: unknown) => string;
  highlight?: (val: unknown) => boolean;
}

export function DataTable({
  data,
}: {
  data: {
    title?: string;
    columns: TableColumn[];
    rows: Record<string, unknown>[];
  };
}) {
  const { title, columns, rows } = data;

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50/80">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`py-2.5 px-3 text-gray-500 font-medium ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                {columns.map(col => {
                  const val = row[col.key];
                  const formatted = col.format ? col.format(val) : String(val ?? '-');
                  const isHighlight = col.highlight ? col.highlight(val) : false;
                  return (
                    <td
                      key={col.key}
                      className={`py-2 px-3 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      } ${isHighlight ? 'font-semibold text-indigo-600' : 'text-gray-700'} ${
                        typeof val === 'number' ? 'font-mono' : ''
                      }`}
                    >
                      {formatted}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== Progress Group ====================
interface ProgressItem {
  label: string;
  value: number;
  max: number;
  color?: string;
  status?: string;
}

export function ProgressGroup({ data }: { data: { title?: string; items: ProgressItem[] } }) {
  const { title, items } = data;

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
        </div>
      )}
      <div className="p-4 space-y-4">
        {items.map((item, i) => {
          const pct = item.max > 0 ? Math.round((item.value / item.max) * 100) : 0;
          const barColor = item.color ? colorMap[item.color] || colorMap.indigo : colorMap.indigo;
          const isWarning = pct > 80;
          const isCritical = pct > 95;

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-medium text-gray-700">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.status && (
                    <span className="text-[10px] text-gray-400">{item.status}</span>
                  )}
                  <span className={`text-xs font-bold font-mono ${
                    isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-800'
                  }`}>
                    {item.value.toLocaleString()} / {item.max.toLocaleString()}
                  </span>
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                    isCritical ? 'bg-red-100 text-red-700' :
                    isWarning ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {pct}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Timeline ====================
interface TimelineEvent {
  time: string;
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export function Timeline({ data }: { data: { title?: string; events: TimelineEvent[] } }) {
  const { title, events } = data;

  const typeStyles: Record<string, { dot: string; ring: string }> = {
    info: { dot: 'bg-blue-500', ring: 'ring-blue-200' },
    success: { dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
    warning: { dot: 'bg-amber-500', ring: 'ring-amber-200' },
    error: { dot: 'bg-red-500', ring: 'ring-red-200' },
  };

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
        </div>
      )}
      <div className="p-4">
        <div className="relative pl-5 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
          {events.map((event, i) => {
            const style = typeStyles[event.type || 'info'] || typeStyles.info;
            return (
              <div key={i} className="relative">
                <div className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full ring-2 ${style.dot} ${style.ring}`} />
                <div className="pl-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] text-gray-400 font-mono">{event.time}</span>
                    <span className={`text-[13px] font-semibold ${
                      event.type === 'error' ? 'text-red-700' :
                      event.type === 'warning' ? 'text-amber-700' :
                      event.type === 'success' ? 'text-emerald-700' : 'text-gray-800'
                    }`}>
                      {event.title}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-[12px] text-gray-500 leading-relaxed ml-0">{event.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== Metric Summary ====================
export function MetricSummary({
  data,
}: {
  data: {
    title?: string;
    metrics: Array<{
      label: string;
      value: string | number;
      change?: number;
      changeLabel?: string;
      icon?: React.ReactNode;
    }>;
  };
}) {
  const { title, metrics } = data;

  return (
    <div className="my-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {metrics.map((m, i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              {m.icon || <Zap size={13} className="text-gray-400" />}
              <span className="text-[11px] text-gray-500 font-medium">{m.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{m.value}</p>
            {m.change !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-medium ${
                m.change >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {m.change >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                <span>{Math.abs(m.change)}%</span>
                {m.changeLabel && <span className="text-gray-400 normal-case">{m.changeLabel}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Main Renderer ====================
export function VisualRenderer({ viz }: { viz: VisualizationData }) {
  switch (viz.type) {
    case 'status-cards':
      return <StatusCards data={viz.data as Parameters<typeof StatusCards>[0]['data']} />;
    case 'metric-chart':
      return <MetricChart data={viz.data as Parameters<typeof MetricChart>[0]['data']} />;
    case 'service-topology':
      return <ServiceTopology data={viz.data as Parameters<typeof ServiceTopology>[0]['data']} />;
    case 'alert-list':
      return <AlertList data={viz.data as Parameters<typeof AlertList>[0]['data']} />;
    case 'data-table':
      return <DataTable data={viz.data as Parameters<typeof DataTable>[0]['data']} />;
    case 'progress-group':
      return <ProgressGroup data={viz.data as Parameters<typeof ProgressGroup>[0]['data']} />;
    case 'timeline':
      return <Timeline data={viz.data as Parameters<typeof Timeline>[0]['data']} />;
    case 'metric-summary':
      return <MetricSummary data={viz.data as Parameters<typeof MetricSummary>[0]['data']} />;
    default:
      return null;
  }
}
