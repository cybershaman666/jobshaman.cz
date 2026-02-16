
import React from 'react';
import { Job, UserProfile } from '../types';
import { MapPin, Briefcase, Banknote, Clock, Bookmark, Car, Sparkles, Euro, Home } from 'lucide-react';
import { calculateCommuteReality, calculateDistanceKm, getCoordinates } from '../services/commuteService';
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

  const formatJobTypeLabel = (raw: string) => {
    if (!raw) return t('job.contract_types.unknown') || 'Neuvedeno';
    const normalized = raw.trim().toLowerCase();
    const key = normalized
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/[^\wáčďéěíňóřšťúůýž]+/g, '');

    const labelMap: Record<string, string> = {
      full_time: t('job.contract_types.full_time') || 'Full-time',
      part_time: t('job.contract_types.part_time') || 'Part-time',
      contract: t('job.contract_types.contract') || 'Contract',
      temporary: t('job.contract_types.temporary') || 'Temporary',
      internship: t('job.contract_types.internship') || 'Internship',
      freelance: t('job.contract_types.freelance') || 'Freelance',
      freelance_service: t('job.contract_types.freelance_service') || 'Freelance Service',
      hpp: t('job.contract_types.hpp') || 'HPP',
      dpp: t('job.contract_types.dpp') || 'DPP',
      dpc: t('job.contract_types.dpc') || 'DPČ',
      dpč: t('job.contract_types.dpc') || 'DPČ',
      ico: t('job.contract_types.ico') || 'IČO',
      ičo: t('job.contract_types.ico') || 'IČO',
      osvc: t('job.contract_types.osvc') || 'OSVČ',
      osvč: t('job.contract_types.osvc') || 'OSVČ',
      b2b: t('job.contract_types.b2b') || 'B2B',
      remote: t('job.contract_types.remote') || 'Remote',
      hybrid: t('job.contract_types.hybrid') || 'Hybrid',
      on_site: t('job.contract_types.on_site') || 'On-site',
      onsite: t('job.contract_types.on_site') || 'On-site'
    };

    return labelMap[key] || raw;
  };

  const formatWorkModelLabel = (raw: string) => {
    if (!raw) return t('job.work_model.unknown') || t('job.contract_types.unknown') || 'Neuvedeno';
    const normalized = raw.trim().toLowerCase();
    const key = normalized
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/[^\wáčďéěíňóřšťúůýž]+/g, '');

    const labelMap: Record<string, string> = {
      remote: t('job.work_model.remote') || 'Remote',
      hybrid: t('job.work_model.hybrid') || 'Hybrid',
      on_site: t('job.work_model.on_site') || 'On-site',
      onsite: t('job.work_model.on_site') || 'On-site'
    };

    return labelMap[key] || raw;
  };



  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSave();
  };

  // Check if job has transparent salary information (salary range or both salary_from and salary_to)
  const hasTransparentSalary = !!(job.salaryRange && job.salaryRange !== "Mzda neuvedena" && job.salaryRange !== "Salary not specified") ||
    !!(job.salary_from && job.salary_to);

  // Calculate quick distance if user profile is available
  let distanceBadge = null;
  if (userProfile && (userProfile.address || userProfile.coordinates)) {
    const commuteProfile = userProfile.address
      ? userProfile
      : { ...userProfile, address: t('financial.current_location_label', { defaultValue: 'Aktuální poloha' }) as string };
    const commute = calculateCommuteReality(job, commuteProfile);
    const userCoords = commuteProfile.coordinates || getCoordinates(commuteProfile.address);
    let airDistanceKm: number | null = null;
    if (userCoords) {
      const jobCoords = (job.lat !== undefined && job.lng !== undefined && job.lat !== null && job.lng !== null)
        ? { lat: job.lat, lon: job.lng }
        : getCoordinates(job.location);
      if (jobCoords) {
        const rawAir = calculateDistanceKm(userCoords.lat, userCoords.lon, jobCoords.lat, jobCoords.lon);
        airDistanceKm = Math.floor(rawAir * 10) / 10; // truncate to 0.1 km to avoid rounding above filter
      }
    }

    if (commute && !commute.isRelocation && commute.distanceKm !== -1) {
      const badgeDistance = airDistanceKm ?? commute.distanceKm;
      const badgeLabel = airDistanceKm !== null ? `${badgeDistance} km · ${t('job.distance_air_label') || 'vzdušně'}` : `${badgeDistance} km`;
      distanceBadge = (
        <div
          className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 ml-2"
          title={airDistanceKm !== null ? (t('job.distance_air_hint') || 'Filtr vzdálenosti používá vzdušnou čarou. Reálný dojezd může být vyšší.') : undefined}
        >
          <Car size={12} /> {badgeLabel}
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
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold 
              bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 
              border border-emerald-200/60 dark:border-emerald-700/60 
              text-emerald-700 dark:text-emerald-400 shadow-sm backdrop-blur-sm">
              <div className="bg-emerald-100 dark:bg-emerald-800 rounded-full p-0.5">
                <Euro size={10} className="stroke-[2.5px]" />
              </div>
              <span className="hidden sm:inline">{t('job.transparent_eu')}</span>
              <span className="sm:hidden">EU Trans.</span>
            </div>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* JHI Circular Progress */}
          <div className="flex items-center gap-2" title={`Job Health Index: ${jhiScore}/100`}>
            <div className="relative w-9 h-9 flex items-center justify-center">
              {/* Background Circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  className="stroke-slate-200 dark:stroke-slate-700 fill-none"
                  strokeWidth="3"
                />
                {/* Progress Circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  className={`fill-none transition-all duration-1000 ease-out
                    ${jhiScore >= 70 ? 'stroke-emerald-500' :
                      jhiScore >= 50 ? 'stroke-amber-500' : 'stroke-rose-500'}
                  `}
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 14}
                  strokeDashoffset={2 * Math.PI * 14 * (1 - jhiScore / 100)}
                  strokeLinecap="round"
                />
              </svg>
              {/* Score Number */}
              <span className={`absolute text-[10px] font-bold font-mono tracking-tighter
                ${jhiScore >= 70 ? 'text-emerald-700 dark:text-emerald-400' :
                  jhiScore >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}
              `}>
                {jhiScore}
              </span>
            </div>
          </div>

          <button
            onClick={handleSaveClick}
            className={`p-2 rounded-full transition-all ${isSaved
              ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200 dark:ring-cyan-700'
              : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200'}`}
            title={isSaved ? t('job.remove_save') : t('job.save')}
          >
            <Bookmark size={18} className={isSaved ? "fill-current" : ""} />
          </button>
        </div>
      </div>

      {/* Job Metadata */}
      <div className="flex flex-wrap gap-y-2 gap-x-4 text-sm mb-4 font-medium text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> <span className="truncate">{job.location}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <Briefcase size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> <span className="truncate">{formatJobTypeLabel(job.type)}</span>
        </div>
        {job.work_model && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Home size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <span className="truncate">{formatWorkModelLabel(job.work_model)}</span>
          </div>
        )}

        {/* Salary Display Logic */}
        {job.salaryRange && job.salaryRange !== "Mzda neuvedena" && job.salaryRange !== "Salary not specified" ? (
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 min-w-0">
            <Banknote size={16} className="text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
            <span className="truncate">{job.salaryRange}</span>
          </div>
        ) : job.aiEstimatedSalary ? (
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 min-w-0" title="Odhadováno AI modelem na základě tržních dat">
            <Sparkles size={16} className="fill-current flex-shrink-0" />
            <span className="truncate">{job.aiEstimatedSalary.min.toLocaleString()} - {job.aiEstimatedSalary.max.toLocaleString()} {job.aiEstimatedSalary.currency} ({t('job.salary_estimate')})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-600 italic min-w-0">
            <Banknote size={16} className="flex-shrink-0" />
            <span className="truncate">{t('job.salary_not_specified')}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 min-w-0">
          <Clock size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> <span className="truncate">{job.postedAt}</span>
        </div>
      </div>


    </div>
  );
};

export default JobCard;
