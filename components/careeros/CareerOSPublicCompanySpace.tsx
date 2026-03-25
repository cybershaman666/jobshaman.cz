import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Globe, MapPin, Sparkles } from 'lucide-react';

import type { CompanyProfile, Job } from '../../types';
import { fetchJobsByCompany } from '../../services/jobService';
import { getCompanyPublicInfo } from '../../services/supabaseService';
import { cn } from '../ui/primitives';
import { mapCompanyToCareerOSSpace } from '../../src/app/careeros/model/viewModels';

interface CareerOSPublicCompanySpaceProps {
  companyId: string;
  onBack: () => void;
  onOpenChallenge: (jobId: string) => void;
}

const panelClass =
  'rounded-[30px] border border-[rgba(15,23,42,0.08)] bg-white/74 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(10,17,25,0.74)]';

const CareerOSPublicCompanySpace: React.FC<CareerOSPublicCompanySpaceProps> = ({
  companyId,
  onBack,
  onOpenChallenge,
}) => {
  const [company, setCompany] = useState<Partial<CompanyProfile> | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getCompanyPublicInfo(companyId), fetchJobsByCompany(companyId, 20)])
      .then(([companyInfo, companyJobs]) => {
        if (cancelled) return;
        const nativeJobs = companyJobs.filter((job) => job.listingKind !== 'imported');
        setCompany(companyInfo || null);
        setJobs(nativeJobs.length > 0 ? nativeJobs : companyJobs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const workspace = useMemo(() => mapCompanyToCareerOSSpace(company, jobs), [company, jobs]);

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[4%] h-64 w-64 rounded-full bg-emerald-400/14 blur-[110px]" />
        <div className="absolute bottom-[8%] right-[8%] h-72 w-72 rounded-full bg-sky-400/14 blur-[130px]" />
      </div>
      <div className="relative space-y-5">
        <section className={cn(panelClass, 'overflow-hidden p-6 sm:p-7')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/76 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)] dark:border-white/10 dark:bg-white/5">
                <Sparkles size={12} />
                Public company space
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">{workspace.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">{workspace.description}</p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/88 px-4 py-2.5 text-sm font-medium text-[var(--text-strong)] dark:border-white/10 dark:bg-white/5"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cn(panelClass, 'p-4 shadow-none')}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Open challenges</div>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{workspace.challenges.length}</div>
            </div>
            <div className={cn(panelClass, 'p-4 shadow-none')}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Tone</div>
              <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">{workspace.tone}</div>
            </div>
            <div className={cn(panelClass, 'p-4 shadow-none')}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Website</div>
              <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">{workspace.website}</div>
            </div>
            <div className={cn(panelClass, 'p-4 shadow-none')}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Location</div>
              <div className="mt-2 text-base font-semibold text-[var(--text-strong)]">{workspace.location}</div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className={cn(panelClass, 'p-6')}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              <Building2 size={12} />
              Challenge deck
            </div>
            {loading ? (
              <div className="mt-5 text-sm text-[var(--text-muted)]">Loading company space…</div>
            ) : workspace.challenges.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-[rgba(15,23,42,0.12)] p-6 text-sm text-[var(--text-muted)]">
                This company does not have live public challenges right now.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {workspace.challenges.map((challenge) => (
                  <button
                    key={challenge.id}
                    type="button"
                    onClick={() => onOpenChallenge(challenge.id)}
                    className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/82 p-5 text-left transition hover:-translate-y-0.5 hover:border-[rgba(var(--accent-rgb),0.26)] dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{challenge.sourceLabel}</div>
                        <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{challenge.title}</div>
                        <div className="mt-1 text-sm text-[var(--text-muted)]">{challenge.location} · {challenge.salary}</div>
                      </div>
                      <div className="rounded-full bg-[rgba(var(--accent-rgb),0.12)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
                        {challenge.jhiScore}
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--text)]">{challenge.challengeSummary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {challenge.topTags.map((tag) => (
                        <span key={tag} className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white/84 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] dark:border-white/10 dark:bg-white/5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className={cn(panelClass, 'p-5')}>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                <Globe size={12} />
                Philosophy
              </div>
              <div className="mt-3 text-lg font-semibold text-[var(--text-strong)]">{workspace.philosophy}</div>
              <div className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{workspace.description}</div>
            </section>

            <section className={cn(panelClass, 'p-5')}>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                <MapPin size={12} />
                Company DNA
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {workspace.values.length > 0 ? workspace.values.map((value) => (
                  <span key={value} className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
                    {value}
                  </span>
                )) : (
                  <span className="text-sm text-[var(--text-muted)]">Values are not public yet.</span>
                )}
              </div>
              <div className="mt-5 text-sm text-[var(--text-muted)]">{workspace.website}</div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">{workspace.location}</div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CareerOSPublicCompanySpace;
