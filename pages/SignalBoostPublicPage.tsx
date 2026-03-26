import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, Loader2, Linkedin, Sparkles } from 'lucide-react';

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
    subtleNote: 'Krátký pracovní signál. Ne uhlazené finální řešení, ale způsob přemýšlení v prvních minutách práce.',
    candidate: 'Kandidát',
    scenario: 'Zadaná situace',
    output: 'Jak o tom kandidát přemýšlí',
    signalSummary: 'Krátké čtecí signály',
    recruiterNext: 'Co dál',
    openLinkedin: 'LinkedIn profil',
    seeRealInteraction: 'Podívat se na reálnou interakci',
    exploreHiring: 'Prozkoumat JobShaman pro nábor',
    openOriginal: 'Otevřít původní nabídku',
    backHome: 'Zpět na JobShaman',
    readTime: 'Čitelné za 2 až 3 minuty',
    targetRole: 'Cílová role',
    company: 'Firma',
    location: 'Lokalita',
    candidateFallback: 'Kandidát JobShamanu',
    roleFallback: 'Role',
  },
  sk: {
    loading: 'Načítavam verejný Signal Boost…',
    missingTitle: 'Tento Signal Boost už nie je dostupný',
    missingBody: 'Link mohol expirovať, byť archivovaný alebo nikdy nevznikol.',
    createdVia: 'Vytvorené cez JobShaman',
    subtleNote: 'Krátky pracovný signál. Nie uhladené finálne riešenie, ale spôsob premýšľania v prvých minútach práce.',
    candidate: 'Kandidát',
    scenario: 'Zadaná situácia',
    output: 'Ako o tom kandidát premýšľa',
    signalSummary: 'Krátke čitateľné signály',
    recruiterNext: 'Čo ďalej',
    openLinkedin: 'LinkedIn profil',
    seeRealInteraction: 'Pozrieť si reálnu interakciu',
    exploreHiring: 'Preskúmať JobShaman pre nábor',
    openOriginal: 'Otvoriť pôvodnú ponuku',
    backHome: 'Späť na JobShaman',
    readTime: 'Čitateľné za 2 až 3 minúty',
    targetRole: 'Cieľová rola',
    company: 'Firma',
    location: 'Lokalita',
    candidateFallback: 'Kandidát JobShamanu',
    roleFallback: 'Rola',
  },
  de: {
    loading: 'Öffentlicher Signal Boost wird geladen…',
    missingTitle: 'Dieser Signal Boost ist nicht mehr verfügbar',
    missingBody: 'Der Link könnte abgelaufen, archiviert oder nie veröffentlicht worden sein.',
    createdVia: 'Erstellt mit JobShaman',
    subtleNote: 'Ein kurzes Arbeitssignal. Keine polierte Endlösung, sondern sichtbar gemachtes Denken in den ersten Minuten realer Arbeit.',
    candidate: 'Kandidat',
    scenario: 'Ausgangssituation',
    output: 'So denkt die Person darüber nach',
    signalSummary: 'Kurze Lesesignale',
    recruiterNext: 'Nächster Schritt',
    openLinkedin: 'LinkedIn-Profil',
    seeRealInteraction: 'Reale Interaktion ansehen',
    exploreHiring: 'JobShaman für Recruiting ansehen',
    openOriginal: 'Originalanzeige öffnen',
    backHome: 'Zurück zu JobShaman',
    readTime: 'In 2 bis 3 Minuten lesbar',
    targetRole: 'Zielrolle',
    company: 'Unternehmen',
    location: 'Standort',
    candidateFallback: 'JobShaman-Kandidat',
    roleFallback: 'Rolle',
  },
  pl: {
    loading: 'Ładuję publiczny Signal Boost…',
    missingTitle: 'Ten Signal Boost nie jest już dostępny',
    missingBody: 'Link mógł wygasnąć, zostać zarchiwizowany albo nigdy nie został opublikowany.',
    createdVia: 'Utworzone przez JobShaman',
    subtleNote: 'Krótki sygnał pracy. Nie dopracowane finalne rozwiązanie, ale pokazany sposób myślenia w pierwszych minutach realnej pracy.',
    candidate: 'Kandydat',
    scenario: 'Sytuacja wyjściowa',
    output: 'Jak kandydat o tym myśli',
    signalSummary: 'Krótkie sygnały do odczytu',
    recruiterNext: 'Co dalej',
    openLinkedin: 'Profil LinkedIn',
    seeRealInteraction: 'Zobacz realną interakcję',
    exploreHiring: 'Poznaj JobShaman do rekrutacji',
    openOriginal: 'Otwórz oryginalne ogłoszenie',
    backHome: 'Wróć do JobShaman',
    readTime: 'Do przeczytania w 2 do 3 minut',
    targetRole: 'Rola docelowa',
    company: 'Firma',
    location: 'Lokalizacja',
    candidateFallback: 'Kandydat JobShaman',
    roleFallback: 'Rola',
  },
  en: {
    loading: 'Loading public Signal Boost…',
    missingTitle: 'This Signal Boost is no longer available',
    missingBody: 'The link may have expired, been archived, or was never published.',
    createdVia: 'Created via JobShaman',
    subtleNote: 'A short work signal. Not a polished final solution, but a visible way of thinking in the first minutes of real work.',
    candidate: 'Candidate',
    scenario: 'Given scenario',
    output: 'How the candidate thinks about it',
    signalSummary: 'Quick reading signals',
    recruiterNext: 'What next',
    openLinkedin: 'LinkedIn profile',
    seeRealInteraction: 'See a real interaction',
    exploreHiring: 'Explore JobShaman for hiring',
    openOriginal: 'Open original listing',
    backHome: 'Back to JobShaman',
    readTime: 'Readable in 2 to 3 minutes',
    targetRole: 'Target role',
    company: 'Company',
    location: 'Location',
    candidateFallback: 'JobShaman candidate',
    roleFallback: 'Role',
  },
} as const;

const SignalBoostPublicPage: React.FC = () => {
  const routeLocale = normalizeLocale(getLocaleFromPathname(window.location.pathname, 'en'));
  const shareSlug = useMemo(() => {
    const parts = getPathPartsWithoutLocale(window.location.pathname);
    return parts[0] === 'signal' ? String(parts[1] || '').trim() : '';
  }, []);

  const [output, setOutput] = useState<JobSignalBoostOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const locale = normalizeLocale(output?.locale || routeLocale);
  const copy = pageCopy[locale] || pageCopy.en;
  const localePrefix = locale;
  const demoHref = `/${localePrefix}/demo-company-handshake`;
  const hiringHref = `/${localePrefix}/pro-firmy`;
  const homeHref = `/${localePrefix}/`;
  const visibleSections = output?.scenario_payload?.structured_sections?.filter((section) =>
    String(output.response_payload?.[section.id] || '').trim()
  ) || [];

  const handleRecruiterCta = (target: 'demo' | 'hiring') => {
    if (!output?.id) return;
    void recordSignalBoostEvent(output.id, 'recruiter_cta_click');
    window.location.assign(target === 'demo' ? demoHref : hiringHref);
  };

  const handleOriginalListing = () => {
    if (!output?.job_snapshot?.url) return;
    void recordSignalBoostEvent(output.id, 'open_original_listing');
    window.open(output.job_snapshot.url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <section className="app-shell-bg app-shell-bg-clean min-h-[calc(100dvh-var(--app-header-height))]">
        <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4 py-12">
          <div className="inline-flex items-center gap-3 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-4 text-sm text-[var(--text-muted)]">
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
          <div className="rounded-[32px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 text-center">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] text-[var(--accent)]">
              <Sparkles size={22} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.missingTitle}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">{copy.missingBody}</p>
            <a href={homeHref} className="app-button-primary mt-6 inline-flex items-center gap-2">
              <ArrowRight size={16} />
              {copy.backHome}
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="app-shell-bg app-shell-bg-clean min-h-[calc(100dvh-var(--app-header-height))]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="rounded-[34px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-card)] sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                <Sparkles size={12} />
                {copy.createdVia}
              </div>
              <h1 className="mt-4 text-[2rem] font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[2.6rem]">
                {output.candidate_snapshot?.name || copy.candidateFallback}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{copy.subtleNote}</p>
            </div>
            <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
              {copy.readTime}
            </div>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-5">
              <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.candidate}</div>
                <div className="mt-4 flex items-center gap-4">
                  {output.candidate_snapshot?.avatar_url ? (
                    <img
                      src={output.candidate_snapshot.avatar_url}
                      alt={output.candidate_snapshot.name}
                      className="h-16 w-16 rounded-[20px] object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[rgba(var(--accent-rgb),0.12)] text-xl font-semibold text-[var(--accent)]">
                      {String(output.candidate_snapshot?.name || 'J').trim().slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                      {output.candidate_snapshot?.name || copy.candidateFallback}
                    </div>
                    {output.candidate_snapshot?.jobTitle ? (
                      <div className="mt-1 text-sm text-[var(--text-muted)]">{output.candidate_snapshot.jobTitle}</div>
                    ) : null}
                    {output.candidate_snapshot?.linkedin ? (
                      <a
                        href={output.candidate_snapshot.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
                      >
                        <Linkedin size={15} />
                        {copy.openLinkedin}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.scenario}</div>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                  {output.scenario_payload?.scenario_title || output.job_snapshot?.title}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{output.scenario_payload?.scenario_context}</p>
                <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                  <p className="text-sm leading-7 text-[var(--text)]">{output.scenario_payload?.core_problem}</p>
                </div>
              </div>

              <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.output}</div>
                <div className="mt-4 space-y-4">
                  {visibleSections.map((section) => (
                    <div key={section.id} className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                      <div className="text-sm font-semibold text-[var(--text-strong)]">{section.title}</div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">
                        {output.response_payload[section.id]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.targetRole}</div>
                <div className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{output.job_snapshot?.title || copy.roleFallback}</div>
                <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                  {output.job_snapshot?.company ? <div><span className="font-semibold text-[var(--text-strong)]">{copy.company}:</span> {output.job_snapshot.company}</div> : null}
                  {output.job_snapshot?.location ? <div><span className="font-semibold text-[var(--text-strong)]">{copy.location}:</span> {output.job_snapshot.location}</div> : null}
                </div>
              </div>

              {output.signal_summary?.items?.length ? (
                <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.signalSummary}</div>
                  <div className="mt-4 space-y-4">
                    {output.signal_summary.items.map((item) => (
                      <div key={item.key}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-[var(--text-strong)]">{item.label}</span>
                          <span className="text-[var(--text-muted)]">{Math.round(item.score)}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[rgba(148,163,184,0.18)]">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                            style={{ width: `${Math.max(12, Math.min(100, item.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[26px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] p-5 dark:bg-[rgba(var(--accent-rgb),0.1)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{copy.recruiterNext}</div>
                <div className="mt-4 flex flex-col gap-3">
                  <button type="button" onClick={() => handleRecruiterCta('demo')} className="app-button-primary justify-center">
                    <ArrowRight size={16} />
                    {copy.seeRealInteraction}
                  </button>
                  <button type="button" onClick={() => handleRecruiterCta('hiring')} className="app-button-dock justify-center">
                    <Sparkles size={16} />
                    {copy.exploreHiring}
                  </button>
                  {output.job_snapshot?.url ? (
                    <button type="button" onClick={handleOriginalListing} className="app-button-secondary justify-center">
                      <ExternalLink size={16} />
                      {copy.openOriginal}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignalBoostPublicPage;
