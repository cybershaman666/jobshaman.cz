import React from "react";
import { useTranslation } from 'react-i18next';

export interface ChatThread {
  id: string;
  title: string;
  lastMessageSnippet?: string;
}

interface CandidateChatSidebarProps {
  userId?: string;
  selectedChatId?: string | null;
  onSelectChat?: (id: string) => void;
}

export const CandidateChatSidebar: React.FC<CandidateChatSidebarProps> = ({
  userId,
  selectedChatId,
  onSelectChat
}) => {
  const { t } = useTranslation();
  const chats: ChatThread[] = [
    {
      id: "1",
      title: t('rebuild.chat_sidebar.shami_title', { defaultValue: 'Shami AI – Career guide' }),
      lastMessageSnippet: t('rebuild.chat_sidebar.shami_snippet', { defaultValue: 'Ask me about work or skills!' }),
    },
    {
      id: "2",
      title: t('rebuild.chat_sidebar.tips_title', { defaultValue: 'Shami Tips & next steps' }),
      lastMessageSnippet: t('rebuild.chat_sidebar.tips_snippet', { defaultValue: 'I prepared a growth plan for you.' }),
    },
    {
      id: "3",
      title: t('rebuild.chat_sidebar.history_title', { defaultValue: 'Earlier conversation' }),
      lastMessageSnippet: t('rebuild.chat_sidebar.history_snippet', { defaultValue: 'Ask about additional career possibilities.' }),
    },
  ];

  return (
    <aside className="h-full w-full max-w-xs p-4 pr-2 flex flex-col">
      <div className="mb-3 text-xs font-bold text-gray-500 tracking-wide uppercase">Seznam chatů</div>
      <div className="flex-1 overflow-y-auto">
        {chats.map(chat => (
          <button
            key={chat.id}
            className={`w-full flex flex-col items-start p-3 mb-2 rounded-lg border border-transparent text-left transition 
              ${selectedChatId === chat.id 
                ? "bg-blue-50 border-blue-400 font-bold text-blue-900 shadow"
                : "hover:bg-blue-50 text-gray-700"}`}
            onClick={() => onSelectChat?.(chat.id)}
            style={{ outline: "none" }}
          >
            <span className="truncate max-w-full">{chat.title}</span>
            {chat.lastMessageSnippet && (
              <span className="mt-0.5 text-xs text-gray-500 truncate max-w-full">{chat.lastMessageSnippet}</span>
            )}
          </button>
        ))}
        <div className="pt-2 text-xs text-gray-400">Poznámka: Podpora více chatů je ve vývoji.</div>
      </div>
    </aside>
  );
};

export default CandidateChatSidebar;