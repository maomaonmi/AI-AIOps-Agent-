export type ModuleType = 'monitoring' | 'prediction' | 'diagnosis' | 'knowledge' | 'automation' | null;

export interface MetricDataPoint {
  time: string;
  value: number;
}

export interface MetricInfo {
  name: string;
  label: string;
  current: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  history: MetricDataPoint[];
}

export interface AlertInfo {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  source?: string;
}

export interface ServiceNode {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  latency?: number;
  errorRate?: number;
}

export interface ServiceEdge {
  from: string;
  to: string;
  latency?: number;
  requestsPerSecond?: number;
}

export interface ServiceTopologyData {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
}

export interface MonitoringModuleData {
  type: 'monitoring';
  data: {
    metrics: MetricInfo[];
    alerts: AlertInfo[];
    topology?: ServiceTopologyData;
    timeRange: string;
  };
}

export interface PredictionPoint {
  timestamp: string;
  value: number;
  isPredicted: boolean;
  confidence?: number;
  upperBound?: number;
  lowerBound?: number;
}

export interface RiskInfo {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: string;
  recommendation: string;
  timeToThreshold?: string;
}

export interface PredictionModuleData {
  type: 'prediction';
  data: {
    target: string;
    targetLabel: string;
    algorithm: string;
    current: number;
    unit: string;
    predictions: PredictionPoint[];
    risks: RiskInfo[];
    timeRange: string;
    predictionHorizon: string;
  };
}

export interface EvidenceItem {
  type: 'log' | 'metric' | 'trace' | 'event';
  source: string;
  content: string;
  relevance: number;
  timestamp?: string;
}

export interface SuggestedAction {
  action: string;
  description: string;
  confidence: number;
  automated: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DiagnosisModuleData {
  type: 'diagnosis';
  data: {
    service: string;
    symptom: string;
    rootCause: string;
    confidence: number;
    evidence: EvidenceItem[];
    suggestedActions: SuggestedAction[];
    relatedMetrics: MetricInfo[];
  };
}

export interface FlowStep {
  id: string;
  label: string;
  description: string;
  type: 'start' | 'process' | 'decision' | 'end' | 'action';
  nextSteps?: string[];
  decisionBranches?: { label: string; nextStep: string }[];
  icon?: string;
  color?: string;
}

export interface SOPDocument {
  id: string;
  title: string;
  category: string;
  description: string;
  steps: FlowStep[];
  tags: string[];
  lastUpdated: string;
  version: string;
  author: string;
  estimatedTime: string;
}

export interface KnowledgeSource {
  title: string;
  content: string;
  similarity: number;
  type: 'sop' | 'best_practice' | 'incident_record' | 'team_wiki';
  url?: string;
  createdFromIncident?: string;
  contributor?: string;
  successRate?: number;
  appliedCount?: number;
  tags?: string[];
  lastVerifiedAt?: string;
  sopDocument?: SOPDocument;
}

export interface KnowledgeModuleData {
  type: 'knowledge';
  data: {
    query: string;
    sources: KnowledgeSource[];
    relatedQuestions: string[];
    confidence: number;
    activeTab?: 'sop' | 'cases' | 'best_practices';
  };
}

export interface AutomationLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface AutomationModuleData {
  type: 'automation';
  data: {
    operation: string;
    operationLabel: string;
    target: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
    logs: AutomationLog[];
    result?: string;
    rollbackAvailable: boolean;
    duration?: number;
  };
}

export type AnyModuleData =
  | MonitoringModuleData
  | PredictionModuleData
  | DiagnosisModuleData
  | KnowledgeModuleData
  | AutomationModuleData;

export interface ModuleDataWrapper {
  type: string;
  data: Record<string, any>;
}

export interface UserProfile {
  name: string;
  role: 'junior' | 'mid' | 'senior' | 'admin';
  level: number;
  totalIncidents: number;
  preferredModules: string[];
  skillTags: string[];
  learningProgress: {
    completedPaths: number;
    totalPaths: number;
  };
  permissions: {
    level: 'viewer' | 'operator' | 'admin';
    canRestart: boolean;
    canScale: boolean;
    canConfig: boolean;
    canDeploy: boolean;
  };
}

export interface LearningPath {
  id: string;
  title: string;
  mentor: string;
  topic: string;
  steps: number;
  completed: boolean;
  progress: number;
}

export interface PersonalizedRecommendation {
  id: string;
  title: string;
  type: 'sop' | 'diagnosis' | 'monitoring' | 'learning';
  description: string;
  relevance: number;
  icon: string;
}

export interface TopologyNode {
  id: string;
  name: string;
  type: 'gateway' | 'service' | 'database' | 'cache' | 'queue' | 'message';
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  metrics?: {
    qps: number;
    errorRate: number;
    p99Latency: number;
  };
}

export interface TopologyEdge {
  source: string;
  target: string;
  latency: number;
  qps: number;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  timestamp: number;
}

export interface HeatmapNode {
  id: string;
  name: string;
  value: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface HeatmapData {
  nodes: HeatmapNode[];
  metricType: 'cpu' | 'memory' | 'network' | 'disk';
  timestamp: number;
  unit: string;
  avgValue: number;
  maxValue: number;
}

export interface ImpactNode {
  serviceId: string;
  serviceName: string;
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  affectedUsers: number;
  propagationPath: string[];
  metrics?: {
    errorRateIncrease: number;
    latencyIncrease: number;
  };
}

export interface FaultImpactData {
  faultSource: string;
  faultType: 'timeout' | 'error_5xx' | 'high_latency' | 'resource_exhausted';
  startTime: number;
  affectedServices: ImpactNode[];
  totalAffectedUsers: number;
  description: string;
}

export interface DashboardModuleData {
  type: 'dashboard';
  data: {
    topology: TopologyData;
    heatmap: HeatmapData;
    faultImpact: FaultImpactData | null;
    activeView: 'topology' | 'heatmap' | 'fault';
  };
}

export interface AIResponse {
  answer: string;
  module_data?: ModuleDataWrapper | null;
  success: boolean;
  error: string | null;
}

export interface ConfigIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'resource' | 'security' | 'availability' | 'best_practice' | 'image' | 'network';
  title: string;
  description: string;
  line?: number;
  suggestion: string;
  fixSnippet?: string;
}

export interface ConfigReviewResult {
  configType: 'kubernetes' | 'docker';
  rawConfig: string;
  issues: ConfigIssue[];
  score: number;
  summary: { critical: number; warning: number; info: number };
}

export interface SqlIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'select_star' | 'missing_index' | 'full_scan' | 'subquery'
       | 'or_condition' | 'like_prefix' | 'order_by' | 'limit_offset'
       | 'no_where' | 'join_type' | 'function_column';
  title: string;
  description: string;
  suggestion: string;
  indexSuggestion?: string;
}

export interface SqlOptimizationResult {
  originalSql: string;
  optimizedSql: string;
  dbType: 'mysql' | 'postgresql';
  analysis: {
    estimatedRows: number;
    estimatedTime: string;
    improvement: string;
    tableCount: number;
    joinCount: number;
  };
  issues: SqlIssue[];
  score: number;
}

export interface SecurityFinding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'password' | 'credential' | 'access_control'
           | 'network' | 'encryption' | 'logging' | 'permission' | 'hardcoded';
  title: string;
  description: string;
  line?: number;
  matchedContent: string;
  maskedContent: string;
  remediation: string;
}

export interface SecurityScanResult {
  scanTarget: string;
  fileType: 'yaml' | 'properties' | 'env' | 'json' | 'conf';
  findings: SecurityFinding[];
  securityScore: number;
  summary: { critical: number; warning: number; info: number };
}

export type OperatorType = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'in' | 'not_in';

export interface OperationCondition {
  id: string;
  field: 'cpu' | 'memory' | 'disk' | 'status' | 'service_name'
       | 'pod_phase' | 'error_rate' | 'latency' | 'connection_count'
       | 'qps' | 'replicas' | 'uptime';
  operator: OperatorType;
  value: string | number;
  label: string;
}

export interface PlannedAction {
  id: string;
  type: 'restart' | 'scale' | 'notify' | 'query' | 'stop' | 'rollback' | 'script';
  target: string;
  params: Record<string, any>;
  order: number;
  description: string;
}

export interface ParsedIntent {
  id: string;
  rawInput: string;
  intentType: 'batch_execute' | 'conditional_trigger' | 'single_action'
             | 'query' | 'scale' | 'rollback' | 'create_rule';
  confidence: number;
  conditions: OperationCondition[];
  actions: PlannedAction[];
  estimatedTargets?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresConfirmation: boolean;
  parsedAt: number;
  explanation: string;
}

export interface RuleCondition {
  id: string;
  metric: string;
  operator: OperatorType;
  value: number | string;
  duration?: number;
  label: string;
}

export interface ConditionGroup {
  id: string;
  logic: 'and' | 'or';
  conditions: RuleCondition[];
}

export type ActionType = 'restart' | 'scale' | 'notify' | 'query'
  | 'stop' | 'rollback' | 'script' | 'webhook';

export type NotifyChannel = 'email' | 'dingtalk' | 'slack' | 'webhook';

export interface RuleAction {
  id: string;
  type: ActionType;
  order: number;
  config: Record<string, any>;
  channels?: NotifyChannel[];
  recipients?: string[];
  template?: string;
  description: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  evaluationInterval: number;
  cooldownPeriod: number;
  trigger: {
    logic: 'and' | 'or';
    groups: ConditionGroup[];
  };
  actions: RuleAction[];
  requireConfirmation: boolean;
  maxExecutionsPerHour: number;
  lastTriggeredAt?: number;
  totalTriggers: number;
  lastExecutionStatus?: 'success' | 'failed' | 'partial' | 'pending';
  createdAt: number;
  updatedAt: number;
}

export interface ExecutionStepResult {
  actionId: string;
  target: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';
  output?: string;
  error?: string;
  duration?: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
}

export interface ExecutionRecord {
  id: string;
  ruleId?: string;
  intentId?: string;
  type: 'intent_execution' | 'rule_trigger' | 'manual';
  status: 'running' | 'completed' | 'failed' | 'partial' | 'cancelled';
  name: string;
  description: string;
  conditions: OperationCondition[];
  actions: RuleAction[];
  results: ExecutionStepResult[];
  totalTargets: number;
  successCount: number;
  failedCount: number;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  triggeredBy?: string;
}

export interface ReportBase {
  id: string;
  type: 'daily' | 'weekly' | 'incident' | 'sla';
  title: string;
  period: string;
  generatedAt: number;
  status: 'generating' | 'ready' | 'exported';
}

export interface MetricSnapshot {
  name: string;
  value: number;
  unit: string;
  trend: '+' | '-' | '=';
  trendValue: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface AnomalyEvent {
  id: string;
  time: string;
  service: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  status: 'resolved' | 'processing' | 'pending';
  resolvedBy?: string;
  resolutionTime?: number;
}

export interface DailyReport extends ReportBase {
  type: 'daily' | 'weekly';
  summary: {
    availability: number;
    availabilityTrend: '+' | '-' | '=';
    anomalyCount: number;
    resolvedCount: number;
    resolutionRate: number;
    avgResponseTime: number;
    totalEvents: number;
    mttr: number;
  };
  metrics: MetricSnapshot[];
  anomalies: AnomalyEvent[];
  aiInsights: string[];
  resourceHealth: { cpu: number; memory: number; disk: number; network: number };
  topServices: { name: string; errorRate: number; latency: number; requests: number }[];
  weekComparison?: {
    availability: number;
    anomalies: number;
    responseTime: number;
  };
}

export interface TimelineEvent {
  time: string;
  type: 'alert' | 'acknowledged' | 'response' | 'diagnosis' | 'fix' | 'recovery';
  title: string;
  description: string;
  operator?: string;
}

export interface ImprovementAction {
  id: string;
  priority: 'urgent' | 'short_term' | 'long_term';
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  status: 'open' | 'in_progress' | 'done';
}

export interface IncidentReport extends ReportBase {
  type: 'incident';
  incidentId: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  service: string;
  impactScope: string;
  startTime: number;
  endTime: number;
  duration: number;
  timeline: TimelineEvent[];
  rootCauseAnalysis: {
    directCause: string;
    indirectCause: string;
    rootCause: string;
  };
  improvementActions: ImprovementAction[];
  impactAssessment: {
    mttr: number;
    mttd: number;
    affectedUsers: number;
    estimatedLoss?: number;
    slaBreach: boolean;
  };
  relatedAlerts: string[];
  tags: string[];
}

export interface SlaServiceDetail {
  name: string;
  targetAvailability: number;
  actualAvailability: number;
  isMet: boolean;
  downtimeMinutes: number;
  incidents: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DowntimeEvent {
  date: string;
  service: string;
  duration: number;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  cause: string;
  planned: boolean;
}

export interface SlaReport extends ReportBase {
  type: 'sla';
  targetAvailability: number;
  actualAvailability: number;
  isMet: boolean;
  periodType: 'monthly' | 'quarterly' | 'yearly';
  services: SlaServiceDetail[];
  downtimeEvents: DowntimeEvent[];
  monthlyComparison: { month: string; availability: number }[];
  allowedDowntimeMinutes: number;
  actualDowntimeMinutes: number;
  breachAmount: number;
  slaTrend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}
