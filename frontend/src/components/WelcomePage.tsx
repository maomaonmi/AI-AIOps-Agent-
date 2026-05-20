import React from 'react';
import { Sparkles, Brain, FileText, Activity, Shield, ChevronRight, Star, Zap } from 'lucide-react';
import { useAppStore } from '../store';
import type { UserProfile, PersonalizedRecommendation } from '../types/moduleData';

interface WelcomePageProps {
  onFeatureClick: (feature: string) => void;
  onRecommendationClick: (rec: PersonalizedRecommendation) => void;
}

const recommendations: PersonalizedRecommendation[] = [
  {
    id: 'rec-1',
    title: 'CPU 使用率异常排查',
    type: 'sop',
    description: 'CPU 持续超过 80% 的标准排查流程',
    relevance: 0.95,
    icon: 'cpu',
  },
  {
    id: 'rec-2',
    title: '数据库连接池优化',
    type: 'diagnosis',
    description: '分析连接池配置，优化性能',
    relevance: 0.88,
    icon: 'database',
  },
  {
    id: 'rec-3',
    title: '网络延迟诊断',
    type: 'monitoring',
    description: '定位网络延迟根因',
    relevance: 0.82,
    icon: 'network',
  },
  {
    id: 'rec-4',
    title: '跟随张工学习 CPU 排查',
    type: 'learning',
    description: '学习资深工程师的排查思路',
    relevance: 0.9,
    icon: 'learning',
  },
];

const iconMap: Record<string, React.ReactNode> = {
  cpu: <Activity size={18} />,
  database: <Shield size={18} />,
  network: <Zap size={18} />,
  learning: <Brain size={18} />,
};

const typeColorMap: Record<string, string> = {
  sop: 'bg-green-100 text-green-600',
  diagnosis: 'bg-orange-100 text-orange-600',
  monitoring: 'bg-blue-100 text-blue-600',
  learning: 'bg-purple-100 text-purple-600',
};

const typeLabelMap: Record<string, string> = {
  sop: 'SOP',
  diagnosis: '诊断',
  monitoring: '监控',
  learning: '学习',
};

export default function WelcomePage({ onFeatureClick, onRecommendationClick }: WelcomePageProps) {
  const { userProfile } = useAppStore();

  const getLevelBadge = (level: number) => {
    if (level >= 9) return { label: '钻石', color: 'from-purple-500 to-pink-500' };
    if (level >= 7) return { label: '黄金', color: 'from-yellow-500 to-orange-500' };
    if (level >= 5) return { label: '白银', color: 'from-gray-400 to-gray-600' };
    return { label: '青铜', color: 'from-amber-600 to-amber-800' };
  };

  const levelBadge = getLevelBadge(userProfile.level);

  return (
    <div className="w-full max-w-[780px] px-6 lg:px-8 xl:px-12 py-8 space-y-8">
      <div className="flex flex-col items-center justify-center pt-8">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles size={28} className="text-indigo-500" />
          <span className="text-2xl font-medium text-gray-800">你好，{userProfile.name}</span>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${levelBadge.color} flex items-center justify-center text-white text-xs font-bold`}>
            {userProfile.level}
          </div>
          <span className="text-sm text-gray-500">{levelBadge.label}工程师 · 已处理 {userProfile.totalIncidents} 次故障</span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Star size={16} className="text-indigo-500" />
          <span className="text-sm font-medium text-gray-700">为你推荐</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recommendations.map((rec) => (
            <button
              key={rec.id}
              onClick={() => onRecommendationClick(rec)}
              className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all text-left group"
            >
              <div className={`p-2 rounded-lg ${typeColorMap[rec.type]}`}>
                {iconMap[rec.icon]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition-colors">
                    {rec.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeColorMap[rec.type]}`}>
                    {typeLabelMap[rec.type]}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{rec.description}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-1" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-orange-500" />
          <span className="text-sm font-medium text-gray-700">常用功能</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'monitor', label: '智能监控', icon: Activity, color: 'text-green-500', bg: 'bg-green-50' },
            { id: 'diagnosis', label: '故障诊断', icon: Shield, color: 'text-orange-500', bg: 'bg-orange-50' },
            { id: 'knowledge', label: '知识库', icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          ].map((feature) => (
            <button
              key={feature.id}
              onClick={() => onFeatureClick(feature.id)}
              className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              <div className={`p-2.5 rounded-lg ${feature.bg} ${feature.color}`}>
                <feature.icon size={20} />
              </div>
              <span className="text-xs text-gray-600 group-hover:text-gray-800">{feature.label}</span>
            </button>
          ))}
        </div>
      </div>

      {userProfile.role === 'junior' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-purple-500" />
            <span className="text-sm font-medium text-gray-700">学习推荐</span>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Brain size={18} className="text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">跟随张工学习 CPU 排查思路</div>
                <div className="text-xs text-gray-500 mt-0.5">4 个步骤 · 预计 15 分钟</div>
              </div>
              <button
                onClick={() => onRecommendationClick(recommendations[3])}
                className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs hover:bg-purple-600 transition-colors"
              >
                开始学习
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
