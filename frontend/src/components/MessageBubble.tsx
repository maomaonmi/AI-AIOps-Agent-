import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  User,
  Pencil,
  ChevronDown,
  ChevronRight,
  Wrench,
  Brain,
  Globe,
  MessageCircle,
  Copy,
  CheckCheck,
  Cpu,
  Database,
  AlertTriangle,
  Server,
} from 'lucide-react';
import type { Message, ChatMode, IntermediateStep } from '../types';
import {
  VisualRenderer,
  type VisualizationData,
} from './VisualComponents';
import {
  ModularAnalysisRenderer,
  generateModularResponse,
} from './ModularAnalysis';
import {
  ModularPredictionRenderer,
  generatePredictionResponse,
} from './ModularPrediction';
import {
  MonitoringModule,
  PredictionModule,
  DiagnosisModule,
  KnowledgeModule,
  AutomationModule,
} from './ModuleVisualizations';
import { getModuleLabel } from '../utils/moduleAdapters';

const modeIcons: Record<ChatMode, React.ReactNode> = {
  casual: <MessageCircle size={12} />,
  normal: <MessageCircle size={12} />,
  thinking: <Brain size={12} />,
  online: <Globe size={12} />,
};

function parseVisualizations(content: string): { cleanContent: string; visualizations: VisualizationData[] } {
  const vizRegex = /\[\[viz:(\w+)\|([\s\S]*?)\]\]/g;
  const visualizations: VisualizationData[] = [];
  let match;

  while ((match = vizRegex.exec(content)) !== null) {
    try {
      const type = match[1] as VisualizationData['type'];
      const rawData = match[2];
      const data = JSON.parse(rawData);
      visualizations.push({ type, data });
    } catch (e) {
      console.warn('Failed to parse visualization:', match[0], e);
    }
  }

  const cleanContent = content.replace(vizRegex, '').trim();
  return { cleanContent, visualizations };
}

function detectAndGenerateVisualizations(content: string): VisualizationData[] {
  const vizzes: VisualizationData[] = [];

  if (/CPU|内存|磁盘|网络|监控指标|使用率/i.test(content) && !content.includes('[[')) {
    vizzes.push({
      type: 'status-cards',
      data: {
        title: '系统资源状态',
        items: [
          { label: 'CPU', value: '正常', percent: 35, status: 'healthy', icon: 'cpu', trend: -2.3, chartData: [32, 35, 38, 42, 39, 45, 41, 36, 34, 38, 40, 35] },
          { label: '内存', value: '正常', percent: 62, status: 'healthy', icon: 'memory', trend: 1.8, chartData: [58, 60, 62, 65, 63, 68, 70, 67, 64, 66, 69, 65] },
          { label: '磁盘', value: '警告', percent: 78, status: 'warning', icon: 'disk', trend: 3.5, chartData: [70, 72, 73, 74, 75, 76, 77, 76, 77, 78, 78, 78] },
          { label: '网络', value: '正常', percent: 28, status: 'healthy', icon: 'network', trend: -5.1, chartData: [30, 28, 32, 25, 30, 28, 35, 30, 28, 26, 28, 28] },
        ],
      },
    });

    vizzes.push({
      type: 'metric-chart',
      data: {
        title: 'CPU 使用率趋势（近12小时）',
        subtitle: '数据来源: Prometheus',
        series: [
          { label: '00:00', value: 32 }, { label: '02:00', value: 28 },
          { label: '04:00', value: 25 }, { label: '06:00', value: 35 },
          { label: '08:00', value: 55 }, { label: '10:00', value: 68 },
          { label: '12:00', value: 72 }, { label: '14:00', value: 65 },
          { label: '16:00', value: 58 }, { label: '18:00', value: 45 },
          { label: '20:00', value: 38 }, { label: '22:00', value: 33 },
        ],
        type: 'line',
        unit: '%',
        color: 'indigo',
        showTable: true,
      },
    });
  }

  if (/服务|拓扑|架构|微服务|依赖/i.test(content) && !content.includes('[[')) {
    vizzes.push({
      type: 'service-topology',
      data: {
        title: '服务架构拓扑',
        nodes: [
          { name: 'API Gateway', status: 'healthy', x: 50, y: 10 },
          { name: '用户服务', status: 'healthy', x: 22, y: 35 },
          { name: '订单服务', status: 'warning', x: 50, y: 35 },
          { name: '支付服务', status: 'healthy', x: 78, y: 35 },
          { name: 'MySQL 主', status: 'healthy', x: 28, y: 65 },
          { name: 'Redis 集群', status: 'healthy', x: 52, y: 65 },
          { name: '消息队列', status: 'warning', x: 76, y: 65 },
          { name: 'Elasticsearch', status: 'healthy', x: 50, y: 88 },
        ],
        links: [
          { from: 0, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 },
          { from: 1, to: 4 }, { from: 2, to: 4 }, { from: 2, to: 5 },
          { from: 2, to: 6 }, { from: 3, to: 6 },
          { from: 4, to: 7 }, { from: 6, to: 7 },
        ],
      },
    });
  }

  if (/告警|异常|错误|alert|error|故障/i.test(content) && !content.includes('[[')) {
    vizzes.push({
      type: 'alert-list',
      data: {
        title: '活跃告警',
        alerts: [
          { level: 'critical', message: '订单服务响应时间超过阈值 (当前 2.3s，阈值 500ms)', source: 'prometheus', time: '2 分钟前', count: 15 },
          { level: 'warning', message: '消息队列积压量异常 (当前 15,234 条，正常 <1000)', source: 'rabbitmq', time: '5 分钟前', count: 8 },
          { level: 'warning', message: '数据库慢查询增加 (QPS > 100 的查询耗时 > 200ms)', source: 'mysql-slow', time: '12 分钟前' },
          { level: 'info', message: '证书将在 7 天后过期 (api.example.com)', source: 'cert-manager', time: '1 小时前' },
        ],
      },
    });

    vizzes.push({
      type: 'timeline',
      data: {
        title: '事件时间线',
        events: [
          { time: '14:32:05', title: '订单服务 P99 延迟升高', description: '检测到 p99 延迟从 180ms 升至 2300ms', type: 'warning' },
          { time: '14:32:08', title: '自动触发诊断', description: 'AIOps Agent 开始自动根因分析', type: 'info' },
          { time: '14:32:15', title: '定位到问题', description: '发现数据库连接池耗尽，等待队列堆积', type: 'error' },
          { time: '14:32:20', title: '建议执行修复', description: '建议扩容连接池或重启异常连接', type: 'success' },
        ],
      },
    });
  }

  if (/趋势|预测|forecast|predict/i.test(content) && !content.includes('[[')) {
    vizzes.push({
      type: 'metric-chart',
      data: {
        title: '资源使用趋势预测',
        subtitle: '基于历史数据的未来24小时预测',
        series: [
          { label: '现在', value: 62 }, { label: '+2h', value: 68 },
          { label: '+4h', value: 75 }, { label: '+6h', value: 82 },
          { label: '+8h', value: 88 }, { label: '+10h', value: 85 },
          { label: '+12h', value: 78 }, { label: '+14h', value: 70 },
          { label: '+16h', value: 65 }, { label: '+18h', value: 60 },
          { label: '+20h', value: 58 }, { label: '+22h', value: 55 },
        ],
        type: 'line',
        unit: '%',
        color: 'amber',
      },
    });

    vizzes.push({
      type: 'progress-group',
      data: {
        title: '容量预警分析',
        items: [
          { label: '内存使用率', value: 62, max: 100, color: 'amber', status: '预计 +8h 达到 80%' },
          { label: '磁盘 /data 分区', value: 780, max: 1024, color: 'red', status: '预计 +3天 满载' },
          { label: '数据库连接数', value: 850, max: 1000, color: 'amber', status: '并发高峰期风险' },
          { label: 'CPU 核心使用', value: 35, max: 100, color: 'emerald', status: '运行正常' },
        ],
      },
    });
  }

  if (/服务器|server|主机|instance|节点/i.test(content) && !content.includes('[[')) {
    vizzes.push({
      type: 'data-table',
      data: {
        title: '服务器资源概览',
        columns: [
          { key: 'name', label: '主机名' },
          { key: 'ip', label: 'IP 地址' },
          { key: 'cpu', label: 'CPU%', align: 'right' as const, format: (v: number) => `${v}%`, highlight: (v: number) => Number(v) > 80 },
          { key: 'mem', label: '内存%', align: 'right' as const, format: (v: number) => `${v}%`, highlight: (v: number) => Number(v) > 85 },
          { key: 'status', label: '状态' },
        ],
        rows: [
          { name: 'prod-web-01', ip: '192.168.1.10', cpu: 23, mem: 45, status: '🟢 正常' },
          { name: 'prod-api-01', ip: '192.168.1.11', cpu: 67, mem: 72, status: '🟡 负载高' },
          { name: 'prod-db-01', ip: '192.168.1.20', cpu: 12, mem: 88, status: '🟡 内存紧张' },
          { name: 'prod-worker-01', ip: '192.168.1.30', cpu: 91, mem: 76, status: '🔴 CPU告警' },
          { name: 'prod-cache-01', ip: '192.168.1.40', cpu: 8, mem: 34, status: '🟢 正常' },
        ],
      },
    });

    vizzes.push({
      type: 'metric-summary',
      data: {
        title: '集群总览',
        metrics: [
          { label: '在线节点', value: '24/25', change: 0, icon: <Server size={13} /> },
          { label: '平均 CPU', value: '42.3%', change: 5.2, changeLabel: '较昨日', icon: <Cpu size={13} /> },
          { label: '平均内存', value: '68.7%', change: -2.1, changeLabel: '较昨日', icon: <Database size={13} /> },
          { label: '活跃告警', value: '3', change: -4, changeLabel: '较昨日', icon: <AlertTriangle size={13} /> },
        ],
      },
    });
  }

  return vizzes;
}

function ThinkingAnimation() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <div className="flex gap-1">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="text-gray-400 text-sm">思考中...</span>
    </div>
  );
}

function IntermediateSteps({ steps }: { steps: IntermediateStep[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50/80 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-2 w-full text-left text-xs text-gray-500 hover:bg-gray-100/60 transition-colors"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Wrench size={12} />
        <span>推理步骤 ({steps.length})</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 space-y-1.5 border-t border-gray-200/60 pt-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className="bg-white rounded-md p-2.5 text-xs border border-gray-100"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[11px] font-medium">
                  {step.tool}
                </span>
              </div>
              <div className="text-gray-500 mb-0.5 text-[11px]">
                输入: <code className="bg-gray-50 px-1 py-px rounded font-mono">{step.tool_input}</code>
              </div>
              <div className="text-gray-600 text-[11px] leading-relaxed line-clamp-3 whitespace-pre-wrap">
                {step.observation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleRenderer({ moduleData }: { moduleData: any }) {
  if (!moduleData || !moduleData.type || !moduleData.data) return null;

  switch (moduleData.type) {
    case 'monitoring':
      return <MonitoringModule data={moduleData.data} />;
    case 'prediction':
      return <PredictionModule data={moduleData.data} />;
    case 'diagnosis':
      return <DiagnosisModule data={moduleData.data} />;
    case 'knowledge':
      return <KnowledgeModule data={moduleData.data} />;
    case 'automation':
      return <AutomationModule data={moduleData.data} />;
    default:
      return null;
  }
}

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  isLast?: boolean;
}

export default function MessageBubble({ message, onEdit }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === 'user';

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = 'auto';
      editRef.current.style.height = editRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleResend = () => {
    if (onEdit && editContent.trim()) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const getVisualizations = (): VisualizationData[] => {
    if (message.visualizations && message.visualizations.length > 0) {
      return message.visualizations;
    }
    
    if (!message.isStreaming && message.content && !message.moduleData) {
      return detectAndGenerateVisualizations(message.content);
    }
    return [];
  };

  const getCleanContent = (): string => {
    if (message.visualizations && message.visualizations.length > 0) {
      const { cleanContent } = parseVisualizations(message.content);
      return cleanContent || message.content;
    }
    return message.content;
  };

  if (isUser) {
    return (
      <div className="group flex justify-end py-4 animate-fade-in-up">
        <div className="max-w-[75%] flex items-end gap-2.5">
          {isEditing ? (
            <div className="bg-white rounded-2xl rounded-tr-sm border border-gray-200 shadow-sm px-4 py-3">
              <textarea
                ref={editRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-transparent text-gray-800 text-sm resize-none outline-none placeholder:text-gray-300"
                rows={2}
                placeholder="修改你的问题..."
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleResend}
                  className="px-3 py-1 text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors font-medium"
                >
                  发送
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-[15px] leading-relaxed">
                {message.content}
              </div>
            </>
          )}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
            <User size={14} className="text-white" />
          </div>
        </div>
        {!isEditing && (
          <div className="absolute -left-16 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => {
                setIsEditing(true);
                setEditContent(message.content);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="编辑"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group flex justify-start py-4 animate-fade-in-up relative">
      <div className="max-w-[85%] flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={15} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium text-gray-800">AIOps Agent</span>
            {message.mode && message.mode !== 'normal' && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                {modeIcons[message.mode]}
                {message.mode === 'thinking' ? '深度思考' : '联网'}
              </span>
            )}
          </div>

          {message.isStreaming && !message.content ? (
            <ThinkingAnimation />
          ) : (
            <>
              <IntermediateSteps steps={message.intermediateSteps || []} />

              {message.moduleData ? (
                <>
                  <div className="mb-3 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className={`px-3 py-2 border-b border-gray-100 flex items-center gap-2 ${
                      message.moduleData.type === 'monitoring' ? 'bg-emerald-50' :
                      message.moduleData.type === 'prediction' ? 'bg-violet-50' :
                      message.moduleData.type === 'diagnosis' ? 'bg-rose-50' :
                      message.moduleData.type === 'knowledge' ? 'bg-indigo-50' :
                      message.moduleData.type === 'automation' ? 'bg-amber-50' :
                      'bg-gray-50'
                    }`}>
                      <span className="text-xs font-semibold text-gray-700">
                        {getModuleLabel(message.moduleData.type)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        message.moduleData.type === 'monitoring' ? 'bg-emerald-200 text-emerald-800' :
                        message.moduleData.type === 'prediction' ? 'bg-violet-200 text-violet-800' :
                        message.moduleData.type === 'diagnosis' ? 'bg-rose-200 text-rose-800' :
                        message.moduleData.type === 'knowledge' ? 'bg-indigo-200 text-indigo-800' :
                        message.moduleData.type === 'automation' ? 'bg-amber-200 text-amber-800' :
                        'bg-gray-200 text-gray-800'
                      }`}>
                        实时数据
                      </span>
                    </div>
                    <div className="p-4">
                      <ModuleRenderer moduleData={message.moduleData} />
                    </div>
                  </div>
                  <div className="markdown-body text-[15px] leading-relaxed text-gray-800">
                    <ReactMarkdown>{getCleanContent()}</ReactMarkdown>
                  </div>
                </>
              ) : (
                <>
                  <div className="markdown-body text-[15px] leading-relaxed text-gray-800">
                    <ReactMarkdown>{getCleanContent()}</ReactMarkdown>
                  </div>
                  {!message.isStreaming && (() => {
                    const vizzes = getVisualizations();
                    if (vizzes.length === 0) return null;
                    return (
                      <div className="mt-4 space-y-3">
                        {vizzes.map((viz, i) => (
                          <VisualRenderer key={`${viz.type}-${i}`} viz={viz} />
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}

              {message.isStreaming && <span className="cursor-blink" />}
            </>
          )}

          {!message.isStreaming && message.content && (
            <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {copied ? <CheckCheck size={13} className="text-green-500" /> : <Copy size={13} />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
