/**
 * UI Automation Bridge for Windows (v4 — 稳定版)
 *
 * 通过持久化 PowerShell 子进程调用 .NET System.Windows.Automation。
 * 全局扫描所有窗口的文本选区（不依赖焦点）。
 */
export interface UiaSelection {
    text: string;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    source: string;
}
export declare class UiaBridge {
    private ps;
    private ready;
    private buffer;
    private queue;
    init(): Promise<boolean>;
    private send;
    private drain;
    poll(): Promise<{
        changed: boolean;
        selection: UiaSelection | null;
    }>;
    isAvailable(): boolean;
    dispose(): void;
}
export declare const uiaBridge: UiaBridge;
