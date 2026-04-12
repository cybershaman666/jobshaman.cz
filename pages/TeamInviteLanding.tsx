import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Check, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { BACKEND_URL } from '../constants';

interface InviteInfo {
  company_id: string;
  company_name: string;
  invited_email: string;
  invited_name: string;
  role: string;
  status: string;
}

const TeamInviteLanding: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const token = window.location.pathname.split('/').pop();
    if (!token || token === 'invite') {
      setError(t('team_invite.invalid_link'));
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/companies/team/invite/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || t('team_invite.api_error', { status: res.status }));
        }
        const data = await res.json();
        setInvite(data);
      } catch (e: any) {
        setError(e.message || t('team_invite.verify_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  const handleAccept = async () => {
    if (!invite) return;
    setAccepting(true);
    try {
      const token = window.location.pathname.split('/').pop() || '';
      const params = new URLSearchParams({
        invite_token: token,
        company_id: invite.company_id,
      });
      window.location.href = `/auth/register?${params.toString()}`;
    } catch {
      setError(t('team_invite.accept_failed'));
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
          <p className="text-sm text-slate-500">{t('team_invite.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/20">
            <Mail className="h-7 w-7 text-rose-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('team_invite.invalid_title')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || t('team_invite.not_found')}</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            {t('team_invite.go_home')}
          </button>
        </div>
      </div>
    );
  }

  if (invite.status === 'accepted' || invite.status === 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
            <Check className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('team_invite.already_accepted_title')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('team_invite.already_accepted_desc')}</p>
          <button
            onClick={() => { window.location.href = '/dashboard?company_tab=overview'; }}
            className="mt-4 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t('team_invite.open_dashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-6 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-900/20">
              <UserPlus className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('team_invite.title', { defaultValue: 'Pozv&aacute;nka do t&yacute;mu' })}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('team_invite.subtitle', { defaultValue: 'Byli jste pozv&aacute;ni do n&aacute;borov&eacute;ho t&yacute;mu' })}
            </p>
          </div>

          <div className="space-y-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-400" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {t('team_invite.company', { defaultValue: 'Firma' })}
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">{invite.company_name}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {t('team_invite.role', { defaultValue: 'Role' })}
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white capitalize">{invite.role}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="7" r="4" />
                <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
              </svg>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {t('team_invite.invited', { defaultValue: 'Pozv&aacute;n' })}
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">{invite.invited_name}</div>
                <div className="text-xs text-slate-400">{invite.invited_email}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
            {t('team_invite.info', { defaultValue: 'Po přijet&iacute; pozv&aacute;nky budete přesměrov&aacute;ni na registraci nebo přihl&aacute;šen&iacute;. Pot&eacute; z&iacute;sk&aacute;te př&iacute;stup k firemn&iacute;mu dashboardu.' })}
          </div>

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="mt-4 w-full rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {accepting
              ? t('team_invite.accepting', { defaultValue: 'Přij&iacute;m&aacute;m...' })
              : t('team_invite.accept', { defaultValue: 'Přijmout pozv&aacute;nku' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamInviteLanding;
