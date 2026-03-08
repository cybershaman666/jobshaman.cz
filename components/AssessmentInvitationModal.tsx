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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t('assessment_invitation_modal.title')}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">{t('app.close')}</button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {assessmentOptions.length > 0 && (
            <>
              <label className="text-sm text-slate-500">{t('assessment_invitation_modal.saved_assessments', { defaultValue: 'Saved assessments' })}</label>
              <select
                className="input dark:[color-scheme:dark]"
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
            </>
          )}

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.assessment_id')}</label>
          <input className="input dark:[color-scheme:dark]" value={assessmentId} onChange={e => setAssessmentId(e.target.value)} placeholder={t('assessment_invitation_modal.assessment_id_placeholder')} />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.candidate_email')}</label>
          <input className="input dark:[color-scheme:dark]" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} placeholder="kandidat@example.com" />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.job_title_optional')}</label>
          <input className="input dark:[color-scheme:dark]" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Senior Backend Developer" />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.assessment_name_optional')}</label>
          <input className="input dark:[color-scheme:dark]" value={assessmentName} onChange={e => setAssessmentName(e.target.value)} placeholder="Technical Screening" />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.expires_days')}</label>
          <input type="number" className="input dark:[color-scheme:dark]" value={expiresInDays} onChange={e => setExpiresInDays(parseInt(e.target.value || '30'))} min={1} />

          {error && <div className="text-sm text-rose-600">{error}</div>}

          <div className="flex gap-2 justify-end mt-2">
            <button onClick={onClose} className="app-button-secondary !rounded-md !px-4 !py-2">{t('app.cancel')}</button>
            <button onClick={handleSend} disabled={loading} className="app-button-primary !rounded-md !px-4 !py-2">{loading ? t('assessment_invitation_modal.sending') : t('assessment_invitation_modal.send_button')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentInvitationModal;
