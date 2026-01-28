import React from 'react';
import { Job, UserProfile } from '../types';
import { Bookmark, X, Search } from 'lucide-react';

import JobCard from './JobCard';

interface SavedJobsPageProps {
  savedJobs: Job[];
  savedJobIds: string[];
  onToggleSave: (jobId: string) => void;
  onJobSelect: (jobId: string) => void;
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
  selectedJobId,
  userProfile,
  searchTerm,
  onSearchChange
}) => {

  const filteredSavedJobs = savedJobs.filter(job =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemoveAllSaved = () => {
    if (window.confirm('Opravdu chcete odebrat všechny uložené pracovní pozice?')) {
      savedJobIds.forEach(jobId => onToggleSave(jobId));
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Bookmark className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Uložené pracovní pozice
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {savedJobs.length} {savedJobs.length === 1 ? 'uložená pozice' : savedJobs.length >= 2 && savedJobs.length <= 4 ? 'uložené pozice' : 'uložených pozic'}
              </p>
            </div>
          </div>
          
          {savedJobs.length > 0 && (
            <button
              onClick={handleRemoveAllSaved}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
            >
              Odebrat všechny
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Hledat v uložených pozicích..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:text-white"
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
                Ještě nemáte uložené žádné pozice
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Klikněte na ikonu záložky u pracovní pozice, kterou chcete uložit pro pozdější.
              </p>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Tip: Uložené pozice najdete také v záložce "Profil"
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
                Nebyly nalezeny žádné výsledky
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Zkuste změnit hledaný výraz.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto custom-scrollbar p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSavedJobs.map((job) => (
                <div key={job.id} className="relative group">
                  <JobCard
                    job={job}
                    onClick={() => onJobSelect(job.id)}
                    isSelected={selectedJobId === job.id}
                    isSaved={true}
                    onToggleSave={() => onToggleSave(job.id)}
                    userProfile={userProfile}
                  />
                  
                  {/* Quick remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave(job.id);
                    }}
                    className="absolute top-2 right-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800"
                    title="Odebrat z uložených"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                  </button>
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