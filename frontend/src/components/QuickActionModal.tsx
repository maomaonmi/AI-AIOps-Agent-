import React, { useEffect, useCallback } from 'react';
import { X, Activity, TrendingUp, GitBranch, BarChart3 } from 'lucide-react';
import { HealthCheckPanel, TrendPredictPanel, ArchitectureReportPanel, LogVisualizationPanel } from './QuickActionPanels';

export type QuickActionType = 'health' | 'trend' | 'arch' | 'log' | null;

interface QuickActionModalProps {
  actionType: QuickActionType;
  onClose: () => void;
}

const actionConfig: Record<Exclude<QuickActionType, null>, {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}> = {
  health: {
    title: '系统体检',
    subtitle: '全面健康检查与优化建议',
    icon: <Activity className="w-5 h-5" />,
    gradient: 'from-emerald-500 to-teal-500',
  },
  trend: {
    title: '趋势预测',
    subtitle: '资源使用趋势分析与预警',
    icon: <TrendingUp className="w-5 h-5" />,
    gradient: 'from-blue-500 to-indigo-500',
  },
  arch: {
    title: '架构报告',
    subtitle: '系统硬件与软件架构全景',
    icon: <GitBranch className="w-5 h-5" />,
    gradient: 'from-purple-500 to-violet-500',
  },
  log: {
    title: '日志可视化',
    subtitle: '日志统计与异常分析',
    icon: <BarChart3 className="w-5 h-5" />,
    gradient: 'from-rose-500 to-pink-500',
  },
};

function PanelContent({ actionType }: { actionType: Exclude<QuickActionType, null> }) {
  switch (actionType) {
    case 'health':
      return <HealthCheckPanel />;
    case 'trend':
      return <TrendPredictPanel />;
    case 'arch':
      return <ArchitectureReportPanel />;
    case 'log':
      return <LogVisualizationPanel />;
    default:
      return null;
  }
}

export default function QuickActionModal({ actionType, onClose }: QuickActionModalProps) {
  console.log('QuickActionModal rendered with:', actionType);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (actionType) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [actionType, handleKeyDown]);

  if (!actionType) return null;

  const config = actionConfig[actionType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200">
        <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${config.gradient} text-white rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
              {config.icon}
            </div>
            <div>
              <h2 className="font-bold text-lg">{config.title}</h2>
              <p className="text-xs text-white/80">{config.subtitle}</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <PanelContent actionType={actionType} />
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/80 rounded-b-2xl flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            <span>智能运维助手</span>
          </div>
          <span>按 ESC 或点击 X 关闭</span>
        </div>
      </div>
    </div>
  );
}