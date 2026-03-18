import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from '../services/csrfService';

interface Props {
  companyId: string;
  onClose: () => void;
  onSent?: () => void;
  initialAssessmentId?: string;
  initialCandidateEmail?: string;
  initialCandidateId?: string | null;
  initialDialogueId?: string | null;
  initialApplicationId?: string | null;
  initialJobId?: string | number | null;
  initialJobTitle?: string;
  initialAssessmentName?: string;
  initialMetadata?: Record<string, unknown> | null;
}

const AssessmentInvitationModal: React.FC<Props> = ({
  companyId,
  onClose,
  onSent,
  initialAssessmentId,
  initialCandidateEmail,
  initialCandidateId,
  initialDialogueId,
  initialApplicationId,
  initialJobId,
  initialJobTitle,
  initialAssessmentName,
  initialMetadata
}) => {
  const { t } = useTranslation();
  const resolvedDialogueId = initialDialogueId || initialApplicationId || null;
  const [assessmentOptions, setAssessmentOptions] = useState<Array<{ id: string; title: string; role?: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [assessmentId, setAssessmentId] = useState(initialAssessmentId || '');
  const [candidateEmail, setCandidateEmail] = useState(initialCandidateEmail || '');
  const [jobTitle, setJobTitle] = useState(initialJobTitle || '');
  const [assessmentName, setAssessmentName] = useState(initialAssessmentName || '');
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAssessmentId(initialAssessmentId || '');
    setCandidateEmail(initialCandidateEmail || '');
    setJobTitle(initialJobTitle || '');
    setAssessmentName(initialAssessmentName || '');
  }, [initialAssessmentId, initialCandidateEmail, initialJobTitle, initialAssessmentName]);

  useEffect(() => {
    let active = true;
    const loadAssessmentOptions = async () => {
      setLoadingOptions(true);
      try {
        const res = await authenticatedFetch(`${BACKEND_URL}/assessments/company-library`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!active || !Array.isArray(data?.assessments)) return;
        setAssessmentOptions(
          data.assessments.map((item: any) => ({
            id: String(item?.id || ''),
            title: String(item?.title || item?.role || 'Assessment'),
            role: item?.role ? String(item.role) : undefined
          })).filter((item: { id: string }) => item.id)
        );
      } catch (fetchError) {
        console.error('Failed to load assessment library:', fetchError);
      } finally {
        if (active) setLoadingOptions(false);
      }
    };
    loadAssessmentOptions();
    return () => { active = false; };
  }, [companyId]);

  const handleSend = async () => {
    setError(null);
    if (!assessmentId || !candidateEmail) {
      setError(t('assessment_invitation_modal.fill_required'));
      return;
    }

    setLoading(true);
    try {
      const res = await authenticatedFetch(`${BACKEND_URL}/assessments/invitations/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: assessmentId,
          candidate_email: candidateEmail,
          candidate_id: initialCandidateId || null,
          application_id: resolvedDialogueId,
          job_id: initialJobId != null ? Number(initialJobId) : null,
          company_id: companyId,
          expires_in_days: expiresInDays,
          metadata: {
            ...(initialMetadata || {}),
            assessment_name: assessmentName,
            job_title: jobTitle
          }
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t('assessment_invitation_modal.api_error', { status: res.status }));
      }

      onSent && onSent();
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('assessment_invitation_modal.send_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="app-modal-panel max-w-xl">
        <div className="app-modal-topline" />

        <div className="app-modal-surface p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-[var(--text-strong)] tracking-tight">
              {t('assessment_invitation_modal.title')}
            </h3>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors text-sm font-medium"
            >
              {t('app.close')}
            </button>
          </div>

          <div className="space-y-5">
            {assessmentOptions.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)]">
                  {t('assessment_invitation_modal.saved_assessments', { defaultValue: 'Saved assessments' })}
                </label>
                <select
                  className="input app-modal-input w-full"
                  value={assessmentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAssessmentId(nextId);
                    const picked = assessmentOptions.find((item) => item.id === nextId);
                    if (picked && !assessmentName) {
                      setAssessmentName(picked.title);
                    }
                  }}
                >
                  <option value="">{loadingOptions ? t('common.loading', { defaultValue: 'Loading...' }) : t('assessment_invitation_modal.select_saved', { defaultValue: 'Select a saved assessment' })}</option>
                  {assessmentOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}{item.role ? ` • ${item.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)]">
                {t('assessment_invitation_modal.assessment_id')}
              </label>
              <input
                className="input app-modal-input w-full"
                value={assessmentId}
                onChange={e => setAssessmentId(e.target.value)}
                placeholder={t('assessment_invitation_modal.assessment_id_placeholder')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)]">
                {t('assessment_invitation_modal.candidate_email')}
              </label>
              <input
                className="input app-modal-input w-full"
                value={candidateEmail}
                onChange={e => setCandidateEmail(e.target.value)}
                placeholder="kandidat@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)]">
                {t('assessment_invitation_modal.job_title_optional')}
              </label>
              <input
                className="input app-modal-input w-full"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="Senior Backend Developer"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)]">
                {t('assessment_invitation_modal.assessment_name_optional')}
              </label>
              <input
                className="input app-modal-input w-full"
                value={assessmentName}
                onChange={e => setAssessmentName(e.target.value)}
                placeholder="Technical Screening"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)]">
                {t('assessment_invitation_modal.expires_days')}
              </label>
              <input
                type="number"
                className="input app-modal-input w-full"
                value={expiresInDays}
                onChange={e => setExpiresInDays(parseInt(e.target.value || '30'))}
                min={1}
              />
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 p-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <button
                onClick={onClose}
                className="app-button-secondary !px-6"
              >
                {t('app.cancel')}
              </button>
              <button
                onClick={handleSend}
                disabled={loading}
                className="app-button-primary !px-6"
              >
                {loading ? t('assessment_invitation_modal.sending') : t('assessment_invitation_modal.send_button')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentInvitationModal;
