import { X, HardDrive, Cpu, MemoryStick, Wifi, Activity, ChevronDown, Maximize2, Microchip } from 'lucide-react';
import DiskMonitor from './DiskMonitor';
import CPUMonitor from './CPUMonitor';
import MemoryMonitor from './MemoryMonitor';
import NetworkMonitor from './NetworkMonitor';
import GPUMonitor from './GPUMonitor';

export type PanelType = 'disk' | 'cpu' | 'memory' | 'network' | 'gpu' | null;

const panelConfig: Record<Exclude<PanelType, null>, {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}> = {
  disk: {
    title: '磁盘容量监控',
    subtitle: 'SMART 块健康检测 · 实时容量分析',
    icon: <HardDrive size={18} />,
    color: 'text-teal-600',
    gradient: 'from-teal-500 to-cyan-500',
  },
  cpu: {
    title: 'CPU 监控',
    subtitle: '处理器使用率 · 核心负载分布',
    icon: <Cpu size={18} />,
    color: 'text-blue-600',
    gradient: 'from-blue-500 to-indigo-500',
  },
  memory: {
    title: '内存监控',
    subtitle: '内存使用率 · 进程占用分析',
    icon: <MemoryStick size={18} />,
    color: 'text-purple-600',
    gradient: 'from-purple-500 to-violet-500',
  },
  network: {
    title: '网络流量监控',
    subtitle: '带宽使用 · 连接状态追踪',
    icon: <Wifi size={18} />,
    color: 'text-emerald-600',
    gradient: 'from-emerald-500 to-green-500',
  },
  gpu: {
    title: 'GPU 监控',
    subtitle: '显卡状态 · 显存占用 · 温度功耗',
    icon: <Microchip size={18} />,
    color: 'text-violet-600',
    gradient: 'from-violet-500 to-purple-500',
  },
};

interface FloatingPanelProps {
  panelType: PanelType;
  onClose: () => void;
  onSwitchPanel: (type: PanelType) => void;
}

function PanelContent({ panelType }: { panelType: Exclude<PanelType, null> }) {
  switch (panelType) {
    case 'disk':
      return <DiskMonitor compact />;
    case 'cpu':
      return <CPUMonitor />;
    case 'memory':
      return <MemoryMonitor />;
    case 'network':
      return <NetworkMonitor />;
    case 'gpu':
      return <GPUMonitor />;
    default:
      return null;
  }
}

export default function FloatingPanel({ panelType, onClose, onSwitchPanel }: FloatingPanelProps) {
  if (!panelType) return null;

  const config = panelConfig[panelType];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white/95 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r ${config.gradient} text-white`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
            {config.icon}
          </div>
          <div>
            <h2 className="font-bold text-base tracking-tight">{config.title}</h2>
            <p className="text-[11px] text-white/80">{config.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            title="关闭面板"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Quick Tab Bar */}
      <div className="flex items-center gap-1 px-6 py-2 bg-gray-50/80 border-b border-gray-100 overflow-x-auto">
        {Object.entries(panelConfig).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => onSwitchPanel(key as PanelType)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              key === panelType
                ? `bg-white shadow-sm ${cfg.color} border border-gray-200`
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/70'
            }`}
          >
            {cfg.icon}
            <span>{cfg.title}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <PanelContent panelType={panelType} />
      </div>

      {/* Footer */}
      <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between text-[10px] text-gray-400">
        <div className="flex items-center gap-1">
          <Activity size={11} />
          <span>智能监控面板</span>
        </div>
        <span>按 ESC 或点击 X 关闭</span>
      </div>
    </div>
  );
}