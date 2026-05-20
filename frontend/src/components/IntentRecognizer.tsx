import React, { useState, useCallback } from 'react';
import { Sparkles, Bot, CheckCircle2, XCircle, AlertTriangle, ChevronRight, Loader2, RotateCcw, Target, Zap, Send, ArrowRight, Shield, Server, Clock } from 'lucide-react';
import type { ParsedIntent, ExecutionRecord } from '../types/moduleData';

interface IntentRecognizerProps {
  onIntentParsed?: (intent: ParsedIntent) => void;
  onIntentExecuted?: (record: ExecutionRecord) => void;
}

const SAMPLE_INPUTS = [
  "帮我把 CPU 超过 80% 的服务器重启",
  "如果数据库连接数超过 1000，就给我发邮件",
  "重启所有 order-svc 状态为异常的 Pod",
  "扩容 user-service 到 10 个副本",
  "批量重启内存使用率 > 90% 的 web 服务实例并通知值班群",
];

const INTENT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  batch_execute: { icon: <Zap size={16} />, label: '批量操作', color: 'text-violet-600 bg-violet-50' },
  conditional_trigger: { icon: <Target size={16} />, label: '条件触发', color: 'text-blue-600 bg-blue-50' },
  single_action: { icon: <Server size={16} />, label: '单步执行', color: 'text-emerald-600 bg-emerald-50' },
  query: { icon: <Bot size={16} />, label: '信息查询', color: 'text-cyan-600 bg-cyan-50' },
  scale: { icon: <Sparkles size={16} />, label: '弹性伸缩', color: 'text-orange-600 bg-orange-50' },
  rollback: { icon: <RotateCcw size={16} />, label: '回滚操作', color: 'text-red-600 bg-red-50' },
  create_rule: { icon: <Shield size={16} />, label: '创建规则', color: 'text-indigo-600 bg-indigo-50' },
};

const RISK_CONFIG = {
  low: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: '低风险', icon: CheckCircle2 },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: '中风险', icon: AlertTriangle },
  high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: '高风险', icon: AlertTriangle },
  critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: '严重风险', icon: XCircle },
};

export default function IntentRecognizer({ onIntentParsed, onIntentExecuted }: IntentRecognizerProps) {
  const [input, setInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionRecord | null>(null);

  const handleParse = useCallback(async () => {
    if (!input.trim()) return;
    setIsParsing(true);
    setParsedIntent(null);
    setExecutionResult(null);

    await new Promise(resolve => setTimeout(resolve, 1800));

    const intent = await parseIntentWithLLM(input);
    setParsedIntent(intent);
    setIsParsing(false);
    onIntentParsed?.(intent);
  }, [input, onIntentParsed]);

  const handleExecute = useCallback(async () => {
    if (!parsedIntent) return;
    setIsExecuting(true);
    setExecutionResult(null);

    const record = await executeIntent(parsedIntent);
    setExecutionResult(record);
    setIsExecuting(false);
    onIntentExecuted?.(record);
  }, [parsedIntent, onIntentExecuted]);

  const handleReset = useCallback(() => {
    setInput('');
    setParsedIntent(null);
    setExecutionResult(null);
    setIsExecuting(false);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Input Area */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-gray-800">意图识别</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600">LLM 驱动</span>
        </div>

        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
            placeholder="用自然语言描述你想执行的运维操作...&#10;&#10;例如：&#10;- 帮我把 CPU 超过 80% 的服务器重启&#10;- 如果数据库连接数超 1000 就发邮件给我&#10;- 批量重启所有异常的 order-svc Pod"
            className="w-full resize-none border border-gray-200 rounded-xl p-3 text-[12px] leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 bg-gray-50/50 pr-24"
            rows={4}
            spellCheck={false}
            disabled={isParsing || isExecuting}
          />
          <button
            onClick={handleParse}
            disabled={!input.trim() || isParsing || isExecuting}
            className={`absolute bottom-3 right-3 px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              !input.trim() || isParsing || isExecuting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-sm'
            }`}
          >
            {isParsing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            解析意图
          </button>
        </div>

        {/* Quick Examples */}
        {!parsedIntent && !executionResult && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className="text-[10px] text-gray-400 self-center">快捷示例:</span>
            {SAMPLE_INPUTS.slice(0, 3).map((sample, i) => (
              <button key={i} onClick={() => setInput(sample)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-violet-50 hover:text-violet-600 transition-colors truncate max-w-[180px]">
                {sample}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isParsing && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-violet-200" />
              <Loader2 size={28} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-500 animate-spin" />
            </div>
            <p className="text-sm font-medium text-gray-600">正在解析您的意图...</p>
            <p className="text-[11px] mt-1 text-gray-400">LLM 正在理解操作语义</p>
          </div>
        )}

        {parsedIntent && !executionResult && (
          <div className="space-y-4">
            {/* Intent Header */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-violet-500" />
                    <span className="text-sm font-semibold text-gray-800">已识别操作意图</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">置信度</span>
                    <span className={`text-xs font-bold tabular-nums ${parsedIntent.confidence >= 0.9 ? 'text-green-600' : parsedIntent.confidence >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                      {(parsedIntent.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Raw Input */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">原始输入</p>
                  <p className="text-[12px] text-gray-700 italic">"{parsedIntent.rawInput}"</p>
                </div>

                {/* Intent Type */}
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 px-3 py-2 rounded-lg ${INTENT_TYPE_CONFIG[parsedIntent.intentType]?.color || 'bg-gray-100'}`}>
                    <div className="flex items-center gap-1.5">
                      {INTENT_TYPE_CONFIG[parsedIntent.intentType]?.icon}
                      <span className="text-xs font-semibold">{INTENT_TYPE_CONFIG[parsedIntent.intentType]?.label}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-gray-700 leading-relaxed">{parsedIntent.explanation}</p>
                  </div>
                </div>

                {/* Risk Level */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${RISK_CONFIG[parsedIntent.riskLevel].border} ${RISK_CONFIG[parsedIntent.riskLevel].bg}`}>
                  {(() => { const Icon = RISK_CONFIG[parsedIntent.riskLevel].icon; return <Icon size={14} className={RISK_CONFIG[parsedIntent.riskLevel].color} />; })()}
                  <span className={`text-xs font-medium ${RISK_CONFIG[parsedIntent.riskLevel].color}`}>{RISK_CONFIG[parsedIntent.riskLevel].label}</span>
                  {parsedIntent.requiresConfirmation && (
                    <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ 需要人工确认</span>
                  )}
                </div>

                {/* Conditions */}
                {parsedIntent.conditions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Target size={12} /> 执行条件（筛选目标）
                      {parsedIntent.estimatedTargets !== undefined && (
                        <span className="normal-case text-violet-600 font-semibold ml-auto">预计 ~{parsedIntent.estimatedTargets} 个目标</span>
                      )}
                    </p>
                    <div className="space-y-1.5">
                      {parsedIntent.conditions.map((cond) => (
                        <div key={cond.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50/60 rounded-lg border border-blue-100">
                          <ChevronRight size={12} className="text-blue-400 shrink-0" />
                          <code className="text-[12px] font-mono text-blue-700">{cond.label}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Zap size={12} /> 待执行动作
                  </p>
                  <div className="space-y-2">
                    {parsedIntent.actions.map((action, idx) => (
                      <div key={action.id} className="flex items-start gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-800">{action.description}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">目标: {action.target}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isExecuting ? 'bg-violet-100 text-violet-500 cursor-wait' :
                      parsedIntent.riskLevel === 'critical'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-sm'
                    }`}
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        执行中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        确认执行
                      </>
                    )}
                  </button>
                  <button onClick={handleReset} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200">
                    重新输入
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {executionResult && (
          <div className="space-y-4">
            {/* Result Header */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className={`px-4 py-3 ${
                executionResult.status === 'completed' ? 'bg-green-50' :
                executionResult.status === 'partial' ? 'bg-amber-50' :
                executionResult.status === 'failed' ? 'bg-red-50' :
                'bg-violet-50'
              } border-b border-gray-100`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {executionResult.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500" /> :
                     executionResult.status === 'failed' ? <XCircle size={16} className="text-red-500" /> :
                     <Clock size={16} className="text-violet-500" />}
                    <span className="text-sm font-semibold text-gray-800">
                      {executionResult.status === 'completed' ? '执行完成' :
                       executionResult.status === 'failed' ? '执行失败' :
                       executionResult.status === 'partial' ? '部分成功' : '执行结束'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span>耗时 {executionResult.duration || '--'}s</span>
                    <span>{new Date(executionResult.startedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-800 tabular-nums">{executionResult.totalTargets}</div>
                    <div className="text-[10px] text-gray-500">总目标</div>
                  </div>
                  <div className="text-center p-2.5 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600 tabular-nums">{executionResult.successCount}</div>
                    <div className="text-[10px] text-green-500">成功</div>
                  </div>
                  <div className="text-center p-2.5 bg-red-50 rounded-lg">
                    <div className="text-lg font-bold text-red-600 tabular-nums">{executionResult.failedCount}</div>
                    <div className="text-[10px] text-red-500">失败</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(executionResult.successCount / Math.max(executionResult.totalTargets, 1)) * 100}%` }} />
                    {executionResult.failedCount > 0 && (
                      <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(executionResult.failedCount / Math.max(executionResult.totalTargets, 1)) * 100}%` }} />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 tabular-nums w-12 text-right">
                    {Math.round((executionResult.successCount / Math.max(executionResult.totalTargets, 1)) * 100)}%
                  </span>
                </div>

                {/* Step Results */}
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">执行详情</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {executionResult.results.map((step, idx) => (
                      <div key={`${step.actionId}-${idx}`} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                        step.status === 'success' ? 'bg-green-50 border-green-100' :
                        step.status === 'failed' ? 'bg-red-50 border-red-100' :
                        step.status === 'running' ? 'bg-violet-50 border-violet-100' :
                        step.status === 'timeout' ? 'bg-amber-50 border-amber-100' :
                        'bg-gray-50 border-gray-100'
                      }`}>
                        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                          step.status === 'success' ? 'bg-green-100 text-green-600' :
                          step.status === 'failed' ? 'bg-red-100 text-red-600' :
                          step.status === 'running' ? 'bg-violet-100 text-violet-600' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {step.status === 'success' ? <CheckCircle2 size={12} /> :
                           step.status === 'failed' ? <XCircle size={12} /> :
                           step.status === 'running' ? <Loader2 size={12} className="animate-spin" /> :
                           step.status === 'timeout' ? <AlertTriangle size={12} /> :
                           <ArrowRight size={12} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-700 truncate">{step.target}</p>
                          {step.error && <p className="text-[10px] text-red-500 truncate">{step.error}</p>}
                          {step.output && <p className="text-[10px] text-green-600 truncate">{step.output}</p>}
                        </div>
                        {step.duration !== undefined && (
                          <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{step.duration}s</span>
                        )}
                        {step.retryCount > 0 && (
                          <span className="text-[9px] px-1.5 py-0 rounded bg-amber-100 text-amber-600 shrink-0">重试x{step.retryCount}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={handleReset} className="flex-1 py-2 rounded-lg text-sm font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors flex items-center justify-center gap-1.5">
                    <Send size={14} /> 新建指令
                  </button>
                  {executionResult.failedCount > 0 && (
                    <button className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors flex items-center gap-1.5 border border-amber-200">
                      <RotateCcw size={13} /> 重试失败项
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isParsing && !parsedIntent && !executionResult && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center mb-4">
              <Sparkles size={32} className="text-violet-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">用自然语言描述运维操作</p>
            <p className="text-[11px] mt-1 text-gray-400 max-w-[280px] text-center">AI 将自动解析您的意图，识别条件和动作，确认后自动执行</p>
          </div>
        )}
      </div>
    </div>
  );
}

async function parseIntentWithLLM(input: string): Promise<ParsedIntent> {
  const lowerInput = input.toLowerCase();
  let intentType: ParsedIntent['intentType'] = 'single_action';
  let riskLevel: ParsedIntent['riskLevel'] = 'medium';
  let requiresConfirmation = true;

  if ((lowerInput.includes('cpu') || lowerInput.includes('内存') || lowerInput.includes('memory') || lowerInput.includes('磁盘')) &&
      (lowerInput.includes('超过') || lowerInput.includes('>') || lowerInput.includes('高于'))) {
    intentType = 'batch_execute';
    riskLevel = lowerInput.includes('重启') || lowerInput.includes('stop') ? 'high' : 'low';
  }
  if (lowerInput.includes('如果') || lowerInput.includes('当') || lowerInput.includes('when')) {
    intentType = 'conditional_trigger';
    riskLevel = 'low';
    requiresConfirmation = false;
  }
  if (lowerInput.includes('扩容') || lowerInput.includes('缩容') || lowerInput.includes('scale') || lowerInput.includes('副本')) {
    intentType = 'scale';
    riskLevel = 'medium';
  }
  if (lowerInput.includes('查询') || lowerInput.includes('查看') || lowerInput.includes('show') || lowerInput.includes('list')) {
    intentType = 'query';
    riskLevel = 'low';
    requiresConfirmation = false;
  }
  if (lowerInput.includes('回滚') || lowerInput.includes('rollback')) {
    intentType = 'rollback';
    riskLevel = 'critical';
  }

  const conditions: ParsedIntent['conditions'] = [];
  const actions: ParsedIntent['actions'] = [];

  if (lowerInput.includes('cpu')) {
    const match = lowerInput.match(/cpu[^0-9]*(\d+)/);
    const val = match ? parseInt(match[1]) : 80;
    conditions.push({ id: 'c1', field: 'cpu', operator: '>', value: val, label: `CPU 使用率 > ${val}%` });
  }
  if (lowerInput.includes('内存') || lowerInput.includes('memory')) {
    const match = lowerInput.match(/(?:内存|memory)[^0-9]*(\d+)/);
    const val = match ? parseInt(match[1]) : 90;
    conditions.push({ id: 'c2', field: 'memory', operator: '>', value: val, label: `内存使用率 > ${val}%` });
  }
  if (lowerInput.includes('连接数') || lowerInput.includes('connection')) {
    const match = lowerInput.match(/连接数[^0-9]*(\d+)/);
    const val = match ? parseInt(match[1]) : 1000;
    conditions.push({ id: 'c3', field: 'connection_count', operator: '>', value: val, label: `连接数 > ${val}` });
  }
  if (lowerInput.includes('异常') || lowerInput.includes('error') || lowerInput.includes('错误')) {
    conditions.push({ id: 'c4', field: 'status', operator: '==', value: 'error', label: '状态 = 异常' });
  }

  if (lowerInput.includes('重启') || lowerInput.includes('restart')) {
    actions.push({ id: 'a1', type: 'restart', target: '匹配实例', params: {}, order: 1, description: '逐台重启符合条件的实例' });
  }
  if (lowerInput.includes('邮件') || lowerInput.includes('email') || lowerInput.includes('notify')) {
    actions.push({ id: 'a2', type: 'notify', target: 'admin@company.com', params: { channel: 'email' }, order: 2, description: '发送告警邮件通知' });
  }
  if (lowerInput.includes('钉钉') || lowerInput.includes('群') || lowerInput.includes('slack')) {
    actions.push({ id: 'a3', type: 'notify', target: '运维值班群', params: { channel: 'dingtalk' }, order: 3, description: '发送即时消息到值班群' });
  }
  if (lowerInput.includes('扩容') || lowerInput.includes('scale')) {
    const match = lowerInput.match(/(\d+)\s*(?:个)?\s*副本|(\d+)\s*实例/i);
    const replicas = match ? (parseInt(match[1]) || parseInt(match[2])) : 10;
    actions.push({ id: 'a1', type: 'scale', target: '目标服务', params: { replicas }, order: 1, description: `扩容至 ${replicas} 个副本` });
  }

  if (actions.length === 0) {
    actions.push({ id: 'a1', type: 'query', target: '匹配资源', params: {}, order: 1, description: '查询符合条件的目标列表' });
  }

  const estimatedTargets = intentType === 'batch_execute' ? Math.floor(Math.random() * 15) + 5 : undefined;

  return {
    id: `intent-${Date.now()}`,
    rawInput: input,
    intentType,
    confidence: 0.85 + Math.random() * 0.14,
    conditions,
    actions,
    estimatedTargets,
    riskLevel,
    requiresConfirmation,
    parsedAt: Date.now(),
    explanation: generateExplanation(intentType, conditions, actions),
  };
}

function generateExplanation(intentType: string, conditions: any[], actions: any[]): string {
  const condStr = conditions.map(c => c.label).join(' 且 ');
  const actionStr = actions.map(a => a.description).join(' → ');
  switch (intentType) {
    case 'batch_execute': return `检测到批量操作请求。系统将筛选满足条件（${condStr}）的所有目标，然后${actionStr}`;
    case 'conditional_trigger': return `检测到规则创建请求。当触发条件（${condStr}）满足时，将自动${actionStr}`;
    case 'scale': return `检测到弹性伸缩请求。将对目标服务执行${actionStr}`;
    default: return `已理解您的操作意图，将按以下步骤执行`;
  }
}

async function executeIntent(intent: ParsedIntent): Promise<ExecutionRecord> {
  await new Promise(resolve => setTimeout(resolve, 2500));
  const targets = intent.estimatedTargets || Math.floor(Math.random() * 8) + 3;
  const failRate = intent.riskLevel === 'critical' ? 0.3 : intent.riskLevel === 'high' ? 0.15 : 0.05;
  const failedCount = Math.floor(targets * failRate);
  const successCount = targets - failedCount;

  const results: ExecutionRecord['results'] = [];
  for (let i = 0; i < targets; i++) {
    const isFailed = i < failedCount;
    const serverNames = ['web-prod-01', 'web-prod-02', 'api-gw-01', 'order-svc-01', 'order-svc-02',
      'user-svc-01', 'payment-svc-01', 'db-primary-01', 'cache-node-01', 'worker-01',
      'gateway-02', 'svc-inventory', 'svc-notification', 'mq-kafka-01'];
    results.push({
      actionId: intent.actions[0]?.id || 'a1',
      target: serverNames[i % serverNames.length],
      status: isFailed ? (Math.random() > 0.5 ? 'failed' : 'timeout') : 'success',
      output: isFailed ? undefined : '操作成功完成',
      error: isFailed ? (Math.random() > 0.5 ? '权限不足: 无权执行该操作' : '操作超时: 目标无响应') : undefined,
      duration: isFailed ? 30 : Math.floor(Math.random() * 15) + 3,
      startedAt: Date.now() - (targets - i) * 500,
      completedAt: Date.now(),
      retryCount: isFailed && Math.random() > 0.7 ? 1 : 0,
    });
  }

  return {
    id: `exec-${Date.now()}`,
    intentId: intent.id,
    type: 'intent_execution',
    status: failedCount === 0 ? 'completed' : successCount > 0 ? 'partial' : 'failed',
    name: intent.rawInput.substring(0, 30) + (intent.rawInput.length > 30 ? '...' : ''),
    description: intent.explanation,
    conditions: intent.conditions as any,
    actions: intent.actions as any,
    results,
    totalTargets: targets,
    successCount,
    failedCount,
    startedAt: Date.now() - 3000,
    completedAt: Date.now(),
    duration: 3,
  };
}
