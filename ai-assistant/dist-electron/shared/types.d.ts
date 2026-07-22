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
