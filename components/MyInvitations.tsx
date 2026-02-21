import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authenticatedFetch } from '../services/csrfService';
import { BACKEND_URL } from '../constants';
import { supabase } from '../services/supabaseService';
import AssessmentTaker from './AssessmentTaker';

interface Invitation {
  id: string;
  assessment_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  metadata: any;
  candidate_email?: string;
  company_id?: string;
}

const MyInvitations: React.FC<{ forCompany?: boolean }> = ({ forCompany = false }) => {
  const { t } = useTranslation();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Assessment Taking Logic ---
  const [activeAssessment, setActiveAssessment] = useState<any | null>(null);
  const [activeInvitationId, setActiveInvitationId] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${BACKEND_URL}/assessments/invitations${forCompany ? '?for_company=true' : ''}`, { method: 'GET' });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('my_invitations.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStartAssessment = async (invitation: Invitation) => {
    if (forCompany) return; // Companies don't take tests here

    try {
      setLoading(true);
      // Fetch full assessment data
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', invitation.assessment_id)
        .single();

      if (error) throw error;

      setActiveAssessment(data);
      setActiveInvitationId(invitation.id);
    } catch (e) {
      console.error("Failed to load assessment:", e);
      alert(t('my_invitations.assessment_load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentComplete = (_resultId: string) => {
    setActiveAssessment(null);
    setActiveInvitationId(null);
    load(); // Refresh list to show updated status
    alert(t('my_invitations.assessment_submit_success'));
  };

  if (activeAssessment && activeInvitationId) {
    return (
      <AssessmentTaker
        assessment={activeAssessment}
        invitationId={activeInvitationId}
        onComplete={handleAssessmentComplete}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-slate-900 dark:text-white">{t('my_invitations.title')}</h4>
        <button onClick={load} className="text-sm text-slate-500 hover:text-cyan-600 transition-colors">{t('my_invitations.refresh')}</button>
      </div>

      {loading && <div className="text-sm text-slate-500 animate-pulse">{t('my_invitations.loading')}</div>}
      {error && <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 p-2 rounded">{error}</div>}

      {!loading && !invitations.length && (
        <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500">{t('my_invitations.empty')}</p>
        </div>
      )}

      <div className="space-y-3">
        {invitations.map(inv => (
          <div key={inv.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  {inv.metadata?.job_title || t('my_invitations.unknown_position')}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">ID: {inv.assessment_id.slice(0, 6)}...</span>
                  <span>{t('my_invitations.expires')}: {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`text-sm font-bold px-3 py-1 rounded-full ${inv.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  inv.status === 'expired' ? 'bg-slate-100 text-slate-500' :
                    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                  }`}>
                  {inv.status === 'pending' ? t('my_invitations.status_pending') :
                    inv.status === 'completed' ? t('my_invitations.status_completed') : t('my_invitations.status_expired')}
                </div>

                {inv.status === 'pending' && !forCompany && (
                  <button
                    onClick={() => handleStartAssessment(inv)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 active:scale-95"
                  >
                    {t('my_invitations.start_test')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyInvitations;
