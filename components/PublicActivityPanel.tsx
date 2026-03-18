import React, { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PublicActivityFeedPayload } from '../types';
import { fetchPublicActivityFeed } from '../services/publicActivityService';
import { MetricTile, SurfaceCard, cn } from './ui/primitives';

type PublicActivityPanelMode = 'homepage' | 'discovery';

interface PublicActivityPanelProps {
  mode?: PublicActivityPanelMode;
  className?: string;
  onPrimaryAction?: () => void;
  compact?: boolean;
}

const formatTimestamp = (value: string, locale: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  const diffMs = Date.now() - timestamp;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 24) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return rtf.format(-diffHours, 'hour');
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
};

const PublicActivityPanel: React.FC<PublicActivityPanelProps> = ({
  mode = 'homepage',
  className,
  onPrimaryAction,
  compact = false,
}) => {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const language = locale.toLowerCase().startsWith('de-at') ? 'at' : locale.split('-')[0].toLowerCase();
  const [payload, setPayload] = useState<PublicActivityFeedPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicActivityFeed(language, compact ? 3 : (mode === 'homepage' ? 5 : 4))
      .then((result) => {
        if (!cancelled) {
          setPayload(result && result.events.length > 0 ? result : null);
        }
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, [language, mode]);

  if (!payload || payload.events.length === 0) {
    return null;
  }

  const copy = (() => {
    if (language === 'cs') {
      return {
        eyebrow: 'Co se právě děje',
        title: mode === 'homepage' ? 'Platforma žije. Tohle se právě děje kolem výzev a spolupráce.' : 'Krátký přehled toho, co se právě děje na platformě.',
        body: mode === 'homepage'
          ? 'Ne lajky a komentáře, ale skutečné signály kolem výzev, odpovědí a dokončených mini spoluprací.'
          : 'Nové role, reakce a dokončené mini výzvy bez sociálního šumu.',
        browse: 'Projít výzvy',
        stats: {
          newChallenges: 'Nové výzvy dnes',
          candidateReplies: 'Reakce dnes',
          companyReplies: 'Odpovědi firem dnes',
          completedMini: 'Mini výzvy hotové za 7 dní',
        },
        liveFeed: 'Poslední veřejná aktivita',
      };
    }
    if (language === 'sk') {
      return {
        eyebrow: 'Čo sa práve deje',
        title: mode === 'homepage' ? 'Platforma žije. Toto sa práve deje okolo výziev a spolupráce.' : 'Krátky prehľad toho, čo sa práve deje na platforme.',
        body: mode === 'homepage'
          ? 'Nie lajky a komentáre, ale skutočné signály okolo výziev, odpovedí a dokončených mini spoluprác.'
          : 'Nové roly, reakcie a dokončené mini výzvy bez sociálneho šumu.',
        browse: 'Prejsť výzvy',
        stats: {
          newChallenges: 'Nové výzvy dnes',
          candidateReplies: 'Reakcie dnes',
          companyReplies: 'Odpovede firiem dnes',
          completedMini: 'Mini výzvy hotové za 7 dní',
        },
        liveFeed: 'Posledná verejná aktivita',
      };
    }
    if (language === 'de' || language === 'at') {
      return {
        eyebrow: 'Was gerade passiert',
        title: mode === 'homepage' ? 'Die Plattform lebt. Das passiert gerade rund um Rollen und Zusammenarbeit.' : 'Ein kurzer Überblick darüber, was gerade auf der Plattform passiert.',
        body: mode === 'homepage'
          ? 'Keine Likes und Kommentare, sondern echte Signale rund um Rollen, Antworten und abgeschlossene Mini-Zusammenarbeiten.'
          : 'Neue Rollen, Antworten und abgeschlossene Mini-Aufgaben ohne sozialen Lärm.',
        browse: 'Aufgaben ansehen',
        stats: {
          newChallenges: 'Neue Aufgaben heute',
          candidateReplies: 'Reaktionen heute',
          companyReplies: 'Antworten der Firmen heute',
          completedMini: 'Mini-Aufgaben in 7 Tagen erledigt',
        },
        liveFeed: 'Letzte öffentliche Aktivität',
      };
    }
    if (language === 'pl') {
      return {
        eyebrow: 'Co dzieje się teraz',
        title: mode === 'homepage' ? 'Platforma żyje. To właśnie dzieje się wokół wyzwań i współpracy.' : 'Krótki przegląd tego, co dzieje się teraz na platformie.',
        body: mode === 'homepage'
          ? 'Nie lajki i komentarze, ale realne sygnały wokół ról, odpowiedzi i zakończonych mini współprac.'
          : 'Nowe role, reakcje i ukończone mini wyzwania bez społecznego szumu.',
        browse: 'Przejdź do wyzwań',
        stats: {
          newChallenges: 'Nowe wyzwania dziś',
          candidateReplies: 'Reakcje dziś',
          companyReplies: 'Odpowiedzi firm dziś',
          completedMini: 'Mini wyzwania ukończone w 7 dni',
        },
        liveFeed: 'Ostatnia publiczna aktywność',
      };
    }
    return {
      eyebrow: 'What is happening now',
      title: mode === 'homepage' ? 'The platform is active. This is what is happening around real challenges.' : 'A quick pulse of what is happening on the platform.',
      body: mode === 'homepage'
        ? 'Not likes and comments, but real signals around openings, replies, and completed mini collaborations.'
        : 'New roles, replies, and completed mini challenges without social noise.',
      browse: 'Browse challenges',
      stats: {
        newChallenges: 'New challenges today',
        candidateReplies: 'Replies today',
        companyReplies: 'Company replies today',
        completedMini: 'Mini challenges completed in 7 days',
      },
      liveFeed: 'Latest public activity',
    };
  })();

  const stats = [
    { label: copy.stats.newChallenges, value: payload.stats.new_challenges_today, tone: 'accent' as const },
    { label: copy.stats.candidateReplies, value: payload.stats.candidate_replies_today, tone: 'default' as const },
    { label: copy.stats.companyReplies, value: payload.stats.company_replies_today, tone: 'default' as const },
    { label: copy.stats.completedMini, value: payload.stats.completed_mini_projects_7d, tone: 'success' as const },
  ];

  if (compact) {
    return (
      <SurfaceCard
        className={cn(
          'space-y-3 border-[rgba(var(--accent-rgb),0.18)] bg-white/80 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.36)] backdrop-blur dark:bg-[rgba(15,23,42,0.72)]',
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] dark:bg-white/5">
            <Sparkles size={14} />
            {copy.eyebrow}
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {payload.events.length}
          </div>
        </div>
        <div className="grid gap-2">
          {payload.events.map((event) => (
            <div
              key={event.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white/76 px-4 py-3 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text-strong)]">{event.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{event.body}</div>
                </div>
                <div className="shrink-0 text-xs font-medium text-[var(--text-faint)]">
                  {formatTimestamp(event.timestamp, locale)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      className={cn(
        'space-y-4 border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98)_50%,rgba(240,249,255,0.98))] shadow-[0_28px_70px_-54px_rgba(15,23,42,0.34)] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.96)_54%,rgba(8,47,73,0.84))]',
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] dark:bg-white/5">
            <Sparkles size={14} />
            {copy.eyebrow}
          </div>
          <div className="space-y-1.5">
            <h3 className={cn('max-w-3xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]', mode === 'homepage' ? 'text-2xl' : 'text-xl')}>
              {copy.title}
            </h3>
            <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{copy.body}</p>
          </div>
        </div>
        {mode === 'homepage' && onPrimaryAction ? (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(var(--accent-rgb),0.18)] bg-white/78 px-4 py-2.5 text-sm font-semibold text-[var(--text-strong)] transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
          >
            {copy.browse}
            <ArrowRight size={16} />
          </button>
        ) : null}
      </div>

      <div className={cn('grid gap-3', mode === 'homepage' ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-4')}>
        {stats.map((item) => (
          <MetricTile key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
          <RefreshCw size={13} />
          {copy.liveFeed}
        </div>
        <div className="grid gap-3">
          {payload.events.map((event) => (
            <div
              key={event.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white/76 px-4 py-3 dark:bg-white/5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{event.title}</div>
                  <div className="text-sm leading-6 text-[var(--text-muted)]">{event.body}</div>
                </div>
                <div className="shrink-0 text-xs font-medium text-[var(--text-faint)]">
                  {formatTimestamp(event.timestamp, locale)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
};

export default PublicActivityPanel;
