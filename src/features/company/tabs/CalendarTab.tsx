import React from 'react';
import { CalendarDays, CheckCircle2, Clock3, Share2, Users, Video, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CompanyProfile, RecruiterMember } from '../../../../types';

interface CalendarTabProps {
  companyProfile?: CompanyProfile | null;
  jobsData: any;
  dialoguesData: any;
}

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('cs-CZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const initials = (value: string) =>
  String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'TM';

export const CalendarTab: React.FC<CalendarTabProps> = ({ companyProfile, jobsData, dialoguesData }) => {
  const { t } = useTranslation();
  const members: RecruiterMember[] = companyProfile?.members || [];
  const jobs = jobsData?.jobs || [];
  const dialogues = dialoguesData?.dialogues || [];

  const upcomingSessions = React.useMemo(() => {
    return dialogues.slice(0, 5).map((dialogue: any, index: number) => {
      const base = new Date();
      base.setDate(base.getDate() + index);
      base.setHours(9 + index * 2, index % 2 === 0 ? 0 : 30, 0, 0);
      return {
        id: dialogue.id || `dialogue-${index}`,
        title: dialogue.candidate_name || dialogue.candidateName || `Kandidát ${index + 1}`,
        role: dialogue.job_title || dialogue.jobTitle || jobs[index % Math.max(jobs.length, 1)]?.title || 'Otevřená role',
        owner: members[index % Math.max(members.length, 1)]?.name || 'Hiring tým',
        startsAt: base.toISOString(),
        mode: index % 2 === 0 ? 'Interview' : 'Sync',
      };
    });
  }, [dialogues, jobs, members]);

  const sharedCalendars = React.useMemo(
    () =>
      (members.length > 0 ? members : []).slice(0, 5).map((member, index) => ({
        id: member.id,
        name: member.name,
        role: member.role === 'admin' ? 'Vedoucí náboru' : 'Recruiter',
        shared: true,
        availability: ['Vysoká dostupnost', 'Interview bloky sdílené', 'Částečná dostupnost', 'Fokus bloky zapnuté'][index % 4],
      })),
    [members],
  );

  const nextMilestones = [
    {
      title: t('company.calendar.milestone_sync', { defaultValue: 'Týmový hiring sync' }),
      copy: t('company.calendar.milestone_sync_copy', {
        defaultValue: 'Sjednotit interview, vlastníky dalších kroků a úzká místa napříč aktivními rolemi.',
      }),
    },
    {
      title: t('company.calendar.milestone_share', { defaultValue: 'Sdílet kalendář s hiring týmem' }),
      copy: t('company.calendar.milestone_share_copy', {
        defaultValue: 'Dejte recruiterům i hiring managerům společný přehled interview bloků a dostupnosti.',
      }),
    },
    {
      title: t('company.calendar.milestone_focus', { defaultValue: 'Chránit rozhodovací okna' }),
      copy: t('company.calendar.milestone_focus_copy', {
        defaultValue: 'Rezervujte krátké rozhodovací sloty po finálních interview, aby se feedback nezasekl.',
      }),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                <CalendarDays size={14} />
                {t('company.calendar.badge', { defaultValue: 'Sdílený náborový kalendář' })}
              </div>
              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                {t('company.calendar.title', { defaultValue: 'Kalendář' })}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                {t('company.calendar.copy', {
                  defaultValue:
                    'Udržte interview, týmové synchronizace i rozhodovací okna v jednom sdíleném přehledu. Každý v týmu hned vidí, co je naplánované a kdo je vlastníkem dalšího kroku.',
                })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                <Share2 size={16} />
                {t('company.calendar.share_button', { defaultValue: 'Sdílet s týmem' })}
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_36px_-26px_rgba(15,155,184,0.55)] transition hover:bg-[var(--accent-dark)]">
                <Plus size={16} />
                {t('company.calendar.create_event', { defaultValue: 'Vytvořit událost' })}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t('company.calendar.upcoming', { defaultValue: 'Nejbližší bloky' })}
              </div>
              <div className="mt-2 text-[28px] font-semibold text-slate-950 dark:text-white">{upcomingSessions.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t('company.calendar.shared', { defaultValue: 'Sdílené kalendáře' })}
              </div>
              <div className="mt-2 text-[28px] font-semibold text-slate-950 dark:text-white">{sharedCalendars.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t('company.calendar.roles_in_motion', { defaultValue: 'Role v pohybu' })}
              </div>
              <div className="mt-2 text-[28px] font-semibold text-slate-950 dark:text-white">{jobs.filter((job: any) => job.status === 'active').length || jobs.length}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(180deg,var(--accent)_0%,var(--accent-dark)_100%)] p-5 text-white shadow-[0_26px_60px_-34px_rgba(15,155,184,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
              <Users size={22} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                {t('company.calendar.team_sync', { defaultValue: 'Týmový režim' })}
              </div>
              <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">
                {t('company.calendar.team_sync_title', { defaultValue: 'Jeden kalendář pro celý hiring tým' })}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-white/88">
            {t('company.calendar.team_sync_copy', {
              defaultValue:
                'Interview bloky, synchronizace i rozhodovací okna může tým sdílet napříč recruitery, aby bylo vždy jasné, kdo vlastní další krok.',
            })}
          </p>
          <div className="mt-5 space-y-3">
            {sharedCalendars.slice(0, 3).map((member) => (
              <div key={member.id} className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{member.name}</div>
                    <div className="text-xs text-white/72">{member.role}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-medium text-white">
                    <CheckCircle2 size={12} />
                    {t('company.calendar.shared_status', { defaultValue: 'Sdíleno' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                {t('company.calendar.timeline', { defaultValue: 'Nejbližší plán náboru' })}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('company.calendar.timeline_copy', { defaultValue: 'Interview, synchronizace a rozhodovací okna, která potřebují pozornost jako další.' })}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Video size={14} />
              {t('company.calendar.live_sync', { defaultValue: 'Připraveno pro sdílení v týmu' })}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map((session: { id: string; title: string; role: string; owner: string; startsAt: string; mode: string }) => (
                <article
                  key={session.id}
                  className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 transition hover:border-[var(--accent)]/30 hover:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-base font-semibold text-slate-950 dark:text-white">{session.title}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{session.role}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 dark:bg-slate-900">
                        <Clock3 size={13} />
                        {formatTime(session.startsAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 dark:bg-slate-900">
                        <Users size={13} />
                        {session.owner}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 dark:bg-slate-900">
                        <CalendarDays size={13} />
                        {session.mode}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('company.calendar.empty_timeline', { defaultValue: 'Zatím tu nejsou žádné sdílené bloky. Jakmile tým začne plánovat interview nebo synchronizace, objeví se tady.' })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              {t('company.calendar.shared_calendars', { defaultValue: 'Sdílené týmové kalendáře' })}
            </h3>
            <div className="mt-5 space-y-3">
              {sharedCalendars.length > 0 ? (
                sharedCalendars.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)] dark:bg-[rgba(var(--accent-rgb),0.16)] dark:text-[var(--accent)]">
                        {initials(member.name)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{member.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{member.availability}</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {member.shared ? t('company.calendar.visible', { defaultValue: 'Viditelné pro tým' }) : 'Soukromé'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t('company.calendar.empty_shared', { defaultValue: 'Zatím tu nejsou nastavené žádné sdílené kalendáře týmu.' })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              {t('company.calendar.next_milestones', { defaultValue: 'Dalsi milniky' })}
            </h3>
            <div className="mt-5 space-y-4">
              {nextMilestones.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.copy}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
