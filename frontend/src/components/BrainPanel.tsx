import React, { useState } from 'react';
import { Brain, User, BookOpen, Shield, ChevronRight, Star, TrendingUp, Award, Lock, Unlock, CheckCircle, Circle } from 'lucide-react';
import type { UserProfile, LearningPath } from '../types/moduleData';

interface BrainPanelProps {
  userProfile: UserProfile;
  learningPaths: LearningPath[];
  learningMode: boolean;
  onSetLearningMode: (enabled: boolean) => void;
  onUpdateProgress: (pathId: string, progress: number) => void;
}

function getRoleBadge(role: UserProfile['role']) {
  const config = {
    junior: { label: '初级', color: 'bg-green-100 text-green-700' },
    mid: { label: '中级', color: 'bg-blue-100 text-blue-700' },
    senior: { label: '高级', color: 'bg-purple-100 text-purple-700' },
    admin: { label: '管理员', color: 'bg-red-100 text-red-700' },
  };
  return config[role];
}

function getLevelBadge(level: number) {
  if (level >= 9) return { label: '钻石', color: 'from-purple-500 to-pink-500' };
  if (level >= 7) return { label: '黄金', color: 'from-yellow-500 to-orange-500' };
  if (level >= 5) return { label: '白银', color: 'from-gray-400 to-gray-600' };
  return { label: '青铜', color: 'from-amber-600 to-amber-800' };
}

function getPermissionIcon(level: string) {
  switch (level) {
    case 'admin':
      return <Shield size={16} className="text-red-500" />;
    case 'operator':
      return <Unlock size={16} className="text-blue-500" />;
    default:
      return <Lock size={16} className="text-gray-400" />;
  }
}

export default function BrainPanel({
  userProfile,
  learningPaths,
  learningMode,
  onSetLearningMode,
  onUpdateProgress,
}: BrainPanelProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'learning' | 'permission'>('profile');
  const roleBadge = getRoleBadge(userProfile.role);
  const levelBadge = getLevelBadge(userProfile.level);

  const tabs = [
    { id: 'profile' as const, label: '用户画像', icon: User },
    { id: 'learning' as const, label: '学习模式', icon: BookOpen },
    { id: 'permission' as const, label: '权限感知', icon: Shield },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
            <Brain size={16} className="text-white" />
          </div>
          <span className="font-semibold text-gray-800">运维大脑</span>
        </div>
        <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'profile' && (
          <div className="p-4 space-y-4">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${levelBadge.color} flex items-center justify-center text-white font-bold text-lg`}>
                  {userProfile.level}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{userProfile.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${roleBadge.color}`}>
                      {roleBadge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={10} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-gray-500">{levelBadge.label}工程师</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/60 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-indigo-600">{userProfile.totalIncidents}</div>
                  <div className="text-[10px] text-gray-500">处理故障</div>
                </div>
                <div className="bg-white/60 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-purple-600">{userProfile.learningProgress.completedPaths}/{userProfile.learningProgress.totalPaths}</div>
                  <div className="text-[10px] text-gray-500">学习路径</div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={14} className="text-indigo-500" />
                <span className="text-sm font-medium text-gray-700">技能标签</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {userProfile.skillTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Award size={14} className="text-purple-500" />
                <span className="text-sm font-medium text-gray-700">常用模块</span>
              </div>
              <div className="space-y-1.5">
                {userProfile.preferredModules.map((mod) => (
                  <div
                    key={mod}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-xs text-gray-600 capitalize">{mod}</span>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'learning' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">跟随模式</span>
              <button
                onClick={() => onSetLearningMode(!learningMode)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  learningMode ? 'bg-indigo-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    learningMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {learningMode && (
              <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700">
                开启后，AI 将展示资深工程师的排查思路，帮助你学习最佳实践。
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-indigo-500" />
                <span className="text-sm font-medium text-gray-700">学习路径</span>
              </div>
              {learningPaths.map((path) => (
                <div
                  key={path.id}
                  className="bg-gray-50 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{path.title}</span>
                        {path.completed && (
                          <CheckCircle size={14} className="text-green-500" />
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        导师：{path.mentor} · {path.topic}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-indigo-600">
                      {Math.round(path.progress * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${path.progress * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{path.steps} 个步骤</span>
                    {!path.completed && (
                      <button
                        onClick={() => {
                          const newProgress = Math.min(path.progress + 0.2, 1);
                          onUpdateProgress(path.id, newProgress);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                      >
                        继续学习
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'permission' && (
          <div className="p-4 space-y-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {getPermissionIcon(userProfile.permissions.level)}
                <div>
                  <div className="text-sm font-semibold text-gray-800 capitalize">
                    {userProfile.permissions.level === 'viewer' ? '只读' :
                     userProfile.permissions.level === 'operator' ? '运维' : '管理员'}
                  </div>
                  <div className="text-[10px] text-gray-500">当前权限等级</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">操作权限</span>
              {[
                { key: 'canRestart', label: '重启服务', desc: '重启应用服务器' },
                { key: 'canScale', label: '弹性扩容', desc: '调整实例数量' },
                { key: 'canConfig', label: '配置修改', desc: '修改系统配置' },
                { key: 'canDeploy', label: '部署发布', desc: '发布新版本' },
              ].map((perm) => {
                const hasPermission = userProfile.permissions[perm.key as keyof typeof userProfile.permissions];
                return (
                  <div
                    key={perm.key}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                      hasPermission
                        ? 'bg-green-50 border-green-100'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium text-gray-700">{perm.label}</div>
                      <div className="text-[10px] text-gray-400">{perm.desc}</div>
                    </div>
                    {hasPermission ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <button className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors">
                        申请权限
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
