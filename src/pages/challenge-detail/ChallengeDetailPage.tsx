import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Compass, ExternalLink, Handshake, MapPin, Sparkles, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import SignalBoostModal from '../../../components/SignalBoostModal';
import { Badge, SurfaceCard, cn } from '../../../components/ui/primitives';
import type { CommuteAnalysis, Job, JobHumanContext, JobPublicPerson, UserProfile } from '../../../types';
import ChallengeComposer from '../../../components/challenges/ChallengeComposer';
import JHIChart from '../../../components/JHIChart';
import {
  ChallengeHumanContextSection,
  SectionTitle,
} from '../../../components/challenges/ChallengeDetailSections';
import { adaptJobToChallenge } from '../../entities/challenge/model/challengeAdapter';
import { calculateCommuteReality, isRemoteJob } from '../../../services/commuteService';
import { fetchJobHumanContext } from '../../../services/jobService';
import { getFallbackCompanyAvatarUrl, isStockCompanyAvatarUrl } from '../../../utils/companyStockAvatars';
import { analyzeJobBullshit } from '../../../utils/bullshitDetector';
import { getDomainAccent, resolveJobDomain } from '../../../utils/domainAccents';
import { getStockCoverForDomain, getStockGalleryForDomain } from '../../../utils/domainCoverImages';
import { getChallengeDetailPageCopy } from '../../../components/challenges/challengeDetailCopy';
import { trackAnalyticsEvent } from '../../../services/supabaseService';

export interface ChallengeDetailPageProps {
  job: Job;
  userProfile: UserProfile;
  firstQualityActionAt?: string | null;
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenProfile: () => void;
  onOpenSupportingContext: () => void;
  onOpenCompanyPage: (companyId: string) => void;
  onOpenImportedListing: () => void;
}

const getSignalBoostPendingKey = (jobId: string | number) => `jobshaman_signal_boost_pending:${String(jobId)}`;

const signalBoostEntryCopy = {
  cs: {
    eyebrow: 'Signal Boost',
    aiBadge: 'AI zadání',
    title: 'Pošli místo dalšího CV krátkou ukázku, jak přemýšlíš',
    body: 'Za 15 až 20 minut odpovíš na jednu reálnou situaci z role. Vznikne link, který můžeš přiložit k přihlášce a recruiter hned uvidí tvůj první krok, priority a otázky.',
    cta: 'Vytvořit ukázku myšlení',
    timebox: '15 až 20 minut',
    stepOne: 'Vyplníš 4 krátké bloky',
    stepTwo: 'Pošleš link s přihláškou',
  },
  sk: {
    eyebrow: 'Signal Boost',
    aiBadge: 'AI zadanie',
    title: 'Pošli namiesto ďalšieho CV krátku ukážku toho, ako premýšľaš',
    body: 'Za 15 až 20 minút odpovieš na jednu reálnu situáciu z role. Vznikne link, ktorý môžeš priložiť k prihláške a náborár hneď uvidí tvoj prvý krok, priority a otázky.',
    cta: 'Vytvoriť ukážku premýšľania',
    timebox: '15 až 20 minút',
    stepOne: 'Vyplníš 4 krátke bloky',
    stepTwo: 'Pošleš link s prihláškou',
  },
  de: {
    eyebrow: 'Signal Boost',
    aiBadge: 'AI Aufgabe',
    title: 'Senden Sie statt eines weiteren CVs einen kurzen Einblick in Ihr Denken',
    body: 'In 15 bis 20 Minuten beantworten Sie eine reale Situation aus der Rolle. Daraus entsteht ein Link, den Sie Ihrer Bewerbung beilegen können, damit Recruiting sofort Ihren ersten Schritt, Ihre Prioritäten und offenen Fragen sieht.',
    cta: 'Kurzen Denkbeitrag erstellen',
    timebox: '15 bis 20 Minuten',
    stepOne: '4 kurze Felder ausfüllen',
    stepTwo: 'Link mit der Bewerbung senden',
  },
  pl: {
    eyebrow: 'Signal Boost',
    aiBadge: 'AI zadanie',
    title: 'Zamiast kolejnego CV pokaż krótko, jak myślisz',
    body: 'W 15 do 20 minut odpowiesz na jedną realną sytuację z tej roli. Powstanie link, który dołączysz do zgłoszenia, a rekruter od razu zobaczy Twój pierwszy krok, priorytety i pytania.',
    cta: 'Stwórz krótką próbkę myślenia',
    timebox: '15 do 20 minut',
    stepOne: 'Uzupełnisz 4 krótkie pola',
    stepTwo: 'Wyślesz link ze zgłoszeniem',
  },
  en: {
    eyebrow: 'Signal Boost',
    aiBadge: 'AI task',
    title: 'Send a short proof of how you think, not just another CV',
    body: 'In 15 to 20 minutes, you respond to one real situation from the role. The result is a link you can attach to your application so the hiring team sees your first move, priorities, and questions right away.',
    cta: 'Create thinking sample',
    timebox: '15 to 20 minutes',
    stepOne: 'Fill in 4 short blocks',
    stepTwo: 'Send the link with your application',
  },
} as const;

const ChallengeDetailPage: React.FC<ChallengeDetailPageProps> = ({
  job,
  userProfile,
  onBack,
  onRequireAuth,
  onOpenProfile,
  onOpenSupportingContext,
  onOpenCompanyPage,
  onOpenImportedListing,
}) => {
  const { i18n } = useTranslation();
  const [humanContext, setHumanContext] = useState<JobHumanContext | null>(null);
  const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
  const [isSignalBoostOpen, setIsSignalBoostOpen] = useState(false);
  const locale = String(i18n.resolvedLanguage || i18n.language || userProfile?.preferredLocale || 'en');
  const challenge = useMemo(() => adaptJobToChallenge(job), [job]);
  const language = locale.split('-')[0].toLowerCase();
  const normalizedSignalBoostLocale = language === 'at' ? 'de' : (['cs', 'sk', 'de', 'pl', 'en'].includes(language) ? language : 'en');
  const isCsLike = language === 'cs' || language === 'sk';
  const isImported = job.listingKind === 'imported';
  const isMicroJobRole = job.challenge_format === 'micro_job';
  const isNativeChallenge = !isImported && Boolean(job.company_id) && String(job.source || '').trim().toLowerCase() === 'jobshaman.cz';
  const remoteRole = isRemoteJob(job);
  const publisher: JobPublicPerson | null = humanContext?.publisher || null;
  const signalBoostBaseCopy = signalBoostEntryCopy[normalizedSignalBoostLocale as keyof typeof signalBoostEntryCopy] || signalBoostEntryCopy.en;
  const signalBoostCopy = {
    ...signalBoostBaseCopy,
    body: isImported
      ? normalizedSignalBoostLocale === 'cs'
        ? 'Odpovíš na jednu konkrétní situaci z role, normálně se přihlásíš a link pošleš spolu s přihláškou. Náborář tak neuvidí jen CV, ale i to, jak bys začal(a) pracovat.'
        : normalizedSignalBoostLocale === 'sk'
          ? 'Odpovieš na jednu konkrétnu situáciu z role, normálne sa prihlásiš a link pošleš spolu s prihláškou. Náborár tak neuvidí len CV, ale aj to, ako by si začal(a) pracovať.'
          : normalizedSignalBoostLocale === 'de'
            ? 'Sie reagieren auf eine konkrete Situation aus der Rolle, bewerben sich ganz normal und senden den Link mit. So sieht Recruiting nicht nur Ihren CV, sondern auch, wie Sie anfangen würden zu arbeiten.'
            : normalizedSignalBoostLocale === 'pl'
              ? 'Odpowiadasz na jedną konkretną sytuację z roli, zgłaszasz się normalnie i wysyłasz link razem ze zgłoszeniem. Rekruter widzi wtedy nie tylko CV, ale też jak zaczynasz myśleć o pracy.'
              : 'Respond to one concrete situation from the role, apply normally, and send the link with your application. The hiring team sees more than a CV: they see how you would start working.'
      : signalBoostBaseCopy.body,
  };
  const signalBoostPendingKey = useMemo(() => getSignalBoostPendingKey(job.id), [job.id]);

  const effectiveDomain = useMemo(() => resolveJobDomain(job), [job]);
  const nativeCompanyGallery = useMemo(
    () => Array.from(new Set(
      (Array.isArray(job.companyProfile?.gallery_urls) ? job.companyProfile.gallery_urls : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )),
    [job.companyProfile?.gallery_urls],
  );
  const stockGalleryImages = useMemo(
    () => getStockGalleryForDomain(effectiveDomain, `${job.company || ''}-${job.id || ''}-${job.title || ''}`, 5),
    [effectiveDomain, job.company, job.id, job.title],
  );
  const coverImageUrl = useMemo(
    () => (isNativeChallenge && nativeCompanyGallery[0])
      ? nativeCompanyGallery[0]
      : getStockCoverForDomain(effectiveDomain, `${job.id || ''}-${job.company || ''}-${job.title || ''}`),
    [effectiveDomain, isNativeChallenge, job.company, job.id, job.title, nativeCompanyGallery],
  );
  const companyGalleryImages = useMemo(
    () => Array.from(new Set([
      ...(isNativeChallenge ? nativeCompanyGallery : []),
      ...stockGalleryImages,
    ])).slice(0, 5),
    [isNativeChallenge, nativeCompanyGallery, stockGalleryImages],
  );
  const domainAccent = useMemo(() => getDomainAccent(effectiveDomain), [effectiveDomain]);

  const copy = getChallengeDetailPageCopy(language);

  useEffect(() => {
    let cancelled = false;
    const loadHumanContext = async () => {
      if (!isNativeChallenge) {
        setHumanContext(null);
        return;
      }
      try {
        const payload = await fetchJobHumanContext(job.id);
        if (!cancelled) setHumanContext(payload);
      } catch (error) {
        console.warn('Human context fetch failed:', error);
        if (!cancelled) setHumanContext(null);
      }
    };

    void loadHumanContext();
    return () => {
      cancelled = true;
    };
  }, [isNativeChallenge, job.id]);

  useEffect(() => {
    if (!userProfile.isLoggedIn || typeof window === 'undefined') return;
    const pending = window.localStorage.getItem(signalBoostPendingKey);
    if (!pending) return;
    window.localStorage.removeItem(signalBoostPendingKey);
    setIsSignalBoostOpen(true);
    void trackAnalyticsEvent({
      event_type: 'signal_boost_cta_opened',
      feature: 'signal_boost_v1',
      metadata: { job_id: job.id, source: 'auth_return' },
    });
  }, [job.id, signalBoostPendingKey, userProfile.isLoggedIn]);

  useEffect(() => {
    if (!userProfile?.isLoggedIn || ((!userProfile.address && !userProfile.coordinates) && !remoteRole)) {
      setCommuteAnalysis(null);
      return;
    }
    try {
      const safeJob = {
        ...job,
        benefits: Array.isArray((job as any).benefits) ? (job as any).benefits : [],
        tags: Array.isArray((job as any).tags) ? (job as any).tags : [],
      } as Job;
      const profileForCalc = userProfile.address
        ? userProfile
        : {
            ...userProfile,
            address: copy.currentLocation,
          };
      setCommuteAnalysis(calculateCommuteReality(safeJob, profileForCalc));
    } catch (error) {
      console.warn('Failed to calculate commute reality', error);
      setCommuteAnalysis(null);
    }
  }, [isCsLike, job, remoteRole, userProfile]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-atmosphere-image', 'none');
    root.style.setProperty('--app-atmosphere-opacity', '0');
    root.style.setProperty('--app-atmosphere-blur', '0');
    root.style.setProperty(
      '--app-atmosphere-overlay-light',
      'linear-gradient(180deg, rgba(255,255,255,0.62), transparent 22%), linear-gradient(rgba(16,32,51,0.038) 1px, transparent 1px), linear-gradient(90deg, rgba(16,32,51,0.038) 1px, transparent 1px), linear-gradient(180deg, rgba(243,246,251,0.96) 0%, rgba(239,244,250,0.98) 100%)'
    );
    root.style.setProperty(
      '--app-atmosphere-overlay-dark',
      'radial-gradient(circle at 16% 10%, rgba(var(--accent-rgb), 0.08), transparent 22%), linear-gradient(180deg, rgba(6, 13, 20, 0.68) 0%, rgba(6, 13, 20, 0.82) 100%)'
    );

    return () => {
      root.style.setProperty('--app-atmosphere-image', 'none');
      root.style.setProperty('--app-atmosphere-opacity', '0');
      root.style.setProperty('--app-atmosphere-blur', '96px');
      root.style.setProperty(
        '--app-atmosphere-overlay-light',
        'linear-gradient(180deg, rgba(243, 246, 251, 0.82) 0%, rgba(243, 246, 251, 0.9) 36%, rgba(243, 246, 251, 0.96) 100%)'
      );
      root.style.setProperty(
        '--app-atmosphere-overlay-dark',
        'linear-gradient(180deg, rgba(6, 13, 20, 0.7) 0%, rgba(6, 13, 20, 0.82) 36%, rgba(6, 13, 20, 0.92) 100%)'
      );
    };
  }, []);

  const displayedSalary = job.salaryRange
    || job.micro_job_reward
    || (Number(job.salary_from || 0) && Number(job.salary_to || 0)
      ? `${Number(job.salary_from).toLocaleString(locale)} - ${Number(job.salary_to).toLocaleString(locale)} ${(job as any).salary_currency || (language === 'cs' ? 'CZK' : 'EUR')}`
      : Number(job.salary_from || 0) || Number(job.salary_to || 0)
        ? `${Number(job.salary_from || job.salary_to || 0).toLocaleString(locale)} ${(job as any).salary_currency || (language === 'cs' ? 'CZK' : 'EUR')}`
        : copy.salaryMissing);
  const locationValue = String(job.location || '').trim() || copy.locationMissing;
  const workModelValue = String(job.work_model || job.type || '').trim() || copy.workModelMissing;
  const missionBody = String(job.challenge || job.aiAnalysis?.summary || job.description || '').trim() || copy.companyFallback;
  const firstStep = String(job.firstStepPrompt || '').trim();
  const riskBody = String(job.risk || job.aiAnalysis?.culturalFit || '').trim();
  const importedStory = useMemo(
    () => ({
      roleSnapshot: missionBody,
      firstStep: firstStep || challenge.firstStepPrompt || '',
      risk: riskBody || '',
      companyContext: missionBody,
      benefits: Array.from(new Set((Array.isArray(job.benefits) ? job.benefits : []).map((value) => String(value || '').trim()).filter(Boolean))).slice(0, 4),
    }),
    [challenge.firstStepPrompt, firstStep, job.benefits, missionBody, riskBody],
  );
  const bullshitAnalysis = useMemo(() => analyzeJobBullshit(job, language), [job, language]);
  const trustDialoguesCount = humanContext?.trust?.dialogues_last_90d ?? null;
  const trustResponseHours = humanContext?.trust?.median_first_response_hours_last_90d ?? null;
  const trustLabels = [
    typeof trustDialoguesCount === 'number' && trustDialoguesCount > 0
      ? copy.trustDialogues.replace('{{count}}', trustDialoguesCount.toLocaleString(locale))
      : '',
    trustResponseHours == null
      ? ''
      : trustResponseHours < 1
        ? copy.trustResponseUnderHour
        : copy.trustResponse.replace(
            '{{hours}}',
            (Number.isInteger(trustResponseHours)
              ? String(Math.round(trustResponseHours))
              : trustResponseHours.toLocaleString(locale, { maximumFractionDigits: 1 }))
          ),
  ].filter(Boolean);

  const publisherAvatar = String(publisher?.avatar_url || '').trim()
    || String(job.companyProfile?.logo_url || '').trim()
    || getFallbackCompanyAvatarUrl(job.company);
  const publisherName = publisher?.display_name || job.company;
  const publisherRole = publisher?.display_role || (isImported ? copy.badgeImported : copy.teamFallbackRole);
  const publisherInitials = publisherName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'JS';
  const usePublisherMonogram = isStockCompanyAvatarUrl(publisherAvatar);
  const listingBadge = isImported ? copy.badgeImported : isMicroJobRole ? copy.badgeMicro : copy.badgeNative;
  const matchScore = Math.max(0, Math.min(100, Math.round(Number(job.aiMatchScore || 0))));
  const handleOpenSignalBoost = () => {
    if (!userProfile.isLoggedIn) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(signalBoostPendingKey, JSON.stringify({ opened_at: new Date().toISOString() }));
        } catch {
          // ignore storage issues
        }
      }
      void trackAnalyticsEvent({
        event_type: 'signal_boost_cta_opened',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, source: 'guest_auth_gate' },
      });
      onRequireAuth();
      return;
    }
    setIsSignalBoostOpen(true);
    void trackAnalyticsEvent({
      event_type: 'signal_boost_cta_opened',
      feature: 'signal_boost_v1',
      metadata: { job_id: job.id, source: 'job_detail' },
    });
  };
  const companyStoryLabels = language === 'cs'
    ? {
        about: 'Kam vlastně vstupuješ',
        philosophy: 'Proč ta firma existuje',
        environment: 'Jak to tam působí',
        values: 'Co je pro ně důležité',
        benefits: 'Co z prostředí fakt cítíš',
        website: 'Web',
        industry: 'Obor',
        teamPulse: 'Jak živě tým působí',
      }
    : language === 'sk'
      ? {
          about: 'Kam vlastne vstupuješ',
          philosophy: 'Prečo tá firma existuje',
          environment: 'Ako to tam pôsobí',
          values: 'Čo je pre nich dôležité',
          benefits: 'Čo z prostredia fakt cítiť',
          website: 'Web',
          industry: 'Obor',
          teamPulse: 'Ako živo tím pôsobí',
        }
      : language === 'de' || language === 'at'
        ? {
            about: 'Wohin du hier eigentlich eintrittst',
            philosophy: 'Warum diese Firma existiert',
            environment: 'Wie sich das Umfeld anfühlt',
            values: 'Was ihnen wichtig ist',
            benefits: 'Was man aus dem Umfeld wirklich spürt',
            website: 'Web',
            industry: 'Bereich',
            teamPulse: 'Wie lebendig das Team wirkt',
          }
        : language === 'pl'
          ? {
              about: 'Dokąd właściwie wchodzisz',
              philosophy: 'Po co ta firma istnieje',
              environment: 'Jak czuć to środowisko',
              values: 'Co jest dla nich ważne',
              benefits: 'Co naprawdę czuć z tego środowiska',
              website: 'WWW',
              industry: 'Branża',
              teamPulse: 'Jak żywo działa zespół',
            }
          : {
              about: 'Where you are actually stepping into',
              philosophy: 'Why this company exists',
              environment: 'How the environment feels',
              values: 'What matters to them',
              benefits: 'What you can actually feel from the environment',
              website: 'Website',
              industry: 'Industry',
              teamPulse: 'How alive the team feels',
            };
  const importedStoryLabels = language === 'cs'
    ? {
        sectionTitle: 'Co jde poznat z inzerátu',
        companyContext: 'Co firma o sobě skutečně říká',
        quickFacts: 'Rychlá fakta z inzerátu',
        tone: 'Jak ten text působí',
        workModel: 'Režim role',
        sourceNote: 'U importu ber jen to, co je podložené textem inzerátu a původním listingem.',
        peopleFallback: 'U importu zatím nevidíš tým zevnitř firmy. Tady máš jen to, co jde férově vyčíst z textu role.',
      }
    : language === 'sk'
      ? {
          sectionTitle: 'Čo sa dá vyčítať z inzerátu',
          companyContext: 'Čo firma o sebe naozaj hovorí',
          quickFacts: 'Rýchle fakty z inzerátu',
          tone: 'Ako ten text pôsobí',
          workModel: 'Režim roly',
          sourceNote: 'Pri importe ber len to, čo je podložené textom inzerátu a pôvodným listingom.',
          peopleFallback: 'Pri importe zatiaľ nevidíš tím zvnútra firmy. Tu je len to, čo sa dá férovo vyčítať z textu roly.',
        }
      : language === 'de' || language === 'at'
        ? {
            sectionTitle: 'Was man aus der Anzeige wirklich lesen kann',
            companyContext: 'Was die Firma tatsächlich über sich sagt',
            quickFacts: 'Schnelle Fakten aus der Anzeige',
            tone: 'Wie der Text wirkt',
            workModel: 'Arbeitsmodell',
            sourceNote: 'Bei importierten Rollen zeigen wir nur, was durch den Anzeigentext und das Original-Listing belegt ist.',
            peopleFallback: 'Bei importierten Rollen sieht man das Team noch nicht von innen. Hier steht nur, was sich fair aus dem Text ableiten lässt.',
          }
        : language === 'pl'
          ? {
              sectionTitle: 'Co naprawdę da się wyczytać z ogłoszenia',
              companyContext: 'Co firma naprawdę mówi o sobie',
              quickFacts: 'Szybkie fakty z ogłoszenia',
              tone: 'Jak brzmi ten tekst',
              workModel: 'Tryb pracy',
              sourceNote: 'Przy imporcie pokazujemy tylko to, co faktycznie wynika z treści ogłoszenia i oryginalnego źródła.',
              peopleFallback: 'Przy imporcie nie widać jeszcze zespołu od środka. Tu pokazujemy tylko to, co da się uczciwie wyczytać z tekstu roli.',
            }
          : {
              sectionTitle: 'What you can actually read from the listing',
              companyContext: 'What the company really says about itself',
              quickFacts: 'Quick facts from the listing',
              tone: 'How the text reads',
              workModel: 'Work setup',
              sourceNote: 'For imported roles, we only show what is actually supported by the listing text and the original source.',
              peopleFallback: 'Imported roles do not show the internal team yet. This section only reflects what can be fairly inferred from the role text.',
            };
  const companyIntro = String(job.companyProfile?.description || '').trim()
    || String(job.companyProfile?.philosophy || '').trim()
    || String(job.companyGoal || '').trim()
    || missionBody;
  const importedSummaryLabels = language === 'cs'
    ? {
        sectionTitle: 'Shrnuti role',
        companyContext: 'Co firma pise o sobe',
        quickFacts: 'Zakladni fakta',
        workModel: 'Rezim prace',
        benefits: 'Benefity z inzeratu',
        originalListing: 'Puvodni text nabidky',
        originalBody: 'Plny text nabidky zustava dostupny i tady, aby bylo jasne, z ceho role vychazi.',
        decision: 'Co si overit pred reakci',
      }
    : language === 'sk'
      ? {
          sectionTitle: 'Zhrnutie roly',
          companyContext: 'Co firma pise o sebe',
          quickFacts: 'Zakladne fakty',
          workModel: 'Rezim prace',
          benefits: 'Benefity z inzeratu',
          originalListing: 'Povodny text ponuky',
          originalBody: 'Plny text ponuky zostava dostupny aj tu, aby bolo jasne, z coho rola vychadza.',
          decision: 'Co si overit pred reakciou',
        }
      : language === 'de' || language === 'at'
        ? {
            sectionTitle: 'Rollenuberblick',
            companyContext: 'Was die Firma uber sich schreibt',
            quickFacts: 'Grundfakten',
            workModel: 'Arbeitsmodell',
            benefits: 'Benefits aus der Anzeige',
            originalListing: 'Originaltext der Anzeige',
            originalBody: 'Der volle Anzeigentext bleibt sichtbar, damit klar bleibt, worauf die Rolle basiert.',
            decision: 'Was du vor der Reaktion prufen solltest',
          }
        : language === 'pl'
          ? {
              sectionTitle: 'Podsumowanie roli',
              companyContext: 'Co firma pisze o sobie',
              quickFacts: 'Podstawowe fakty',
              workModel: 'Tryb pracy',
              benefits: 'Benefity z ogloszenia',
              originalListing: 'Oryginalny tekst ogloszenia',
              originalBody: 'Pelna tresc ogloszenia zostaje tutaj widoczna, zeby bylo jasne, na czym opiera sie rola.',
              decision: 'Co sprawdzic przed reakcja',
            }
          : {
              sectionTitle: 'Role summary',
              companyContext: 'What the company says about itself',
              quickFacts: 'Key facts',
              workModel: 'Work setup',
              benefits: 'Benefits from the listing',
              originalListing: 'Original listing text',
              originalBody: 'The full source listing stays visible here so it is always clear what the role is based on.',
              decision: 'What to verify before responding',
            };
  const heroLead = isImported ? copy.heroLeadImported : copy.heroLeadNative;
  const companyPhilosophy = String(job.companyProfile?.philosophy || '').trim()
    || String(job.companyGoal || '').trim()
    || heroLead;
  const companyIndustry = String(job.companyProfile?.industry || '').trim()
    || (domainAccent ? (language === 'cs' || language === 'sk' ? domainAccent.label.cs : domainAccent.label.en) : '');
  const companyTone = String(job.companyProfile?.tone || '').trim();
  const companyValues = Array.from(new Set([
    ...(Array.isArray(job.companyProfile?.values) ? job.companyProfile?.values : []),
    ...(Array.isArray(job.tags) ? job.tags : []),
  ].map((value) => String(value || '').trim()).filter(Boolean))).slice(0, 6);
  const companyBenefits = Array.from(new Set((Array.isArray(job.benefits) ? job.benefits : []).map((value) => String(value || '').trim()).filter(Boolean))).slice(0, 4);
  const companyWebsiteLabel = (() => {
    const raw = String(job.companyProfile?.website || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw).host.replace(/^www\./, '');
    } catch {
      return raw.replace(/^https?:\/\//, '').replace(/^www\./, '');
    }
  })();
  const companyIdentityLabels = language === 'cs'
    ? { registration: 'IČO / registrace', tax: 'DIČ / daňové ID', legalAddress: 'Právní adresa' }
    : language === 'sk'
      ? { registration: 'IČO / registrácia', tax: 'DIČ / daňové ID', legalAddress: 'Právna adresa' }
      : language === 'de' || language === 'at'
        ? { registration: 'Register / Firmen-ID', tax: 'Steuer-ID', legalAddress: 'Rechtsadresse' }
        : language === 'pl'
          ? { registration: 'Rejestr / identyfikator firmy', tax: 'NIP / ID podatkowe', legalAddress: 'Adres prawny' }
          : { registration: 'Registration / company ID', tax: 'Tax ID', legalAddress: 'Legal address' };
  const companyIdentityFacts = [
    String(job.companyProfile?.ico || job.companyProfile?.registry_info || '').trim()
      ? `${companyIdentityLabels.registration}: ${String(job.companyProfile?.ico || job.companyProfile?.registry_info || '').trim()}`
      : '',
    String(job.companyProfile?.dic || '').trim()
      ? `${companyIdentityLabels.tax}: ${String(job.companyProfile?.dic || '').trim()}`
      : '',
    String(job.companyProfile?.legal_address || '').trim()
      ? `${companyIdentityLabels.legalAddress}: ${String(job.companyProfile?.legal_address || '').trim()}`
      : '',
  ].filter(Boolean);
  const importedQuickFacts = Array.from(new Set([
    workModelValue ? `${companyStoryLabels.industry}: ${workModelValue}` : '',
    companyIndustry ? `${companyStoryLabels.industry}: ${companyIndustry}` : '',
    companyWebsiteLabel ? `${companyStoryLabels.website}: ${companyWebsiteLabel}` : '',
  ].filter(Boolean))).slice(0, 4);
  const importedRoleSnapshot = importedStory.roleSnapshot || missionBody;
  const importedFirstStep = importedStory.firstStep || firstStep || challenge.firstStepPrompt || '';
  const importedRisk = importedStory.risk || '';
  const insideSectionTitle = isImported ? copy.importedSnapshot : copy.insideTitle;
  const publisherFallbackCopy = isImported ? importedStoryLabels.peopleFallback : copy.companyPeopleFallback;
  const importedOriginalDescription = String(job.description || importedStory.roleSnapshot || '').trim();
  const importedRealityLead = language === 'cs'
    ? 'Kolik ti po všem z téhle role skutečně zůstane'
    : language === 'sk'
      ? 'Kolko ti po všetkom z tejto roly skutočne zostane'
      : language === 'de' || language === 'at'
        ? 'Was dir aus dieser Rolle am Ende wirklich bleibt'
        : language === 'pl'
        ? 'Ile naprawdę zostanie ci z tej roli po wszystkim'
        : 'What this role really leaves you with after everything is counted';
  const importedOriginalListingTitle = language === 'cs'
    ? 'Původní text nabídky'
    : language === 'sk'
      ? 'Pôvodný text ponuky'
      : language === 'de' || language === 'at'
        ? 'Originaltext der Anzeige'
        : language === 'pl'
          ? 'Oryginalny tekst ogłoszenia'
          : 'Original listing';
  const jhiDimensions = [
    { key: 'financial', label: copy.jhiDimensionFinancial, value: Number(job.jhi?.financial || 0) },
    { key: 'timeCost', label: copy.jhiDimensionTimeCost, value: Number(job.jhi?.timeCost || 0) },
    { key: 'mentalLoad', label: copy.jhiDimensionMentalLoad, value: Number(job.jhi?.mentalLoad || 0) },
    { key: 'growth', label: copy.jhiDimensionGrowth, value: Number(job.jhi?.growth || 0) },
    { key: 'values', label: copy.jhiDimensionValues, value: Number(job.jhi?.values || 0) },
  ]
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((left, right) => right.value - left.value);
  const decisionVerdict = useMemo(() => {
    const jhiScore = Math.round(job.jhi?.score || 0);
    const travelMinutes = remoteRole ? 0 : (commuteAnalysis?.timeMinutes || 0) * 2;
    const commuteCostValue = remoteRole ? 0 : Number(commuteAnalysis?.financialReality.commuteCost || 0);
    const finalValue = Number(commuteAnalysis?.financialReality.finalRealMonthlyValue || 0);

    if (jhiScore >= 72 && travelMinutes <= 120 && finalValue > 0) {
      return {
        title: copy.verdictGo,
        body: copy.verdictGoBody,
        tone: 'success' as const,
      };
    }
    if (jhiScore < 55 || travelMinutes >= 180 || finalValue < 0 || commuteCostValue >= 15000) {
      return {
        title: copy.verdictNo,
        body: copy.verdictNoBody,
        tone: 'warning' as const,
      };
    }
    return {
      title: copy.verdictMaybe,
      body: copy.verdictMaybeBody,
      tone: 'accent' as const,
    };
  }, [commuteAnalysis, copy, job.jhi?.score, remoteRole]);
  const realityToneClasses = {
    success: 'border-emerald-400/26 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.05)]',
    warning: 'border-amber-400/26 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.05)]',
    danger: 'border-rose-400/26 bg-rose-400/10 shadow-[0_0_0_1px_rgba(251,113,133,0.05)]',
    neutral: 'border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.04)]',
  } as const;
  const desiredSalaryMin = Number(userProfile?.preferences?.desired_salary_min || 0);
  const salaryCurrency = String(
    commuteAnalysis?.financialReality.currency
    || (job as any).salary_currency
    || job.aiEstimatedSalary?.currency
    || (language === 'cs' ? 'CZK' : 'EUR')
  );
  const offeredSalaryMin = Number(job.salary_from || job.aiEstimatedSalary?.min || 0);
  const offeredSalaryMax = Number(job.salary_to || job.aiEstimatedSalary?.max || job.salary_from || job.aiEstimatedSalary?.min || 0);
  const salarySignalToneClass = desiredSalaryMin > 0
    ? offeredSalaryMax > 0
      ? offeredSalaryMin >= desiredSalaryMin
        ? realityToneClasses.success
        : realityToneClasses.warning
      : realityToneClasses.danger
    : offeredSalaryMax > 0
      ? realityToneClasses.neutral
      : realityToneClasses.danger;
  const salarySignalCopy = language === 'cs'
    ? {
        label: 'Nabídka vs. tvoje minimum',
        above: 'Nad tvým minimem',
        partial: 'Na hraně tvého minima',
        below: 'Pod tvým minimem',
        missing: 'Mzda chybí',
        profileMissing: 'Minimum nemáš nastavené',
      }
    : language === 'sk'
      ? {
          label: 'Ponuka vs. tvoje minimum',
          above: 'Nad tvojím minimom',
          partial: 'Na hrane tvojho minima',
          below: 'Pod tvojím minimom',
          missing: 'Mzda chýba',
          profileMissing: 'Minimum nemáš nastavené',
        }
      : language === 'de' || language === 'at'
        ? {
            label: 'Angebot vs. dein Minimum',
            above: 'Uber deinem Minimum',
            partial: 'An der Grenze deines Minimums',
            below: 'Unter deinem Minimum',
            missing: 'Keine Gehaltsangabe',
            profileMissing: 'Kein Minimum im Profil',
          }
        : language === 'pl'
          ? {
              label: 'Oferta vs. twoje minimum',
              above: 'Powyżej twojego minimum',
              partial: 'Na granicy twojego minimum',
              below: 'Poniżej twojego minimum',
              missing: 'Brak informacji o pensji',
              profileMissing: 'Nie ustawiono minimum',
            }
          : {
              label: 'Offer vs. your minimum',
              above: 'Above your minimum',
              partial: 'Right around your minimum',
              below: 'Below your minimum',
              missing: 'Salary missing',
              profileMissing: 'No minimum set',
            };
  const salarySignalValue = offeredSalaryMax > 0
    ? offeredSalaryMin > 0 && offeredSalaryMin !== offeredSalaryMax
      ? `${offeredSalaryMin.toLocaleString(locale)} - ${offeredSalaryMax.toLocaleString(locale)} ${salaryCurrency}`
      : `${offeredSalaryMax.toLocaleString(locale)} ${salaryCurrency}`
    : copy.salaryMissing;
  const salarySignalStatus = desiredSalaryMin > 0
    ? offeredSalaryMax <= 0
      ? salarySignalCopy.missing
      : offeredSalaryMin >= desiredSalaryMin
        ? salarySignalCopy.above
        : offeredSalaryMax >= desiredSalaryMin
          ? salarySignalCopy.partial
          : salarySignalCopy.below
    : offeredSalaryMax > 0
      ? salarySignalCopy.profileMissing
      : salarySignalCopy.missing;
  const salarySignalBody = desiredSalaryMin > 0
    ? offeredSalaryMax > 0
      ? `${salarySignalValue} vs. ${desiredSalaryMin.toLocaleString(locale)} ${salaryCurrency}`
      : `${salarySignalCopy.missing} vs. ${desiredSalaryMin.toLocaleString(locale)} ${salaryCurrency}`
    : salarySignalValue;
  const commuteMinutesRoundTrip = remoteRole ? 0 : (commuteAnalysis?.timeMinutes || 0) * 2;
  const commuteTimeToneClass = remoteRole || commuteMinutesRoundTrip <= 90
    ? realityToneClasses.success
    : commuteMinutesRoundTrip >= 180
      ? realityToneClasses.danger
      : realityToneClasses.warning;
  const commuteCostValue = remoteRole ? 0 : Number(commuteAnalysis?.financialReality.commuteCost || 0);
  const commuteCostToneClass = remoteRole || commuteCostValue <= 3000
    ? realityToneClasses.success
    : commuteCostValue >= 10000
      ? realityToneClasses.danger
      : realityToneClasses.warning;
  const benefitsValue = Number(commuteAnalysis?.financialReality.benefitsValue || 0);
  const finalRealValue = Number(commuteAnalysis?.financialReality.finalRealMonthlyValue || 0);
  const monthlyCommuteMinutes = remoteRole ? 0 : commuteMinutesRoundTrip * 22;
  const monthlyCommuteHours = remoteRole ? 0 : Math.round(monthlyCommuteMinutes / 60);
  const monthlyCommuteDays = remoteRole ? 0 : Number((monthlyCommuteHours / 24).toFixed(1));
  const monthlyBenefitShare = finalRealValue > 0
    ? Math.max(0, Math.round((benefitsValue / finalRealValue) * 100))
    : 0;
  const realityNarrative = language === 'cs'
    ? {
        monthlyTime: remoteRole
          ? 'Bez dojíždění. Tenhle čas ti zůstává.'
          : monthlyCommuteHours >= 1
            ? `Tohle je zhruba ${monthlyCommuteHours} hodin měsíčně na cestě${monthlyCommuteDays >= 1 ? `, tedy asi ${monthlyCommuteDays.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dne` : ''}.`
            : 'Dojíždění je zatím nízké a nemělo by ti rozbít týden.',
        benefits: benefitsValue > 0
          ? `Benefity tu přidávají asi ${benefitsValue.toLocaleString(locale)} ${salaryCurrency} měsíčně${monthlyBenefitShare > 0 ? `, zhruba ${monthlyBenefitShare} % výsledné hodnoty` : ''}.`
          : 'Tady benefity skoro nic nepřidávají, rozhoduje hlavně čistá mzda a cesta.',
        takeHome: finalRealValue > 0
          ? `Po započtení cesty ti z role zbývá reálná hodnota kolem ${finalRealValue.toLocaleString(locale)} ${salaryCurrency} měsíčně.`
          : 'Po započtení cesty a reality role tahle nabídka moc nedává ekonomický smysl.',
        monthlyTimeLabel: 'Čas ztracený cestou',
        benefitLabel: 'Co opravdu přidají benefity',
        impactLabel: 'Skutečný měsíční dopad',
        decisionDrivers: 'Z čeho se skládá rozhodnutí',
        decisionScale: 'čím delší bar, tím větší vliv',
        monthlyRoad: 'Měsíčně na cestě',
        benefitValue: 'Hodnota benefitů',
      }
    : {
        monthlyTime: remoteRole
          ? 'No commute here. You keep that time.'
          : monthlyCommuteHours >= 1
            ? `This means about ${monthlyCommuteHours} hours a month on the road${monthlyCommuteDays >= 1 ? `, roughly ${monthlyCommuteDays.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} day${monthlyCommuteDays === 1 ? '' : 's'}` : ''}.`
            : 'Commute impact is low so far.',
        benefits: benefitsValue > 0
          ? `Benefits add about ${benefitsValue.toLocaleString(locale)} ${salaryCurrency} monthly${monthlyBenefitShare > 0 ? `, roughly ${monthlyBenefitShare}% of the resulting value` : ''}.`
          : 'Benefits barely move the needle here.',
        takeHome: finalRealValue > 0
          ? `After commute is counted in, the role lands around ${finalRealValue.toLocaleString(locale)} ${salaryCurrency} per month in real value.`
          : 'After commute and reality costs, this role looks economically weak.',
        monthlyTimeLabel: 'Time lost to commute',
        benefitLabel: 'What benefits really add',
        impactLabel: 'Real monthly impact',
        decisionDrivers: 'What drives the decision',
        decisionScale: 'longer bar = bigger impact',
        monthlyRoad: 'Monthly on the road',
        benefitValue: 'Benefit value',
      };
  const salaryBaselineExplanation = useMemo(() => {
    const financialReality = commuteAnalysis?.financialReality;
    if (!financialReality) return '';

    const currencyCode = financialReality.currency || salaryCurrency;
    const formatMoney = (value: number) => `${Math.round(value).toLocaleString(locale)} ${currencyCode}`;
    const hasUserTaxProfile = Boolean(userProfile.taxProfile);
    const taxSource = hasUserTaxProfile
      ? (language === 'cs' ? 'tvého uloženého daňového profilu' : 'your saved tax profile')
      : (language === 'cs' ? 'výchozího daňového profilu pro danou zemi' : 'the default tax profile for this country');

    if (language === 'cs') {
      if (financialReality.salarySelectionMode === 'ai_estimate') {
        return `Daň i čistá mzda jsou spočtené z ${taxSource}. Odhad je jen vstupní hrubá mzda kolem ${formatMoney(financialReality.grossMonthlySalary)}, protože ji inzerát přesně neuvádí.`;
      }

      if (financialReality.salarySelectionMode === 'lower_bound' && (financialReality.salaryRangeMin || 0) > 0) {
        return `Daň i čistá mzda jsou spočtené z ${taxSource}. Nejistý není výpočet, ale vstupní hrubá mzda: u rozpětí bereme konzervativně spodní hranici ${formatMoney(financialReality.salaryRangeMin || 0)}, ne střed.`;
      }

      if (financialReality.grossMonthlySalary > 0) {
        return `Daň i čistá mzda jsou spočtené z hrubé mzdy ${formatMoney(financialReality.grossMonthlySalary)} podle ${taxSource}.`;
      }

      return 'Tady zatím nemáme dost spolehlivý mzdový vstup pro přesnější vysvětlení.';
    }

    if (financialReality.salarySelectionMode === 'ai_estimate') {
      return `Tax and net pay are calculated from ${taxSource}. The estimate is only the gross-pay input around ${formatMoney(financialReality.grossMonthlySalary)}, because the listing does not state it precisely.`;
    }

    if (financialReality.salarySelectionMode === 'lower_bound' && (financialReality.salaryRangeMin || 0) > 0) {
      return `Tax and net pay are calculated from ${taxSource}. What is uncertain is the gross-pay input: for ranges we use the lower bound ${formatMoney(financialReality.salaryRangeMin || 0)} conservatively, not the midpoint.`;
    }

    if (financialReality.grossMonthlySalary > 0) {
      return `Tax and net pay are calculated from gross pay ${formatMoney(financialReality.grossMonthlySalary)} using ${taxSource}.`;
    }

    return 'There is not enough reliable salary input here for a clearer explanation yet.';
  }, [commuteAnalysis, language, locale, salaryCurrency, userProfile.taxProfile]);
  const jhiImpactExplanation = language === 'cs'
    ? 'Dopad do JHI je teď rozdíl vůči neutrálnímu baseline 50, ne změna proti jiné konkrétní nabídce.'
    : 'JHI impact here is the delta against a neutral baseline of 50, not a change against another specific role.';
  const salaryMathRows = [
    {
      key: 'gross',
      label: language === 'cs' ? 'Hrubá mzda pro výpočet' : 'Gross pay input',
      prefix: '',
      value: commuteAnalysis ? `${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary,
      tone: 'bg-[rgba(9,28,39,0.78)] ring-1 ring-inset ring-cyan-300/12',
    },
    {
      key: 'tax',
      label: language === 'cs' ? 'Daň a odvody' : 'Tax and contributions',
      prefix: '−',
      value: commuteAnalysis ? `${commuteAnalysis.financialReality.estimatedTaxAndInsurance.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—',
      tone: 'bg-[rgba(15,23,33,0.72)] ring-1 ring-inset ring-white/6',
    },
    {
      key: 'net',
      label: language === 'cs' ? 'Čistá mzda' : 'Net pay',
      prefix: '=',
      value: commuteAnalysis ? `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—',
      tone: 'bg-[rgba(10,34,30,0.76)] ring-1 ring-inset ring-emerald-300/12',
    },
    {
      key: 'benefits',
      label: language === 'cs' ? 'Benefity' : 'Benefits',
      prefix: '+',
      value: commuteAnalysis ? `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—',
      tone: 'bg-[rgba(43,33,15,0.72)] ring-1 ring-inset ring-amber-200/10',
    },
    {
      key: 'commute',
      label: language === 'cs' ? 'Dojíždění' : 'Commute',
      prefix: '−',
      value: remoteRole
        ? copy.zeroCost
        : commuteAnalysis
          ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`
          : '—',
      tone: 'bg-[rgba(40,19,31,0.74)] ring-1 ring-inset ring-fuchsia-300/10',
    },
    {
      key: 'total',
      label: language === 'cs' ? 'Skutečná měsíční hodnota' : 'Real monthly value',
      prefix: '=',
      value: commuteAnalysis ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary,
      tone: 'bg-[rgba(8,34,46,0.9)] ring-1 ring-inset ring-cyan-200/14',
    },
  ];
  const jhiHeroMetrics = [
    {
      key: 'score',
      label: copy.compatibility,
      value: `${Math.round(job.jhi?.score || 0)}`,
      tone: 'bg-[rgba(9,28,39,0.78)] ring-1 ring-inset ring-cyan-300/12',
    },
    {
      key: 'impact',
      label: copy.jhiImpact,
      value: commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—',
      tone: 'bg-[rgba(10,34,30,0.76)] ring-1 ring-inset ring-emerald-300/12',
    },
  ];
  const dimensionBarToneClass = (value: number): string => (
    value >= 72
      ? 'bg-emerald-400/85'
      : value < 45
        ? 'bg-rose-400/85'
        : 'bg-amber-300/85'
  );
  const commuteTrackPercent = remoteRole
    ? 12
    : Math.max(14, Math.min(92, Math.round((commuteMinutesRoundTrip / 220) * 100)));
  const dashboardPanelClass = 'rounded-[30px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,252,0.98)_100%)] text-[var(--text-strong)] shadow-[0_28px_72px_-44px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-[rgba(125,211,252,0.08)] dark:bg-[linear-gradient(180deg,rgba(7,12,20,0.98)_0%,rgba(9,13,21,0.99)_100%)] dark:shadow-[0_24px_56px_-42px_rgba(0,0,0,0.52)]';
  const decisionBandToneClass = decisionVerdict.tone === 'success'
    ? 'border-emerald-300/12 shadow-[0_18px_36px_-30px_rgba(0,0,0,0.34)]'
    : decisionVerdict.tone === 'warning'
      ? 'border-fuchsia-300/12 shadow-[0_18px_36px_-30px_rgba(0,0,0,0.34)]'
      : 'border-cyan-300/12 shadow-[0_18px_36px_-30px_rgba(0,0,0,0.34)]';
  const dashboardCardClass = 'rounded-[20px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.9)] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] dark:border-[rgba(255,255,255,0.05)] dark:bg-[rgba(15,21,31,0.82)] dark:shadow-[0_16px_32px_-28px_rgba(0,0,0,0.42)]';
  const cyberPanelClass = 'dark:border-[rgba(255,255,255,0.05)] dark:bg-[rgba(15,22,34,0.74)] dark:shadow-[0_16px_32px_-28px_rgba(0,0,0,0.32)]';
  const cyberPanelStrongClass = 'dark:border-[rgba(255,255,255,0.06)] dark:bg-[rgba(14,23,35,0.88)] dark:shadow-[0_18px_36px_-30px_rgba(0,0,0,0.38)]';
  const cyberInfoClass = 'dark:border-[rgba(255,255,255,0.06)] dark:bg-[rgba(14,22,34,0.82)]';
  const cyberChartShellClass = 'dark:border-[rgba(255,255,255,0.05)] dark:bg-[rgba(10,16,26,0.78)]';
  const importedHeroGlassClass = 'dark:border-[rgba(34,211,238,0.12)] dark:bg-[linear-gradient(180deg,rgba(16,25,40,0.56)_0%,rgba(9,16,28,0.42)_100%)] dark:shadow-[0_22px_50px_-36px_rgba(34,211,238,0.16)]';
  const importedChipClass = 'dark:border-[rgba(34,211,238,0.14)] dark:bg-[rgba(34,211,238,0.08)] dark:text-cyan-50';
  const importedAccentCardClass = 'dark:border-[rgba(34,211,238,0.14)] dark:bg-[linear-gradient(180deg,rgba(17,31,48,0.82)_0%,rgba(10,18,30,0.78)_100%)] dark:shadow-[0_22px_48px_-36px_rgba(34,211,238,0.18)]';
  const importedTextPanelClass = 'dark:border-[rgba(244,114,182,0.12)] dark:bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.08),transparent_28%),linear-gradient(180deg,rgba(14,21,34,0.88)_0%,rgba(9,14,24,0.82)_100%)] dark:shadow-[0_24px_54px_-40px_rgba(236,72,153,0.18)]';
  const renderSharedRealityBand = ({
    headline,
    subheadline,
    body,
    showChips = false,
    showCommuteTrack = false,
  }: {
    headline: string;
    subheadline: string;
    body: string;
    showChips?: boolean;
    showCommuteTrack?: boolean;
  }) => (
    <div className={cn('rounded-[24px] border bg-[linear-gradient(180deg,#0a1320_0%,#0d1724_100%)] p-5 text-slate-50', decisionBandToneClass)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[38rem]">
          <div className="text-[11px] font-medium tracking-[0.08em] text-cyan-200/88">
            {language === 'cs' ? 'Skutečná měsíční hodnota role' : 'Real monthly role value'}
          </div>
          <div className={cn('mt-2 font-semibold tracking-[-0.03em]', isImported ? 'text-3xl sm:text-4xl tracking-[-0.05em] text-white' : 'text-base')}>
            {headline}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200/92">{subheadline}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300/84">{body}</p>
          {commuteAnalysis ? (
            <div className={cn('mt-3 rounded-[16px] border px-4 py-3 text-sm leading-6 text-slate-100', cyberInfoClass)}>
              <div>{salaryBaselineExplanation}</div>
              <div className="mt-2 text-[12px] leading-5 text-slate-300/76">{jhiImpactExplanation}</div>
            </div>
          ) : null}
        </div>

        {showChips ? (
          <div className="flex flex-wrap items-center gap-2">
            {matchScore > 0 ? (
              <div className={cn('rounded-[999px] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] ring-1 ring-inset', aiToneStyles.chip)}>
                {matchScore}% {copy.match}
              </div>
            ) : null}
            <div className="rounded-[999px] border border-[rgba(15,23,42,0.08)] bg-white px-3.5 py-2 text-xs font-bold text-[var(--text-strong)] shadow-[0_12px_24px_-18px_rgba(15,23,42,0.16)] dark:border-[rgba(148,163,184,0.12)] dark:bg-[rgba(15,23,42,0.82)]">
              {decisionVerdict.title}
            </div>
          </div>
        ) : null}
      </div>

      {commuteAnalysis ? (
        <div className="mt-5">
          <div className="mb-4 h-px w-full bg-gradient-to-r from-cyan-200/18 to-transparent" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className={cn('rounded-[20px] p-4', cyberPanelStrongClass)}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium tracking-[0.06em] text-cyan-100/82">
                  {language === 'cs' ? 'Výpočet hodnoty role' : 'Role value calculation'}
                </div>
                <div className="text-xs text-slate-400/72">
                  {language === 'cs' ? 'krok po kroku' : 'step by step'}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {salaryMathRows.map((row) => (
                  <div key={`salary-${row.key}`} className={cn('rounded-[16px] px-4 py-3', row.tone)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-lg font-black leading-none text-white/90">{row.prefix || '·'}</span>
                        <div className="text-sm font-medium text-slate-100">{row.label}</div>
                      </div>
                      <div className="text-right text-lg font-semibold tracking-[-0.03em] text-white">{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] border border-[rgba(255,255,255,0.05)] bg-[rgba(18,22,37,0.88)] p-4 shadow-[0_18px_36px_-30px_rgba(0,0,0,0.34)]">
              <div className="text-xs font-medium tracking-[0.06em] text-fuchsia-100/82">{language === 'cs' ? 'Job Happiness Index' : 'Job Happiness Index'}</div>
              <div className="mt-1.5 max-w-[28rem] text-sm leading-6 text-slate-300/78">{jhiImpactExplanation}</div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {jhiHeroMetrics.map((metric) => (
                  <div key={`jhi-${metric.key}`} className={cn('rounded-[16px] px-3.5 py-3', metric.tone)}>
                    <div className="text-xs font-medium tracking-[0.04em] text-slate-200/82">{metric.label}</div>
                    <div className="mt-1.5 text-[1.7rem] font-semibold tracking-[-0.05em] text-white">{metric.value}</div>
                  </div>
                ))}
              </div>
              <div className={cn('mt-3 rounded-[16px] p-2.5', cyberChartShellClass)}>
                <div className="mx-auto max-w-[240px] opacity-90">
                  <JHIChart jhi={job.jhi} theme="light" accent={aiToneStyles.chartAccent} compact />
                </div>
              </div>
              <div className="mt-3 grid gap-2.5">
                {jhiDimensions.map((dimension) => (
                  <div key={`dimension-${dimension.key}`} className="rounded-[16px] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5 ring-1 ring-inset ring-white/6">
                    <div className="text-[12px] text-slate-200/84">{dimension.label}</div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <span className="text-sm font-semibold text-white">{Math.round(dimension.value)}/100</span>
                      <span className="h-2 w-20 overflow-hidden rounded-full bg-white/10">
                        <span
                          className={cn('block h-full rounded-full', dimensionBarToneClass(dimension.value))}
                          style={{ width: `${Math.max(8, Math.min(100, Math.round(dimension.value)))}%` }}
                        />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showCommuteTrack ? (
            <>
              <div className="mt-5 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300/82">
                <span>{copy.currentLocation}</span>
                <span>{remoteRole ? copy.remoteReality : `${remoteRole ? 0 : commuteAnalysis?.distanceKm || 0} km`}</span>
                <span>{job.company}</span>
              </div>
              <div className="relative mt-3 h-2 rounded-full bg-slate-800/90">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-rose-400"
                  style={{ width: `${commuteTrackPercent}%` }}
                />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white/70 bg-white shadow-[0_8px_18px_-10px_rgba(255,255,255,0.5)]"
                  style={{ left: `calc(${commuteTrackPercent}% - 8px)` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-cyan-400/10 bg-cyan-400/[0.04] px-4 py-4 shadow-[0_18px_40px_-34px_rgba(34,211,238,0.18)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/82">{copy.commuteTime}</div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.04em]">{remoteRole ? '0 min' : `${commuteAnalysis.timeMinutes * 2} min`}</div>
                </div>
                <div className="rounded-[20px] border border-fuchsia-400/10 bg-fuchsia-400/[0.04] px-4 py-4 shadow-[0_18px_40px_-34px_rgba(244,114,182,0.18)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100/82">{copy.oneWay}</div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.04em]">{remoteRole ? '0 km' : `${commuteAnalysis.distanceKm} km`}</div>
                </div>
                <div className="rounded-[20px] border border-emerald-400/10 bg-emerald-400/[0.04] px-4 py-4 shadow-[0_18px_40px_-34px_rgba(16,185,129,0.18)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/82">{copy.commuteCost}</div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.04em]">{remoteRole ? copy.zeroCost : `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const aiToneStyles = decisionVerdict.tone === 'success'
      ? {
        panel: 'border-emerald-500/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,251,248,0.82)_100%)] shadow-[0_24px_56px_-36px_rgba(16,32,51,0.14)] dark:border-cyan-400/14 dark:bg-[linear-gradient(180deg,#131d29_0%,#0d1520_100%)] dark:shadow-[0_28px_60px_-36px_rgba(34,211,238,0.14)]',
        chip: 'border border-cyan-500/16 bg-slate-950 text-cyan-50 ring-cyan-400/16 shadow-[0_10px_24px_-18px_rgba(34,211,238,0.35)] dark:bg-slate-900',
        soft: 'border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.9)] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] dark:border-[rgba(148,163,184,0.14)] dark:bg-[rgba(15,23,42,0.78)]',
        label: 'text-slate-500 dark:text-slate-300',
        chartAccent: 'cyan' as const,
        bar: 'bg-cyan-400/80 dark:bg-cyan-300/80',
      }
    : decisionVerdict.tone === 'warning'
      ? {
          panel: 'border-amber-500/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(252,248,243,0.82)_100%)] shadow-[0_24px_56px_-36px_rgba(16,32,51,0.14)] dark:border-cyan-400/14 dark:bg-[linear-gradient(180deg,#19151b_0%,#0d1520_100%)] dark:shadow-[0_28px_60px_-36px_rgba(244,63,94,0.12)]',
          chip: 'border border-cyan-500/16 bg-slate-950 text-cyan-50 ring-cyan-400/16 shadow-[0_10px_24px_-18px_rgba(34,211,238,0.35)] dark:bg-slate-900',
          soft: 'border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.9)] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] dark:border-[rgba(148,163,184,0.14)] dark:bg-[rgba(15,23,42,0.78)]',
          label: 'text-slate-500 dark:text-slate-300',
          chartAccent: 'cyan' as const,
          bar: 'bg-cyan-400/80 dark:bg-cyan-300/80',
        }
      : {
          panel: 'border-[rgba(var(--accent-rgb),0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(243,249,252,0.82)_100%)] shadow-[0_24px_56px_-36px_rgba(16,32,51,0.14)] dark:border-cyan-400/14 dark:bg-[linear-gradient(180deg,#151b23_0%,#0d1520_100%)] dark:shadow-[0_28px_60px_-36px_rgba(34,211,238,0.12)]',
          chip: 'border border-cyan-500/16 bg-slate-950 text-cyan-50 ring-cyan-400/16 shadow-[0_10px_24px_-18px_rgba(34,211,238,0.35)] dark:bg-slate-900',
          soft: 'border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.9)] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] dark:border-[rgba(148,163,184,0.14)] dark:bg-[rgba(15,23,42,0.78)]',
          label: 'text-slate-500 dark:text-slate-300',
          chartAccent: 'cyan' as const,
          bar: 'bg-cyan-400/80 dark:bg-cyan-300/80',
        };
  const sharedRealityHeadline = isImported
    ? commuteAnalysis
      ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`
      : displayedSalary
    : decisionVerdict.title;
  const sharedRealitySubheadline = isImported ? importedRealityLead : decisionVerdict.body;
  const sharedRealityBody = commuteAnalysis
    ? copy.financialFormula
        .replace('{{net}}', `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
        .replace('{{benefits}}', `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
        .replace('{{commute}}', `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
        .replace('{{total}}', `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
    : isImported
      ? copy.financialBody
      : decisionVerdict.body;
  const canShowSharedCommuteTrack = Boolean(!isImported && !isMicroJobRole && userProfile.isLoggedIn && (userProfile.address || userProfile.coordinates || remoteRole));
  const realityPanel = (
    <SurfaceCard className={cn('border-transparent p-5 text-[var(--text-strong)] sm:p-6', dashboardPanelClass)} variant="dock">
      <div className="space-y-5">
        <SectionTitle title={copy.financialTitle} />

        <div className="grid gap-4">
          <div className="space-y-4">
            {renderSharedRealityBand({
              headline: sharedRealityHeadline,
              subheadline: sharedRealitySubheadline,
              body: sharedRealityBody,
              showChips: !isImported,
              showCommuteTrack: canShowSharedCommuteTrack,
            })}

            {isMicroJobRole ? (
              <div className={cn('px-4 py-4 text-sm leading-6', dashboardCardClass)}>
                {copy.financialNoteBody}
              </div>
            ) : !userProfile.isLoggedIn ? (
              <div className={cn('px-4 py-4', dashboardCardClass)}>
                <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.loginPrompt}</p>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="app-button-primary mt-4 inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold"
                >
                  {copy.signInCreate}
                </button>
              </div>
            ) : (!userProfile.address && !userProfile.coordinates && !remoteRole) ? (
              <div className={cn('px-4 py-4', dashboardCardClass)}>
                <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.addressPrompt}</p>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="app-button-dock mt-4 inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold"
                >
                  {copy.openProfile}
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                  <div className={cn('rounded-[20px] border px-4 py-4', dashboardCardClass, cyberPanelClass)}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                      {language === 'cs' ? 'Rychlý reality check' : 'Quick reality check'}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      {language === 'cs'
                        ? 'Tady už nejsou další výpočty. Jen tři stručné signály, které pomáhají rychle rozhodnout, jestli se rolí dál zabývat.'
                        : 'No more repeated math here. Just three short signals that help you decide whether this role is worth more attention.'}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className={cn('rounded-[16px] border px-3.5 py-3', salarySignalToneClass)}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{salarySignalCopy.label}</div>
                        <div className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{salarySignalStatus}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{salarySignalBody}</div>
                      </div>
                      <div className={cn('rounded-[16px] border px-3.5 py-3', commuteTimeToneClass)}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{realityNarrative.monthlyRoad}</div>
                        <div className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                          {remoteRole ? (language === 'cs' ? '0 hodin' : '0 hours') : `${monthlyCommuteHours} h`}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{realityNarrative.monthlyTime}</div>
                      </div>
                      <div className={cn('rounded-[16px] border px-3.5 py-3', commuteCostToneClass)}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{realityNarrative.benefitValue}</div>
                        <div className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                          {benefitsValue > 0 ? `${benefitsValue.toLocaleString(locale)} ${salaryCurrency}` : '—'}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{realityNarrative.benefits}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {bullshitAnalysis.signals.length > 0 ? (
                      <div className="rounded-[20px] border border-rose-200 bg-rose-50/88 px-4 py-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">{copy.bullshitTitle}</div>
                        <div className="mt-2 text-sm font-semibold text-rose-900 dark:text-rose-100">
                          {bullshitAnalysis.tone === 'bullshit'
                            ? `${copy.bullshitSmells} (${bullshitAnalysis.score}/${bullshitAnalysis.maxScore})`
                            : `${copy.bullshitWatch} (${bullshitAnalysis.score}/${bullshitAnalysis.maxScore})`}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-rose-800 dark:text-rose-100/90">{bullshitAnalysis.summary}</div>
                      </div>
                    ) : null}

                    {bullshitAnalysis.greenFlags.length > 0 ? (
                      <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/88 px-4 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{copy.greenTitle}</div>
                        <div className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">{copy.greenSubtitle}</div>
                        <div className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-100/90">{bullshitAnalysis.greenSummary}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </SurfaceCard>
  );
  return (
    <>
      <section className="app-shell-bg app-shell-bg-clean relative isolate min-h-[calc(100dvh-var(--app-header-height))] overflow-hidden">
        <div className="mx-auto w-full max-w-[1520px] space-y-5 px-3 py-4 pb-8 lg:px-4">
        <button
          type="button"
          onClick={onBack}
          className="app-button-dock inline-flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-sm font-medium"
        >
          <ArrowLeft size={16} />
          {copy.back}
        </button>

        <div className="app-workspace-stage overflow-hidden rounded-[30px] p-2.5 sm:p-3">
          <div className="relative min-h-[300px] overflow-hidden rounded-[24px] bg-[rgba(255,255,255,0.18)] dark:bg-[rgba(8,14,22,0.4)] sm:min-h-[340px] lg:min-h-[380px]">
            <img
              src={coverImageUrl}
              alt={job.company}
              className="pointer-events-none absolute inset-0 h-full w-full scale-[1.02] object-cover opacity-[0.62] saturate-[1.02]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(var(--accent-rgb),0.14),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(var(--accent-gold-rgb),0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.18))] dark:bg-[radial-gradient(circle_at_12%_18%,rgba(var(--accent-rgb),0.18),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(var(--accent-gold-rgb),0.12),transparent_24%),linear-gradient(180deg,rgba(5,9,14,0.08),rgba(5,9,14,0.42))]" />
            <div className="relative flex h-full min-h-[300px] flex-col justify-between p-5 sm:min-h-[340px] sm:p-6 lg:min-h-[380px] lg:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-[999px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-strong)] backdrop-blur-xl">
                    <Sparkles size={12} />
                    {listingBadge}
                  </span>
                  {matchScore > 0 ? (
                    <span className={cn(
                      'inline-flex items-center gap-2 rounded-[999px] border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] backdrop-blur-xl',
                      isImported
                        ? 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.08)] text-[var(--text-strong)]'
                        : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.08)] text-[var(--text-strong)]'
                    )}>
                      <Sparkles size={11} />
                      {matchScore}% {copy.matchUpper}
                    </span>
                  ) : null}
                  {domainAccent ? (
                    <Badge variant="outline" className="border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.08)] text-[var(--text-strong)] backdrop-blur-xl">
                      {language === 'cs' || language === 'sk' ? domainAccent.label.cs : domainAccent.label.en}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className={cn('space-y-4 rounded-[24px] bg-[rgba(255,255,255,0.56)] p-4 backdrop-blur-xl dark:bg-[rgba(9,16,24,0.34)] sm:p-5', isImported && importedHeroGlassClass)}>
                  <div className="inline-flex max-w-full items-center gap-3 px-0.5 py-0.5">
                    {usePublisherMonogram ? (
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-[10px] text-sm font-bold ring-1',
                        'bg-[rgba(255,255,255,0.1)] text-[var(--text-strong)] ring-[rgba(255,255,255,0.12)]'
                      )}>
                        {publisherInitials}
                      </div>
                    ) : (
                      <img
                        src={publisherAvatar}
                        alt={publisherName}
                        className="h-12 w-12 rounded-[10px] object-cover ring-1 ring-[rgba(255,255,255,0.12)]"
                        loading="lazy"
                      />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-strong)]">{publisherName}</div>
                      <div className="text-sm text-[var(--text-muted)]">{publisherRole}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h1 className="max-w-4xl text-[1.95rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-strong)] sm:text-[2.35rem] lg:text-[2.75rem]">
                      {job.title}
                    </h1>
                    <div className="inline-flex max-w-2xl px-0.5 py-0.5">
                      <p className="text-sm leading-6 text-[var(--text)] sm:text-base">
                        {heroLead}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    <div className={cn('min-w-0 rounded-[16px] bg-[rgba(255,255,255,0.68)] px-3.5 py-3 dark:bg-[rgba(255,255,255,0.05)]', isImported && importedChipClass)}>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        <MapPin size={13} />
                        {copy.location}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-[var(--text-strong)]">
                        {locationValue}
                      </div>
                    </div>
                    <div className={cn('min-w-0 rounded-[16px] bg-[rgba(255,255,255,0.68)] px-3.5 py-3 dark:bg-[rgba(255,255,255,0.05)]', isImported && importedChipClass)}>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        <Compass size={13} />
                        {copy.workModel}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-[var(--text-strong)]">
                        {workModelValue}
                      </div>
                    </div>
                    <div className={cn('min-w-0 rounded-[16px] bg-[rgba(255,255,255,0.68)] px-3.5 py-3 dark:bg-[rgba(255,255,255,0.05)]', isImported && importedChipClass)}>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        <Wallet size={13} />
                        {copy.salary}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-[var(--text-strong)]">
                        {displayedSalary}
                      </div>
                    </div>
                  </div>

                  {!isImported ? (
                    <div className="flex flex-wrap gap-3 pt-1">
                      <a
                        href="#challenge-handshake"
                        className="app-button-primary inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold"
                      >
                        <Handshake size={15} />
                        {copy.handshakeCta}
                      </a>
                      {job.company_id ? (
                        <button
                          type="button"
                          onClick={() => onOpenCompanyPage(job.company_id!)}
                          className="app-button-dock inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold"
                        >
                          <Compass size={15} />
                          {copy.companyCta}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-[20px] border border-[rgba(var(--accent-rgb),0.14)] bg-[rgba(var(--accent-rgb),0.05)] p-4 dark:bg-[rgba(var(--accent-rgb),0.11)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                            {signalBoostCopy.eyebrow}
                          </div>
                          <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-strong)] dark:bg-slate-950/60">
                            {signalBoostCopy.aiBadge}
                          </span>
                        </div>
                        <div className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                          {signalBoostCopy.title}
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                          {signalBoostCopy.body}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[var(--text-strong)] dark:bg-slate-950/60">
                            {signalBoostCopy.stepOne}
                          </div>
                          <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[var(--text-strong)] dark:bg-slate-950/60">
                            {signalBoostCopy.stepTwo}
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-white/85 px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] dark:bg-slate-950/65">
                        {signalBoostCopy.timebox}
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleOpenSignalBoost}
                        className="app-button-primary inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold whitespace-normal text-left"
                      >
                        <Sparkles size={15} />
                        {signalBoostCopy.cta}
                      </button>
                      {isImported ? (
                        <button
                          type="button"
                          onClick={onOpenImportedListing}
                          className="app-button-secondary inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold whitespace-normal text-left"
                        >
                          <ExternalLink size={15} />
                          {copy.importedButton}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {companyGalleryImages.length ? (
                    <div className="grid items-stretch gap-3 pt-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)]">
                      <div className="relative min-h-[14rem] overflow-hidden rounded-[22px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] shadow-[0_24px_60px_-40px_rgba(15,23,42,0.46)] backdrop-blur-xl">
                        <div
                          role="img"
                          aria-label={`${job.company} gallery`}
                          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                          style={{ backgroundImage: `url("${companyGalleryImages[0]}")` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/4 to-transparent" />
                      </div>

                      <div className="grid min-h-[14rem] gap-3 sm:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
                        {companyGalleryImages.slice(1).map((imageUrl, index) => (
                          <div
                            key={imageUrl}
                            className="relative min-h-[6.7rem] overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] shadow-[0_20px_48px_-36px_rgba(15,23,42,0.42)] backdrop-blur-xl"
                          >
                            <div
                              role="img"
                              aria-label={`${job.company} gallery ${index + 2}`}
                              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                              style={{ backgroundImage: `url("${imageUrl}")` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-black/3 to-transparent" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="self-end rounded-[22px] bg-[rgba(255,255,255,0.58)] p-4 text-[var(--text-strong)] backdrop-blur-xl dark:bg-[rgba(9,16,24,0.34)]">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {companyStoryLabels.about}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--text)]">
                        {companyIntro}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-[16px] bg-[rgba(255,255,255,0.68)] px-4 py-4 dark:bg-[rgba(255,255,255,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.philosophy}</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--text-strong)]">{companyPhilosophy}</div>
                      </div>
                      <div className="rounded-[16px] bg-[rgba(255,255,255,0.68)] px-4 py-4 dark:bg-[rgba(255,255,255,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.environment}</div>
                        <div className="mt-2 space-y-2 text-sm text-[var(--text-strong)]">
                          {companyIndustry ? <div>{companyStoryLabels.industry}: {companyIndustry}</div> : null}
                          {companyTone ? <div>{companyTone}</div> : null}
                          {companyWebsiteLabel ? <div>{companyStoryLabels.website}: {companyWebsiteLabel}</div> : null}
                          {companyIdentityFacts.map((fact) => <div key={fact}>{fact}</div>)}
                        </div>
                      </div>
                    </div>

                    {companyValues.length ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.values}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {companyValues.map((value) => (
                            <span
                              key={value}
                              className="inline-flex items-center rounded-[999px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-strong)]"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {trustLabels.length ? (
                      <div className="rounded-[16px] bg-[rgba(255,255,255,0.68)] px-4 py-4 dark:bg-[rgba(255,255,255,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.teamPulse}</div>
                        <div className="mt-2 space-y-2 text-sm leading-6 text-[var(--text)]">
                          {trustLabels.map((label) => (
                            <div key={label}>{label}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1480px]">
          {realityPanel}
        </div>

        <div className="mx-auto w-full max-w-[1480px]">
          <div className="space-y-5">
            {isImported && importedOriginalDescription ? (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-strong)]">{importedOriginalListingTitle}</h2>
                </div>
                <div className={cn('rounded-[16px] border border-[rgba(191,161,106,0.12)] bg-white/4 p-6 dark:bg-slate-950/40', importedTextPanelClass)}>
                  <p className="whitespace-pre-wrap text-base leading-8 text-[var(--text-base)]">{importedOriginalDescription}</p>
                </div>
              </div>
            ) : null}

            {!isImported ? (
              <div id="challenge-handshake">
                <SurfaceCard className="space-y-5 rounded-[24px] p-5 sm:p-6" variant="dock">
                  <SectionTitle title={copy.handshakeTitle} />
                  <ChallengeComposer
                    job={job}
                    userProfile={userProfile}
                    onRequireAuth={onRequireAuth}
                    onOpenSupportingContext={onOpenSupportingContext}
                  />
                </SurfaceCard>
              </div>
            ) : null}

            {!isImported ? (
            <SurfaceCard className={cn('border-transparent p-5 sm:p-6', dashboardPanelClass)} variant="dock">
              <div className="space-y-5">
                <SectionTitle title={insideSectionTitle} />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    {isImported ? (
                      <>
                        {importedStory.companyContext ? (
                          <div className={cn('p-5', dashboardCardClass, importedAccentCardClass)}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                              {importedSummaryLabels.companyContext}
                            </div>
                            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{importedStory.companyContext}</p>
                          </div>
                        ) : null}

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className={cn('p-4', dashboardCardClass, cyberPanelClass)}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.importedSnapshot}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{importedRoleSnapshot}</div>
                          </div>
                          {importedQuickFacts.length ? (
                            <div className={cn('p-4', dashboardCardClass, cyberPanelClass)}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{importedSummaryLabels.quickFacts}</div>
                              <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text)]">
                                {importedQuickFacts.map((fact) => (
                                  <div key={fact}>{fact}</div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-cyan-400/16 bg-[rgba(var(--accent-rgb),0.06)] px-4 py-4 dark:bg-[linear-gradient(180deg,rgba(12,31,43,0.8)_0%,rgba(7,21,34,0.76)_100%)] dark:shadow-[0_20px_44px_-34px_rgba(34,211,238,0.16)]">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{importedSummaryLabels.decision}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--text)]">{importedFirstStep}</div>
                          </div>
                          {importedRisk ? (
                            <div className={cn('rounded-[18px] px-4 py-4', dashboardCardClass, importedTextPanelClass)}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.risk}</div>
                              <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{importedRisk}</div>
                            </div>
                          ) : null}
                        </div>

                        {importedStory.benefits.length ? (
                          <div className={cn('p-4', dashboardCardClass, importedAccentCardClass)}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{importedSummaryLabels.benefits}</div>
                            <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text)]">
                              {importedStory.benefits.map((benefit) => (
                                <div key={benefit}>{benefit}</div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className={cn('p-5', dashboardCardClass)}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                            {companyStoryLabels.about}
                          </div>
                          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{companyIntro}</p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className={cn('p-4', dashboardCardClass)}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.philosophy}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--text)]">{companyPhilosophy}</div>
                          </div>
                          <div className={cn('p-4', dashboardCardClass)}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.mission}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{missionBody}</div>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] px-4 py-4 dark:bg-[rgba(var(--accent-rgb),0.12)]">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.firstStep}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--text)]">{firstStep || challenge.firstStepPrompt}</div>
                          </div>
                          {riskBody ? (
                            <div className={cn('rounded-[18px] px-4 py-4', dashboardCardClass)}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.risk}</div>
                              <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{riskBody}</div>
                            </div>
                          ) : null}
                        </div>

                        {companyValues.length || companyBenefits.length ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {companyValues.length ? (
                              <div className={cn('p-4', dashboardCardClass)}>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.values}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {companyValues.map((value) => (
                                    <span
                                      key={value}
                                      className="inline-flex items-center rounded-[999px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-strong)]"
                                    >
                                      {value}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {companyBenefits.length ? (
                              <div className={cn('p-4', dashboardCardClass)}>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.benefits}</div>
                                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text)]">
                                  {companyBenefits.map((benefit) => (
                                    <div key={benefit}>{benefit}</div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className={cn('p-4', dashboardCardClass, cyberPanelClass)}>
                      <div className="flex items-center gap-3">
                        {usePublisherMonogram ? (
                          <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.82)] text-sm font-bold text-[var(--text-strong)] dark:border-[rgba(148,163,184,0.14)] dark:bg-[rgba(255,255,255,0.06)]">
                            {publisherInitials}
                          </div>
                        ) : (
                          <img src={publisherAvatar} alt={publisherName} className="h-14 w-14 rounded-[14px] border border-[rgba(15,23,42,0.08)] object-cover dark:border-[rgba(148,163,184,0.14)]" loading="lazy" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text-strong)]">{publisherName}</div>
                          <div className="text-sm text-[var(--text-muted)]">{publisherRole}</div>
                        </div>
                      </div>
                      {publisher?.short_context ? (
                        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{publisher.short_context}</p>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{publisherFallbackCopy}</p>
                      )}
                    </div>

                    <div className={cn('p-4', dashboardCardClass, isImported ? importedTextPanelClass : cyberPanelClass)}>
                      {isImported ? (
                        <>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.importedDetail}</div>
                          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{importedStoryLabels.sourceNote}</p>
                          {bullshitAnalysis.signals.length ? (
                            <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--text)]">
                              {bullshitAnalysis.signals.slice(0, 2).map((flag: string) => (
                                <div key={flag}>• {flag}</div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.environment}</div>
                          <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text)]">
                            {companyIndustry ? <div>{companyStoryLabels.industry}: {companyIndustry}</div> : null}
                            {companyTone ? <div>{companyTone}</div> : null}
                            {companyWebsiteLabel ? <div>{companyStoryLabels.website}: {companyWebsiteLabel}</div> : null}
                            {companyIdentityFacts.map((fact) => <div key={fact}>{fact}</div>)}
                          </div>
                        </>
                      )}
                    </div>

                    <ChallengeHumanContextSection
                      humanContext={humanContext}
                      trustLabels={trustLabels}
                      copy={{
                        publisherLabel: copy.publisher,
                        respondersLabel: copy.responders,
                        teamTrustLabel: copy.trust,
                        humanContextFallbackRole: copy.teamFallbackRole,
                      }}
                    />
                  </div>
                </div>
              </div>
            </SurfaceCard>
            ) : null}

        </div>
          </div>
        </div>
      </section>
      {userProfile.isLoggedIn ? (
        <SignalBoostModal
          isOpen={isSignalBoostOpen}
          job={job}
          userProfile={userProfile}
          onClose={() => setIsSignalBoostOpen(false)}
        />
      ) : null}
    </>
  );
};

export default ChallengeDetailPage;

