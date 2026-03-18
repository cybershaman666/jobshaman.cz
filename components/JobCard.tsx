
import React from 'react';
import { Job, UserProfile } from '../types';
import { MapPin, Briefcase, Banknote, Bookmark, Sparkles, Car, Clock } from 'lucide-react';
import { calculateCommuteReality, calculateDistanceKm, getCoordinates } from '../services/commuteService';
import { useTranslation } from 'react-i18next';
import { matchesBrigadaKeywords, matchesFullTimeKeywords, matchesIcoKeywords, matchesPartTimeKeywords } from '../utils/contractType';
import { trackAnalyticsEvent } from '../services/supabaseService';

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

const firstSentence = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  const sentence = (parts[0] || '').trim();
  return sentence || trimmed;
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
  displayMode?: 'standard' | 'progressive_teaser';
}

const JobCard: React.FC<JobCardProps> = ({
  job,
  onClick,
  isSelected,
  isSaved,
  onToggleSave,
  userProfile,
  emphasis = 'standard',
  displayMode = 'standard'
}) => {
  const { t, i18n } = useTranslation();
  const localeBase = (i18n.language || 'en').split('-')[0];
  const isCs = localeBase === 'cs';
  const isSk = localeBase === 'sk';

  // Defensive check for JHI score
  const jhiScore = job.jhi?.score || 0;

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

  const relativePostedAt = formatRelativePostedAt();
  const postedAtLabel = relativePostedAt
    ? `${isCs ? 'Před' : isSk ? 'Pred' : ''} ${relativePostedAt}`.trim()
    : '';

  const getChallengePreview = (): string | null => {
    const raw = String(job.description || '').trim();
    if (!raw) return null;
    const normalized = raw
      .replace(/[#>*_`~\[\]\(\)!-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return null;
    const firstSent = normalized.split(/(?<=[.!?])\s+/)[0]?.trim() || normalized;
    const preview = firstSent.length > 140 ? `${firstSent.slice(0, 137).trim()}...` : firstSent;
    return preview || null;
  };

  const challengePreview = getChallengePreview();
  const parsedFirstReply = extractMarkdownSection(job.description || '', ['First Reply', 'První odpověď']);
  const parsedRoleTruthHard = extractMarkdownSection(job.description || '', ['Reality Check', 'Role Truth', 'Pravda o roli']);
  const parsedRoleTruthFail = extractMarkdownSection(job.description || '', ['The Catch', 'Rizika', 'Kdo neuspěje']);

  const hasStructuredHandshakeSignal = Boolean(parsedFirstReply || parsedRoleTruthHard || parsedRoleTruthFail);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSave();
  };

  // Commute Layer
  let distanceBadge: React.ReactNode = null;
  const commute = userProfile ? calculateCommuteReality(job, userProfile) : null;

  if (commute) {
    const userCoords = userProfile?.coordinates || null;
    if (userCoords) {
      const jobCoords = job.lat && job.lng ? { lat: job.lat, lon: job.lng } : getCoordinates(job.location);
      if (jobCoords) {
        const rawAir = calculateDistanceKm(userCoords.lat, userCoords.lon, jobCoords.lat, jobCoords.lon);
        const airDistanceKm = Math.floor(rawAir * 10) / 10;
        const badgeLabel = `${airDistanceKm} km`;
        distanceBadge = (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-solarpunk-sky/10 text-solarpunk-sky border border-solarpunk-sky/20 text-[11px] font-semibold">
            <Car size={13} />
            <span>{badgeLabel}</span>
          </div>
        );
      }
    } else if (commute.isRelocation) {
      distanceBadge = (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-semibold">
          <MapPin size={13} />
          <span>{t('job.relocation')}</span>
        </div>
      );
    }
  }

  // Progressive Teaser Logic
  if (displayMode === 'progressive_teaser' && hasStructuredHandshakeSignal) {
    const problemSentence = clampPreview(
      firstSentence(parsedRoleTruthHard) || firstSentence(parsedRoleTruthFail) || firstSentence(challengePreview || t('job.card.role_truth_body')),
      140
    );

    const handleTeaserClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void trackAnalyticsEvent({
        event_type: 'feed_progressive_cta_click',
        feature: 'progressive_reveal_v1',
        metadata: { job_id: job.id, source: 'teaser' }
      });
      onClick();
    };

    return (
      <div
        onClick={onClick}
        className={`app-organic-surface h-full p-5 border cursor-pointer transition-all duration-200 relative group ${isSelected ? "bg-[rgba(var(--accent-rgb),0.04)] border-[rgba(var(--accent-rgb),0.35)] ring-1 ring-[rgba(var(--accent-rgb),0.20)]" : "bg-white dark:bg-[var(--surface)] border-[var(--border)] hover:border-[rgba(var(--accent-rgb),0.30)] hover:shadow-[var(--shadow-card)]"
          }`}
      >
        <div aria-hidden className="app-blob-orbit pointer-events-none absolute -right-8 top-8 h-20 w-20 rounded-[58%_42%_62%_38%/_40%_58%_42%_60%] bg-[rgba(var(--accent-rgb),0.10)] blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -left-6 bottom-8 h-16 w-24 rounded-[46%_54%_38%_62%/_52%_38%_62%_48%] bg-[rgba(var(--accent-sky-rgb),0.09)] blur-xl" />

        <div className="app-organic-content flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text-strong)] group-hover:text-[var(--accent)] transition-colors">{job.company}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--text-muted)] truncate flex items-center gap-1.5">
              <MapPin size={11} className="text-[var(--accent)] shrink-0" />
              {job.location} · {job.work_model ? formatWorkModelLabel(job.work_model) : formatJobTypeLabel(job.type)}
            </div>
            {postedAtLabel && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[rgba(var(--accent-rgb),0.08)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                <Clock size={11} className="text-[var(--accent)]" />
                <span>{postedAtLabel}</span>
              </div>
            )}
          </div>
          <Bookmark
            size={17}
            className={`${isSaved ? "fill-[var(--accent)] text-[var(--accent)]" : "text-[var(--text-faint)] hover:text-[var(--accent)]"} cursor-pointer hover:scale-110 transition-all`}
            onClick={handleSaveClick}
          />
        </div>
        <div className="app-organic-content text-[14px] leading-relaxed text-[var(--text-strong)] italic mb-4 line-clamp-2">
          „{problemSentence}“
        </div>
        <button
          onClick={handleTeaserClick}
          className="app-organic-content app-organic-pill text-[12px] font-bold text-[var(--accent)] flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(var(--accent-rgb),0.08)] hover:bg-[rgba(var(--accent-rgb),0.16)] transition-colors"
        >
          {isCs ? 'Jak bys začal(a)?' : isSk ? 'Ako by si začal(a)?' : 'How would you start?'}
          <Sparkles size={14} />
        </button>
      </div>
    );
  }

  // Base Styles – Clean white card
  const containerBase = emphasis === 'hero'
    ? "bg-white dark:bg-[var(--surface)] border-[rgba(var(--accent-rgb),0.20)] shadow-[var(--shadow-card)]"
    : "bg-white dark:bg-[var(--surface)] border-[var(--border)] hover:border-[rgba(var(--accent-rgb),0.28)] shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)]";

  const selectedStyle = "bg-[rgba(var(--accent-rgb),0.04)] border-[rgba(var(--accent-rgb),0.32)] ring-1 ring-[rgba(var(--accent-rgb),0.18)] z-10";

  return (
    <div
      onClick={onClick}
      className={`app-organic-surface h-full ${emphasis === 'hero' ? 'p-7' : 'p-5'} border cursor-pointer transition-all duration-200 relative group ${isSelected ? selectedStyle : containerBase
        }`}
    >
      <div aria-hidden className="app-blob-orbit pointer-events-none absolute -right-10 top-8 h-24 w-24 rounded-[60%_40%_66%_34%/_44%_54%_46%_56%] bg-[rgba(var(--accent-rgb),0.10)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute left-[-1.5rem] top-1/2 h-20 w-14 -translate-y-1/2 rounded-[48%_52%_30%_70%/_34%_60%_40%_66%] bg-[rgba(var(--accent-sky-rgb),0.10)] blur-xl" />

      <div className="app-organic-content mb-3 flex items-center justify-between">
        <div className="badge-base app-organic-pill inline-flex">
          <Sparkles size={11} />
          {t('job.card.challenge_label')}
        </div>

        <div className="flex items-center gap-3">
          {jhiScore > 0 && (
            <div className="flex items-center gap-1.5" title={`Job Health Index: ${jhiScore}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">{jhiScore}</span>
            </div>
          )}
          <Bookmark
            size={17}
            className={`${isSaved ? "fill-[var(--accent)] text-[var(--accent)]" : "text-[var(--text-faint)] hover:text-[var(--accent)]"} cursor-pointer hover:scale-110 transition-all`}
            onClick={handleSaveClick}
          />
        </div>
      </div>

      <div className="app-organic-content mb-6">
        <h3 className="font-bold text-xl leading-snug text-[var(--text-strong)] group-hover:text-solarpunk-green transition-colors mb-2">{job.title}</h3>
        <p className="text-base font-medium text-solarpunk-green/80">{job.company}</p>

        {challengePreview && (
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-muted)] italic line-clamp-3">
            „{challengePreview}“
          </p>
        )}
      </div>

      <div className="app-organic-content mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] font-medium">
            <MapPin size={13} className="text-[var(--accent)] shrink-0" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] font-medium">
            <Briefcase size={13} className="text-[var(--accent-sky)] shrink-0" />
            <span>{formatJobTypeLabel(job.type)}</span>
          </div>
          {distanceBadge}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px]">
            <Banknote size={16} className="text-[var(--accent)] shrink-0" />
            {job.salaryRange && job.salaryRange !== "Mzda neuvedena" && job.salaryRange !== "Salary not specified" ? (
              <span className="font-bold text-[var(--text-strong)]">{job.salaryRange}</span>
            ) : (
              <span className="text-[var(--text-faint)] italic text-[12px]">{t('job.salary_not_specified')}</span>
            )}
          </div>
          <div className="text-[11px] font-medium text-[var(--text-faint)] flex items-center gap-1">
            <Clock size={11} />
            {postedAtLabel || relativePostedAt}
          </div>
        </div>
      </div>

      <div className="app-organic-content mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="app-organic-cta w-full py-3 px-5 bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-green)] hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center justify-center gap-2 shadow-[0_10px_26px_rgba(var(--accent-rgb),0.26)]"
        >
          {isCs ? 'Podat ruku týmu' : isSk ? 'Podať ruku tímu' : 'Handshake the team'}
          <Sparkles size={15} />
        </button>
      </div>
    </div>
  );
};

export default JobCard;
