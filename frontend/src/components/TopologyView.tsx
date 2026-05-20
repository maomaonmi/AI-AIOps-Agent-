import React, { useState, useMemo } from 'react';
import { Network, Server, Database, HardDrive, MessageSquare, ArrowRightLeft, Activity, AlertTriangle } from 'lucide-react';
import type { TopologyData, TopologyNode } from '../types/moduleData';

interface TopologyViewProps {
  data: TopologyData;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 56;
const H_GAP = 80;
const V_GAP = 60;

function getNodeIcon(type: TopologyNode['type']) {
  switch (type) {
    case 'gateway': return <Network size={18} />;
    case 'service': return <Server size={18} />;
    case 'database': return <Database size={18} />;
    case 'cache': return <HardDrive size={18} />;
    case 'queue':
    case 'message': return <MessageSquare size={18} />;
    default: return <Server size={18} />;
  }
}

function getStatusColor(status: TopologyNode['status']) {
  switch (status) {
    case 'healthy': return { border: '#10b981', bg: '#d1fae5', text: '#065f46', dot: '#10b981' };
    case 'warning': return { border: '#f59e0b', bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' };
    case 'error': return { border: '#ef4444', bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' };
    default: return { border: '#9ca3af', bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' };
  }
}

function getTypeColor(type: TopologyNode['type']) {
  switch (type) {
    case 'gateway': return { iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500', label: '网关' };
    case 'service': return { iconBg: 'bg-blue-50', iconColor: 'text-blue-500', label: '服务' };
    case 'database': return { iconBg: 'bg-green-50', iconColor: 'text-green-500', label: '数据库' };
    case 'cache': return { iconBg: 'bg-orange-50', iconColor: 'text-orange-500', label: '缓存' };
    case 'queue': return { iconBg: 'bg-purple-50', iconColor: 'text-purple-500', label: '队列' };
    case 'message': return { iconBg: 'bg-pink-50', iconColor: 'text-pink-500', label: '消息' };
    default: return { iconBg: 'bg-gray-50', iconColor: 'text-gray-500', label: '未知' };
  }
}

interface LayoutNode extends TopologyNode {
  x: number;
  y: number;
  layer: number;
}

function computeLayout(data: TopologyData): { nodes: LayoutNode[]; width: number; height: number } {
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  const layers: string[][] = [];
  const assigned = new Set<string>();

  const gateways = data.nodes.filter(n => n.type === 'gateway');
  if (gateways.length > 0) {
    layers.push(gateways.map(n => n.id));
    gateways.forEach(n => assigned.add(n.id));
  }

  for (let i = 0; i < 10; i++) {
    const nextLayer: string[] = [];
    const prevLayerIds = layers.length > 0 ? layers[layers.length - 1] : [];
    data.edges.forEach(edge => {
      if (prevLayerIds.includes(edge.source) && !assigned.has(edge.target)) {
        if (!nextLayer.includes(edge.target)) {
          nextLayer.push(edge.target);
        }
      }
    });
    if (nextLayer.length === 0) break;
    layers.push(nextLayer);
    nextLayer.forEach(id => assigned.add(id));
  }

  data.nodes.forEach(node => {
    if (!assigned.has(node.id)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(node.id);
    }
  });

  const layoutNodes: LayoutNode[] = [];
  let maxNodesInLayer = 0;
  layers.forEach(layer => {
    if (layer.length > maxNodesInLayer) maxNodesInLayer = layer.length;
  });

  layers.forEach((layer, layerIndex) => {
    const startY = (maxNodesInLayer * (NODE_HEIGHT + V_GAP)) / 2 - (layer.length * (NODE_HEIGHT + V_GAP)) / 2;
    layer.forEach((nodeId, nodeIndex) => {
      const node = nodeMap.get(nodeId)!;
      layoutNodes.push({
        ...node,
        x: layerIndex * (NODE_WIDTH + H_GAP),
        y: startY + nodeIndex * (NODE_HEIGHT + V_GAP),
        layer: layerIndex,
      });
    });
  });

  const width = Math.max(layers.length, 1) * (NODE_WIDTH + H_GAP) - H_GAP + 40;
  const height = maxNodesInLayer * (NODE_HEIGHT + V_GAP) + 40;

  return { nodes: layoutNodes, width, height };
}

export default function TopologyView({ data }: TopologyViewProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { nodes: layoutNodes, width, height } = useMemo(() => computeLayout(data), [data]);
  const selectedNodeData = selectedNode ? data.nodes.find(n => n.id === selectedNode) : null;

  const healthyCount = data.nodes.filter(n => n.status === 'healthy').length;
  const warningCount = data.nodes.filter(n => n.status === 'warning').length;
  const errorCount = data.nodes.filter(n => n.status === 'error').length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50">
            <Network size={16} className="text-blue-500" />
          </div>
          <span className="text-sm font-medium text-gray-800">服务调用拓扑</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">{data.nodes.length} 节点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] text-gray-500">{healthyCount}</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-[10px] text-gray-500">{warningCount}</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-[10px] text-gray-500">{errorCount}</span></div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto"
          style={{ minWidth: width }}
        >
          <defs>
            <marker id="arrowhead-topo" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
            <filter id="shadow-topo">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
            </filter>
          </defs>

          {data.edges.map((edge, idx) => {
            const sourceNode = layoutNodes.find(n => n.id === edge.source);
            const targetNode = layoutNodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;
            const startX = sourceNode.x + NODE_WIDTH;
            const startY = sourceNode.y + NODE_HEIGHT / 2;
            const endX = targetNode.x;
            const endY = targetNode.y + NODE_HEIGHT / 2;
            const midX = (startX + endX) / 2;
            const isWarning = edge.latency > 200 || edge.qps > 10000;
            return (
              <g key={`edge-${idx}`}>
                <path
                  d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke={isWarning ? '#f59e0b' : '#cbd5e1'}
                  strokeWidth={isWarning ? 2 : 1.5}
                  markerEnd="url(#arrowhead-topo)"
                  opacity={0.6}
                />
                {(edge.latency > 0 || edge.qps > 0) && (
                  <rect x={midX - 28} y={(startY + endY) / 2 - 9} width={56} height={18} rx={9} fill="white" stroke="#e5e7eb" strokeWidth={0.5} />
                )}
                {edge.latency > 0 && (
                  <text x={midX} y={(startY + endY) / 2 + 1} textAnchor="middle" fontSize="9" fill={isWarning ? '#d97706' : '#64748b'} fontWeight="500">
                    {edge.latency}ms
                  </text>
                )}
              </g>
            );
          })}

          {layoutNodes.map((node) => {
            const statusColors = getStatusColor(node.status);
            const typeConfig = getTypeColor(node.type);
            const isSelected = selectedNode === node.id;
            return (
              <g key={node.id} onClick={() => setSelectedNode(isSelected ? null : node.id)} style={{ cursor: 'pointer' }}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={12}
                  fill="white"
                  stroke={isSelected ? statusColors.border : '#e5e7eb'}
                  strokeWidth={isSelected ? 2 : 1}
                  filter="url(#shadow-topo)"
                  opacity={isSelected ? 1 : 0.95}
                />
                {node.status === 'error' && (
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={12}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    opacity={0.6}
                  >
                    <animate attributeName="stroke-dashoffset" values="0;6" dur="1s" repeatCount="indefinite" />
                  </rect>
                )}
                <circle cx={node.x + 20} cy={node.y + NODE_HEIGHT / 2} r={14} fill={typeConfig.iconBg.replace('bg-', '')}>
                  <title>{typeConfig.label}</title>
                </circle>
                <foreignObject x={node.x + 8} y={node.y + NODE_HEIGHT / 2 - 12} width={24} height={24}>
                  <div className={`w-6 h-6 rounded-full ${typeConfig.iconBg} flex items-center justify-center`}>
                    <span className={typeConfig.iconColor}>{getNodeIcon(node.type)}</span>
                  </div>
                </foreignObject>
                <text x={node.x + 40} y={node.y + NODE_HEIGHT / 2 - 4} fontSize="11" fontWeight="600" fill="#1f2937">{node.name}</text>
                <text x={node.x + 40} y={node.y + NODE_HEIGHT / 2 + 12} fontSize="9" fill="#9ca3af">{typeConfig.label}</text>
                <circle cx={node.x + NODE_WIDTH - 12} cy={node.y + 12} r={4} fill={statusColors.dot}>
                  {node.status === 'error' && (
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
                  )}
                </circle>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNodeData && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded ${getTypeColor(selectedNodeData.type).iconBg}`}>
                {getNodeIcon(selectedNodeData.type)}
              </div>
              <span className="text-sm font-medium text-gray-800">{selectedNodeData.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedNodeData.status === 'healthy' ? 'bg-green-100 text-green-600' :
                selectedNodeData.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                'bg-red-100 text-red-600'
              }`}>
                {selectedNodeData.status === 'healthy' ? '健康' : selectedNodeData.status === 'warning' ? '警告' : '故障'}
              </span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-xs text-gray-400 hover:text-gray-600">关闭</button>
          </div>
          {selectedNodeData.metrics && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-xs font-semibold text-indigo-600">{selectedNodeData.metrics.qps.toLocaleString()}</div>
                <div className="text-[10px] text-gray-400">QPS</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg">
                <div className={`text-xs font-semibold ${selectedNodeData.metrics.errorRate > 1 ? 'text-red-500' : 'text-green-500'}`}>{selectedNodeData.metrics.errorRate.toFixed(2)}%</div>
                <div className="text-[10px] text-gray-400">错误率</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg">
                <div className={`text-xs font-semibold ${selectedNodeData.metrics.p99Latency > 500 ? 'text-red-500' : selectedNodeData.metrics.p99Latency > 200 ? 'text-yellow-500' : 'text-green-500'}`}>{selectedNodeData.metrics.p99Latency}ms</div>
                <div className="text-[10px] text-gray-400">P99 延迟</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-center gap-4 text-[10px] text-gray-400">
        <div className="flex items-center gap-1"><Network size={12} /><span>网关</span></div>
        <div className="flex items-center gap-1"><Server size={12} /><span>服务</span></div>
        <div className="flex items-center gap-1"><Database size={12} /><span>数据库</span></div>
        <div className="flex items-center gap-1"><HardDrive size={12} /><span>缓存</span></div>
        <div className="flex items-center gap-1"><MessageSquare size={12} /><span>消息</span></div>
      </div>
    </div>
  );
}
