import React, { useState } from 'react';
import { Sparkles, Zap, Shield, History, Bot, Cpu, ArrowRight } from 'lucide-react';
import IntentRecognizer from './IntentRecognizer';
import RuleEngine from './RuleEngine';
import ExecutionHistory from './ExecutionHistory';

type OrchestrationTab = 'intent' | 'rules' | 'history';

const tabs: { id: OrchestrationTab; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  { id: 'intent', label: '意图识别', icon: <Sparkles size={14} />, description: '自然语言 → 结构化指令', color: 'text-violet-600 bg-violet-50' },
  { id: 'rules', label: '规则引擎', icon: <Zap size={14} />, description: '自动化触发器管理', color: 'text-blue-600 bg-blue-50' },
  { id: 'history', label: '执行历史', icon: <History size={14} />, description: '操作记录与回滚', color: 'text-emerald-600 bg-emerald-50' },
];

export default function OrchestrationPanel() {
  const [activeTab, setActiveTab] = useState<OrchestrationTab>('intent');

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 via-blue-500 to-emerald-500">
            <Bot size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-800 text-sm">自然语言编排</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-100 to-blue-100 text-violet-600 font-medium">AI 驱动</span>
        </div>

        {/* Tab Bar */}
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

        {/* Flow Indicator (when on intent tab) */}
        {activeTab === 'intent' && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-0.5"><Cpu size={10} /> 自然语言输入</span>
            <ArrowRight size={10} />
            <span className="flex items-center gap-0.5"><Sparkles size={10} /> LLM 解析意图</span>
            <ArrowRight size={10} />
            <span className="flex items-center gap-0.5"><Shield size={10} /> 确认执行</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'intent' && <IntentRecognizer />}
        {activeTab === 'rules' && <RuleEngine />}
        {activeTab === 'history' && <ExecutionHistory />}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>Orchestration Engine v1.0</span>
          <span className="flex items-center gap-1">LLM 解析 · 规则持久化 · 实时执行</span>
        </div>
      </div>
    </div>
  );
}
