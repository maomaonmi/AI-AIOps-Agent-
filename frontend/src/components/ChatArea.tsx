import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import MessageBubble from './MessageBubble';
import WelcomePage from './WelcomePage';
import {
  Menu,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

export default function ChatArea() {
  const {
    activeConversationId,
    conversations,
    editAndResend,
    setSidebarOpen,
  } = useAppStore();

  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeConversationId || messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        {isMobile && (
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <WelcomePage
            onFeatureClick={(feature) => {
              useAppStore.getState().setActiveFeature(feature);
              useAppStore.getState().setActiveModuleType(null);
            }}
            onRecommendationClick={(rec) => {
              useAppStore.getState().setActiveFeature(null);
              useAppStore.getState().setActiveModuleType(null);
              const input = document.querySelector('textarea');
              if (input) {
                input.focus();
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex items-start justify-center">
      {isMobile && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="font-medium text-sm text-gray-800 truncate">
            {activeConversation?.title}
          </span>
        </div>
      )}
      <div className="max-w-[780px] w-full px-6 lg:px-8 xl:px-12 py-6 space-y-4">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
            onEdit={(messageId, newContent) =>
              editAndResend(activeConversationId!, messageId, newContent)
            }
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}