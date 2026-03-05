import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authenticatedFetch } from '../services/csrfService';
import { BACKEND_URL } from '../constants';
import { supabase } from '../services/supabaseService';
import AssessmentExperienceRouter from './AssessmentExperienceRouter';

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
  const [retrying, setRetrying] = useState(false);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 6000;

  // --- Assessment Taking Logic ---
  const [activeAssessment, setActiveAssessment] = useState<any | null>(null);
  const [activeInvitationId, setActiveInvitationId] = useState<string | null>(null);

  const scheduleRetry = () => {
    if (retryCountRef.current >= MAX_RETRIES) return;
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    retryCountRef.current += 1;
    retryTimeoutRef.current = window.setTimeout(() => {
      load();
    }, RETRY_DELAY_MS);
  };

  const load = async () => {
    setError(null);
    setLoading(true);
    setRetrying(false);
    try {
      const res = await authenticatedFetch(`${BACKEND_URL}/assessments/invitations${forCompany ? '?for_company=true' : ''}`, { method: 'GET' });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setInvitations(data.invitations || []);
      retryCountRef.current = 0;
    } catch (e: any) {
      const message = String(e?.message || '');
      const isAbort =
        e?.name === 'AbortError' ||
        message.toLowerCase().includes('aborted');
      const isBackendUnavailable = message.toLowerCase().includes('networkerror')
        || message.toLowerCase().includes('failed to fetch')
        || message.toLowerCase().includes('timeout')
        || isAbort;
      if (isBackendUnavailable) {
        if (!invitations.length) {
          scheduleRetry();
          setRetrying(true);
        }
      } else {
        console.error(e);
        if (!invitations.length) {
          setError(e.message || t('my_invitations.load_failed'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

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
      <AssessmentExperienceRouter
        assessment={activeAssessment}
        invitationId={activeInvitationId}
        onComplete={handleAssessmentComplete}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-[1.05rem] border border-slate-200 bg-white/90 p-4 shadow-[0_20px_38px_-32px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white">{t('my_invitations.title')}</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {forCompany
              ? t('my_invitations.company_hint', { defaultValue: 'Keep a clean overview of active assessment invitations.' })
              : t('my_invitations.candidate_hint', { defaultValue: 'Resume invited assessments without leaving your handshake flow.' })}
          </p>
        </div>
        <button onClick={load} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">{t('my_invitations.refresh')}</button>
      </div>

      {loading && <div className="text-sm text-slate-500 animate-pulse">{t('my_invitations.loading')}</div>}
      {!loading && retrying && !invitations.length && (
        <div className="text-sm text-slate-500 animate-pulse">
          {t('my_invitations.retrying', { defaultValue: 'Zkouším znovu připojit backend…' })}
        </div>
      )}
      {error && <div className="rounded-[0.95rem] bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/20">{error}</div>}

      {!loading && !invitations.length && (
        <div className="rounded-[1rem] border border-dashed border-slate-300 bg-slate-50 p-7 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-500">{t('my_invitations.empty')}</p>
        </div>
      )}

      <div className="space-y-3">
        {invitations.map(inv => (
          <div key={inv.id} className="rounded-[1rem] border border-slate-200 bg-white/95 p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.45)] transition-all hover:shadow-[0_22px_40px_-30px_rgba(15,23,42,0.5)] dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  {inv.metadata?.job_title || t('my_invitations.unknown_position')}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">ID: {inv.assessment_id.slice(0, 6)}...</span>
                  <span>{t('my_invitations.expires')}: {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`rounded-full px-3 py-1 text-sm font-bold ${inv.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  inv.status === 'expired' ? 'bg-slate-100 text-slate-500' :
                    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                  }`}>
                  {inv.status === 'pending' ? t('my_invitations.status_pending') :
                    inv.status === 'completed' ? t('my_invitations.status_completed') : t('my_invitations.status_expired')}
                </div>

                {inv.status === 'pending' && !forCompany && (
                  <button
                    onClick={() => handleStartAssessment(inv)}
                    className="rounded-[0.95rem] bg-cyan-600 px-4 py-2 text-white font-bold shadow-[0_18px_32px_-22px_rgba(8,145,178,0.45)] transition-colors hover:bg-cyan-500 active:scale-95"
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
