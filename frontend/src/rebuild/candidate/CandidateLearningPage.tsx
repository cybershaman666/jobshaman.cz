import React from 'react';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  Code2,
  GraduationCap,
  Layers3,
  Sparkles,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

import type { UserProfile } from '../../types';
import { cn } from '../cn';
import type { CandidatePreferenceProfile } from '../models';
import { CandidateShellSurface, SectionEyebrow, ShellCard } from './CandidateShellSurface';
import { primaryButtonClass, secondaryButtonClass } from '../ui/shellStyles';

const getCourseTracks = (t: any) => [
  {
    id: 'data',
    title: t('rebuild.learning.tracks.data.title'),
    source: 'Czechitas',
    level: t('rebuild.learning.tracks.data.level'),
    effort: t('rebuild.learning.tracks.data.effort'),
    href: 'https://www.czechitas.cz/podtema/datova-analyza-1',
    icon: BarChart3,
    summary: t('rebuild.learning.tracks.data.summary'),
    fit: [t('rebuild.learning.fit.analytical'), t('rebuild.learning.fit.reporting'), t('rebuild.learning.fit.ai_data')],
  },
  {
    id: 'python',
    title: t('rebuild.learning.tracks.python.title'),
    source: 'Czechitas',
    level: t('rebuild.learning.tracks.python.level'),
    effort: t('rebuild.learning.tracks.python.effort'),
    href: 'https://www.czechitas.cz/podtema/python',
    icon: Code2,
    summary: t('rebuild.learning.tracks.python.summary'),
    fit: [t('rebuild.learning.fit.automation'), t('rebuild.learning.fit.technical')],
  },
  {
    id: 'testing',
    title: t('rebuild.learning.tracks.testing.title'),
    source: 'Czechitas',
    level: t('rebuild.learning.tracks.testing.level'),
    effort: t('rebuild.learning.tracks.testing.effort'),
    href: 'https://www.czechitas.cz/podtema/testovani-1',
    icon: CheckCircle2,
    summary: t('rebuild.learning.tracks.testing.summary'),
    fit: [t('rebuild.learning.fit.qa'), t('rebuild.learning.fit.product'), t('rebuild.learning.fit.precision')],
  },
  {
    id: 'ai-data',
    title: t('rebuild.learning.tracks.ai_data.title'),
    source: 'Czechitas',
    level: t('rebuild.learning.tracks.ai_data.level'),
    effort: t('rebuild.learning.tracks.ai_data.effort'),
    href: 'https://www.czechitas.cz/kurzy/ai-v-datove-analyze',
    icon: Brain,
    summary: t('rebuild.learning.tracks.ai_data.summary'),
    fit: [t('rebuild.learning.fit.ai_workflow'), t('rebuild.learning.fit.analytical'), t('rebuild.learning.fit.reporting')],
  },
];

const getLearningSteps = (t: any) => [
  t('rebuild.learning.step1'),
  t('rebuild.learning.step2'),
  t('rebuild.learning.step3'),
];

export const CandidateLearningPage: React.FC<{
  userProfile: UserProfile;
  preferences: CandidatePreferenceProfile;
  navigate: (path: string) => void;
}> = ({ userProfile, preferences, navigate }) => {
  const { t } = useTranslation();
  const hasJcfpm = Boolean(userProfile.preferences?.jcfpm_v1?.dimension_scores?.length);
  const preferredDirection = userProfile.preferences?.desired_role || userProfile.jobTitle || preferences.story || '';
  const highlightedTrack = preferredDirection.toLowerCase().includes('data') || preferredDirection.toLowerCase().includes('anal')
    ? 'data'
    : preferredDirection.toLowerCase().includes('python') || preferredDirection.toLowerCase().includes('developer')
      ? 'python'
      : 'data';

  return (
    <CandidateShellSurface
      variant="profile"
      className="max-w-full px-2 pb-2 pt-1"
      eyebrow={<SectionEyebrow>{t('rebuild.learning.eyebrow')}</SectionEyebrow>}
      title={t('rebuild.learning.title')}
      subtitle={t('rebuild.learning.subtitle')}
      actions={(
        <>
          <button type="button" onClick={() => navigate('/candidate/jcfpm')} className={cn(secondaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>
            <Sparkles size={16} /> {t('rebuild.learning.refine_direction')}
          </button>
          <a href="https://www.czechitas.cz/kurzy" target="_blank" rel="noreferrer" className={cn(primaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>
            {t('rebuild.learning.czechitas_courses')} <ArrowUpRight size={16} />
          </a>
        </>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <ShellCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--dashboard-text-muted)]">{t('rebuild.learning.recommended_start')}</div>
              <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-[color:var(--dashboard-text-strong)]">
                {highlightedTrack === 'python' ? t('rebuild.learning.start_python') : t('rebuild.learning.start_data')}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--dashboard-text-body)]">
                {t('rebuild.learning.description')}
              </p>
            </div>
            <div className="rounded-[22px] border border-[color:var(--dashboard-soft-border)] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] p-4 text-sm text-[color:var(--dashboard-text-body)]">
              <div className="font-semibold text-[color:var(--dashboard-text-strong)]">{hasJcfpm ? t('rebuild.learning.direction_refined') : t('rebuild.learning.direction_pending')}</div>
              <div className="mt-2 max-w-[260px] leading-6">
                {hasJcfpm ? t('rebuild.learning.recommendation_jcfpm') : t('rebuild.learning.recommendation_pending')}
              </div>
            </div>
          </div>
        </ShellCard>

        <ShellCard className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#fff4df] text-[#b6721d]">
              <Layers3 size={20} />
            </div>
            <div>
              <div className="text-[1.15rem] font-semibold text-[color:var(--dashboard-text-strong)]">{t('rebuild.learning.how_to_work')}</div>
              <div className="text-sm text-[color:var(--dashboard-text-muted)]">{t('rebuild.learning.how_to_work_subtitle')}</div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {getLearningSteps(t).map((step, index) => (
              <div key={`learning-step-${index}`} className="flex gap-3 rounded-[18px] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,white)] px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#2496ab]">{index + 1}</span>
                <span className="text-sm leading-6 text-[color:var(--dashboard-text-body)]">{step}</span>
              </div>
            ))}
          </div>
        </ShellCard>

        <div className="grid gap-4 xl:col-span-2 xl:grid-cols-2">
          {getCourseTracks(t).map((track) => {
            const Icon = track.icon;
            const highlighted = track.id === highlightedTrack;
            return (
              <ShellCard key={track.id} className={cn('p-5 transition', highlighted && 'border-[#2496ab]/35 bg-[linear-gradient(180deg,rgba(232,246,247,0.78),rgba(255,255,255,0.94))]')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-[#2496ab] shadow-[0_16px_30px_-24px_rgba(22,32,48,0.34)]">
                      <Icon size={21} />
                    </div>
                    <div>
                      <div className="text-[1.2rem] font-semibold text-[color:var(--dashboard-text-strong)]">{track.title}</div>
                      <div className="mt-1 text-sm text-[color:var(--dashboard-text-muted)]">{track.source} · {track.level} · {track.effort}</div>
                    </div>
                  </div>
                  {highlighted ? <span className="rounded-full bg-[#e8f6f1] px-3 py-1 text-[11px] font-semibold text-[#2c8f72]">{t('rebuild.learning.recommended_badge')}</span> : null}
                </div>
                <p className="mt-4 text-sm leading-7 text-[color:var(--dashboard-text-body)]">{track.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {track.fit.map((item, index) => (
                    <span key={`${track.id}-fit-${item}-${index}`} className="rounded-full border border-[color:var(--dashboard-soft-border)] bg-white/70 px-3 py-1.5 text-[12px] text-[color:var(--dashboard-text-body)]">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={track.href} target="_blank" rel="noreferrer" className={cn(primaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>
                    {t('rebuild.learning.open_course')} <ArrowUpRight size={16} />
                  </a>
                  <button type="button" onClick={() => navigate('/candidate/marketplace')} className={cn(secondaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>
                    {t('rebuild.learning.find_roles')}
                  </button>
                </div>
              </ShellCard>
            );
          })}
        </div>

        <ShellCard className="xl:col-span-2 p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <GraduationCap size={20} className="text-[#2496ab]" />
                <div className="text-[1.25rem] font-semibold text-[color:var(--dashboard-text-strong)]">{t('rebuild.learning.next_version')}</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-[color:var(--dashboard-text-body)]">
                {t('rebuild.learning.next_version_copy')}
              </p>
            </div>
            <button type="button" onClick={() => navigate('/candidate/profile')} className={cn(secondaryButtonClass, 'justify-center rounded-[16px] px-4 py-3 text-sm')}>
              <BookOpen size={16} /> {t('rebuild.learning.add_to_profile')}
            </button>
          </div>
        </ShellCard>
      </div>
    </CandidateShellSurface>
  );
};
