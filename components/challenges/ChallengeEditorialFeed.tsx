import React, { useMemo } from 'react';
import { ArrowRight, Bookmark, Clock, MapPin, Sparkles } from 'lucide-react';
import type { Job } from '../../types';
import { isRemoteJob } from '../../services/commuteService';
import { cn } from '../ui/primitives';
import { getFallbackCompanyAvatarUrl, isStockCompanyAvatarUrl } from '../../utils/companyStockAvatars';
import { analyzeJobBullshit } from '../../utils/bullshitDetector';
import { getDomainAccent, resolveJobDomain } from '../../utils/domainAccents';
import { sortJobsForDiscovery } from '../../services/candidateIntentService';
import { getStockCoverForDomain } from '../../utils/domainCoverImages';

interface ChallengeEditorialFeedProps {
  jobs: Job[];
  loading?: boolean;
  selectedJobId: string | null;
  savedJobIds: string[];
  locale: string;
  compactLayout?: boolean;
  onSelect: (jobId: string) => void;
  onOpen: (jobId: string) => void;
  onToggleSave: (jobId: string) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const localeText = (
  language: string,
  labels: { cs: string; sk: string; de: string; pl: string; en: string }
): string => {
  if (language === 'cs') return labels.cs;
  if (language === 'sk') return labels.sk;
  if (language === 'de' || language === 'at') return labels.de;
  if (language === 'pl') return labels.pl;
  return labels.en;
};

const getCompanyInitials = (companyName: string): string => {
  const parts = String(companyName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'JS';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR');
  if (from && to) return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  if (from || to) return `${(from || to).toLocaleString(locale)} ${currency}`;
  return isCsLike ? 'Mzda neuvedena' : 'Salary not specified';
};

const salaryAnchor = (job: Job): number => {
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  if (to) return to;
  if (from) return from;
  const aiMax = Number(job.aiEstimatedSalary?.max || 0);
  const aiMin = Number(job.aiEstimatedSalary?.min || 0);
  return aiMax || aiMin || 0;
};

const reactionWindowHours = (job: Job): number | null => {
  const hours = Number(job.reaction_window_hours ?? 0);
  if (Number.isFinite(hours) && hours > 0) return hours;
  const days = Number(job.reaction_window_days ?? 0);
  if (Number.isFinite(days) && days > 0) return days * 24;
  return null;
};

const formatRelativePostedAt = (job: Job, language: string): string => {
  const source = String(job.scrapedAt || job.postedAt || '').trim();
  if (!source) return '';

  const parsedDate = new Date(source);
  if (Number.isNaN(parsedDate.getTime())) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / 1000));
  const locale = language === 'cs'
    ? 'cs-CZ'
    : language === 'sk'
      ? 'sk-SK'
      : language === 'de' || language === 'at'
        ? 'de-DE'
        : language === 'pl'
          ? 'pl-PL'
          : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSeconds < 60) return rtf.format(0, 'second');
  if (diffSeconds < 3600) return rtf.format(-Math.floor(diffSeconds / 60), 'minute');
  if (diffSeconds < 86400) return rtf.format(-Math.floor(diffSeconds / 3600), 'hour');
  if (diffSeconds < 604800) return rtf.format(-Math.floor(diffSeconds / 86400), 'day');
  if (diffSeconds < 2_629_800) return rtf.format(-Math.floor(diffSeconds / 604800), 'week');
  return rtf.format(-Math.floor(diffSeconds / 2_629_800), 'month');
};

const generateWhyItFitsReasons = (job: Job, language: string): string[] => {
  const reasons: string[] = [];

  // Match reasons from backend/inference
  if (job.matchReasons && job.matchReasons.length > 0) {
    job.matchReasons.forEach((r) => {
      reasons.push(localeText(language, {
        cs: `✔ Shoda: ${r}`,
        sk: `✔ Zhoda: ${r}`,
        de: `✔ Match: ${r}`,
        pl: `✔ Dopasowanie: ${r}`,
        en: `✔ Match: ${r}`,
      }));
    });
  }

  // Commute distance check (under 40 km)
  const distance = Number(job.distanceKm ?? 0);
  if (Number.isFinite(distance) && distance > 0 && distance < 40) {
    reasons.push(localeText(language, {
      cs: `✔ Dojezd ${Math.round(distance)} km`,
      sk: `✔ Dochádzka ${Math.round(distance)} km`,
      de: `✔ Pendeln ${Math.round(distance)} km`,
      pl: `✔ Dojazd ${Math.round(distance)} km`,
      en: `✔ Commute ${Math.round(distance)} km`,
    }));
  }

  // Salary above target 
  const salaryTo = Number(job.salary_to || 0);
  if (salaryTo > 50000) {
    reasons.push(localeText(language, {
      cs: '✔ Mzda nad cíl',
      sk: '✔ Mzda nad cieľ',
      de: '✔ Gehalt über Ziel',
      pl: '✔ Pensja powyżej celu',
      en: '✔ Salary above target',
    }));
  }

  // Remote option
  const isRemote = isRemoteJob(job) || String(job.type || '').toLowerCase() === 'remote';
  if (isRemote) {
    reasons.push(localeText(language, {
      cs: '✔ Práce z domova',
      sk: '✔ Práca z domu',
      de: '✔ Remote-Arbeit',
      pl: '✔ Praca zdalna',
      en: '✔ Remote work',
    }));
  } else if (String(job.type || '').toLowerCase() === 'hybrid') {
    reasons.push(localeText(language, {
      cs: '✔ Flexibilní režim',
      sk: '✔ Flexibilný režim',
      de: '✔ Flexibles Modell',
      pl: '✔ Elastyczny tryb',
      en: '✔ Flexible model',
    }));
  }

  // High JHI score
  if (reasons.length < 4) {
    const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);
    if (jhiScore >= 75) {
      reasons.push(localeText(language, {
        cs: `✔ Vysoký JHI (${jhiScore})`,
        sk: `✔ Vysoké JHI (${jhiScore})`,
        de: `✔ Hohes JHI (${jhiScore})`,
        pl: `✔ Wysokie JHI (${jhiScore})`,
        en: `✔ High JHI (${jhiScore})`,
      }));
    } else if (jhiScore >= 60) {
      reasons.push(localeText(language, {
        cs: `✔ Dobrý JHI (${jhiScore})`,
        sk: `✔ Dobré JHI (${jhiScore})`,
        de: `✔ Gutes JHI (${jhiScore})`,
        pl: `✔ Dobre JHI (${jhiScore})`,
        en: `✔ Good JHI (${jhiScore})`,
      }));
    }
  }

  // Quick response window (companies respond quickly)
  if (reasons.length < 4) {
    const reactionHours = reactionWindowHours(job);
    if (reactionHours !== null && reactionHours <= 48) {
      reasons.push(localeText(language, {
        cs: '✔ Firmy odpovídají rychle',
        sk: '✔ Firmy odpovedajú rýchlo',
        de: '✔ Firmen antworten schnell',
        pl: '✔ Firmy odpowiadają szybko',
        en: '✔ Fast company response',
      }));
    }
  }

  if (reasons.length === 0) {
    reasons.push(localeText(language, {
      cs: '✔ Odpovídá tvému profilu',
      sk: '✔ Sedí na tvoj profil',
      de: '✔ Passt zu Ihrem Profil',
      pl: '✔ Pasuje do Twojego profilu',
      en: '✔ Matches your profile',
    }));
  }

  return reasons.slice(0, 4); // Limit to 4 reasons
};

const whySectionTitle = (language: string): string => localeText(language, {
  cs: 'Proč to vidíš',
  sk: 'Prečo to vidíš',
  de: 'Warum du das siehst',
  pl: 'Dlaczego to widzisz',
  en: 'Why you are seeing this',
});

const getExternalSourceLabel = (job: Job, language: string): string | null => {
  const haystack = `${job.source || ''} ${job.url || ''}`.toLowerCase();
  if (haystack.includes('jooble')) return 'Jooble';
  if (haystack.includes('weworkremotely')) return 'WeWorkRemotely';
  if (haystack.includes('arbeitnow')) return 'Arbeitnow';
  if (job.searchDiagnostics?.source === 'cached_external' || job.searchDiagnostics?.source === 'live_external') {
    return localeText(language, {
      cs: 'Externí zdroj',
      sk: 'Externý zdroj',
      de: 'Externe Quelle',
      pl: 'Źródło zewnętrzne',
      en: 'External source',
    });
  }
  return null;
};

const getCardVerdict = (job: Job, language: string) => {
  const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);
  const distance = Number(job.distanceKm || 0);
  const isRemote = (() => {
    try {
      return isRemoteJob(job) || String(job.type || '').toLowerCase() === 'remote';
    } catch {
      return String(job.type || '').toLowerCase() === 'remote';
    }
  })();
  const salaryTop = Number(job.salary_to || job.salary_from || 0);

  if ((jhiScore >= 72 && (isRemote || distance === 0 || distance <= 35)) || (jhiScore >= 78 && salaryTop >= 60000)) {
    return {
      label: localeText(language, {
        cs: 'Stojí za handshake',
        sk: 'Stojí za handshake',
        de: 'Handshake lohnt sich',
        pl: 'Warto podać rękę',
        en: 'Worth a handshake',
      }),
      tone: 'good' as const,
    };
  }

  if (jhiScore < 55 || (!isRemote && distance >= 80)) {
    return {
      label: localeText(language, {
        cs: 'Spíš ne',
        sk: 'Skôr nie',
        de: 'Eher nicht',
        pl: 'Raczej nie',
        en: 'Probably skip',
      }),
      tone: 'bad' as const,
    };
  }

  return {
    label: localeText(language, {
      cs: 'Prověřit blíž',
      sk: 'Preveriť bližšie',
      de: 'Genauer prüfen',
      pl: 'Sprawdź bliżej',
      en: 'Check more closely',
    }),
    tone: 'neutral' as const,
  };
};

type FeedSection = {
  key: string;
  title: { cs: string; en: string };
  subtitle?: { cs: string; en: string };
  layout: 'hero' | 'grid' | 'grid_large';
  tone?: 'default' | 'match';
  jobs: Job[];
};

const getMatchBucketRank = (bucket?: string): number => (
  bucket === 'best_fit' ? 3 : bucket === 'adjacent' ? 2 : 1
);

const getFeatureScore = (job: Job): number => {
  const priorityScore = Number(job.priorityScore ?? job.searchScore ?? 0);
  const matchScore = clamp(Math.round(Number(job.aiMatchScore || 0)), 0, 100);
  const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);
  const salaryScore = Math.min(18, Math.round(salaryAnchor(job) / 10000));
  const distance = Number(job.distanceKm || 0);
  const isRemote = (() => {
    try {
      return isRemoteJob(job) || String(job.type || '').toLowerCase() === 'remote';
    } catch {
      return String(job.type || '').toLowerCase() === 'remote';
    }
  })();
  const commuteBonus = isRemote ? 10 : Number.isFinite(distance) && distance > 0 && distance <= 30 ? 6 : 0;
  const reactionHours = reactionWindowHours(job);
  const responseBonus = reactionHours !== null && reactionHours <= 48 ? 6 : 0;

  return priorityScore
    + getMatchBucketRank(job.matchBucket) * 18
    + matchScore * 0.55
    + jhiScore * 0.45
    + salaryScore
    + commuteBonus
    + responseBonus;
};

const isFeatureEligible = (job: Job): boolean => {
  const priorityScore = Number(job.priorityScore ?? job.searchScore ?? 0);
  const matchScore = clamp(Math.round(Number(job.aiMatchScore || 0)), 0, 100);
  const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);

  return (
    job.matchBucket === 'best_fit' ||
    priorityScore >= 55 ||
    matchScore >= 60 ||
    jhiScore >= 70
  );
};

const pickHighlightIndex = (
  jobs: Job[],
  preferredIndex: number,
  options?: { requireEligibility?: boolean }
): number | null => {
  if (!jobs.length) return null;

  const scored = jobs
    .map((job, index) => ({
      index,
      eligible: isFeatureEligible(job),
      score: getFeatureScore(job) - Math.abs(index - preferredIndex) * 5,
    }))
    .sort((left, right) => right.score - left.score);

  const eligible = scored.filter((item) => item.eligible);
  if (eligible.length > 0) {
    return eligible[0].index;
  }

  if (options?.requireEligibility) return null;
  return scored[0]?.index ?? null;
};

const pickChunkHighlightIndexes = (jobs: Job[], chunkSize = 6, preferredIndex = 2): Set<number> => {
  const highlighted = new Set<number>();

  for (let start = 0; start < jobs.length; start += chunkSize) {
    const chunk = jobs.slice(start, start + chunkSize);
    const localPreferredIndex = Math.min(preferredIndex, Math.max(0, chunk.length - 1));
    const localHighlightIndex = pickHighlightIndex(chunk, localPreferredIndex, { requireEligibility: true });
    if (localHighlightIndex !== null) {
      highlighted.add(start + localHighlightIndex);
    }
  }

  return highlighted;
};

const getBalancedGridSpanClass = (index: number, total: number): string => {
  const isLastOddTabletCard = total % 2 === 1 && index === total - 1;
  const desktopRemainder = total % 3;
  const isLastDesktopCard = index === total - 1;
  const isLastDesktopPair = index >= total - 2;

  const tabletSpan = isLastOddTabletCard ? 'md:col-span-6' : 'md:col-span-3';

  if (desktopRemainder === 1 && isLastDesktopCard) {
    return `${tabletSpan} xl:col-span-12`;
  }

  if (desktopRemainder === 2 && isLastDesktopPair) {
    return `${tabletSpan} xl:col-span-6`;
  }

  return `${tabletSpan} xl:col-span-4`;
};

const getSectionSpanClass = (layout: FeedSection['layout'], index: number, total: number): string => {
  if (layout === 'grid_large') {
    if (total === 3) {
      if (index < 2) return 'md:col-span-3 xl:col-span-6';
      return 'md:col-span-6 xl:col-span-12';
    }
    if (index === 0) return 'md:col-span-6 xl:col-span-6';
    return getBalancedGridSpanClass(index - 1, Math.max(0, total - 1)).replace(/^md:col-span-/, 'md:col-span-').replace(/\bxl:col-span-(\d+)\b/, (_, span) => {
      if (span === '12') return 'xl:col-span-6';
      if (span === '6') return 'xl:col-span-3';
      return 'xl:col-span-3';
    });
  }

  return getBalancedGridSpanClass(index, total);
};

const SectionHeader: React.FC<{ title: string; subtitle?: string; count?: number; tone?: 'default' | 'match' }> = ({ title, subtitle, count, tone = 'default' }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 px-1 py-1">
    <div className="min-w-0">
      <div className={cn(
        'app-organic-pill inline-flex items-center gap-2 px-4 py-2 shadow-sm ring-1 ring-inset',
        tone === 'match'
          ? 'bg-[rgba(var(--accent-rgb),0.16)] ring-[rgba(var(--accent-rgb),0.24)]'
          : 'bg-[rgba(var(--accent-rgb),0.16)] ring-[rgba(var(--accent-rgb),0.24)]'
      )}>
        <span className={cn(
          'h-2 w-2 rounded-full',
          tone === 'match'
            ? 'bg-[var(--accent)] shadow-[0_0_16px_rgba(var(--accent-rgb),0.42)]'
            : 'bg-[var(--accent)] shadow-[0_0_16px_rgba(var(--accent-rgb),0.42)]'
        )} />
        <div className={cn(
          'text-[13px] font-black uppercase tracking-[0.2em]',
          tone === 'match' ? 'text-[var(--accent)]' : 'text-[var(--accent)]'
        )}>{title}</div>
      </div>
      {subtitle ? <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{subtitle}</div> : null}
    </div>
    {count !== undefined ? (
      <div className={cn(
        'app-organic-pill px-3.5 py-2 text-[12px] font-black shadow-sm ring-1 ring-inset',
        tone === 'match'
          ? 'bg-[rgba(var(--accent-rgb),0.18)] text-[var(--accent)] ring-[rgba(var(--accent-rgb),0.22)] dark:bg-[rgba(var(--accent-rgb),0.16)]'
          : 'bg-[rgba(var(--accent-rgb),0.18)] text-[var(--accent)] ring-[rgba(var(--accent-rgb),0.22)] dark:bg-[rgba(var(--accent-rgb),0.16)]'
      )}>{count}</div>
    ) : null}
  </div>
);

const LoadingCardSkeleton: React.FC<{ large?: boolean }> = ({ large = false }) => (
  <div
    className={cn(
      'overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)] animate-pulse',
      large ? 'min-h-[20rem] sm:min-h-[22rem]' : 'min-h-[18rem] sm:min-h-[20rem]'
    )}
  >
    <div className={cn('rounded-[18px] bg-[var(--surface-muted)]', large ? 'h-28 sm:h-32' : 'h-24')} />
    <div className="mt-4 flex items-start gap-3">
      <div className="h-12 w-12 rounded-xl bg-[var(--surface-muted)]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-24 rounded-full bg-[var(--surface-muted)]" />
        <div className="h-6 w-4/5 rounded-full bg-[var(--surface-muted)]" />
        <div className="h-4 w-3/5 rounded-full bg-[var(--surface-muted)]" />
      </div>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2">
      <div className="h-10 rounded-xl bg-[var(--surface-muted)]" />
      <div className="h-10 rounded-xl bg-[var(--surface-muted)]" />
      <div className="col-span-2 h-10 rounded-xl bg-[var(--surface-muted)]" />
    </div>
    <div className="mt-5 space-y-2">
      <div className="h-3 w-full rounded-full bg-[var(--surface-muted)]" />
      <div className="h-3 w-11/12 rounded-full bg-[var(--surface-muted)]" />
      <div className="h-3 w-3/4 rounded-full bg-[var(--surface-muted)]" />
    </div>
    <div className="mt-6 h-11 rounded-xl bg-[var(--surface-muted)]" />
  </div>
);

const LoadingEditorialFeedSkeleton: React.FC<{ compactLayout?: boolean }> = ({ compactLayout = false }) => {
  const items = compactLayout
    ? Array.from({ length: 6 }, (_, index) => ({ key: `compact-${index}`, className: 'md:col-span-3 xl:col-span-4', large: false }))
    : [
        { key: 'hero', className: 'xl:col-span-12', large: true },
        { key: 'a', className: 'md:col-span-3 xl:col-span-6', large: false },
        { key: 'b', className: 'md:col-span-3 xl:col-span-6', large: false },
        { key: 'c', className: 'md:col-span-6 xl:col-span-12', large: false },
      ];

  return (
    <div className="space-y-5">
      {!compactLayout ? (
        <div className="px-1 py-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-[12px] font-black uppercase tracking-[0.2em] text-[var(--accent)] shadow-sm animate-pulse">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            Načítám feed
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-6 xl:grid-cols-12">
        {items.map((item) => (
          <div key={item.key} className={item.className}>
            <LoadingCardSkeleton large={item.large} />
          </div>
        ))}
      </div>
    </div>
  );
};

const OfferCard: React.FC<{
  job: Job;
  selected: boolean;
  saved: boolean;
  language: string;
  variant?: 'default' | 'hero' | 'large';
  contrast?: boolean;
  className?: string;
  onSelect: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
}> = ({ job, selected, saved, language, variant = 'default', contrast = false, className, onSelect, onOpen, onToggleSave }) => {
  const isCsLike = language === 'cs' || language === 'sk';
  const avatarUrl = String(job.companyProfile?.logo_url || '').trim() || getFallbackCompanyAvatarUrl(job.company);
  const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);
  const salaryLocale = language === 'cs' ? 'cs-CZ' : language === 'sk' ? 'sk-SK' : language === 'de' || language === 'at' ? 'de-DE' : language === 'pl' ? 'pl-PL' : 'en-US';
  const salary = formatSalary(job, salaryLocale, isCsLike);
  const goal = String(job.companyGoal || '').trim();
  const firstStep = String(job.firstStepPrompt || '').trim();
  const isMicro = job.challenge_format === 'micro_job';
  const domain = resolveJobDomain(job);
  const domainAccent = getDomainAccent(domain);
  const cardStyle = domainAccent
    ? ({
      ['--card-accent-rgb' as any]: domainAccent.rgb,
    } as React.CSSProperties)
    : undefined;

  const cardPadding = variant === 'hero' ? 'p-5 sm:p-6' : variant === 'large' ? 'p-5' : 'p-4 sm:p-5';
  const cardHeightClass = variant === 'hero'
    ? 'min-h-[32rem] sm:min-h-[34rem]'
    : variant === 'large'
      ? 'min-h-[30rem] sm:min-h-[32rem]'
      : 'min-h-[34rem] sm:min-h-[36rem]';
  const titleClamp = variant === 'hero' ? 'line-clamp-2' : 'line-clamp-2';
  const cardRadiusClass = variant === 'hero' ? 'rounded-3xl' : 'rounded-[22px]';
  const coverRadiusClass = variant === 'hero' ? 'rounded-2xl' : 'rounded-[18px]';

  const isImported = job.listingKind === 'imported' || !job.challenge;
  const ctaLabel = localeText(language, { cs: 'Vstoupit do firmy', sk: 'Vstúpiť do firmy', de: 'In die Firma eintreten', pl: 'Wejdź do firmy', en: 'Enter the company' });
  const isFeatureCard = variant === 'hero' || contrast;
  const isDefaultCard = variant === 'default';
  const companyLogo = avatarUrl;
  const showFallbackMonogram = isStockCompanyAvatarUrl(companyLogo);
  const companyInitials = getCompanyInitials(job.company);

  const effectiveDomain = useMemo(() => resolveJobDomain(job), [job]);
  const coverImageUrl = getStockCoverForDomain(
    effectiveDomain,
    `${job.id || ''}-${job.company || ''}-${job.title || ''}`,
  );
  const coverHeightClass = variant === 'hero' ? 'h-32 sm:h-[8.5rem]' : variant === 'large' ? 'h-28 sm:h-[7.25rem]' : 'h-24';
  const fitReasons = useMemo(() => (isFeatureCard ? generateWhyItFitsReasons(job, language) : []), [isFeatureCard, job, language]);
  const visibleWhyReasons = useMemo(
    () => generateWhyItFitsReasons(job, language).slice(0, variant === 'hero' ? 3 : isFeatureCard ? 2 : 1),
    [isFeatureCard, job, language, variant]
  );
  const primaryMeta = job.location || job.type || localeText(language, { cs: 'Lokalita neuvedena', sk: 'Lokalita neuvedená', de: 'Ort nicht angegeben', pl: 'Lokalizacja niepodana', en: 'Location not specified' });
  const relativePostedAt = formatRelativePostedAt(job, language);
  const verdict = useMemo(() => getCardVerdict(job, language), [job, language]);
  const matchScore = clamp(Math.round(Number(job.aiMatchScore || 0)), 0, 100);
  const matchLabel = matchScore > 0
    ? `${matchScore}% ${localeText(language, { cs: 'SHODA', sk: 'ZHODA', de: 'MATCH', pl: 'MATCH', en: 'MATCH' })}`
    : job.matchBucket === 'best_fit'
      ? localeText(language, { cs: 'TOP SHODA', sk: 'TOP ZHODA', de: 'TOP MATCH', pl: 'TOP MATCH', en: 'TOP MATCH' })
      : job.matchBucket === 'adjacent'
        ? localeText(language, { cs: 'BLÍZKÁ SHODA', sk: 'BLÍZKA ZHODA', de: 'NAHER MATCH', pl: 'BLISKIE DOPASOWANIE', en: 'CLOSE MATCH' })
        : localeText(language, { cs: 'PODOBNÉ V OKOLÍ', sk: 'PODOBNÉ V OKOLÍ', de: 'ÄHNLICH IN IHRER NÄHE', pl: 'PODOBNE W OKOLICY', en: 'SIMILAR NEARBY' });
  const externalSourceLabel = getExternalSourceLabel(job, language);
  const bullshit = useMemo(() => analyzeJobBullshit(job, language), [job, language]);
  const compactTags = useMemo(() => {
    const tags: string[] = [];
    if (isMicro) {
      tags.push(localeText(language, { cs: 'Mini výzva', sk: 'Mini výzva', de: 'Mini-Challenge', pl: 'Mini wyzwanie', en: 'Mini challenge' }));
    } else if (isRemoteJob(job) || String(job.type || '').toLowerCase() === 'remote') {
      tags.push('Remote');
    } else if (String(job.type || '').toLowerCase() === 'hybrid') {
      tags.push('Hybrid');
    }
    return tags.filter(Boolean).slice(0, 1);
  }, [isMicro, job, language]);
  const showFairListingBadge = bullshit.tone === 'clean' && bullshit.greenFlags.length > 0;
  const quickSummary = useMemo(() => {
    const sourceText = String(job.challenge || firstStep || goal || '').replace(/\s+/g, ' ').trim();
    if (!sourceText) return '';
    return sourceText;
  }, [job.challenge, firstStep, goal]);
  const heroSignals = useMemo(() => {
    const signals: string[] = [];
    if (firstStep) signals.push(`${localeText(language, { cs: 'První krok', sk: 'Prvý krok', de: 'Erster Schritt', pl: 'Pierwszy krok', en: 'First step' })}: ${firstStep}`);
    if (fitReasons.length > 0) signals.push(fitReasons[0]);
    if (goal) signals.push(`${localeText(language, { cs: 'Cíl', sk: 'Cieľ', de: 'Ziel', pl: 'Cel', en: 'Goal' })}: ${goal}`);
    return signals.slice(0, 2);
  }, [firstStep, fitReasons, goal, language]);
  const qualityLabel = showFairListingBadge
    ? localeText(language, {
      cs: 'Férově popsané',
      sk: 'Férovo popísané',
      de: 'Fair beschrieben',
      pl: 'Uczciwie opisane',
      en: 'Fairly described',
    })
    : bullshit.tone === 'bullshit'
      ? localeText(language, { cs: 'Smrdí to', sk: 'Smrdí to', de: 'Riecht komisch', pl: 'Śmierdzi to', en: 'Smells off' })
      : bullshit.tone === 'watch'
        ? localeText(language, { cs: 'Pozor na vatu', sk: 'Pozor na vatu', de: 'Vorsicht, viel Watte', pl: 'Uwaga na watę', en: 'Watch the fluff' })
        : '';
  const supportLabels = [externalSourceLabel, ...compactTags, qualityLabel]
    .filter((label): label is string => Boolean(label))
    .slice(0, 2);
  const insightReasons = (isFeatureCard ? visibleWhyReasons : visibleWhyReasons.slice(0, 1))
    .map((reason) => reason.replace(/^✔\s*/, ''))
    .slice(0, isFeatureCard ? 2 : 1);
  const primaryInsight = insightReasons[0] || '';
  const secondaryInsight = insightReasons[1] || '';
  const supportLine = supportLabels.join(' • ');
  const narrativeLine = [firstStep, goal]
    .filter((value): value is string => Boolean(String(value || '').trim()))
    .join(' • ');
  const topMatchLabel = variant === 'hero'
    ? localeText(language, { cs: 'Top shoda', sk: 'Top zhoda', de: 'Top-Match', pl: 'Top dopasowanie', en: 'Top match' })
    : variant === 'large'
      ? localeText(language, { cs: 'Silná shoda', sk: 'Silná zhoda', de: 'Starker Match', pl: 'Mocne dopasowanie', en: 'Strong match' })
      : '';
  const titleTextClass = isFeatureCard ? 'text-slate-50' : 'text-[var(--text-strong)]';
  const mutedTextClass = isFeatureCard ? 'text-slate-300' : 'text-[var(--text-muted)]';
  const faintTextClass = isFeatureCard ? 'text-slate-400' : 'text-[var(--text-faint)]';
  const matchBadgeClass = isFeatureCard
    ? 'border border-[rgba(var(--accent-rgb),0.24)] bg-[rgba(var(--accent-rgb),0.18)] text-white shadow-[0_16px_36px_-22px_rgba(var(--accent-rgb),0.34)]'
    : 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)] ring-[rgba(var(--accent-rgb),0.18)] dark:bg-[rgba(var(--accent-rgb),0.16)]';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'app-surface flex self-stretch flex-col border',
        'group relative overflow-hidden text-left shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] transition hover:-translate-y-[1px] hover:shadow-[0_24px_54px_-34px_rgba(15,23,42,0.26)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.30)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]',
        cardRadiusClass,
        cardHeightClass,
        cardPadding,
        isFeatureCard
          ? 'border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(145deg,#09131f,#0f172a_52%,#0b2f38)] text-slate-50 shadow-[0_36px_90px_-56px_rgba(8,23,37,0.72)]'
          : selected
            ? 'border-[rgba(var(--accent-green-rgb),0.24)] bg-[rgba(255,255,255,0.98)] dark:bg-[rgba(15,23,42,0.96)]'
            : 'border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.98)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(15,23,42,0.94)]',
        isFeatureCard && selected && 'border-[rgba(var(--accent-rgb),0.42)] shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.18),0_40px_96px_-52px_rgba(8,23,37,0.82)]',
        className,
        !selected && !isFeatureCard && 'hover:border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.16)]',
        isFeatureCard && 'hover:border-[rgba(var(--accent-rgb),0.28)] hover:shadow-[0_40px_96px_-52px_rgba(8,23,37,0.8)]'
      )}
      style={cardStyle}
    >
      {isFeatureCard ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(var(--accent-rgb),0.22),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(var(--accent-sky-rgb),0.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%)]"
        />
      ) : null}
      {isFeatureCard ? (
        <div
          aria-hidden
          className={cn(
            'absolute inset-x-0 top-0 h-1.5',
            variant === 'hero'
              ? 'bg-[linear-gradient(90deg,rgba(var(--accent-rgb),0.92),rgba(var(--accent-sky-rgb),0.7))]'
              : 'bg-[linear-gradient(90deg,rgba(var(--accent-rgb),0.6),rgba(var(--accent-sky-rgb),0.42))]'
          )}
        />
      ) : null}
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-12 bg-[linear-gradient(180deg,rgba(var(--card-accent-rgb,var(--accent-rgb)),0.05),transparent)]', isFeatureCard ? 'opacity-90' : 'dark:opacity-70')} />

      <div className={cn("relative w-full mb-4 overflow-hidden bg-slate-100 dark:bg-slate-800", coverHeightClass, coverRadiusClass)}>
        <img
          src={coverImageUrl}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop';
          }}
          className="h-full w-full object-cover"
          alt={effectiveDomain || job.company || 'Challenge cover'}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-black/6 to-transparent opacity-60 transition-opacity group-hover:opacity-42" />
        <div className="absolute left-3 top-3">
          {domainAccent ? (
            <span className="inline-flex items-center rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {language === 'cs' || language === 'sk' ? domainAccent.label.cs : domainAccent.label.en}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {isImported
                ? localeText(language, { cs: 'Import', sk: 'Import', de: 'Import', pl: 'Import', en: 'Import' })
                : isMicro
                  ? localeText(language, { cs: 'Mini výzva', sk: 'Mini výzva', de: 'Mini-Challenge', pl: 'Mini wyzwanie', en: 'Mini challenge' })
                  : localeText(language, { cs: 'Výzva', sk: 'Výzva', de: 'Challenge', pl: 'Wyzwanie', en: 'Challenge' })}
            </span>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative mr-1 flex min-h-[48px] shrink-0 items-center">
              {showFallbackMonogram ? (
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-xl border text-sm font-bold shadow-sm',
                    isFeatureCard
                      ? 'border-white/12 bg-white/10 text-white'
                      : 'border-white/70 bg-[rgba(var(--card-accent-rgb,var(--accent-rgb)),0.10)] text-[var(--text-strong)] dark:text-white',
                    variant === 'hero' ? 'h-14 w-14' : 'h-12 w-12'
                  )}
                >
                  {companyInitials}
                </div>
              ) : (
                <img
                  src={companyLogo}
                  alt={job.company}
                  className={cn(
                    'shrink-0 rounded-xl border object-cover shadow-sm',
                    isFeatureCard ? 'border-white/12' : 'border-white/70',
                    variant === 'hero' ? 'h-14 w-14' : 'h-12 w-12'
                  )}
                  loading="lazy"
                />
              )}
            </div>
            <div className="mt-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className={cn('min-w-0 truncate text-[13px] font-semibold uppercase tracking-[0.08em]', faintTextClass)}>{job.company}</div>
                {isFeatureCard && topMatchLabel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(var(--accent-rgb),0.28)] bg-[rgba(var(--accent-rgb),0.18)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-white shadow-[0_16px_36px_-24px_rgba(var(--accent-rgb),0.36)]">
                    <Sparkles size={12} className="opacity-80" />
                    {topMatchLabel}
                  </span>
                ) : null}
              </div>
              <div className={cn('mt-1.5 break-words text-[1.08rem] font-semibold leading-[1.3] tracking-[-0.03em]', titleTextClass, variant === 'hero' && 'text-[1.26rem] sm:text-[1.4rem]', titleClamp)}>{job.title}</div>
              {supportLine ? (
                <div className={cn('mt-2 text-[12px] leading-5', faintTextClass)}>
                  {supportLine}
                </div>
              ) : null}
              {isFeatureCard ? (
                <div className="mt-2 text-[12px] font-medium text-[var(--accent)]">
                  {matchLabel}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition',
              saved
                ? 'border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.18)] bg-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.08)] text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]'
                : isFeatureCard
                  ? 'border-white/12 bg-white/8 text-slate-300 hover:bg-white/12 hover:text-white'
                  : 'border-[rgba(15,23,42,0.08)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)] dark:border-[rgba(255,255,255,0.08)] dark:bg-white/5',
              isFeatureCard ? 'mt-1.5' : ''
            )}
            title={saved
              ? localeText(language, { cs: 'Uloženo', sk: 'Uložené', de: 'Gespeichert', pl: 'Zapisane', en: 'Saved' })
              : localeText(language, { cs: 'Uložit', sk: 'Uložiť', de: 'Speichern', pl: 'Zapisz', en: 'Save' })}
          >
            <Bookmark size={16} className={cn(saved && 'fill-current')} />
          </button>
        </div>

        {quickSummary ? (
          <div className="space-y-1">
            <div className={cn('break-words text-[13px] leading-[1.75] overflow-hidden', mutedTextClass, 'line-clamp-4')}>
              {quickSummary}
            </div>
          </div>
        ) : null}

        {(variant === 'hero' || (contrast && variant !== 'default')) && heroSignals.length > 0 ? (
          <div className={cn('space-y-1 text-[12px] leading-[1.55]', mutedTextClass)}>
            {heroSignals.map((signal) => (
              <div key={signal} className="line-clamp-1">
                {signal}
              </div>
            ))}
          </div>
        ) : null}
        {primaryInsight ? (
          <div className={cn('border-l-2 pl-3', isFeatureCard ? 'border-[rgba(var(--accent-rgb),0.44)]' : 'border-[rgba(var(--accent-rgb),0.35)]')}>
            <div className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', faintTextClass)}>
              {whySectionTitle(language)}
            </div>
            <div className={cn('mt-1 line-clamp-2 text-[12px] leading-[1.55]', mutedTextClass)}>
              {primaryInsight}
            </div>
            {secondaryInsight ? (
              <div className={cn('mt-1 line-clamp-2 text-[12px] leading-[1.55]', faintTextClass)}>
                {secondaryInsight}
              </div>
            ) : narrativeLine ? (
              <div className={cn('mt-1 line-clamp-2 text-[12px] leading-[1.55]', faintTextClass)}>
                {narrativeLine}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
              verdict.tone === 'good'
                ? isFeatureCard ? 'bg-emerald-400/14 text-emerald-200 ring-emerald-300/20' : 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/18 dark:text-emerald-300'
                : verdict.tone === 'bad'
                  ? isFeatureCard ? 'bg-amber-400/14 text-amber-200 ring-amber-300/20' : 'bg-amber-500/12 text-amber-700 ring-amber-500/18 dark:text-amber-300'
                  : isFeatureCard ? 'bg-[rgba(var(--accent-rgb),0.18)] text-white ring-[rgba(var(--accent-rgb),0.24)]' : 'bg-[rgba(var(--accent-rgb),0.10)] text-[var(--accent)] ring-[rgba(var(--accent-rgb),0.18)] dark:bg-[rgba(var(--accent-rgb),0.14)]'
            )}
            title={bullshit.summary || bullshit.greenSummary || ''}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            {verdict.label}
          </span>
          {!isFeatureCard && matchScore > 0 ? (
            <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset', matchBadgeClass)}>
              {matchLabel}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1.5 sm:grid-cols-2">
          <span className={cn('badge-base rounded-lg px-3 py-2', isFeatureCard ? '!border-white/12 !bg-white/8 !text-slate-100 dark:!border-white/12 dark:!bg-white/8' : 'border-[rgba(15,23,42,0.08)] bg-[var(--surface-muted)] dark:border-[rgba(255,255,255,0.08)] dark:bg-white/5', isDefaultCard && 'max-w-full')}>
            <MapPin size={13} />
            <span className="truncate">{primaryMeta}</span>
          </span>
          {relativePostedAt ? (
            <span className={cn('badge-base rounded-lg px-3 py-2', isFeatureCard ? '!border-white/12 !bg-white/8 !text-slate-100 dark:!border-white/12 dark:!bg-white/8' : 'border-[rgba(15,23,42,0.08)] bg-[var(--surface-muted)] dark:border-[rgba(255,255,255,0.08)] dark:bg-white/5')}>
              <Clock size={13} />
              <span className="truncate">{relativePostedAt}</span>
            </span>
          ) : null}
          <span className={cn('badge-base rounded-lg px-3 py-2', isFeatureCard ? '!border-white/12 !bg-white/8 !text-slate-100 dark:!border-white/12 dark:!bg-white/8' : 'border-[rgba(15,23,42,0.08)] bg-[var(--surface-muted)] dark:border-[rgba(255,255,255,0.08)] dark:bg-white/5', isDefaultCard && 'max-w-full', !relativePostedAt && 'sm:col-span-2')}>
            {salary}
          </span>
          {isFeatureCard ? (
            <>
              {variant !== 'hero' ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] transition',
                    matchScore > 0
                      ? matchBadgeClass
                      : jhiScore >= 75
                        ? 'border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent)] shadow-[0_16px_36px_-22px_rgba(var(--accent-rgb),0.26)]'
                        : jhiScore >= 55
                          ? 'border border-white/12 bg-white/8 text-slate-100'
                          : 'border border-white/10 bg-white/6 text-slate-400'
                  )}
                  title={matchScore > 0
                    ? localeText(language, { cs: 'Shoda s profilem', sk: 'Zhoda s profilom', de: 'Profil-Match', pl: 'Dopasowanie do profilu', en: 'Profile match' })
                    : 'Job Health Index'}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {matchScore > 0 ? matchLabel : `JHI ${jhiScore}`}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        </div>

        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm transition',
              isFeatureCard
                ? 'bg-[var(--accent)] font-bold text-slate-950 shadow-[0_18px_36px_-18px_rgba(var(--accent-rgb),0.5)] hover:brightness-110'
                : 'bg-[var(--text-strong)] font-semibold text-white hover:bg-[var(--accent)] dark:bg-white dark:text-slate-950 dark:hover:bg-[var(--accent)]'
            )}
          >
            <span className="flex items-center gap-2">
              {isDefaultCard
                ? ctaLabel
                : isMicro ? localeText(language, { cs: 'Vstoupit do mini výzvy', sk: 'Vstúpiť do mini výzvy', de: 'Mini-Challenge öffnen', pl: 'Wejdź do mini wyzwania', en: 'Enter the mini challenge' }) : ctaLabel}
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ChallengeEditorialFeed: React.FC<ChallengeEditorialFeedProps> = ({
  jobs,
  loading = false,
  selectedJobId,
  savedJobIds,
  locale,
  compactLayout = false,
  onSelect,
  onOpen,
  onToggleSave,
}) => {
  const language = String(locale || 'en').split('-')[0].toLowerCase();
  const feedCopy = useMemo(() => ({
    empty: localeText(language, { cs: 'Teď tu nic rozumného neleží. Zkus povolit filtry nebo hrábnout jinam.', sk: 'Teraz tu nič rozumné neleží. Skús povoliť filtre alebo zájsť inam.', de: 'Gerade liegt hier nichts Brauchbares. Lockere die Filter oder geh anders ran.', pl: 'Na razie nie ma tu nic sensownego. Poluzuj filtry albo poszukaj inaczej.', en: 'Nothing solid here right now. Loosen the filters or search from another angle.' }),
    heroTitle: localeText(language, { cs: '🔥 TADY BYCH ZAČAL', sk: '🔥 TU BY SOM ZAČAL', de: '🔥 HIER WÜRDE ICH STARTEN', pl: '🔥 TU BYM ZACZĄŁ', en: '🔥 START HERE' }),
    heroSubtitle: localeText(language, { cs: 'Nejsilnější shoda hned na prvním scrollu.', sk: 'Najsilnejšia zhoda hneď na prvom skrolle.', de: 'Der stärkste Match direkt im ersten Scroll.', pl: 'Najmocniejsze dopasowanie już na pierwszym scrollu.', en: 'The strongest match on the first scroll.' }),
    spotlightTitle: localeText(language, { cs: '⚡ STOJÍ ZA KLIK', sk: '⚡ STOJÍ ZA KLIK', de: '⚡ LOHNT DEN KLICK', pl: '⚡ WARTO KLIKNĄĆ', en: '⚡ WORTH THE CLICK' }),
    spotlightSubtitle: localeText(language, { cs: 'Shoda, realita a dopad. Bez vatových řečí okolo.', sk: 'Zhoda, realita a dopad. Bez vatových rečí okolo.', de: 'Match, Realität und Wirkung. Ohne Floskeln drumherum.', pl: 'Dopasowanie, realia i efekt. Bez lania wody.', en: 'Match, reality, and impact. No fluffy filler.' }),
    remoteTitle: localeText(language, { cs: '🏠 BEZ DOJÍŽDĚNÍ', sk: '🏠 BEZ DOCHÁDZANIA', de: '🏠 OHNE PENDELN', pl: '🏠 BEZ DOJAZDU', en: '🏠 NO COMMUTE' }),
    fastTitle: localeText(language, { cs: '💬 TADY FAKT ODEPISUJÍ', sk: '💬 TU FAKT ODPISUJÚ', de: '💬 DIE ANTWORTEN WIRKLICH', pl: '💬 TU NAPRAWDĘ ODPISUJĄ', en: '💬 THEY REALLY REPLY' }),
    remainingTitle: localeText(language, { cs: 'DALŠÍ VE HŘE', sk: 'ĎALŠIE V HRE', de: 'MEHR IM SPIEL', pl: 'KOLEJNE W GRZE', en: 'MORE IN PLAY' }),
    remainingSubtitle: localeText(language, { cs: 'Zbytek feedu bez zbytečně chytrých škatulek.', sk: 'Zvyšok feedu bez zbytočne múdrych škatuliek.', de: 'Der Rest des Feeds ohne überkluge Schubladen.', pl: 'Reszta feedu bez przekombinowanych szufladek.', en: 'The rest of the feed without over-clever buckets.' }),
  }), [language]);

  const { sections, remaining, compactJobs } = useMemo(() => {
    const pool = Array.isArray(jobs) ? jobs.slice() : [];
    const sorted = compactLayout ? pool : sortJobsForDiscovery(pool);
    const used = new Set<string>();
    const isImportedListing = (job: Job) => job.listingKind === 'imported' || Boolean(job.searchDiagnostics?.external);

    const take = (candidates: Job[], count: number) => {
      const out: Job[] = [];
      for (const job of candidates) {
        if (out.length >= count) break;
        if (!job?.id) continue;
        if (used.has(job.id)) continue;
        used.add(job.id);
        out.push(job);
      }
      return out;
    };

    const isMicro = (job: Job) => job.challenge_format === 'micro_job';
    const standardSorted = sorted.filter((job) => !isMicro(job));

    if (compactLayout) {
      return {
        sections: [] as FeedSection[],
        remaining: [] as Job[],
        compactJobs: standardSorted,
      };
    }

    const hero = take(standardSorted, 1);

    const spotlightCandidates = standardSorted
      .slice()
      .sort((a: any, b: any) => {
        const scoreA = Number(a.priorityScore || 0) + Number(a.jhi?.score || 0) + salaryAnchor(a) / 1000 - Number(a.distanceKm || 0) / 8;
        const scoreB = Number(b.priorityScore || 0) + Number(b.jhi?.score || 0) + salaryAnchor(b) / 1000 - Number(b.distanceKm || 0) / 8;
        return scoreB - scoreA;
      });
    const spotlight: Job[] = [];
    const hasImportedCandidates = spotlightCandidates.some((job) => isImportedListing(job));
    spotlight.push(...take(spotlightCandidates.filter((job) => !isImportedListing(job)), hasImportedCandidates ? 2 : 3));
    if (hasImportedCandidates) {
      spotlight.push(...take(spotlightCandidates.filter((job) => isImportedListing(job)), 1));
    }
    if (spotlight.length < 3) {
      spotlight.push(...take(spotlightCandidates, 3 - spotlight.length));
    }

    const remoteCandidates = standardSorted
      .filter((job) => {
        try {
          return isRemoteJob(job) || String(job.type || '').toLowerCase() === 'remote';
        } catch {
          return String(job.type || '').toLowerCase() === 'remote';
        }
      })
      .slice()
      .sort((a, b: any) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
    const remote = take(remoteCandidates, 3);

    const fastCandidates = standardSorted
      .map((job) => ({ job, hours: reactionWindowHours(job) }))
      .filter((item) => item.hours !== null)
      .sort((a, b: any) => Number(a.hours) - Number(b.hours))
      .map((item) => item.job);
    const fast = take(fastCandidates, 3);

    const sectionsList: FeedSection[] = [];

    if (hero.length) {
      sectionsList.push({
        key: 'hero',
        title: { cs: feedCopy.heroTitle, en: feedCopy.heroTitle },
        subtitle: { cs: feedCopy.heroSubtitle, en: feedCopy.heroSubtitle },
        layout: 'hero',
        tone: 'match',
        jobs: hero,
      });
    }
    if (spotlight.length) {
      sectionsList.push({
        key: 'spotlight',
        title: { cs: feedCopy.spotlightTitle, en: feedCopy.spotlightTitle },
        subtitle: { cs: feedCopy.spotlightSubtitle, en: feedCopy.spotlightSubtitle },
        layout: 'grid_large',
        tone: 'match',
        jobs: spotlight,
      });
    }
    if (remote.length) {
      sectionsList.push({
        key: 'remote',
        title: { cs: feedCopy.remoteTitle, en: feedCopy.remoteTitle },
        layout: 'grid',
        jobs: remote,
      });
    }
    if (fast.length) {
      sectionsList.push({
        key: 'fast',
        title: { cs: feedCopy.fastTitle, en: feedCopy.fastTitle },
        layout: 'grid',
        jobs: fast,
      });
    }

    const remainingJobs = sorted.filter((job) => job?.id && !used.has(job.id) && !isMicro(job));
    return { sections: sectionsList, remaining: remainingJobs, compactJobs: [] as Job[] };
  }, [compactLayout, feedCopy.fastTitle, feedCopy.heroSubtitle, feedCopy.heroTitle, feedCopy.remoteTitle, feedCopy.spotlightSubtitle, feedCopy.spotlightTitle, jobs]);

  const sectionHighlightIndexes = useMemo(() => {
    const indexes = new Map<string, number | null>();

    sections.forEach((section) => {
      if (section.key === 'hero') {
        indexes.set(section.key, 0);
        return;
      }

      const preferredIndex = section.key === 'spotlight'
        ? 1
        : section.key === 'remote'
          ? 0
          : section.key === 'fast'
            ? Math.min(2, Math.max(0, section.jobs.length - 1))
            : 0;

      indexes.set(section.key, pickHighlightIndex(section.jobs, preferredIndex));
    });

    return indexes;
  }, [sections]);

  const visibleRemaining = useMemo(() => remaining.slice(0, 24), [remaining]);
  const remainingHighlightIndexes = useMemo(
    () => pickChunkHighlightIndexes(visibleRemaining, 6, 2),
    [visibleRemaining]
  );

  if (loading && jobs.length === 0) {
    return <LoadingEditorialFeedSkeleton compactLayout={compactLayout} />;
  }

  if (compactLayout) {
    if (compactJobs.length === 0) {
      return (
        <div className="py-10 text-center text-sm text-[var(--text-muted)]">
          {feedCopy.empty}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-6 xl:grid-cols-12">
        {compactJobs.map((job) => (
          <OfferCard
            key={job.id}
            job={job}
            selected={job.id === selectedJobId}
            saved={savedJobIds.includes(job.id)}
            language={language}
            variant="default"
            className="md:col-span-3 xl:col-span-4"
            onSelect={() => onSelect(job.id)}
            onOpen={() => onOpen(job.id)}
            onToggleSave={() => onToggleSave(job.id)}
          />
        ))}
      </div>
    );
  }

  if (!sections.length && remaining.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-[var(--text-muted)]">
        {feedCopy.empty}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {sections.map((section) => {
        const title = section.title.cs;
        const subtitle = section.subtitle ? section.subtitle.cs : undefined;

        if (section.layout === 'hero') {
          const job = section.jobs[0];
          if (!job) return null;
          return (
            <div key={section.key} className="space-y-5">
              <SectionHeader title={title} subtitle={subtitle} tone={section.tone} />
              <div className="grid grid-cols-1 xl:grid-cols-12">
                <OfferCard
                  job={job}
                  selected={job.id === selectedJobId}
                  saved={savedJobIds.includes(job.id)}
                  language={language}
                  variant="hero"
                  contrast
                  className="xl:col-span-12"
                  onSelect={() => onSelect(job.id)}
                  onOpen={() => onOpen(job.id)}
                  onToggleSave={() => onToggleSave(job.id)}
                />
              </div>
            </div>
          );
        }

        return (
          <div key={section.key} className="space-y-5">
            <SectionHeader title={title} subtitle={subtitle} count={section.jobs.length} tone={section.tone} />
            <div className="grid grid-cols-1 items-stretch gap-5 md:auto-rows-fr md:grid-cols-6 md:grid-flow-dense xl:auto-rows-fr xl:grid-cols-12 xl:grid-flow-dense">
              {section.jobs.map((job, idx) => {
                const spanClass = getSectionSpanClass(section.layout, idx, section.jobs.length);
                const highlightIndex = sectionHighlightIndexes.get(section.key) ?? null;
                const isHighlighted = highlightIndex === idx;

                return (
                  <OfferCard
                    key={job.id}
                    job={job}
                    selected={job.id === selectedJobId}
                    saved={savedJobIds.includes(job.id)}
                    language={language}
                    variant={section.layout === 'grid_large' && isHighlighted ? 'large' : 'default'}
                    contrast={isHighlighted}
                    className={spanClass}
                    onSelect={() => onSelect(job.id)}
                    onOpen={() => onOpen(job.id)}
                    onToggleSave={() => onToggleSave(job.id)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {remaining.length ? (
        <div className="space-y-5">
          <SectionHeader
            title={feedCopy.remainingTitle}
            subtitle={feedCopy.remainingSubtitle}
            count={remaining.length}
          />
          <div className="grid grid-cols-1 items-stretch gap-5 md:auto-rows-fr md:grid-cols-6 md:grid-flow-dense xl:auto-rows-fr xl:grid-cols-12 xl:grid-flow-dense">
            {visibleRemaining.map((job, idx, list) => {
              return (
                <OfferCard
                  key={job.id}
                  job={job}
                  selected={job.id === selectedJobId}
                  saved={savedJobIds.includes(job.id)}
                  language={language}
                  contrast={remainingHighlightIndexes.has(idx)}
                  className={getBalancedGridSpanClass(idx, list.length)}
                  onSelect={() => onSelect(job.id)}
                  onOpen={() => onOpen(job.id)}
                  onToggleSave={() => onToggleSave(job.id)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ChallengeEditorialFeed;
