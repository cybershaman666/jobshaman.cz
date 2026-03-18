import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import {
  ArrowLeft,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FEATURE_SALARY_BENCHMARKS } from '../../constants';
import { fetchSalaryBenchmark } from '../../services/benchmarkService';
import { calculateCommuteReality, isRemoteJob } from '../../services/commuteService';
import { fetchJobHumanContext } from '../../services/jobService';
import { formatJobDescription } from '../../utils/formatters';
import { CommuteAnalysis, Job, JobHumanContext, MicroJobCollaborationMode, MicroJobLongTermPotential, SalaryBenchmarkResolved, UserProfile } from '../../types';
import ChallengeComposer from './ChallengeComposer';
import { MetricTile, PageHeader, SurfaceCard } from '../ui/primitives';
import {
  ChallengeFinancialSection,
  ChallengeHumanContextSection,
  ChallengeRealityActions,
  NarrativeCard,
  SectionTitle,
} from './ChallengeDetailSections';
import { getChallengeFocusCopy, getMicroJobCopy } from './challengeDetailCopy';

const DetailFact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-3 py-2.5 dark:bg-slate-950">
    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</div>
    <div className="mt-1 text-sm font-medium text-[var(--text-strong)]">{value}</div>
  </div>
);

interface ChallengeFocusViewProps {
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

const stripMarkdown = (value: string | null | undefined): string => {
  return String(value || '')
    .replace(/[#>*_`~[\]()!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const shorten = (value: string | null | undefined, maxLength = 220): string => {
  const plain = stripMarkdown(value);
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 3).trim()}...`;
};

const normalizeBenefitChips = (benefits: string[] | null | undefined): string[] => {
  if (!Array.isArray(benefits) || benefits.length === 0) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  benefits.forEach((rawBenefit) => {
    const raw = stripMarkdown(rawBenefit);
    if (!raw) return;

    const chunks = raw.length > 120
      ? raw.split(/[\n;|•]+/g)
      : [raw];

    chunks.forEach((chunk) => {
      const cleaned = chunk
        .replace(/^(náplň práce|požadujeme|požadovaný profil|odpovědnosti|responsibilities|requirements|deine aufgaben)\s*:?\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleaned) return;
      if (cleaned.length > 64) return;
      if (cleaned.split(' ').length > 8) return;

      const key = cleaned.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push(cleaned);
    });
  });

  return normalized.slice(0, 8);
};

const isMicroJob = (job: Job): boolean => job.challenge_format === 'micro_job';

const getMicroJobKindLabel = (kind: Job['micro_job_kind'], language: string): string | null => {
  if (!kind) return null;
  const locale = language === 'at' ? 'de' : language;
  const labels: Record<NonNullable<Job['micro_job_kind']>, Record<'cs' | 'sk' | 'de' | 'pl' | 'en', string>> = {
    one_off_task: { cs: 'Jednorázový task', sk: 'Jednorazový task', de: 'Einmalige Aufgabe', pl: 'Jednorazowe zadanie', en: 'One-off task' },
    short_project: { cs: 'Krátký projekt', sk: 'Krátky projekt', de: 'Kurzprojekt', pl: 'Krótki projekt', en: 'Short project' },
    audit_review: { cs: 'Audit / review', sk: 'Audit / review', de: 'Audit / Review', pl: 'Audyt / review', en: 'Audit / review' },
    prototype: { cs: 'Prototyp', sk: 'Prototyp', de: 'Prototyp', pl: 'Prototyp', en: 'Prototype' },
    experiment: { cs: 'Experiment', sk: 'Experiment', de: 'Experiment', pl: 'Eksperyment', en: 'Experiment' }
  };
  return labels[kind]?.[locale as 'cs' | 'sk' | 'de' | 'pl' | 'en'] || labels[kind]?.en || null;
};

const getMicroJobCollaborationLabel = (
  modes: Job['micro_job_collaboration_modes'],
  language: string
): string | null => {
  if (!Array.isArray(modes) || modes.length === 0) return null;
  const locale = language === 'at' ? 'de' : language;
  const labels: Record<MicroJobCollaborationMode, Record<'cs' | 'sk' | 'de' | 'pl' | 'en', string>> = {
    remote: { cs: 'Remote', sk: 'Remote', de: 'Remote', pl: 'Remote', en: 'Remote' },
    async: { cs: 'Asynchronně', sk: 'Asynchrónne', de: 'Asynchron', pl: 'Asynchronicznie', en: 'Async' },
    call: { cs: 'Call', sk: 'Call', de: 'Call', pl: 'Call', en: 'Call' }
  };
  return modes.map((mode) => labels[mode]?.[locale as 'cs' | 'sk' | 'de' | 'pl' | 'en'] || labels[mode]?.en || mode).join(' • ');
};

const getMicroJobLongTermPotentialLabel = (
  value: Job['micro_job_long_term_potential'],
  language: string
): string | null => {
  if (!value) return null;
  const locale = language === 'at' ? 'de' : language;
  const labels: Record<MicroJobLongTermPotential, Record<'cs' | 'sk' | 'de' | 'pl' | 'en', string>> = {
    yes: { cs: 'Ano', sk: 'Áno', de: 'Ja', pl: 'Tak', en: 'Yes' },
    maybe: { cs: 'Možná', sk: 'Možno', de: 'Vielleicht', pl: 'Możliwe', en: 'Maybe' },
    no: { cs: 'Ne', sk: 'Nie', de: 'Nein', pl: 'Nie', en: 'No' }
  };
  return labels[value]?.[locale as 'cs' | 'sk' | 'de' | 'pl' | 'en'] || labels[value]?.en || null;
};

const formatSalary = (job: Job, locale: string, fallbackLabel: string, fallbackCurrency: string): string => {
  if (job.salaryRange) return job.salaryRange;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || fallbackCurrency;
  if (from && to) return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  if (from || to) return `${(from || to).toLocaleString(locale)} ${currency}`;
  return fallbackLabel;
};

const ChallengeFocusView: React.FC<ChallengeFocusViewProps> = ({
  job,
  userProfile,
  firstQualityActionAt,
  onBack,
  onRequireAuth,
  onOpenProfile,
  onOpenSupportingContext,
  onOpenCompanyPage,
  onOpenImportedListing
}) => {
  const { i18n } = useTranslation();
  const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
  const [salaryBenchmark, setSalaryBenchmark] = useState<SalaryBenchmarkResolved | null>(null);
  const [humanContext, setHumanContext] = useState<JobHumanContext | null>(null);
  const [showFirstContactGuide, setShowFirstContactGuide] = useState(false);
  const locale = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();
  const language = ['cs', 'sk', 'de', 'at', 'pl'].includes(locale) ? locale : 'en';
  const isCsLike = language === 'cs' || language === 'sk';
  const isImported = job.listingKind === 'imported';
  const isMicroJobRole = isMicroJob(job);
  const isNativeChallenge = !isImported && Boolean(job.company_id) && String(job.source || '').trim().toLowerCase() === 'jobshaman.cz';
  const remoteRole = isRemoteJob(job);
  const firstContactGuideStorageKey = 'jobshaman_first_contact_guide_dismissed';

  const copy = getChallengeFocusCopy(language, isImported);
  const microJobCopy = getMicroJobCopy(language);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (firstQualityActionAt) {
      setShowFirstContactGuide(false);
      return;
    }
    const dismissed = window.localStorage.getItem(firstContactGuideStorageKey) === 'true';
    setShowFirstContactGuide(!dismissed);
  }, [firstQualityActionAt]);

  const dismissFirstContactGuide = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(firstContactGuideStorageKey, 'true');
    }
    setShowFirstContactGuide(false);
  };

  useEffect(() => {
    if (!userProfile.isLoggedIn || ((!userProfile.address && !userProfile.coordinates) && !remoteRole)) {
      setCommuteAnalysis(null);
      return;
    }
    try {
      const commuteProfile = userProfile.address
        ? userProfile
        : {
            ...userProfile,
            address: copy.currentLocation
          };
      setCommuteAnalysis(calculateCommuteReality(job, commuteProfile));
    } catch (error) {
      console.warn('Failed to calculate commute reality:', error);
      setCommuteAnalysis(null);
    }
  }, [isCsLike, job, remoteRole, userProfile]);

  useEffect(() => {
    let cancelled = false;

    const loadBenchmark = async () => {
      if (!FEATURE_SALARY_BENCHMARKS || isMicroJobRole) {
        setSalaryBenchmark(null);
        return;
      }
      try {
        const benchmark = await fetchSalaryBenchmark(job.id);
        if (!cancelled) setSalaryBenchmark(benchmark);
      } catch (error) {
        console.warn('Salary benchmark fetch failed:', error);
        if (!cancelled) setSalaryBenchmark(null);
      }
    };

    void loadBenchmark();
    return () => {
      cancelled = true;
    };
  }, [isMicroJobRole, job.id]);

  useEffect(() => {
    let cancelled = false;

    const loadHumanContext = async () => {
      if (!isNativeChallenge) {
        setHumanContext(null);
        return;
      }
      try {
        const payload = await fetchJobHumanContext(job.id);
        if (!cancelled) {
          setHumanContext(payload);
        }
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

  const formattedDescription = useMemo(() => formatJobDescription(job.description || ''), [job.description]);

  const whyNowBody = useMemo(
    () => shorten(job.challenge || job.aiAnalysis?.summary || job.description, 260),
    [job.aiAnalysis?.summary, job.challenge, job.description]
  );
  const riskBody = useMemo(
    () => shorten(job.risk || job.aiAnalysis?.culturalFit || job.noiseMetrics?.keywords?.join(', '), 220),
    [job.aiAnalysis?.culturalFit, job.noiseMetrics?.keywords, job.risk]
  );
  const responsePrompt = job.firstStepPrompt || shorten(job.description, 180);
  const companySignal = shorten(job.companyPageSummary || job.aiAnalysis?.summary || job.description, 220);
  const displayedSalary = formatSalary(job, i18n.language, copy.salaryMissing, copy.defaultCurrency);
  const locationValue = shorten(job.location, 72) || copy.locationMissing;
  const companyValue = shorten(job.company, 72) || copy.companyMissing;
  const nativeHeroLead = copy.nativeHeroLead;
  const importedHeroLead = copy.importedHeroLead;
  const microJobKindValue = getMicroJobKindLabel(job.micro_job_kind, language);
  const microJobCollaborationValue = getMicroJobCollaborationLabel(job.micro_job_collaboration_modes, language);
  const microJobLongTermPotentialValue = getMicroJobLongTermPotentialLabel(job.micro_job_long_term_potential, language);
  const benefitChips = useMemo(() => normalizeBenefitChips(job.benefits), [job.benefits]);
  const realIncomeValue = commuteAnalysis
    ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`
    : displayedSalary;
  const commuteValue = remoteRole
    ? '0 km'
    : commuteAnalysis
      ? `${commuteAnalysis.distanceKm} km`
      : userProfile.isLoggedIn
        ? copy.addAddress
        : copy.afterSignIn;
  const mobilePrimaryInsights = isMicroJobRole
    ? [
        { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
        { label: microJobCopy.budget, value: displayedSalary },
        { label: copy.workModel, value: job.work_model || job.type || '—' },
        { label: copy.location, value: locationValue }
      ]
    : [
        { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
        { label: copy.salary, value: displayedSalary },
        { label: copy.workModel, value: job.work_model || job.type || '—' },
        { label: copy.location, value: locationValue }
      ];
  const mobileSecondaryInsights = isMicroJobRole
    ? [
        ...(job.micro_job_time_estimate ? [{ label: microJobCopy.timeEstimate, value: job.micro_job_time_estimate }] : []),
        ...(microJobCollaborationValue ? [{ label: microJobCopy.collaboration, value: microJobCollaborationValue }] : []),
        ...(microJobLongTermPotentialValue ? [{ label: microJobCopy.longTermPotential, value: microJobLongTermPotentialValue }] : []),
        ...(microJobKindValue ? [{ label: microJobCopy.type, value: microJobKindValue }] : []),
        { label: copy.company, value: companyValue },
        { label: copy.source, value: job.source || '—' }
      ]
    : [
        { label: copy.realIncome, value: realIncomeValue },
        { label: copy.commuteDistance, value: commuteValue },
        { label: copy.company, value: companyValue },
        { label: copy.source, value: job.source || '—' }
      ];
  const trustDialoguesCount = humanContext?.trust?.dialogues_last_90d ?? null;
  const trustResponseHours = humanContext?.trust?.median_first_response_hours_last_90d ?? null;
  const hasHumanContextContent = Boolean(
    humanContext?.publisher ||
    (humanContext?.responders?.length || 0) > 0 ||
    (typeof trustDialoguesCount === 'number' && trustDialoguesCount > 0) ||
    trustResponseHours != null
  );
  const jhiDimensions = [
    { key: 'financial', label: copy.jhiDimensionFinancial, value: Number(job.jhi?.financial || 0) },
    { key: 'timeCost', label: copy.jhiDimensionTimeCost, value: Number(job.jhi?.timeCost || 0) },
    { key: 'mentalLoad', label: copy.jhiDimensionMentalLoad, value: Number(job.jhi?.mentalLoad || 0) },
    { key: 'growth', label: copy.jhiDimensionGrowth, value: Number(job.jhi?.growth || 0) },
    { key: 'values', label: copy.jhiDimensionValues, value: Number(job.jhi?.values || 0) }
  ]
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 3);

  const formatTrustResponseLabel = () => {
    if (trustResponseHours == null) return null;
    if (trustResponseHours < 1) return copy.trustResponseUnderHour;
    const normalizedHours = Number.isInteger(trustResponseHours)
      ? String(Math.round(trustResponseHours))
      : trustResponseHours.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
    return copy.trustResponse.replace('{{hours}}', normalizedHours);
  };

  const humanContextSection = hasHumanContextContent ? (
    <ChallengeHumanContextSection
      humanContext={humanContext}
      trustLabels={[
        typeof trustDialoguesCount === 'number' && trustDialoguesCount > 0
          ? copy.trustDialogues.replace('{{count}}', trustDialoguesCount.toLocaleString(i18n.language))
          : '',
        formatTrustResponseLabel() || ''
      ].filter(Boolean)}
      copy={{
        publisherLabel: copy.publisherLabel,
        respondersLabel: copy.respondersLabel,
        teamTrustLabel: copy.teamTrustLabel,
        humanContextFallbackRole: copy.humanContextFallbackRole,
      }}
    />
  ) : null;

  const financialSection = (
    <ChallengeFinancialSection
      job={job}
      userProfile={userProfile}
      commuteAnalysis={commuteAnalysis}
      salaryBenchmark={salaryBenchmark}
      isMicroJobRole={isMicroJobRole}
      remoteRole={remoteRole}
      copy={copy as Record<string, string>}
      microJobCopy={microJobCopy as Record<string, string>}
      locale={i18n.language}
      onRequireAuth={onRequireAuth}
      onOpenProfile={onOpenProfile}
    />
  );

  const renderImportedDecisionRail = () => (
    <div className="space-y-5">
      {financialSection}

      <SurfaceCard className="space-y-4">
        <SectionTitle title={copy.jhiTitle} />
        <div className="space-y-3">
          <MetricTile
            label={copy.fit}
            value={`${Math.round(job.jhi?.score || 0)}/100`}
            tone="accent"
          />
          <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.jhiBody}</p>
        </div>
        {jhiDimensions.length > 0 ? (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {copy.jhiTopSignals}
            </div>
            <div className="grid gap-3">
              {jhiDimensions.map((dimension) => (
                <MetricTile
                  key={dimension.key}
                  label={dimension.label}
                  value={`${Math.round(dimension.value)}/100`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </SurfaceCard>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1720px] space-y-5 pb-8">
      <button type="button" onClick={onBack} className="app-button-secondary !px-3.5 !py-2.5">
        <ArrowLeft size={16} />
        {copy.back}
      </button>

      <PageHeader
        eyebrow={isMicroJobRole ? `${microJobCopy.badge} • ${copy.eyebrow}` : copy.eyebrow}
        title={job.title}
        body={isImported ? copy.importedRealityBody : copy.body}
        className="rounded-[8px] bg-white shadow-none dark:bg-slate-950"
        variant="default"
        actions={
          <div className="hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-4">
            <DetailFact label={copy.fit} value={`${Math.round(job.jhi?.score || 0)}/100`} />
            <DetailFact label={copy.company} value={companyValue} />
            <DetailFact label={copy.location} value={locationValue} />
            <DetailFact label={isMicroJobRole ? microJobCopy.budget : copy.salary} value={displayedSalary} />
          </div>
        }
      >
        {isImported ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
            <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-5 py-4 dark:bg-slate-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.importedRealityTitle}</div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{importedHeroLead}</p>
            </div>
            <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-5 py-4 dark:bg-slate-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.importedHandshakeHintTitle}</div>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{copy.importedHandshakeHintBody}</p>
              {job.url ? (
                <button type="button" onClick={onOpenImportedListing} className="app-button-primary mt-4">
                  <ArrowUpRight size={16} />
                  {copy.importedActionCta}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-5 py-4 dark:bg-slate-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {humanContext?.publisher ? copy.publisherLabel : copy.decision}
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                {humanContext?.publisher?.short_context || nativeHeroLead}
              </p>
            </div>
            <div className="rounded-[6px] border border-[var(--border-subtle)] bg-white px-5 py-4 dark:bg-slate-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {humanContext?.publisher ? humanContext.publisher.display_name : copy.company}
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                {humanContext?.publisher?.display_role || companyValue}
              </p>
            </div>
          </div>
        )}
      </PageHeader>

      {!isImported ? (
      <div className="grid gap-4">
        <>
          <SurfaceCard className="space-y-4 rounded-[8px] bg-white shadow-none dark:bg-slate-950">
            <SectionTitle title={copy.quickInsights} />
            <div className="grid gap-2 sm:grid-cols-2">
              {mobilePrimaryInsights.map((item, index) => (
                <DetailFact key={`${item.label}-${index}`} label={item.label} value={item.value} />
              ))}
            </div>
            <div className="grid gap-2">
              {mobileSecondaryInsights.map((item, index) => (
                <DetailFact key={`${item.label}-secondary-${index}`} label={item.label} value={item.value} />
              ))}
            </div>
          </SurfaceCard>

          <ChallengeRealityActions
            copy={{
              reality: copy.reality,
              openCompany: copy.openCompany,
              openContext: copy.openContext,
              openListing: copy.openListing,
            }}
            job={job}
            onOpenCompanyPage={onOpenCompanyPage}
            onOpenSupportingContext={onOpenSupportingContext}
            onOpenImportedListing={onOpenImportedListing}
          />
        </>
      </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-1">
        <div className="space-y-5">
          <SurfaceCard className="space-y-5">
            <SectionTitle title={isImported ? copy.importedDecision : copy.decision} />
            {isImported ? (
              <div className="prose prose-slate max-w-none prose-headings:tracking-[-0.03em] prose-headings:text-[var(--text-strong)] prose-p:text-[var(--text)] prose-li:text-[var(--text)] prose-strong:text-[var(--text-strong)] dark:prose-headings:text-[var(--text-strong)] dark:prose-strong:text-[var(--text-strong)]">
                {formattedDescription ? (
                  <Markdown>{formattedDescription}</Markdown>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">{copy.noDescription}</p>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.challenge}</div>
                  <h2 className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-[var(--text-strong)] md:text-[1.9rem]">
                    {whyNowBody || '—'}
                  </h2>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <NarrativeCard title={copy.risk} body={riskBody} />
                  <NarrativeCard title={copy.question} body={responsePrompt} tone="accent" />
                </div>

                {showFirstContactGuide ? (
                  <SurfaceCard className="space-y-4 rounded-[8px] border-[var(--border-subtle)] bg-white shadow-none dark:bg-slate-950">
                    <div className="space-y-2">
                      <div className="app-eyebrow w-fit bg-[var(--surface)] text-[var(--text-faint)] border-[var(--border-subtle)]">
                        <Sparkles size={12} />
                        {copy.firstContactGuideTitle}
                      </div>
                      <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{copy.firstContactGuideBody}</p>
                    </div>
                    <div className="grid gap-2.5 text-sm leading-6 text-[var(--text)]">
                      {[copy.firstContactGuidePointOne, copy.firstContactGuidePointTwo, copy.firstContactGuidePointThree].map((point) => (
                        <div key={point} className="flex items-start gap-2.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={onOpenSupportingContext} className="app-button-secondary">
                        {copy.firstContactGuideContext}
                      </button>
                      <button type="button" onClick={dismissFirstContactGuide} className="app-button-secondary">
                        {copy.firstContactGuideDismiss}
                      </button>
                    </div>
                  </SurfaceCard>
                ) : null}

                <ChallengeComposer
                  job={job}
                  userProfile={userProfile}
                  onRequireAuth={onRequireAuth}
                  onOpenSupportingContext={onOpenSupportingContext}
                />
              </div>
            )}
          </SurfaceCard>

          {!isImported ? (
            <>
          {financialSection}

          {isImported ? renderImportedDecisionRail() : null}

              <SurfaceCard className="hidden space-y-5 rounded-[8px] bg-white shadow-none md:block dark:bg-slate-950">
                <SectionTitle title={copy.company} />
                <div className="space-y-4">
                  <NarrativeCard title={copy.companySignal} body={companySignal} />
                  {humanContextSection}
                  {!isMicroJobRole ? (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.benefitsList}</div>
                      <div className="flex flex-wrap items-start gap-2">
                      {benefitChips.length > 0 ? (
                        benefitChips.map((benefit) => (
                          <span
                            key={benefit}
                            title={benefit}
                            className="max-w-full rounded-[999px] border border-[var(--border-subtle)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-muted)] dark:bg-slate-950"
                          >
                            <span className="block max-w-[280px] truncate">{benefit}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[var(--text-faint)]">—</span>
                      )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </SurfaceCard>

              <details className="group rounded-[6px] border border-[var(--border-subtle)] bg-white p-4 shadow-none md:hidden dark:bg-slate-950">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--text-strong)]">
                  <span>{copy.moreCompany}</span>
                  <span className="text-[var(--text-faint)] transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="mt-4 space-y-4">
                  <NarrativeCard title={copy.companySignal} body={companySignal} />
                  {humanContextSection}
                  {!isMicroJobRole ? (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.benefitsList}</div>
                      <div className="flex flex-wrap items-start gap-2">
                        {benefitChips.length > 0 ? (
                          benefitChips.map((benefit) => (
                            <span
                              key={`mobile-${benefit}`}
                              title={benefit}
                              className="max-w-full rounded-[999px] border border-[var(--border-subtle)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-muted)] dark:bg-slate-950"
                            >
                              <span className="block max-w-[280px] truncate">{benefit}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[var(--text-faint)]">—</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>

              <SurfaceCard className="hidden space-y-5 rounded-[8px] bg-white shadow-none md:block dark:bg-slate-950">
                <SectionTitle title={copy.originalListing} />
                <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.originalBody}</p>
                <div className="prose prose-slate max-w-none prose-headings:tracking-[-0.03em] prose-headings:text-[var(--text-strong)] prose-p:text-[var(--text)] prose-li:text-[var(--text)] prose-strong:text-[var(--text-strong)] dark:prose-headings:text-[var(--text-strong)] dark:prose-strong:text-[var(--text-strong)]">
                  {formattedDescription ? (
                    <Markdown>{formattedDescription}</Markdown>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">{copy.noDescription}</p>
                  )}
                </div>
              </SurfaceCard>

              <details className="group rounded-[6px] border border-[var(--border-subtle)] bg-white p-4 shadow-none md:hidden dark:bg-slate-950">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--text-strong)]">
                  <span>{copy.moreOriginal}</span>
                  <span className="text-[var(--text-faint)] transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.originalBody}</p>
                  <div className="prose prose-slate max-w-none prose-headings:tracking-[-0.03em] prose-headings:text-[var(--text-strong)] prose-p:text-[var(--text)] prose-li:text-[var(--text)] prose-strong:text-[var(--text-strong)] dark:prose-headings:text-[var(--text-strong)] dark:prose-strong:text-[var(--text-strong)]">
                    {formattedDescription ? (
                      <Markdown>{formattedDescription}</Markdown>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">{copy.noDescription}</p>
                    )}
                  </div>
                </div>
              </details>
            </>
          ) : null}
        </div>

      </div>
    </div>
  );
};

export default ChallengeFocusView;
