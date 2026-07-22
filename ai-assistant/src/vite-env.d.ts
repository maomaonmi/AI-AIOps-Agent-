/// <reference types="vite/client" />

declare global {
  interface Window {
    api?: {
      getVersion: () => Promise<string>;
      selectFiles: () => Promise<import('../shared/types').FileImportResult & { analysis: import('../shared/types').FileAnalysis | null }>;
      runAnalysis: (payload: import('../shared/types').AiAnalysisRequest) => Promise<import('../shared/types').AiAnalysisResult>;
      openFloatingWindow: () => Promise<void>;
      closeFloatingWindow: () => Promise<void>;
      showFloatingText: (payload: import('../shared/types').FloatingTextPayload) => Promise<void>;
      getClipboardText: () => Promise<string>;
      getDeepSeekConfig: () => Promise<import('../shared/types').DeepSeekConfig>;
      saveDeepSeekConfig: (payload: import('../shared/types').DeepSeekConfig) => Promise<import('../shared/types').DeepSeekConfig>;
      deepSeekAnalyze: (payload: { content: string; source: string }) => Promise<{ ok: boolean; text?: string; error?: string }>;
      getChatHistory: () => Promise<Array<{ role: 'ai' | 'user'; content: string; timestamp?: number }>>;
      saveChatHistory: (messages: Array<{ role: 'ai' | 'user'; content: string; timestamp?: number }>) => Promise<void>;
      clearChatHistory: () => Promise<Array<{ role: 'ai' | 'user'; content: string; timestamp?: number }>>;
      deepSeekStream: (payload: { content: string; source: string }) => Promise<void>;
      onStreamChunk: (cb: (chunk: { done: boolean; chunk?: string; fullText?: string; error?: string }) => void) => (() => void) | undefined;
      captureSelection: () => Promise<{ text: string; source: string }>;
      openSelectionToolbar: (payload: { text: string; source: string; x?: number; y?: number }) => Promise<void>;
      onToolbarText: (cb: (text: string | { text: string; source: string }) => void) => (() => void) | undefined;
      getToolbarText: () => Promise<string>;
      toolbar: { close: () => Promise<void> };
      web: { action: (payload: { mode: string; text: string }) => Promise<void> };
      onTranslationText: (cb: (payload: { text: string; source: string }) => void) => (() => void) | undefined;
      getTranslationText: () => Promise<{ text: string; source: string }>;
      onWebToolbarText: (cb: (payload: { text: string; source: string; x?: number; y?: number; width?: number; height?: number } | string) => void) => (() => void) | undefined;
      getWebToolbarText: () => Promise<{ text: string; x: number; y: number; width: number; height: number } | string>;
      onFloatingText: (cb: (payload: import('../shared/types').FloatingTextPayload) => void) => (() => void) | undefined;
      toolbarAction: (payload: { mode: string; text: string }) => Promise<void>;
      closeToolbar: () => Promise<void>;
      resizeWindow: (width: number, height: number, offsetX?: number, offsetY?: number) => Promise<void>;
      closeWindow: () => Promise<void>;
      minimizeWindow: () => Promise<void>;
      resizeWebToolbar: (width: number, height: number, offsetX?: number, offsetY?: number) => Promise<void>;
      resizeToolbar: (width: number, height: number, offsetX?: number, offsetY?: number) => Promise<void>;
      getToolbarColors: () => Promise<Record<string, string>>;
      setToolbarColors: (colors: Record<string, string>) => Promise<Record<string, string>>;
      resetToolbarColors: () => Promise<Record<string, string>>;
      onToolbarColorsChange: (cb: (colors: Record<string, string>) => void) => (() => void) | undefined;
      onOpenSettings: (cb: () => void) => (() => void) | undefined;
      openSettingsWindow: () => Promise<void>;
    };
  }
}

export {};
