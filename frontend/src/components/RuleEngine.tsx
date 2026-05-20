import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Play, Pause, Trash2, Pencil, Clock, Zap, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight, Save, X, Bell, Mail, MessageSquare, Globe, Server, RefreshCw, History } from 'lucide-react';
import type { AutomationRule, RuleCondition, ConditionGroup, RuleAction, NotifyChannel } from '../types/moduleData';

const STORAGE_KEY = 'orchestration_rules';

const METRIC_OPTIONS = [
  { value: 'cpu', label: 'CPU 使用率', unit: '%' },
  { value: 'memory', label: '内存使用率', unit: '%' },
  { value: 'disk', label: '磁盘使用率', unit: '%' },
  { value: 'error_rate', label: '错误率', unit: '%' },
  { value: 'latency', label: 'P99 延迟', unit: 'ms' },
  { value: 'connection_count', label: '连接数', unit: '' },
  { value: 'qps', label: 'QPS', unit: '' },
  { value: 'replicas', label: '副本数', unit: '' },
];

const OPERATOR_OPTIONS = [
  { value: '>', label: '大于' },
  { value: '<', label: '小于' },
  { value: '>=', label: '大于等于' },
  { value: '<=', label: '小于等于' },
  { value: '==', label: '等于' },
  { value: '!=', label: '不等于' },
];

const ACTION_TYPE_OPTIONS = [
  { value: 'restart', label: '重启服务', icon: <RefreshCw size={13} /> },
  { value: 'scale', label: '弹性伸缩', icon: <Server size={13} /> },
  { value: 'notify', label: '发送通知', icon: <Bell size={13} /> },
  { value: 'stop', label: '停止服务', icon: <XCircle size={13} /> },
  { value: 'query', label: '执行查询', icon: <Zap size={13} /> },
  { value: 'webhook', label: '调用 Webhook', icon: <Globe size={13} /> },
];

const CHANNEL_ICONS: Record<NotifyChannel, React.ReactNode> = {
  email: <Mail size={12} />,
  dingtalk: <MessageSquare size={12} />,
  slack: <MessageSquare size={12} />,
  webhook: <Globe size={12} />,
};

function loadRules(): AutomationRule[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return getDefaultRules();
}

function saveRules(rules: AutomationRule[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {}
}

function getDefaultRules(): AutomationRule[] {
  return [
    {
      id: 'rule-001',
      name: '数据库连接数告警',
      description: '当数据库连接数超过阈值时发送通知',
      enabled: true,
      evaluationInterval: 30000,
      cooldownPeriod: 300000,
      trigger: { logic: 'and', groups: [{ id: 'g1', logic: 'and', conditions: [{ id: 'rc1', metric: 'connection_count', operator: '>', value: 1000, label: '数据库连接数 > 1000' }] }] },
      actions: [
        { id: 'ra1', type: 'notify', order: 1, config: {}, channels: ['email'], recipients: ['admin@company.com'], template: 'alert_db_connection', description: '发送邮件通知管理员' },
        { id: 'ra2', type: 'notify', order: 2, config: {}, channels: ['dingtalk'], recipients: ['运维值班群'], template: 'alert_dingtalk', description: '发送钉钉消息到值班群' },
      ],
      requireConfirmation: false,
      maxExecutionsPerHour: 5,
      totalTriggers: 23,
      lastExecutionStatus: 'success',
      createdAt: Date.now() - 86400000 * 7,
      updatedAt: Date.now() - 3600000 * 3,
    },
    {
      id: 'rule-002',
      name: '高负载自动扩容',
      description: 'CPU 持续高负载时自动扩容服务副本',
      enabled: true,
      evaluationInterval: 60000,
      cooldownPeriod: 300000,
      trigger: { logic: 'and', groups: [
        { id: 'g1', logic: 'and', conditions: [{ id: 'rc1', metric: 'cpu', operator: '>', value: 85, duration: 180000, label: 'CPU > 85% 持续 3 分钟' }] }
      ]},
      actions: [
        { id: 'ra1', type: 'scale', order: 1, config: { replicas: '+2' }, description: 'order-service 扩容 +2 副本' },
        { id: 'ra2', type: 'notify', order: 2, config: {}, channels: ['dingtalk'], recipients: ['#ops-alerts'], description: '通知运维群' },
      ],
      requireConfirmation: true,
      maxExecutionsPerHour: 3,
      totalTriggers: 8,
      lastTriggeredAt: Date.now() - 7200000,
      lastExecutionStatus: 'success',
      createdAt: Date.now() - 86400000 * 14,
      updatedAt: Date.now() - 7200000,
    },
    {
      id: 'rule-003',
      name: '故障自愈规则',
      description: '检测到服务异常时自动重启并记录日志',
      enabled: false,
      evaluationInterval: 30000,
      cooldownPeriod: 120000,
      trigger: { logic: 'or', groups: [
        { id: 'g1', logic: 'and', conditions: [{ id: 'rc1', metric: 'error_rate', operator: '>', value: 5, label: '错误率 > 5%' }] },
        { id: 'g2', logic: 'and', conditions: [{ id: 'rc2', metric: 'latency', operator: '>', value: 3000, label: 'P99 延迟 > 3s' }] }
      ]},
      actions: [
        { id: 'ra1', type: 'restart', order: 1, config: {}, description: '重启异常服务实例' },
        { id: 'ra2', type: 'notify', order: 2, config: {}, channels: ['slack'], recipients: ['#incidents'], description: '记录到事件日志' },
      ],
      requireConfirmation: true,
      maxExecutionsPerHour: 10,
      totalTriggers: 45,
      lastExecutionStatus: 'partial',
      createdAt: Date.now() - 86400000 * 30,
      updatedAt: Date.now() - 86400000,
    },
  ];
}

export default function RuleEngine() {
  const [rules, setRules] = useState<AutomationRule[]>(() => loadRules());
  const [isCreating, setIsCreating] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  useEffect(() => { saveRules(rules); }, [rules]);

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r));
  };

  const deleteRule = (id: string) => {
    if (!confirm('确定删除此规则？')) return;
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingRuleId(null);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingRuleId(null);
  };

  const saveRule = (rule: AutomationRule) => {
    if (editingRuleId) {
      setRules(prev => prev.map(r => r.id === editingRuleId ? { ...rule, id: editingRuleId, updatedAt: Date.now() } : r));
    } else {
      setRules(prev => [...prev, { ...rule, id: `rule-${Date.now()}`, createdAt: Date.now(), updatedAt: Date.now() }]);
    }
    cancelEdit();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50">
              <Zap size={16} className="text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-800">自动化规则</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">{rules.filter(r => r.enabled).length}/{rules.length} 运行中</span>
          </div>
          <button onClick={startCreate} disabled={isCreating}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50">
            <Plus size={13} /> 新建规则
          </button>
        </div>

        {isCreating || editingRuleId ? (
          <RuleBuilder onSave={saveRule} onCancel={cancelEdit}
            initialRule={editingRuleId ? rules.find(r => r.id === editingRuleId) : undefined} />
        ) : (
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><Clock size={11} /> 共 {rules.length} 条规则</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-green-500" /> 已持久化</span>
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {rules.length === 0 && !isCreating ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Zap size={40} className="mb-2 text-blue-200" />
            <p className="text-sm">暂无自动化规则</p>
            <p className="text-[11px] mt-1">点击上方"新建规则"创建您的第一条规则</p>
          </div>
        ) : (
          rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} isExpanded={expandedRuleId === rule.id}
              onToggle={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
              onToggleEnabled={() => toggleRule(rule.id)} onEdit={() => { setEditingRuleId(rule.id); setIsCreating(true); }}
              onDelete={() => deleteRule(rule.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function RuleCard({ rule, isExpanded, onToggle, onToggleEnabled, onEdit, onDelete }: {
  rule: AutomationRule; isExpanded: boolean; onToggle: () => void;
  onToggleEnabled: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const statusColor = rule.enabled
    ? rule.lastExecutionStatus === 'success' ? 'bg-green-50 border-green-200'
    : rule.lastExecutionStatus === 'failed' ? 'bg-red-50 border-red-200'
    : rule.lastExecutionStatus === 'partial' ? 'bg-amber-50 border-amber-200'
    : 'bg-blue-50 border-blue-200'
    : 'bg-gray-50 border-gray-200';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${statusColor}`}>
      <button onClick={onToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}
            className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              rule.enabled ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
            }`}
          >
            {rule.enabled ? <Play size={13} /> : <Pause size={13} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[13px] font-semibold ${rule.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{rule.name}</span>
              {rule.lastTriggeredAt && (
                <span className="text-[9px] px-1.5 py-0 rounded bg-white/80 text-gray-500">
                  触发 {formatTimeAgo(rule.lastTriggeredAt)}
                </span>
              )}
            </div>
            <p className={`text-[11px] ${rule.enabled ? 'text-gray-500' : 'text-gray-400'} line-clamp-1`}>{rule.description}</p>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {rule.trigger.groups.flatMap(g => g.conditions).slice(0, 2).map((cond) => (
                <span key={cond.id} className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-blue-600 border border-blue-100">
                  IF {cond.label}
                </span>
              ))}
              {rule.actions.slice(0, 2).map((action) => (
                <span key={action.id} className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-emerald-600 border border-emerald-100">
                  THEN {action.description.substring(0, 15)}...
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              rule.lastExecutionStatus === 'success' ? 'bg-green-100 text-green-700' :
              rule.lastExecutionStatus === 'failed' ? 'bg-red-100 text-red-700' :
              rule.lastExecutionStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {rule.totalTriggers}次触发
            </span>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"><Pencil size={13} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
            {isExpanded ? <ChevronDown size={14} className="text-gray-400 ml-1" /> : <ChevronRight size={14} className="text-gray-400 ml-1" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/50 space-y-3 ml-10">
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-gray-400">评估间隔</p>
              <p className="font-medium text-gray-700">{rule.evaluationInterval / 1000}s</p>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-gray-400">冷却时间</p>
              <p className="font-medium text-gray-700">{rule.cooldownPeriod / 1000}s</p>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-gray-400">最大频率</p>
              <p className="font-medium text-gray-700">{rule.maxExecutionsPerHour}/小时</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">触发条件</p>
            <div className="space-y-1">
              {rule.trigger.groups.map((group, gi) => (
                <div key={group.id} className="flex items-start gap-1.5 text-[11px]">
                  <span className="text-gray-400 shrink-0 pt-0.5">{gi > 0 ? `(${group.logic.toUpperCase()})` : 'IF'}</span>
                  <div className="flex flex-wrap gap-1">
                    {group.conditions.map(cond => (
                      <code key={cond.id} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono text-[10px]">{cond.label}</code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">执行动作</p>
            <div className="space-y-1.5">
              {rule.actions.sort((a, b) => a.order - b.order).map(action => (
                <div key={action.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50/60 rounded-lg">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-bold flex items-center justify-center">{action.order}</span>
                  <span className="text-[11px] text-gray-700">{action.description}</span>
                  {action.channels?.map(ch => (
                    <span key={ch} className="ml-auto flex items-center gap-0.5 text-[9px] text-gray-500">{CHANNEL_ICONS[ch]}{ch}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-1">
            <Clock size={10} />
            <span>创建于 {new Date(rule.createdAt).toLocaleDateString()}</span>
            <span>· 更新于 {formatTimeAgo(rule.updatedAt)}</span>
            {rule.requireConfirmation && <span className="ml-auto text-amber-600">⚠️ 需确认</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function RuleBuilder({ onSave, onCancel, initialRule }: {
  onSave: (rule: AutomationRule) => void; onCancel: () => void; initialRule?: AutomationRule;
}) {
  const [name, setName] = useState(initialRule?.name || '');
  const [description, setDescription] = useState(initialRule?.description || '');
  const [enabled, setEnabled] = useState(initialRule?.enabled ?? true);
  const [evalInterval, setEvalInterval] = useState(initialRule?.evaluationInterval ?? 30000);
  const [cooldown, setCooldown] = useState(initialRule?.cooldownPeriod ?? 300000);
  const [triggerLogic, setTriggerLogic] = useState<'and' | 'or'>(initialRule?.trigger.logic ?? 'and');
  const [conditions, setConditions] = useState<RuleCondition[]>(initialRule?.trigger.groups[0]?.conditions || []);
  const [actions, setActions] = useState<RuleAction[]>(initialRule?.actions || []);
  const [requireConfirm, setRequireConfirm] = useState(initialRule?.requireConfirmation ?? true);

  const addCondition = () => {
    setConditions([...conditions, { id: `rc-${Date.now()}`, metric: 'cpu', operator: '>', value: 80, label: 'CPU > 80%' }]);
  };
  const removeCondition = (id: string) => setConditions(conditions.filter(c => c.id !== id));

  const updateCondition = (id: string, updates: Partial<RuleCondition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addAction = () => {
    setActions([...actions, { id: `ra-${Date.now()}`, type: 'notify', order: actions.length + 1, config: {}, description: '发送通知', channels: ['dingtalk'] }]);
  };
  const removeAction = (id: string) => setActions(actions.filter(a => a.id !== id).map((a, i) => ({ ...a, order: i + 1 })));

  const updateAction = (id: string, updates: Partial<RuleAction>) => {
    setActions(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const metricLabel = METRIC_OPTIONS.find(m => m.value === conditions[0]?.metric)?.label || conditions[0]?.metric || '';
    const opLabel = OPERATOR_OPTIONS.find(o => o.value === conditions[0]?.operator)?.label || conditions[0]?.operator || '';
    onSave({
      id: '', name, description, enabled, evaluationInterval: evalInterval, cooldownPeriod: cooldown,
      trigger: { logic: triggerLogic, groups: [{ id: 'g1', logic: 'and', conditions: conditions.map(c => ({
        ...c, label: `${metricLabel} ${opLabel} ${c.value}${c.duration ? ` 持续 ${c.duration / 60000}分钟` : ''}`
      })) }] },
      actions: actions.map(a => ({ ...a, description: getActionDescription(a) })),
      requireConfirmation: requireConfirm, maxExecutionsPerHour: 5,
      totalTriggers: initialRule?.totalTriggers || 0,
      lastExecutionStatus: initialRule?.lastExecutionStatus,
      createdAt: initialRule?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium text-gray-500 block mb-1">规则名称 *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="如：高CPU自动重启"
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-300 bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 block mb-1">描述</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="规则用途说明"
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-300 bg-white" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-medium text-gray-500 block mb-1">评估间隔</label>
          <select value={evalInterval} onChange={e => setEvalInterval(Number(e.target.value))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-300 bg-white">
            {[{ v: 10000, l: '10秒' }, { v: 30000, l: '30秒' }, { v: 60000, l: '1分钟' }, { v: 300000, l: '5分钟' }].map(o =>
              <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 block mb-1">冷却时间</label>
          <select value={cooldown} onChange={e => setCooldown(Number(e.target.value))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-300 bg-white">
            {[{ v: 60000, l: '1分钟' }, { v: 180000, l: '3分钟' }, { v: 300000, l: '5分钟' }, { v: 600000, l: '10分钟' }].map(o =>
              <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2 pb-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            <span className="text-[11px] text-gray-600">启用</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={requireConfirm} onChange={e => setRequireConfirm(e.target.checked)} className="rounded" />
            <span className="text-[11px] text-gray-600">需确认</span>
          </label>
        </div>
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-orange-500" /> 触发条件 (IF)
          </label>
          <button onClick={addCondition} className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">+ 添加条件</button>
        </div>
        <div className="space-y-2">
          {conditions.map((cond) => (
            <div key={cond.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100">
              <select value={cond.metric} onChange={e => {
                const m = METRIC_OPTIONS.find(m => m.value === e.target.value)!;
                updateCondition(cond.id, { metric: e.target.value });
              }} className="text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300">
                {METRIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={cond.operator} onChange={e => updateCondition(cond.id, { operator: e.target.value as any })}
                className="text-[11px] border border-gray-200 rounded px-2 py-1 w-20 focus:outline-none focus:border-blue-300">
                {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input type="number" value={typeof cond.value === 'number' ? cond.value : parseInt(String(cond.value))}
                onChange={e => updateCondition(cond.id, { value: Number(e.target.value) })}
                className="w-20 text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300" />
              <button onClick={() => removeCondition(cond.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><X size={13} /></button>
            </div>
          ))}
          {conditions.length === 0 && (
            <p className="text-[11px] text-gray-400 text-center py-3 bg-gray-50 rounded-lg">点击"+ 添加条件"开始构建触发规则</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
            <Zap size={12} className="text-emerald-500" /> 执行动作 (THEN)
          </label>
          <button onClick={addAction} className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">+ 添加动作</button>
        </div>
        <div className="space-y-2">
          {actions.map((action) => (
            <div key={action.id} className="px-3 py-2.5 bg-white rounded-lg border border-gray-100 space-y-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold flex items-center justify-center">{action.order}</span>
                <select value={action.type} onChange={e => updateAction(action.id, { type: e.target.value as any, description: getActionDescription({ ...action, type: e.target.value as any }) })}
                  className="text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-300">
                  {ACTION_TYPE_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <button onClick={() => removeAction(action.id)} className="ml-auto p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><X size={13} /></button>
              </div>
              {action.type === 'notify' && (
                <div className="flex items-center gap-2 ml-7">
                  {(Object.keys(CHANNEL_ICONS) as NotifyChannel[]).map(ch => (
                    <label key={ch} className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-500">
                      <input type="checkbox" checked={action.channels?.includes(ch) || false}
                        onChange={e => {
                          const chs = e.target.checked ? [...(action.channels || []), ch] : (action.channels || []).filter(c => c !== ch);
                          updateAction(action.id, { channels: chs });
                        }} className="rounded" />
                      {ch}
                    </label>
                  ))}
                </div>
              )}
              {action.type === 'scale' && (
                <div className="flex items-center gap-2 ml-7">
                  <span className="text-[10px] text-gray-500">目标:</span>
                  <input placeholder="+2 或 具体数值" className="text-[11px] border border-gray-200 rounded px-2 py-1 w-24 focus:outline-none"
                    defaultValue={(action.config.replicas as string) || ''} />
                </div>
              )}
            </div>
          ))}
          {actions.length === 0 && (
            <p className="text-[11px] text-gray-400 text-center py-3 bg-gray-50 rounded-lg">点击"+ 添加动作"定义触发后的行为</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button onClick={handleSave} disabled={!name.trim()}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
          <Save size={14} /> 保存规则
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200">取消</button>
      </div>
    </div>
  );
}

function getActionDescription(action: RuleAction): string {
  switch (action.type) {
    case 'restart': return '重启目标服务实例';
    case 'scale': return `弹性伸缩 ${action.config.replicas || '?'} 副本`;
    case 'notify': return `发送${(action.channels || []).join('/')}通知`;
    case 'stop': return '停止目标服务';
    case 'query': return '执行查询操作';
    case 'webhook': return '调用 Webhook 接口';
    default: return action.description || '执行动作';
  }
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h前`;
  return `${Math.floor(diff / 86400000)}d前`;
}
