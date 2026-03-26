import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Copy, ExternalLink, Loader2, Sparkles, TimerReset, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Job, JobSignalBoostBrief, JobSignalBoostOutput, UserProfile } from '../types';
import { fetchLatestSignalBoostOutputForJob, fetchSignalBoostBrief, publishSignalBoostOutput, recordSignalBoostEvent, updateSignalBoostOutput } from '../services/jobSignalBoostService';
import { trackAnalyticsEvent } from '../services/supabaseService';

interface SignalBoostModalProps {
  isOpen: boolean;
  job: Job;
  userProfile: UserProfile;
  onClose: () => void;
}

const getDraftKey = (jobId: string | number, userId: string | null | undefined) =>
  `jobshaman_signal_boost_draft:${String(jobId)}:${userId || 'guest'}`;

const normalizeLocale = (value: string): 'cs' | 'sk' | 'de' | 'pl' | 'en' => {
  const base = String(value || 'en').split('-')[0].toLowerCase();
  if (base === 'at') return 'de';
  return ['cs', 'sk', 'de', 'pl', 'en'].includes(base) ? (base as 'cs' | 'sk' | 'de' | 'pl' | 'en') : 'en';
};

const copyByLocale = {
  cs: {
    title: 'Signal Boost',
    subtitle: 'Krátký role-specific output, který můžeš poslat spolu s klasickou přihláškou.',
    loading: 'Připravuju konkrétní scénář…',
    publish: 'Vytvořit veřejný link',
    publishing: 'Vytvářím veřejný link',
    close: 'Zavřít',
    sharpen: 'Ještě to zkonkretni',
    shareReady: 'Veřejný link je hotový',
    shareHint: 'Pošli ho spolu s klasickou přihláškou nebo krátkou zprávou recruiterovi.',
    copyLink: 'Kopírovat link',
    copied: 'Link zkopírován',
    openPublic: 'Otevřít veřejnou stránku',
    copyMessage: 'Kopírovat krátkou zprávu',
    messageCopied: 'Zpráva zkopírována',
    sendAlongTitle: 'Pošli to spolu s přihláškou',
    sendAlongBody: 'Normálně se přihlas a tenhle link přidej do krátké zprávy recruiterovi. Tím se dostaneš z CV šumu do konkrétního signálu.',
    importedHint: 'U imported role si otevři původní listing, odešli standardní přihlášku a přidej k ní tento link.',
    nativeHint: 'U native role můžeš tenhle link poslat i samostatně jako rychlý první signál.',
    openOriginal: 'Otevřít původní nabídku',
    trackerTitle: 'Co se děje po odeslání',
    trackerBody: 'Tady uvidíš, jestli se na tvůj link někdo podíval a jestli udělal další krok.',
    trackerNotifyHint: 'Když recruiter klikne dál, dáme ti vědět i tady a podle nastavení případně i push nebo e-mailem.',
    trackerShared: 'Link připravený a sdílitelný',
    trackerViewedWaiting: 'Čeká na první otevření',
    trackerViewedDone: 'Link už někdo otevřel',
    trackerActionWaiting: 'Zatím bez další akce',
    trackerActionDone: 'Recruiter klikl dál',
    trackerViews: 'Otevření',
    trackerActions: 'Další kroky',
    trackerCopies: 'Kopírování',
    notesOptional: 'Volitelné',
    qualityTitle: 'Co ještě doostřit',
    empty: 'Zkus odpovědět konkrétně a po svém.',
  },
  sk: {
    title: 'Signal Boost',
    subtitle: 'Krátky role-specific output, ktorý môžeš poslať spolu s klasickou prihláškou.',
    loading: 'Pripravujem konkrétny scenár…',
    publish: 'Vytvoriť verejný link',
    publishing: 'Vytváram verejný link',
    close: 'Zavrieť',
    sharpen: 'Ešte to spresni',
    shareReady: 'Verejný link je hotový',
    shareHint: 'Pošli ho spolu s klasickou prihláškou alebo krátkou správou recruiterovi.',
    copyLink: 'Kopírovať link',
    copied: 'Link skopírovaný',
    openPublic: 'Otvoriť verejnú stránku',
    copyMessage: 'Kopírovať krátku správu',
    messageCopied: 'Správa skopírovaná',
    sendAlongTitle: 'Pošli to spolu s prihláškou',
    sendAlongBody: 'Normálne sa prihlás a tento link pridaj do krátkej správy recruiterovi. Tak sa dostaneš z CV šumu ku konkrétnemu signálu.',
    importedHint: 'Pri imported role si otvor pôvodný listing, pošli štandardnú prihlášku a pridaj k nej tento link.',
    nativeHint: 'Pri native role môžeš tento link poslať aj samostatne ako rýchly prvý signál.',
    openOriginal: 'Otvoriť pôvodnú ponuku',
    trackerTitle: 'Čo sa deje po odoslaní',
    trackerBody: 'Tu uvidíš, či si niekto tvoj link otvoril a či urobil ďalší krok.',
    trackerNotifyHint: 'Keď recruiter klikne ďalej, dáme ti vedieť aj tu a podľa nastavení prípadne aj pushom alebo e-mailom.',
    trackerShared: 'Link pripravený a zdieľateľný',
    trackerViewedWaiting: 'Čaká na prvé otvorenie',
    trackerViewedDone: 'Link už niekto otvoril',
    trackerActionWaiting: 'Zatiaľ bez ďalšej akcie',
    trackerActionDone: 'Recruiter klikol ďalej',
    trackerViews: 'Otvorenia',
    trackerActions: 'Ďalšie kroky',
    trackerCopies: 'Kopírovania',
    notesOptional: 'Voliteľné',
    qualityTitle: 'Čo ešte doostriť',
    empty: 'Skús odpovedať konkrétne a po svojom.',
  },
  de: {
    title: 'Signal Boost',
    subtitle: 'Ein kurzer, rollenspezifischer Output, den Sie zusammen mit der normalen Bewerbung senden können.',
    loading: 'Ein konkretes Szenario wird vorbereitet…',
    publish: 'Öffentlichen Link erstellen',
    publishing: 'Öffentlicher Link wird erstellt',
    close: 'Schließen',
    sharpen: 'Noch konkreter machen',
    shareReady: 'Der öffentliche Link ist fertig',
    shareHint: 'Senden Sie ihn zusammen mit der normalen Bewerbung oder einer kurzen Nachricht an den Recruiter.',
    copyLink: 'Link kopieren',
    copied: 'Link kopiert',
    openPublic: 'Öffentliche Seite öffnen',
    copyMessage: 'Kurze Nachricht kopieren',
    messageCopied: 'Nachricht kopiert',
    sendAlongTitle: 'Mit der Bewerbung mitsenden',
    sendAlongBody: 'Bewerben Sie sich ganz normal und ergänzen Sie diesen Link in einer kurzen Nachricht an den Recruiter. So wird aus CV-Rauschen ein konkretes Signal.',
    importedHint: 'Bei einer importierten Rolle öffnen Sie die Originalanzeige, senden die Standardbewerbung und fügen diesen Link hinzu.',
    nativeHint: 'Bei nativen Rollen kann dieser Link auch allein als schneller erster Arbeitsimpuls gesendet werden.',
    openOriginal: 'Originalanzeige öffnen',
    trackerTitle: 'Was nach dem Senden passiert',
    trackerBody: 'Hier sehen Sie, ob jemand den Link geöffnet hat und ob danach noch ein weiterer Schritt passiert ist.',
    trackerNotifyHint: 'Wenn ein Recruiter weiterklickt, geben wir hier Bescheid und je nach Einstellung auch per Push oder E-Mail.',
    trackerShared: 'Link ist bereit und teilbar',
    trackerViewedWaiting: 'Wartet auf die erste Öffnung',
    trackerViewedDone: 'Link wurde bereits geöffnet',
    trackerActionWaiting: 'Noch keine weitere Aktion',
    trackerActionDone: 'Recruiter hat weitergeklickt',
    trackerViews: 'Öffnungen',
    trackerActions: 'Weitere Schritte',
    trackerCopies: 'Kopiervorgänge',
    notesOptional: 'Optional',
    qualityTitle: 'Was noch schärfer werden sollte',
    empty: 'Antworten Sie konkret und aus Ihrer eigenen Perspektive.',
  },
  pl: {
    title: 'Signal Boost',
    subtitle: 'Krótki, dopasowany do roli output, który możesz wysłać razem ze zwykłym zgłoszeniem.',
    loading: 'Przygotowuję konkretny scenariusz…',
    publish: 'Utwórz publiczny link',
    publishing: 'Tworzę publiczny link',
    close: 'Zamknij',
    sharpen: 'Doprecyzuj to jeszcze',
    shareReady: 'Publiczny link jest gotowy',
    shareHint: 'Wyślij go razem ze zwykłym zgłoszeniem albo krótką wiadomością do rekrutera.',
    copyLink: 'Skopiuj link',
    copied: 'Link skopiowany',
    openPublic: 'Otwórz stronę publiczną',
    copyMessage: 'Skopiuj krótką wiadomość',
    messageCopied: 'Wiadomość skopiowana',
    sendAlongTitle: 'Wyślij to razem ze zgłoszeniem',
    sendAlongBody: 'Zgłoś się normalnie i dodaj ten link w krótkiej wiadomości do rekrutera. Dzięki temu wychodzisz poza szum samych CV.',
    importedHint: 'Przy imported role otwórz oryginalne ogłoszenie, wyślij standardowe zgłoszenie i dołącz ten link.',
    nativeHint: 'Przy native role możesz wysłać ten link także samodzielnie jako szybki pierwszy sygnał.',
    openOriginal: 'Otwórz oryginalne ogłoszenie',
    trackerTitle: 'Co dzieje się po wysłaniu',
    trackerBody: 'Tutaj zobaczysz, czy ktoś otworzył Twój link i czy wykonał kolejny krok.',
    trackerNotifyHint: 'Gdy rekruter kliknie dalej, damy Ci znać tutaj, a w zależności od ustawień także przez push lub e-mail.',
    trackerShared: 'Link gotowy do udostępnienia',
    trackerViewedWaiting: 'Czeka na pierwsze otwarcie',
    trackerViewedDone: 'Link został już otwarty',
    trackerActionWaiting: 'Na razie bez dalszej akcji',
    trackerActionDone: 'Rekruter kliknął dalej',
    trackerViews: 'Otwarcia',
    trackerActions: 'Dalsze kroki',
    trackerCopies: 'Kopiowania',
    notesOptional: 'Opcjonalne',
    qualityTitle: 'Co jeszcze warto wyostrzyć',
    empty: 'Odpowiedz konkretnie i po swojemu.',
  },
  en: {
    title: 'Signal Boost',
    subtitle: 'A short role-specific output you can send alongside your normal application.',
    loading: 'Preparing a concrete scenario…',
    publish: 'Create public link',
    publishing: 'Creating public link',
    close: 'Close',
    sharpen: 'Make it more concrete',
    shareReady: 'Your public link is ready',
    shareHint: 'Send it with your normal application or a short note to the recruiter.',
    copyLink: 'Copy link',
    copied: 'Link copied',
    openPublic: 'Open public page',
    copyMessage: 'Copy short note',
    messageCopied: 'Note copied',
    sendAlongTitle: 'Send this with your application',
    sendAlongBody: 'Apply normally and add this link to a short note for the recruiter. That moves you out of CV noise and into a concrete work signal.',
    importedHint: 'For an imported role, open the original listing, submit the standard application, and include this link with it.',
    nativeHint: 'For a native role, you can also send this link on its own as a quick first signal.',
    openOriginal: 'Open original listing',
    trackerTitle: 'What happens after you send it',
    trackerBody: 'You will see here whether someone opened your link and whether they took a next step.',
    trackerNotifyHint: 'If a recruiter clicks further, we will surface it here and, depending on your settings, also via push or email.',
    trackerShared: 'Link ready and shareable',
    trackerViewedWaiting: 'Waiting for the first open',
    trackerViewedDone: 'Your link has already been opened',
    trackerActionWaiting: 'No follow-up action yet',
    trackerActionDone: 'Recruiter clicked further',
    trackerViews: 'Opens',
    trackerActions: 'Next steps',
    trackerCopies: 'Copies',
    notesOptional: 'Optional',
    qualityTitle: 'What to sharpen',
    empty: 'Try answering concretely and from your own perspective.',
  },
} as const;

const SignalBoostModal: React.FC<SignalBoostModalProps> = ({
  isOpen,
  job,
  userProfile,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.resolvedLanguage || i18n.language || userProfile.preferredLocale || 'en');
  const copy = copyByLocale[locale] || copyByLocale.en;
  const draftKey = useMemo(() => getDraftKey(job.id, userProfile.id || null), [job.id, userProfile.id]);
  const guestDraftKey = useMemo(() => getDraftKey(job.id, null), [job.id]);

  const [brief, setBrief] = useState<JobSignalBoostBrief | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedOutput, setPublishedOutput] = useState<JobSignalBoostOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nudges, setNudges] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setPublishedOutput(null);
      setNudges([]);
      try {
        const guestDraft = typeof window !== 'undefined' ? window.localStorage.getItem(guestDraftKey) : null;
        const ownDraft = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
        const sourceDraft = ownDraft || guestDraft;
        if (sourceDraft) {
          try {
            const parsed = JSON.parse(sourceDraft);
            if (parsed && typeof parsed === 'object') {
              setValues(parsed as Record<string, string>);
            }
          } catch {
            setValues({});
          }
        } else {
          setValues({});
        }

        const [nextBrief, existingOutput] = await Promise.all([
          fetchSignalBoostBrief(job.id, locale),
          fetchLatestSignalBoostOutputForJob(job.id).catch(() => null),
        ]);
        if (!cancelled) {
          setBrief(nextBrief);
          if (existingOutput) {
            setPublishedOutput(existingOutput);
            if (!sourceDraft) {
              setValues(existingOutput.response_payload || {});
            }
          }
          void trackAnalyticsEvent({
            event_type: 'signal_boost_brief_generated',
            feature: 'signal_boost_v1',
            metadata: { job_id: job.id, locale },
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error)?.message || 'Failed to load Signal Boost.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [draftKey, guestDraftKey, isOpen, job.id, locale]);

  useEffect(() => {
    if (!isOpen || !publishedOutput?.id) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      void fetchLatestSignalBoostOutputForJob(job.id)
        .then((nextOutput) => {
          if (!cancelled && nextOutput?.id === publishedOutput.id) {
            setPublishedOutput(nextOutput);
          }
        })
        .catch(() => undefined);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, job.id, publishedOutput?.id]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      // ignore persistence issues
    }
  }, [draftKey, isOpen, values]);

  const handleChange = (sectionId: string, nextValue: string) => {
    setValues((current) => ({ ...current, [sectionId]: nextValue }));
  };

  const handlePublish = async () => {
    if (!brief) return;
    setPublishing(true);
    setError(null);
    setNudges([]);
    setCopied(false);
    setMessageCopied(false);
    try {
      const response = publishedOutput
        ? await updateSignalBoostOutput(publishedOutput.id, {
            locale: brief.locale,
            responsePayload: values,
            status: 'published',
          })
        : await publishSignalBoostOutput(job.id, {
            locale: brief.locale,
            responsePayload: values,
            status: 'published',
          });
      setPublishedOutput(response.output);
      setNudges(response.qualityFlags?.nudges || []);
      window.localStorage.removeItem(draftKey);
      window.localStorage.removeItem(guestDraftKey);
      void trackAnalyticsEvent({
        event_type: 'signal_boost_output_published',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, output_id: response.output.id, locale: brief.locale },
      });
    } catch (publishError) {
      const maybeQuality = (publishError as Error & { qualityFlags?: { nudges?: string[] } }).qualityFlags;
      if (maybeQuality?.nudges?.length) {
        setNudges(maybeQuality.nudges);
        void trackAnalyticsEvent({
          event_type: 'signal_boost_genericity_nudge_shown',
          feature: 'signal_boost_v1',
          metadata: { job_id: job.id, locale: brief.locale },
        });
      }
      setError((publishError as Error)?.message || 'Failed to publish Signal Boost.');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopy = async () => {
    if (!publishedOutput?.share_url) return;
    try {
      await navigator.clipboard.writeText(publishedOutput.share_url);
      setCopied(true);
      void recordSignalBoostEvent(publishedOutput.id, 'share_copy');
      void trackAnalyticsEvent({
        event_type: 'signal_boost_share_link_copied',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, output_id: publishedOutput.id },
      });
    } catch {
      setCopied(false);
    }
  };

  const shareNote = useMemo(() => {
    if (!publishedOutput?.share_url) return '';
    if (locale === 'cs') return `Dobrý den, kromě klasické přihlášky posílám i krátký 20minutový pracovní output k této roli: ${publishedOutput.share_url}`;
    if (locale === 'sk') return `Dobrý deň, okrem klasickej prihlášky posielam aj krátky 20-minútový pracovný output k tejto role: ${publishedOutput.share_url}`;
    if (locale === 'de') return `Guten Tag, zusätzlich zur normalen Bewerbung sende ich einen kurzen 20-Minuten-Output zu dieser Rolle: ${publishedOutput.share_url}`;
    if (locale === 'pl') return `Dzień dobry, oprócz zwykłego zgłoszenia wysyłam też krótki 20-minutowy output do tej roli: ${publishedOutput.share_url}`;
    return `Hi, alongside my normal application I am also sending a short 20-minute work signal for this role: ${publishedOutput.share_url}`;
  }, [locale, publishedOutput?.share_url]);

  const handleCopyMessage = async () => {
    if (!shareNote) return;
    try {
      await navigator.clipboard.writeText(shareNote);
      setMessageCopied(true);
      void trackAnalyticsEvent({
        event_type: 'signal_boost_apply_combo_used',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, output_id: publishedOutput?.id, locale },
      });
    } catch {
      setMessageCopied(false);
    }
  };

  const handleOpenOriginalListing = () => {
    const targetUrl = String(job.url || publishedOutput?.job_snapshot?.url || '').trim();
    if (!targetUrl) return;
    if (publishedOutput?.id) {
      void recordSignalBoostEvent(publishedOutput.id, 'open_original_listing');
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const trackerStats = useMemo(() => {
    const analytics = publishedOutput?.analytics || {};
    const views = Number(analytics.view || 0);
    const actions = Number(analytics.recruiter_cta_click || 0) + Number(analytics.open_original_listing || 0);
    const copies = Number(analytics.share_copy || 0);
    return { views, actions, copies };
  }, [publishedOutput?.analytics]);

  if (!isOpen) return null;

  return (
    <div className="app-modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="app-modal-panel max-w-4xl max-h-[min(90vh,960px)] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="app-modal-topline" />
        <div className="max-h-[min(90vh,960px)] overflow-y-auto p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="app-modal-kicker mb-2 inline-flex items-center gap-2">
                <Sparkles size={14} />
                {copy.title}
              </div>
              <h2 className="text-3xl font-black tracking-tight text-[var(--text-strong)]">{job.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[var(--text-faint)] transition hover:bg-black/5 hover:text-[var(--text-strong)] dark:hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>

          {loading ? (
            <div className="mt-8 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-6 text-sm text-[var(--text-muted)]">
              <div className="inline-flex items-center gap-3">
                <Loader2 size={18} className="animate-spin" />
                {copy.loading}
              </div>
            </div>
          ) : error && !brief ? (
            <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          ) : brief ? (
            <div className="mt-8 space-y-6">
              <div className="rounded-[26px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] p-5 dark:bg-[rgba(var(--accent-rgb),0.12)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{brief.kicker}</div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] dark:bg-slate-950/70">
                    <TimerReset size={14} />
                    {brief.timebox}
                  </div>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{brief.scenario_title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{brief.scenario_context}</p>
                <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-white/85 p-4 dark:bg-slate-950/60">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                    {brief.locale === 'cs' ? 'Jádro situace' : brief.locale === 'sk' ? 'Jadro situácie' : brief.locale === 'de' ? 'Kern der Situation' : brief.locale === 'pl' ? 'Rdzeń sytuacji' : 'Core problem'}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text)]">{brief.core_problem}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {brief.constraints.map((item) => (
                    <div key={item} className="rounded-[16px] border border-[var(--border-subtle)] bg-white/85 px-4 py-3 text-sm text-[var(--text-muted)] dark:bg-slate-950/60">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{brief.anti_generic_hint}</p>
              </div>

              <div className="grid gap-4">
                {brief.structured_sections.map((section) => {
                  const isOptional = Boolean(section.optional);
                  return (
                    <div key={section.id} className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--text-strong)]">{section.title}</div>
                        {isOptional ? (
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                            {copy.notesOptional}
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{section.hint}</p>
                      <textarea
                        value={values[section.id] || ''}
                        onChange={(event) => handleChange(section.id, event.target.value)}
                        rows={section.id === 'thinking_notes' ? 4 : 6}
                        className="app-modal-input mt-4 min-h-[132px] resize-y"
                        placeholder={copy.empty}
                      />
                      <div className="mt-2 text-xs text-[var(--text-faint)]">
                        {(values[section.id] || '').trim().length} / {section.soft_max_chars || 720}
                      </div>
                    </div>
                  );
                })}
              </div>

              {(nudges.length > 0 || error) ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                    <AlertCircle size={16} />
                    {copy.qualityTitle}
                  </div>
                  {error ? (
                    <p className="mt-3 text-sm leading-7 text-amber-900/80 dark:text-amber-100/80">{error}</p>
                  ) : null}
                  <div className="mt-3 space-y-2">
                    {nudges.map((item) => (
                      <div key={item} className="text-sm leading-7 text-amber-900/80 dark:text-amber-100/80">{item}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              {publishedOutput ? (
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                  <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{copy.shareReady}</div>
                  <p className="mt-2 text-sm leading-7 text-emerald-900/80 dark:text-emerald-100/80">{copy.shareHint}</p>
                  <div className="mt-4 rounded-[18px] border border-emerald-200/70 bg-white/90 px-4 py-3 text-sm text-slate-700 dark:border-emerald-900/30 dark:bg-slate-950/60 dark:text-slate-200">
                    {publishedOutput.share_url}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={handleCopy} className="app-button-primary">
                      <Copy size={16} />
                      {copied ? copy.copied : copy.copyLink}
                    </button>
                    <a
                      href={publishedOutput.share_url}
                      target="_blank"
                      rel="noreferrer"
                      className="app-button-dock"
                    >
                      <ExternalLink size={16} />
                      {copy.openPublic}
                    </a>
                  </div>
                  <div className="mt-5 rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4 dark:bg-slate-950/50">
                    <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.sendAlongTitle}</div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{copy.sendAlongBody}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                      {job.listingKind === 'imported' ? copy.importedHint : copy.nativeHint}
                    </p>
                    <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--text)]">
                      {shareNote}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={() => void handleCopyMessage()} className="app-button-secondary">
                        <Copy size={16} />
                        {messageCopied ? copy.messageCopied : copy.copyMessage}
                      </button>
                      {job.listingKind === 'imported' && String(job.url || publishedOutput.job_snapshot?.url || '').trim() ? (
                        <button type="button" onClick={handleOpenOriginalListing} className="app-button-dock">
                          <ExternalLink size={16} />
                          {copy.openOriginal}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-5 rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4 dark:bg-slate-950/50">
                    <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.trackerTitle}</div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{copy.trackerBody}</p>
                    <p className="mt-2 text-xs leading-6 text-[var(--text-faint)]">{copy.trackerNotifyHint}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{copy.trackerShared}</div>
                        <div className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{copy.shareReady}</div>
                      </div>
                      <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{copy.trackerViews}</div>
                        <div className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                          {trackerStats.views > 0 ? copy.trackerViewedDone : copy.trackerViewedWaiting}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{trackerStats.views}</div>
                      </div>
                      <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{copy.trackerActions}</div>
                        <div className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                          {trackerStats.actions > 0 ? copy.trackerActionDone : copy.trackerActionWaiting}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{trackerStats.actions}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-[var(--text-faint)]">
                      {copy.trackerCopies}: {trackerStats.copies}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="app-button-secondary">
                  {copy.close}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishing || loading || !brief}
                  className="app-button-primary"
                >
                  {publishing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {publishing ? copy.publishing : publishedOutput ? copy.sharpen : copy.publish}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SignalBoostModal;
