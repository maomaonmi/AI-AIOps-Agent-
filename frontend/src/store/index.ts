import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message, ChatMode, UserProfile, LearningPath } from '../types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface RequestState {
  isPending: boolean;
  abortController: AbortController | null;
}

interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  sidebarOpen: boolean;
  currentMode: ChatMode;
  activeFeature: string | null;
  activeModuleType: string | null;
  floatingPanelType: string | null;
  quickActionType: string | null;
  panelWidth: number;
  requestState: RequestState;
  userProfile: UserProfile;
  learningPaths: LearningPath[];
  learningMode: boolean;
  llmMode: 'local' | 'cloud';

  setActiveConversation: (id: string | null) => void;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  editAndResend: (conversationId: string, messageId: string, newContent: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentMode: (mode: ChatMode) => void;
  setActiveFeature: (feature: string | null) => void;
  setActiveModuleType: (moduleType: string | null) => void;
  setFloatingPanel: (panelType: string | null) => void;
  setQuickAction: (actionType: string | null) => void;
  setPanelWidth: (width: number) => void;
  getActiveConversation: () => Conversation | undefined;
  startRequest: () => AbortController;
  endRequest: () => void;
  cancelRequest: () => void;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  setLearningMode: (enabled: boolean) => void;
  setLlmMode: (mode: 'local' | 'cloud') => void;
  updateLearningProgress: (pathId: string, progress: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      sidebarOpen: true,
      currentMode: 'casual',
      activeFeature: null,
      activeModuleType: null,
      floatingPanelType: null,
      quickActionType: null,
      panelWidth: 480,
      requestState: {
        isPending: false,
        abortController: null,
      },
      userProfile: {
        name: '运维工程师',
        role: 'senior',
        level: 7,
        totalIncidents: 128,
        preferredModules: ['diagnosis', 'monitoring', 'knowledge'],
        skillTags: ['CPU排查', '数据库优化', '网络诊断'],
        learningProgress: {
          completedPaths: 5,
          totalPaths: 12,
        },
        permissions: {
          level: 'operator',
          canRestart: true,
          canScale: true,
          canConfig: false,
          canDeploy: false,
        },
      },
      learningPaths: [
        {
          id: 'lp-1',
          title: 'CPU 排查思路',
          mentor: '张工',
          topic: '性能排查',
          steps: 4,
          completed: false,
          progress: 0.6,
        },
        {
          id: 'lp-2',
          title: '数据库连接池优化',
          mentor: '李工',
          topic: '数据库',
          steps: 5,
          completed: true,
          progress: 1,
        },
        {
          id: 'lp-3',
          title: '网络延迟诊断',
          mentor: '王工',
          topic: '网络',
          steps: 6,
          completed: false,
          progress: 0.3,
        },
      ],
      learningMode: false,
      llmMode: 'local',

      setActiveConversation: (id) => set({ activeConversationId: id }),

      createConversation: () => {
        const id = generateId();
        const conversation: Conversation = {
          id,
          title: '新对话',
          messages: [],
          mode: get().currentMode,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id) =>
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          return {
            conversations: filtered,
            activeConversationId:
              state.activeConversationId === id
                ? filtered[0]?.id ?? null
                : state.activeConversationId,
          };
        }),

      renameConversation: (id, title) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        })),

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const updatedMessages = [...c.messages, message];
            const title =
              c.messages.length === 0 && message.role === 'user'
                ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
                : c.title;
            return {
              ...c,
              messages: updatedMessages,
              title,
              updatedAt: Date.now(),
            };
          }),
        })),

      updateMessage: (conversationId, messageId, updates) =>
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
              updatedAt: Date.now(),
            };
          }),
        })),

      editAndResend: (conversationId, messageId, newContent) =>
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const msgIndex = c.messages.findIndex((m) => m.id === messageId);
            if (msgIndex === -1) return c;
            const updatedMessages = c.messages
              .slice(0, msgIndex)
              .map((m, i) =>
                i === msgIndex - 1 && m.role === 'assistant'
                  ? { ...m, content: '' }
                  : m
              );
            const userMsg: Message = {
              id: generateId(),
              role: 'user',
              content: newContent,
              timestamp: Date.now(),
              mode: c.mode,
            };
            updatedMessages.push(userMsg);
            return { ...c, messages: updatedMessages, updatedAt: Date.now() };
          }),
        })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setCurrentMode: (mode) => set({ currentMode: mode }),

      setActiveFeature: (feature) => set({ activeFeature: feature }),

      setActiveModuleType: (moduleType) => set({ activeModuleType: moduleType }),

      setFloatingPanel: (panelType) => set({ floatingPanelType: panelType }),

      setQuickAction: (actionType) => set({ quickActionType: actionType }),

      setPanelWidth: (width) => set({ panelWidth: Math.min(800, Math.max(320, width)) }),

      getActiveConversation: () => {
        const state = get();
        return state.conversations.find((c) => c.id === state.activeConversationId);
      },

      startRequest: () => {
        const controller = new AbortController();
        set({
          requestState: {
            isPending: true,
            abortController: controller,
          },
        });
        return controller;
      },

      endRequest: () => {
        set({
          requestState: {
            isPending: false,
            abortController: null,
          },
        });
      },

      cancelRequest: () => {
        const { requestState } = get();
        if (requestState.abortController) {
          requestState.abortController.abort();
        }
        set({
          requestState: {
            isPending: false,
            abortController: null,
          },
        });
      },

      setUserProfile: (profile) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...profile },
        })),

      setLearningMode: (enabled) => set({ learningMode: enabled }),
      setLlmMode: (mode) => set({ llmMode: mode }),

      updateLearningProgress: (pathId, progress) =>
        set((state) => ({
          learningPaths: state.learningPaths.map((p) =>
            p.id === pathId ? { ...p, progress, completed: progress >= 1 } : p
          ),
        })),
    }),
    {
      name: 'aiops-agent-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        currentMode: state.currentMode,
        activeModuleType: state.activeModuleType,
      }),
    }
  )
);
