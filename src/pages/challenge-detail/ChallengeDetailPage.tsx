import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CarFront, Compass, Handshake, MapPin, Sparkles, Wallet } from 'lucide-react';
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
import { getStockCoverForDomain } from '../../../utils/domainCoverImages';
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
  const coverImageUrl = useMemo(
    () => getStockCoverForDomain(effectiveDomain, `${job.id || ''}-${job.company || ''}-${job.title || ''}`),
    [effectiveDomain, job.company, job.id, job.title],
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
  const decisionToneClass = decisionVerdict.tone === 'success'
    ? realityToneClasses.success
    : decisionVerdict.tone === 'warning'
      ? realityToneClasses.danger
      : realityToneClasses.warning;
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
  const jhiImpactValue = Number(commuteAnalysis?.jhiImpact || 0);
  const jhiImpactToneClass = jhiImpactValue >= 5
    ? realityToneClasses.success
    : jhiImpactValue < 0
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
  const heroLead = isImported ? copy.heroLeadImported : copy.heroLeadNative;
  const darkPanelClass = 'rounded-[30px] border border-[rgba(var(--accent-rgb),0.24)] bg-[linear-gradient(180deg,rgba(8,14,24,0.99)_0%,rgba(12,21,33,0.97)_46%,rgba(15,24,36,0.96)_100%)] text-[var(--text-strong)] shadow-[0_38px_88px_-44px_rgba(2,8,23,0.62),0_0_0_1px_rgba(var(--accent-rgb),0.06),0_0_36px_rgba(var(--accent-rgb),0.08)] backdrop-blur-2xl';
  const featuredPanelVars = {
    '--text-strong': '#f7fbff',
    '--text': '#e6eef7',
    '--text-muted': 'rgba(226,232,240,0.88)',
    '--text-faint': 'rgba(203,213,225,0.8)',
    '--surface': 'rgba(10,20,32,0.76)',
    '--surface-soft': 'rgba(12,24,38,0.88)',
    '--surface-card': 'rgba(14,28,44,0.92)',
    '--border-subtle': 'rgba(134,228,246,0.16)',
    '--shadow-soft': '0 24px 46px -30px rgba(0,0,0,0.48)',
  } as React.CSSProperties;
  const warmPanelClass = 'rounded-[28px] border border-[rgba(201,165,106,0.18)] bg-[linear-gradient(180deg,rgba(255,251,244,0.9)_0%,rgba(248,243,235,0.84)_100%)] shadow-[0_24px_54px_-36px_rgba(108,82,42,0.16)] backdrop-blur-2xl dark:border-[rgba(240,217,184,0.18)] dark:bg-[linear-gradient(180deg,rgba(14,22,30,0.92)_0%,rgba(17,24,31,0.86)_100%)] dark:shadow-[0_26px_58px_-36px_rgba(0,0,0,0.72)]';
  const importedDetailLabels = {
    teaser: language === 'cs' ? 'Rychlý přehled bez vaty' : language === 'sk' ? 'Rýchly prehľad bez vaty' : language === 'de' || language === 'at' ? 'Schneller Überblick ohne Floskeln' : language === 'pl' ? 'Szybki przegląd bez waty' : 'Quick read without the fluff',
    rawToggle: language === 'cs' ? 'Ukázat celý syrový text inzerátu' : language === 'sk' ? 'Ukázať celý surový text inzerátu' : language === 'de' || language === 'at' ? 'Kompletten Rohtext anzeigen' : language === 'pl' ? 'Pokaż pełny surowy tekst ogłoszenia' : 'Show full raw listing text',
    rawClose: language === 'cs' ? 'Skrýt celý syrový text' : language === 'sk' ? 'Skryť celý surový text' : language === 'de' || language === 'at' ? 'Rohtext ausblenden' : language === 'pl' ? 'Ukryj pełny surowy tekst' : 'Hide full raw text',
  };
  const aiToneStyles = decisionVerdict.tone === 'success'
      ? {
        panel: 'border-emerald-500/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,251,248,0.82)_100%)] shadow-[0_24px_56px_-36px_rgba(16,32,51,0.14)] dark:border-cyan-400/14 dark:bg-[linear-gradient(180deg,#131d29_0%,#0d1520_100%)] dark:shadow-[0_28px_60px_-36px_rgba(34,211,238,0.14)]',
        chip: 'bg-cyan-400/14 text-cyan-50 ring-cyan-300/22 shadow-[0_0_18px_rgba(34,211,238,0.12)]',
        soft: 'border-[rgba(var(--accent-rgb),0.16)] bg-[linear-gradient(180deg,rgba(12,24,38,0.9)_0%,rgba(14,28,44,0.82)_100%)]',
        label: 'text-cyan-100/76',
        chartAccent: 'cyan' as const,
        bar: 'bg-cyan-400/80 dark:bg-cyan-300/80',
      }
    : decisionVerdict.tone === 'warning'
      ? {
          panel: 'border-amber-500/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(252,248,243,0.82)_100%)] shadow-[0_24px_56px_-36px_rgba(16,32,51,0.14)] dark:border-cyan-400/14 dark:bg-[linear-gradient(180deg,#19151b_0%,#0d1520_100%)] dark:shadow-[0_28px_60px_-36px_rgba(244,63,94,0.12)]',
          chip: 'bg-cyan-400/14 text-cyan-50 ring-cyan-300/22 shadow-[0_0_18px_rgba(34,211,238,0.12)]',
          soft: 'border-[rgba(var(--accent-rgb),0.16)] bg-[linear-gradient(180deg,rgba(12,24,38,0.9)_0%,rgba(14,28,44,0.82)_100%)]',
          label: 'text-cyan-100/76',
          chartAccent: 'cyan' as const,
          bar: 'bg-cyan-400/80 dark:bg-cyan-300/80',
        }
      : {
          panel: 'border-[rgba(var(--accent-rgb),0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(243,249,252,0.82)_100%)] shadow-[0_24px_56px_-36px_rgba(16,32,51,0.14)] dark:border-cyan-400/14 dark:bg-[linear-gradient(180deg,#151b23_0%,#0d1520_100%)] dark:shadow-[0_28px_60px_-36px_rgba(34,211,238,0.12)]',
          chip: 'bg-[rgba(var(--accent-rgb),0.2)] text-slate-50 ring-[rgba(var(--accent-rgb),0.26)] shadow-[0_0_18px_rgba(34,211,238,0.12)]',
          soft: 'border-[rgba(var(--accent-rgb),0.16)] bg-[linear-gradient(180deg,rgba(12,24,38,0.9)_0%,rgba(14,28,44,0.82)_100%)]',
          label: 'text-cyan-100/76',
          chartAccent: 'cyan' as const,
          bar: 'bg-cyan-400/80 dark:bg-cyan-300/80',
        };
  const realityPanel = (
    <SurfaceCard className={cn('border-transparent p-5 text-[var(--text-strong)] sm:p-6', darkPanelClass)} variant="dock">
      <div className="space-y-4" style={featuredPanelVars}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title={copy.aiWandTitle} />
          <div className="flex flex-wrap items-center gap-2">
            {matchScore > 0 ? (
              <div className={cn('rounded-[999px] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] ring-1 ring-inset', aiToneStyles.chip)}>
                {matchScore}% {copy.match}
              </div>
            ) : null}
            <div className={cn('rounded-[999px] px-3.5 py-2 text-xs font-bold ring-1 ring-inset', aiToneStyles.chip)}>
              {decisionVerdict.title}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn('rounded-[22px] border p-4 shadow-none backdrop-blur-sm', aiToneStyles.soft, decisionToneClass)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', aiToneStyles.label)}>{copy.financialTitle}</div>
              <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {decisionVerdict.body}
              </div>
            </div>
            <div className="relative hidden h-12 w-24 shrink-0 overflow-hidden rounded-[999px] bg-[rgba(16,32,51,0.06)] dark:bg-[rgba(255,255,255,0.06)] md:block">
              <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-[rgba(16,32,51,0.14)] dark:border-[rgba(255,255,255,0.12)]" />
              <CarFront className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <MapPin className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            </div>
          </div>

          {isMicroJobRole ? (
            <div className="mt-4 rounded-[18px] border border-[rgba(16,32,51,0.08)] bg-[rgba(255,255,255,0.64)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)] backdrop-blur-xl dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)]">
              {copy.financialNoteBody}
            </div>
          ) : !userProfile.isLoggedIn ? (
            <div className="mt-4 rounded-[18px] border border-[rgba(16,32,51,0.08)] bg-[rgba(255,255,255,0.64)] px-4 py-4 backdrop-blur-xl dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)]">
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
            <div className="mt-4 rounded-[18px] border border-[rgba(16,32,51,0.08)] bg-[rgba(255,255,255,0.64)] px-4 py-4 backdrop-blur-xl dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)]">
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
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className={cn('rounded-[16px] border px-3 py-3 shadow-none', aiToneStyles.soft, takeHomeToneClass)}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.takeHome}</div>
                  <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                    {commuteAnalysis ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary}
                  </div>
                </div>
                <div className={cn('rounded-[16px] border px-3 py-3 shadow-none', aiToneStyles.soft, commuteTimeToneClass)}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteTime}</div>
                  <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                    {remoteRole ? '0 min' : commuteAnalysis ? `${commuteAnalysis.timeMinutes * 2} min` : '—'}
                  </div>
                </div>
                <div className={cn('rounded-[16px] border px-3 py-3 shadow-none', aiToneStyles.soft, commuteCostToneClass)}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteCost}</div>
                  <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                    {remoteRole ? copy.zeroCost : commuteAnalysis ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—'}
                  </div>
                </div>
                <div className={cn('rounded-[16px] border px-3 py-3 shadow-none', aiToneStyles.soft, jhiImpactToneClass)}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.jhiImpact}</div>
                  <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                    {commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className={cn('rounded-[18px] border px-3.5 py-3.5', aiToneStyles.soft, realValueToneClass)}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.realValue}</div>
                  <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                    {commuteAnalysis ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    {commuteAnalysis
                        ? copy.financialFormula
                            .replace('{{net}}', `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                            .replace('{{benefits}}', `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                            .replace('{{commute}}', `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                            .replace('{{total}}', `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}`)
                        : aiRealitySummary}
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-[var(--text-faint)]">
                    {copy.benefitsReserve}
                  </div>
                </div>
                <div className={cn('rounded-[18px] border px-3.5 py-3.5', aiToneStyles.soft, commuteTimeToneClass)}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteTime}</div>
                  <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                    {remoteRole ? '0 min' : commuteAnalysis ? `${commuteAnalysis.timeMinutes * 2} min` : '—'}
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>{copy.oneWay}</span>
                      <span className="font-semibold text-[var(--text-strong)]">{remoteRole ? '0 km' : commuteAnalysis ? `${commuteAnalysis.distanceKm} km` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{copy.commute}</span>
                      <span className="font-semibold text-[var(--text-strong)]">{remoteRole ? copy.zeroCost : commuteAnalysis ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {bullshitAnalysis.signals.length > 0 ? (
                <div className="mt-3 rounded-[18px] border border-rose-200 bg-rose-50/70 px-3.5 py-3.5 dark:border-rose-900/60 dark:bg-rose-950/20">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">
                    {copy.bullshitTitle}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-rose-900 dark:text-rose-100">
                    {bullshitAnalysis.tone === 'bullshit'
                      ? `${copy.bullshitSmells} (${bullshitAnalysis.score}/${bullshitAnalysis.maxScore})`
                      : `${copy.bullshitWatch} (${bullshitAnalysis.score}/${bullshitAnalysis.maxScore})`}
                  </div>
                  <div className="mt-1.5 text-xs leading-5 text-rose-800 dark:text-rose-100/90">
                    {bullshitAnalysis.summary}
                  </div>
                  {bullshitAnalysis.categories.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {bullshitAnalysis.categories.map((category) => (
                        <span
                          key={category}
                          className="inline-flex items-center rounded-[999px] border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-2">
                    {bullshitAnalysis.signals.map((signal) => (
                      <div
                        key={signal}
                        className="text-xs leading-5 text-rose-800 dark:text-rose-100/90"
                      >
                        {signal}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {bullshitAnalysis.greenFlags.length > 0 ? (
                <div className="mt-3 rounded-[18px] border border-emerald-200 bg-emerald-50/70 px-3.5 py-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                    {copy.greenTitle}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                    {copy.greenSubtitle}
                  </div>
                  <div className="mt-1.5 text-xs leading-5 text-emerald-800 dark:text-emerald-100/90">
                    {bullshitAnalysis.greenSummary}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bullshitAnalysis.greenFlags.map((flag) => (
                      <span
                        key={flag}
                        className="inline-flex items-center rounded-[999px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

          <div className={cn('rounded-[22px] border p-4 shadow-none backdrop-blur-sm', aiToneStyles.soft)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', aiToneStyles.label)}>{copy.compatibility}</div>
              <div className="mt-1.5 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                {Math.round(job.jhi?.score || 0)}/100
              </div>
            </div>
            <div className={cn(
              'rounded-[999px] px-3 py-1.5 text-xs font-bold ring-1 ring-inset',
              matchScore > 0
                ? aiToneStyles.chip
                : aiToneStyles.chip
            )}>
              {matchScore > 0
                ? `${matchScore}% ${copy.match}`
                : `${copy.jhiImpact}: ${commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}`}
            </div>
          </div>

          <div className={cn('mt-3 rounded-[18px] border p-3', aiToneStyles.soft, 'bg-[rgba(12,19,29,0.92)]')}>
            <JHIChart jhi={job.jhi} theme="dark" accent={aiToneStyles.chartAccent} compact />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {jhiDimensions.map((dimension) => (
              <div key={dimension.key} className={cn('rounded-[16px] border px-3 py-3 shadow-none', aiToneStyles.soft, dimensionToneClass(dimension.value))}>
                <div className="text-xs font-medium text-[var(--text-muted)]">{dimension.label}</div>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <span className="text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{Math.round(dimension.value)}/100</span>
                  <span className="h-2.5 w-20 overflow-hidden rounded-[999px] bg-[rgba(16,32,51,0.1)] dark:bg-[rgba(255,255,255,0.12)]">
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
                </div>

                <div className="self-end rounded-[22px] bg-[rgba(255,255,255,0.58)] p-4 text-[var(--text-strong)] backdrop-blur-xl dark:bg-[rgba(9,16,24,0.34)]">
                  <div className={cn('grid gap-3', isImported ? 'grid-cols-1' : matchScore > 0 ? 'sm:grid-cols-2 lg:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-1')}>
                    {matchScore > 0 ? (
                      <div className="rounded-[16px] bg-[rgba(255,255,255,0.68)] px-4 py-4 dark:bg-[rgba(255,255,255,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.match}</div>
                        <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{matchScore}%</div>
                      </div>
                    ) : null}
                    {[
                      { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, accent: true },
                      ...(!isImported ? [{ label: copy.location, value: locationValue, accent: false }] : []),
                      ...(!isImported && !matchScore ? [{ label: copy.workModel, value: workModelValue, accent: false }] : []),
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[16px] bg-[rgba(255,255,255,0.68)] px-4 py-4 dark:bg-[rgba(255,255,255,0.05)]"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{item.label}</div>
                        <div className={cn(
                          'mt-2 font-semibold tracking-[-0.03em] text-[var(--text-strong)]',
                          item.label === copy.location || item.label === copy.workModel ? 'text-sm leading-6 break-words' : 'text-lg'
                        )}>{item.value}</div>
                      </div>
                    ))}
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
                      <span className="group-open:hidden">{importedDetailLabels.rawToggle}</span>
                      <span className="hidden group-open:inline">{importedDetailLabels.rawClose}</span>
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

            <SurfaceCard className={cn('border-transparent p-5 sm:p-6', darkPanelClass)} variant="dock">
              <div className="space-y-5" style={featuredPanelVars}>
                <SectionTitle title={copy.insideTitle} />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {isImported ? copy.importedSnapshot : copy.mission}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{missionBody}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[16px] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.12)] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">{copy.firstStep}</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--text)]">{firstStep || challenge.firstStepPrompt}</div>
                      </div>
                      {riskBody ? (
                        <div className="rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.risk}</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{riskBody}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-[18px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] p-4">
                    <div className="flex items-center gap-3">
                      {usePublisherMonogram ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.08)] text-sm font-bold text-[var(--text-strong)]">
                          {publisherInitials}
                        </div>
                      ) : (
                        <img src={publisherAvatar} alt={publisherName} className="h-14 w-14 rounded-[14px] border border-[rgba(255,255,255,0.1)] object-cover" loading="lazy" />
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
