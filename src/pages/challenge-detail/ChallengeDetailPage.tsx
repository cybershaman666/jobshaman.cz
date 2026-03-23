import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Compass, Handshake, MapPin, Sparkles, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, SurfaceCard, cn } from '../../../components/ui/primitives';
import type { CommuteAnalysis, Job, JobHumanContext, JobPublicPerson, UserProfile } from '../../../types';
import ChallengeComposer from '../../../components/challenges/ChallengeComposer';
import FormattedJobDescription from '../../../components/challenges/FormattedJobDescription';
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
import { formatJobDescription } from '../../../utils/formatters';
import { getChallengeDetailPageCopy } from '../../../components/challenges/challengeDetailCopy';

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
  const locale = String(i18n.resolvedLanguage || i18n.language || userProfile?.preferredLocale || 'en');
  const challenge = useMemo(() => adaptJobToChallenge(job), [job]);
  const language = locale.split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';
  const isImported = job.listingKind === 'imported';
  const isMicroJobRole = job.challenge_format === 'micro_job';
  const isNativeChallenge = !isImported && Boolean(job.company_id) && String(job.source || '').trim().toLowerCase() === 'jobshaman.cz';
  const remoteRole = isRemoteJob(job);
  const publisher: JobPublicPerson | null = humanContext?.publisher || null;

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
    () => getStockGalleryForDomain(effectiveDomain, `${job.company || ''}-${job.id || ''}-${job.title || ''}`, 3),
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
    ])).slice(0, 3),
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
  const formattedDescription = useMemo(() => formatJobDescription(job.description || ''), [job.description]);
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
  const companyIntro = String(job.companyProfile?.description || '').trim()
    || String(job.companyProfile?.philosophy || '').trim()
    || String(job.companyGoal || '').trim()
    || missionBody;
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
  const jhiDimensions = [
    { key: 'financial', label: copy.jhiDimensionFinancial, value: Number(job.jhi?.financial || 0) },
    { key: 'timeCost', label: copy.jhiDimensionTimeCost, value: Number(job.jhi?.timeCost || 0) },
    { key: 'mentalLoad', label: copy.jhiDimensionMentalLoad, value: Number(job.jhi?.mentalLoad || 0) },
    { key: 'growth', label: copy.jhiDimensionGrowth, value: Number(job.jhi?.growth || 0) },
    { key: 'values', label: copy.jhiDimensionValues, value: Number(job.jhi?.values || 0) },
  ]
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((left, right) => right.value - left.value);
  const aiRealitySummary = useMemo(() => {
    const takeHome = commuteAnalysis
      ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`
      : displayedSalary;
    const time = remoteRole
      ? '0 min'
      : commuteAnalysis
        ? `${commuteAnalysis.timeMinutes * 2} min`
        : copy.unknownTime;
    const cost = remoteRole
      ? copy.zeroCost
      : commuteAnalysis
        ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`
        : copy.unknownCost;
    const score = Math.round(job.jhi?.score || 0);
    const jhiLabel = score >= 72 ? copy.jhiGood : score >= 55 ? copy.jhiMixed : copy.jhiLow;
    return copy.aiWandSummary
      .replace('{{takeHome}}', takeHome)
      .replace('{{time}}', time)
      .replace('{{cost}}', cost)
      .replace('{{jhi}}', `${jhiLabel} (${score}/100)`);
  }, [commuteAnalysis, copy, displayedSalary, job.jhi?.score, locale, remoteRole]);
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
  const takeHomeToneClass = !commuteAnalysis
    ? realityToneClasses.neutral
    : Number(commuteAnalysis.financialReality.finalRealMonthlyValue || 0) > 0
      ? realityToneClasses.success
      : Number(commuteAnalysis.financialReality.finalRealMonthlyValue || 0) < 0
        ? realityToneClasses.danger
        : realityToneClasses.warning;
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
  const realValueToneClass = takeHomeToneClass;
  const dimensionToneClass = (value: number): string => (
    value >= 72
      ? realityToneClasses.success
      : value < 45
        ? realityToneClasses.danger
        : realityToneClasses.warning
  );
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
  const dashboardPanelClass = 'rounded-[30px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,252,0.98)_100%)] text-[var(--text-strong)] shadow-[0_28px_72px_-44px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-[rgba(148,163,184,0.14)] dark:bg-[linear-gradient(180deg,rgba(10,16,24,0.98)_0%,rgba(8,13,20,0.98)_100%)] dark:shadow-[0_28px_72px_-44px_rgba(0,0,0,0.5)]';
  const decisionBandToneClass = decisionVerdict.tone === 'success'
    ? 'border-emerald-400/24 shadow-[0_0_0_1px_rgba(52,211,153,0.06),0_24px_48px_-32px_rgba(2,8,23,0.42)]'
    : decisionVerdict.tone === 'warning'
      ? 'border-rose-400/24 shadow-[0_0_0_1px_rgba(251,113,133,0.06),0_24px_48px_-32px_rgba(2,8,23,0.42)]'
      : 'border-cyan-400/24 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_24px_48px_-32px_rgba(2,8,23,0.42)]';
  const dashboardCardClass = 'rounded-[20px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.9)] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)] dark:border-[rgba(148,163,184,0.14)] dark:bg-[rgba(15,23,42,0.78)]';
  const warmPanelClass = 'rounded-[28px] border border-[rgba(201,165,106,0.18)] bg-[linear-gradient(180deg,rgba(255,251,244,0.9)_0%,rgba(248,243,235,0.84)_100%)] shadow-[0_24px_54px_-36px_rgba(108,82,42,0.16)] backdrop-blur-2xl dark:border-[rgba(240,217,184,0.18)] dark:bg-[linear-gradient(180deg,rgba(14,22,30,0.92)_0%,rgba(17,24,31,0.86)_100%)] dark:shadow-[0_26px_58px_-36px_rgba(0,0,0,0.72)]';
  const importedDetailLabels = {
    teaser: language === 'cs' ? 'Rychlý přehled bez vaty' : language === 'sk' ? 'Rýchly prehľad bez vaty' : language === 'de' || language === 'at' ? 'Schneller Überblick ohne Floskeln' : language === 'pl' ? 'Szybki przegląd bez waty' : 'Quick read without the fluff',
    rawToggle: language === 'cs' ? 'Ukázat celý syrový text inzerátu' : language === 'sk' ? 'Ukázať celý surový text inzerátu' : language === 'de' || language === 'at' ? 'Kompletten Rohtext anzeigen' : language === 'pl' ? 'Pokaż pełny surowy tekst ogłoszenia' : 'Show full raw listing text',
    rawClose: language === 'cs' ? 'Skrýt celý syrový text' : language === 'sk' ? 'Skryť celý surový text' : language === 'de' || language === 'at' ? 'Rohtext ausblenden' : language === 'pl' ? 'Ukryj pełny surowy tekst' : 'Hide full raw text',
  };
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
  const realityPanel = (
    <SurfaceCard className={cn('border-transparent p-5 text-[var(--text-strong)] sm:p-6', dashboardPanelClass)} variant="dock">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title={copy.aiWandTitle} />
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
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <div className={cn('rounded-[24px] border bg-[linear-gradient(180deg,#0b1322_0%,#111a2b_100%)] p-5 text-slate-50', decisionBandToneClass)}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-[38rem]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/76">{copy.financialTitle}</div>
                  <div className="mt-2 text-base font-semibold tracking-[-0.03em]">{decisionVerdict.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-200/88">{decisionVerdict.body}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-3 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300/72">{copy.jhiImpact}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-cyan-100">
                    {commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}
                  </div>
                </div>
              </div>

              {!isMicroJobRole && userProfile.isLoggedIn && (userProfile.address || userProfile.coordinates || remoteRole) ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300/72">
                    <span>{copy.currentLocation}</span>
                    <span>{remoteRole ? copy.remoteReality : `${remoteRole ? 0 : commuteAnalysis?.distanceKm || 0} km`}</span>
                    <span>{job.company}</span>
                  </div>
                  <div className="relative mt-3 h-2 rounded-full bg-white/12">
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
                    <div className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300/72">{copy.commuteTime}</div>
                      <div className="mt-2 text-xl font-semibold tracking-[-0.04em]">{remoteRole ? '0 min' : commuteAnalysis ? `${commuteAnalysis.timeMinutes * 2} min` : '—'}</div>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300/72">{copy.oneWay}</div>
                      <div className="mt-2 text-xl font-semibold tracking-[-0.04em]">{remoteRole ? '0 km' : commuteAnalysis ? `${commuteAnalysis.distanceKm} km` : '—'}</div>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300/72">{copy.commuteCost}</div>
                      <div className="mt-2 text-xl font-semibold tracking-[-0.04em]">{remoteRole ? copy.zeroCost : commuteAnalysis ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—'}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

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
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className={cn('rounded-[18px] border px-4 py-4', dashboardCardClass, salarySignalToneClass)}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{salarySignalCopy.label}</div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{salarySignalStatus}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{salarySignalBody}</div>
                  </div>
                  <div className={cn('rounded-[18px] border px-4 py-4', dashboardCardClass, commuteTimeToneClass)}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteTime}</div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{remoteRole ? '0 min' : commuteAnalysis ? `${commuteAnalysis.timeMinutes * 2} min` : '—'}</div>
                  </div>
                  <div className={cn('rounded-[18px] border px-4 py-4', dashboardCardClass, commuteCostToneClass)}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteCost}</div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{remoteRole ? copy.zeroCost : commuteAnalysis ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—'}</div>
                  </div>
                  <div className={cn('rounded-[18px] border px-4 py-4', dashboardCardClass, realValueToneClass)}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.realValue}</div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                      {commuteAnalysis ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                  <div className={cn('px-4 py-4', dashboardCardClass)}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.realValue}</div>
                    <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                      {commuteAnalysis ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary}
                    </div>
                    <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      {commuteAnalysis
                        ? copy.financialFormula
                            .replace('{{net}}', `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                            .replace('{{benefits}}', `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                            .replace('{{commute}}', `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                            .replace('{{total}}', `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                        : aiRealitySummary}
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-faint)]">{copy.benefitsReserve}</div>
                  </div>

                  <div className="grid gap-3">
                    {bullshitAnalysis.signals.length > 0 ? (
                      <div className="rounded-[18px] border border-rose-200 bg-rose-50/88 px-4 py-4 dark:border-rose-900/60 dark:bg-rose-950/20">
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
                      <div className="rounded-[18px] border border-emerald-200 bg-emerald-50/88 px-4 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
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

          <div className={cn('p-4 sm:p-5', dashboardCardClass)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', aiToneStyles.label)}>{copy.compatibility}</div>
                <div className="mt-1.5 text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                  {Math.round(job.jhi?.score || 0)}
                </div>
              </div>
              <div className="rounded-[18px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] px-4 py-3 text-right dark:border-[rgba(var(--accent-rgb),0.22)] dark:bg-[rgba(var(--accent-rgb),0.12)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.jhiImpact}</div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                  {commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-[rgba(15,23,42,0.08)] bg-[rgba(248,250,252,0.92)] p-3 dark:border-[rgba(148,163,184,0.14)] dark:bg-[rgba(8,13,20,0.72)]">
              <JHIChart jhi={job.jhi} theme="light" accent={aiToneStyles.chartAccent} compact />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {jhiDimensions.map((dimension) => (
                <div key={dimension.key} className={cn('rounded-[18px] border px-4 py-4', dashboardCardClass, dimensionToneClass(dimension.value))}>
                  <div className="text-xs font-medium text-[var(--text-muted)]">{dimension.label}</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{Math.round(dimension.value)}/100</span>
                    <span className="h-2.5 w-20 overflow-hidden rounded-[999px] bg-[rgba(148,163,184,0.18)] dark:bg-[rgba(255,255,255,0.12)]">
                      <span
                        className={cn('block h-full rounded-[999px]', dimensionBarToneClass(dimension.value))}
                        style={{ width: `${Math.max(8, Math.min(100, Math.round(dimension.value)))}%` }}
                      />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
  return (
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
                <div className="space-y-4 rounded-[24px] bg-[rgba(255,255,255,0.56)] p-4 backdrop-blur-xl dark:bg-[rgba(9,16,24,0.34)] sm:p-5">
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
                    <div className="min-w-0 rounded-[16px] bg-[rgba(255,255,255,0.68)] px-3.5 py-3 dark:bg-[rgba(255,255,255,0.05)]">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        <MapPin size={13} />
                        {copy.location}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-[var(--text-strong)]">
                        {locationValue}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-[16px] bg-[rgba(255,255,255,0.68)] px-3.5 py-3 dark:bg-[rgba(255,255,255,0.05)]">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        <Compass size={13} />
                        {copy.workModel}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-[var(--text-strong)]">
                        {workModelValue}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-[16px] bg-[rgba(255,255,255,0.68)] px-3.5 py-3 dark:bg-[rgba(255,255,255,0.05)]">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        <Wallet size={13} />
                        {copy.salary}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-[var(--text-strong)]">
                        {displayedSalary}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    {isImported ? (
                      <button
                        type="button"
                        onClick={onOpenImportedListing}
                        className="app-button-primary inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold"
                      >
                        <Sparkles size={15} />
                        {copy.importedButton}
                      </button>
                    ) : (
                      <a
                        href="#challenge-handshake"
                        className="app-button-primary inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold"
                      >
                        <Handshake size={15} />
                        {copy.handshakeCta}
                      </a>
                    )}
                    {!isImported && job.company_id ? (
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
            {isImported ? (
              <details open className={cn('group overflow-hidden', warmPanelClass)}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.importedDetail}</div>
                  <div className="rounded-[999px] bg-[rgba(255,255,255,0.06)] px-3 py-1 text-sm font-semibold text-[var(--text-muted)]">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </div>
                </summary>
                <div className="border-t border-[rgba(191,161,106,0.18)] bg-transparent px-5 py-5">
                  <div className="mb-4 rounded-[16px] bg-[rgba(var(--accent-rgb),0.05)] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {importedDetailLabels.teaser}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{copy.rawImportNote}</p>
                  </div>
                  <FormattedJobDescription
                    text={formattedDescription}
                    fallback={copy.roleDetailUnavailable}
                    maxSections={4}
                    maxParagraphLength={260}
                    maxListItems={4}
                  />
                  <details className="group mt-4 rounded-[16px] bg-[rgba(255,255,255,0.04)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--text-strong)]">
                      <span className="group-open:hidden">{importedDetailLabels.rawClose}</span>
                      <span className="hidden group-open:inline">{importedDetailLabels.rawToggle}</span>
                      <span className="text-[var(--text-faint)] transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <div className="border-t border-[var(--border-subtle)] px-4 py-4">
                      <FormattedJobDescription
                        text={formattedDescription}
                        fallback={copy.roleDetailUnavailable}
                      />
                    </div>
                  </details>
                </div>
              </details>
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

            <SurfaceCard className={cn('border-transparent p-5 sm:p-6', dashboardPanelClass)} variant="dock">
              <div className="space-y-5">
                <SectionTitle title={copy.insideTitle} />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
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
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{isImported ? copy.importedSnapshot : copy.mission}</div>
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
                  </div>

                  <div className="space-y-4">
                    <div className={cn('p-4', dashboardCardClass)}>
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
                        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{copy.companyPeopleFallback}</p>
                      )}
                    </div>

                    <div className={cn('p-4', dashboardCardClass)}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{companyStoryLabels.environment}</div>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--text)]">
                        {companyIndustry ? <div>{companyStoryLabels.industry}: {companyIndustry}</div> : null}
                        {companyTone ? <div>{companyTone}</div> : null}
                        {companyWebsiteLabel ? <div>{companyStoryLabels.website}: {companyWebsiteLabel}</div> : null}
                      </div>
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

          </div>

        </div>
      </div>
    </section>
  );
};

export default ChallengeDetailPage;
