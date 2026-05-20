import React, { useState, useMemo } from 'react';
import { Cpu, HardDrive, Wifi, Database, ArrowUpRight, AlertTriangle } from 'lucide-react';
import type { HeatmapData, HeatmapNode } from '../types/moduleData';

interface HeatmapViewProps {
  data: HeatmapData;
}

const metricConfig = {
  cpu: { label: 'CPU 利用率', icon: Cpu, unit: '%' },
  memory: { label: '内存使用率', icon: Database, unit: '%' },
  network: { label: '网络带宽', icon: Wifi, unit: 'Mbps' },
  disk: { label: '磁盘 I/O', icon: HardDrive, unit: 'IOPS' },
};

function getBarColor(value: number) {
  if (value >= 90) return { bg: '#ef4444', light: '#fee2e2', text: '#991b1b' };
  if (value >= 75) return { bg: '#f59e0b', light: '#fef3c7', text: '#92400e' };
  if (value >= 50) return { bg: '#10b981', light: '#d1fae5', text: '#065f46' };
  return { bg: '#3b82f6', light: '#dbeafe', text: '#1e40af' };
}

function getStatusIcon(status: HeatmapNode['status']) {
  switch (status) {
    case 'critical': return <AlertTriangle size={14} className="text-red-500" />;
    case 'warning': return <AlertTriangle size={14} className="text-yellow-500" />;
    default: return null;
  }
}

export default function HeatmapView({ data }: HeatmapViewProps) {
  const [sortBy, setSortBy] = useState<'value' | 'name'>('value');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const config = metricConfig[data.metricType];
  const Icon = config.icon;

  const sortedNodes = useMemo(() => {
    const sorted = [...data.nodes];
    if (sortBy === 'value') {
      sorted.sort((a, b) => b.value - a.value);
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [data.nodes, sortBy]);

  const criticalCount = data.nodes.filter(n => n.status === 'critical').length;
  const warningCount = data.nodes.filter(n => n.status === 'warning').length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${data.metricType === 'cpu' ? 'bg-red-50' : data.metricType === 'memory' ? 'bg-blue-50' : data.metricType === 'network' ? 'bg-green-50' : 'bg-orange-50'}`}>
            <Icon size={16} className={data.metricType === 'cpu' ? 'text-red-500' : data.metricType === 'memory' ? 'text-blue-500' : data.metricType === 'network' ? 'text-green-500' : 'text-orange-500'} />
          </div>
          <div>
            <span className="text-sm font-medium text-gray-800">{config.label}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-400">均值 {data.avgValue}{config.unit}</span>
              <span className="text-[10px] text-gray-400">·</span>
              <span className="text-[10px] text-gray-400">峰值 {data.maxValue}{config.unit}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(criticalCount > 0 || warningCount > 0) && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50">
              {criticalCount > 0 && <><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span className="text-[10px] font-medium text-red-600">{criticalCount}</span></>}
              {warningCount > 0 && <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /><span className="text-[10px] font-medium text-yellow-600">{warningCount}</span></>}
            </div>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'value' | 'name')}
            className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:border-indigo-300"
          >
            <option value="value">按数值排序</option>
            <option value="name">按名称排序</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {sortedNodes.map((node) => {
          const colors = getBarColor(node.value);
          const isHovered = hoveredNode === node.id;
          return (
            <div
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                isHovered ? 'bg-gray-50 shadow-sm' : ''
              } ${node.status === 'critical' ? 'bg-red-50/30' : ''}`}
            >
              <div className="w-20 shrink-0 truncate">
                <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">{node.name}</span>
              </div>

              <div className="flex-1 relative h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                    node.status === 'critical'
                      ? 'bg-gradient-to-r from-red-400 to-red-500 animate-pulse'
                      : `bg-gradient-to-r ${colors.bg.includes('ef4444') ? 'from-red-400 to-red-500' : colors.bg.includes('f59e0b') ? 'from-yellow-400 to-yellow-500' : colors.bg.includes('10b981') ? 'from-emerald-400 to-emerald-500' : 'from-blue-400 to-blue-500'}`
                  }`}
                  style={{ width: `${Math.min(node.value, 100)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end px-2">
                  <span className={`text-[11px] font-semibold tabular-nums ${
                    node.value > 60 ? 'text-white' : 'text-gray-600'
                  }`}>
                    {node.value.toFixed(1)}{config.unit}
                  </span>
                </div>
              </div>

              <div className="w-8 shrink-0 flex justify-end">
                {getStatusIcon(node.status)}
              </div>

              {isHovered && (
                <div className="absolute right-3 top-full mt-1 z-10 bg-gray-900 text-white text-[10px] px-2 py-1.5 rounded shadow-lg whitespace-nowrap">
                  <div>{node.name}</div>
                  <div className="text-gray-300">{config.label}: {node.value.toFixed(1)}{config.unit}</div>
                  <div className={node.status === 'critical' ? 'text-red-400' : node.status === 'warning' ? 'text-yellow-400' : 'text-green-400'}>
                    状态: {node.status === 'critical' ? '严重告警' : node.status === 'warning' ? '警告' : '正常'}
                  </div>
                  <div className="absolute -top-1 right-2 w-2 h-2 bg-gray-900 rotate-45" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-400">图例</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[10px] text-gray-500">&lt;50%</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] text-gray-500">50-75%</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-[10px] text-gray-500">75-90%</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] text-gray-500">&gt;90%</span></div>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 via-yellow-500 to-red-500" />
      </div>
    </div>
  );
}
