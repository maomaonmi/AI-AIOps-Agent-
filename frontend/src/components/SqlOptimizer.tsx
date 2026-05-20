import React, { useState, useCallback } from 'react';
import { Zap, AlertTriangle, AlertCircle, Info, Copy, Check, ChevronDown, ChevronRight, Database, Clock, TrendingDown, FileText, Trash2 } from 'lucide-react';
import type { SqlIssue, SqlOptimizationResult } from '../types/moduleData';

const SAMPLE_SQL = `SELECT *
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN products p ON o.product_id = p.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.create_time > '2025-01-01'
  AND u.status = 1
ORDER BY o.create_time DESC
LIMIT 100000, 20`;

interface SqlOptimizerProps {
  initialResult?: SqlOptimizationResult | null;
}

export default function SqlOptimizer({ initialResult }: SqlOptimizerProps) {
  const [dbType, setDbType] = useState<'mysql' | 'postgresql'>('mysql');
  const [sqlInput, setSqlInput] = useState('');
  const [result, setResult] = useState<SqlOptimizationResult | null>(initialResult || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const loadSample = useCallback(() => {
    setSqlInput(SAMPLE_SQL);
    setResult(null);
  }, []);

  const runOptimize = useCallback(() => {
    if (!sqlInput.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const issues = generateMockIssues(sqlInput);
      const optimizedSql = generateOptimizedSql(sqlInput, dbType);
      const score = calculateScore(issues);
      setResult({
        originalSql: sqlInput,
        optimizedSql,
        dbType,
        analysis: {
          estimatedRows: Math.floor(Math.random() * 5000000) + 500000,
          estimatedTime: `${(Math.random() * 15 + 3).toFixed(1)}s`,
          improvement: `扫描行数 ↓${Math.floor(Math.random() * 30 + 70)}%, 耗时 ↓${Math.floor(Math.random() * 40 + 60)}%`,
          tableCount: extractTableCount(sqlInput),
          joinCount: extractJoinCount(sqlInput),
        },
        issues,
        score,
      });
      setIsAnalyzing(false);
    }, 1500);
  }, [sqlInput, dbType]);

  const toggleIssue = (id: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyOptimized = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.optimizedSql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const severityConfig = {
    critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: '严重' },
    warning: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '警告' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', label: '建议' },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-50">
            <Zap size={16} className="text-violet-500" />
          </div>
          <span className="text-sm font-medium text-gray-800">SQL 优化</span>
          {result && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              result.score >= 80 ? 'bg-green-100 text-green-700' :
              result.score >= 60 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              评分 {result.score}/100
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dbType}
            onChange={(e) => { setDbType(e.target.value as typeof dbType); setResult(null); }}
            className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:border-violet-300"
          >
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL</option>
          </select>
          <button onClick={loadSample} className="text-[11px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1">
            <FileText size={11} /> 示例
          </button>
        </div>
      </div>

      {!result ? (
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500">输入 SQL 查询语句</span>
            {sqlInput && (
              <button onClick={() => { setSqlInput(''); setResult(null); }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="清空">
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <textarea
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            placeholder={`粘贴需要优化的 SQL 语句...\n\n支持 ${dbType === 'mysql' ? 'MySQL' : 'PostgreSQL'} SQL 语法分析`}
            className="flex-1 w-full resize-none border border-gray-200 rounded-lg p-3 text-[12px] font-mono leading-relaxed text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-violet-300 focus:ring-1 focus:violet-100 bg-gray-50/50"
            spellCheck={false}
          />
          <div className="mt-3">
            <button
              onClick={runOptimize}
              disabled={!sqlInput.trim() || isAnalyzing}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                !sqlInput.trim()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isAnalyzing
                    ? 'bg-violet-100 text-violet-500'
                    : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-sm'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  一键优化
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* 原始 SQL */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <FileText size={13} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-600">原始 SQL</span>
              </div>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
                <code>{result.originalSql}</code>
              </pre>
            </div>

            {/* 分析摘要 */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Database, label: '表数量', value: result.analysis.tableCount, color: 'text-blue-600', bg: 'bg-blue-50' },
                { icon: TrendingDown, label: 'JOIN 数', value: result.analysis.joinCount, color: 'text-purple-600', bg: 'bg-purple-50' },
                { icon: Clock, label: '预估扫描', value: formatNumber(result.analysis.estimatedRows), color: 'text-orange-600', bg: 'bg-orange-50' },
                { icon: Clock, label: '预估耗时', value: result.analysis.estimatedTime, color: 'text-red-600', bg: 'bg-red-50' },
              ].map((item, i) => (
                <div key={i} className={`${item.bg} rounded-lg p-2.5`}>
                  <item.icon size={14} className={`${item.color} mb-1`} />
                  <div className={`text-lg font-bold tabular-nums ${item.color}`}>{item.value}</div>
                  <div className="text-[10px] text-gray-500">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 问题列表 */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={13} className="text-amber-500" />
                <span className="text-xs font-medium text-gray-600">发现 {result.issues.length} 个优化点</span>
                <span className="ml-auto text-[10px] text-green-600 font-medium flex items-center gap-0.5"><TrendingDown size={10} /> {result.analysis.improvement}</span>
              </div>
              <div className="space-y-2">
                {result.issues.map((issue) => {
                  const cfg = severityConfig[issue.severity];
                  const Icon = cfg.icon;
                  const isExpanded = expandedIssues.has(issue.id);
                  return (
                    <div key={issue.id} className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
                      <button onClick={() => toggleIssue(issue.id)} className="w-full px-3 py-2.5 flex items-start gap-2.5 text-left">
                        <Icon size={15} className={`mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[12px] font-medium ${cfg.color}`}>{issue.title}</span>
                            <span className={`text-[9px] px-1.5 py-0 rounded font-medium ${cfg.badge}`}>{cfg.label}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 line-clamp-1">{issue.description}</p>
                        </div>
                        {isExpanded ? <ChevronDown size={14} className="shrink-0 text-gray-400 mt-0.5" /> : <ChevronRight size={14} className="shrink-0 text-gray-400 mt-0.5" />}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-white/50 ml-7 space-y-2">
                          <p className="text-[12px] text-gray-700 leading-relaxed">{issue.description}</p>
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">优化建议</p>
                            <p className="text-[12px] text-green-700 bg-green-50 rounded-md p-2 leading-relaxed">{issue.suggestion}</p>
                          </div>
                          {issue.indexSuggestion && (
                            <div>
                              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">索引建议</p>
                              <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-md p-2.5 overflow-x-auto leading-relaxed font-mono">
                                <code>{issue.indexSuggestion}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 优化后 SQL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap size={13} className="text-green-500" />
                  <span className="text-xs font-medium text-gray-600">优化后 SQL</span>
                  <span className="text-[10px] text-green-600 font-medium">{result.analysis.improvement}</span>
                </div>
                <button
                  onClick={copyOptimized}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors flex items-center gap-1"
                >
                  {copied ? <><Check size={11} /> 已复制</> : <><Copy size={11} /> 复制</>}
                </button>
              </div>
              <pre className="bg-gradient-to-br from-emerald-950 to-gray-900 text-emerald-100 rounded-lg p-3 text-[11px] font-mono leading-relaxed overflow-x-auto border border-emerald-800/30">
                <code>{result.optimizedSql}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateMockIssues(sql: string): SqlIssue[] {
  const upperSql = sql.toUpperCase();
  const issues: SqlIssue[] = [];

  if (upperSql.includes('SELECT *')) {
    issues.push({
      id: 'sql-001', severity: 'critical', type: 'select_star',
      title: '使用了 SELECT *',
      description: 'SELECT * 会返回所有列，包括不需要的数据，增加网络传输和内存开销。当表结构变更时还可能导致应用层错误。',
      suggestion: '明确指定需要的列名，只查询业务所需的字段，减少数据传输量。',
    });
  }

  if (upperSql.includes('LIMIT') && /LIMIT\s+\d+,\s*\d+/i.test(sql)) {
    issues.push({
      id: 'sql-002', severity: 'critical', type: 'limit_offset',
      title: '深度分页性能问题',
      description: '使用 LIMIT offset, rows 进行深度分页时，数据库需要扫描并丢弃前面的所有行，随着 offset 增大性能急剧下降。',
      suggestion: '改用基于游标的分页方式（WHERE id > last_id ORDER BY id LIMIT N），或使用覆盖索引优化。',
    });
  }

  if (/ORDER\s+BY\s+.+(DESC|ASC)/i.test(sql)) {
    issues.push({
      id: 'sql-003', severity: 'warning', type: 'order_by',
      title: '排序字段可能缺少索引',
      description: 'ORDER BY 子句中的排序字段如果没有合适的索引，数据库将使用 filesort，在大数据量下严重影响性能。',
      suggestion: '为 ORDER BY 字段创建复合索引，确保排序操作可以利用索引有序性。',
      indexSuggestion: '-- MySQL\nALTER TABLE orders ADD INDEX idx_create_time_desc (create_time DESC);\n\n-- PostgreSQL\nCREATE INDEX idx_orders_create_time_desc ON orders (create_time DESC);',
    });
  }

  if ((upperSql.match(/JOIN\s/gi) || []).length >= 3) {
    issues.push({
      id: 'sql-004', severity: 'warning', type: 'join_type',
      title: '多表 JOIN 可能导致笛卡尔积',
      description: '多个大表 JOIN 时可能产生大量中间结果集，尤其是 LEFT JOIN 在无过滤条件时会保留左表全部行。',
      suggestion: '评估是否真的需要 LEFT JOIN，如果关联数据必须存在可改为 INNER JOIN；考虑拆分为多次查询或使用子查询。',
    });
  }

  if (upperSql.includes('LIKE ') && /LIKE\s+['"]%/i.test(upperSql)) {
    issues.push({
      id: 'sql-005', severity: 'warning', type: 'like_prefix',
      title: 'LIKE 前缀通配符无法走索引',
      description: "LIKE '%xxx' 或 LIKE '%xxx%' 的前缀通配符会导致全表扫描，无法利用 B-Tree 索引。",
      suggestion: "考虑使用全文索引（FULLTEXT）或搜索引擎（如 Elasticsearch）；如仅需后缀匹配可用 REVERSE() 函数配合索引。",
    });
  }

  if (upperSql.includes(' OR ') && !upperSql.includes('UNION')) {
    issues.push({
      id: 'sql-006', severity: 'warning', type: 'or_condition',
      title: 'OR 条件可能导致索引失效',
      description: 'OR 连接的不同字段条件通常只能使用其中一个字段的索引，另一个条件需要回表扫描。',
      suggestion: '将 OR 条件拆分为 UNION ALL 查询，每部分单独使用索引；或使用 IN 替代等值 OR 条件。',
    });
  }

  if (!upperSql.includes('WHERE') || upperSql.includes('SELECT * FROM') && !upperSql.includes('WHERE')) {
    // Only add if truly no WHERE on main query
    const hasWhereOnMainQuery = /\bWHERE\b/i.test(sql.split(/\bUNION\b|\bINTERSECT\b|\bEXCEPT\b/i)[0]);
    if (!hasWhereOnMainQuery) {
      issues.push({
        id: 'sql-007', severity: 'critical', type: 'no_where',
        title: '缺少 WHERE 条件限制',
        description: '查询没有 WHERE 条件限制，将扫描表中所有数据行，在全表场景下可能导致严重的性能问题。',
        suggestion: '添加适当的 WHERE 条件限制查询范围，结合业务需求设置合理的过滤条件。',
      });
    }
  }

  if (/\(\s*SELECT\b/i.test(sql)) {
    issues.push({
      id: 'sql-008', severity: 'info', type: 'subquery',
      title: '存在子查询',
      description: '相关子查询（Correlated Subquery）对外层每一行都执行一次，可能导致 N+1 问题。非相关子查询在 MySQL 5.6+ 和 PostgreSQL 中会自动优化。',
      suggestion: '将子查询改为 JOIN 关联查询；对于聚合类子查询考虑使用窗口函数替代。',
    });
  }

  if (upperSql.includes('COUNT(*)') || upperSql.includes('COUNT(1)')) {
    issues.push({
      id: 'sql-009', severity: 'info', type: 'function_column',
      title: '全表 COUNT 性能注意',
      description: 'COUNT(*) 在 InnoDB 中需要逐行扫描统计，大数据量表上执行较慢。',
      suggestion: '如果只需要判断是否存在数据，用 LIMIT 1 替代；考虑维护计数缓存或使用近似计数方案。',
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: 'sql-000', severity: 'info', type: 'select_star',
      title: 'SQL 结构良好',
      description: '当前 SQL 语句结构较为合理，未发现明显的性能问题。建议定期通过 EXPLAIN 分析执行计划。',
      suggestion: '保持良好的编码习惯：避免 SELECT *、合理使用索引、控制 JOIN 数量、注意分页深度。',
    });
  }

  return issues;
}

function generateOptimizedSql(originalSql: string, _dbType: string): string {
  let optimized = originalSql;

  optimized = optimized.replace(/SELECT\s+\*\s+FROM/gi, 'SELECT\n  o.id,\n  o.order_no,\n  o.amount,\n  o.status,\n  o.create_time,\n  o.user_id,\n  o.product_id,\n  u.username AS user_name,\n  p.name AS product_name,\n  oi.quantity,\n  oi.price\nFROM');

  if (optimized.includes('LEFT JOIN users')) {
    optimized = optimized.replace('LEFT JOIN users', 'INNER JOIN users');
  }
  if (optimized.includes('LEFT JOIN products')) {
    optimized = optimized.replace('LEFT JOIN products', 'INNER JOIN products');
  }

  optimized = optimized.replace(/LIMIT\s+(\d+)\s*,\s*(\d+)/gi, (_match, _offset, limit) => {
    return `-- 使用游标分页替代深度分页:\n-- WHERE o.id > :last_order_id ORDER BY o.id ASC\nLIMIT ${limit}`;
  });

  optimized += `\n\n-- 优化说明:
-- 1. 将 SELECT * 改为明确列名，减少 ~40% 数据传输
-- 2. LEFT JOIN → INNER JOIN（业务上用户和商品必须存在）
-- 3. 深度分页改为游标分页模式
-- 建议创建索引:
--   CREATE INDEX idx_orders_ctime_status ON orders(create_time, status, id);
--   CREATE INDEX idx_orders_user ON orders(user_id, create_time);`;

  return optimized;
}

function extractTableCount(sql: string): number {
  const matches = sql.match(/\bFROM\s+(\w+)|\bJOIN\s+(\w+)/gi) || [];
  const tables = new Set(matches.map(m => m.split(/\s+/).pop()?.replace(/[;,)]*$/, '').toLowerCase()));
  return tables.size;
}

function extractJoinCount(sql: string): number {
  return (sql.match(/\b(INNER\s+|LEFT\s+|RIGHT\s+|CROSS\s+)?JOIN\b/gi) || []).length;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function calculateScore(issues: SqlIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 18; break;
      case 'warning': score -= 8; break;
      case 'info': score -= 2; break;
    }
  }
  return Math.max(0, Math.min(100, score));
}
