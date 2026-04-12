import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MoreVertical, ShieldCheck, UserPlus, Users } from 'lucide-react';
import type { CompanyProfile, RecruiterMember } from '../../../../types';
import { useCompanyTeamInvite } from '../../../../hooks/useCompanyTeamInvite';

interface TeamTabProps {
  companyProfile?: CompanyProfile | null;
  onProfileUpdate?: (profile: CompanyProfile) => void;
}

export const TeamTab: React.FC<TeamTabProps> = ({ companyProfile, onProfileUpdate }) => {
  const { t } = useTranslation();
  const members: RecruiterMember[] = companyProfile?.members || [];
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'recruiter' | 'admin'>('recruiter');
  const [inviteSent, setInviteSent] = useState(false);
  const { invite, loading, error } = useCompanyTeamInvite();

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName || !companyProfile?.id) return;
    const result = await invite(companyProfile.id, inviteEmail, inviteName, inviteRole);
    if (result) {
      // Refresh local state with pending status
      const newMember: RecruiterMember = {
        id: result.invitation_id,
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        joinedAt: new Date().toISOString(),
        status: 'invited',
        source: 'member',
      };
      onProfileUpdate?.({ ...companyProfile, members: [...members, newMember] });
      setInviteEmail('');
      setInviteName('');
      setShowInviteForm(false);
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 4000);
    }
  };

  const adminCount = members.filter((member) => member.role === 'admin').length;
  const recruiterCount = members.filter((member) => member.role === 'recruiter').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('company.team.title', { defaultValue: 'Náborový tým' })}
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({members.length} {t('company.team.members_count', { defaultValue: 'členů' })})
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {adminCount} {t('company.team.admin_count', { defaultValue: 'adminů' })} · {recruiterCount} {t('company.team.recruiter_count', { defaultValue: 'recruiterů' })}
          </p>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-dark)]"
        >
          <UserPlus size={15} />
          {t('company.team.invite', { defaultValue: 'Pozvat člena' })}
        </button>
      </div>

      {showInviteForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            {t('company.team.invite_title', { defaultValue: 'Pozvat nového člena' })}
          </h3>

          {inviteSent && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {t('company.team.invite_sent_success', { defaultValue: '✅ Pozvánka byla odeslána na {email}', email: inviteEmail || '...' })}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('company.team.invite_name', { defaultValue: 'Jméno' })}
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="Jan Novák"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('company.team.invite_email', { defaultValue: 'E-mail' })}
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="jan@firma.cz"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('company.team.invite_role', { defaultValue: 'Role' })}
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'recruiter' | 'admin')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="recruiter">{t('company.team.role_recruiter', { defaultValue: 'Recruiter' })}</option>
                <option value="admin">{t('company.team.role_admin', { defaultValue: 'Admin' })}</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleInvite}
              disabled={!inviteEmail || !inviteName || loading}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? t('company.team.sending', { defaultValue: 'Odesílám...' })
                : t('company.team.send_invite', { defaultValue: 'Odeslat pozvánku' })}
            </button>
            <button
              onClick={() => setShowInviteForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('common.cancel', { defaultValue: 'Zrušit' })}
            </button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
            <Users size={32} className="text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('company.team.empty_title', { defaultValue: 'Tým je zatím prázdný' })}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {t('company.team.empty_desc', { defaultValue: 'Pozvěte kolegy z náborového týmu. Uvidí role, reakce kandidátů a mohou pracovat ve stejném firemním dashboardu.' })}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      member.name.split(' ').map((name: string) => name[0]).join('').toUpperCase().slice(0, 2)
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{member.name}</p>
                      {member.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <ShieldCheck size={10} />
                          Admin
                        </span>
                      )}
                      {member.status === 'invited' && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Mail size={10} />
                          {t('company.team.status_invited', { defaultValue: 'Pozván' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </span>
                  <button className="rounded p-1 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                    <MoreVertical size={14} className="text-slate-400" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
