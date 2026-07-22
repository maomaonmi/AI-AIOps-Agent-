export type AppRoute = 'dashboard' | 'settings' | 'popup';

export interface FileSummary {
  name: string;
  size: number;
  type: string;
  updatedAt?: string;
  path?: string;
  preview?: string;
  fullTextAvailable?: boolean;
  format?: 'text' | 'docx' | 'pdf' | 'pptx' | 'other';
}

export interface FileImportResult {
  files: FileSummary[];
  selected: FileSummary;
}

export interface FileAnalysis {
  summary: string;
  risks: string[];
  suggestions: string[];
  highlights: string[];
  actions?: string[];
}

export interface AiAnalysisRequest {
  file: FileSummary;
  analysis: FileAnalysis;
}

export interface AiAnalysisResult {
  summary: string;
  risks: string[];
  suggestions: string[];
  highlights: string[];
  actions: string[];
}

export interface FloatingTextPayload {
  text: string;
  source?: string;
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// 图片相关类型
export interface ImagePayload {
  base64: string;      // Base64 编码的图片数据（不含 data:image/xxx;base64, 前缀）
  mimeType: string;    // image/png, image/jpeg, image/webp
  width?: number;
  height?: number;
  sizeKB?: number;
}

export interface ImageAnalysisResult {
  ok: boolean;
  text?: string;       // AI 分析结果
  error?: string;      // 错误信息
}
