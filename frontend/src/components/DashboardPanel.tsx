import React, { useState, useEffect, useCallback } from 'react';
import { Network, BarChart3, AlertTriangle, RefreshCw, Clock, Wifi, WifiOff, Maximize2, Minimize2, HardDrive, Cpu, MemoryStick, Wifi as NetworkIcon, ExternalLink } from 'lucide-react';
import TopologyView from './TopologyView';
import HeatmapView from './HeatmapView';
import FaultImpactView from './FaultImpactView';
import DiskMonitor from './DiskMonitor';
import { useAppStore } from '../store';
import type { TopologyData, HeatmapData, FaultImpactData } from '../types/moduleData';

interface DashboardPanelProps {
  topologyData: TopologyData;
  heatmapData: HeatmapData;
  faultImpactData: FaultImpactData | null;
}

type DashboardTab = 'topology' | 'heatmap' | 'fault' | 'disk';

const tabs: { id: DashboardTab; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'topology', label: '动态拓扑', icon: <Network size={14} />, description: '服务调用链与健康状态' },
  { id: 'heatmap', label: '集群热力图', icon: <BarChart3 size={14} />, description: '负载分布与热点分析' },
  { id: 'fault', label: '故障传播', icon: <AlertTriangle size={14} />, description: '故障影响范围可视化' },
  { id: 'disk', label: '磁盘监控', icon: <HardDrive size={14} />, description: '磁盘容量与健康状态' },
];

const refreshIntervals = [
  { value: 0, label: '手动' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
];

export default function DashboardPanel({ topologyData, heatmapData, faultImpactData }: DashboardPanelProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('topology');
  const [autoRefresh, setAutoRefresh] = useState(10000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { setFloatingPanel } = useAppStore();

  const quickPanels = [
    { id: 'disk', label: '磁盘监控', icon: <HardDrive size={13} />, color: 'text-teal-600', bg: 'bg-teal-50', hoverBg: 'hover:bg-teal-100', border: 'border-teal-200' },
    { id: 'cpu', label: 'CPU 监控', icon: <Cpu size={13} />, color: 'text-blue-600', bg: 'bg-blue-50', hoverBg: 'hover:bg-blue-100', border: 'border-blue-200' },
    { id: 'memory', label: '内存监控', icon: <MemoryStick size={13} />, color: 'text-purple-600', bg: 'bg-purple-50', hoverBg: 'hover:bg-purple-100', border: 'border-purple-200' },
    { id: 'network', label: '网络流量', icon: <NetworkIcon size={13} />, color: 'text-emerald-600', bg: 'bg-emerald-50', hoverBg: 'hover:bg-emerald-100', border: 'border-emerald-200' },
  ];

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdate(Date.now());
      setIsRefreshing(false);
    }, 800);
  }, []);

  useEffect(() => {
    if (autoRefresh <= 0) return;
    const interval = setInterval(handleRefresh, autoRefresh);
    return () => clearInterval(interval);
  }, [autoRefresh, handleRefresh]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    return `${Math.floor(diff / 3600000)}h`;
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} flex flex-col bg-white`}>
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500">
              <Network size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-800 text-sm">实时可视化仪表盘</span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${
              isConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span>{isConnected ? '已连接' : '断开'}</span>
            </div>

            <select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(Number(e.target.value))}
              className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:border-indigo-300"
            >
              {refreshIntervals.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-1.5 rounded-lg transition-all ${
                isRefreshing
                  ? 'bg-indigo-50 text-indigo-400'
                  : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all"
              title={isFullscreen ? '退出全屏' : '全屏显示'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Monitor Panel Buttons */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
            <ExternalLink size={10} />
            快捷监控面板
          </span>
          <span className="text-[9px] text-gray-400">点击在左侧展开大窗口</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {quickPanels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setFloatingPanel(panel.id)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg ${panel.bg} ${panel.hoverBg} border ${panel.border} transition-all group`}
            >
              <span className={`${panel.color}`}>{panel.icon}</span>
              <span className={`text-[10px] font-medium ${panel.color} group-hover:font-semibold`}>{panel.label}</span>
              <ExternalLink size={8} className="ml-auto text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">{tabs.find(t => t.id === activeTab)?.description}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <Clock size={10} />
            <span>更新于 {formatTimeAgo(lastUpdate)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {activeTab === 'topology' && <TopologyView data={topologyData} />}
          {activeTab === 'heatmap' && <HeatmapView data={heatmapData} />}
          {activeTab === 'disk' && <DiskMonitor />}
          {activeTab === 'fault' && (
            faultImpactData
              ? <FaultImpactView data={faultImpactData} />
              : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <AlertTriangle size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">暂无活跃故障</p>
                  <p className="text-[11px] mt-1">当检测到故障时，将自动展示传播影响</p>
                </div>
              )
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <div className="flex items-center gap-3">
            <span>节点: {topologyData.nodes.length}</span>
            <span>连接: {topologyData.edges.length}</span>
            <span>集群节点: {heatmapData.nodes.length}</span>
            {faultImpactData && <span className="text-red-500">⚠ 故障中</span>}
          </div>
          <span>AIOps Dashboard v1.0</span>
        </div>
      </div>
    </div>
  );
}
