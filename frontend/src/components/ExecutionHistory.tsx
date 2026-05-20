import React, { useState, useCallback } from 'react';
import { History, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown, ChevronRight, RotateCcw, ArrowLeftRight, Filter, Loader2, Zap, Target, Bell } from 'lucide-react';
import type { ExecutionRecord } from '../types/moduleData';

const STORAGE_KEY = 'orchestration_executions';

function loadExecutions(): ExecutionRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return getDefaultHistory();
}

function saveExecutions(records: ExecutionRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

function getDefaultHistory(): ExecutionRecord[] {
  return [
    {
      id: 'exec-1024', ruleId: 'rule-001', type: 'rule_trigger',
      status: 'completed', name: '批量重启高CPU服务器',
      description: 'CPU > 80% 的生产服务器批量重启',
      conditions: [{ id: 'c1', field: 'cpu', operator: '>', value: 80, label: 'CPU 使用率 > 80%' }],
      actions: [{ id: 'a1', type: 'restart', order: 1, config: {}, description: '重启匹配实例' }],
      results: [
        { actionId: 'a1', target: 'web-prod-01', status: 'success', output: '重启成功', duration: 12, retryCount: 0 },
        { actionId: 'a1', target: 'web-prod-02', status: 'success', output: '重启成功', duration: 11, retryCount: 0 },
        { actionId: 'a1', target: 'api-gw-01', status: 'success', output: '重启成功', duration: 8, retryCount: 0 },
        { actionId: 'a1', target: 'order-svc-03', status: 'timeout', error: '操作超时: 目标无响应', duration: 30, retryCount: 1 },
        { actionId: 'a1', target: 'db-replica-02', status: 'failed', error: '权限不足: 无权执行该操作', retryCount: 0 },
      ],
      totalTargets: 15, successCount: 13, failedCount: 2,
      startedAt: Date.now() - 1800000, completedAt: Date.now() - 1740000, duration: 263,
    },
    {
      id: 'exec-1023', ruleId: 'rule-002', type: 'rule_trigger',
      status: 'completed', name: '条件触发: DB连接数告警',
      description: '数据库连接数超过阈值，已发送通知',
      conditions: [{ id: 'c1', field: 'connection_count', operator: '>', value: 1000, label: '连接数 > 1000' }],
      actions: [
        { id: 'a1', type: 'notify', order: 1, config: {}, channels: ['email'], recipients: ['admin@company.com'], description: '发送邮件通知' },
        { id: 'a2', type: 'notify', order: 2, config: {}, channels: ['dingtalk'], recipients: ['运维值班群'], description: '发送钉钉通知' },
      ],
      results: [
        { actionId: 'a1', target: 'admin@company.com', status: 'success', output: '邮件已发送至 admin@company.com', duration: 2, retryCount: 0 },
        { actionId: 'a2', target: '运维值班群', status: 'success', output: '钉钉消息已发送到 值班群', duration: 1, retryCount: 0 },
      ],
      totalTargets: 2, successCount: 2, failedCount: 0,
      startedAt: Date.now() - 3600000, completedAt: Date.now() - 3597000, duration: 3,
    },
    {
      id: 'exec-1022', type: 'intent_execution',
      status: 'partial', name: '扩容 user-service 到 10 个副本',
      description: '弹性伸缩操作，部分节点扩容失败',
      conditions: [],
      actions: [{ id: 'a1', type: 'scale', order: 1, config: { replicas: 10 }, description: '扩容至 10 个副本' }],
      results: [
        { actionId: 'a1', target: 'user-svc-pod-1', status: 'success', output: '副本创建成功', duration: 5, retryCount: 0 },
        { actionId: 'a1', target: 'user-svc-pod-2', status: 'success', output: '副本创建成功', duration: 4, retryCount: 0 },
        { actionId: 'a1', target: 'user-svc-pod-3', status: 'failed', error: '资源不足: 集群 CPU 配额已达上限', retryCount: 2 },
      ],
      totalTargets: 10, successCount: 8, failedCount: 2,
      startedAt: Date.now() - 7200000, completedAt: Date.now() - 7100000, duration: 100,
    },
    {
      id: 'exec-1021', type: 'manual',
      status: 'failed', name: '回滚 order-service 到 v2.3.1',
      description: '回滚操作因版本不存在而失败',
      conditions: [],
      actions: [{ id: 'a1', type: 'rollback', order: 1, config: { version: 'v2.3.1' }, description: '回滚到指定版本' }],
      results: [
        { actionId: 'a1', target: 'order-service', status: 'failed', error: '目标版本 v2.3.1 不存在，可用版本: v2.3.0, v2.4.0', retryCount: 0 },
      ],
      totalTargets: 1, successCount: 0, failedCount: 1,
      startedAt: Date.now() - 86400000, completedAt: Date.now() - 86399000, duration: 10,
    },
  ];
}

export default function ExecutionHistory() {
  const [records, setRecords] = useState<ExecutionRecord[]>(() => loadExecutions());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'partial' | 'failed'>('all');

  const filtered = filterStatus === 'all' ? records : records.filter(r => r.status === filterStatus);

  const handleRetry = useCallback((id: string) => {
    setRecords(prev => prev.map(r => r.id === id ? {
      ...r, status: 'running' as const,
      results: r.results.map(s => s.status === 'failed' || s.status === 'timeout'
        ? { ...s, status: 'running' as const, retryCount: s.retryCount + 1 }
        : s)
    } : r));
    setTimeout(() => {
      setRecords(prev => prev.map(r => r.id === id ? {
        ...r, status: r.results.some(s => s.status === 'running') ? 'partial' as const : 'completed' as const,
        results: r.results.map(s => s.status === 'running'
          ? Math.random() > 0.25 ? { ...s, status: 'success' as const, output: '重试成功', duration: Math.floor(Math.random() * 10) + 3 }
          : { ...s, status: 'failed' as const, error: '重试失败: 目标仍不可用' }
          : s),
        successCount: r.successCount + (r.results.filter(s => s.status === 'running').length - (Math.random() > 0.25 ? 0 : r.results.filter(s => s.status === 'running').length)),
        failedCount: r.failedCount + (Math.random() > 0.25 ? 0 : r.results.filter(s => s.status === 'running').length),
        completedAt: Date.now(),
      } : r));
      saveExecutions(records);
    }, 2000);
  }, []);

  const handleRollback = useCallback((id: string) => {
    if (!confirm('确定要回滚此执行的所有操作吗？')) return;
    setRecords(prev => prev.map(r => r.id === id
      ? { ...r, status: 'cancelled' as const, completedAt: Date.now(), description: `${r.description}（已回滚）` }
      : r));
    saveExecutions(records);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              <History size={16} className="text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-gray-800">执行历史</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">{records.length} 条记录</span>
          </div>
          <button onClick={() => setRecords(getDefaultHistory())}
            className="text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex items-center gap-1">
            <RotateCcw size={10} /> 刷新
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5">
          {(['all', 'completed', 'partial', 'failed'] as const).map(status => (
            <button key={status} onClick={() => setFilterStatus(status)}
              className={`text-[11px] px-3 py-1 rounded-lg transition-all ${
                filterStatus === status
                  ? status === 'completed' ? 'bg-green-50 text-green-600 border border-green-200'
                  : status === 'failed' ? 'bg-red-50 text-red-600 border border-red-200'
                  : status === 'partial' ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-violet-50 text-violet-600 border border-violet-200'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}>
              {status === 'all' ? `全部 (${records.length})`
               : status === 'completed' ? `✅ ${records.filter(r => r.status === 'completed').length}`
               : status === 'failed' ? `❌ ${records.filter(r => r.status === 'failed').length}`
               : `⚠️ ${records.filter(r => r.status === 'partial').length}`}
            </button>
          ))}
        </div>
      </div>

      {/* Records List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <History size={40} className="mb-2 text-emerald-200" />
            <p className="text-sm">暂无执行记录</p>
            <p className="text-[11px] mt-1">执行意图或规则触发后，记录将显示在这里</p>
          </div>
        ) : (
          filtered.sort((a, b) => b.startedAt - a.startedAt).map(record => (
            <ExecutionCard key={record.id} record={record} isExpanded={expandedId === record.id}
              onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
              onRetry={() => handleRetry(record.id)} onRollback={() => handleRollback(record.id)} />
          ))
        )}
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><span className="text-[11px] text-gray-400 block">总执行</span><span className="text-xs font-bold text-gray-700 tabular-nums">{records.length}</span></div>
          <div><span className="text-[11px] text-gray-400 block">成功</span><span className="text-xs font-bold text-green-600 tabular-nums">{records.filter(r => r.status === 'completed').length}</span></div>
          <div><span className="text-[11px] text-gray-400 block">部分成功</span><span className="text-xs font-bold text-amber-600 tabular-nums">{records.filter(r => r.status === 'partial').length}</span></div>
          <div><span className="text-[11px] text-gray-400 block">失败</span><span className="text-xs font-bold text-red-600 tabular-nums">{records.filter(r => r.status === 'failed').length}</span></div>
        </div>
      </div>
    </div>
  );
}

function ExecutionCard({ record, isExpanded, onToggle, onRetry, onRollback }: {
  record: ExecutionRecord; isExpanded: boolean; onToggle: () => void;
  onRetry: () => void; onRollback: () => void;
}) {
  const statusConfig = {
    running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: '运行中', spin: true },
    completed: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: '已完成', spin: false },
    partial: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: '部分成功', spin: false },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: '失败', spin: false },
    cancelled: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', label: '已取消', spin: false },
  };
  const cfg = statusConfig[record.status];
  const StatusIcon = cfg.icon;
  const progressPct = Math.round((record.successCount / Math.max(record.totalTargets, 1)) * 100);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${cfg.bg} ${cfg.border}`}>
      <button onClick={onToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-start gap-3">
          <StatusIcon size={16} className={`${cfg.color} shrink-0 mt-0.5 ${cfg.spin ? 'animate-spin' : ''}`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[12px] font-semibold text-gray-800 truncate">{record.name}</span>
              <span className={`text-[9px] px-1.5 py-0 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
            </div>
            <p className="text-[11px] text-gray-500 line-clamp-1">{record.description}</p>

            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden flex">
                  <div className={`h-full transition-all ${
                    record.status === 'completed' ? 'bg-green-500' :
                    record.status === 'failed' ? 'bg-red-500' :
                    record.status === 'partial' ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`} style={{ width: `${progressPct}%` }} />
                  {record.failedCount > 0 && record.totalTargets > 0 && (
                    <div className="h-full bg-red-300" style={{ width: `${(record.failedCount / record.totalTargets) * 100}%` }} />
                  )}
                </div>
                <span className="text-[10px] font-medium text-gray-600 tabular-nums w-8 text-right">{progressPct}%</span>
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{record.successCount}/{record.totalTargets}</span>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-[10px] text-gray-400">{new Date(record.startedAt).toLocaleString()}</span>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              {record.duration !== undefined && <span>{record.duration}s</span>}
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/50 space-y-3 ml-6">
          {/* Meta Info */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              {record.type === 'intent_execution' ? <Zap size={10} className="text-violet-400" /> :
               record.type === 'rule_trigger' ? <Target size={10} className="text-blue-400" /> :
               <Clock size={10} className="text-gray-400" />}
              {record.type === 'intent_execution' ? '意图执行' : record.type === 'rule_trigger' ? '规则触发' : '手动'}
            </span>
            {record.triggeredBy && <span>操作人: {record.triggeredBy}</span>}
            <span>耗时: {record.duration ?? '--'}s</span>
          </div>

          {/* Conditions */}
          {record.conditions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">筛选条件</p>
              <div className="flex flex-wrap gap-1">
                {record.conditions.map(c => (
                  <code key={c.id} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">{c.label}</code>
                ))}
              </div>
            </div>
          )}

          {/* Step Results */}
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">执行步骤详情</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {record.results.map((step, idx) => (
                <div key={`${step.actionId}-${idx}`} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] ${
                  step.status === 'success' ? 'bg-green-50/70' :
                  step.status === 'failed' ? 'bg-red-50/70' :
                  step.status === 'timeout' ? 'bg-amber-50/70' :
                  step.status === 'running' ? 'bg-blue-50/70' :
                  'bg-gray-50'
                }`}>
                  <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    step.status === 'success' ? 'bg-green-100 text-green-600' :
                    step.status === 'failed' ? 'bg-red-100 text-red-600' :
                    step.status === 'timeout' ? 'bg-amber-100 text-amber-600' :
                    step.status === 'running' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {step.status === 'success' ? <CheckCircle2 size={11} /> :
                     step.status === 'failed' ? <XCircle size={11} /> :
                     step.status === 'timeout' ? <AlertTriangle size={11} /> :
                     step.status === 'running' ? <Loader2 size={11} className="animate-spin" /> :
                     <Clock size={11} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700 truncate block">{step.target}</span>
                    {step.error && <span className="text-[10px] text-red-500 truncate block">{step.error}</span>}
                    {step.output && <span className="text-[10px] text-green-600 truncate block">{step.output}</span>}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {step.duration !== undefined && <span className="text-[10px] text-gray-400 tabular-nums">{step.duration}s</span>}
                    {step.retryCount > 0 && <span className="text-[9px] px-1.5 py-0 rounded bg-amber-100 text-amber-600 font-medium">x{step.retryCount}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {(record.status === 'partial' || record.status === 'failed') && (
              <button onClick={onRetry}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors border border-amber-200 flex items-center gap-1.5">
                <RotateCcw size={12} /> 重试失败项
              </button>
            )}
            {(record.status === 'completed' || record.status === 'partial') && record.actions.some(a => a.type === 'restart' || a.type === 'scale') && (
              <button onClick={onRollback}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200 flex items-center gap-1.5">
                <ArrowLeftRight size={12} /> 回滚操作
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
