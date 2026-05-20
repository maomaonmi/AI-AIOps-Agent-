import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronLeft,
  Server,
  Shield,
  Activity,
  BookOpen,
  Brain,
  Network,
  Code2,
  Bot,
  FileText,
  Cloud,
  Cpu,
} from 'lucide-react';
import { useAppStore } from '../store';
import type { FeatureModule } from '../types';

const featureModules: FeatureModule[] = [
  { id: 'monitor', name: '智能监控', description: '实时监控与异常检测', icon: 'activity', color: '#10b981' },
  { id: 'diagnosis', name: '故障诊断', description: '自动化根因分析', icon: 'shield', color: '#f59e0b' },
  { id: 'knowledge', name: '知识库', description: '运维知识检索与问答', icon: 'book', color: '#6366f1' },
  { id: 'automation', name: '自动修复', description: '智能故障自愈', icon: 'server', color: '#ef4444' },
];

const iconMap: Record<string, React.ReactNode> = {
  activity: <Activity size={16} />,
  shield: <Shield size={16} />,
  book: <BookOpen size={16} />,
  server: <Server size={16} />,
};

export default function Sidebar() {
  const {
    conversations,
    activeConversationId,
    sidebarOpen,
    activeFeature,
    activeModuleType,
    llmMode,
    setActiveConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    setSidebarOpen,
    setActiveFeature,
    setActiveModuleType,
    setLlmMode,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const convListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // 页面加载时强制重置滚动位置到顶部（使用多次尝试确保生效）
  useEffect(() => {
    const resetScroll = () => {
      if (convListRef.current) {
        convListRef.current.scrollTop = 0;
      }
    };
    // 立即执行
    resetScroll();
    // 延迟执行（等待浏览器恢复滚动位置后）
    const timer1 = setTimeout(resetScroll, 50);
    const timer2 = setTimeout(resetScroll, 200);
    const timer3 = setTimeout(resetScroll, 500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleNewChat = () => {
    createConversation();
    setActiveFeature(null);
    if (convListRef.current) {
      convListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleConfirmRename = () => {
    if (editingId && editTitle.trim()) renameConversation(editingId, editTitle.trim());
    setEditingId(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const groupedConversations = conversations.reduce(
    (groups, conv) => {
      const key = formatDate(conv.updatedAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(conv);
      return groups;
    },
    {} as Record<string, typeof conversations>
  );

  if (!sidebarOpen) {
    return (
      <div className="w-12 bg-gray-50 border-r border-gray-200 flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
        <button
          onClick={handleNewChat}
          className="p-2 mt-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      <div className="px-5 py-5 flex items-center justify-between">
        <h1 className="text-gray-900 font-semibold text-lg tracking-tight">AIOps Agent</h1>
        <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={18} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all border border-dashed border-gray-300 hover:border-indigo-300 group"
        >
          <Plus size={16} className="group-hover:text-indigo-500" />
          <span>新建对话</span>
        </button>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => {
            setActiveFeature(null);
            setActiveModuleType('reports');
          }}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm ${
            activeModuleType === 'reports'
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-600 border border-emerald-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${activeModuleType === 'reports' ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gray-100'}`}>
            <FileText size={16} className={activeModuleType === 'reports' ? 'text-white' : 'text-gray-500'} />
          </div>
          <div className="text-left">
            <div className="font-medium">智能报告</div>
            <div className="text-[10px] text-gray-400">日报 · 故障复盘 · SLA · PDF导出</div>
          </div>
        </button>
      </div>

      <div className="mx-4 my-2 border-t border-gray-200"></div>

      <div className="px-4 py-4">
        <p className="text-xs text-gray-400 px-1 mb-3 font-medium uppercase tracking-wider">功能模块</p>
        <div className="grid grid-cols-2 gap-2">
          {featureModules.map((module) => (
            <button
              key={module.id}
              onClick={() => setActiveFeature(activeFeature === module.id ? null : module.id)}
              className={`flex items-center gap-2 p-3 rounded-xl transition-all text-sm ${
                activeFeature === module.id
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span style={{ color: activeFeature === module.id ? undefined : module.color }}>{iconMap[module.icon]}</span>
              <span>{module.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 my-2 border-t border-gray-200"></div>

      <div className="px-4 py-3">
        <button
          onClick={() => {
            setActiveFeature(null);
            setActiveModuleType('brain');
          }}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm ${
            activeModuleType === 'brain'
              ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${activeModuleType === 'brain' ? 'bg-gradient-to-br from-indigo-500 to-purple-500' : 'bg-gray-100'}`}>
            <Brain size={16} className={activeModuleType === 'brain' ? 'text-white' : 'text-gray-500'} />
          </div>
          <div className="text-left">
            <div className="font-medium">运维大脑</div>
            <div className="text-[10px] text-gray-400">个性化推荐与学习</div>
          </div>
        </button>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => {
            setActiveFeature(null);
            setActiveModuleType('dashboard');
          }}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm ${
            activeModuleType === 'dashboard'
              ? 'bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-600 border border-cyan-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${activeModuleType === 'dashboard' ? 'bg-gradient-to-br from-cyan-500 to-blue-500' : 'bg-gray-100'}`}>
            <Network size={16} className={activeModuleType === 'dashboard' ? 'text-white' : 'text-gray-500'} />
          </div>
          <div className="text-left">
            <div className="font-medium">可视化仪表盘</div>
            <div className="text-[10px] text-gray-400">拓扑 · 热力图 · 故障传播</div>
          </div>
        </button>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => {
            setActiveFeature(null);
            setActiveModuleType('codeops');
          }}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm ${
            activeModuleType === 'codeops'
              ? 'bg-gradient-to-r from-orange-50 to-rose-50 text-orange-600 border border-orange-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${activeModuleType === 'codeops' ? 'bg-gradient-to-br from-orange-500 via-rose-500 to-purple-500' : 'bg-gray-100'}`}>
            <Code2 size={16} className={activeModuleType === 'codeops' ? 'text-white' : 'text-gray-500'} />
          </div>
          <div className="text-left">
            <div className="font-medium">代码运维</div>
            <div className="text-[10px] text-gray-400">配置审查 · SQL优化 · 安全扫描</div>
          </div>
        </button>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => {
            setActiveFeature(null);
            setActiveModuleType('orchestration');
          }}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-sm ${
            activeModuleType === 'orchestration'
              ? 'bg-gradient-to-r from-violet-50 to-blue-50 text-violet-600 border border-violet-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${activeModuleType === 'orchestration' ? 'bg-gradient-to-br from-violet-500 via-blue-500 to-emerald-500' : 'bg-gray-100'}`}>
            <Bot size={16} className={activeModuleType === 'orchestration' ? 'text-white' : 'text-gray-500'} />
          </div>
          <div className="text-left">
            <div className="font-medium">自然语言编排</div>
            <div className="text-[10px] text-gray-400">意图识别 · 规则引擎 · 批量执行</div>
          </div>
        </button>
      </div>

      <div className="mx-4 my-2 border-t border-gray-200"></div>

      <div ref={convListRef} className="flex-1 overflow-y-auto px-4 py-3 scroll-smooth" style={{ overscrollBehavior: 'contain' }}>
        {Object.entries(groupedConversations).map(([date, convs]) => (
          <div key={date} className="mb-5">
            <p className="text-[11px] text-gray-400 px-2 py-2 font-medium uppercase tracking-wider">{date}</p>
            {convs.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer transition-all mb-1.5 ${
                  activeConversationId === conv.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
                onClick={() => { setActiveConversation(conv.id); setActiveFeature(null); }}
              >
                <MessageSquare size={15} className="shrink-0 opacity-40" />
                {editingId === conv.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input ref={editInputRef} value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 bg-white text-sm px-2 py-1 rounded-lg outline-none border border-gray-300 focus:border-indigo-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }} className="p-1 text-green-500"><Check size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-1 text-red-400"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate">{conv.title}</span>
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleStartRename(conv.id, conv.title); }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"><Pencil size={13} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mx-4 my-2 border-t border-gray-200"></div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {llmMode === 'cloud' ? <Cloud size={14} className="text-sky-500" /> : <Cpu size={14} className="text-emerald-500" />}
            <span>{llmMode === 'cloud' ? '云端模型' : '本地模型'}</span>
          </div>
          <button
            onClick={async () => {
              const newMode = llmMode === 'local' ? 'cloud' : 'local';
              try {
                const res = await fetch('/api/llm-mode', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode: newMode }),
                });
                if (res.ok) {
                  setLlmMode(newMode);
                }
              } catch (e) {
                console.error('切换 LLM 模式失败:', e);
              }
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${llmMode === 'cloud' ? 'bg-sky-500' : 'bg-emerald-500'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${llmMode === 'cloud' ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="flex items-center gap-2.5 text-gray-400 text-xs">
          <Server size={14} />
          <span>AIOps Agent v1.0</span>
        </div>
      </div>
    </div>
  );
}
