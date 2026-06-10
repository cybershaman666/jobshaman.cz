import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { cn } from '../cn';
import { sendMentorChatMessage } from '../../services/v2MentorService';
import { useRebuildTheme } from '../ui/rebuildTheme';

interface ShamiFloatingChatProps {
  isOpen: boolean;
  onClose: () => void;
  storageKey?: string;
  navigate?: (path: string) => void;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  navigation_suggestion?: string;
  navigation_label?: string;
}

export const ShamiFloatingChat: React.FC<ShamiFloatingChatProps> = ({
  isOpen,
  onClose,
  storageKey = 'shami_floating_chat',
  navigate,
}) => {
  const { t } = useTranslation();
  const { resolvedMode } = useRebuildTheme();
  const isDark = resolvedMode === 'dark';

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        role: 'assistant' as const,
        content: t('rebuild.chat.shami_intro', {
          defaultValue: 'Ahoj 👋 jsem Shami, tvůj kariérní průvodce. Můžeš se mě zeptat na cokoliv ohledně práce, kariéry nebo ti pomohu s orientací v aplikaci.',
        }),
      },
    ];
  });

  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Persist messages
  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleNewChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: t('rebuild.chat.shami_intro', {
          defaultValue: 'Ahoj 👋 jsem Shami, tvůj kariérní průvodce. Můžeš se mě zeptat na cokoliv ohledně práce, kariéry nebo ti pomohu s orientací v aplikaci.',
        }),
      },
    ]);
    setDraft('');
    setError('');
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  const submitMessage = React.useCallback(async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || busy) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setBusy(true);

    try {
      const reply = await sendMentorChatMessage(
        message,
        nextMessages.map(({ role, content }) => ({ role, content })),
      );

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: reply.reply,
          navigation_suggestion: reply.next_step,
          navigation_label: reply.next_step,
        },
      ]);
    } catch (chatError) {
      setError(
        chatError instanceof Error
          ? chatError.message
          : t('rebuild.dashboard.mentor_error', { defaultValue: 'Shami teď neodpověděl.' }),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, messages, t]);

  const formatText = (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return <div className="text-slate-400 italic text-xs">[Prázdná odpověď]</div>;
    }
    return trimmed.split('\n').map((paragraph, index) => {
      const para = paragraph.trim();
      if (!para) return <div key={index} className="h-2" />;
      if (para.startsWith('-') || para.startsWith('*')) {
        return (
          <li key={index} className="ml-3 list-disc text-sm leading-relaxed text-slate-700 dark:text-slate-200 my-1">
            {para.substring(1).trim()}
          </li>
        );
      }
      return (
        <p key={index} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 mb-1.5 last:mb-0">
          {para}
        </p>
      );
    });
  };

  // Quick suggestions shown when chat is fresh
  const showSuggestions = messages.length === 1 && !busy;
  const suggestions = [
    {
      label: t('rebuild.chat.suggestion_roles', { defaultValue: '🔍 Najdi mi práci' }),
    },
    {
      label: t('rebuild.chat.suggestion_profile', { defaultValue: '👤 Pomoz s profilem' }),
    },
    {
      label: t('rebuild.chat.suggestion_career', { defaultValue: '💡 Kariérní tipy' }),
    },
  ];

  // Don't render anything if not open (animated via CSS)
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Chat modal */}
      <div
        className={cn(
          'fixed bottom-24 right-5 z-50 flex w-[450px] max-w-[calc(100vw-2rem)] flex-col',
          'rounded-2xl border shadow-2xl animate-in slide-in-from-bottom-8 fade-in duration-300',
          isDark
            ? 'border-slate-700/60 bg-slate-900 shadow-black/40'
            : 'border-slate-200/80 bg-white shadow-[0_20px_68px_-24px_rgba(15,23,42,0.3)]',
        )}
        style={{
          maxHeight: 'min(600px, calc(100vh - 8rem))',
        }}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between rounded-t-2xl px-4 py-3.5',
          isDark ? 'border-b border-slate-800' : 'border-b border-slate-100',
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#12afcb] to-[#0f95ac] p-0.5 shadow-sm">
              <img
                src="/shami.png"
                alt="Shami"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'text-sm font-bold leading-tight',
                  isDark ? 'text-white' : 'text-slate-900',
                )}>
                  Shami
                </span>
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
                  isDark ? 'bg-[#12afcb]/20 text-[#68e4f6]' : 'bg-[#e8f8fb] text-[#087f95]',
                )}>
                  AI
                </span>
              </div>
              <span className={cn(
                'block truncate text-[10px] font-medium',
                isDark ? 'text-slate-400' : 'text-slate-400',
              )}>
                {t('rebuild.chat.subtitle', { defaultValue: 'Tvůj kariérní průvodce' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={busy}
              title={t('rebuild.chat.new_chat', { defaultValue: 'Nový chat' })}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition',
                isDark
                  ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              <MessageSquare size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition',
                isDark
                  ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar" style={{ minHeight: 0 }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-2`}
            >
              {msg.role === 'assistant' && (
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#12afcb] to-[#0f95ac] p-0.5 shadow-sm">
                  <img
                    src="/shami.png"
                    alt="Shami"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              <div
                className={cn(
                  'px-3.5 py-2.5 rounded-2xl max-w-[85%] break-words shadow-sm',
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-[#12afcb] to-[#0f95ac] text-white rounded-br-md'
                    : isDark
                      ? 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-md'
                      : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-bl-md',
                )}
              >
                {msg.role === 'assistant' ? formatText(msg.content) : (
                  <p className="text-sm leading-relaxed font-medium">{msg.content}</p>
                )}
                {msg.role === 'assistant' && msg.navigation_suggestion && (
                  <div className="mt-2.5 pt-2.5 border-t border-inherit opacity-60">
                    <button
                      type="button"
                      onClick={() => {
                        navigate?.(msg.navigation_suggestion!);
                        onClose();
                      }}
                      className="text-xs font-bold underline underline-offset-2 hover:no-underline transition"
                    >
                      {msg.navigation_label || msg.navigation_suggestion}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {busy && (
            <div className="flex justify-start items-start gap-2">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#12afcb] to-[#0f95ac] p-0.5 shadow-sm">
                <img
                  src="/shami.png"
                  alt="Shami"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className={cn(
                'px-4 py-3 rounded-2xl rounded-bl-md shadow-sm',
                isDark ? 'bg-slate-800 border border-slate-700/50' : 'bg-slate-50 border border-slate-100',
              )}>
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#12afcb]" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#12afcb]" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#12afcb]" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className={cn(
                    'text-xs font-medium',
                    isDark ? 'text-slate-400' : 'text-slate-500',
                  )}>
                    {t('rebuild.chat.typing', { defaultValue: 'Shami píše...' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick suggestions */}
        {showSuggestions && (
          <div className={cn(
            'px-4 py-3',
            isDark ? 'border-t border-slate-800' : 'border-t border-slate-100',
          )}>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => submitMessage(sug.label.replace(/^[^\s]+\s/, ''))}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97]',
                    isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                      : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm',
                  )}
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={cn(
            'px-4 py-2 text-xs text-red-500 font-medium',
            isDark ? 'border-t border-red-900/30 bg-red-950/20' : 'border-t border-red-100 bg-red-50/50',
          )}>
            {error}
          </div>
        )}

        {/* Input */}
        <div className={cn(
          'rounded-b-2xl px-4 py-3',
          isDark ? 'border-t border-slate-800' : 'border-t border-slate-100',
        )}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMessage(draft);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
              placeholder={t('rebuild.chat.placeholder', {
                defaultValue: 'Zeptej se Shamiho...',
              })}
              className={cn(
                'flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none transition',
                'placeholder:text-slate-400 disabled:opacity-50',
                isDark
                  ? 'border-slate-700 bg-slate-800 text-white focus:border-[#12afcb] focus:ring-1 focus:ring-[#12afcb]/40'
                  : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-[#12afcb] focus:ring-1 focus:ring-[#12afcb]/30',
              )}
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition',
                'shadow-sm disabled:cursor-not-allowed disabled:opacity-40',
                'bg-gradient-to-br from-[#12afcb] to-[#0f95ac] text-white',
                'hover:shadow-[0_4px_16px_rgba(18,175,203,0.4)] hover:scale-105 active:scale-95',
              )}
            >
              <Send size={16} />
            </button>
          </form>
          <div className="mt-1.5 flex items-center gap-1.5 px-1">
            <Sparkles size={10} className={cn(busy ? 'animate-spin' : '', busy ? 'text-[#12afcb]' : isDark ? 'text-slate-500' : 'text-slate-400')} />
            <span className={cn(
              'text-[10px] font-medium',
              isDark ? 'text-slate-500' : 'text-slate-400',
            )}>
              {busy
                ? t('rebuild.chat.status_thinking', { defaultValue: 'Shami přemýšlí...' })
                : t('rebuild.chat.status_ready', { defaultValue: 'Shami je připraven' })}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShamiFloatingChat;