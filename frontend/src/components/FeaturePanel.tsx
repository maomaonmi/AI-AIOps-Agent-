import { useState, useCallback, useEffect } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Cpu,
  Database,
  GitBranch,
  HardDrive,
  Network,
  Server,
  Shield,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Play,
  RotateCcw,
  Search,
  TrendingUp,
  Tag,
  Star,
  Archive,
  Lightbulb,
  Users,
  Bookmark,
  Filter,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  LiveLineChart,
  AnomalyDetectionChart,
  CapacityPlanningChart,
  AutoRefreshContainer,
  PredictionScoreCard,
  PredictionTimeline,
  RealTimeDataGenerators,
} from './RealTimeCharts';
import { useAppStore } from '../store';
import { SOPDocumentCard } from './SOPFlowchart';
import type { SOPDocument } from '../types/moduleData';
import RealtimeMonitorPanel from './RealtimeMonitorPanel';

const featureDetails: Record<string, {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  actions: Array<{ label: string; query: string }>;
}> = {
  monitor: {
    title: '智能监控',
    desc: '实时监控指标分析、异常检测与趋势预测',
    icon: <Activity size={22} />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    actions: [
      { label: '查看CPU使用率', query: '查看所有服务器的CPU使用率' },
      { label: '内存使用情况', query: '查看内存使用率最高的服务器' },
      { label: '网络流量分析', query: '分析最近1小时的网络流量趋势' },
      { label: '磁盘I/O监控', query: '查看磁盘I/O性能指标' },
    ],
  },
  diagnosis: {
    title: '智能预测',
    desc: '时序趋势预测、异常提前预警与智能容量规划',
    icon: <Brain size={22} />,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    actions: [
      { label: 'CPU趋势预测', query: '预测未来24小时的CPU使用率趋势，分析是否会触发告警' },
      { label: '异常提前预警', query: '检测系统是否有潜在异常风险，提前30分钟预警' },
      { label: '容量规划建议', query: '基于历史数据给出扩容建议和时间点' },
      { label: '资源瓶颈分析', query: '分析当前系统哪些资源可能成为未来瓶颈' },
    ],
  },
  knowledge: {
    title: '知识库',
    desc: '运维SOP文档、故障案例库与最佳实践',
    icon: <BookOpen size={22} />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    actions: [
      { label: '查看SOP文档', query: '查看所有SOP文档' },
      { label: '故障案例库', query: '查看故障案例库' },
      { label: '最佳实践', query: '查看最佳实践' },
      { label: '知识搜索', query: '搜索运维知识' },
    ],
  },
  automation: {
    title: '自动化运维',
    desc: '自动化脚本执行、批量操作与定时任务',
    icon: <Zap size={22} />,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    actions: [
      { label: '执行自动化脚本', query: '执行自动化脚本' },
      { label: '批量操作', query: '批量操作' },
      { label: '定时任务', query: '定时任务' },
      { label: '自动化统计', query: '自动化统计' },
    ],
  },
};

// ==================== Fullscreen Hook ====================
function usePanelFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  const panelProps = isFullscreen
    ? 'fixed inset-0 z-[9998] bg-white/95 backdrop-blur-sm w-full h-screen overflow-y-auto left-0 right-0'
    : 'flex-1 overflow-y-auto w-full';

  const contentProps = isFullscreen
    ? 'w-full px-8 lg:px-12 py-8'
    : '';

  return { isFullscreen, toggleFullscreen, panelProps, contentProps };
}

function FullscreenButton({ isFullscreen, onClick }: { isFullscreen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center p-2 rounded-xl transition-all duration-200 ${
        isFullscreen
          ? 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 shadow-sm'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 shadow-sm hover:shadow'
      }`}
      title={isFullscreen ? '退出全屏 (ESC)' : '全屏查看'}
    >
      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );
}

// ==================== Monitor Panel ====================
function MonitorPanel({ feature }: { feature: typeof featureDetails['monitor'] }) {
  const { setQuickAction } = useAppStore();
  const { isFullscreen, toggleFullscreen, panelProps, contentProps } = usePanelFullscreen();

  return (
    <div className={`${panelProps} ${isFullscreen ? '' : 'max-w-[960px]'}`}>
      <div className={`px-6 lg:px-8 xl:px-12 py-8 ${contentProps}`}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-200">
                {feature.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{feature.title}</h2>
                <p className="text-gray-500 text-sm mt-0.5">{feature.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200">
                <Activity size={13} className="text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">实时监控</span>
              </div>
              <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
            </div>
          </div>
        </div>

        <RealtimeMonitorPanel />

        {/* Bottom Quick Actions Bar */}
        <div className="pb-8 mt-8">
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl p-5 border border-emerald-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Zap size={16} className="text-emerald-600" />
                智能运维助手
              </h3>
              <span className="text-xs text-gray-500">基于 AI 的智能分析与建议</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); setQuickAction('health'); }}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-transparent hover:border-emerald-200 group cursor-pointer"
              >
                <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                  <Activity size={16} className="text-emerald-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium text-center">系统体检</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setQuickAction('trend'); }}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-transparent hover:border-blue-200 group cursor-pointer"
              >
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <TrendingUp size={16} className="text-blue-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium text-center">趋势预测</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setQuickAction('arch'); }}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-transparent hover:border-purple-200 group cursor-pointer"
              >
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <GitBranch size={16} className="text-purple-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium text-center">架构报告</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setQuickAction('log'); }}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-transparent hover:border-rose-200 group cursor-pointer"
              >
                <div className="p-2 bg-rose-100 rounded-lg group-hover:bg-rose-200 transition-colors">
                  <BarChart3 size={16} className="text-rose-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium text-center">日志可视化</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Prediction Panel ====================
function PredictionPanel({ feature }: { feature: typeof featureDetails['diagnosis'] }) {
  const { createConversation, setActiveFeature, setCurrentMode, setActiveModuleType } = useAppStore();
  const [cpuData, setCpuData] = useState(RealTimeDataGenerators.timeSeries(30, 42, 8, 0.3));
  const [memData, setMemData] = useState(RealTimeDataGenerators.timeSeries(30, 65, 6, 0.5));
  const [anomalyData, setAnomalyData] = useState(RealTimeDataGenerators.anomaly());
  const [capacityData, setCapacityData] = useState(RealTimeDataGenerators.capacity());
  const [isLoading, setIsLoading] = useState(false);
  const { isFullscreen, toggleFullscreen, panelProps, contentProps } = usePanelFullscreen();

  const fetchRealtimeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/monitoring/realtime');
      const result = await response.json();

      if (result.status === 'success' && result.data) {
        const transformToTimeSeries = (metrics: any[], baseValue: number) => {
          if (!metrics || metrics.length === 0) return RealTimeDataGenerators.timeSeries(30, baseValue, 8, 0.3);

          const metric = metrics[0];
          const history = metric.history || [];
          const now = new Date();

          let data = history.map((h: any, i: number) => ({
            time: h.time || `${now.getHours()}:${now.getMinutes()}`,
            value: parseFloat(h.value) || baseValue,
          }));

          while (data.length < 22) {
            data.unshift({
              time: `${now.getHours()}:${now.getMinutes()}`,
              value: baseValue + (Math.random() - 0.5) * 10,
            });
          }

          const currentVal = parseFloat(metric.current) || baseValue;
          for (let i = 0; i < 8; i++) {
            const futureTime = new Date(now.getTime() + (i + 1) * 60000);
            data.push({
              time: `${futureTime.getHours().toString().padStart(2, '0')}:${futureTime.getMinutes().toString().padStart(2, '0')}`,
              value: null as unknown as number,
              predicted: currentVal + (Math.random() - 0.5) * 5,
              upper: currentVal + 10,
              lower: Math.max(0, currentVal - 10),
            });
          }

          return data;
        };

        if (result.data.cpu && result.data.cpu.length > 0) {
          setCpuData(transformToTimeSeries(result.data.cpu, 42));
        }
        if (result.data.memory && result.data.memory.length > 0) {
          setMemData(transformToTimeSeries(result.data.memory, 65));
        }
      }
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealtimeData();
    const interval = setInterval(fetchRealtimeData, 30000);
    return () => clearInterval(interval);
  }, [fetchRealtimeData]);

  const refreshAll = useCallback(() => {
    fetchRealtimeData();
    setAnomalyData(RealTimeDataGenerators.anomaly());
    setCapacityData(RealTimeDataGenerators.capacity());
  }, [fetchRealtimeData]);

  const handleActionClick = (query: string) => {
    setActiveModuleType('prediction');
    setCurrentMode('normal');
    const convId = createConversation();
    const input = document.querySelector<HTMLTextAreaElement>('textarea');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  };

  return (
    <div className={`${panelProps} ${isFullscreen ? '' : 'max-w-[960px]'}`}>
      <div className={`px-6 lg:px-8 xl:px-12 py-8 ${contentProps}`}>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-200">
                {feature.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{feature.title}</h2>
                <p className="text-gray-500 text-sm mt-0.5">{feature.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-full border border-violet-200">
                <Brain size={13} className="text-violet-600" />
                <span className="text-xs font-medium text-violet-700">AI 预测引擎</span>
              </div>
              <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
            </div>
          </div>

          {/* AI Risk Score Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <PredictionScoreCard
              score={35}
              confidence={89}
              label="CPU 风险"
              description="未来24小时预测"
              trend="stable"
            />
            <PredictionScoreCard
              score={58}
              confidence={82}
              label="内存风险"
              description="容量预警分析"
              trend="up"
            />
            <PredictionScoreCard
              score={72}
              confidence={76}
              label="磁盘风险"
              description="空间耗尽预测"
              trend="up"
            />
            <PredictionScoreCard
              score={22}
              confidence={91}
              label="异常概率"
              description="系统稳定性评估"
              trend="down"
            />
          </div>
        </div>

        {/* Main Grid: Real-time Charts */}
        <div className="grid grid-cols-2 gap-5 mb-6">

          {/* CPU Trend Prediction */}
          <AutoRefreshContainer title="CPU 使用率趋势预测" interval={8000} onRefresh={refreshAll}>
            <LiveLineChart
              data={cpuData}
              color="#6366f1"
              showPrediction={true}
              title="实时 + 未来预测（8分钟）"
              unit="%"
              currentValue={cpuData.filter(d => d.value !== null).slice(-1)[0]?.value}
            />
          </AutoRefreshContainer>

          {/* Memory Trend Prediction */}
          <AutoRefreshContainer title="内存使用率趋势预测" interval={10000} onRefresh={refreshAll}>
            <LiveLineChart
              data={memData}
              color="#8b5cf6"
              showPrediction={true}
              title="实时 + 未来预测（8分钟）"
              unit="%"
              currentValue={memData.filter(d => d.value !== null).slice(-1)[0]?.value}
            />
          </AutoRefreshContainer>
        </div>

        {/* Anomaly Detection */}
        <AutoRefreshContainer title="异常提前预警系统" interval={15000} onRefresh={refreshAll} className="mb-6">
          <AnomalyDetectionChart data={anomalyData} />
        </AutoRefreshContainer>

        {/* Capacity Planning */}
        <AutoRefreshContainer title="智能容量规划（7天预测）" interval={30000} onRefresh={refreshAll} className="mb-6">
          <CapacityPlanningChart data={capacityData} />
        </AutoRefreshContainer>

        {/* Prediction Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock size={15} className="text-violet-500" />
            <span className="text-sm font-semibold text-gray-800">AI 预测时间线</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 ml-auto">基于 LSTM 模型</span>
          </div>
          <div className="p-4">
            <PredictionTimeline events={[
              { time: '现在', event: '当前状态：系统运行正常，内存使用偏高', type: 'info' },
              { time: '+30分钟', event: '预测：内存将达到 72%，接近警告阈值', type: 'predicted', probability: 87 },
              { time: '+2小时', event: '预警：磁盘写入速率异常升高，可能触发告警', type: 'warning', probability: 73 },
              { time: '+6小时', event: '预测：内存使用率达到 85%（警告阈值）', type: 'predicted', probability: 68 },
              { time: '+14小时', event: '建议操作：执行日志清理释放磁盘空间', type: 'action' },
              { time: '+3天', event: '预测：/data 分区达到 90% 告警线', type: 'predicted', probability: 82 },
              { time: '+7天', event: '建议操作：提交扩容工单或优化存储策略', type: 'action' },
            ]} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 rounded-2xl p-5 border border-violet-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Brain size={16} className="text-violet-600" />
              AI 预测分析
            </h3>
            <span className="text-xs text-gray-500">选择预测任务，AI 将给出详细分析和可视化图表</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {feature.actions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleActionClick(action.query)}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:shadow-md transition-all border border-transparent hover:border-violet-200 group"
              >
                <div className="p-2 bg-violet-100 rounded-lg group-hover:bg-violet-200 transition-colors">
                  <TrendingUp size={16} className="text-violet-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Knowledge Panel ====================
function KnowledgePanel({ feature }: { feature: typeof featureDetails['knowledge'] }) {
  const { createConversation, setActiveFeature, setCurrentMode } = useAppStore();
  const [activeTab, setActiveTab] = useState<'sop' | 'cases' | 'best_practices'>('sop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { isFullscreen, toggleFullscreen, panelProps, contentProps } = usePanelFullscreen();

  const allTags = Array.from(new Set([
    ...mockSOPDocuments.flatMap(d => d.tags),
    ...mockIncidentCases.flatMap(c => c.tags),
    ...mockBestPractices.flatMap(p => p.tags),
  ]));

  const filteredSOPs = mockSOPDocuments.filter(d => {
    const matchSearch = !searchQuery ||
      d.title.includes(searchQuery) ||
      d.description.includes(searchQuery) ||
      d.tags.some(t => t.includes(searchQuery));
    const matchTags = selectedTags.length === 0 || selectedTags.some(t => d.tags.includes(t));
    return matchSearch && matchTags;
  });

  const filteredCases = mockIncidentCases.filter(c => {
    const matchSearch = !searchQuery ||
      c.title.includes(searchQuery) ||
      c.symptom.includes(searchQuery) ||
      c.tags.some(t => t.includes(searchQuery));
    const matchTags = selectedTags.length === 0 || selectedTags.some(t => c.tags.includes(t));
    return matchSearch && matchTags;
  });

  const filteredPractices = mockBestPractices.filter(p => {
    const matchSearch = !searchQuery ||
      p.title.includes(searchQuery) ||
      p.content.includes(searchQuery) ||
      p.tags.some(t => t.includes(searchQuery));
    const matchTags = selectedTags.length === 0 || selectedTags.some(t => p.tags.includes(t));
    return matchSearch && matchTags;
  });

  const handleActionClick = (query: string) => {
    setActiveFeature(null);
    setCurrentMode('normal');
    const convId = createConversation();
    const input = document.querySelector<HTMLTextAreaElement>('textarea');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className={`${panelProps} ${isFullscreen ? '' : 'max-w-[900px]'}`}>
      <div className={`px-6 lg:px-8 xl:px-12 py-8 ${contentProps}`}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-lg shadow-indigo-200">
                <BookOpen size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{feature.title}</h2>
                <p className="text-gray-500 text-sm mt-0.5">{feature.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-200">
                <Archive size={13} className="text-indigo-600" />
                <span className="text-xs font-medium text-indigo-700">{mockSOPDocuments.length + mockIncidentCases.length + mockBestPractices.length} 条知识</span>
              </div>
              <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索运维知识、SOP文档、故障案例..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-gray-700 placeholder:text-gray-400"
          />
        </div>

        {/* Tags Filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter size={14} className="text-gray-400 shrink-0" />
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                selectedTags.includes(tag)
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
              }`}
            >
              <Tag size={10} />
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              清除筛选
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-xl p-1">
          {[
            { key: 'sop' as const, label: 'SOP 文档', count: filteredSOPs.length },
            { key: 'cases' as const, label: '故障案例', count: filteredCases.length },
            { key: 'best_practices' as const, label: '最佳实践', count: filteredPractices.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'sop' && filteredSOPs.map(doc => (
            <SOPDocumentCard key={doc.id} document={doc} />
          ))}
          {activeTab === 'cases' && filteredCases.map((c, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{c.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{c.symptom}</p>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">成功率 {c.successRate}%</span>
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 font-medium mb-1">根因：</p>
                <p className="text-xs text-gray-500">{c.rootCause}</p>
              </div>
              <div className="mt-2 p-3 bg-emerald-50 rounded-lg">
                <p className="text-xs text-emerald-700 font-medium mb-1">解决方案：</p>
                <p className="text-xs text-emerald-600 whitespace-pre-line">{c.solution}</p>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
                <span>贡献者：{c.contributor}</span>
                <span>{c.tags.map(t => `#${t}`).join(' ')}</span>
              </div>
            </div>
          ))}
          {activeTab === 'best_practices' && filteredPractices.map((p, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={14} className="text-amber-500" />
                <h3 className="font-semibold text-gray-800 text-sm">{p.title}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">{p.content}</p>
              <div className="flex items-center gap-2">
                {p.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== Automation Panel ====================
function AutomationPanel({ feature }: { feature: typeof featureDetails['automation'] }) {
  const { isFullscreen, toggleFullscreen, panelProps } = usePanelFullscreen();
  const [activeModule, setActiveModule] = useState<'script' | 'batch' | 'disk' | 'scheduler' | 'dashboard'>('dashboard');

  return (
    <div className={`${panelProps} ${isFullscreen ? '' : 'max-w-[1400px]'}`}>
      {/* 模块切换栏 */}
      <div className="flex gap-2 mb-4 bg-white rounded-lg p-1 shadow-sm border border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveModule('dashboard')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeModule === 'dashboard'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <TrendingUp size={16} />
          运营中心
        </button>
        <button
          onClick={() => setActiveModule('scheduler')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeModule === 'scheduler'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock size={16} />
          定时任务
        </button>
        <button
          onClick={() => setActiveModule('script')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeModule === 'script'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={16} />
          脚本执行
        </button>
        <button
          onClick={() => setActiveModule('batch')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeModule === 'batch'
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Zap size={16} />
          批量操作
        </button>
        <button
          onClick={() => setActiveModule('disk')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            activeModule === 'disk'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <HardDrive size={16} />
          磁盘清理
        </button>
      </div>

      {/* 渲染对应模块 */}
      {activeModule === 'dashboard' && <AutomationDashboard />}
      {activeModule === 'scheduler' && <TaskScheduler />}
      {activeModule === 'script' && <ScriptExecutor />}
      {activeModule === 'batch' && <BatchOperationEngine isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />}
      {activeModule === 'disk' && <DiskCleaner isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />}
    </div>
  );
}

// Import ScriptExecutor component
import ScriptExecutor from './ScriptExecutor';
import BatchOperationEngine from './BatchOperationEngine';
import DiskCleaner from './DiskCleaner';
import TaskScheduler from './TaskScheduler';
import AutomationDashboard from './AutomationDashboard';
import { FileText, Zap, Clock } from 'lucide-react';

// ==================== Main Export ====================
export default function FeaturePanel() {
  const { activeFeature, setActiveFeature } = useAppStore();

  if (!activeFeature) return null;

  const feature = featureDetails[activeFeature];
  if (!feature) return null;

  const panelMap: Record<string, React.ReactNode> = {
    monitor: <MonitorPanel feature={feature} />,
    diagnosis: <PredictionPanel feature={feature} />,
    knowledge: <KnowledgePanel feature={feature} />,
    automation: <AutomationPanel feature={feature} />,
  };

  return panelMap[activeFeature] || null;
}

// ==================== Mock Data ====================
const mockSOPDocuments: SOPDocument[] = [
  {
    id: 'SOP-CPU-001',
    title: 'CPU 使用率异常排查 SOP',
    category: '性能排查',
    description: '当服务器 CPU 使用率持续超过 80% 时的标准排查流程，包含进程定位、代码分析和优化方案。',
    version: '2.1',
    author: '张运维',
    lastUpdated: '2024-12-20',
    estimatedTime: '15-30 分钟',
    tags: ['CPU', '性能', '排查'],
    steps: [
      { id: 'step-1', label: '确认告警信息', description: '查看监控面板确认 CPU 告警的服务器、阈值和持续时间', type: 'start', nextSteps: ['step-2'] },
      { id: 'step-2', label: '登录目标服务器', description: 'SSH 登录到告警服务器，执行 top 命令查看整体 CPU 使用情况', type: 'process', nextSteps: ['step-3'] },
      { id: 'step-3', label: '定位高 CPU 进程', description: '使用 top -c 或 pidstat 1 5 定位占用 CPU 最高的进程和线程', type: 'process', nextSteps: ['step-4'] },
      { id: 'step-4', label: '判断进程类型', description: '确认高 CPU 进程是业务进程还是系统进程', type: 'decision', decisionBranches: [
        { label: '业务进程', nextStep: 'step-5' },
        { label: '系统进程', nextStep: 'step-7' },
      ]},
      { id: 'step-5', label: '抓取线程堆栈', description: '使用 jstack (Java) 或 py-spy (Python) 抓取高 CPU 线程的调用堆栈', type: 'action', nextSteps: ['step-6'] },
      { id: 'step-6', label: '分析代码热点', description: '根据堆栈信息定位到具体代码行，分析是否存在死循环、频繁 GC 等问题', type: 'process', nextSteps: ['step-8'] },
      { id: 'step-7', label: '检查系统配置', description: '检查是否有定时任务、日志轮转、备份任务等系统级操作导致 CPU 飙升', type: 'process', nextSteps: ['step-8'] },
      { id: 'step-8', label: '执行优化方案', description: '根据根因执行对应优化：代码优化、配置调整、扩容或限流', type: 'action', nextSteps: ['step-9'] },
      { id: 'step-9', label: '验证恢复', description: '观察 CPU 使用率是否恢复正常，确认业务功能正常', type: 'process', nextSteps: ['step-10'] },
      { id: 'step-10', label: '记录归档', description: '将排查过程和解决方案记录到知识库，更新 SOP 文档', type: 'end' },
    ],
  },
  {
    id: 'SOP-OOM-001',
    title: 'OOM (内存溢出) 处理 SOP',
    category: '故障处理',
    description: '当服务出现 OutOfMemoryError 或 OOM Killer 触发时的标准处理流程。',
    version: '1.5',
    author: '李开发',
    lastUpdated: '2024-11-15',
    estimatedTime: '20-45 分钟',
    tags: ['OOM', '内存', 'Java'],
    steps: [
      { id: 'step-1', label: '确认 OOM 类型', description: '查看日志确认是 Heap OOM、Metaspace OOM 还是系统 OOM Killer', type: 'start', nextSteps: ['step-2'] },
      { id: 'step-2', label: '紧急恢复服务', description: '重启受影响的服务实例，恢复业务可用性', type: 'action', nextSteps: ['step-3'] },
      { id: 'step-3', label: '收集 Dump 文件', description: '使用 jmap 或配置 -XX:+HeapDumpOnOutOfMemoryError 自动收集堆转储', type: 'process', nextSteps: ['step-4'] },
      { id: 'step-4', label: '分析 Dump 文件', description: '使用 MAT (Memory Analyzer Tool) 或 JProfiler 分析内存泄漏点', type: 'process', nextSteps: ['step-5'] },
      { id: 'step-5', label: '定位泄漏对象', description: '查找 Dominator Tree 中占用内存最大的对象，追踪引用链', type: 'decision', decisionBranches: [
        { label: '发现泄漏', nextStep: 'step-6' },
        { label: '内存不足', nextStep: 'step-7' },
      ]},
      { id: 'step-6', label: '修复代码泄漏', description: '修复未关闭的资源、静态集合持续增长等内存泄漏问题', type: 'action', nextSteps: ['step-8'] },
      { id: 'step-7', label: '调整 JVM 参数', description: '增加堆内存大小 (-Xmx)，优化 GC 策略', type: 'action', nextSteps: ['step-8'] },
      { id: 'step-8', label: '压测验证', description: '在测试环境进行压力测试，验证修复效果', type: 'process', nextSteps: ['step-9'] },
      { id: 'step-9', label: '上线部署', description: '将修复后的代码部署到生产环境', type: 'end' },
    ],
  },
  {
    id: 'SOP-DISK-001',
    title: '磁盘空间不足处理 SOP',
    category: '资源管理',
    description: '当磁盘使用率超过 90% 时的标准清理和扩容流程。',
    version: '1.3',
    author: '王架构',
    lastUpdated: '2024-10-25',
    estimatedTime: '10-20 分钟',
    tags: ['磁盘', '存储', '清理'],
    steps: [
      { id: 'step-1', label: '确认告警磁盘', description: '查看监控确认是哪个挂载点磁盘空间不足', type: 'start', nextSteps: ['step-2'] },
      { id: 'step-2', label: '查找大文件', description: '使用 du -sh /* | sort -rh | head -20 查找占用空间最大的目录', type: 'process', nextSteps: ['step-3'] },
      { id: 'step-3', label: '判断文件类型', description: '确认大文件是日志、临时文件还是业务数据', type: 'decision', decisionBranches: [
        { label: '日志文件', nextStep: 'step-4' },
        { label: '临时文件', nextStep: 'step-5' },
        { label: '业务数据', nextStep: 'step-6' },
      ]},
      { id: 'step-4', label: '清理日志', description: '删除过期日志，配置 logrotate 自动切割，压缩历史日志', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-5', label: '清理临时文件', description: '清理 /tmp 目录下的过期临时文件，检查应用临时目录', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-6', label: '数据迁移/扩容', description: '将历史数据迁移到对象存储，或申请磁盘扩容', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-7', label: '验证恢复', description: '确认磁盘使用率降至安全水位 (80% 以下)', type: 'process', nextSteps: ['step-8'] },
      { id: 'step-8', label: '配置告警优化', description: '调整磁盘告警阈值，配置自动清理策略', type: 'end' },
    ],
  },
  {
    id: 'SOP-NETWORK-001',
    title: '网络故障排查 SOP',
    category: '网络排查',
    description: '当服务出现网络连通性问题、延迟增高或丢包时的标准排查流程。',
    version: '1.8',
    author: '张运维',
    lastUpdated: '2024-12-10',
    estimatedTime: '15-40 分钟',
    tags: ['网络', '延迟', '连通性'],
    steps: [
      { id: 'step-1', label: '确认故障范围', description: '确认是单点故障还是大面积故障，影响的服务范围', type: 'start', nextSteps: ['step-2'] },
      { id: 'step-2', label: '基础连通性测试', description: '使用 ping 和 telnet 测试目标服务的连通性和端口可达性', type: 'process', nextSteps: ['step-3'] },
      { id: 'step-3', label: '判断故障层级', description: '根据测试结果判断是 DNS、网络层还是应用层问题', type: 'decision', decisionBranches: [
        { label: 'DNS 问题', nextStep: 'step-4' },
        { label: '网络层问题', nextStep: 'step-5' },
        { label: '应用层问题', nextStep: 'step-6' },
      ]},
      { id: 'step-4', label: '排查 DNS', description: '检查 DNS 解析是否正常，尝试使用 hosts 文件绕过 DNS', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-5', label: '排查网络层', description: '使用 traceroute 追踪路由，检查防火墙规则和安全组配置', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-6', label: '排查应用层', description: '检查服务健康状态、连接池配置、超时设置', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-7', label: '抓包分析', description: '使用 tcpdump 或 Wireshark 抓取网络包，分析 TCP 握手和重传情况', type: 'process', nextSteps: ['step-8'] },
      { id: 'step-8', label: '修复验证', description: '执行修复方案后验证网络连通性和延迟是否恢复正常', type: 'end' },
    ],
  },
  {
    id: 'SOP-DB-001',
    title: '数据库连接池耗尽处理 SOP',
    category: '数据库',
    description: '当数据库连接池耗尽导致服务不可用时的紧急处理和根因分析流程。',
    version: '2.0',
    author: '李开发',
    lastUpdated: '2024-11-28',
    estimatedTime: '15-30 分钟',
    tags: ['数据库', '连接池', 'MySQL'],
    steps: [
      { id: 'step-1', label: '确认连接池状态', description: '查看监控确认连接池使用率、活跃连接数和等待队列', type: 'start', nextSteps: ['step-2'] },
      { id: 'step-2', label: '紧急扩容', description: '临时增加连接池最大连接数，恢复服务可用性', type: 'action', nextSteps: ['step-3'] },
      { id: 'step-3', label: '分析慢查询', description: '查看数据库慢查询日志，找出执行时间长的 SQL', type: 'process', nextSteps: ['step-4'] },
      { id: 'step-4', label: '检查连接泄漏', description: '对比连接获取和释放数量，确认是否存在连接未关闭的情况', type: 'decision', decisionBranches: [
        { label: '存在泄漏', nextStep: 'step-5' },
        { label: '无泄漏', nextStep: 'step-6' },
      ]},
      { id: 'step-5', label: '修复连接泄漏', description: '修复代码中未正确关闭数据库连接的逻辑，确保使用 try-finally 或 try-with-resources', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-6', label: '优化查询性能', description: '为慢查询添加索引，优化 SQL 语句，减少连接占用时间', type: 'action', nextSteps: ['step-7'] },
      { id: 'step-7', label: '调整连接池配置', description: '根据实际负载调整连接池大小，配置连接超时和回收策略', type: 'process', nextSteps: ['step-8'] },
      { id: 'step-8', label: '监控告警', description: '配置连接池使用率告警，设置自动扩容策略', type: 'end' },
    ],
  },
];

const mockIncidentCases = [
  {
    id: 'INC-2024-001',
    title: '订单服务CPU飙升导致响应超时',
    symptom: '订单服务CPU使用率突然飙升至95%，接口响应时间超过5秒',
    rootCause: '缓存穿透导致大量请求直接打到数据库，引发CPU过载',
    solution: '1. 启用布隆过滤器防止缓存穿透\n2. 增加热点数据本地缓存\n3. 优化数据库慢查询',
    contributor: '张运维',
    successRate: 98,
    tags: ['CPU', '缓存', '数据库'],
  },
  {
    id: 'INC-2024-002',
    title: 'MySQL 主从延迟导致数据不一致',
    symptom: '用户反馈数据更新后查询结果不一致，延迟最高达30秒',
    rootCause: '大事务导致从库SQL线程执行缓慢，复制延迟累积',
    solution: '1. 拆分大事务为多个小事务\n2. 启用并行复制\n3. 优化慢查询减少锁持有时间',
    contributor: '李DBA',
    successRate: 95,
    tags: ['MySQL', '主从', '延迟'],
  },
  {
    id: 'INC-2024-003',
    title: 'Redis 内存溢出导致服务不可用',
    symptom: 'Redis 实例内存使用率达到100%，触发内存淘汰策略，大量缓存丢失',
    rootCause: '缓存Key未设置过期时间，导致内存持续增长',
    solution: '1. 为所有缓存Key设置合理的过期时间\n2. 启用LRU淘汰策略\n3. 增加Redis集群节点',
    contributor: '王架构',
    successRate: 92,
    tags: ['Redis', '内存', '缓存'],
  },
];

const mockBestPractices = [
  {
    id: 'BP-001',
    title: '微服务限流降级最佳实践',
    content: '在微服务架构中，限流和降级是保障系统稳定性的重要手段。建议使用 Sentinel 或 Hystrix 实现熔断降级，配合 Nginx 或 Gateway 实现入口限流。',
    tags: ['微服务', '限流', '降级'],
    type: 'best_practice' as const,
  },
  {
    id: 'BP-002',
    title: '数据库索引优化指南',
    content: '合理的索引设计可以大幅提升查询性能。建议：1. 为高频查询字段创建索引 2. 避免过多索引影响写入性能 3. 定期分析慢查询日志优化索引',
    tags: ['数据库', '索引', '性能'],
    type: 'best_practice' as const,
  },
  {
    id: 'BP-003',
    title: '容器化部署最佳实践',
    content: '使用 Docker 和 Kubernetes 进行容器化部署时，建议：1. 镜像分层构建减少体积 2. 配置健康检查探针 3. 设置资源限制防止资源争抢',
    tags: ['Docker', 'K8s', '容器'],
    type: 'best_practice' as const,
  },
  {
    id: 'BP-004',
    title: '日志采集与分析规范',
    content: '统一的日志规范有助于快速定位问题。建议：1. 使用结构化日志（JSON格式）2. 包含TraceID便于链路追踪 3. 分级记录避免日志膨胀',
    tags: ['日志', 'ELK', '监控'],
    type: 'best_practice' as const,
  },
  {
    id: 'BP-005',
    title: '高可用架构设计原则',
    content: '设计高可用系统时应遵循：1. 消除单点故障 2. 故障自动转移 3. 限流降级保护 4. 监控告警覆盖 5. 混沌工程验证',
    tags: ['高可用', '架构', '设计'],
    type: 'best_practice' as const,
  },
  {
    id: 'BP-006',
    title: 'API 网关性能优化',
    content: 'API网关作为流量入口，性能至关重要。建议：1. 启用连接池复用 2. 配置合理的超时时间 3. 使用异步非阻塞处理 4. 启用缓存减少后端压力',
    tags: ['网关', '性能', '优化'],
    type: 'best_practice' as const,
  },
  {
    id: 'BP-007',
    title: '分布式事务处理方案',
    content: '分布式事务推荐使用：1. 最终一致性（消息队列）2. TCC模式（Try-Confirm-Cancel）3. Saga模式（长事务拆分）4. 本地消息表',
    tags: ['分布式', '事务', '一致性'],
    type: 'best_practice' as const,
  },
  {
    id: 'BP-008',
    title: '微服务熔断降级最佳实践',
    content: '熔断降级是微服务稳定性保障的核心机制。建议：1. 设置合理的熔断阈值 2. 配置降级策略（返回默认值/缓存数据）3. 半开状态自动恢复',
    tags: ['微服务', '熔断', '高可用'],
    type: 'best_practice' as const,
  },
];
