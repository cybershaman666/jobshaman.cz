import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from '../services/csrfService';

interface Props {
  companyId: string;
  onClose: () => void;
  onSent?: () => void;
}

const AssessmentInvitationModal: React.FC<Props> = ({ companyId, onClose, onSent }) => {
  const { t } = useTranslation();
  const [assessmentId, setAssessmentId] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [assessmentName, setAssessmentName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          candidate_id: null,
          company_id: companyId,
          expires_in_days: expiresInDays,
          metadata: { assessment_name: assessmentName, job_title: jobTitle }
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
          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.assessment_id')}</label>
          <input className="input" value={assessmentId} onChange={e => setAssessmentId(e.target.value)} placeholder={t('assessment_invitation_modal.assessment_id_placeholder')} />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.candidate_email')}</label>
          <input className="input" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} placeholder="kandidat@example.com" />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.job_title_optional')}</label>
          <input className="input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Senior Backend Developer" />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.assessment_name_optional')}</label>
          <input className="input" value={assessmentName} onChange={e => setAssessmentName(e.target.value)} placeholder="Technical Screening" />

          <label className="text-sm text-slate-500">{t('assessment_invitation_modal.expires_days')}</label>
          <input type="number" className="input" value={expiresInDays} onChange={e => setExpiresInDays(parseInt(e.target.value || '30'))} min={1} />

          {error && <div className="text-sm text-rose-600">{error}</div>}

          <div className="flex gap-2 justify-end mt-2">
            <button onClick={onClose} className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800">{t('app.cancel')}</button>
            <button onClick={handleSend} disabled={loading} className="px-4 py-2 rounded bg-cyan-600 text-white">{loading ? t('assessment_invitation_modal.sending') : t('assessment_invitation_modal.send_button')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentInvitationModal;
