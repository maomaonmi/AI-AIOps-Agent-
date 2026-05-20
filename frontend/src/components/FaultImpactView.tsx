import React, { useState, useMemo } from 'react';
import { AlertTriangle, Clock, Users, TrendingUp, ArrowDownRight, Zap, Timer, ServerCrash, Wifi } from 'lucide-react';
import type { FaultImpactData, ImpactNode } from '../types/moduleData';

interface FaultImpactViewProps {
  data: FaultImpactData;
}

function getFaultIcon(type: FaultImpactData['faultType']) {
  switch (type) {
    case 'timeout': return <Timer size={16} />;
    case 'error_5xx': return <ServerCrash size={16} />;
    case 'high_latency': return <TrendingUp size={16} />;
    case 'resource_exhausted': return <Zap size={16} />;
  }
}

function getFaultLabel(type: FaultImpactData['faultType']) {
  switch (type) {
    case 'timeout': return '响应超时';
    case 'error_5xx': return '服务错误 (5xx)';
    case 'high_latency': return '延迟过高';
    case 'resource_exhausted': return '资源耗尽';
  }
}

function getImpactColor(level: ImpactNode['impactLevel']) {
  switch (level) {
    case 'critical': return { border: '#ef4444', bg: '#fee2e2', text: '#991b1b', badge: 'bg-red-100 text-red-700', width: 3 };
    case 'high': return { border: '#f97316', bg: '#fff7ed', text: '#9a3412', badge: 'bg-orange-100 text-orange-700', width: 2.5 };
    case 'medium': return { border: '#f59e0b', bg: '#fef3c7', text: '#92400e', badge: 'bg-yellow-100 text-yellow-700', width: 2 };
    case 'low': return { border: '#6b7280', bg: '#f3f4f6', text: '#374151', badge: 'bg-gray-100 text-gray-600', width: 1.5 };
  }
}

function getImpactLabel(level: ImpactNode['impactLevel']) {
  switch (level) {
    case 'critical': return '严重';
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
  }
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;
const H_GAP = 40;
const V_GAP = 24;

export default function FaultImpactView({ data }: FaultImpactViewProps) {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const selectedData = selectedService ? data.affectedServices.find(s => s.serviceId === selectedService) : null;

  const groupedByDepth = useMemo(() => {
    const groups: ImpactNode[][] = [[{
      serviceId: 'source',
      serviceName: data.faultSource,
      impactLevel: 'critical',
      affectedUsers: data.totalAffectedUsers,
      propagationPath: [],
      metrics: undefined,
    }]];

    const maxDepth = Math.max(...data.affectedServices.map(s => s.propagationPath.length), 0);
    for (let depth = 1; depth <= maxDepth; depth++) {
      const nodesAtDepth = data.affectedServices.filter(s => s.propagationPath.length === depth);
      if (nodesAtDepth.length > 0) {
        groups.push(nodesAtDepth.sort((a, b) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          return order[a.impactLevel] - order[b.impactLevel];
        }));
      }
    }

    return groups;
  }, [data]);

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const faultTimeAgo = useMemo(() => {
    const diff = Date.now() - data.startTime;
    if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    return `${Math.floor(diff / 3600000)}小时前`;
  }, [data.startTime]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${
            data.faultType === 'error_5xx' ? 'bg-red-50' :
            data.faultType === 'timeout' ? 'bg-orange-50' :
            data.faultType === 'resource_exhausted' ? 'bg-yellow-50' : 'bg-purple-50'
          }`}>
            <span className={
              data.faultType === 'error_5xx' ? 'text-red-500' :
              data.faultType === 'timeout' ? 'text-orange-500' :
              data.faultType === 'resource_exhausted' ? 'text-yellow-500' : 'text-purple-500'
            }>
              {getFaultIcon(data.faultType)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{data.description}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                data.faultType === 'error_5xx' ? 'bg-red-100 text-red-600' :
                data.faultType === 'timeout' ? 'bg-orange-100 text-orange-600' :
                data.faultType === 'resource_exhausted' ? 'bg-yellow-100 text-yellow-600' : 'bg-purple-100 text-purple-600'
              }`}>
                {getFaultLabel(data.faultType)}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><Clock size={11} />{faultTimeAgo}</span>
              <span className="flex items-center gap-1"><Users size={11} />影响 ~{data.totalAffectedUsers.toLocaleString()} 用户</span>
              <span className="flex items-center gap-1"><AlertTriangle size={11} />{data.affectedServices.length} 个关联服务</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-2">
        <div className="flex gap-2 min-w-max px-2">
          {groupedByDepth.map((group, depthIdx) => (
            <div key={depthIdx} className="flex flex-col gap-2" style={{ minWidth: NODE_WIDTH + 20 }}>
              {depthIdx > 0 && (
                <div className="text-[10px] text-gray-400 font-medium mb-1 text-center">
                  第 {depthIdx} 层
                </div>
              )}
              {group.map((node) => {
                const colors = getImpactColor(node.impactLevel);
                const isSource = node.serviceId === 'source';
                const isExpanded = expandedNodes.has(node.serviceId);
                const isSelected = selectedService === node.serviceId;

                return (
                  <div
                    key={node.serviceId}
                    onClick={() => setSelectedService(isSelected ? null : node.serviceId)}
                    onMouseEnter={() => !isSource && toggleExpand(node.serviceId)}
                    style={{
                      borderLeftWidth: isSource ? 0 : colors.width,
                      borderColor: isSource ? undefined : colors.border,
                    }}
                    className={`relative p-3 rounded-xl cursor-pointer transition-all ${
                      isSource
                        ? `bg-gradient-to-br ${data.faultType === 'error_5xx' ? 'from-red-50 to-red-100/50 border-2 border-red-200' : data.faultType === 'timeout' ? 'from-orange-50 to-orange-100/50 border-2 border-orange-200' : 'from-yellow-50 to-yellow-100/50 border-2 border-yellow-200'}`
                        : isSelected
                          ? `border-l-[${colors.width}px] ${colors.bg} shadow-sm`
                          : `border-l-[${colors.width}px] bg-white hover:${colors.bg.replace('bg-', '')}/30`
                    }`}
                  >
                    {isSource && (
                      <>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
                      </>
                    )}

                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold truncate ${isSource ? 'text-red-700' : colors.text}`}>
                        {isSource ? '⚠ ' : ''}{node.serviceName}
                      </span>
                      {!isSource && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ml-1 ${colors.badge}`}>
                          {getImpactLabel(node.impactLevel)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5"><Users size={10} />{node.affectedUsers.toLocaleString()}</span>
                      {node.metrics && (
                        <>
                          <span>·</span>
                          <span className={node.metrics.errorRateIncrease > 50 ? 'text-red-500' : 'text-yellow-500'}>
                            +{node.metrics.errorRateIncrease.toFixed(0)}%
                          </span>
                        </>
                      )}
                    </div>

                    {(isExpanded || isSource || isSelected) && node.metrics && (
                      <div className="mt-2 pt-2 border-t border-gray-100/50 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">错误率上升</span>
                          <span className="font-medium text-red-500">+{node.metrics.errorRateIncrease.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">延迟增加</span>
                          <span className="font-medium text-orange-500">+{node.metrics.latencyIncrease}ms</span>
                        </div>
                        {node.propagationPath.length > 0 && (
                          <div className="text-[9px] text-gray-300 mt-1">
                            路径: {node.propagationPath.join(' → ')}
                          </div>
                        )}
                      </div>
                    )}

                    {depthIdx < groupedByDepth.length - 1 && !isSource && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-gray-300">
                        <ArrowDownRight size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="font-medium">影响等级:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 rounded" />严重</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-orange-500 rounded" />高</span>
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-yellow-500 rounded" />中</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-0.5 bg-gray-400 rounded" />低</span>
          </div>
          <div className="text-[10px] text-gray-400">
            点击节点查看详情 · 悬停展开指标
          </div>
        </div>
      </div>
    </div>
  );
}
