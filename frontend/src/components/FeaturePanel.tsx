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
  Clock,
  FileText,
  Play,
  RotateCcw,
  Search,
  TrendingUp,
  Zap,
  Tag,
  Star,
  Archive,
  Lightbulb,
  Users,
  Bookmark,
  Filter,
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
    desc: '运维知识检索、SOP查询与最佳实践推荐',
    icon: <BookOpen size={22} />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    actions: [
      { label: 'CPU异常SOP', query: 'CPU使用率异常的标准处理流程是什么？' },
      { label: 'OOM处理流程', query: 'Java OOM的处理流程和排查步骤' },
      { label: '磁盘满处理', query: '磁盘空间不足的标准处理流程' },
      { label: '网络故障排查', query: '网络连接异常的排查步骤' },
    ],
  },
  automation: {
    title: '自动修复',
    desc: '智能故障自愈、自动化处理与安全回滚',
    icon: <Zap size={22} />,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    actions: [
      { label: '重启异常服务', query: '自动重启CPU使用率异常的Java服务' },
      { label: '清理磁盘空间', query: '自动清理磁盘空间不足的服务器' },
      { label: '扩容连接池', query: '自动扩容数据库连接池' },
      { label: '故障自愈报告', query: '查看最近自动修复的操作记录' },
    ],
  },
};

const statusCards = [
  { icon: <Cpu size={16} />, label: 'CPU', value: '正常', percent: 35, color: 'emerald' },
  { icon: <HardDrive size={16} />, label: '磁盘', value: '警告', percent: 78, color: 'amber' },
  { icon: <Database size={16} />, label: '数据库', value: '正常', percent: 42, color: 'emerald' },
  { icon: <Network size={16} />, label: '网络', value: '正常', percent: 28, color: 'emerald' },
];

const mockChartData = {
  cpu: [32, 35, 38, 42, 39, 45, 41, 36, 34, 38, 40, 35],
  memory: [58, 60, 62, 65, 63, 68, 70, 67, 64, 66, 69, 65],
  network: [20, 25, 30, 28, 35, 40, 38, 42, 45, 43, 48, 50],
};

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color === 'emerald' ? '#10b981' : '#f59e0b'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color === 'emerald' ? '#10b981' : '#f59e0b'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#grad-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color === 'emerald' ? '#10b981' : '#f59e0b'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ServiceTopology() {
  const services = [
    { name: 'API Gateway', status: 'healthy', x: 50, y: 15 },
    { name: '用户服务', status: 'healthy', x: 25, y: 40 },
    { name: '订单服务', status: 'warning', x: 50, y: 40 },
    { name: '支付服务', status: 'healthy', x: 75, y: 40 },
    { name: 'MySQL', status: 'healthy', x: 30, y: 70 },
    { name: 'Redis', status: 'healthy', x: 55, y: 70 },
    { name: 'MQ', status: 'warning', x: 75, y: 70 },
  ];

  return (
    <div className="relative bg-gray-50 rounded-xl p-4 h-[200px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 85">
        <line x1="50" y1="18" x2="25" y2="42" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="2,2" />
        <line x1="50" y1="18" x2="50" y2="42" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="2,2" />
        <line x1="50" y1="18" x2="75" y2="42" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="2,2" />
        <line x1="25" y1="44" x2="30" y2="72" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="2,2" />
        <line x1="50" y1="44" x2="53" y2="72" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="2,2" />
        <line x1="75" y1="44" x2="73" y2="72" stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="2,2" />
      </svg>
      {services.map((svc) => (
        <div
          key={svc.name}
          className="absolute flex flex-col items-center gap-1 transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${svc.x}%`, top: `${svc.y}%` }}
        >
          <div className={`px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm border ${
            svc.status === 'healthy'
              ? 'bg-white border-emerald-200 text-emerald-700'
              : 'bg-white border-amber-200 text-amber-700'
          }`}>
            {svc.name}
          </div>
          <div className={`w-1.5 h-1.5 rounded-full ${
            svc.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
        </div>
      ))}
    </div>
  );
}

function AlertCard({ type, message, time }: { type: string; message: string; time: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-red-800 font-medium">{message}</p>
        <p className="text-[11px] text-red-400 mt-0.5">{time}</p>
      </div>
    </div>
  );
}

function MonitorPanel({ feature }: { feature: typeof featureDetails['monitor'] }) {
  const { setQuickAction } = useAppStore();

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <RealtimeMonitorPanel />
      
      {/* Bottom Quick Actions Bar */}
      <div className="px-6 lg:px-8 xl:px-12 pb-8">
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
  );
}

function PredictionPanel({ feature }: { feature: typeof featureDetails['diagnosis'] }) {
  const { createConversation, setActiveFeature, setCurrentMode, setActiveModuleType } = useAppStore();
  const [cpuData, setCpuData] = useState(RealTimeDataGenerators.timeSeries(30, 42, 8, 0.3));
  const [memData, setMemData] = useState(RealTimeDataGenerators.timeSeries(30, 65, 6, 0.5));
  const [anomalyData, setAnomalyData] = useState(RealTimeDataGenerators.anomaly());
  const [capacityData, setCapacityData] = useState(RealTimeDataGenerators.capacity());
  const [isLoading, setIsLoading] = useState(false);
  
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
    <div className="flex-1 overflow-y-auto w-full max-w-[960px]">
      <div className="px-6 lg:px-8 xl:px-12 py-8">
        
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-full border border-violet-200">
              <Brain size={13} className="text-violet-600" />
              <span className="text-xs font-medium text-violet-700">AI 预测引擎</span>
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
    appliedCount: 12,
    tags: ['CPU', '缓存', '数据库'],
    lastVerifiedAt: '2024-12-15',
    type: 'incident_record' as const,
  },
  {
    id: 'INC-2024-002',
    title: 'MySQL连接池耗尽导致服务不可用',
    symptom: '多个服务同时报数据库连接超时错误',
    rootCause: '连接池配置过小，且存在连接泄漏问题',
    solution: '1. 调整连接池大小（min:20 max:100）\n2. 修复连接未关闭的代码\n3. 增加连接池监控告警',
    contributor: '李开发',
    successRate: 95,
    appliedCount: 8,
    tags: ['MySQL', '连接池', '配置优化'],
    lastVerifiedAt: '2024-11-20',
    type: 'incident_record' as const,
  },
  {
    id: 'INC-2024-003',
    title: 'Redis内存溢出引发OOM',
    symptom: 'Redis实例频繁重启，keys数量激增',
    rootCause: '未设置过期时间的缓存数据持续增长',
    solution: '1. 为所有缓存设置合理的TTL\n2. 启用内存淘汰策略（allkeys-lru）\n3. 增加内存使用监控',
    contributor: '王架构',
    successRate: 100,
    appliedCount: 5,
    tags: ['Redis', '内存', 'OOM'],
    lastVerifiedAt: '2024-10-08',
    type: 'incident_record' as const,
  },
  {
    id: 'INC-2024-004',
    title: '磁盘IO瓶颈导致日志写入延迟',
    symptom: '应用日志出现大量写入延迟，磁盘使用率100%',
    rootCause: '日志文件未做切割，单文件过大导致IO性能下降',
    solution: '1. 配置logrotate按天切割日志\n2. 迁移历史日志到对象存储\n3. 优化日志级别减少不必要的输出',
    contributor: '张运维',
    successRate: 92,
    appliedCount: 15,
    tags: ['磁盘', '日志', 'IO'],
    lastVerifiedAt: '2024-12-01',
    type: 'incident_record' as const,
  },
];

const mockBestPractices = [
  {
    title: 'Kubernetes Pod 资源限制配置规范',
    content: '为所有Pod设置合理的requests和limits，避免资源争抢和OOM。CPU requests建议设置为平均使用量的80%，limits设置为峰值的120%。',
    contributor: '王架构',
    appliedCount: 45,
    tags: ['K8s', '资源管理', '规范'],
    type: 'best_practice' as const,
  },
  {
    title: '数据库索引优化 checklist',
    content: '1. 检查慢查询日志中扫描行数>10000的SQL\n2. 为WHERE条件中的高频字段添加索引\n3. 避免在索引列上使用函数\n4. 定期使用EXPLAIN分析查询计划',
    contributor: '李开发',
    appliedCount: 32,
    tags: ['MySQL', '索引', '性能优化'],
    type: 'best_practice' as const,
  },
  {
    title: '微服务熔断降级策略',
    content: '配置Hystrix熔断规则：错误率>50%且请求数>20时开启熔断，熔断时间30秒。降级策略返回本地缓存或默认值。',
    contributor: '张运维',
    appliedCount: 28,
    tags: ['微服务', '熔断', '高可用'],
    type: 'best_practice' as const,
  },
];

function KnowledgePanel({ feature }: { feature: typeof featureDetails['knowledge'] }) {
  const { createConversation, setActiveFeature, setCurrentMode } = useAppStore();
  const [activeTab, setActiveTab] = useState<'sop' | 'cases' | 'best_practices'>('sop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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
    <div className="flex-1 overflow-y-auto w-full max-w-[900px]">
      <div className="px-6 lg:px-8 xl:px-12 py-8">
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-200">
              <Archive size={13} className="text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700">{mockSOPDocuments.length + mockIncidentCases.length + mockBestPractices.length} 条知识</span>
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
        <div className="flex items-center gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'sop' as const, label: 'SOP文档', icon: <FileText size={14} /> },
            { key: 'cases' as const, label: '故障案例库', icon: <Archive size={14} /> },
            { key: 'best_practices' as const, label: '最佳实践', icon: <Lightbulb size={14} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'sop' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                  {mockSOPDocuments.length}
                </span>
              )}
              {tab.key === 'cases' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                  {mockIncidentCases.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'sop' && (
          <div className="space-y-4">
            {filteredSOPs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">未找到匹配的 SOP 文档</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-indigo-500" />
                    <span className="text-sm font-medium text-gray-700">标准操作流程</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{filteredSOPs.length}</span>
                  </div>
                </div>
                {filteredSOPs.map(doc => (
                  <SOPDocumentCard key={doc.id} document={doc} onApply={handleActionClick} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cases' && (
          <div className="space-y-4">
            {filteredCases.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Archive size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">未找到匹配的故障案例</p>
              </div>
            ) : (
              filteredCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 font-medium">
                          {caseItem.id}
                        </span>
                        <h3 className="text-sm font-semibold text-gray-800">{caseItem.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star size={12} fill="currentColor" />
                        <span className="text-xs font-medium">{caseItem.successRate}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {caseItem.contributor}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bookmark size={11} />
                        应用 {caseItem.appliedCount} 次
                      </span>
                      <span>验证于 {caseItem.lastVerifiedAt}</span>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <p className="text-[11px] font-medium text-gray-500 mb-1">故障现象</p>
                      <p className="text-xs text-gray-700">{caseItem.symptom}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-gray-500 mb-1">根因分析</p>
                      <p className="text-xs text-gray-700">{caseItem.rootCause}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-gray-500 mb-1">解决方案</p>
                      <p className="text-xs text-gray-700 whitespace-pre-line">{caseItem.solution}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      {caseItem.tags.map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleActionClick(`如何排查和解决：${caseItem.title}`)}
                        className="flex-1 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                      >
                        查看详细方案
                      </button>
                      <button
                        onClick={() => handleActionClick(`帮我分析是否遇到了类似 ${caseItem.title} 的问题`)}
                        className="px-3 py-2 rounded-lg bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors"
                      >
                        应用到当前故障
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'best_practices' && (
          <div className="space-y-4">
            {filteredPractices.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Lightbulb size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">未找到匹配的最佳实践</p>
              </div>
            ) : (
              filteredPractices.map((practice, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb size={16} className="text-amber-500" />
                        <h3 className="text-sm font-semibold text-gray-800">{practice.title}</h3>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-medium">
                        应用 {practice.appliedCount} 次
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users size={11} />
                      {practice.contributor}
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-gray-700 whitespace-pre-line">{practice.content}</p>
                    <div className="flex items-center gap-2 pt-3">
                      {practice.tags.map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AutomationPanel({ feature }: { feature: typeof featureDetails['automation'] }) {
  const { createConversation, setActiveFeature, setCurrentMode } = useAppStore();
  
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

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-[780px]">
      <div className="px-6 lg:px-8 xl:px-12 py-8">
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-6 mb-8 border border-rose-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-100 rounded-xl">
              <span className="text-rose-600">{feature.icon}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{feature.title}</h2>
              <p className="text-gray-500 text-sm">{feature.desc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-rose-500" />
            <h3 className="text-sm font-semibold text-gray-700">自动化统计</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-rose-50 rounded-xl">
              <p className="text-2xl font-bold text-rose-600">128</p>
              <p className="text-xs text-gray-500 mt-1">自动修复次数</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-600">96%</p>
              <p className="text-xs text-gray-500 mt-1">成功率</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">2.3m</p>
              <p className="text-xs text-gray-500 mt-1">平均响应时间</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Play size={16} className="text-rose-500" />
            <h3 className="text-sm font-semibold text-gray-700">快捷操作</h3>
          </div>
          <div className="space-y-3">
            {feature.actions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleActionClick(action.query)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-rose-50 hover:border-rose-200 border border-transparent transition-all text-sm text-gray-600 hover:text-rose-700 group"
              >
                <span>{action.label}</span>
                <ArrowRight size={14} className="text-gray-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
