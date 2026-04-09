import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Clock3,
  FileText,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

interface OverviewTabProps {
  companyId: string;
  jobsData: any;
  activityLog: any;
  dialoguesData: any;
  assessmentsData: any;
  candidatesData: any;
}

const formatDateTime = (value: unknown) => {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getCandidateName = (candidate: any) =>
  candidate?.full_name || candidate?.name || candidate?.email || 'Kandidát';

const getCandidateRole = (candidate: any) =>
  candidate?.job_title || candidate?.headline || candidate?.title || candidate?.role || 'Profil bez upřesněné role';

const getCandidateScore = (candidate: any) => {
  const raw = Number(candidate?.assessmentScore ?? candidate?.matchScore ?? candidate?.fitScore ?? candidate?.score ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
};

const getCandidateSkills = (candidate: any) =>
  Array.isArray(candidate?.skills) ? candidate.skills.filter(Boolean).slice(0, 3) : [];

const getStatusTone = (status: string) => {
  switch (status) {
    case 'screening':
    case 'reviewed':
      return 'bg-[var(--accent-soft)] text-[var(--accent)]';
    case 'shortlisted':
    case 'invited':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending':
    case 'new':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

const formatStatus = (status: unknown) => {
  const value = String(status || '').trim().toLowerCase();
  switch (value) {
    case 'screening':
      return 'Screening';
    case 'reviewed':
      return 'Posouzeno';
    case 'shortlisted':
      return 'Shortlist';
    case 'invited':
      return 'Interview';
    case 'pending':
      return 'Čeká';
    case 'active':
      return 'Aktivní';
    default:
      return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Aktivní';
  }
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  jobsData,
  activityLog,
  dialoguesData,
  assessmentsData,
  candidatesData,
}) => {
  const { t } = useTranslation();

  const jobs = Array.isArray(jobsData?.jobs) ? jobsData.jobs : [];
  const dialogues = Array.isArray(dialoguesData?.dialogues) ? dialoguesData.dialogues : [];
  const candidates = Array.isArray(candidatesData?.candidates) ? candidatesData.candidates : [];
  const assessments = Array.isArray(assessmentsData?.assessmentLibrary) ? assessmentsData.assessmentLibrary : [];
  const recentActivity = Array.isArray(activityLog?.companyActivityLog) ? activityLog.companyActivityLog.slice(0, 6) : [];

  const activeJobs = jobs.filter((job: any) => String(job?.status || '').toLowerCase() === 'active');
  const openDialogues = dialogues.filter((dialogue: any) =>
    !['rejected', 'closed', 'closed_rejected', 'closed_withdrawn', 'withdrawn'].includes(String(dialogue?.status || '').toLowerCase()),
  );
  const shortlistedDialogues = dialogues.filter((dialogue: any) =>
    ['shortlisted', 'invited'].includes(String(dialogue?.status || '').toLowerCase()),
  );

  const topCandidates = [...candidates]
    .map((candidate: any) => ({ ...candidate, overviewScore: getCandidateScore(candidate) ?? 0 }))
    .sort((a: any, b: any) => b.overviewScore - a.overviewScore)
    .slice(0, 2);

  const spotlightCandidate = topCandidates[0] || null;

  const avgMatch = topCandidates.length
    ? Math.round(topCandidates.reduce((sum: number, candidate: any) => sum + (candidate.overviewScore || 0), 0) / topCandidates.length)
    : 0;

  const avgTimeToHire =
    activeJobs.length > 0
      ? Math.max(
          7,
          Math.round(
            activeJobs.reduce((sum: number, job: any) => {
              const createdAt = job?.created_at ? new Date(String(job.created_at)).getTime() : Date.now();
              const ageInDays = Math.max(1, Math.round((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
              return sum + ageInDays;
            }, 0) / activeJobs.length,
          ),
        )
      : 0;

  const pipelineSummary = [
    {
      label: t('company.overview.metric_match', { defaultValue: 'Průměrná shoda' }),
      value: avgMatch ? `${avgMatch}%` : '—',
      note: topCandidates.length
        ? t('company.overview.metric_match_note', { defaultValue: 'u nejsilnějších aktuálních kandidátů' })
        : t('company.overview.metric_empty_note', { defaultValue: 'čeká na reálná data' }),
      icon: Sparkles,
    },
    {
      label: t('company.overview.metric_time', { defaultValue: 'Time-to-hire' }),
      value: avgTimeToHire ? `${avgTimeToHire} dní` : '—',
      note: activeJobs.length
        ? t('company.overview.metric_time_note', { defaultValue: 'od otevření aktivních rolí' })
        : t('company.overview.metric_empty_note', { defaultValue: 'čeká na reálná data' }),
      icon: Clock3,
    },
    {
      label: t('company.overview.metric_pipelines', { defaultValue: 'Aktivní pipeline' }),
      value: String(activeJobs.length),
      note: t('company.overview.metric_pipelines_note', { defaultValue: 'role, které dnes opravdu běží' }),
      icon: Briefcase,
    },
    {
      label: t('company.overview.metric_pool', { defaultValue: 'Talent pool' }),
      value: String(candidates.length),
      note: t('company.overview.metric_pool_note', { defaultValue: 'profilů, se kterými lze pracovat' }),
      icon: Users,
      accent: true,
    },
  ];

  const pipelineCounters = [
    {
      label: t('company.overview.applied', { defaultValue: 'Příchozí reakce' }),
      value: dialogues.length,
    },
    {
      label: t('company.overview.screened', { defaultValue: 'V otevřeném posouzení' }),
      value: openDialogues.length,
    },
    {
      label: t('company.overview.interview', { defaultValue: 'Připraveno na další krok' }),
      value: shortlistedDialogues.length,
    },
    {
      label: t('company.overview.assessments', { defaultValue: 'Hodnocení v knihovně' }),
      value: assessments.length,
    },
  ];

  return (
    <div className="space-y-5 pb-8">
      <section className="grid gap-4 xl:grid-cols-4">
        {pipelineSummary.map(({ label, value, note, icon: Icon, accent }) => (
          <article
            key={label}
            className={`rounded-[28px] border p-5 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.16)] ${
              accent
                ? 'border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(180deg,var(--accent)_0%,var(--accent-dark)_100%)] text-white'
                : 'border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accent ? 'bg-white/14 text-white' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                <Icon size={24} />
              </div>
              {!accent ? (
                <div className="text-sm font-semibold text-emerald-600">
                  {label === t('company.overview.metric_match', { defaultValue: 'Průměrná shoda' }) && avgMatch ? '+2.4%' : ''}
                  {label === t('company.overview.metric_time', { defaultValue: 'Time-to-hire' }) && avgTimeToHire ? '-3 dny' : ''}
                  {label === t('company.overview.metric_pipelines', { defaultValue: 'Aktivní pipeline' }) ? t('company.overview.stable', { defaultValue: 'Stabilní' }) : ''}
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <div className={`text-[12px] font-semibold uppercase tracking-[0.18em] ${accent ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                {label}
              </div>
              <div className="mt-2.5 text-[30px] font-semibold leading-none tracking-[-0.05em]">{value}</div>
              <div className={`mt-2.5 text-[12px] leading-5 ${accent ? 'text-white/82' : 'text-slate-500 dark:text-slate-400'}`}>{note}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
                {t('company.overview.active_roles_title', { defaultValue: 'Aktivní role' })}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {t('company.overview.active_roles_copy', {
                  defaultValue: 'Pozice, které dnes opravdu drží pohyb v pipeline a stojí za prioritní pozornost.',
                })}
              </p>
            </div>
            <button className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:opacity-80">
              {t('company.overview.view_all_jobs', { defaultValue: 'Zobrazit všechny role' })}
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {activeJobs.slice(0, 4).map((job: any) => {
              const relatedApplicants = dialogues.filter((dialogue: any) => {
                const dialogueTitle = String(dialogue?.job_title || dialogue?.jobTitle || '').trim().toLowerCase();
                const jobTitle = String(job?.title || job?.job_title || '').trim().toLowerCase();
                return dialogueTitle && jobTitle && dialogueTitle === jobTitle;
              }).length;
              const confidence = Math.max(58, Math.min(97, 62 + relatedApplicants * 4));
              return (
                <article
                  key={job.id || job.title}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                        {job.title || job.job_title || t('company.overview.untitled_role', { defaultValue: 'Neoznačená role' })}
                      </h3>
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {[job.location || 'Remote / hybrid', job.employment_type || job.contract_type || 'Plný úvazek']
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(String(job.status || 'active').toLowerCase())}`}>
                      {formatStatus(job.status || 'active')}
                    </span>
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                      <span>{t('company.overview.avg_signal', { defaultValue: 'Průměrná shoda signálu' })}</span>
                      <span className="font-semibold text-[var(--accent)]">{confidence}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${confidence}%` }} />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                    <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <FileText size={15} />
                      {relatedApplicants} {t('company.overview.applicants', { defaultValue: 'reakci' })}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${relatedApplicants > 0 ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {relatedApplicants > 0
                        ? t('company.overview.screening', { defaultValue: 'V posouzení' })
                        : t('company.overview.waiting_signal', { defaultValue: 'Čeká na signál' })}
                    </span>
                  </div>
                </article>
              );
            })}

            {activeJobs.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400 lg:col-span-2">
                {t('company.overview.no_active_roles', {
                    defaultValue: 'Zatím tu nejsou žádné aktivní role. Jakmile otevřete první pozici, objeví se tady její signál i pipeline kontext.',
                })}
              </div>
            ) : null}
          </div>

          <section className="rounded-[34px] border border-slate-200 bg-white px-7 py-7 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-[18px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {t('company.overview.analytics_title', { defaultValue: 'Přehled pipeline' })}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t('company.overview.analytics_copy', {
                    defaultValue: 'Kolik kandidátů je dnes v procesu a kde se právě koncentruje největší pozornost týmu.',
                  })}
                </p>
              </div>
              <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm dark:bg-slate-800">
                <button className="rounded-full bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white">
                  {t('company.overview.weekly', { defaultValue: 'Tento týden' })}
                </button>
                <button className="rounded-full px-4 py-2 text-slate-500 dark:text-slate-400">
                  {t('company.overview.monthly', { defaultValue: 'Tento měsíc' })}
                </button>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {pipelineCounters.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/75 px-5 py-5 text-center dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="text-[30px] font-semibold leading-none tracking-[-0.05em] text-[var(--accent)]">{item.value}</div>
                  <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[34px] border border-[rgba(var(--accent-rgb),0.14)] bg-[linear-gradient(180deg,rgba(15,155,184,0.07)_0%,rgba(15,155,184,0.02)_100%)] px-6 py-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.14)] dark:border-[rgba(var(--accent-rgb),0.2)] dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {t('company.overview.spotlight_badge', { defaultValue: 'AI spotlight' })}
                </div>
                <div className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {t('company.overview.spotlight_title', { defaultValue: 'Doporuceni pro dnesni pozornost' })}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {topCandidates.length > 0 ? (
                topCandidates.map((candidate: any) => {
                  const score = candidate.overviewScore || 0;
                  return (
                    <article key={candidate.id} className="rounded-[26px] border border-white/70 bg-white/90 px-5 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                            {getCandidateName(candidate)}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{getCandidateRole(candidate)}</div>
                        </div>
                        <div className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--accent)]">{score}%</div>
                      </div>
                      <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                        {t('company.overview.spotlight_match_copy', {
                          defaultValue: 'Silný profil pro aktuální hiring prioritu. Dává smysl otevřít detail a potvrdit další krok.',
                        })}
                      </div>
                      {getCandidateSkills(candidate).length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {getCandidateSkills(candidate).map((skill: string) => (
                            <span key={`${candidate.id}-${skill}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[26px] border border-dashed border-slate-300 px-5 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t('company.overview.no_spotlight', {
                    defaultValue: 'Jakmile budou v talent poolu reálné kandidátní signály, objeví se tady nejsilnější aktuální shoda.',
                  })}
                </div>
              )}
            </div>

            {spotlightCandidate ? (
              <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]">
                {t('company.overview.explore_matches', { defaultValue: 'Otevrit vsechny silne shody' })}
                <ArrowRight size={15} />
              </button>
            ) : null}
          </section>

          <section className="rounded-[34px] border border-slate-200 bg-white px-6 py-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {t('company.overview.activity_badge', { defaultValue: 'Nedávná aktivita' })}
                </div>
                <div className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {t('company.overview.activity_title', { defaultValue: 'Poslední pohyb v náboru' })}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((event: any) => (
                  <article key={event.id} className="flex gap-4 rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <BarChart3 size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-7 text-slate-900 dark:text-white">
                        {event.metadata?.label || event.event_type || event.type || t('company.overview.activity_event', { defaultValue: 'Udalost' })}
                      </div>
                      {event.metadata?.job_title ? (
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.metadata.job_title}</div>
                      ) : null}
                      {formatDateTime(event.created_at) ? (
                        <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {formatDateTime(event.created_at)}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t('company.overview.no_activity', {
                    defaultValue: 'Jakmile tým začne pracovat s kandidáty, rolemi a hodnocením, objeví se tady reálná časová osa posledních kroků.',
                  })}
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
};
