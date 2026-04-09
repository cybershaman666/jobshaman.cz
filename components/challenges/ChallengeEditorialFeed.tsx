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
  embeddedVariant?: 'default' | 'career_map_offers';
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

const toSentence = (value: string): string => {
  const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const truncateSentence = (value: string, maxLength = 88): string => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return toSentence(normalized);
  return `${normalized.slice(0, maxLength).replace(/[,:;.\s]+$/, '')}…`;
};

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  if (job.micro_job_reward) return job.micro_job_reward;
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

type CardVerdictTone = 'good' | 'neutral' | 'bad';

const getCardVerdictTone = (job: Job): CardVerdictTone => {
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
    return 'good';
  }

  if (jhiScore < 55 || (!isRemote && distance >= 80)) {
    return 'bad';
  }

  return 'neutral';
};

const getCardVerdict = (job: Job, language: string) => {
  const tone = getCardVerdictTone(job);

  if (tone === 'good') {
    return {
      label: localeText(language, {
        cs: 'Stojí za handshake',
        sk: 'Stojí za handshake',
        de: 'Handshake lohnt sich',
        pl: 'Warto podać rękę',
        en: 'Worth a handshake',
      }),
      tone,
    };
  }

  if (tone === 'bad') {
    return {
      label: localeText(language, {
        cs: 'Spíš ne',
        sk: 'Skôr nie',
        de: 'Eher nicht',
        pl: 'Raczej nie',
        en: 'Probably skip',
      }),
      tone,
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
    tone,
  };
};

const decisionMakerTitle = (language: string): string => localeText(language, {
  cs: 'Rozhodovací signál',
  sk: 'Rozhodovací signál',
  de: 'Entscheidungssignal',
  pl: 'Sygnał decyzji',
  en: 'Decision signal',
});

const getWorkModeLabel = (job: Job, language: string): string => {
  const raw = String(job.work_model || job.type || '').trim().toLowerCase();
  if (raw.includes('remote')) return localeText(language, { cs: 'Remote', sk: 'Remote', de: 'Remote', pl: 'Remote', en: 'Remote' });
  if (raw.includes('hybrid')) return localeText(language, { cs: 'Hybrid', sk: 'Hybrid', de: 'Hybrid', pl: 'Hybrid', en: 'Hybrid' });
  if (raw.includes('on-site') || raw.includes('onsite')) {
    return localeText(language, { cs: 'Na místě', sk: 'Na mieste', de: 'Vor Ort', pl: 'Na miejscu', en: 'On-site' });
  }
  return String(job.work_model || job.type || '').trim();
};

const isTemplatedFirstStep = (value: string): boolean => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return false;

  return [
    'jak bys v prvních dnech zjistil',
    'jak by si v prvých dňoch zistil',
    'how would you identify in the first days',
    'wie würdest du in den ersten tagen herausfinden',
    'jak w pierwszych dniach sprawdzisz',
    'kde má role',
    'where the role',
  ].some((pattern) => normalized.includes(pattern));
};

const getMeaningHook = (job: Job, language: string): string => {
  const goal = String(job.companyGoal || '').trim();
  const firstStep = String(job.firstStepPrompt || '').trim();
  const meaningfulFirstStep = !isTemplatedFirstStep(firstStep) ? firstStep : '';
  const firstReason = String(job.aiMatchReasons?.[0] || job.matchReasons?.[0] || '').trim();
  const challenge = String(job.challenge || '').trim();
  const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);
  const salaryTop = Number(job.salary_to || job.salary_from || job.aiEstimatedSalary?.max || job.aiEstimatedSalary?.min || 0);
  const remote = (() => {
    try {
      return isRemoteJob(job) || String(job.type || '').toLowerCase() === 'remote';
    } catch {
      return String(job.type || '').toLowerCase() === 'remote';
    }
  })();

  if (goal) return truncateSentence(goal, 84);
  if (firstReason) {
    return localeText(language, {
      cs: `Mohl by tě sem táhnout hlavně ${firstReason}.`,
      sk: `Mohlo by ťa sem ťahať hlavne ${firstReason}.`,
      de: `Hier könnte dich vor allem ${firstReason} hinziehen.`,
      pl: `Może cię tu przyciągać głównie ${firstReason}.`,
      en: `What could pull you here most is ${firstReason}.`,
    });
  }
  if (challenge) return truncateSentence(challenge, 84);
  if (meaningfulFirstStep) {
    return localeText(language, {
      cs: `Hned na začátku bys řešil: ${truncateSentence(meaningfulFirstStep, 68)}`,
      sk: `Hneď na začiatku by si riešil: ${truncateSentence(meaningfulFirstStep, 68)}`,
      de: `Direkt zum Start würdest du lösen: ${truncateSentence(meaningfulFirstStep, 68)}`,
      pl: `Na starcie zajmiesz się: ${truncateSentence(meaningfulFirstStep, 68)}`,
      en: `You would tackle this early on: ${truncateSentence(meaningfulFirstStep, 68)}`,
    });
  }
  if (remote && jhiScore >= 70) {
    return localeText(language, {
      cs: 'Tohle může fungovat i v reálném dni, ne jen na papíře.',
      sk: 'Toto môže fungovať aj v reálnom dni, nielen na papieri.',
      de: 'Das könnte auch im Alltag funktionieren, nicht nur auf dem Papier.',
      pl: 'To może działać także w codziennym życiu, nie tylko na papierze.',
      en: 'This could work in real life, not just on paper.',
    });
  }
  if (salaryTop >= 70000) {
    return localeText(language, {
      cs: 'Tohle není zajímavé jen titulkem, ale i finančně.',
      sk: 'Toto nie je zaujímavé len titulkom, ale aj finančne.',
      de: 'Das ist nicht nur vom Titel her interessant, sondern auch finanziell.',
      pl: 'To jest ciekawe nie tylko z nazwy, ale też finansowo.',
      en: 'This is not only interesting by title, but financially too.',
    });
  }
  return localeText(language, {
    cs: 'Tohle není jen další role. Má důvod, proč ji otevřít.',
    sk: 'Toto nie je len ďalšia rola. Má dôvod, prečo ju otvoriť.',
    de: 'Das ist nicht nur eine weitere Rolle. Es gibt einen Grund, sie zu öffnen.',
    pl: 'To nie jest kolejna rola. Jest powód, żeby ją otworzyć.',
    en: 'This is not just another role. There is a reason to open it.',
  });
};

type FeedSection = {
  key: string;
  title: { cs: string; en: string };
  subtitle?: { cs: string; en: string };
  layout: 'grid' | 'grid_large';
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

const placeBadVerdictsLater = (jobs: Job[]): Job[] => {
  const keepUpFront: Job[] = [];
  const badLater: Job[] = [];

  jobs.forEach((job) => {
    if (getCardVerdictTone(job) === 'bad') {
      badLater.push(job);
      return;
    }
    keepUpFront.push(job);
  });

  return [...keepUpFront, ...badLater];
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

const getSectionSpanClass = (_layout: FeedSection['layout'], index: number, total: number): string => {
  return getBalancedGridSpanClass(index, total);
};

const SectionHeader: React.FC<{ title: string; subtitle?: string; count?: number; tone?: 'default' | 'match' }> = ({ title, subtitle, count, tone = 'default' }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 px-1 py-1">
    <div className="min-w-0">
      <div className={cn(
        'app-organic-pill inline-flex items-center gap-2 px-4 py-2 shadow-sm ring-1 ring-inset backdrop-blur-xl',
        tone === 'match'
          ? 'bg-[rgba(var(--accent-rgb),0.12)] ring-[rgba(var(--accent-rgb),0.2)]'
          : 'bg-[rgba(255,255,255,0.04)] ring-[rgba(255,255,255,0.08)]'
      )}>
        <span className={cn(
          'h-2 w-2 rounded-full',
          tone === 'match'
            ? 'bg-[var(--accent)] shadow-[0_0_16px_rgba(var(--accent-rgb),0.42)]'
            : 'bg-[var(--accent)] shadow-[0_0_16px_rgba(var(--accent-rgb),0.3)]'
        )} />
        <div className={cn(
          'text-[13px] font-black uppercase tracking-[0.2em]',
          tone === 'match' ? 'text-[var(--accent)]' : 'text-[var(--text-strong)]'
        )}>{title}</div>
      </div>
      {subtitle ? <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{subtitle}</div> : null}
    </div>
    {count !== undefined ? (
      <div className={cn(
        'app-organic-pill px-3.5 py-2 text-[12px] font-black shadow-sm ring-1 ring-inset backdrop-blur-xl',
        tone === 'match'
          ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)] ring-[rgba(var(--accent-rgb),0.2)]'
          : 'bg-[rgba(255,255,255,0.04)] text-[var(--text-strong)] ring-[rgba(255,255,255,0.08)]'
      )}>{count}</div>
    ) : null}
  </div>
);

const LoadingCardSkeleton: React.FC<{ large?: boolean }> = ({ large = false }) => (
  <div
    className={cn(
      'overflow-hidden rounded-[22px] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.04)] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.28)] animate-pulse backdrop-blur-xl',
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
  embeddedVariant?: 'default' | 'career_map_offers';
  className?: string;
  onSelect: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
}> = ({ job, selected, saved, language, variant = 'default', contrast = false, embeddedVariant = 'default', className, onSelect, onOpen, onToggleSave }) => {
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
  const ctaLabel = embeddedVariant === 'career_map_offers'
    ? localeText(language, { cs: 'Zobrazit detail nabídky', sk: 'Zobraziť detail ponuky', de: 'Angebotsdetail öffnen', pl: 'Pokaż szczegóły oferty', en: 'Open offer details' })
    : localeText(language, { cs: 'Vstoupit do firmy', sk: 'Vstúpiť do firmy', de: 'In die Firma eintreten', pl: 'Wejdź do firmy', en: 'Enter the company' });
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
  const meaningHook = useMemo(() => getMeaningHook(job, language), [job, language]);
  const workModeLabel = useMemo(() => getWorkModeLabel(job, language), [job, language]);
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
  const contextLine = [workModeLabel, String(job.location || '').trim()]
    .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index)
    .slice(0, 2)
    .join(' · ');
  const insightReasons = (isFeatureCard ? visibleWhyReasons : visibleWhyReasons.slice(0, 1))
    .map((reason) => reason.replace(/^✔\s*/, ''))
    .slice(0, isFeatureCard ? 2 : 1);
  const primaryInsight = insightReasons[0] || '';
  const secondaryInsight = insightReasons[1] || '';
  const supportLine = supportLabels.join(' • ');
  const narrativeLine = [firstStep, goal]
    .filter((value): value is string => Boolean(String(value || '').trim()))
    .join(' • ');
  const decisionSupport = primaryInsight || secondaryInsight || narrativeLine || supportLine;
  const topMatchLabel = variant === 'hero'
    ? localeText(language, { cs: 'Top shoda', sk: 'Top zhoda', de: 'Top-Match', pl: 'Top dopasowanie', en: 'Top match' })
    : variant === 'large'
      ? localeText(language, { cs: 'Silná shoda', sk: 'Silná zhoda', de: 'Starker Match', pl: 'Mocne dopasowanie', en: 'Strong match' })
      : '';
  const titleTextClass = isFeatureCard ? 'text-slate-50' : 'text-[var(--text-strong)]';
  const mutedTextClass = isFeatureCard ? 'text-slate-200/88' : 'text-[var(--text-muted)]';
  const faintTextClass = isFeatureCard ? 'text-slate-300/72' : 'text-[var(--text-faint)]';
  const matchBadgeClass = isFeatureCard
    ? 'border border-[rgba(var(--accent-rgb),0.24)] bg-[rgba(var(--accent-rgb),0.18)] text-slate-50'
    : 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)] ring-[rgba(var(--accent-rgb),0.18)] dark:bg-[rgba(var(--accent-rgb),0.16)]';
  const decisionPanelClass = verdict.tone === 'good'
    ? isFeatureCard
      ? 'border-emerald-300/18 bg-emerald-400/10 text-emerald-50'
      : 'border-emerald-500/18 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
    : verdict.tone === 'bad'
      ? isFeatureCard
        ? 'border-amber-300/18 bg-amber-400/10 text-amber-50'
        : 'border-amber-500/18 bg-amber-500/10 text-amber-900 dark:text-amber-100'
      : isFeatureCard
        ? 'border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.14)] text-slate-50'
        : 'border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] text-[var(--text-strong)]';
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
        'group relative overflow-hidden text-left shadow-[0_12px_30px_-24px_rgba(0,0,0,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_36px_-26px_rgba(0,0,0,0.34)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        cardRadiusClass,
        cardHeightClass,
        cardPadding,
        isFeatureCard
          ? 'border-[rgba(var(--accent-rgb),0.22)] bg-[linear-gradient(180deg,rgba(11,19,29,0.96)_0%,rgba(14,24,36,0.92)_100%)] text-slate-50 shadow-[0_24px_56px_-30px_rgba(2,8,23,0.5)]'
          : selected
            ? 'border-[rgba(var(--accent-green-rgb),0.22)] bg-[var(--shell-pane-soft)]'
            : 'border-[rgba(255,255,255,0.08)] bg-[var(--shell-pane-soft)]',
        isFeatureCard && selected && 'border-[rgba(var(--accent-rgb),0.3)]',
        className,
        !selected && !isFeatureCard && 'hover:border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.16)]',
        isFeatureCard && 'hover:border-[rgba(var(--accent-rgb),0.24)]'
      )}
      style={cardStyle}
    >
      {isFeatureCard ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(var(--accent-rgb),0.14),transparent_28%)]"
        />
      ) : null}

      <div className={cn("relative mb-4 w-full overflow-hidden bg-[var(--shell-pane-soft)]", isFeatureCard && 'bg-[rgba(255,255,255,0.04)]', coverHeightClass, coverRadiusClass)}>
        <img
          src={coverImageUrl}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop';
          }}
          className="h-full w-full object-cover"
          alt={effectiveDomain || job.company || 'Challenge cover'}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/26 via-black/8 to-transparent opacity-56 transition-opacity group-hover:opacity-42" />
        <div className="absolute left-3 top-3">
          {domainAccent ? (
            <span className="inline-flex items-center rounded-md border border-white/14 bg-[rgba(7,12,20,0.76)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_10px_22px_-14px_rgba(0,0,0,0.52)] backdrop-blur-md">
              {language === 'cs' || language === 'sk' ? domainAccent.label.cs : domainAccent.label.en}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md border border-white/14 bg-[rgba(7,12,20,0.76)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_10px_22px_-14px_rgba(0,0,0,0.52)] backdrop-blur-md">
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
                      ? 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] text-slate-50'
                      : 'border-[rgba(255,255,255,0.7)] bg-[rgba(var(--card-accent-rgb,var(--accent-rgb)),0.10)] text-[var(--text-strong)]',
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
                    isFeatureCard ? 'border-[rgba(255,255,255,0.12)]' : 'border-[rgba(255,255,255,0.7)]',
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
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(var(--accent-rgb),0.24)] bg-[rgba(var(--accent-rgb),0.16)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-slate-50">
                    <Sparkles size={12} className="opacity-80" />
                    {topMatchLabel}
                  </span>
                ) : null}
              </div>
              <div className={cn('mt-1.5 break-words text-[1.08rem] font-semibold leading-[1.3] tracking-[-0.03em]', titleTextClass, variant === 'hero' && 'text-[1.26rem] sm:text-[1.4rem]', titleClamp)}>{job.title}</div>
              {contextLine ? (
                <div className={cn('mt-2 text-[12px] leading-5', faintTextClass)}>
                  {contextLine}
                </div>
              ) : null}
              {isFeatureCard ? (
                <div className="mt-2 text-[12px] font-medium text-cyan-200">
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
                  ? 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-slate-300/80 hover:bg-[rgba(255,255,255,0.1)] hover:text-slate-50'
                  : 'border-[rgba(255,255,255,0.08)] bg-[var(--shell-pane-soft)] text-[var(--text-muted)] hover:text-[var(--text-strong)]',
              isFeatureCard ? 'mt-1.5' : ''
            )}
            title={saved
              ? localeText(language, { cs: 'Uloženo', sk: 'Uložené', de: 'Gespeichert', pl: 'Zapisane', en: 'Saved' })
              : localeText(language, { cs: 'Uložit', sk: 'Uložiť', de: 'Speichern', pl: 'Zapisz', en: 'Save' })}
          >
            <Bookmark size={16} className={cn(saved && 'fill-current')} />
          </button>
        </div>

        {meaningHook ? (
          <div className="space-y-1">
            <div className={cn('break-words overflow-hidden text-[13px] font-medium leading-[1.75] line-clamp-2', isFeatureCard ? 'text-cyan-50/92' : 'text-[var(--text-strong)]')}>
              {meaningHook}
            </div>
          </div>
        ) : null}

        {!meaningHook && quickSummary ? (
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
        {verdict.label ? (
          <div className={cn('rounded-[18px] border px-3.5 py-3.5', decisionPanelClass)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', isFeatureCard ? 'text-current/70' : faintTextClass)}>
                  {decisionMakerTitle(language)}
                </div>
                <div className="mt-1.5 text-sm font-semibold leading-5">
                  {verdict.label}
                </div>
              </div>
              {matchScore > 0 ? (
                <span className={cn('shrink-0 rounded-[999px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset', matchBadgeClass)}>
                  {matchScore}%
                </span>
              ) : null}
            </div>
            {decisionSupport ? (
              <div className={cn('mt-2 line-clamp-2 text-[12px] leading-[1.55]', isFeatureCard ? 'text-current/80' : mutedTextClass)}>
                {decisionSupport}
              </div>
            ) : null}
            {!decisionSupport && primaryMeta ? (
              <div className={cn('mt-2 line-clamp-1 text-[12px] leading-[1.55]', isFeatureCard ? 'text-current/70' : faintTextClass)}>
                {primaryMeta}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 pt-1.5 sm:grid-cols-2">
          <span className={cn('badge-base rounded-lg px-3 py-2', isFeatureCard ? '!border-[rgba(255,255,255,0.12)] !bg-[rgba(255,255,255,0.06)] !text-slate-100' : 'border-[rgba(15,23,42,0.08)] bg-[var(--surface-muted)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[var(--shell-pane-soft)]', isDefaultCard && 'max-w-full')}>
            <MapPin size={13} />
            <span className="truncate">{primaryMeta}</span>
          </span>
          {relativePostedAt ? (
            <span className={cn('badge-base rounded-lg px-3 py-2', isFeatureCard ? '!border-[rgba(255,255,255,0.12)] !bg-[rgba(255,255,255,0.06)] !text-slate-100' : 'border-[rgba(15,23,42,0.08)] bg-[var(--surface-muted)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[var(--shell-pane-soft)]')}>
              <Clock size={13} />
              <span className="truncate">{relativePostedAt}</span>
            </span>
          ) : null}
          <span className={cn('badge-base rounded-lg px-3 py-2', isFeatureCard ? '!border-[rgba(255,255,255,0.12)] !bg-[rgba(255,255,255,0.06)] !text-slate-100' : 'border-[rgba(15,23,42,0.08)] bg-[var(--surface-muted)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[var(--shell-pane-soft)]', isDefaultCard && 'max-w-full', !relativePostedAt && 'sm:col-span-2')}>
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
                        ? 'border border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.18)] text-cyan-50 shadow-[0_16px_36px_-22px_rgba(var(--accent-rgb),0.26)]'
                        : jhiScore >= 55
                          ? 'border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.10)] text-slate-50'
                          : 'border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.07)] text-slate-200/82'
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

        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm transition',
              isFeatureCard
                ? 'border border-[rgba(var(--accent-rgb),0.24)] bg-[rgba(var(--accent-rgb),0.2)] font-bold text-slate-50 shadow-[0_18px_36px_-18px_rgba(var(--accent-rgb),0.26)] hover:bg-[rgba(var(--accent-rgb),0.26)]'
                : 'border border-[rgba(255,255,255,0.08)] bg-[var(--shell-pane-soft)] font-semibold text-[var(--text-strong)] hover:border-[rgba(var(--accent-rgb),0.16)] hover:bg-[rgba(var(--accent-rgb),0.1)]'
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
  embeddedVariant = 'default',
  onSelect,
  onOpen,
  onToggleSave,
}) => {
  const language = String(locale || 'en').split('-')[0].toLowerCase();
  const isCareerMapOffersMode = embeddedVariant === 'career_map_offers';
  const feedCopy = useMemo(() => ({
    empty: localeText(language, { cs: 'Teď tu nic rozumného neleží. Zkus povolit filtry nebo hrábnout jinam.', sk: 'Teraz tu nič rozumné neleží. Skús povoliť filtre alebo zájsť inam.', de: 'Gerade liegt hier nichts Brauchbares. Lockere die Filter oder geh anders ran.', pl: 'Na razie nie ma tu nic sensownego. Poluzuj filtry albo poszukaj inaczej.', en: 'Nothing solid here right now. Loosen the filters or search from another angle.' }),
    heroTitle: localeText(language, { cs: 'Dnes by tě mohlo posunout', sk: 'Dnes by ťa mohlo posunúť', de: 'Heute könnte dich das weiterbringen', pl: 'Dziś może cię to popchnąć dalej', en: 'This could move you forward today' }),
    heroSubtitle: localeText(language, { cs: '1 silná příležitost', sk: '1 silná príležitosť', de: '1 starke Gelegenheit', pl: '1 mocna okazja', en: '1 strong opportunity' }),
    recommendationTitle: localeText(language, { cs: '🎯 DOPORUČENÍ', sk: '🎯 ODPORÚČANIA', de: '🎯 EMPFOHLEN', pl: '🎯 POLECANE', en: '🎯 RECOMMENDED' }),
    recommendationSubtitle: localeText(language, { cs: 'Tady je druhá vlna věcí, které dávají nejsilnější smysl otevřít.', sk: 'Tu je druhá vlna vecí, ktoré dávajú najsilnejší zmysel otvoriť.', de: 'Hier kommt die zweite Welle von Dingen, die sich am ehesten zu öffnen lohnen.', pl: 'To druga fala rzeczy, które najbardziej warto otworzyć.', en: 'Here is the second wave of roles most worth opening.' }),
    surpriseTitle: localeText(language, { cs: '🌱 MOŽNÁ TĚ PŘEKVAPÍ', sk: '🌱 MOŽNO ŤA PREKVAPÍ', de: '🌱 KÖNNTE DICH ÜBERRASCHEN', pl: '🌱 MOŻE CIĘ ZASKOCZYĆ', en: '🌱 MIGHT SURPRISE YOU' }),
    surpriseSubtitle: localeText(language, { cs: 'Není to nejzřejmější match, ale něco na tom stojí za druhý pohled.', sk: 'Nie je to najzrejmejší match, ale niečo na tom stojí za druhý pohľad.', de: 'Nicht der offensichtlichste Match, aber etwas daran verdient einen zweiten Blick.', pl: 'To nie jest najbardziej oczywiste dopasowanie, ale coś tu zasługuje na drugi rzut oka.', en: 'Not the most obvious match, but something here deserves a second look.' }),
    guidanceTitle: localeText(language, { cs: '🧭 SMĚROVÁNÍ', sk: '🧭 SMEROVANIE', de: '🧭 ORIENTIERUNG', pl: '🧭 KIERUNEK', en: '🧭 GUIDANCE' }),
    guidanceSubtitle: localeText(language, { cs: 'Role, kde je jasnější co bys řešil, s kým a jak rychle se to může pohnout.', sk: 'Roly, kde je jasnejšie čo by si riešil, s kým a ako rýchlo sa to môže pohnúť.', de: 'Rollen, bei denen klarer ist, was du lösen würdest, mit wem und wie schnell es sich bewegt.', pl: 'Role, w których jaśniej widać, co będziesz robić, z kim i jak szybko to może ruszyć.', en: 'Roles where it is clearer what you would solve, with whom, and how fast it can move.' }),
    classicTitle: localeText(language, { cs: '🧩 KLASICKÁ ROLE', sk: '🧩 KLASICKÁ ROLA', de: '🧩 KLASSISCHE ROLLE', pl: '🧩 KLASYCZNA ROLA', en: '🧩 CLASSIC ROLE' }),
    classicSubtitle: localeText(language, { cs: 'Čistší nabídky bez extra wow momentu, ale pořád ve hře.', sk: 'Čistejšie ponuky bez extra wow momentu, ale stále v hre.', de: 'Sauberere Rollen ohne großen Wow-Moment, aber immer noch im Spiel.', pl: 'Czystsze oferty bez wielkiego wow, ale nadal w grze.', en: 'Cleaner roles without a big wow moment, but still in play.' }),
    remainingTitle: localeText(language, { cs: 'DALŠÍ VE HŘE', sk: 'ĎALŠIE V HRE', de: 'MEHR IM SPIEL', pl: 'KOLEJNE W GRZE', en: 'MORE IN PLAY' }),
    remainingSubtitle: localeText(language, { cs: 'Zbytek kompozice pro chvíli, kdy chceš procházet dál.', sk: 'Zvyšok kompozície pre chvíľu, keď chceš prechádzať ďalej.', de: 'Der Rest der Komposition für den Moment, in dem du weiterstöbern willst.', pl: 'Reszta kompozycji na moment, gdy chcesz przeglądać dalej.', en: 'The rest of the composition for when you want to keep browsing.' }),
  }), [language]);

  const { sections, remaining, compactJobs, heroJob } = useMemo(() => {
    const pool = Array.isArray(jobs) ? jobs.slice() : [];
    const sorted = compactLayout || isCareerMapOffersMode ? pool : sortJobsForDiscovery(pool);
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
    const topDeckCandidates = standardSorted.filter((job) => getCardVerdictTone(job) !== 'bad');
    const prioritisedCandidates = topDeckCandidates.length ? topDeckCandidates : standardSorted;
    const heroCandidate = prioritisedCandidates.length
      ? prioritisedCandidates
        .slice()
        .sort((left, right) => getFeatureScore(right) - getFeatureScore(left))[0]
      : null;

    if (heroCandidate?.id) {
      used.add(heroCandidate.id);
    }

    if (compactLayout || isCareerMapOffersMode) {
      return {
        sections: [] as FeedSection[],
        remaining: [] as Job[],
        compactJobs: placeBadVerdictsLater(standardSorted.filter((job) => job.id !== heroCandidate?.id)),
        heroJob: isCareerMapOffersMode ? null : heroCandidate,
      };
    }

    const recommendationCandidates = prioritisedCandidates
      .slice()
      .sort((a: any, b: any) => {
        const scoreA = Number(a.priorityScore || 0) + Number(a.jhi?.score || 0) + salaryAnchor(a) / 1000 - Number(a.distanceKm || 0) / 8;
        const scoreB = Number(b.priorityScore || 0) + Number(b.jhi?.score || 0) + salaryAnchor(b) / 1000 - Number(b.distanceKm || 0) / 8;
        return scoreB - scoreA;
      });
    const recommendation: Job[] = [];
    const hasImportedCandidates = recommendationCandidates.some((job) => isImportedListing(job));
    recommendation.push(...take(recommendationCandidates.filter((job) => !isImportedListing(job)), hasImportedCandidates ? 2 : 3));
    if (hasImportedCandidates) {
      recommendation.push(...take(recommendationCandidates.filter((job) => isImportedListing(job)), 1));
    }
    if (recommendation.length < 3) {
      recommendation.push(...take(recommendationCandidates, 3 - recommendation.length));
    }

    const surpriseCandidates = prioritisedCandidates
      .filter((job) => {
        const matchScore = clamp(Math.round(Number(job.aiMatchScore || 0)), 0, 100);
        const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);
        return job.matchBucket === 'adjacent' || isImportedListing(job) || (matchScore < 62 && jhiScore >= 58);
      })
      .slice()
      .sort((a: any, b: any) => getFeatureScore(b) - getFeatureScore(a));
    const surprise = take(surpriseCandidates, 3);

    const guidanceCandidates = prioritisedCandidates
      .slice()
      .sort((left, right) => {
        const leftContext = (left.firstStepPrompt ? 2 : 0) + (left.companyGoal ? 2 : 0) + (reactionWindowHours(left) !== null ? 1 : 0);
        const rightContext = (right.firstStepPrompt ? 2 : 0) + (right.companyGoal ? 2 : 0) + (reactionWindowHours(right) !== null ? 1 : 0);
        if (rightContext !== leftContext) return rightContext - leftContext;
        return getFeatureScore(right) - getFeatureScore(left);
      });
    const guidance = take(guidanceCandidates, 3);

    const classicCandidates = prioritisedCandidates
      .slice()
      .sort((left, right) => {
        const leftScore = Math.abs(clamp(Math.round(Number(left.aiMatchScore || left.jhi?.score || 0)), 0, 100) - 62);
        const rightScore = Math.abs(clamp(Math.round(Number(right.aiMatchScore || right.jhi?.score || 0)), 0, 100) - 62);
        if (leftScore !== rightScore) return leftScore - rightScore;
        return getFeatureScore(right) - getFeatureScore(left);
      });
    const classic = take(classicCandidates, 4);

    const sectionsList: FeedSection[] = [];

    if (recommendation.length) {
      sectionsList.push({
        key: 'recommendation',
        title: { cs: feedCopy.recommendationTitle, en: feedCopy.recommendationTitle },
        subtitle: { cs: feedCopy.recommendationSubtitle, en: feedCopy.recommendationSubtitle },
        layout: 'grid_large',
        tone: 'match',
        jobs: recommendation,
      });
    }
    if (surprise.length) {
      sectionsList.push({
        key: 'surprise',
        title: { cs: feedCopy.surpriseTitle, en: feedCopy.surpriseTitle },
        subtitle: { cs: feedCopy.surpriseSubtitle, en: feedCopy.surpriseSubtitle },
        layout: 'grid',
        jobs: surprise,
      });
    }
    if (guidance.length) {
      sectionsList.push({
        key: 'guidance',
        title: { cs: feedCopy.guidanceTitle, en: feedCopy.guidanceTitle },
        subtitle: { cs: feedCopy.guidanceSubtitle, en: feedCopy.guidanceSubtitle },
        layout: 'grid',
        jobs: guidance,
      });
    }
    if (classic.length) {
      sectionsList.push({
        key: 'classic',
        title: { cs: feedCopy.classicTitle, en: feedCopy.classicTitle },
        subtitle: { cs: feedCopy.classicSubtitle, en: feedCopy.classicSubtitle },
        layout: 'grid',
        jobs: classic,
      });
    }

    const remainingJobs = placeBadVerdictsLater(sorted.filter((job) => job?.id && !used.has(job.id) && !isMicro(job)));
    return { sections: sectionsList, remaining: remainingJobs, compactJobs: [] as Job[], heroJob: heroCandidate };
  }, [
    compactLayout,
    isCareerMapOffersMode,
    feedCopy.classicSubtitle,
    feedCopy.classicTitle,
    feedCopy.guidanceSubtitle,
    feedCopy.guidanceTitle,
    feedCopy.recommendationSubtitle,
    feedCopy.recommendationTitle,
    feedCopy.surpriseSubtitle,
    feedCopy.surpriseTitle,
    jobs,
  ]);

  const sectionHighlightIndexes = useMemo(() => {
    const indexes = new Map<string, number | null>();

    sections.forEach((section) => {
      const preferredIndex = section.key === 'recommendation'
        ? 1
        : section.key === 'surprise'
          ? 0
          : section.key === 'guidance'
            ? Math.min(2, Math.max(0, section.jobs.length - 1))
            : 0;

      indexes.set(section.key, pickHighlightIndex(section.jobs, preferredIndex));
    });

    return indexes;
  }, [sections]);

  const compactDisplayJobs = useMemo(() => compactJobs, [compactJobs]);
  const compactHighlightIndexes = useMemo(() => (
    pickChunkHighlightIndexes(compactDisplayJobs, 6, 2)
  ), [compactDisplayJobs]);
  const visibleRemaining = useMemo(() => remaining, [remaining]);
  const remainingHighlightIndexes = useMemo(
    () => pickChunkHighlightIndexes(visibleRemaining, 6, 2),
    [visibleRemaining]
  );

  if (loading && jobs.length === 0) {
    return <LoadingEditorialFeedSkeleton compactLayout={compactLayout} />;
  }

  if (compactLayout || isCareerMapOffersMode) {
    if (compactJobs.length === 0) {
      return (
        <div className="py-10 text-center text-sm text-[var(--text-muted)]">
          {feedCopy.empty}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {!isCareerMapOffersMode && heroJob ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {feedCopy.heroTitle}
                </div>
                <div className="mt-2 inline-flex items-center rounded-[999px] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.08)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-strong)]">
                  {feedCopy.heroSubtitle}
                </div>
              </div>
            </div>
            <OfferCard
              key={heroJob.id}
              job={heroJob}
              selected={heroJob.id === selectedJobId}
              saved={savedJobIds.includes(heroJob.id)}
              language={language}
              variant="hero"
              contrast={true}
              embeddedVariant={embeddedVariant}
              className="w-full"
              onSelect={() => onSelect(heroJob.id)}
              onOpen={() => onOpen(heroJob.id)}
              onToggleSave={() => onToggleSave(heroJob.id)}
            />
          </div>
        ) : null}
        <div className={cn(
          'grid items-stretch gap-5',
          isCareerMapOffersMode ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 md:grid-cols-6 xl:grid-cols-12',
        )}>
          {compactDisplayJobs.map((job, index, list) => (
            <OfferCard
              key={job.id}
              job={job}
              selected={job.id === selectedJobId}
              saved={savedJobIds.includes(job.id)}
              language={language}
              variant="default"
              contrast={isCareerMapOffersMode ? false : compactHighlightIndexes.has(index)}
              embeddedVariant={embeddedVariant}
              className={isCareerMapOffersMode ? 'w-full' : getBalancedGridSpanClass(index, list.length)}
              onSelect={() => onSelect(job.id)}
              onOpen={() => onOpen(job.id)}
              onToggleSave={() => onToggleSave(job.id)}
            />
          ))}
        </div>
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
      {heroJob ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {feedCopy.heroTitle}
              </div>
              <div className="mt-2 inline-flex items-center rounded-[999px] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.08)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-strong)]">
                {feedCopy.heroSubtitle}
              </div>
            </div>
          </div>
          <OfferCard
            key={heroJob.id}
            job={heroJob}
            selected={heroJob.id === selectedJobId}
            saved={savedJobIds.includes(heroJob.id)}
            language={language}
            variant="hero"
            contrast={true}
            className="w-full"
            onSelect={() => onSelect(heroJob.id)}
            onOpen={() => onOpen(heroJob.id)}
            onToggleSave={() => onToggleSave(heroJob.id)}
          />
        </div>
      ) : null}
      {sections.map((section) => {
        const title = section.title.cs;
        const subtitle = section.subtitle ? section.subtitle.cs : undefined;

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
