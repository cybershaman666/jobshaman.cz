import React, { useMemo } from 'react';
import { ArrowRight, Leaf, Zap } from 'lucide-react';
import { Job } from '../../types';
import { SurfaceCard, cn } from '../ui/primitives';

interface MiniChallengesRailProps {
  jobs: Job[];
  onOpen: (jobId: string) => void;
  onSelect?: (jobId: string) => void;
  selectedJobId?: string | null;
  locale: string;
  onCreateTask?: () => void;
  hidePostBtn?: boolean;
  postInfo?: React.ReactNode;
}

const isMicroJob = (job: Job): boolean => job.challenge_format === 'micro_job';

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  if (job.micro_job_reward) return job.micro_job_reward;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR');
  if (from && to) return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  if (from || to) return `${(from || to).toLocaleString(locale)} ${currency}`;
  return isCsLike ? 'Odměna neuvedena' : 'Budget not specified';
};

const MiniChallengesRail: React.FC<MiniChallengesRailProps> = ({
  jobs,
  onOpen,
  onSelect,
  selectedJobId,
  locale,
  onCreateTask,
  hidePostBtn,
  postInfo,
}) => {
  const language = String(locale || 'en').split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';

  const microJobs = useMemo(() => {
    return (jobs || [])
      .filter(isMicroJob)
      .slice()
      .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0))
      .slice(0, 14);
  }, [jobs]);

  const copy = language === 'cs'
    ? {
      railTitle: 'Mini výzvy',
      postBtnLabel: 'Zadat novou výzvu +',
      respond: 'Odpovědět',
      empty: 'Zatím žádné mini výzvy (fušky). Buďte první!',
      budgetMissing: 'Odměna neuvedena',
    }
    : language === 'sk'
      ? {
        railTitle: 'Mini výzvy',
        postBtnLabel: 'Zadať novú výzvu +',
        respond: 'Odpovedať',
        empty: 'Zatiaľ žiadne mini výzvy. Buďte prví!',
        budgetMissing: 'Odmena neuvedená',
      }
      : language === 'de'
        ? {
          railTitle: 'Mini-Jobs',
          postBtnLabel: 'Neue Challenge posten +',
          respond: 'Antworten',
          empty: 'Noch keine Mini-Jobs. Seien Sie die Ersten!',
          budgetMissing: 'Budget nicht angegeben',
        }
        : language === 'pl'
          ? {
            railTitle: 'Mini wyzwania',
            postBtnLabel: 'Dodaj nowe wyzwanie +',
            respond: 'Odpowiedz',
            empty: 'Na razie brak mini wyzwań. Bądź pierwszy!',
            budgetMissing: 'Budżet niepodany',
          }
          : {
            railTitle: 'Mini Challenges',
            postBtnLabel: 'Post a challenge +',
            respond: 'Respond',
            empty: 'No mini challenges yet. Be the first!',
            budgetMissing: 'Budget not specified',
          };

  return (
    <SurfaceCard className="space-y-4 rounded-[var(--radius-surface)] p-4 shadow-[var(--shadow-soft)]" variant="frost">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
          {copy.railTitle}
        </div>
        <div className="flex items-center gap-3">
          {microJobs.length > 0 && (
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {microJobs.length}
            </div>
          )}
          {!hidePostBtn && (
            <button
              id="create-mini-challenge-btn"
              onClick={onCreateTask}
              className="app-button-spotlight inline-flex items-center rounded-full px-3 py-2 text-[11px] font-bold"
            >
              <Zap size={14} className="mr-1 inline-block" />
              {copy.postBtnLabel}
            </button>
          )}
          {postInfo}
        </div>
      </div>
      {microJobs.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {microJobs.map((job) => {
            const selected = selectedJobId === job.id;
            return (
              <div key={job.id} className="min-w-[280px] max-w-[280px] shrink-0">
                <button
                  type="button"
                  className={cn(
                    "w-full text-left",
                    "rounded-[22px] border p-4 backdrop-blur-xl transition hover:-translate-y-[1px]",
                    selected
                      ? "border-[rgba(var(--accent-green-rgb),0.28)] bg-[rgba(var(--accent-green-rgb),0.1)] shadow-[var(--shadow-soft)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-card)] hover:border-[rgba(var(--accent-sky-rgb),0.22)] hover:bg-[var(--surface-elevated)]"
                  )}
                  onClick={() => onSelect?.(job.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--text-strong)]">{job.title}</div>
                      <div className="mt-1 truncate text-xs text-[var(--text-faint)]">{job.company}</div>
                    </div>
                    <span className="company-pill-surface inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold text-[var(--accent-green)]">
                      <Leaf size={12} />
                      {isCsLike ? 'MINI' : 'MINI'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.micro_job_time_estimate ? (
                      <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                        {job.micro_job_time_estimate}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                      {job.salaryRange || Number(job.salary_from || 0) || Number(job.salary_to || 0)
                        ? formatSalary(job, locale || 'en', isCsLike)
                        : copy.budgetMissing}
                    </span>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="app-button-primary w-full justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(job.id);
                      }}
                    >
                      {copy.respond}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-soft)]">
          <p className="text-xs text-[var(--text-faint)]">
            {copy.empty}
          </p>
        </div>
      )}
    </SurfaceCard>
  );
};

export default MiniChallengesRail;
