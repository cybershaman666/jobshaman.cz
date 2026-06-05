import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../cn';
import type { CandidateJourneySession, CandidatePreferenceProfile } from '../../../models';
import type { Role } from '../../../models';
import type { CVDocument, UserProfile } from '../../../../types';

export interface CandidatePacketPanelProps {
  role: Role;
  preferences: CandidatePreferenceProfile;
  userProfile: UserProfile;
  activeCvDocument: CVDocument | null;
  session: CandidateJourneySession;
  candidateScore: number;
  className?: string;
}

/**
 * Side panel showing candidate's CV, skills, tax & commute reality
 * Provides context for both candidate and recruiter reviewing
 */
export const CandidatePacketPanel: React.FC<CandidatePacketPanelProps> = ({
  role,
  preferences,
  userProfile,
  activeCvDocument,
  session,
  candidateScore,
  className,
}) => {
  const { t, i18n } = useTranslation();

  const packetSkills = (activeCvDocument?.parsedData?.skills || userProfile.skills || role.skills || []).slice(0, 4);
  const packetSummary = activeCvDocument?.parsedData?.cvAiText || 
    activeCvDocument?.parsedData?.cvText || 
    userProfile.cvAiText || 
    userProfile.cvText || 
    '';
  
  const candidateJobTitle = activeCvDocument?.parsedData?.jobTitle || userProfile.jobTitle || role.title;
  const activeCvName = activeCvDocument?.originalName || 
    (userProfile.cvUrl ? userProfile.cvUrl.split('/').pop() : undefined) ||
    t('rebuild.journey.active_cv', { defaultValue: 'Active CV' });

  // Real values calculation - match existing logic
  const takeHomeMonthly = Math.round((preferences as any).salaryMin ? (preferences as any).salaryMin * 0.65 : 25000); // simplified
  const realMonthlyValue = (role as any).salaryMin || 0;

  const formatCurrency = (value: number) => 
    value.toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-GB');

  return (
    <aside className={cn('space-y-4', className)}>
      {/* Candidate's CV Summary Card */}
      <div className="overflow-hidden rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {t('rebuild.journey.candidate_packet', { defaultValue: 'Your Profile' })}
        </div>
        
        <div className="mt-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
            {candidateJobTitle}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {activeCvName}
          </p>
        </div>

        {packetSummary && (
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400 line-clamp-3">
            {packetSummary.slice(0, 220)}
          </p>
        )}

        {packetSkills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {packetSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex rounded-full bg-[#dbeafe] dark:bg-slate-800 px-3 py-1 text-xs font-medium text-[#1f5fbf] dark:text-[#7ce8ff]"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Candidate Score */}
        <div className="mt-4 rounded-lg bg-gradient-to-r from-[#dbeafe] to-[#eff6ff] dark:from-slate-850 dark:to-slate-900 p-3">
          <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wide">
            {t('rebuild.journey.assessment_score', { defaultValue: 'Assessment Score' })}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#1f5fbf] dark:text-[#7ce8ff]">
            {candidateScore}
            <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">/100</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-800">
            <div
              className="h-full bg-[#1f5fbf] dark:bg-[#7ce8ff] transition-all duration-500"
              style={{ width: `${candidateScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tax Reality */}
      <div className="overflow-hidden rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {t('rebuild.journey.tax_reality', { defaultValue: 'Tax Reality' })}
        </div>
        
        <div className="mt-3 space-y-2">
          <div className="text-sm">
            <span className="text-slate-600 dark:text-slate-400">{preferences.taxProfile.countryCode}</span>
            {' · '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{preferences.taxProfile.taxYear}</span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {preferences.taxProfile.employmentType} · {preferences.taxProfile.childrenCount} {t('rebuild.journey.children_unit', { defaultValue: 'children' })}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t('rebuild.journey.take_home', { defaultValue: 'Take Home' })}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(takeHomeMonthly)} {role.currency}
            </span>
          </div>
          {realMonthlyValue > 0 && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">{t('rebuild.journey.real_monthly', { defaultValue: 'Real Monthly' })}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(realMonthlyValue)} {role.currency}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Commute Reality */}
      <div className="overflow-hidden rounded-[12px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {t('rebuild.journey.commute_reality', { defaultValue: 'Commute Reality' })}
        </div>
        
        <div className="mt-3 space-y-2">
          <div className="text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{preferences.transportMode}</span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {preferences.commuteToleranceMinutes} {t('rebuild.journey.min_tolerance', { defaultValue: 'min tolerance' })} · {preferences.searchRadiusKm} {t('rebuild.journey.radius_unit', { defaultValue: 'km radius' })}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t('rebuild.journey.one_way_commute', { defaultValue: 'One Way' })}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {preferences.commuteToleranceMinutes} min
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
