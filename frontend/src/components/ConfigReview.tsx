import React, { useState, useCallback } from 'react';
import { FileText, AlertTriangle, AlertCircle, Info, CheckCircle2, Shield, Copy, ChevronDown, ChevronRight, Search, Zap, Trash2, Upload } from 'lucide-react';
import type { ConfigIssue, ConfigReviewResult } from '../types/moduleData';

const SAMPLE_K8S_CONFIG = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
      - name: order-service
        image: registry.example.com/order-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_PASSWORD
          value: "admin123"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
        volumeMounts:
        - name: data-volume
          mountPath: /data`;

const SAMPLE_DOCKER_CONFIG = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080
USER root
CMD ["node", "server.js"]`;

const RULE_DESCRIPTIONS: Record<string, string> = {
  resource_no_limits: '容器未设置资源限制（limits），可能导致资源耗尽影响节点稳定性',
  resource_no_requests: '容器未设置资源请求（requests），调度器无法合理分配资源',
  security_run_as_root: '容器以 root 用户运行，存在安全风险',
  security_no_security_context: '未配置 securityContext，建议设置 runAsNonRoot 和 readOnlyRootFilesystem',
  availability_no_liveness_probe: '未配置 livenessProbe，容器异常时无法自动重启',
  availability_no_readiness_probe: '未配置 readinessProbe，服务未就绪时会收到流量',
  best_practice_no_pdb: '未配置 PodDisruptionBudget，更新期间可能造成服务不可用',
  best_practice_no_hpa: '未使用 HorizontalPodAutoscaler，无法根据负载自动扩缩容',
  image_latest_tag: '使用 latest 镜像标签，可能导致版本不可控和回滚困难',
  network_no_policy: '未配置 NetworkPolicy，所有 Pod 间网络默认互通',
  docker_root_user: 'Dockerfile 中以 root 用户运行应用',
  docker_no_healthcheck: 'Dockerfile 未定义 HEALTHCHECK 指令',
  docker_expose_all: '暴露了不必要的端口，增加攻击面',
  docker_copy_all: '使用 COPY . . 可能复制敏感文件到镜像中',
};

interface ConfigReviewProps {
  initialResult?: ConfigReviewResult | null;
}

export default function ConfigReview({ initialResult }: ConfigReviewProps) {
  const [configType, setConfigType] = useState<'kubernetes' | 'docker'>('kubernetes');
  const [configInput, setConfigInput] = useState('');
  const [result, setResult] = useState<ConfigReviewResult | null>(initialResult || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadSample = useCallback(() => {
    setConfigInput(configType === 'kubernetes' ? SAMPLE_K8S_CONFIG : SAMPLE_DOCKER_CONFIG);
    setResult(null);
  }, [configType]);

  const runReview = useCallback(() => {
    if (!configInput.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const issues = generateMockIssues(configType, configInput);
      const score = calculateScore(issues);
      setResult({
        configType,
        rawConfig: configInput,
        issues,
        score,
        summary: {
          critical: issues.filter(i => i.severity === 'critical').length,
          warning: issues.filter(i => i.severity === 'warning').length,
          info: issues.filter(i => i.severity === 'info').length,
        },
      });
      setIsAnalyzing(false);
    }, 1200);
  }, [configType, configInput]);

  const toggleIssue = (id: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredIssues = result?.issues.filter(issue => {
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (searchQuery && !issue.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !issue.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const severityConfig = {
    critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: '严重' },
    warning: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '警告' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', label: '建议' },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-50">
            <Shield size={16} className="text-orange-500" />
          </div>
          <span className="text-sm font-medium text-gray-800">配置审查</span>
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
            value={configType}
            onChange={(e) => { setConfigType(e.target.value as typeof configType); setResult(null); }}
            className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:border-orange-300"
          >
            <option value="kubernetes">Kubernetes</option>
            <option value="docker">Dockerfile</option>
          </select>
          <button onClick={loadSample} className="text-[11px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1">
            <FileText size={11} /> 示例
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex min-h-0">
        <div className={`${result ? 'w-1/2' : 'w-full'} flex flex-col border-r border-gray-100 transition-all duration-300`}>
          <div className="px-3 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">配置内容</span>
            <div className="flex items-center gap-1.5">
              {configInput && (
                <button onClick={() => { setConfigInput(''); setResult(null); }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="清空">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <textarea
              value={configInput}
              onChange={(e) => setConfigInput(e.target.value)}
              placeholder={configType === 'kubernetes'
                ? '粘贴 Kubernetes YAML 配置...\n\n支持 Deployment、Service、ConfigMap 等资源类型'
                : '粘贴 Dockerfile 内容...\n\n将分析安全性和最佳实践'}
              className="w-full h-full resize-none border border-gray-200 rounded-lg p-3 text-[12px] font-mono leading-relaxed text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 bg-gray-50/50"
              spellCheck={false}
            />
          </div>
          <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={runReview}
              disabled={!configInput.trim() || isAnalyzing}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                !configInput.trim()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isAnalyzing
                    ? 'bg-orange-100 text-orange-500'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-sm'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  审查中...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  开始审查
                </>
              )}
            </button>
          </div>
        </div>

        {result && (
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">审查结果</span>
                <div className="flex items-center gap-1">
                  {(['critical', 'warning', 'info'] as const).map(s => {
                    const count = s === 'critical' ? result.summary.critical : s === 'warning' ? result.summary.warning : result.summary.info;
                    if (count === 0) return null;
                    const cfg = severityConfig[s];
                    const Icon = cfg.icon;
                    return (
                      <button key={s} onClick={() => setSeverityFilter(severityFilter === s ? 'all' : s)}
                        className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${cfg.badge} ${severityFilter === s ? 'ring-2 ring-offset-1 ring-current opacity-100' : 'opacity-80'}`}>
                        <Icon size={10} /> {count}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="筛选..."
                  className="text-[11px] pl-7 pr-2 py-1 w-28 border border-gray-200 rounded-md focus:outline-none focus:border-orange-300 bg-white"
                />
              </div>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <CheckCircle2 size={40} className="mb-2 text-green-400" />
                <p className="text-sm">{searchQuery ? '无匹配结果' : '未发现明显问题'}</p>
                <p className="text-[11px] mt-1">配置质量{searchQuery ? '' : '良好'} ✨</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredIssues.map((issue) => {
                  const cfg = severityConfig[issue.severity];
                  const Icon = cfg.icon;
                  const isExpanded = expandedIssues.has(issue.id);
                  return (
                    <div key={issue.id} className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden transition-all`}>
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
                        <div className="px-3 pb-3 pt-0 border-t border-white/50 ml-7">
                          <div className="mt-2 space-y-2.5">
                            <div>
                              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">问题描述</p>
                              <p className="text-[12px] text-gray-700 leading-relaxed">{issue.description}</p>
                              {RULE_DESCRIPTIONS[issue.category + '_' + issue.title.toLowerCase().replace(/\s+/g, '_')] && (
                                <p className="text-[11px] text-gray-500 mt-1 italic">{RULE_DESCRIPTIONS[issue.category + '_' + issue.title.toLowerCase().replace(/\s+/g, '_')]}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">修复建议</p>
                              <p className="text-[12px] text-green-700 bg-green-50 rounded-md p-2 leading-relaxed">{issue.suggestion}</p>
                            </div>
                            {issue.fixSnippet && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">修复代码</p>
                                  <button className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"><Copy size={10} /> 复制</button>
                                </div>
                                <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-md p-2.5 overflow-x-auto leading-relaxed font-mono">
                                  <code>{issue.fixSnippet}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.score >= 80 ? 'bg-green-500' :
                      result.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-600 tabular-nums w-12 text-right">{result.score}<span className="text-gray-400 font-normal">/100</span></span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function generateMockIssues(configType: string, _config: string): ConfigIssue[] {
  if (configType === 'kubernetes') {
    return [
      {
        id: 'k8s-001', severity: 'critical', category: 'resource',
        title: '未设置资源上限', description: '容器未配置 resources.limits，可能导致资源耗尽影响节点稳定性',
        suggestion: '在 spec.template.spec.containers[0].resources 下添加 limits 字段：\nresources:\n  limits:\n    memory: "512Mi"\n    cpu: "500m"',
        fixSnippet: 'resources:\n  requests:\n    memory: "256Mi"\n    cpu: "250m"\n  limits:\n    memory: "512Mi"\n    cpu: "500m"',
      },
      {
        id: 'k8s-002', severity: 'critical', category: 'security',
        title: '明文密码泄露', description: '环境变量中包含明文密码，存在安全风险',
        line: 19, suggestion: '使用 Kubernetes Secret 或外部密钥管理系统（如 Vault）存储敏感信息',
        fixSnippet: 'env:\n- name: DB_PASSWORD\n  valueFrom:\n    secretKeyRef:\n      name: db-secret\n      key: password',
      },
      {
        id: 'k8s-003', severity: 'warning', category: 'security',
        title: '缺少安全上下文', description: '未配置 securityContext，建议设置 runAsNonRoot 和 readOnlyRootFilesystem',
        suggestion: '添加 securityContext 配置以增强容器安全性',
        fixSnippet: 'securityContext:\n  runAsNonRoot: true\n  readOnlyRootFilesystem: true\n  allowPrivilegeEscalation: false\n  capabilities:\n    drop:\n      - ALL',
      },
      {
        id: 'k8s-004', severity: 'warning', category: 'availability',
        title: '未配置存活探针', description: '未设置 livenessProbe，容器异常时无法自动重启恢复',
        suggestion: '添加 livenessProbe 配置，建议使用 HTTP GET 或 TCP Socket 探测方式',
        fixSnippet: 'livenessProbe:\n  httpGet:\n    path: /health\n    port: 8080\n  initialDelaySeconds: 30\n  periodSeconds: 10',
      },
      {
        id: 'k8s-005', severity: 'warning', category: 'availability',
        title: '未配置就绪探针', description: '未设置 readinessProbe，服务未就绪时仍会收到流量导致错误',
        suggestion: '添加 readinessProbe 配置，确保只有健康的 Pod 接收流量',
        fixSnippet: 'readinessProbe:\n  httpGet:\n    path: /ready\n    port: 8080\n  initialDelaySeconds: 5\n  periodSeconds: 5',
      },
      {
        id: 'k8s-006', severity: 'info', category: 'image',
        title: '使用 latest 标签', description: '使用 latest 镜像标签可能导致部署版本不可控，难以回滚',
        suggestion: '使用具体版本号或 Git Commit SHA 作为镜像标签',
        fixSnippet: 'image: registry.example.com/order-service:v1.2.3',
      },
      {
        id: 'k8s-007', severity: 'info', category: 'best_practice',
        title: '未配置 PDB', description: '未配置 PodDisruptionBudget，节点维护或升级期间可能造成服务不可用',
        suggestion: '创建 PodDisruptionBudget 资源保证最小可用副本数',
        fixSnippet: 'apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: order-service-pdb\nspec:\n  minAvailable: 2\n  selector:\n    matchLabels:\n      app: order-service',
      },
      {
        id: 'k8s-008', severity: 'info', category: 'best_practice',
        title: '未启用 HPA', description: '未使用 HorizontalPodAutoscaler，无法根据负载自动扩缩容',
        suggestion: '创建 HPA 资源实现基于 CPU/内存/自定义指标的自动扩缩容',
        fixSnippet: 'apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: order-service-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: order-service\n  minReplicas: 3\n  maxReplicas: 10\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: 70',
      },
      {
        id: 'k8s-009', severity: 'info', category: 'network',
        title: '未限制网络策略', description: '未配置 NetworkPolicy，所有 Pod 间网络默认全通',
        suggestion: '创建 NetworkPolicy 限制 Pod 间的入站和出站流量',
        fixSnippet: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: order-service-netpol\nspec:\n  podSelector:\n    matchLabels:\n      app: order-service\n  policyTypes:\n  - Ingress\n  - Egress\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          app: api-gateway\n    ports:\n    - protocol: TCP\n      port: 8080',
      },
    ];
  }

  return [
    {
      id: 'docker-001', severity: 'critical', category: 'security',
      title: '以 Root 用户运行', description: 'Dockerfile 中 USER root 或未指定用户，容器内进程以 root 权限运行',
      line: 8, suggestion: '创建非 root 用户并以该用户运行应用',
      fixSnippet: 'RUN addgroup -g 1001 appgroup && \\\n    adduser -u 1001 -G appgroup -D appuser\nUSER appuser',
    },
    {
      id: 'docker-002', severity: 'warning', category: 'availability',
      title: '缺少健康检查', description: '未定义 HEALTHCHECK 指令，编排系统无法判断容器健康状态',
      suggestion: '添加 HEALTHCHECK 指令定期检查应用健康状态',
      fixSnippet: 'HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\n  CMD curl -f http://localhost:8080/health || exit 1',
    },
    {
      id: 'docker-003', severity: 'warning', category: 'security',
      title: '复制全部文件', description: '使用 COPY . . 可能将敏感文件（如 .env、密钥）复制到镜像中',
      line: 5, suggestion: '使用 .dockerfile 忽略不需要的文件，或明确指定需要复制的文件',
      fixSnippet: '# 创建 .dockerfile 文件\n# node_modules\n# .env\n# *.key\n# .git\n\nCOPY package*.json ./\nRUN npm ci --production\nCOPY src/ ./src/',
    },
    {
      id: 'docker-004', severity: 'info', category: 'best_practice',
      title: '未使用多阶段构建', description: '单阶段构建会导致最终镜像包含构建工具，体积较大',
      suggestion: '使用多阶段构建减小最终镜像体积',
      fixSnippet: '# Build stage\nFROM node:18-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production\nCOPY . .\nRUN npm run build\n\n# Production stage\nFROM node:18-alpine\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nUSER node\nEXPOSE 8080\nCMD ["node", "dist/server.js"]',
    },
    {
      id: 'docker-005', severity: 'info', category: 'image',
      title: '基础镜像可优化', description: '当前基础镜像可以进一步精简以减小攻击面',
      suggestion: '考虑使用 distroless 或更精简的基础镜像变体',
      fixSnippet: 'FROM gcr.io/distroless/nodejs18-debian11\nWORKDIR /app\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nEXPOSE 8080\nCMD ["dist/server.js"]',
    },
  ];
}

function calculateScore(issues: ConfigIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 15; break;
      case 'warning': score -= 6; break;
      case 'info': score -= 2; break;
    }
  }
  return Math.max(0, Math.min(100, score));
}
