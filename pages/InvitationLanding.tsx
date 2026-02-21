import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateAssessment } from '../services/geminiService';
import { BACKEND_URL } from '../constants';

interface InvitationDetail {
  invitation_id: string;
  assessment_id: string;
  company_id: string;
  company_name: string;
  candidate_email: string;
  status: string;
  expires_at: string;
  metadata: any;
}

const InvitationLanding: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [assessment, setAssessment] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const path = window.location.pathname; // /assessment/{invitation_id}
    const match = path.match(/^\/assessment\/(.+)$/);
    const invitationId = match ? match[1] : null;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || undefined;

    if (!invitationId || !token) {
      setError(t('invitation_landing.invalid_link'));
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/assessments/invitations/${invitationId}?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || t('invitation_landing.api_error', { status: res.status }));
        }
        const data = await res.json();
        setInvitation({
          invitation_id: data.invitation_id || invitationId,
          assessment_id: data.assessment_id,
          company_id: data.company_id,
          company_name: data.company_name,
          candidate_email: data.candidate_email,
          status: data.status,
          expires_at: data.expires_at,
          metadata: data.metadata,
        });
      } catch (e: any) {
        console.error(e);
        setError(e.message || t('invitation_landing.verify_failed'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleStart = async () => {
    if (!invitation) return;
    setError(null);
    setStartedAt(Date.now());

    // Use metadata to generate assessment; fallback to simple defaults
    const role = invitation.metadata?.role || invitation.metadata?.job_title || t('invitation_landing.default_role');
    const skills: string[] = invitation.metadata?.skills || (invitation.metadata?.skill_list || '').split(',').map((s: string) => s.trim()).filter(Boolean) || [t('invitation_landing.default_skill') as string];
    const difficulty = invitation.metadata?.difficulty || 'Senior';
    try {
      const gen = await generateAssessment(role, skills, difficulty);
      setAssessment(gen);
    } catch (e: any) {
      console.error(e);
      setError(t('invitation_landing.generate_failed'));
    }
  };

  const handleAnswerChange = (idx: number, value: string) => {
    setAnswers(prev => ({ ...prev, [idx]: value }));
  };

  const handleSubmit = async () => {
    if (!invitation || !assessment) return;
    setSubmitting(true);
    setError(null);
    try {
      const now = Date.now();
      const timeSpent = startedAt ? Math.floor((now - startedAt) / 1000) : 0;

      // Naive scoring: mark all as answered -> correctCount = answers provided
      const questionsTotal = assessment.questions?.length || 0;
      const questionsCorrect = Object.keys(answers).length; // placeholder
      const score = questionsTotal ? Math.round((questionsCorrect / questionsTotal) * 100) : 0;

      const payload = {
        invitation_id: invitation.invitation_id,
        assessment_id: invitation.assessment_id,
        role: assessment.role || 'Candidate',
        difficulty: assessment.difficulty || 'Senior',
        questions_total: questionsTotal,
        questions_correct: questionsCorrect,
        score,
        time_spent_seconds: timeSpent,
        answers,
        feedback: ''
      };

      // Read token from URL again
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';

      const res = await fetch(`${BACKEND_URL}/assessments/invitations/${invitation.invitation_id}/submit?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t('invitation_landing.api_error', { status: res.status }));
      }

      await res.json();
      // Success page
      setAssessment(null);
      setInvitation({ ...invitation, status: 'completed' });
      alert(t('invitation_landing.submit_success_alert'));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('invitation_landing.submit_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">{t('invitation_landing.loading')}</div>;
  if (error) return <div className="p-6 text-rose-600">{error}</div>;
  if (!invitation) return <div className="p-6">{t('invitation_landing.not_found')}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border">
        <h2 className="text-xl font-bold mb-2">{t('invitation_landing.title', { company: invitation.company_name })}</h2>
        <p className="text-sm text-slate-500 mb-3">{t('invitation_landing.position')}: {invitation.metadata?.job_title || invitation.assessment_id}</p>
        <p className="text-sm text-slate-500 mb-4">{t('invitation_landing.valid_until')}: {new Date(invitation.expires_at).toLocaleString()}</p>

        {!assessment && invitation.status !== 'completed' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{t('invitation_landing.start_desc')}</p>
            <div className="flex gap-2">
              <button onClick={handleStart} className="px-4 py-2 bg-cyan-600 text-white rounded">{t('invitation_landing.start_button')}</button>
            </div>
          </div>
        )}

        {assessment && (
          <div className="mt-6 space-y-4">
            <h3 className="font-bold">{assessment.title || t('invitation_landing.assessment_fallback_title')}</h3>
            <div className="space-y-4">
              {assessment.questions.map((q: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="text-sm font-medium">{t('invitation_landing.question_label', { index: idx + 1 })}</div>
                  <div className="text-sm text-slate-700 my-2">{q.text}</div>
                  <textarea value={answers[idx] || ''} onChange={e => handleAnswerChange(idx, e.target.value)} className="w-full p-2 border rounded" rows={4} />
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <button onClick={() => { setAssessment(null); }} className="px-3 py-2 border rounded">{t('app.cancel')}</button>
                <button onClick={handleSubmit} disabled={submitting} className="px-3 py-2 bg-cyan-600 text-white rounded">{submitting ? t('invitation_landing.submitting') : t('invitation_landing.submit_button')}</button>
              </div>
            </div>
          </div>
        )}

        {invitation.status === 'completed' && (
          <div className="mt-4 text-sm text-green-600">{t('invitation_landing.completed')}</div>
        )}
      </div>
    </div>
  );
};

export default InvitationLanding;
