import React from 'react';
import { Bookmark, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Job, UserProfile } from '../types';
import { EmptyState, MetricTile, PageHeader, SurfaceCard } from './ui/primitives';

interface SavedJobsPageProps {
  savedJobs: Job[];
  savedJobIds: string[];
  onToggleSave: (jobId: string) => void;
  onJobSelect: (jobId: string) => void;
  onApplyToJob: (job: Job) => void;
  selectedJobId: string | null;
  userProfile: UserProfile;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const SavedJobsPage: React.FC<SavedJobsPageProps> = ({
  savedJobs,
  savedJobIds,
  onToggleSave,
  onJobSelect,
  onApplyToJob,
  selectedJobId,
  searchTerm,
  onSearchChange
}) => {
  const { t } = useTranslation();

  const filteredSavedJobs = savedJobs.filter((job) =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemoveAllSaved = () => {
    if (window.confirm(t('saved_jobs_page.confirm_remove_all'))) {
      savedJobIds.forEach((jobId) => onToggleSave(jobId));
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow={t('saved_jobs_page.badge', { defaultValue: 'Watchlist' })}
        title={t('saved_jobs_page.title')}
        body={t('saved_jobs_page.count', { count: savedJobs.length })}
        actions={
          <>
            <MetricTile label={t('saved_jobs_page.title')} value={savedJobs.length} className="min-w-[140px]" />
            {savedJobs.length > 0 ? (
              <button type="button" onClick={handleRemoveAllSaved} className="app-button-secondary text-rose-700 dark:text-rose-200">
                <Trash2 size={15} />
                {t('saved_jobs_page.remove_all')}
              </button>
            ) : null}
          </>
        }
      />

      <SurfaceCard className="space-y-4">
        <label htmlFor="saved-jobs-search" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
          {t('saved_jobs_page.search_placeholder')}
        </label>
        <div className="app-command-field">
          <Search size={16} className="text-[var(--text-faint)]" />
          <input
            id="saved-jobs-search"
            name="saved_jobs_search"
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('saved_jobs_page.search_placeholder')}
            aria-label={t('saved_jobs_page.search_placeholder')}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
          />
        </div>
      </SurfaceCard>

      {savedJobs.length === 0 ? (
        <EmptyState
          title={t('saved_jobs_page.empty_title')}
          body={t('saved_jobs_page.empty_desc')}
          action={<div className="text-sm text-[var(--text-faint)]">{t('saved_jobs_page.empty_tip')}</div>}
        />
      ) : filteredSavedJobs.length === 0 ? (
        <EmptyState
          title={t('saved_jobs_page.no_results_title')}
          body={t('saved_jobs_page.no_results_desc')}
        />
      ) : (
        <div className="grid gap-3">
          {filteredSavedJobs.map((job) => (
            <SurfaceCard key={job.id} className={selectedJobId === job.id ? 'border-[rgba(var(--accent-rgb),0.28)] bg-[var(--accent-soft)]' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="app-eyebrow w-fit">
                    <Bookmark size={12} />
                    {t('saved_jobs_page.badge', { defaultValue: 'Watchlist' })}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => onJobSelect(job.id)}
                      className="text-left text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]"
                    >
                      {job.title}
                    </button>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <p className="text-sm leading-7 text-[var(--text-muted)]">
                    {String(job.description || '')
                      .replace(/[#>*_`~[\]()!-]+/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .slice(0, 180)}
                    ...
                  </p>
                </div>

                <div className="grid min-w-[220px] gap-3 sm:grid-cols-3 lg:min-w-[260px] lg:grid-cols-1">
                  <MetricTile label="JHI" value={`${Math.round(job.jhi?.score || 0)}/100`} tone="accent" />
                  <MetricTile label={t('saved_jobs_page.title')} value={job.work_model || job.type || '—'} />
                  <MetricTile label={t('saved_jobs_page.search_placeholder')} value={job.salaryRange || '—'} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-4">
                <button type="button" onClick={() => onJobSelect(job.id)} className="app-button-primary">
                  {t('job.details') || 'Detail'}
                </button>
                <button type="button" onClick={() => onApplyToJob(job)} className="app-button-secondary">
                  {t('app.i_am_interested') || 'Mám zájem'}
                </button>
                <button type="button" onClick={() => onToggleSave(job.id)} className="app-button-secondary text-rose-700 dark:text-rose-200">
                  <Trash2 size={15} />
                  {t('saved_jobs_page.remove_from_saved')}
                </button>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedJobsPage;
