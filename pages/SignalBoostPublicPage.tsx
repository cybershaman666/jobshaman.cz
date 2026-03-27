import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, Linkedin, Loader2, Sparkles } from 'lucide-react';

import { BACKEND_URL } from '../constants';
import type { JobSignalBoostOutput } from '../types';
import { fetchPublicSignalBoostOutput, recordSignalBoostEvent } from '../services/jobSignalBoostService';
import { getLocaleFromPathname, getPathPartsWithoutLocale } from '../utils/appRouting';

const normalizeLocale = (value: string | null | undefined): 'cs' | 'sk' | 'de' | 'pl' | 'en' => {
  const base = String(value || 'en').split('-')[0].toLowerCase();
  if (base === 'at') return 'de';
  return ['cs', 'sk', 'de', 'pl', 'en'].includes(base) ? (base as 'cs' | 'sk' | 'de' | 'pl' | 'en') : 'en';
};

const pageCopy = {
  cs: {
    loading: 'Načítám veřejný Signal Boost…',
    missingTitle: 'Tento Signal Boost už není dostupný',
    missingBody: 'Odkaz mohl vypršet, být archivovaný nebo nikdy nevznikl.',
    createdVia: 'Vytvořeno přes JobShaman',
    reflectionNote: 'Krátké poznámky k vaší roli',
    candidateFallback: 'Kandidát JobShamanu',
    roleFallback: 'Vaše role',
    signalTitle: 'Z toho, jak nad tím přemýšlí:',
    ctaTitle: 'Pokud vám to sedí',
    ctaBody: 'Rád to projdu nad konkrétním projektem nebo situací z vašeho týmu.',
    openLinkedin: 'LinkedIn profil',
    openOriginal: 'Původní nabídka',
    backHome: 'Zpět na JobShaman',
  },
  sk: {
    loading: 'Načítavam verejný Signal Boost…',
    missingTitle: 'Tento Signal Boost už nie je dostupný',
    missingBody: 'Link mohol expirovať, byť archivovaný alebo nikdy nevznikol.',
    createdVia: 'Vytvorené cez JobShaman',
    reflectionNote: 'Krátke poznámky k vašej role',
    candidateFallback: 'Kandidát JobShamanu',
    roleFallback: 'Vaša rola',
    signalTitle: 'Z toho, ako nad tým premýšľa:',
    ctaTitle: 'Ak vám to sedí',
    ctaBody: 'Rád to prejdem nad konkrétnym projektom alebo situáciou z vášho tímu.',
    openLinkedin: 'LinkedIn profil',
    openOriginal: 'Pôvodná ponuka',
    backHome: 'Späť na JobShaman',
  },
  de: {
    loading: 'Öffentlicher Signal Boost wird geladen…',
    missingTitle: 'Dieser Signal Boost ist nicht mehr verfügbar',
    missingBody: 'Der Link könnte abgelaufen, archiviert oder nie veröffentlicht worden sein.',
    createdVia: 'Erstellt mit JobShaman',
    reflectionNote: 'Kurze Notizen zu Ihrer Rolle',
    candidateFallback: 'JobShaman-Kandidat',
    roleFallback: 'Ihre Rolle',
    signalTitle: 'Daran sieht man, wie die Person denkt:',
    ctaTitle: 'Wenn das für Sie passt',
    ctaBody: 'Ich würde das gern an einem konkreten Projekt oder einer realen Situation in Ihrem Team durchgehen.',
    openLinkedin: 'LinkedIn-Profil',
    openOriginal: 'Originalanzeige',
    backHome: 'Zurück zu JobShaman',
  },
  pl: {
    loading: 'Ładuję publiczny Signal Boost…',
    missingTitle: 'Ten Signal Boost nie jest już dostępny',
    missingBody: 'Link mógł wygasnąć, zostać zarchiwizowany albo nigdy nie został opublikowany.',
    createdVia: 'Utworzone przez JobShaman',
    reflectionNote: 'Krótkie notatki do waszej roli',
    candidateFallback: 'Kandydat JobShaman',
    roleFallback: 'Wasza rola',
    signalTitle: 'Po tym widać, jak o tym myśli:',
    ctaTitle: 'Jeśli to brzmi sensownie',
    ctaBody: 'Chętnie przejdę przez to na konkretnym projekcie albo sytuacji z waszego zespołu.',
    openLinkedin: 'Profil LinkedIn',
    openOriginal: 'Oryginalne ogłoszenie',
    backHome: 'Wróć do JobShaman',
  },
  en: {
    loading: 'Loading public Signal Boost…',
    missingTitle: 'This Signal Boost is no longer available',
    missingBody: 'The link may have expired, been archived, or was never published.',
    createdVia: 'Created via JobShaman',
    reflectionNote: 'Short notes on your role',
    candidateFallback: 'JobShaman candidate',
    roleFallback: 'Your role',
    signalTitle: 'What stands out in the way they think:',
    ctaTitle: 'If this feels relevant',
    ctaBody: 'I would be glad to walk through it against a real project or situation from your team.',
    openLinkedin: 'LinkedIn profile',
    openOriginal: 'Original listing',
    backHome: 'Back to JobShaman',
  },
} as const;

const pageShellClass =
  'app-organic-shell rounded-[34px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.38)] sm:p-8 dark:border-slate-800/80 dark:bg-slate-950/70';

const utilityButtonClass =
  'app-organic-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-slate-200/85 bg-white/86 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.24)] transition hover:border-cyan-200/80 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 dark:border-slate-700/80 dark:bg-slate-950/48 dark:text-slate-100 dark:hover:border-cyan-500/50 dark:hover:text-cyan-200';

const shouldCacheBustAvatarUrl = (url: string): boolean => {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('blob:') || normalized.startsWith('data:')) return false;
  const currentHost = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  return normalized.includes('/storage/v1/object/public/')
    || normalized.includes('/profile-photos/')
    || (currentHost ? normalized.includes(currentHost) : false);
};

const formatCacheBustedUrl = (url: string | null | undefined, marker: string | null | undefined): string | null => {
  const trimmedUrl = String(url || '').trim();
  if (!trimmedUrl) return null;
  if (!marker || !shouldCacheBustAvatarUrl(trimmedUrl)) {
    return trimmedUrl;
  }
  return `${trimmedUrl}${trimmedUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(marker)}`;
};

const buildInitials = (value: string | null | undefined): string => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return 'JS';
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join('');
};

const buildHeroTitle = (locale: keyof typeof pageCopy, title: string | null | undefined, fallback: string): string => {
  const roleTitle = String(title || '').trim() || fallback;
  switch (locale) {
    case 'cs':
      return `První směr, kterým bych šel u role ${roleTitle}`;
    case 'sk':
      return `Prvý smer, ktorým by som šiel pri role ${roleTitle}`;
    case 'de':
      return `Erste Richtung für die Rolle ${roleTitle}`;
    case 'pl':
      return `Pierwszy kierunek dla roli ${roleTitle}`;
    default:
      return `First direction I'd take in ${roleTitle}`;
  }
};

const buildNarrativeText = (output: JobSignalBoostOutput | null): string => {
  if (!output) return '';
  const preferredOrder = ['problem_frame', 'first_step', 'solution_direction', 'risk_and_unknowns'];
  const sectionsById = new Map((output.scenario_payload?.structured_sections || []).map((section) => [section.id, section]));
  const orderedIds = [
    ...preferredOrder,
    ...(output.scenario_payload?.structured_sections || [])
      .map((section) => section.id)
      .filter((sectionId) => !preferredOrder.includes(sectionId) && sectionId !== 'stakeholder_note'),
  ];
  const rawChunks = orderedIds
    .map((sectionId) => String(output.response_payload?.[sectionId] || '').trim())
    .filter(Boolean);
  const dedupedChunks = rawChunks.filter((chunk, index) => rawChunks.indexOf(chunk) === index);
  const paragraphs = dedupedChunks.flatMap((chunk) => (
    chunk
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
  ));

  if (paragraphs.length) {
    return paragraphs.join('\n\n');
  }

  return (output.scenario_payload?.structured_sections || [])
    .map((section) => ({
      section,
      value: String(output.response_payload?.[section.id] || '').trim(),
    }))
    .filter(({ value, section }) => value && sectionsById.has(section.id))
    .map(({ value }) => value)
    .join('\n\n');
};

const SignalBoostPublicPage: React.FC = () => {
  const routeLocale = normalizeLocale(getLocaleFromPathname(window.location.pathname, 'en'));
  const shareSlug = useMemo(() => {
    const parts = getPathPartsWithoutLocale(window.location.pathname);
    return parts[0] === 'signal' ? String(parts[1] || '').trim() : '';
  }, []);

  const [output, setOutput] = useState<JobSignalBoostOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarLoadMode, setAvatarLoadMode] = useState<'cache' | 'raw' | 'failed'>('cache');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!shareSlug) {
        setError('missing');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const nextOutput = await fetchPublicSignalBoostOutput(shareSlug);
        if (!cancelled) {
          setOutput(nextOutput);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError((fetchError as Error)?.message || 'missing');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [shareSlug]);

  useEffect(() => {
    setAvatarLoadMode('cache');
  }, [output?.candidate_snapshot?.avatar_url]);

  const locale = normalizeLocale(output?.locale || routeLocale);
  const copy = pageCopy[locale] || pageCopy.en;
  const homeHref = `/${locale}/`;
  const narrativeText = useMemo(() => buildNarrativeText(output), [output]);
  const signalBulletSource = output?.recruiter_readout?.strength_signals?.length
    ? output.recruiter_readout.strength_signals
    : output?.recruiter_readout?.what_cv_does_not_show?.length
      ? output.recruiter_readout.what_cv_does_not_show
      : [];
  const signalBullets = signalBulletSource
    .slice(0, 3)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const candidateName = String(output?.candidate_snapshot?.name || copy.candidateFallback).trim() || copy.candidateFallback;
  const candidateInitials = buildInitials(candidateName);
  const heroTitle = buildHeroTitle(locale, output?.job_snapshot?.title, copy.roleFallback);
  const metaLine = [
    String(output?.job_snapshot?.company || '').trim(),
    String(output?.job_snapshot?.location || '').trim(),
  ].filter(Boolean).join(' • ');
  const rawCandidateAvatarUrl = String(output?.candidate_snapshot?.avatar_url || '').trim() || null;
  const avatarProxyUrl = shareSlug
    ? `${BACKEND_URL}/signal-boost/${encodeURIComponent(shareSlug)}/avatar`
    : null;
  const cacheCandidateAvatarUrl = useMemo(
    () => formatCacheBustedUrl(
      rawCandidateAvatarUrl,
      output?.updated_at || output?.published_at || output?.created_at || null,
    ),
    [
      rawCandidateAvatarUrl,
      output?.created_at,
      output?.published_at,
      output?.updated_at,
    ],
  );
  const candidateAvatarUrl = avatarLoadMode === 'failed'
    ? null
    : avatarLoadMode === 'cache'
      ? avatarProxyUrl || cacheCandidateAvatarUrl
      : avatarLoadMode === 'raw'
      ? rawCandidateAvatarUrl
      : cacheCandidateAvatarUrl;

  const handleOriginalListing = () => {
    if (!output?.job_snapshot?.url) return;
    void recordSignalBoostEvent(output.id, 'open_original_listing');
    window.open(output.job_snapshot.url, '_blank', 'noopener,noreferrer');
  };

  const handleLinkedin = () => {
    if (!output?.candidate_snapshot?.linkedin) return;
    window.open(output.candidate_snapshot.linkedin, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <section className="app-shell-bg app-shell-bg-clean min-h-[calc(100dvh-var(--app-header-height))]">
        <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-12">
          <div className={`${pageShellClass} inline-flex items-center gap-3 px-5 py-4 text-sm text-slate-600 dark:text-slate-300`}>
            <Loader2 size={18} className="animate-spin" />
            {copy.loading}
          </div>
        </div>
      </section>
    );
  }

  if (!output || error) {
    return (
      <section className="app-shell-bg app-shell-bg-clean min-h-[calc(100dvh-var(--app-header-height))]">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className={`${pageShellClass} text-center`}>
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200/80 bg-cyan-50/80 text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-200">
              <Sparkles size={22} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-white">{copy.missingTitle}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">{copy.missingBody}</p>
            <a href={homeHref} className={`${utilityButtonClass} mt-6`}>
              <ArrowRight size={16} className="shrink-0" />
              {copy.backHome}
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="app-shell-bg app-shell-bg-clean min-h-[calc(100dvh-var(--app-header-height))]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <article className={pageShellClass}>
          <header className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="app-organic-pill inline-flex items-center gap-2 rounded-full border border-cyan-300/70 bg-cyan-50/88 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-800/60 dark:bg-cyan-950/30 dark:text-cyan-200">
                <Sparkles size={12} className="shrink-0" />
                {copy.createdVia}
              </div>
              <div className="app-organic-pill inline-flex rounded-full border border-white/70 bg-white/82 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700/80 dark:bg-slate-950/42 dark:text-slate-400">
                {copy.reflectionNote}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0">
                {candidateAvatarUrl ? (
                  <div className="rounded-[30px] border border-white/80 bg-white/82 p-1.5 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.28)] dark:border-slate-700/80 dark:bg-slate-950/45">
                    <img
                      src={candidateAvatarUrl}
                      alt={candidateName}
                      className="h-24 w-24 rounded-[24px] object-cover sm:h-28 sm:w-28"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setAvatarLoadMode((current) => {
                          if (current === 'cache' && rawCandidateAvatarUrl) {
                            return 'raw';
                          }
                          return 'failed';
                        });
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-[30px] border border-white/80 bg-white/82 text-3xl font-black tracking-[-0.08em] text-cyan-700 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.28)] dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-cyan-200 sm:h-28 sm:w-28 sm:text-4xl">
                    {candidateInitials}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-[2.2rem] font-black tracking-[-0.07em] text-slate-900 dark:text-white sm:text-[2.8rem]">
                  {candidateName}
                </h1>
                <div className="mt-3 text-[1.15rem] font-semibold leading-8 text-slate-800 dark:text-slate-100 sm:text-[1.35rem]">
                  {heroTitle}
                </div>
                {output.candidate_snapshot?.jobTitle ? (
                  <div className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                    {output.candidate_snapshot.jobTitle}
                  </div>
                ) : null}
                {metaLine ? (
                  <div className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
                    {metaLine}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className={`mx-auto mt-10 max-w-5xl gap-10 border-t border-slate-200/80 pt-8 dark:border-slate-800/80 ${signalBullets.length ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_260px]' : ''}`}>
            <div className="min-w-0">
              <div className="whitespace-pre-wrap text-[1.03rem] leading-8 text-slate-700 dark:text-slate-200 sm:text-[1.08rem] sm:leading-9">
                {narrativeText}
              </div>
            </div>

            {signalBullets.length ? (
              <aside className="mt-8 lg:mt-0">
                <div className="lg:sticky lg:top-8">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {copy.signalTitle}
                  </div>
                  <div className="mt-4 space-y-3">
                    {signalBullets.map((item, index) => (
                      <div key={`${index}-${item}`} className="flex gap-3 text-sm leading-7 text-slate-700 dark:text-slate-200">
                        <span className="mt-[13px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500 dark:bg-cyan-300" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            ) : null}
          </div>

          <section className="mx-auto mt-10 max-w-3xl border-t border-slate-200/80 pt-8 dark:border-slate-800/80">
            <div className="text-xl font-black tracking-[-0.05em] text-slate-900 dark:text-white">
              {copy.ctaTitle}
            </div>
            <p className="mt-3 text-base leading-8 text-slate-600 dark:text-slate-300">
              {copy.ctaBody}
            </p>

            {(output.candidate_snapshot?.linkedin || output.job_snapshot?.url) ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {output.candidate_snapshot?.linkedin ? (
                  <button type="button" onClick={handleLinkedin} className={utilityButtonClass}>
                    <Linkedin size={16} className="shrink-0" />
                    {copy.openLinkedin}
                  </button>
                ) : null}
                {output.job_snapshot?.url ? (
                  <button type="button" onClick={handleOriginalListing} className={utilityButtonClass}>
                    <ExternalLink size={16} className="shrink-0" />
                    {copy.openOriginal}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </article>
      </div>
    </section>
  );
};

export default SignalBoostPublicPage;
