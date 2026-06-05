import React from 'react';
import { Send, ArrowRight, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sendRecruiterAgentMessage, type MentorChatMessage } from '../../services/v2MentorService';

interface RecruiterAssistantPageProps {
  t: (key: string, options?: any) => string;
  navigate: (path: string) => void;
}

interface RecruiterMessage extends MentorChatMessage {
  navigation_suggestion?: string;
  navigation_label?: string;
}

export const RecruiterAssistantPage: React.FC<RecruiterAssistantPageProps> = ({ t, navigate }) => {
  const storageKey = 'shami_recruiter_chat';
  const [messages, setMessages] = React.useState<RecruiterMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load chat history', e);
    }
    return [
      {
        role: 'assistant',
        content: t('rebuild.recruiter.assistant_desc', {
          defaultValue: 'Ahoj, jsem Shami. Pomohu ti zorientovat se v náboru, najít aktivní pozice nebo projít vhodné kandidáty v talent poolu. S čím chceš začít?',
        }),
      },
    ];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat history', e);
    }
  }, [messages]);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const handleNewChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: t('rebuild.recruiter.assistant_desc', {
          defaultValue: 'Ahoj, jsem Shami. Pomohu ti zorientovat se v náboru, najít aktivní pozice nebo projít vhodné kandidáty v talent poolu. S čím chceš začít?',
        }),
      },
    ]);
    setDraft('');
    setError('');
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to clear chat history', e);
    }
  };

  const suggestions = [
    { label: t('rebuild.recruiter.assistant_suggested_roles', { defaultValue: 'Najdi mé aktivní IT pozice' }), query: 'Ukaž mi moje aktivní pozice a výzvy.' },
    { label: t('rebuild.recruiter.assistant_suggested_candidates', { defaultValue: 'Ukaž kandidáty v talent poolu' }), query: 'Jaké kandidáty máme v talent poolu?' },
    { label: t('rebuild.recruiter.assistant_suggested_help', { defaultValue: 'Jak mi můžeš pomoci s navigací?' }), query: 'Jak mi můžeš pomoci s navigací a jaké sekce tu máme?' },
  ];

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const submitMessage = React.useCallback(async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || busy) return;

    const nextMessages: RecruiterMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setBusy(true);

    try {
      const reply = await sendRecruiterAgentMessage(
        message,
        nextMessages.map(({ role, content }) => ({ role, content }))
      );

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: reply.reply,
          navigation_suggestion: reply.navigation_suggestion,
          navigation_label: reply.navigation_label,
        },
      ]);
    } catch (chatError) {
      setError(
        chatError instanceof Error
          ? chatError.message
          : t('rebuild.dashboard.mentor_error', { defaultValue: 'Shami teď neodpověděl.' })
      );
    } finally {
      setBusy(false);
    }
  }, [busy, messages, t]);

  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return <div key={index} className="h-2" />;
      
      // Handle simple list rendering
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return (
          <li key={index} className="ml-4 list-disc text-sm leading-relaxed text-slate-700 dark:text-slate-200 my-1">
            {trimmed.substring(1).trim()}
          </li>
        );
      }
      
      return (
        <p key={index} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 mb-2.5">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[450px] flex-col overflow-hidden rounded-[24px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-soft">
      {/* Header section with cute Shami */}
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--dashboard-soft-border)] bg-white/60 dark:bg-slate-900/60 px-5 py-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <img
            src="/shami.png"
            alt="Shami"
            className="h-20 w-20 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white p-1 object-contain shadow-sm shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Shami AI</h3>
              <span className="inline-flex items-center rounded-full bg-teal-50 dark:bg-teal-950 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                Agent
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {t('rebuild.recruiter.assistant_subtitle', { defaultValue: 'Váš náborový a asistenční průvodce Shami' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={busy}
            title="Spustit nový chat"
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 transition disabled:opacity-50"
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">Nový chat</span>
          </button>
          <div className="hidden rounded-lg bg-teal-50/60 dark:bg-teal-950/40 px-3 py-1.5 sm:flex">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              <Sparkles size={11} />
              <span>Foundry Powered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
              {!isUser && (
                <img
                  src="/shami.png"
                  alt="Shami"
                  className="h-12 w-12 rounded-full border border-slate-100 bg-white object-contain shadow-sm mt-0.5"
                />
              )}
              <div className="flex flex-col">
                <div
                  className={`rounded-[20px] px-4.5 py-3 shadow-sm ${
                    isUser
                      ? 'bg-teal-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700/50 rounded-tl-none'
                  }`}
                  style={isUser ? { color: '#ffffff' } : {}}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed font-medium break-words text-white">{msg.content}</p>
                  ) : (
                    <div className="break-words space-y-1.5">{formatText(msg.content)}</div>
                  )}

                  {/* Dynamic Action Button */}
                  {!isUser && msg.navigation_suggestion && msg.navigation_label && (
                    <div className="mt-4 border-t border-slate-100 dark:border-slate-700/50 pt-3">
                      <button
                        type="button"
                        onClick={() => navigate(msg.navigation_suggestion!)}
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-teal-500/20 transition hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <span>{msg.navigation_label}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex gap-3 max-w-[80%] mr-auto">
            <img
              src="/shami.png"
              alt="Shami"
              className="h-12 w-12 rounded-full border border-slate-100 bg-white object-contain shadow-sm mt-0.5 shrink-0"
            />
            <div className="rounded-[20px] rounded-tl-none border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 px-4.5 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <div className="flex space-x-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" style={{ animationDelay: '150ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" style={{ animationDelay: '300ms' }} />
                </div>
                <span>{t('rebuild.dashboard.ai_thinking', { defaultValue: 'Shami formuluje odpověď...' })}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-800 shadow-sm">
            <ShieldAlert size={16} className="text-rose-600 shrink-0" />
            <p className="leading-5">{error}</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested prompts / quick-actions */}
      {messages.length === 1 && !busy && (
        <div className="border-t border-[color:var(--dashboard-soft-border)] bg-white/30 dark:bg-slate-900/30 px-5 py-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            {t('rebuild.recruiter.assistant_quick_actions', { defaultValue: 'Rychlé dotazy na Shamiho' })}
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => submitMessage(sug.query)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-[0.98]"
              >
                <MessageSquare size={13} className="text-teal-500 shrink-0" />
                <span>{sug.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[color:var(--dashboard-soft-border)] bg-white/60 dark:bg-slate-900/60 px-5 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitMessage(draft);
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            placeholder={t('rebuild.recruiter.assistant_placeholder', {
              defaultValue: 'Zeptejte se Shamiho na pozici, kandidáta nebo na pomoc s navigací...',
            })}
            className="flex-1 rounded-full border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 px-5 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-inner outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-white shadow-md shadow-teal-600/25 hover:bg-teal-700 hover:scale-[1.05] active:scale-[0.95] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:pointer-events-none transition"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
