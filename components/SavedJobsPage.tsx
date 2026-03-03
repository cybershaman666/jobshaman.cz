import React from 'react';
import { Job, UserProfile } from '../types';
import { Bookmark, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import JobCard from './JobCard';

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
  userProfile,
  searchTerm,
  onSearchChange
}) => {
  const { t } = useTranslation();

  const filteredSavedJobs = savedJobs.filter(job =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemoveAllSaved = () => {
    if (window.confirm(t('saved_jobs_page.confirm_remove_all'))) {
      savedJobIds.forEach(jobId => onToggleSave(jobId));
    }
  };

  return (
    <div className="min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200/80 bg-white/90 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-cyan-100 p-2.5 dark:bg-cyan-900/30">
              <Bookmark className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
                <Bookmark className="w-3.5 h-3.5" />
                {t('saved_jobs_page.badge', { defaultValue: 'Watchlist' })}
              </div>
              <h1 className="mt-3 truncate text-2xl font-bold text-slate-900 dark:text-white">
                {t('saved_jobs_page.title')}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t('saved_jobs_page.count', { count: savedJobs.length })}
              </p>
            </div>
          </div>
          
          {savedJobs.length > 0 && (
            <button
              onClick={handleRemoveAllSaved}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/20"
            >
              {t('saved_jobs_page.remove_all')}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <label htmlFor="saved-jobs-search" className="sr-only">
            {t('saved_jobs_page.search_placeholder')}
          </label>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            id="saved-jobs-search"
            name="saved_jobs_search"
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('saved_jobs_page.search_placeholder')}
            aria-label={t('saved_jobs_page.search_placeholder')}
            className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {savedJobs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {t('saved_jobs_page.empty_title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {t('saved_jobs_page.empty_desc')}
              </p>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {t('saved_jobs_page.empty_tip')}
              </div>
            </div>
          </div>
        ) : filteredSavedJobs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {t('saved_jobs_page.no_results_title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('saved_jobs_page.no_results_desc')}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto custom-scrollbar p-6">
            <div className="grid grid-cols-1 gap-4">
              {filteredSavedJobs.map((job) => (
                <div
                  key={job.id}
                  className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="relative min-w-0">
                    <JobCard
                      job={job}
                      onClick={() => onJobSelect(job.id)}
                      isSelected={selectedJobId === job.id}
                      isSaved={true}
                      onToggleSave={() => onToggleSave(job.id)}
                      userProfile={userProfile}
                    />
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        onClick={() => onJobSelect(job.id)}
                        className="min-w-0 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span className="block truncate">{t('job.details') || 'Detail'}</span>
                      </button>
                      <button
                        onClick={() => onApplyToJob(job)}
                        className="min-w-0 px-3 py-2 text-sm font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                      >
                        <span className="block truncate">{t('app.i_am_interested') || 'Mám zájem'}</span>
                      </button>
                      <button
                        onClick={() => onToggleSave(job.id)}
                        className="min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                        title={t('saved_jobs_page.remove_from_saved')}
                      >
                        <X className="w-4 h-4 flex-shrink-0" />
                        <span className="block truncate">{t('saved_jobs_page.remove_from_saved')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedJobsPage;
