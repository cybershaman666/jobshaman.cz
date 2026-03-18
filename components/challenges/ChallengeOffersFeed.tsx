import React, { useMemo } from 'react';
import { ArrowRight, Bookmark, Leaf, MapPin, Target } from 'lucide-react';
import type { Job } from '../../types';
import { cn } from '../ui/primitives';
import { getFallbackCompanyAvatarUrl } from '../../utils/companyStockAvatars';
import { getDomainAccent, getPrimaryJobDomain } from '../../utils/domainAccents';

interface ChallengeOffersFeedProps {
  jobs: Job[];
  selectedJobId: string | null;
  savedJobIds: string[];
  locale: string;
  onSelect: (jobId: string) => void;
  onOpen: (jobId: string) => void;
  onToggleSave: (jobId: string) => void;
}

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR');
  if (from && to) return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  if (from || to) return `${(from || to).toLocaleString(locale)} ${currency}`;
  return isCsLike ? 'Mzda neuvedena' : 'Salary not specified';
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const ChallengeOffersFeed: React.FC<ChallengeOffersFeedProps> = ({
  jobs,
  selectedJobId,
  savedJobIds,
  locale,
  onSelect,
  onOpen,
  onToggleSave,
}) => {
  const normalizedLocale = (locale || 'en').split('-')[0].toLowerCase();
  const isCsLike = normalizedLocale === 'cs' || normalizedLocale === 'sk';

  const sortedJobs = useMemo(() => {
    const list = Array.isArray(jobs) ? [...jobs] : [];
    list.sort((a, b) => (Number(b.jhi?.score || 0) - Number(a.jhi?.score || 0)));
    return list;
  }, [jobs]);

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {sortedJobs.map((job) => {
        const isSelected = job.id === selectedJobId;
        const isSaved = savedJobIds.includes(job.id);
        const avatarUrl = String(job.companyProfile?.logo_url || '').trim() || getFallbackCompanyAvatarUrl(job.company);
        const jhiScore = clamp(Math.round(Number(job.jhi?.score || 0)), 0, 100);
        const salary = formatSalary(job, isCsLike ? 'cs-CZ' : 'en', isCsLike);
        const problem = String(job.challenge || '').trim();
        const goal = String(job.companyGoal || '').trim();
        const isMicro = job.challenge_format === 'micro_job';
        const domain = getPrimaryJobDomain(job);
        const domainAccent = getDomainAccent(domain);
        const cardStyle = domainAccent
          ? ({
            ['--card-accent-rgb' as any]: domainAccent.rgb,
          } as React.CSSProperties)
          : undefined;

        return (
          <div
            key={job.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(job.id)}
            onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(job.id);
              }
            }}
            style={cardStyle}
            className={cn(
              'app-surface app-path-glow rounded-[var(--radius-xl)] border',
              'group relative overflow-hidden p-4 text-left shadow-[var(--shadow-soft)] backdrop-blur-2xl transition hover:-translate-y-[1px] hover:shadow-[var(--shadow-card)]',
              'ring-1 ring-white/50 dark:ring-white/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.30)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]',
              isSelected
                ? 'border-[rgba(var(--accent-green-rgb),0.30)] bg-[linear-gradient(135deg,rgba(255,252,245,0.92),rgba(244,250,246,0.94)_56%,rgba(241,249,244,0.92))]'
                : 'border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.14)] bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(var(--card-accent-rgb, var(--accent-green-rgb)),0.08)_58%,rgba(255,255,255,0.78))] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.62),rgba(var(--card-accent-rgb, var(--accent-green-rgb)),0.08)_58%,rgba(12,18,14,0.64))]',
              !isSelected && 'hover:border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.22)]'
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_55%)] opacity-80 dark:opacity-30"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle at 35% 35%, rgba(var(--card-accent-rgb, var(--accent-green-rgb)),0.18), transparent 62%)' }}
            />

            <div className="relative space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <img
                    src={avatarUrl}
                    alt={job.company}
                    className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-1 ring-[rgba(var(--accent-rgb),0.18)]"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[var(--text-strong)]">{job.company}</div>
                      {domainAccent ? (
                        <span className="inline-flex items-center rounded-full border border-[rgba(var(--card-accent-rgb),0.18)] bg-[rgba(var(--card-accent-rgb),0.10)] px-2 py-0.5 text-[11px] font-semibold text-[rgba(var(--card-accent-rgb),0.92)]">
                          {isCsLike ? domainAccent.label.cs : domainAccent.label.en}
                        </span>
                      ) : null}
                      {isMicro ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.10)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                          <Leaf size={12} />
                          {isCsLike ? 'Mini' : 'Mini'}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 line-clamp-1 break-words text-xs font-medium text-[var(--text-muted)]">{job.title}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave(job.id);
                  }}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition',
                    isSaved
                      ? 'border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.24)] bg-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.12)] text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]'
                      : 'border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.14)] bg-white/55 text-[var(--text-muted)] hover:text-[var(--text-strong)] dark:bg-white/5'
                  )}
                  title={isSaved ? (isCsLike ? 'Uloženo' : 'Saved') : (isCsLike ? 'Uložit' : 'Save')}
                >
                  <Bookmark size={16} className={cn(isSaved && 'fill-current')} />
                </button>
              </div>

              {problem ? (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    {isCsLike ? 'Problem' : 'Problem'}
                  </div>
                  <div className="line-clamp-3 break-words text-sm leading-6 text-[var(--text-strong)]">{problem}</div>
                </div>
              ) : null}

              {goal ? (
                <div className="flex items-start gap-2 rounded-[1.1rem] border border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.14)] bg-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.06)] px-3 py-2">
                  <Target size={16} className="mt-0.5 shrink-0 text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {isCsLike ? 'Goal' : 'Goal'}
                    </div>
                    <div className="mt-0.5 line-clamp-2 break-words text-sm leading-6 text-[var(--text-muted)]">{goal}</div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] dark:bg-white/5">
                  <MapPin size={14} />
                  {job.type || job.location}
                </span>
                <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] dark:bg-white/5">
                  {salary}
                </span>
                <span
                  className={cn(
                    'ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                    jhiScore >= 75
                      ? 'border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
                      : jhiScore >= 55
                        ? 'border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.10)] text-[var(--accent)]'
                        : 'border-[rgba(var(--accent-rgb),0.14)] bg-white/70 text-[var(--text-muted)] dark:bg-white/5'
                  )}
                  title={isCsLike ? 'Job Health Index' : 'Job Health Index'}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  JHI {jhiScore}
                </span>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(job.id);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.20)] bg-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.10)] px-3 py-2 text-sm font-semibold text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)] transition hover:bg-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.14)]"
                >
                  {isMicro ? (isCsLike ? 'Odpovědět' : 'Respond') : (isCsLike ? '🤝 Pošli první krok' : "🤝 Send your first step")}
                  <ArrowRight size={16} />
                </button>
              </div>
              </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChallengeOffersFeed;
