import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  selectFiles: () => ipcRenderer.invoke('files:select'),
  runAnalysis: (payload: unknown) => ipcRenderer.invoke('analysis:run', payload),
  openFloatingWindow: () => ipcRenderer.invoke('floating:open'),
  closeFloatingWindow: () => ipcRenderer.invoke('floating:close'),
  showFloatingText: (payload: unknown) => ipcRenderer.invoke('floating:show-text', payload),
  getClipboardText: () => ipcRenderer.invoke('clipboard:get-text'),
  getDeepSeekConfig: () => ipcRenderer.invoke('deepseek:get-config'),
  saveDeepSeekConfig: (payload: unknown) => ipcRenderer.invoke('deepseek:save-config', payload),
  deepSeekAnalyze: (payload: unknown) => ipcRenderer.invoke('deepseek:analyze', payload),
  getChatHistory: () => ipcRenderer.invoke('chat-history:get'),
  saveChatHistory: (messages: unknown) => ipcRenderer.invoke('chat-history:save', messages),
  clearChatHistory: () => ipcRenderer.invoke('chat-history:clear'),
  deepSeekStream: (payload: { content: string; source: string }) => ipcRenderer.invoke('deepseek:stream', payload),
  onStreamChunk: (cb: (chunk: { done: boolean; chunk?: string; fullText?: string; error?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: { done: boolean; chunk?: string; fullText?: string; error?: string }) => cb(chunk);
    ipcRenderer.on('stream:chunk', handler);
    return () => ipcRenderer.removeListener('stream:chunk', handler);
  },
  captureSelection: () => ipcRenderer.invoke('selection:capture'),
  openSelectionToolbar: (payload: unknown) => ipcRenderer.invoke('selection-toolbar:open', payload),
  // 工具条专用
  onToolbarText: (cb: (text: string | { text: string; source: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string | { text: string; source: string }) => cb(text);
    ipcRenderer.on('toolbar:text', handler);
    return () => ipcRenderer.removeListener('toolbar:text', handler);
  },
  toolbar: {
    close: () => ipcRenderer.invoke('toolbar:close'),
  },
  web: {
    action: (payload: { mode: string; text: string }) => ipcRenderer.invoke('web-toolbar:action', payload),
  },
  onTranslationText: (cb: (payload: { text: string; source: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { text: string; source: string }) => cb(payload);
    ipcRenderer.on('translation:text', handler);
    return () => ipcRenderer.removeListener('translation:text', handler);
  },
  getTranslationText: () => ipcRenderer.invoke('translation:text:get'),
  getToolbarText: () => ipcRenderer.invoke('toolbar:text:get'),
  // 网页工具条专用
  onWebToolbarText: (cb: (payload: { text: string; source: string; x?: number; y?: number; width?: number; height?: number } | string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: { text: string; source: string; x?: number; y?: number; width?: number; height?: number } | string) => cb(text);
    ipcRenderer.on('web-toolbar:text', handler);
    return () => ipcRenderer.removeListener('web-toolbar:text', handler);
  },
  getWebToolbarText: () => ipcRenderer.invoke('web-toolbar:text:get'),
  // 悬浮窗文本接收（替代 DOM CustomEvent 桥接）
  onFloatingText: (cb: (payload: { text: string; source?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { text: string; source?: string }) => cb(payload);
    ipcRenderer.on('floating:text', handler);
    return () => ipcRenderer.removeListener('floating:text', handler);
  },
  toolbarAction: (payload: { mode: string; text: string }) => ipcRenderer.invoke('toolbar:action', payload),
  closeToolbar: () => ipcRenderer.invoke('toolbar:close'),
  resizeWindow: (width: number, height: number, offsetX?: number, offsetY?: number) =>
    ipcRenderer.invoke('window:resize', { width, height, offsetX, offsetY }),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  // 网页工具条专用 resize，避免误调整其他窗口
  resizeWebToolbar: (width: number, height: number, offsetX?: number, offsetY?: number) =>
    ipcRenderer.invoke('web-toolbar:resize', { width, height, offsetX, offsetY }),
  // 独立工具条（/?view=toolbar）专用 resize
  resizeToolbar: (width: number, height: number, offsetX?: number, offsetY?: number) =>
    ipcRenderer.invoke('toolbar:resize', { width, height, offsetX, offsetY }),
  // 工具条颜色设置
  getToolbarColors: () => ipcRenderer.invoke('toolbar:colors:get'),
  setToolbarColors: (colors: Record<string, string>) => ipcRenderer.invoke('toolbar:colors:set', colors),
  resetToolbarColors: () => ipcRenderer.invoke('toolbar:colors:reset'),
  onToolbarColorsChange: (cb: (colors: Record<string, string>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, colors: Record<string, string>) => cb(colors);
    ipcRenderer.on('toolbar:colors', handler);
    return () => ipcRenderer.removeListener('toolbar:colors', handler);
  },
  // 打开设置面板
  onOpenSettings: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('open-settings', handler);
    return () => ipcRenderer.removeListener('open-settings', handler);
  },
  openSettingsWindow: () => ipcRenderer.invoke('settings:open'),
});
