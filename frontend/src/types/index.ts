export type ChatMode = 'casual' | 'normal' | 'thinking' | 'online';

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
  intermediateSteps?: IntermediateStep[];
  visualizations?: VisualizationData[];
  moduleData?: AnyModuleData | null;
}

export interface IntermediateStep {
  tool: string;
  tool_input: string;
  observation: string;
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
