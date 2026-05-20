import React, { useState } from 'react';
import { Shield, Zap, Lock, Code2 } from 'lucide-react';
import ConfigReview from './ConfigReview';
import SqlOptimizer from './SqlOptimizer';
import SecurityScanner from './SecurityScanner';

type CodeOpsTab = 'config' | 'sql' | 'security';

const tabs: { id: CodeOpsTab; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  { id: 'config', label: '配置审查', icon: <Shield size={14} />, description: 'K8s / Docker 配置自动审查', color: 'text-orange-600 bg-orange-50' },
  { id: 'sql', label: 'SQL 优化', icon: <Zap size={14} />, description: '慢查询分析与一键优化', color: 'text-violet-600 bg-violet-50' },
  { id: 'security', label: '安全扫描', icon: <Lock size={14} />, description: '密码 / 凭证 / 加密扫描', color: 'text-rose-600 bg-rose-50' },
];

export default function CodeOpsPanel() {
  const [activeTab, setActiveTab] = useState<CodeOpsTab>('config');

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 via-rose-500 to-purple-500">
            <Code2 size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-800 text-sm">代码级运维</span>
        </div>

        <div className="flex gap-1.5 bg-gray-50 rounded-xl p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-800 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className={activeTab === tab.id ? tab.color.split(' ')[0] : ''}>{tab.icon}</span>
              <span className="text-[11px]">{tab.label}</span>
              <span className={`text-[9px] ${activeTab === tab.id ? 'text-gray-400' : 'text-gray-400'}`}>{tab.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'config' && <ConfigReview />}
        {activeTab === 'sql' && <SqlOptimizer />}
        {activeTab === 'security' && <SecurityScanner />}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>CodeOps Engine v1.0</span>
          <span className="flex items-center gap-1">规则引擎 · 静态分析 · 实时反馈</span>
        </div>
      </div>
    </div>
  );
}
