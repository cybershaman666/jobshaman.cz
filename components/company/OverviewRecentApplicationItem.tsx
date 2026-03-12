import React from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyApplicationRow } from '../../types';

const getAvatarInitials = (value: string): string => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'JS';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

interface OverviewRecentApplicationItemProps {
  application?: CompanyApplicationRow;
  dialogue?: CompanyApplicationRow;
  onOpenApplication?: (applicationId: string) => void;
  onOpenDialogue?: (dialogueId: string) => void;
}

const OverviewRecentApplicationItem: React.FC<OverviewRecentApplicationItemProps> = ({
  application,
  dialogue: dialogueProp,
  onOpenApplication,
  onOpenDialogue
}) => {
  const { t } = useTranslation();
  const dialogue = dialogueProp || application;
  const handleOpenDialogue = onOpenDialogue || onOpenApplication;
  if (!dialogue) return null;

  return (
    <div className="company-surface-subtle rounded-[var(--radius-md)] border p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          {dialogue.candidateAvatarUrl || dialogue.candidate_avatar_url ? (
            <img
              src={dialogue.candidateAvatarUrl || dialogue.candidate_avatar_url}
              alt={dialogue.candidate_name || 'Candidate'}
              className="h-11 w-11 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-sm font-semibold text-[var(--text-muted)]">
              {getAvatarInitials(dialogue.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }))}
            </div>
          )}
          <div className="space-y-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--text-strong)]">
              {dialogue.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' })}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {dialogue.job_title || t('company.dashboard.table.position')}
            </div>
            {dialogue.candidateHeadline ? (
              <div className="text-xs text-[var(--text-muted)]">
                {dialogue.candidateHeadline}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dialogue.hasCv && <span className="company-pill-surface rounded-full border px-2 py-1 text-[11px] font-medium">CV</span>}
          {dialogue.hasCoverLetter && (
            <span className="company-pill-surface rounded-full border px-2 py-1 text-[11px] font-medium">
              {t('company.workspace.labels.cover_letter', { defaultValue: 'Cover letter' })}
            </span>
          )}
          {dialogue.hasJcfpm && (
            <span className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--accent)]">
              JCFPM
            </span>
          )}
          <button
            onClick={() => handleOpenDialogue?.(dialogue.id)}
            className="app-button-secondary rounded-full px-3 py-1.5 text-xs"
          >
            {t('company.workspace.actions.open_dossier', { defaultValue: 'Open dialogue' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewRecentApplicationItem;
