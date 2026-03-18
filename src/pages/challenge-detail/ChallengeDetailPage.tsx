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
  const accentStyle = domainAccent
    ? ({ ['--detail-accent-rgb' as any]: domainAccent.rgb } as React.CSSProperties)
    : undefined;
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

  return (
    <div className="app-aurora-shell space-y-5" style={accentStyle}>
      <div className="mx-auto w-full max-w-[1480px] space-y-5 pb-8">
        <button type="button" onClick={onBack} className="app-button-secondary !px-3.5 !py-2.5">
          <ArrowLeft size={16} />
          {copy.back}
        </button>

        <div className="overflow-hidden rounded-[36px] border border-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.16)] bg-[var(--surface)] p-3 shadow-[var(--shadow-overlay)]">
          <div className={cn('relative min-h-[330px] overflow-hidden rounded-[30px]', isImported && 'bg-[#02040c]')}>
            <img
              src={coverImageUrl}
              alt={job.company}
              className={cn(
                'absolute inset-0 h-full w-full object-cover',
                isImported && 'scale-[1.03] saturate-[0.92]'
              )}
              loading="lazy"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={isImported
                ? { background: 'linear-gradient(180deg, rgba(2,4,12,0.16), rgba(2,4,12,0.28) 46%, rgba(2,4,12,0.48) 100%)' }
                : { background: 'linear-gradient(180deg, rgba(7,12,24,0.38), rgba(7,12,24,0.76) 54%, rgba(7,12,24,0.92) 100%)' }}
            />
            {isImported ? (
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-full lg:w-[68%]"
                style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.74), rgba(255,255,255,0.56) 34%, rgba(255,255,255,0.18) 70%, rgba(255,255,255,0.02) 100%)' }}
              />
            ) : null}
            {isImported ? (
              <>
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-85"
                  style={{ background: 'radial-gradient(circle at 18% 22%, rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.12), transparent 32%)' }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-40"
                  style={{ background: 'radial-gradient(circle at 82% 18%, rgba(167,139,250,0.08), transparent 26%)' }}
                />
              </>
            ) : null}
            <div
              aria-hidden
              className="absolute -left-16 bottom-0 h-56 w-56 rounded-full blur-3xl"
              style={{ background: isImported ? 'radial-gradient(circle, rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.18), transparent 70%)' : 'radial-gradient(circle, rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.34), transparent 70%)' }}
            />
            {!isImported ? (
              <div
                aria-hidden
                className="absolute -right-16 top-0 h-56 w-56 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent 72%)' }}
              />
            ) : null}

            <div className="relative flex h-full min-h-[330px] flex-col justify-between p-6 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent" icon={<Sparkles size={12} />} className={isImported ? '!border-slate-200/80 !bg-white/88 !text-slate-900 shadow-sm' : ''}>{listingBadge}</Badge>
                  {matchScore > 0 ? (
                    <span className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] shadow-[0_12px_30px_-20px_rgba(167,139,250,0.36)] backdrop-blur-xl',
                      isImported
                        ? 'border-violet-300/26 bg-white/84 text-violet-700'
                        : 'border-violet-300/24 bg-violet-400/14 text-violet-50'
                    )}>
                      <Sparkles size={11} />
                      {matchScore}% {copy.matchUpper}
                    </span>
                  ) : null}
                  {domainAccent ? (
                    <Badge variant="outline" className={isImported ? 'border-slate-200/70 bg-white/78 text-slate-700 backdrop-blur-xl' : 'border-white/24 bg-[rgba(8,14,28,0.46)] text-white backdrop-blur-xl'}>
                      {language === 'cs' || language === 'sk' ? domainAccent.label.cs : domainAccent.label.en}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_340px]">
                <div className={cn(
                  'space-y-4 rounded-[28px] border p-4 shadow-[0_24px_48px_-32px_rgba(0,0,0,0.86)] sm:p-5',
                  isImported
                    ? 'border-slate-200/76 bg-white/90 backdrop-blur-[20px]'
                    : 'border-white/12 bg-[rgba(3,6,16,0.78)] backdrop-blur-[30px]'
                )}>
                  <div className={cn(
                    'inline-flex max-w-full items-center gap-3 rounded-[22px] border px-3.5 py-3 backdrop-blur-2xl shadow-[0_20px_40px_-28px_rgba(0,0,0,0.82)]',
                    isImported
                      ? 'border-slate-200/70 bg-white/88'
                      : 'border-white/14 bg-[rgba(4,8,18,0.72)]'
                  )}>
                    {usePublisherMonogram ? (
                      <div className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-[20px] text-sm font-bold ring-1',
                        isImported ? 'bg-slate-100 text-slate-900 ring-slate-200' : 'bg-white/12 text-white ring-white/20'
                      )}>
                        {publisherInitials}
                      </div>
                    ) : (
                      <img
                        src={publisherAvatar}
                        alt={publisherName}
                        className={cn('h-14 w-14 rounded-[20px] object-cover ring-1', isImported ? 'ring-slate-200' : 'ring-white/20')}
                        loading="lazy"
                      />
                    )}
                    <div>
                      <div className={cn('text-sm font-semibold', isImported ? 'text-slate-900' : 'text-white')}>{publisherName}</div>
                      <div className={cn('text-sm', isImported ? 'text-slate-600' : 'text-white/78')}>{publisherRole}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h1 className={cn(
                      'max-w-4xl text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[2.8rem] lg:text-[3.4rem]',
                      isImported ? 'text-slate-950 [text-shadow:0_1px_0_rgba(255,255,255,0.25)]' : 'text-white'
                    )}>
                      {job.title}
                    </h1>
                    <div className={cn(
                      'inline-flex max-w-2xl rounded-[22px] border px-4 py-3 backdrop-blur-2xl shadow-[0_20px_40px_-28px_rgba(0,0,0,0.82)]',
                      isImported
                        ? 'border-slate-200/76 bg-white/92'
                        : 'border-white/14 bg-[rgba(4,8,18,0.74)]'
                    )}>
                      <p className={cn('text-sm leading-6 sm:text-base', isImported ? 'text-slate-700' : 'text-white')}>
                        {heroLead}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    <div className={cn(
                      'min-w-0 rounded-[18px] border px-3.5 py-3 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.72)]',
                      isImported
                        ? 'border-slate-200/76 bg-white/92'
                        : 'border-white/14 bg-[rgba(3,6,16,0.88)]'
                    )}>
                      <div className={cn('flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]', isImported ? 'text-slate-500' : 'text-white/62')}>
                        <MapPin size={13} />
                        {copy.location}
                      </div>
                      <div className={cn('mt-2 text-sm leading-6 break-words', isImported ? 'text-slate-800' : 'text-white')}>
                        {locationValue}
                      </div>
                    </div>
                    <div className={cn(
                      'min-w-0 rounded-[18px] border px-3.5 py-3 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.72)]',
                      isImported
                        ? 'border-slate-200/76 bg-white/92'
                        : 'border-white/14 bg-[rgba(3,6,16,0.88)]'
                    )}>
                      <div className={cn('flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]', isImported ? 'text-slate-500' : 'text-white/62')}>
                        <Compass size={13} />
                        {copy.workModel}
                      </div>
                      <div className={cn('mt-2 text-sm leading-6 break-words', isImported ? 'text-slate-800' : 'text-white')}>
                        {workModelValue}
                      </div>
                    </div>
                    <div className={cn(
                      'min-w-0 rounded-[18px] border px-3.5 py-3 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.72)]',
                      isImported
                        ? 'border-slate-200/76 bg-white/92'
                        : 'border-white/14 bg-[rgba(3,6,16,0.88)]'
                    )}>
                      <div className={cn('flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]', isImported ? 'text-slate-500' : 'text-white/62')}>
                        <Wallet size={13} />
                        {copy.salary}
                      </div>
                      <div className={cn('mt-2 text-sm leading-6 break-words', isImported ? 'text-slate-800' : 'text-white')}>
                        {displayedSalary}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    {isImported ? (
                      <button
                        type="button"
                        onClick={onOpenImportedListing}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                      >
                        <Sparkles size={15} />
                        {copy.importedButton}
                      </button>
                    ) : (
                      <a
                        href="#challenge-handshake"
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                      >
                        <Handshake size={15} />
                        {copy.handshakeCta}
                      </a>
                    )}
                    {!isImported && job.company_id ? (
                      <button
                        type="button"
                        onClick={() => onOpenCompanyPage(job.company_id!)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-[rgba(8,14,28,0.56)] px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-[rgba(8,14,28,0.7)]"
                      >
                        <Compass size={15} />
                        {copy.companyCta}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={cn(
                  'self-end rounded-[28px] border p-4 text-white shadow-[0_26px_60px_-36px_rgba(0,0,0,0.86)]',
                  isImported
                    ? 'border-slate-200/90 bg-white/92 text-slate-900 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.22)] backdrop-blur-[8px]'
                    : 'border-white/16 bg-[rgba(3,6,16,0.92)] backdrop-blur-[32px]'
                )}>
                  <div className={cn('mt-4 grid gap-3', isImported ? 'grid-cols-1' : matchScore > 0 ? 'sm:grid-cols-2 lg:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-1')}>
                    {matchScore > 0 ? (
                      <div className={cn('rounded-[22px] border px-4 py-4', isImported ? 'border-violet-200 bg-violet-50/90' : 'border-violet-300/12 bg-violet-400/10')}>
                        <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', isImported ? 'text-violet-600' : 'text-violet-100/78')}>{copy.match}</div>
                        <div className={cn('mt-2 text-lg font-semibold tracking-[-0.03em]', isImported ? 'text-slate-900' : 'text-white')}>{matchScore}%</div>
                      </div>
                    ) : null}
                    {[
                      { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, accent: true },
                      ...(!isImported ? [{ label: copy.location, value: locationValue, accent: false }] : []),
                      ...(!isImported && !matchScore ? [{ label: copy.workModel, value: workModelValue, accent: false }] : []),
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={item.accent
                          ? (isImported
                            ? 'rounded-[22px] border border-slate-200/90 bg-white/90 px-4 py-4 backdrop-blur-[6px]'
                            : 'rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.18)] px-4 py-4')
                          : (isImported
                            ? 'rounded-[22px] border border-slate-200/90 bg-white/90 px-4 py-4 backdrop-blur-[6px]'
                            : 'rounded-[22px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.08)] px-4 py-4')}
                      >
                        <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', isImported ? 'text-slate-500' : 'text-white/72')}>{item.label}</div>
                        <div className={cn(
                          'mt-2 font-semibold tracking-[-0.03em]',
                          isImported ? 'text-slate-900' : 'text-white',
                          item.label === copy.location || item.label === copy.workModel ? 'text-sm leading-6 break-words' : 'text-lg'
                        )}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {isImported ? (
                    <div className="mt-4 rounded-[22px] border border-slate-200/90 bg-white/90 p-3.5 backdrop-blur-[6px]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {copy.response}
                      </div>
                      <button
                        type="button"
                        onClick={onOpenImportedListing}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
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
          <div className="mx-auto w-full max-w-[1120px]">
            <SurfaceCard variant="spotlight" className="flex flex-wrap items-center justify-between gap-3">
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
                className="app-button-primary whitespace-nowrap"
              >
                {copy.importedButton}
              </button>
            </SurfaceCard>
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-[1120px]">
          <div className="space-y-5">
            <SurfaceCard variant="frost" className="space-y-5">
              <SectionTitle title={copy.insideTitle} />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="rounded-[26px] border border-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.16)] bg-[linear-gradient(135deg,rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.08),rgba(255,255,255,0.84))] p-5 dark:bg-[linear-gradient(135deg,rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.12),rgba(15,23,42,0.82))]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {isImported ? copy.importedSnapshot : copy.mission}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--text)]">{missionBody}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[20px] bg-white/70 px-4 py-3 dark:bg-white/6">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.firstStep}</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--text)]">{firstStep || challenge.firstStepPrompt}</div>
                      </div>
                      {riskBody ? (
                        <div className="rounded-[20px] bg-white/70 px-4 py-3 dark:bg-white/6">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.risk}</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--text)]">{riskBody}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-[var(--radius-lg)] border border-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.14)] bg-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.05)] p-4">
                    <div className="flex items-center gap-3">
                      {usePublisherMonogram ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.12)] text-sm font-bold text-[var(--text-strong)]">
                          {publisherInitials}
                        </div>
                      ) : (
                        <img src={publisherAvatar} alt={publisherName} className="h-14 w-14 rounded-[18px] object-cover" loading="lazy" />
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
              <details open className="group overflow-hidden rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left">
                  <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.importedDetail}</div>
                  <div className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm font-semibold text-[var(--text-muted)]">
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
                <SurfaceCard variant="spotlight" className="space-y-5">
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

            <SurfaceCard variant="spotlight" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle title={copy.aiWandTitle} />
                <div className="flex flex-wrap items-center gap-2">
                  {matchScore > 0 ? (
                    <div className="rounded-full bg-violet-500/10 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-violet-700 shadow-sm ring-1 ring-inset ring-violet-400/18 dark:text-violet-300">
                      {matchScore}% {copy.match}
                    </div>
                  ) : null}
                  <div className={cn(
                    'rounded-full px-3.5 py-2 text-xs font-bold shadow-sm ring-1 ring-inset',
                    decisionVerdict.tone === 'success'
                      ? 'bg-emerald-500/14 text-emerald-800 ring-emerald-500/20 dark:text-emerald-300'
                      : decisionVerdict.tone === 'warning'
                        ? 'bg-amber-500/14 text-amber-800 ring-amber-500/20 dark:text-amber-300'
                        : 'bg-violet-500/10 text-violet-700 ring-violet-400/18 dark:text-violet-300'
                  )}>
                    {decisionVerdict.title}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.financialTitle}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                        {decisionVerdict.body}
                      </div>
                    </div>
                    <div className="relative hidden h-12 w-24 shrink-0 overflow-hidden rounded-full bg-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.08)] md:block">
                      <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-[rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.35)]" />
                      <CarFront className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--accent)]" />
                      <MapPin className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                    </div>
                  </div>

                  {isMicroJobRole ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
                      {copy.financialNoteBody}
                    </div>
                  ) : !userProfile.isLoggedIn ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4">
                      <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.loginPrompt}</p>
                      <button type="button" onClick={onRequireAuth} className="app-button-primary mt-4">
                        {copy.signInCreate}
                      </button>
                    </div>
                  ) : (!userProfile.address && !userProfile.coordinates && !remoteRole) ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4">
                      <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.addressPrompt}</p>
                      <button type="button" onClick={onOpenProfile} className="app-button-secondary mt-4">
                        {copy.openProfile}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className={cn(
                          'rounded-[18px] border px-3 py-3',
                          commuteAnalysis && Number(commuteAnalysis.financialReality.finalRealMonthlyValue || 0) > 0
                            ? 'border-emerald-500/20 bg-emerald-50/75 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                            : 'border-amber-500/20 bg-amber-50/75 dark:border-amber-500/20 dark:bg-amber-500/10'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.takeHome}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {commuteAnalysis ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : displayedSalary}
                          </div>
                        </div>
                        <div className={cn(
                          'rounded-[18px] border px-3 py-3',
                          remoteRole || ((commuteAnalysis?.timeMinutes || 0) * 2) <= 90
                            ? 'border-emerald-500/20 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                            : ((commuteAnalysis?.timeMinutes || 0) * 2) >= 180
                              ? 'border-amber-500/20 bg-amber-50/75 dark:border-amber-500/20 dark:bg-amber-500/10'
                              : 'border-[var(--border-subtle)] bg-[var(--surface-muted)]'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteTime}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {remoteRole ? '0 min' : commuteAnalysis ? `${commuteAnalysis.timeMinutes * 2} min` : '—'}
                          </div>
                        </div>
                        <div className={cn(
                          'rounded-[18px] border px-3 py-3',
                          remoteRole || Number(commuteAnalysis?.financialReality.commuteCost || 0) <= 3000
                            ? 'border-emerald-500/20 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                            : Number(commuteAnalysis?.financialReality.commuteCost || 0) >= 10000
                              ? 'border-amber-500/20 bg-amber-50/75 dark:border-amber-500/20 dark:bg-amber-500/10'
                              : 'border-[var(--border-subtle)] bg-[var(--surface-muted)]'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.commuteCost}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {remoteRole ? copy.zeroCost : commuteAnalysis ? `${commuteAnalysis.financialReality.commuteCost.toLocaleString(locale)} ${commuteAnalysis.financialReality.currency}` : '—'}
                          </div>
                        </div>
                        <div className={cn(
                          'rounded-[18px] border px-3 py-3',
                          Number(commuteAnalysis?.jhiImpact || 0) >= 0
                            ? 'border-emerald-500/20 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                            : 'border-amber-500/20 bg-amber-50/75 dark:border-amber-500/20 dark:bg-amber-500/10'
                        )}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{copy.jhiImpact}</div>
                          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3.5 py-3.5">
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
                        <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3.5 py-3.5">
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
                        <div
                          className={cn(
                            'mt-3 rounded-[18px] px-3.5 py-3.5',
                            bullshitAnalysis.tone === 'bullshit'
                              ? 'border border-rose-200 bg-rose-50/92 dark:border-rose-400/22 dark:bg-rose-500/10'
                              : 'border border-amber-200 bg-amber-50/90 dark:border-amber-400/20 dark:bg-amber-500/10'
                          )}
                        >
                          <div className={cn(
                            'text-[10px] font-semibold uppercase tracking-[0.16em]',
                            bullshitAnalysis.tone === 'bullshit'
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-amber-700 dark:text-amber-300'
                          )}>
                            {copy.bullshitTitle}
                          </div>
                          <div className={cn(
                            'mt-1 text-xs font-semibold',
                            bullshitAnalysis.tone === 'bullshit'
                              ? 'text-rose-700 dark:text-rose-200'
                              : 'text-amber-700 dark:text-amber-200'
                          )}>
                            {bullshitAnalysis.tone === 'bullshit'
                              ? `${copy.bullshitSmells} (${bullshitAnalysis.score}/${bullshitAnalysis.maxScore})`
                              : `${copy.bullshitWatch} (${bullshitAnalysis.score}/${bullshitAnalysis.maxScore})`}
                          </div>
                          <div className={cn(
                            'mt-1.5 text-xs leading-5',
                            bullshitAnalysis.tone === 'bullshit'
                              ? 'text-rose-800 dark:text-rose-100/90'
                              : 'text-amber-800 dark:text-amber-100/90'
                          )}>
                            {bullshitAnalysis.summary}
                          </div>
                          {bullshitAnalysis.categories.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {bullshitAnalysis.categories.map((category) => (
                                <span
                                  key={category}
                                  className={cn(
                                    'app-organic-pill inline-flex items-center px-2.5 py-1 text-[11px] font-semibold',
                                    bullshitAnalysis.tone === 'bullshit'
                                      ? 'bg-rose-500/12 text-rose-700 dark:text-rose-200'
                                      : 'bg-amber-500/12 text-amber-700 dark:text-amber-200'
                                  )}
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
                                className={cn(
                                  'text-xs leading-5',
                                  bullshitAnalysis.tone === 'bullshit'
                                    ? 'text-rose-800 dark:text-rose-100/90'
                                    : 'text-amber-800 dark:text-amber-100/90'
                                )}
                              >
                                {signal}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {bullshitAnalysis.greenFlags.length > 0 ? (
                        <div className="mt-3 rounded-[18px] border border-emerald-200 bg-emerald-50/92 px-3.5 py-3.5 dark:border-emerald-400/22 dark:bg-emerald-500/10">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                            {copy.greenTitle}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                            {copy.greenSubtitle}
                          </div>
                          <div className="mt-1.5 text-xs leading-5 text-emerald-800 dark:text-emerald-100/90">
                            {bullshitAnalysis.greenSummary}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {bullshitAnalysis.greenFlags.map((flag) => (
                              <span
                                key={flag}
                                className="app-organic-pill inline-flex items-center bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200"
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
                  'rounded-[24px] border bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]',
                  matchScore > 0
                    ? 'border-violet-400/16'
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
                      'rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ring-1 ring-inset',
                      matchScore > 0
                        ? 'bg-violet-500/10 text-violet-700 ring-violet-400/18 dark:text-violet-300'
                        : commuteAnalysis
                        ? (commuteAnalysis.jhiImpact >= 0
                          ? 'bg-emerald-500/14 text-emerald-800 ring-emerald-500/20 dark:text-emerald-300'
                          : 'bg-amber-500/14 text-amber-800 ring-amber-500/20 dark:text-amber-300')
                        : 'bg-[var(--surface-muted)] text-[var(--text-muted)] ring-[var(--border-subtle)]'
                    )}>
                      {matchScore > 0
                        ? `${matchScore}% ${copy.match}`
                        : `${copy.jhiImpact}: ${commuteAnalysis ? `${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}` : '—'}`}
                    </div>
                  </div>

                  <div className="mt-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2.5">
                    <JHIChart jhi={job.jhi} theme={isDarkTheme ? 'dark' : 'light'} compact />
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {jhiDimensions.map((dimension) => (
                      <div key={dimension.key} className="rounded-[16px] border border-[rgba(15,23,42,0.08)] bg-white/88 px-3 py-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.3)] dark:border-[var(--border-subtle)] dark:bg-[var(--surface-muted)]">
                        <div className="text-xs font-medium text-[var(--text-muted)]">{dimension.label}</div>
                        <div className="mt-1 flex items-end justify-between gap-3">
                          <span className="text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{Math.round(dimension.value)}/100</span>
                          <span className="h-2.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-white/8">
                            <span
                              className="block h-full rounded-full bg-[linear-gradient(90deg,rgba(var(--detail-accent-rgb,var(--accent-rgb)),0.98),rgba(var(--accent-sky-rgb),0.82))] shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset]"
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
