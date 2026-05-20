import React, { useState, useCallback } from 'react';
import { Shield, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, Search, FileText, Trash2, Lock, Eye, EyeOff } from 'lucide-react';
import type { SecurityFinding, SecurityScanResult } from '../types/moduleData';

const SAMPLE_CONFIG = `# application.yml - 生产环境配置
spring:
  application:
    name: order-service
  datasource:
    url: jdbc:mysql://root:Admin@123@192.168.1.100:3306/order_db?useSSL=false
    username: root
    password: admin123456
  redis:
    host: 192.168.1.101
    port: 6379
    password: redis_pass_2024

server:
  port: 8080
  address: 0.0.0.0

logging:
  level:
    root: INFO
  file: /var/log/app.log

# 第三方服务配置
payment:
  api-key: sk-live-abc123def456ghi789
  webhook-secret: whsec_xxxxxxxxxxxxxxxx

jwt:
  secret: my-super-secret-jwt-key-2024
  expiration: 86400`;

interface SecurityScannerProps {
  initialResult?: SecurityScanResult | null;
}

export default function SecurityScanner({ initialResult }: SecurityScannerProps) {
  const [fileType, setFileType] = useState<'yaml' | 'properties' | 'env' | 'json' | 'conf'>('yaml');
  const [configInput, setConfigInput] = useState('');
  const [result, setResult] = useState<SecurityScanResult | null>(initialResult || null);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSensitive, setShowSensitive] = useState(false);

  const loadSample = useCallback(() => {
    setConfigInput(SAMPLE_CONFIG);
    setResult(null);
  }, []);

  const runScan = useCallback(() => {
    if (!configInput.trim()) return;
    setIsScanning(true);
    setTimeout(() => {
      const findings = generateMockFindings(configInput, fileType);
      const score = calculateSecurityScore(findings);
      setResult({
        scanTarget: configInput.substring(0, 50) + '...',
        fileType,
        findings,
        securityScore: score,
        summary: {
          critical: findings.filter(f => f.severity === 'critical').length,
          warning: findings.filter(f => f.severity === 'warning').length,
          info: findings.filter(f => f.severity === 'info').length,
        },
      });
      setIsScanning(false);
    }, 1500);
  }, [configInput, fileType]);

  const toggleFinding = (id: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredFindings = result?.findings.filter((finding: SecurityFinding) => {
    if (severityFilter !== 'all' && finding.severity !== severityFilter) return false;
    if (searchQuery && !finding.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !finding.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  const severityConfig = {
    critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: '严重' },
    warning: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '警告' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', label: '信息' },
  };

  const scoreColor = result ? (
    result.securityScore >= 80 ? 'from-green-500 to-emerald-400' :
    result.securityScore >= 60 ? 'from-amber-500 to-yellow-400' :
    'from-red-500 to-rose-400'
  ) : 'from-gray-400 to-gray-300';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-50">
            <Shield size={16} className="text-rose-500" />
          </div>
          <span className="text-sm font-medium text-gray-800">安全扫描</span>
          {result && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gradient-to-r ${scoreColor} text-white`}>
              安全评分 {result.securityScore}/100
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fileType}
            onChange={(e) => { setFileType(e.target.value as typeof fileType); setResult(null); }}
            className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:border-rose-300"
          >
            <option value="yaml">YAML</option>
            <option value="properties">Properties</option>
            <option value="env">.env</option>
            <option value="json">JSON</option>
            <option value="conf">Conf</option>
          </select>
          <button onClick={loadSample} className="text-[11px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1">
            <FileText size={11} /> 示例
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex min-h-0">
        <div className={`${result ? 'w-[45%]' : 'w-full'} flex flex-col border-r border-gray-100 transition-all duration-300`}>
          <div className="px-3 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">扫描目标</span>
            <div className="flex items-center gap-1.5">
              {configInput && (
                <>
                  <button onClick={() => setShowSensitive(!showSensitive)} className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors" title={showSensitive ? '隐藏敏感信息' : '显示敏感信息'}>
                    {showSensitive ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button onClick={() => { setConfigInput(''); setResult(null); }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="清空">
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <textarea
              value={configInput}
              onChange={(e) => setConfigInput(e.target.value)}
              placeholder={`粘贴需要扫描的${fileType.toUpperCase()} 配置文件内容...\n\n将自动检测：\n• 明文密码和弱密码\n• API Key / Token 泄露\n• 不安全的连接配置\n• 硬编码的 IP 和凭证`}
              className="w-full h-full resize-none border border-gray-200 rounded-lg p-3 text-[12px] font-mono leading-relaxed text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-100 bg-gray-50/50"
              spellCheck={false}
            />
          </div>
          <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={runScan}
              disabled={!configInput.trim() || isScanning}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                !configInput.trim()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isScanning
                    ? 'bg-rose-100 text-rose-500'
                    : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-600 hover:to-pink-600 shadow-sm'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  扫描中...
                </>
              ) : (
                <>
                  <Lock size={14} />
                  开始扫描
                </>
              )}
            </button>
          </div>
        </div>

        {result && (
          <div className="w-[55%] flex flex-col overflow-hidden">
            {/* Score Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-rose-50/30 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {(['critical', 'warning', 'info'] as const).map(s => {
                    const count = s === 'critical' ? result.summary.critical : s === 'warning' ? result.summary.warning : result.summary.info;
                    if (count === 0) return null;
                    const cfg = severityConfig[s];
                    const Icon = cfg.icon;
                    return (
                      <button key={s} onClick={() => setSeverityFilter(severityFilter === s ? 'all' : s)}
                        className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${cfg.badge} ${severityFilter === s ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                        <Icon size={11} /> {count}
                      </button>
                    );
                  })}
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="筛选问题..."
                    className="text-[11px] pl-7 pr-2 py-1 w-32 border border-gray-200 rounded-md focus:outline-none focus:border-rose-300 bg-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                  {result.summary.critical > 0 && (
                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(result.summary.critical / result.findings.length) * 100}%` }} />
                  )}
                  {result.summary.warning > 0 && (
                    <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(result.summary.warning / result.findings.length) * 100}%` }} />
                  )}
                  {result.summary.info > 0 && (
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(result.summary.info / result.findings.length) * 100}%` }} />
                  )}
              </div>
              <span className="text-xs font-bold text-gray-700 tabular-nums ml-3">{result.securityScore}<span className="text-gray-400 font-normal text-[10px]">/100</span></span>
            </div>
          </div>

            {/* Findings List */}
            {filteredFindings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Shield size={40} className="mb-2 text-green-400" />
                <p className="text-sm">{searchQuery ? '无匹配结果' : '未发现安全隐患'}</p>
                <p className="text-[11px] mt-1">配置安全{searchQuery ? '' : '✨'}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredFindings.map((finding: SecurityFinding) => {
                  const cfg = severityConfig[finding.severity];
                  const Icon = cfg.icon;
                  const isExpanded = expandedFindings.has(finding.id);
                  return (
                    <div key={finding.id} className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden transition-all`}>
                      <button onClick={() => toggleFinding(finding.id)} className="w-full px-3 py-2.5 flex items-start gap-2.5 text-left">
                        <Icon size={15} className={`mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[12px] font-medium ${cfg.color}`}>{finding.title}</span>
                            <span className={`text-[9px] px-1.5 py-0 rounded font-medium ${cfg.badge}`}>{cfg.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] text-gray-500 line-clamp-1 flex-1">{finding.description}</p>
                            {finding.matchedContent && (
                              <code className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-mono max-w-[140px] truncate">
                                {showSensitive ? finding.matchedContent : finding.maskedContent}
                              </code>
                            )}
                          </div>
                          {finding.line && (
                            <span className="text-[10px] text-gray-400 mt-0.5 inline-block">第 {finding.line} 行</span>
                          )}
                        </div>
                        {isExpanded ? <ChevronDown size={14} className="shrink-0 text-gray-400 mt-0.5" /> : <ChevronRight size={14} className="shrink-0 text-gray-400 mt-0.5" />}
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-white/50 ml-7 space-y-2.5">
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">风险详情</p>
                            <p className="text-[12px] text-gray-700 leading-relaxed">{finding.description}</p>
                          </div>
                          {finding.matchedContent && (
                            <div>
                              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">匹配内容</p>
                              <pre className="text-[11px] bg-red-50 border border-red-200 text-red-800 rounded-md p-2 font-mono break-all">
                                {showSensitive ? finding.matchedContent : finding.maskedContent}
                              </pre>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">修复建议</p>
                            <p className="text-[12px] text-emerald-700 bg-emerald-50 rounded-md p-2 leading-relaxed">{finding.remediation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>共发现 {result.findings.length} 个安全问题</span>
                <span className="flex items-center gap-1"><Shield size={10} /> Security Scanner v1.0</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function generateMockFindings(content: string, fileType: string): SecurityFinding[] {
  const lines = content.split('\n');
  const findings: SecurityFinding[] = [];
  let idCounter = 1;

  const addFinding = (params: Omit<SecurityFinding, 'id'>) => {
    findings.push({ ...params, id: `sec-${String(idCounter++).padStart(3, '0')}` });
  };

  const maskValue = (value: string): string => {
    if (value.length <= 4) return '*'.repeat(value.length);
    return value.substring(0, 2) + '*'.repeat(Math.min(value.length - 3, 8)) + value.slice(-2);
  };

  const passwordPatterns = [
    { regex: /password\s*[:=]\s*["']?([^"'\s]+)["']?/gi, label: '密码字段' },
    { regex: /passwd\s*[:=]\s*["']?([^"'\s]+)["']?/gi, label: '密码字段(passwd)' },
    { regex: /secret\s*[:=]\s*["']?([^"'\s]{3,})["']?/gi, label: '密钥字段' },
  ];

  for (const pattern of passwordPatterns) {
    let match;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(content)) !== null) {
      const value = match[1];
      if (!value || value.includes('${') || value.includes('{{')) continue;

      const lineNum = content.substring(0, match.index).split('\n').length;
      const strength = checkPasswordStrength(value);

      if (strength.score < 60) {
        addFinding({
          severity: 'critical',
          category: 'password',
          title: '弱密码检测',
          description: `检测到${pattern.label}使用了弱密码（强度: ${strength.score}/100），容易被暴力破解`,
          line: lineNum,
          matchedContent: value,
          maskedContent: maskValue(value),
          remediation: '使用强密码策略：至少12位，包含大小写字母、数字和特殊字符。建议使用密码管理器或密钥管理服务（如 HashiCorp Vault、AWS Secrets Manager）。',
        });
      } else {
        addFinding({
          severity: 'critical',
          category: 'password',
          title: '明文密码泄露',
          description: `${pattern.label}以明文形式存储在配置文件中，存在泄露风险`,
          line: lineNum,
          matchedContent: value,
          maskedContent: maskValue(value),
          remediation: '使用环境变量、Kubernetes Secret 或外部密钥管理系统存储敏感信息，避免明文写入配置文件。',
        });
      }
    }
  }

  const credentialPatterns = [
    { regex: /api[_-]?key\s*[:=]\s*["']?(sk-|pk-|ak-)?[\w\-]{16,}/gi, label: 'API Key' },
    { regex: /api[_-]?secret\s*[:=]\s*["']?[\w\-]{16,}/gi, label: 'API Secret' },
    { regex: /access[_-]?token\s*[:=]\s*["']?[\w\-\.]{20,}/gi, label: 'Access Token' },
    { regex: /webhook[_-]?secret\s*[:=]\s*["']?(whsec_)?[\w]+/gi, label: 'Webhook Secret' },
    { regex: /jwt[_-]?secret\s*[:=]\s*["']?[^"'\s]{8,}/gi, label: 'JWT Secret' },
  ];

  for (const pattern of credentialPatterns) {
    let match;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(content)) !== null) {
      const value = match[1] || match[0].split(/\s*[:=]\s*/)[1]?.replace(/["']/g, '') || '';
      const lineNum = content.substring(0, match.index).split('\n').length;

      addFinding({
        severity: 'critical',
        category: 'credential',
        title: `${pattern.label} 硬编码`,
        description: `${pattern.label}直接硬编码在配置文件中，一旦代码泄露将导致凭证被盗用`,
        line: lineNum,
        matchedContent: value,
        maskedContent: maskValue(value),
        remediation: '将凭证迁移到安全的密钥管理系统中，运行时动态注入。对于 CI/CD 流程使用加密的环境变量或 secrets 管理。',
      });
    }
  }

  if (/root[:@]/i.test(content) || /\busername\s*[:=]\s*root\b/i.test(content)) {
    const idx = content.search(/root[:@]|username\s*[:=]\s*root/i);
    const lineNum = content.substring(0, idx).split('\n').length;
    addFinding({
      severity: 'warning',
      category: 'access_control',
      title: 'Root 用户直连数据库',
      description: '数据库连接使用 root 账户，拥有过高权限，存在安全风险',
      line: lineNum,
      matchedContent: 'root',
      maskedContent: '****',
      remediation: '创建专用的最小权限应用账号，仅授予必要的 SELECT/INSERT/UPDATE/DELETE 权限，避免使用管理员账户。',
    });
  }

  const ipPattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
  let ipMatch;
  while ((ipMatch = ipPattern.exec(content)) !== null) {
    const ip = ipMatch[0];
    if (ip === '127.0.0.1' || ip === '0.0.0.0' || ip === 'localhost') continue;
    const lineNum = content.substring(0, ipMatch.index).split('\n').length;
    addFinding({
      severity: 'warning',
      category: 'network',
      title: '内网 IP 地址硬编码',
      description: `内网 IP 地址 (${ip}) 硬编码在配置中，环境变更时需手动修改`,
      line: lineNum,
      matchedContent: ip,
      maskedContent: ip.split('.').map((_, i) => i > 1 ? '*' : ip.split('.')[i]).join('.'),
      remediation: '使用 DNS 域名或服务发现机制替代硬编码 IP；通过配置中心（如 Nacos、Consul）动态获取服务地址。',
    });
  }

  if (/useSSL\s*=\s*false|ssl\s*[:=]\s*false|sslmode\s*[:=]\s*disable/i.test(content)) {
    const idx = content.search(/useSSL\s*=\s*false|ssl\s*[:=]\s*false|sslmode\s*[:=]\s*disable/i);
    const lineNum = content.substring(0, idx).split('\n').length;
    addFinding({
      severity: 'warning',
      category: 'encryption',
      title: '禁用了 SSL/TLS 加密',
      description: '数据库或网络连接未启用 SSL/TLS 加密，数据传输过程中可能被窃听',
      line: lineNum,
      matchedContent: 'ssl=false / useSSL=false',
      maskedContent: 'ssl=****',
      remediation: '启用 SSL/TLS 连接确保传输加密。MySQL 设置 useSSL=true 并配置 CA 证书；PostgreSQL 设置 sslmode=require 或 verify-full。',
    });
  }

  if (/\bhttp:\/\/(?!localhost)/i.test(content)) {
    const httpMatches = content.match(/http:\/\/[^\s"']+/gi) || [];
    for (const url of httpMatches) {
      if (url.includes('localhost')) continue;
      const idx = content.indexOf(url);
      const lineNum = content.substring(0, idx).split('\n').length;
      addFinding({
        severity: 'warning',
        category: 'encryption',
        title: '使用非 HTTPS URL',
        description: `使用 HTTP 协议 (${url}) 而非 HTTPS，数据传输未加密`,
        line: lineNum,
        matchedContent: url,
        maskedContent: url.replace(/[a-zA-Z]/g, (c, i) => i > 6 ? '*' : c),
        remediation: '所有生产环境的 API 调用和服务间通信应使用 HTTPS 协议，确保数据传输加密。',
      });
    }
  }

  if (/chmod\s+777|permission\s*:\s*['"]?777|mode\s*[:=]\s*['"]?777/i.test(content)) {
    const idx = content.search(/chmod\s+777|permission\s*:\s*['"]?777|mode\s*[:=]\s*['"]?777/i);
    const lineNum = content.substring(0, idx).split('\n').length;
    addFinding({
      severity: 'warning',
      category: 'permission',
      title: '文件权限过于宽松 (777)',
      description: '文件权限设置为 777，任何用户都可以读写执行该文件',
      line: lineNum,
      matchedContent: '777',
      maskedContent: '***',
      remediation: '遵循最小权限原则，仅赋予必要的读写权限（如 644 用于文件，755 用于目录）。避免使用 777 权限。',
    });
  }

  if (/(log|logger)\.(level|path|file)\s*[:=]/i.test(content)) {
    addFinding({
      severity: 'info',
      category: 'logging',
      title: '日志可能包含敏感信息',
      description: '日志配置中应确保不记录密码、Token、信用卡号等敏感信息',
      matchedContent: 'log.level / log.path',
      maskedContent: '***********',
      remediation: '配置日志脱敏规则，对敏感字段进行掩码处理（如 password=***）；设置合理的日志保留策略和访问控制。',
    });
  }

  if (findings.length === 0) {
    addFinding({
      severity: 'info',
      category: 'hardcoded',
      title: '扫描完成',
      description: '当前配置文件未发现明显的安全隐患，建议定期进行安全审计。',
      matchedContent: '',
      maskedContent: '',
      remediation: '保持良好的安全实践：定期轮换密钥、使用最小权限原则、启用审计日志、定期更新依赖版本。',
    });
  }

  return findings;
}

function checkPasswordStrength(password: string): { score: number; issues: string[] } {
  let score = 0;
  const issues: string[] = [];

  if (password.length >= 12) score += 25;
  else if (password.length >= 8) score += 15;
  else issues.push(`长度不足 (${password.length}/12)`);

  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  else issues.push('缺少大写字母');

  if (/[0-9]/.test(password)) score += 15;
  else issues.push('缺少数字');

  if (/[^a-zA-Z0-9]/.test(password)) score += 20;
  else issues.push('缺少特殊字符');

  if (/^(admin|password|123456|qwerty|letmein|welcome)/i.test(password)) {
    score -= 30;
    issues.push('使用常见弱密码');
  }

  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    issues.push('包含连续重复字符');
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

function calculateSecurityScore(findings: SecurityFinding[]): number {
  let score = 100;
  for (const f of findings) {
    switch (f.severity) {
      case 'critical': score -= 20; break;
      case 'warning': score -= 8; break;
      case 'info': score -= 2; break;
    }
  }
  return Math.max(0, Math.min(100, score));
}
