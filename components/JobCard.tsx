
import React from 'react';
import { Job, UserProfile } from '../types';
import { MapPin, Briefcase, Banknote, Clock, Bookmark, Car, Sparkles, Euro, Home, MessageCircle } from 'lucide-react';
import { calculateCommuteReality, calculateDistanceKm, getCoordinates } from '../services/commuteService';
import { useTranslation } from 'react-i18next';
import { matchesBrigadaKeywords, matchesFullTimeKeywords, matchesIcoKeywords, matchesPartTimeKeywords } from '../utils/contractType';

const extractMarkdownSection = (description: string, headings: string[]): string => {
  if (!description.trim() || headings.length === 0) return '';
  const normalizedHeadings = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `^#{2,3}\\s*(?:${normalizedHeadings.join('|')})\\s*$\\n([\\s\\S]*?)(?=\\n#{2,3}\\s+|$)`,
    'im'
  );
  const match = description.match(pattern);
  if (!match?.[1]) return '';
  return match[1]
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const clampPreview = (value: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trim()}...`;
};

interface JobCardProps {
  job: Job;
  onClick: () => void;
  isSelected: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  variant?: 'light' | 'dark';
  userProfile?: UserProfile;
  emphasis?: 'standard' | 'hero';
}

const JobCard: React.FC<JobCardProps> = ({ job, onClick, isSelected, isSaved, onToggleSave, userProfile, emphasis = 'standard' }) => {
  const { t, i18n } = useTranslation();
  const localeBase = (i18n.language || 'en').split('-')[0];
  const isCs = localeBase === 'cs';
  const isSk = localeBase === 'sk';

  // Defensive check for JHI score
  const jhiScore = job.jhi?.score || 0;
  const aiMatchScore = null;

  const formatJobTypeLabel = (raw: string) => {
    if (!raw) return t('job.contract_types.unknown') || 'Neuvedeno';
    if (matchesIcoKeywords(raw)) return t('job.contract_types.ico');
    if (matchesFullTimeKeywords(raw)) return t('job.contract_types.hpp');
    if (matchesPartTimeKeywords(raw)) return t('job.contract_types.part_time');
    if (matchesBrigadaKeywords(raw)) return t('job.contract_types.brigada');
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
      brigada: t('job.contract_types.brigada') || 'Temporary job',
      brigáda: t('job.contract_types.brigada') || 'Temporary job',
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
    if (/(home[\s-]?office|remote|na\s+dalku|na\s+dia[ľl]ku)/i.test(raw)) return t('job.work_model.remote');
    if (/(hybrid|hybridni|hybridný)/i.test(raw)) return t('job.work_model.hybrid');
    if (/(onsite|on[\s-]?site|office|kancelar|kancelár)/i.test(raw)) return t('job.work_model.on_site');
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

  const formatRelativePostedAt = (): string => {
    const source = job.scrapedAt || job.postedAt;
    if (!source) return '';

    const parsedDate = new Date(source);
    if (Number.isNaN(parsedDate.getTime())) return job.postedAt || '';

    const diffSeconds = Math.floor((Date.now() - parsedDate.getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });

    if (diffSeconds < 60) return rtf.format(0, 'second');
    if (diffSeconds < 3600) return rtf.format(-Math.floor(diffSeconds / 60), 'minute');
    if (diffSeconds < 86400) return rtf.format(-Math.floor(diffSeconds / 3600), 'hour');
    if (diffSeconds < 604800) return rtf.format(-Math.floor(diffSeconds / 86400), 'day');
    return rtf.format(-Math.floor(diffSeconds / 604800), 'week');
  };

  const getHiringStageLabel = (stage?: Job['hiring_stage'] | null): string | null => {
    switch (stage) {
      case 'collecting_cvs':
        return t('job.hiring_stage.collecting_supporting_context', { defaultValue: 'Collecting supporting context' });
      case 'reviewing_first_10':
        return t('job.hiring_stage.reviewing_first_10', { defaultValue: 'Reviewing first 10 candidates' });
      case 'shortlisting':
        return t('job.hiring_stage.shortlisting', { defaultValue: 'Shortlisting' });
      case 'final_interviews':
        return t('job.hiring_stage.final_interviews', { defaultValue: 'Final interviews' });
      case 'offer_stage':
        return t('job.hiring_stage.offer_stage', { defaultValue: 'Offer stage' });
      default:
        return null;
    }
  };

  const hiringStageLabel = getHiringStageLabel(job.hiring_stage);
  const relativePostedAt = formatRelativePostedAt();

  const getChallengePreview = (): string | null => {
    const raw = String(job.description || '').trim();
    if (!raw) return null;
    const normalized = raw
      .replace(/[#>*_`~\[\]\(\)!-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return null;
    const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0]?.trim() || normalized;
    const preview = firstSentence.length > 140 ? `${firstSentence.slice(0, 137).trim()}...` : firstSentence;
    return preview || null;
  };

  const challengePreview = getChallengePreview();
  const parsedFirstReply = extractMarkdownSection(job.description || '', ['First Reply']);
  const parsedRoleTruthHard = extractMarkdownSection(job.description || '', ['Company Truth: What Is Actually Hard?']);
  const parsedRoleTruthFail = extractMarkdownSection(job.description || '', ['Company Truth: Who Typically Struggles?']);
  const hasStructuredHandshakeSignal = Boolean(parsedFirstReply || parsedRoleTruthHard || parsedRoleTruthFail);
  const roleTruthPreview = clampPreview(
    parsedRoleTruthHard || parsedRoleTruthFail || challengePreview || t('job.card.role_truth_body', { defaultValue: 'The team wants to see your first practical step before anything else.' }),
    emphasis === 'hero' ? 180 : 96
  );
  const roleTruthMismatchPreview = clampPreview(parsedRoleTruthFail, emphasis === 'hero' ? 150 : 88);
  const firstReplyPreview = clampPreview(
    parsedFirstReply || t('job.card.response_prompt_body', { defaultValue: 'Open the handshake and outline your first step, the trade-off, and how you would verify it.' }),
    emphasis === 'hero' ? 160 : 110
  );

  const openDialoguesCount = typeof job.open_dialogues_count === 'number' && Number.isFinite(job.open_dialogues_count)
    ? Math.max(0, Math.round(job.open_dialogues_count))
    : null;
  const dialogueCapacityLimit = typeof job.dialogue_capacity_limit === 'number' && Number.isFinite(job.dialogue_capacity_limit)
    ? Math.max(1, Math.round(job.dialogue_capacity_limit))
    : null;
  const reactionWindowHours = typeof job.reaction_window_hours === 'number' && Number.isFinite(job.reaction_window_hours)
    ? Math.max(1, Math.round(job.reaction_window_hours))
    : null;
  const reactionWindowDays = typeof job.reaction_window_days === 'number' && Number.isFinite(job.reaction_window_days)
    ? Math.max(1, Math.round(job.reaction_window_days))
    : null;

  const openDialoguesLabel = openDialoguesCount !== null && dialogueCapacityLimit !== null
    ? t('job.card.open_dialogues_with_limit', {
      open: openDialoguesCount,
      limit: dialogueCapacityLimit,
      defaultValue: isSk
        ? '{{open}} / {{limit}} otvorených dialógov'
        : isCs
          ? '{{open}} / {{limit}} dialogů otevřeno'
          : '{{open}} / {{limit}} dialogues open'
    })
    : null;

  const responseWindowValue = (() => {
    const hours = reactionWindowHours;
    const days = reactionWindowDays;
    if (days !== null) {
      if (isSk) {
        const unit = days === 1 ? 'deň' : (days <= 4 ? 'dni' : 'dní');
        return `${days} ${unit}`;
      }
      if (isCs) {
        const unit = days === 1 ? 'den' : (days <= 4 ? 'dny' : 'dnů');
        return `${days} ${unit}`;
      }
      return `${days} day${days === 1 ? '' : 's'}`;
    }
    if (hours !== null && hours % 24 === 0) {
      const wholeDays = Math.max(1, Math.round(hours / 24));
      if (isSk) {
        const unit = wholeDays === 1 ? 'deň' : (wholeDays <= 4 ? 'dni' : 'dní');
        return `${wholeDays} ${unit}`;
      }
      if (isCs) {
        const unit = wholeDays === 1 ? 'den' : (wholeDays <= 4 ? 'dny' : 'dnů');
        return `${wholeDays} ${unit}`;
      }
      return `${wholeDays} day${wholeDays === 1 ? '' : 's'}`;
    }
    if (hours !== null) {
      if (isSk) return `${hours} hodín`;
      if (isCs) return `${hours} hodin`;
      return `${hours}h`;
    }
    return null;
  })();

  const responseWindowLabel = responseWindowValue
    ? t('job.card.response_window_badge', {
      value: responseWindowValue,
      defaultValue: isSk
        ? 'Reakčné okno: {{value}}'
        : isCs
          ? 'Reakční okno: {{value}}'
          : 'Response window: {{value}}'
    })
    : null;



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
      : { ...userProfile, address: t('filters.use_current_location') as string };
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
      const badgeLabel = airDistanceKm !== null ? `${badgeDistance} km · ${t('job.distance_air_label')}` : `${badgeDistance} km`;
      distanceBadge = (
        <div
          className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 ml-2"
          title={airDistanceKm !== null ? t('job.distance_air_hint') : undefined}
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
  const containerBase = emphasis === 'hero'
    ? "bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.10),transparent_26%),linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,246,255,0.93))] dark:bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.10),transparent_26%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(12,74,110,0.22))] border-sky-200/80 dark:border-sky-900/40 hover:border-sky-300 dark:hover:border-sky-700"
    : "bg-white/88 dark:bg-slate-900/82 border-slate-200/80 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700";

  // Selected state - Active list item style
  const selectedStyle = "bg-slate-100 dark:bg-slate-800/95 border-cyan-300 dark:border-cyan-700 ring-1 ring-cyan-200 dark:ring-cyan-800/70 z-10";

  return (
    <div
      onClick={onClick}
      className={`
        h-full ${emphasis === 'hero' ? 'p-4 sm:p-[18px]' : 'p-3 sm:p-4'} rounded-[1.05rem] border cursor-pointer transition-all duration-200 relative group overflow-hidden ${emphasis === 'hero' ? 'shadow-[0_18px_34px_-28px_rgba(14,165,233,0.24)]' : 'shadow-[0_12px_26px_-28px_rgba(15,23,42,0.2)]'}
        ${isSelected ? selectedStyle : containerBase}
      `}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
          emphasis === 'hero'
            ? 'border border-orange-200/80 dark:border-orange-900/40 bg-orange-50/90 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300'
            : 'border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/90 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
        }`}>
          <Sparkles size={11} />
          {t('job.card.challenge_label', { defaultValue: 'Real challenge' })}
        </div>
        {emphasis === 'hero' && (
          <div className="rounded-full border border-sky-200/80 dark:border-sky-900/40 bg-white/80 dark:bg-slate-950/30 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            {t('job.card.priority_label', { defaultValue: 'Priority' })}
          </div>
        )}
      </div>

      {/* Job Title and Company */}
      <div className="mb-3">
        <h3 className={`font-bold text-base leading-snug break-words ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-white'}`}>{job.title}</h3>
        <p className="text-sm mt-1 font-medium text-slate-500 dark:text-slate-300 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors break-words">{job.company}</p>
        {challengePreview && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {challengePreview}
          </p>
        )}
        {emphasis === 'hero' && (
          <div className="mt-2 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
              {t('job.card.role_truth_label', { defaultValue: 'Role truth' })}
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-amber-950 dark:text-amber-100">
              {roleTruthPreview}
            </div>
            {roleTruthMismatchPreview && parsedRoleTruthFail && parsedRoleTruthFail !== parsedRoleTruthHard && (
              <div className="mt-1.5 rounded-lg border border-amber-200/70 dark:border-amber-900/30 bg-white/70 dark:bg-slate-950/20 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100">
                <span className="font-semibold">
                  {t('job.card.role_truth_mismatch', { defaultValue: 'Mismatch:' })}
                </span>{' '}
                {roleTruthMismatchPreview}
              </div>
            )}
          </div>
        )}
        {emphasis !== 'hero' && hasStructuredHandshakeSignal && (
          <div className="mt-2 hidden rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/28 px-2.5 py-2 space-y-1.5 sm:block">
            <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">
                {t('job.card.role_truth_label', { defaultValue: 'Role truth' })}:
              </span>{' '}
              {roleTruthPreview}
            </div>
            {parsedFirstReply && (
              <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {t('job.card.response_prompt', { defaultValue: 'First reply:' })}
                </span>{' '}
                {firstReplyPreview}
              </div>
            )}
          </div>
        )}
      </div>

      {(openDialoguesLabel || responseWindowLabel) && (
        <div className="mb-3 hidden flex-wrap items-center gap-1.5 sm:flex">
          {openDialoguesLabel && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/25 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
              <MessageCircle size={11} />
              <span>{openDialoguesLabel}</span>
            </div>
          )}
          {responseWindowLabel && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 dark:border-blue-800/70 bg-blue-50/80 dark:bg-blue-950/25 px-2 py-1 text-[11px] font-semibold text-blue-800 dark:text-blue-200">
              <Clock size={11} />
              <span>{responseWindowLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Badges Row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        {/* Left Side Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {relativePostedAt && (
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
              <Clock size={11} className="flex-shrink-0" />
              <span>{relativePostedAt}</span>
            </div>
          )}
          {hiringStageLabel && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-200 dark:border-cyan-800/70">
              <Briefcase size={11} className="flex-shrink-0" />
              <span>{hiringStageLabel}</span>
            </div>
          )}
          <div className="hidden sm:flex">{distanceBadge}</div>

          {hasTransparentSalary && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold 
              bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 
              border border-emerald-200/60 dark:border-emerald-700/60 
              text-emerald-700 dark:text-emerald-400 shadow-sm backdrop-blur-sm">
              <div className="bg-emerald-100 dark:bg-emerald-800 rounded-full p-0.5">
                <Euro size={10} className="stroke-[2.5px]" />
              </div>
              <span className="hidden sm:inline">{t('job.transparent_eu')}</span>
              <span className="sm:hidden">{t('job.transparent_eu_short')}</span>
            </div>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {aiMatchScore !== null && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50
                text-emerald-700 dark:text-emerald-300"
              title={`${t('job.ai_match')}: ${aiMatchScore}%`}
            >
              <Sparkles size={12} className="text-emerald-600 dark:text-emerald-300" />
              <span>{aiMatchScore}%</span>
            </div>
          )}
          {/* JHI Circular Progress */}
          <div className="flex items-center gap-1.5 sm:gap-2" title={`Job Health Index: ${jhiScore}/100`}>
            <div className="relative w-8 h-8 flex items-center justify-center">
              {/* Background Circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  className="stroke-slate-200 dark:stroke-slate-700 fill-none"
                  strokeWidth="3"
                />
                {/* Progress Circle */}
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  className={`fill-none transition-all duration-1000 ease-out
                    ${jhiScore >= 70 ? 'stroke-emerald-500' :
                      jhiScore >= 50 ? 'stroke-amber-500' : 'stroke-rose-500'}
                  `}
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 12}
                  strokeDashoffset={2 * Math.PI * 12 * (1 - jhiScore / 100)}
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
      <div className="mb-3 grid gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 sm:flex sm:flex-wrap sm:gap-y-1.5 sm:gap-x-3 sm:text-[13px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> <span className="truncate">{job.location}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <Briefcase size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> <span className="truncate">{formatJobTypeLabel(job.type)}</span>
        </div>
        {job.work_model && (
          <div className="hidden items-center gap-1.5 min-w-0 sm:flex">
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
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 min-w-0" title={t('job.ai_estimated_tooltip')}>
            <Sparkles size={16} className="fill-current flex-shrink-0" />
            <span className="truncate">{job.aiEstimatedSalary.min.toLocaleString()} - {job.aiEstimatedSalary.max.toLocaleString()} {job.aiEstimatedSalary.currency} ({t('job.salary_estimate')})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-600 italic min-w-0">
            <Banknote size={16} className="flex-shrink-0" />
            <span className="truncate">{t('job.salary_not_specified')}</span>
          </div>
        )}

      </div>

      {emphasis === 'hero' && (
        <div className="mb-3 hidden rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/82 dark:bg-slate-950/28 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300 shadow-[0_10px_20px_-24px_rgba(15,23,42,0.3)] sm:block">
          <span className="font-semibold text-slate-900 dark:text-white">
            {t('job.card.response_prompt', { defaultValue: 'First reply:' })}
          </span>{' '}
          {firstReplyPreview}
        </div>
      )}

    </div>
  );
};

export default JobCard;
