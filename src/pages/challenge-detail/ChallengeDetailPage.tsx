import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { ArrowLeft, CarFront, Compass, Handshake, MapPin, Sparkles, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const isDarkTheme = useMemo(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }, []);

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
  const heroLead = isImported ? copy.heroLeadImported : copy.heroLeadNative;
  const heroPanelClass = 'border-[var(--border-subtle)] bg-[var(--surface)] dark:bg-slate-950';
  const heroPanelSoftClass = 'border-[var(--border-subtle)] bg-[var(--surface-muted)] dark:bg-slate-950';
  const heroStrongTextClass = 'text-slate-900 dark:text-white';
  const heroMutedTextClass = 'text-slate-600 dark:text-slate-300';

  return (
    <div className="space-y-5">
      <div className="mx-auto w-full max-w-[1480px] space-y-5 pb-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <ArrowLeft size={16} />
          {copy.back}
        </button>

        <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
          <div className="relative min-h-[180px] overflow-hidden rounded-[16px] bg-[var(--surface)]">
            <img
              src={coverImageUrl}
              alt={job.company}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.26] saturate-[0.94] dark:opacity-[0.3]"
              loading="lazy"
            />

            <div className="relative flex h-full min-h-[180px] flex-col justify-between p-5 sm:p-6 lg:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-[999px] border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    <Sparkles size={12} />
                    {listingBadge}
                  </span>
                  {matchScore > 0 ? (
                    <span className={cn(
                      'inline-flex items-center gap-2 rounded-[999px] border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]',
                      isImported
                        ? 'border-slate-200 bg-white text-slate-700'
                        : 'border-slate-300 bg-white text-slate-900 dark:bg-slate-950 dark:text-white'
                    )}>
                      <Sparkles size={11} />
                      {matchScore}% {copy.matchUpper}
                    </span>
                  ) : null}
                  {domainAccent ? (
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {language === 'cs' || language === 'sk' ? domainAccent.label.cs : domainAccent.label.en}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className={cn(
                  'space-y-4 rounded-[18px] border p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.12)] sm:p-5',
                  heroPanelClass
                )}>
                  <div className={cn(
                    'inline-flex max-w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 shadow-none',
                    heroPanelSoftClass
                  )}>
                    {usePublisherMonogram ? (
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-[10px] text-sm font-bold ring-1',
                        'bg-slate-100 text-slate-900 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700'
                      )}>
                        {publisherInitials}
                      </div>
                    ) : (
                      <img
                        src={publisherAvatar}
                        alt={publisherName}
                        className="h-12 w-12 rounded-[10px] object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                        loading="lazy"
                      />
                    )}
                    <div>
                      <div className={cn('text-sm font-semibold', heroStrongTextClass)}>{publisherName}</div>
                      <div className={cn('text-sm', heroMutedTextClass)}>{publisherRole}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h1 className={cn(
                      'max-w-4xl text-[1.85rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.2rem] lg:text-[2.5rem]',
                      heroStrongTextClass
                    )}>
                      {job.title}
                    </h1>
                    <div className={cn(
                      'inline-flex max-w-2xl rounded-[14px] border px-4 py-3 shadow-none',
                      heroPanelSoftClass
                    )}>
                      <p className={cn('text-sm leading-6 sm:text-base', heroMutedTextClass)}>
                        {heroLead}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    <div className={cn(
                      'min-w-0 rounded-[14px] border px-3.5 py-3 shadow-none',
                      heroPanelSoftClass
                    )}>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        <MapPin size={13} />
                        {copy.location}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-slate-800 dark:text-slate-100">
                        {locationValue}
                      </div>
                    </div>
                    <div className={cn(
                      'min-w-0 rounded-[14px] border px-3.5 py-3 shadow-none',
                      heroPanelSoftClass
                    )}>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        <Compass size={13} />
                        {copy.workModel}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-slate-800 dark:text-slate-100">
                        {workModelValue}
                      </div>
                    </div>
                    <div className={cn(
                      'min-w-0 rounded-[14px] border px-3.5 py-3 shadow-none',
                      heroPanelSoftClass
                    )}>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        <Wallet size={13} />
                        {copy.salary}
                      </div>
                      <div className="mt-2 text-sm leading-6 break-words text-slate-800 dark:text-slate-100">
                        {displayedSalary}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    {isImported ? (
                      <button
                        type="button"
                        onClick={onOpenImportedListing}
                        className="inline-flex items-center gap-2 rounded-[6px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Sparkles size={15} />
                        {copy.importedButton}
                      </button>
                    ) : (
                      <a
                        href="#challenge-handshake"
                        className="inline-flex items-center gap-2 rounded-[6px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Handshake size={15} />
                        {copy.handshakeCta}
                      </a>
                    )}
                    {!isImported && job.company_id ? (
                      <button
                        type="button"
                        onClick={() => onOpenCompanyPage(job.company_id!)}
                        className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
                      >
                        <Compass size={15} />
                        {copy.companyCta}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={cn(
                  'self-end rounded-[18px] border p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.12)]',
                  `${heroPanelClass} ${heroStrongTextClass}`
                )}>
                  <div className={cn('mt-4 grid gap-3', isImported ? 'grid-cols-1' : matchScore > 0 ? 'sm:grid-cols-2 lg:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-1')}>
                    {matchScore > 0 ? (
                      <div className="rounded-[14px] border border-[var(--border-subtle)] bg-white px-4 py-4 dark:bg-slate-950">
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
                        className={`rounded-[14px] border px-4 py-4 ${heroPanelSoftClass}`}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</div>
                        <div className={cn(
                          'mt-2 font-semibold tracking-[-0.03em]',
                          heroStrongTextClass,
                          item.label === copy.location || item.label === copy.workModel ? 'text-sm leading-6 break-words' : 'text-lg'
                        )}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {isImported ? (
                    <div className={`mt-4 rounded-[14px] border p-3.5 ${heroPanelSoftClass}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {copy.response}
                      </div>
                      <button
                        type="button"
                        onClick={onOpenImportedListing}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Sparkles size={15} />
                        {copy.importedButton}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isImported ? (
          <div className="mx-auto w-full max-w-[1480px]">
            <SurfaceCard className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
              <div>
                <div className="text-sm font-semibold text-[var(--text-strong)]">
                  {copy.importedContinue}
                </div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {copy.importedReality}
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenImportedListing}
                className="inline-flex items-center gap-2 rounded-[6px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 whitespace-nowrap"
              >
                {copy.importedButton}
              </button>
            </SurfaceCard>
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-[1480px]">
          <div className="space-y-5">
            <SurfaceCard className="space-y-5 rounded-[18px] border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
              <SectionTitle title={copy.insideTitle} />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white p-5 dark:bg-slate-950">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {isImported ? copy.importedSnapshot : copy.mission}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--text)]">{missionBody}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-4 py-3 dark:bg-slate-950">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.firstStep}</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--text)]">{firstStep || challenge.firstStepPrompt}</div>
                      </div>
                      {riskBody ? (
                        <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-4 py-3 dark:bg-slate-950">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.risk}</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--text)]">{riskBody}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white p-4 dark:bg-slate-950">
                    <div className="flex items-center gap-3">
                      {usePublisherMonogram ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-[6px] bg-[var(--surface)] text-sm font-bold text-[var(--text-strong)] dark:bg-slate-900">
                          {publisherInitials}
                        </div>
                      ) : (
                        <img src={publisherAvatar} alt={publisherName} className="h-14 w-14 rounded-[6px] object-cover" loading="lazy" />
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
            </SurfaceCard>

            {isImported ? (
              <details open className="group overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.importedDetail}</div>
                  <div className="rounded-[999px] bg-[var(--surface-muted)] px-3 py-1 text-sm font-semibold text-[var(--text-muted)]">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </div>
                </summary>
                <div className="border-t border-[var(--border-subtle)] px-5 py-4">
                  <div className="prose prose-slate max-w-none prose-headings:tracking-[-0.03em] prose-headings:text-[var(--text-strong)] prose-p:text-[var(--text)] prose-li:text-[var(--text)] prose-strong:text-[var(--text-strong)] dark:prose-headings:text-[var(--text-strong)] dark:prose-p:text-[var(--text)] dark:prose-li:text-[var(--text)] dark:prose-strong:text-[var(--text-strong)]">
                    {formattedDescription ? (
                      <Markdown>{formattedDescription}</Markdown>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">
                        {copy.roleDetailUnavailable}
                      </p>
                    )}
                    <p className="mt-4 text-xs leading-5 text-[var(--text-faint)]">
                      {copy.rawImportNote}
                    </p>
                  </div>
                </div>
              </details>
            ) : null}

            {!isImported ? (
              <div id="challenge-handshake">
                <SurfaceCard className="space-y-5 rounded-[18px] border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
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

            <SurfaceCard className="space-y-4 rounded-[18px] border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle title={copy.aiWandTitle} />
                <div className="flex flex-wrap items-center gap-2">
                  {matchScore > 0 ? (
                    <div className="rounded-[999px] bg-white px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700">
                      {matchScore}% {copy.match}
                    </div>
                  ) : null}
                  <div className="rounded-[999px] bg-white px-3.5 py-2 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700">
                    {decisionVerdict.title}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white p-4 shadow-none dark:bg-slate-950">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.financialTitle}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                        {decisionVerdict.body}
                      </div>
                    </div>
                    <div className="relative hidden h-12 w-24 shrink-0 overflow-hidden rounded-[999px] bg-slate-100 md:block dark:bg-slate-900">
                      <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-slate-300 dark:border-slate-700" />
                      <CarFront className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
                      <MapPin className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                    </div>
                  </div>

                  {isMicroJobRole ? (
                    <div className="mt-4 rounded-[6px] border border-[var(--border-subtle)] bg-white px-4 py-4 text-sm leading-6 text-[var(--text-muted)] dark:bg-slate-950">
                      {copy.financialNoteBody}
                    </div>
                  ) : !userProfile.isLoggedIn ? (
                    <div className="mt-4 rounded-[6px] border border-[var(--border-subtle)] bg-white px-4 py-4 dark:bg-slate-950">
                      <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.loginPrompt}</p>
                      <button
                        type="button"
                        onClick={onRequireAuth}
                        className="mt-4 inline-flex items-center gap-2 rounded-[6px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {copy.signInCreate}
                      </button>
                    </div>
                  ) : (!userProfile.address && !userProfile.coordinates && !remoteRole) ? (
                    <div className="mt-4 rounded-[6px] border border-[var(--border-subtle)] bg-white px-4 py-4 dark:bg-slate-950">
                      <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.addressPrompt}</p>
                      <button
                        type="button"
                        onClick={onOpenProfile}
                        className="mt-4 inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
                      >
                        {copy.openProfile}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className={cn(
                          'rounded-[6px] border px-3 py-3',
                          commuteAnalysis && Number(commuteAnalysis.financialReality.finalRealMonthlyValue || 0) > 0
                            ? 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                            : 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.takeHome}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {commuteAnalysis ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary}
                          </div>
                        </div>
                        <div className={cn(
                          'rounded-[6px] border px-3 py-3',
                          remoteRole || ((commuteAnalysis?.timeMinutes || 0) * 2) <= 90
                            ? 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                            : ((commuteAnalysis?.timeMinutes || 0) * 2) >= 180
                              ? 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                              : 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteTime}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {remoteRole ? '0 min' : commuteAnalysis ? `${commuteAnalysis.timeMinutes * 2} min` : '—'}
                          </div>
                        </div>
                        <div className={cn(
                          'rounded-[6px] border px-3 py-3',
                          remoteRole || Number(commuteAnalysis?.financialReality.commuteCost || 0) <= 3000
                            ? 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                            : Number(commuteAnalysis?.financialReality.commuteCost || 0) >= 10000
                              ? 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                              : 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteCost}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {remoteRole ? copy.zeroCost : commuteAnalysis ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—'}
                          </div>
                        </div>
                        <div className={cn(
                          'rounded-[6px] border px-3 py-3',
                          Number(commuteAnalysis?.jhiImpact || 0) >= 0
                            ? 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                            : 'border-[var(--border-subtle)] bg-white dark:bg-slate-950'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.jhiImpact}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-3.5 py-3.5 dark:bg-slate-950">
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
                        <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-3.5 py-3.5 dark:bg-slate-950">
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
                        <div className="mt-3 rounded-[6px] border border-rose-200 bg-rose-50/70 px-3.5 py-3.5 dark:border-rose-900/60 dark:bg-rose-950/20">
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
                        <div className="mt-3 rounded-[6px] border border-emerald-200 bg-emerald-50/70 px-3.5 py-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
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

                <div className={cn(
                  'rounded-[6px] border bg-white p-4 shadow-none dark:bg-slate-950',
                  matchScore > 0
                    ? 'border-[var(--border-subtle)]'
                    : 'border-[var(--border-subtle)]'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.compatibility}</div>
                      <div className="mt-1.5 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                        {Math.round(job.jhi?.score || 0)}/100
                      </div>
                    </div>
                    <div className={cn(
                      'rounded-[999px] px-3 py-1.5 text-xs font-bold ring-1 ring-inset',
                      matchScore > 0
                        ? 'bg-white text-slate-700 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700'
                        : commuteAnalysis
                        ? (commuteAnalysis.jhiImpact >= 0
                          ? 'bg-white text-slate-700 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700'
                          : 'bg-white text-slate-700 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700')
                        : 'bg-white text-[var(--text-muted)] ring-[var(--border-subtle)] dark:bg-slate-950'
                    )}>
                      {matchScore > 0
                        ? `${matchScore}% ${copy.match}`
                        : `${copy.jhiImpact}: ${commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}`}
                    </div>
                  </div>

                  <div className="mt-3 rounded-[6px] border border-[var(--border-subtle)] bg-white p-2.5 dark:bg-slate-950">
                    <JHIChart jhi={job.jhi} theme={isDarkTheme ? 'dark' : 'light'} compact />
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {jhiDimensions.map((dimension) => (
                      <div key={dimension.key} className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-3 py-3 shadow-none dark:bg-slate-950">
                        <div className="text-xs font-medium text-[var(--text-muted)]">{dimension.label}</div>
                        <div className="mt-1 flex items-end justify-between gap-3">
                          <span className="text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{Math.round(dimension.value)}/100</span>
                          <span className="h-2.5 w-20 overflow-hidden rounded-[999px] bg-slate-200 dark:bg-white/8">
                            <span
                              className="block h-full rounded-[999px] bg-slate-900 dark:bg-slate-200"
                              style={{ width: `${Math.max(8, Math.min(100, Math.round(dimension.value)))}%` }}
                            />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SurfaceCard>

          </div>

        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailPage;
