export type ChatMode = 'casual' | 'normal' | 'thinking' | 'online';

export interface AgentCapabilities {
  thinking: boolean;
  web_search: boolean;
  reflection: boolean;
  auto_retry: boolean;
  search_count?: number; // 搜索网页数量，默认10
}

export interface ThinkingOptions {
  autoExpand: boolean;
  showConfidence: boolean;
  maxSteps: number;
  detailLevel: 'simple' | 'normal' | 'detailed';
}

export type ThinkingStepType = 'thought' | 'tool_call' | 'tool_result';

export interface ThinkingEvent {
  type: 'thinking';
  subtype: ThinkingStepType;
  content: string;
  step: number;
  data?: {
    next_action?: string;
    action_input?: string;
    tool?: string;
    input?: string;
    success?: boolean;
    elapsed_ms?: number;
    result_size_bytes?: number;
    llm_elapsed_ms?: number;
    full_result_available?: boolean;
    has_interpretation?: boolean;
    raw_result?: string;
  };
  elapsed?: number;
}

export interface ToolCallEntry {
  step: number;
  tool: string;
  input: any;
  output: string;
  success: boolean;
  elapsedMs?: number;
}

import type { VisualizationData } from '../components/VisualComponents';
import type { AnyModuleData, UserProfile, LearningPath, PersonalizedRecommendation, TopologyData, HeatmapData, FaultImpactData, ConfigIssue, ConfigReviewResult, SqlIssue, SqlOptimizationResult, SecurityFinding, SecurityScanResult, OperatorType, OperationCondition, PlannedAction, ParsedIntent, RuleCondition, ConditionGroup, ActionType, NotifyChannel, RuleAction, AutomationRule, ExecutionStepResult, ExecutionRecord, ReportBase, MetricSnapshot, AnomalyEvent, DailyReport, TimelineEvent, ImprovementAction, IncidentReport, SlaServiceDetail, DowntimeEvent, SlaReport } from './moduleData';

export type { UserProfile, LearningPath, PersonalizedRecommendation, TopologyData, HeatmapData, FaultImpactData, ConfigIssue, ConfigReviewResult, SqlIssue, SqlOptimizationResult, SecurityFinding, SecurityScanResult, OperatorType, OperationCondition, PlannedAction, ParsedIntent, RuleCondition, ConditionGroup, ActionType, NotifyChannel, RuleAction, AutomationRule, ExecutionStepResult, ExecutionRecord, ReportBase, MetricSnapshot, AnomalyEvent, DailyReport, TimelineEvent, ImprovementAction, IncidentReport, SlaServiceDetail, DowntimeEvent, SlaReport };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mode?: ChatMode;
  isStreaming?: boolean;
  thinkingContent?: string;
  thinkingSteps?: Record<number, {
    step: number;
    subtype: ThinkingStepType;
    content: string;
    data?: ThinkingEvent['data'];
    collapsed: boolean;
    elapsed?: number;
  }>;
  toolCalls?: ToolCallEntry[];
  intermediateSteps?: IntermediateStep[];
  visualizations?: VisualizationData[];
  moduleData?: AnyModuleData | null;
  operationData?: AIOperationData | null;
  searchResults?: {
    results: Array<{
      title: string;
      snippet: string;
      url: string;
      source: string;
    }>;
    engine?: string;
    answer?: string;
  } | null;
}

export interface AIOperationData {
  intent: string;
  operation_id: string;
  title: string;
  description: string;
  requires_confirmation: boolean;
  disk_usage?: {
    disk: string;
    total_gb: number;
    used_gb: number;
    free_gb: number;
    usage_percent: number;
  };
  cleanup_items?: {
    id: string;
    name: string;
    size: number;
    size_formatted: string;
    risk: 'low' | 'medium' | 'high';
    description: string;
    default_checked: boolean;
  }[];
  total_size_formatted?: string;
  risk_warning?: string;
  action?: string;
  service_name?: string;
  service_status?: {
    name: string;
    display_name: string;
    status: string;
    can_stop: boolean;
    exists: boolean;
  };
  impact_warning?: string;
  solutions?: {
    id: string;
    name: string;
    description: string;
    risk: string;
    estimated_time: string;
    confidence: number;
  }[];
}

export interface IntermediateStep {
  tool: string;
  tool_input: string;
  observation: string;
  type?: string;
  title?: string;
  content?: string;
  data?: any;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  mode: ChatMode;
  createdAt: number;
  updatedAt: number;
}

export interface FeatureModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}
