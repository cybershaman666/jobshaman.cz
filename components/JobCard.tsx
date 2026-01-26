
import React from 'react';
import { Job, UserProfile } from '../types';
import { MapPin, Briefcase, Banknote, Clock, Bookmark, Car, Sparkles, Euro } from 'lucide-react';
import { calculateCommuteReality } from '../services/commuteService';
import { useTranslation } from 'react-i18next';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  isSelected: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  variant?: 'light' | 'dark';
  userProfile?: UserProfile;
}

const JobCard: React.FC<JobCardProps> = ({ job, onClick, isSelected, isSaved, onToggleSave, userProfile }) => {
  const { t } = useTranslation();

  // Defensive check for JHI score
  const jhiScore = job.jhi?.score || 0;

  // Refined badge colors (matte instead of neon)
  let scoreBadgeClass = "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800";

  if (jhiScore < 70) {
    scoreBadgeClass = "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800";
  }
  if (jhiScore < 50) {
    scoreBadgeClass = "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800";
  }

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSave();
  };

  // Check if job has transparent salary information (salary range or both salary_from and salary_to)
  const hasTransparentSalary = !!(job.salaryRange && job.salaryRange !== "Mzda neuvedena") ||
    !!(job.salary_from && job.salary_to);

  // Calculate quick distance if user profile is available
  let distanceBadge = null;
  if (userProfile && userProfile.isLoggedIn && userProfile.address) {
    const commute = calculateCommuteReality(job, userProfile);
    if (commute && !commute.isRelocation && commute.distanceKm !== -1) {
      distanceBadge = (
        <div className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 ml-2">
          <Car size={12} /> {commute.distanceKm} km
        </div>
      );
    } else if (commute && commute.isRelocation) {
      distanceBadge = (
        <div className="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 ml-2">
          <MapPin size={12} /> {t('job.relocation')}
        </div>
      );
    }
  }

  // Base Styles - Professional Light/Dark
  const containerBase = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md";

  // Selected state - Active list item style
  const selectedStyle = "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:ring-slate-600 ring-1 ring-slate-300 dark:ring-slate-600 z-10";

  return (
    <div
      onClick={onClick}
      className={`
        p-5 rounded-lg border cursor-pointer transition-all duration-200 relative group
        ${isSelected ? selectedStyle : containerBase}
      `}
    >
      {/* Job Title and Company */}
      <div className="mb-4">
        <h3 className={`font-bold text-lg leading-tight ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-white'}`}>{job.title}</h3>
        <p className="text-sm mt-1 font-medium text-slate-500 dark:text-slate-300 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">{job.company}</p>
      </div>

      {/* Bottom Badges Row */}
      <div className="flex justify-between items-center mb-4">
        {/* Left Side Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {distanceBadge}

          {hasTransparentSalary && (
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-700 whitespace-nowrap">
              <Euro size={10} />
              <span className="hidden sm:inline">{t('job.transparent_eu')}</span>
              <span className="sm:hidden">EU</span>
            </div>
          )}


        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded text-sm font-bold font-mono whitespace-nowrap ${scoreBadgeClass}`}>
            JHI {jhiScore}
          </div>

          <button
            onClick={handleSaveClick}
            className={`p-1.5 rounded transition-all ${isSaved ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200' : 'text-slate-400 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-white'}`}
            title={isSaved ? t('job.remove_save') : t('job.save')}
          >
            <Bookmark size={18} className={isSaved ? "fill-current" : ""} />
          </button>
        </div>
      </div>

      {/* Job Metadata */}
      <div className="flex flex-wrap gap-y-2 gap-x-4 text-sm mb-4 font-medium text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <MapPin size={16} className="text-slate-400 dark:text-slate-500" /> <span className="truncate">{job.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Briefcase size={16} className="text-slate-400 dark:text-slate-500" /> <span className="truncate">{job.type}</span>
        </div>

        {/* Salary Display Logic */}
        {job.salaryRange && job.salaryRange !== "Mzda neuvedena" ? (
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
            <Banknote size={16} className="text-emerald-600 dark:text-emerald-500" />
            <span className="truncate">{job.salaryRange}</span>
          </div>
        ) : job.aiEstimatedSalary ? (
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400" title="Odhadováno AI modelem na základě tržních dat">
            <Sparkles size={16} className="fill-current" />
            <span className="truncate">{job.aiEstimatedSalary.min.toLocaleString()} - {job.aiEstimatedSalary.max.toLocaleString()} {job.aiEstimatedSalary.currency} ({t('job.salary_estimate')})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-600 italic">
            <Banknote size={16} />
            <span className="truncate">{t('job.salary_not_specified')}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Clock size={16} className="text-slate-400 dark:text-slate-500" /> <span className="truncate">{job.postedAt}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-2 flex-wrap">
        {job.tags && job.tags.map(tag => (
          <span key={tag} className="px-2.5 py-1 text-xs rounded border font-medium tracking-wide transition-colors bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 group-hover:border-slate-300 dark:group-hover:border-slate-700">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default JobCard;
