import type {
  ModuleDataWrapper,
  AnyModuleData,
  MonitoringModuleData,
  PredictionModuleData,
  DiagnosisModuleData,
  KnowledgeModuleData,
  AutomationModuleData,
} from '../types/moduleData';

export function adaptModuleData(wrapper?: ModuleDataWrapper | null): AnyModuleData | null {
  if (!wrapper) return null;

  const { type, data } = wrapper;

  switch (type) {
    case 'monitoring':
      return { type: 'monitoring', data } as MonitoringModuleData;
    case 'prediction':
      return { type: 'prediction', data } as PredictionModuleData;
    case 'diagnosis':
      return { type: 'diagnosis', data } as DiagnosisModuleData;
    case 'knowledge':
      return { type: 'knowledge', data } as KnowledgeModuleData;
    case 'automation':
      return { type: 'automation', data } as AutomationModuleData;
    default:
      return null;
  }
}

export function getModuleLabel(type: string): string {
  const labels: Record<string, string> = {
    monitoring: '智能监控',
    prediction: '智能预测',
    diagnosis: '故障诊断',
    knowledge: '知识库',
    automation: '自动修复',
  };
  return labels[type] || type;
}

export function getModuleColor(type: string): string {
  const colors: Record<string, string> = {
    monitoring: 'emerald',
    prediction: 'violet',
    diagnosis: 'rose',
    knowledge: 'indigo',
    automation: 'amber',
  };
  return colors[type] || 'gray';
}
