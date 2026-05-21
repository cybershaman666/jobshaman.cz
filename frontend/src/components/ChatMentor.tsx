import React from 'react';
import { Send, MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Mentor/Assistant chat komponenta pro kandidáty i recruitery.
 * Funguje jako wrapper podle role, chování obou je stejné - pouze inicializační text/y lze přizpůsobit.
 */
export interface ChatMentorProps {
  intro: string;
  sendMessageFn: (msg: string, context: any) => Promise<{ reply: string; navigation_suggestion?: string; navigation_label?: string; suggested_prompts?: string[] }>;
  storageKey: string;
  initialMessages?: { role: 'assistant' | 'user'; content: string }[];
  navigate?: (path: string) => void;
}


export const ChatMentor: React.FC<ChatMentorProps> = ({
  intro,
  sendMessageFn,
  storageKey,
  initialMessages,
  navigate,
}) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = React.useState<{ role: 'assistant' | 'user'; content: string; navigation_suggestion?: string; navigation_label?: string }[]>(() => {
    try {
       const saved = localStorage.getItem(storageKey);
       if (saved) {
         const loaded = JSON.parse(saved);
         // Zajistit správné typy: jen "assistant" | "user"
         if (Array.isArray(loaded)) {
           return loaded
             .map((msg) => ({
               ...msg,
               role: msg.role === 'assistant' ? 'assistant' : msg.role === 'user' ? 'user' : 'assistant',
             }))
             .filter((msg) => msg && (msg.role === 'assistant' || msg.role === 'user'));
         } else {
           // Pokud poškozený state – smaž a vrať initial
           localStorage.removeItem(storageKey);
           console.warn('Smazán poškozený chat state v localStorage:', loaded);
         }
       }
     } catch (e) {
       // pokud selže načtení, smažeme (zabráníme spadnutí celého chatu)
       localStorage.removeItem(storageKey);
       console.warn('Chyba při čtení chat state z localStorage, reset:', e);
     }
    if (initialMessages && initialMessages.length)
      return initialMessages;
    return [{
      role: 'assistant',
      content: intro,
    }];
  });

  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {}
  }, [messages, storageKey]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const handleNewChat = () => {
    setMessages([{
      role: 'assistant' as const,
      content: intro,
    }]);
    setDraft('');
    setError('');
    try {
      localStorage.removeItem(storageKey);
    } catch (e) { }
  };

  const submitMessage = React.useCallback(async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || busy) return;
    const nextMessages: { role: 'assistant' | 'user'; content: string; navigation_suggestion?: string; navigation_label?: string }[] = [...messages, { role: 'user' as const, content: message }];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const reply = await sendMessageFn(
        message,
        nextMessages.map(({ role, content }) => ({ role, content }))
      );
      setMessages((current) => [
        ...current,
        {
          role: 'assistant' as const,
          content: reply.reply,
          navigation_suggestion: reply.navigation_suggestion,
          navigation_label: reply.navigation_label,
        },
      ]);
    } catch (chatError: any) {
      setError(
        chatError instanceof Error
          ? chatError.message
          : t('rebuild.dashboard.mentor_error', { defaultValue: 'Shami teď neodpověděl.' })
      );
    } finally {
      setBusy(false);
    }
  }, [messages, busy, sendMessageFn, t]);

  // Format obsah s odrážkami atd.
  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return <div key={index} className="h-2" />;
      // seznam
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return (
          <li key={index} className="ml-4 list-disc text-sm leading-relaxed text-slate-700 dark:text-slate-200 my-1">{trimmed.substring(1).trim()}</li>
        );
      }
      return <div key={index} className="mb-2">{trimmed}</div>;
    });
  };

  return (
    <div
      className="flex flex-col w-full h-full min-h-0 min-w-0"
      style={{ background: "none" }}
    >
      {/* Branding a hlavička */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 px-0 md:px-3 pb-2 mb-2">
        <img
          src="/shami-tip.png"
          alt={t('chatMentor.avatarAlt', 'Shami avatar')}
          className="max-w-[110px] w-auto h-auto rounded-full shrink-0"
          style={{ background: "transparent", border: "none", boxShadow: "none" }}
        />
        <div className="flex flex-col">
          <span className="font-black tracking-wider uppercase text-cyan-500 text-2xl">{t('chatMentor.shamiName', 'SHAMI')}</span>
          <span className="text-[11px] text-slate-400">{t('chatMentor.brandHint', 'Powered by JobShaman AI')}</span>
        </div>
        <div className="flex-1 flex flex-col ml-3 min-w-0">
          <span className="text-lg md:text-xl font-semibold text-slate-800 dark:text-white leading-snug truncate">{t('chatMentor.welcomeTitle', 'Shami AI – Tvůj kariérní průvodce')}</span>
          <span className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 leading-snug truncate">{t('chatMentor.slogan', 'Shami vidí souvislosti v profilu, najde další krok – bez HR omáčky.')}</span>
        </div>
      </div>

      {/* Chat konverzace */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ minHeight: 0, minWidth: 0 }}
      >
        <div
          className="flex-1 overflow-y-auto pt-2 custom-scrollbar"
          style={{
            minHeight: 0,
            minWidth: 0,
            WebkitOverflowScrolling: "touch"
          }}
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-start`}
            >
              {m.role === 'assistant' && (
                <img
                  src="/shami.png"
                  alt={t('chatMentor.avatarAlt', 'Shami avatar')}
                  className="w-10 h-10 mr-3 object-contain rounded-full"
                  style={{ background: "transparent", border: "none", boxShadow: "none" }}
                />
              )}
              <div
                className={`px-3 py-2 rounded-xl shadow ${
                  m.role === 'assistant'
                    ? 'bg-gradient-to-r from-cyan-50 to-white dark:from-slate-800 dark:to-slate-900 text-cyan-900 dark:text-cyan-100 border border-cyan-100 dark:border-slate-700'
                    : 'bg-cyan-500 text-white dark:bg-cyan-600'
                } max-w-[75vw] md:max-w-[60%] break-words`}
              >
                {formatText(m.content)}
                {Boolean(m.navigation_suggestion) && (
                  <div className="mt-2">
                    <button
                      className="text-xs font-bold underline"
                      onClick={() => navigate?.(m.navigation_suggestion!)}
                      disabled={!navigate}
                    >
                      {m.navigation_label || m.navigation_suggestion}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500">{error}</div>
      )}

      {/* Input chat box – vždy dole */}
      <form
        className="flex gap-2 mt-3 px-2 md:px-4 pb-3 md:pb-1 z-10"
        style={{
          position: "relative",
          background: "inherit"
        }}
        onSubmit={e => {
          e.preventDefault();
          submitMessage(draft);
        }}
      >
        <input
          type="text"
          className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('chatMentor.inputPlaceholder', "Zeptej se Shamiho nebo naťukej další krok...")}
          disabled={busy}
          autoFocus
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-md bg-cyan-500 text-white px-4 py-2 font-bold text-sm shadow-sm transition enabled:hover:bg-cyan-700 disabled:opacity-40 flex gap-2 items-center"
          title={t('rebuild.dashboard.mentor_send', { defaultValue: 'Odeslat' })}
        >
          <Send size={16} />
        </button>
        <button
          type="button"
          onClick={handleNewChat}
          disabled={busy}
          title={t('rebuild.dashboard.mentor_new', { defaultValue: 'Nový chat' })}
          className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 transition disabled:opacity-50"
        >
          <MessageSquare size={13} />
          <span className="hidden sm:inline">
            {t('rebuild.dashboard.mentor_new')}
          </span>
        </button>
      </form>
      <div className="flex items-center gap-2 px-5 pb-2 md:pb-3 shrink-0">
        <Sparkles size={14} className={busy ? "animate-spin text-cyan-400" : ""} />
        <span className="text-[11px] text-slate-600 dark:text-slate-400">{busy
          ? t('rebuild.dashboard.mentor_typing')
          : t('rebuild.dashboard.mentor_ready')
        }</span>
      </div>
      {/* Error message */}
      {error && (
        <div className="text-xs text-red-500 px-5 pb-2">{error}</div>
      )}
    </div>
  );
};
