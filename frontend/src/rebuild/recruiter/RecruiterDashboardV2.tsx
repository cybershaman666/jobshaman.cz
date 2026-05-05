import React from 'react';
import {
  Briefcase,
  ChevronRight,
  LayoutDashboard,
  Settings2,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

import type { UserProfile } from '../../types';
import type { CandidateInsight, HandshakeBlueprint, Role } from '../models';
import { cn } from '../cn';

import { buildRecruiterDashboardViewModel } from '../dashboard/viewModels';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { fetchV2CompanyDashboard, type V2CompanyDashboardPayload } from '../../services/companyDashboardService';


type TFunction = (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;

interface RecruiterMetrics {
  curatedRoles: number;
  importedRoles: number;
  blueprints: number;
  candidates: number;
  interviewsBooked: number;
  submittedJourneys: number;
}

const RecruiterMetricCard: React.FC<{
  label: string;
  value: string;
  delta: string;
  tone: 'neutral' | 'blue' | 'orange' | 'green';
}> = ({ label, value, delta, tone }) => {
  const icon = tone === 'blue' ? <Users size={14} /> : tone === 'orange' ? <Briefcase size={14} /> : <TrendingUp size={14} />;
  return (
    <div className="rounded-[22px] border border-[color:var(--shell-panel-border)] bg-[color:var(--shell-panel-solid)] px-5 py-4 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.12)] dark:shadow-none">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-[1.8rem] font-semibold tracking-[-0.05em] text-[color:var(--shell-text-primary)]">{value}</div>
        <div className="text-[10px] font-bold text-emerald-500">{delta}</div>
      </div>
    </div>
  );
};

const RecruiterRadarCard: React.FC<{
  metrics: ReturnType<typeof buildRecruiterDashboardViewModel>['radarMetrics'];
  t: TFunction;
}> = ({ metrics, t }) => (
  <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
    <div className="mb-8 flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.talent_intelligence', { defaultValue: 'Talent Intelligence' })}</div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.cognitive_map', { defaultValue: 'Team cognitive map' })}</h3>
      </div>
      <button type="button" className="text-xs font-semibold text-[color:var(--shell-accent-cyan)] hover:underline">{t('rebuild.recruiter.show_detail', { defaultValue: 'Show detail' })}</button>
    </div>
    {metrics.length === 0 ? (
      <div className="flex h-[320px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#e3e8ec] dark:border-slate-800 bg-[#fbfcfd] dark:bg-slate-900/50 px-6 text-center text-[13px] leading-6 text-[#6a7380] dark:text-slate-400">
        {t('rebuild.recruiter.radar_empty', { defaultValue: 'The team map will start assembling from completed assessments.' })}
      </div>
    ) : (
      <div className="relative flex items-center justify-center min-h-[320px]">
        <img src="/cybershaman-recruiter-radar.svg" alt="" className="dark:hidden h-[280px] w-auto object-contain opacity-90" />
        <img src="/cybershaman-recruiter-radar-dark.svg" alt="" className="hidden dark:block h-[280px] w-auto object-contain opacity-90" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        {metrics.map((metric, index) => {
          const positions = [
            'left-[44%] top-[5%]',
            'right-[9%] top-[20%]',
            'right-[8%] bottom-[24%]',
            'left-[43%] bottom-[7%]',
            'left-[9%] bottom-[22%]',
            'left-[9%] top-[22%]',
          ];
          return (
            <div key={metric.label} className={cn('absolute hidden max-w-[100px] text-[10px] font-medium text-[color:var(--shell-text-secondary)] lg:block', positions[index])}>
              {metric.label}
            </div>
          );
        })}
      </div>
    )}
  </section>
);

const ActiveRolesCard: React.FC<{
  roles: ReturnType<typeof buildRecruiterDashboardViewModel>['activeRoles'];
  t: TFunction;
}> = ({ roles, t }) => (
  <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
    <div className="mb-8 flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.open_positions', { defaultValue: 'Open positions' })}</div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.active_challenges', { defaultValue: 'Active challenges' })}</h3>
      </div>
      <button type="button" className="text-xs font-semibold text-[color:var(--shell-accent-cyan)] hover:underline">{t('rebuild.recruiter.show_all', { defaultValue: 'Show all' })}</button>
    </div>
    <div className="space-y-3">
      {roles.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#e3e8ec] dark:border-slate-800 bg-[#fbfcfd] dark:bg-slate-900/50 px-6 text-center text-[13px] leading-6 text-[#6a7380] dark:text-slate-400">
          {t('rebuild.recruiter.no_active_roles', { defaultValue: 'There are no active roles yet.' })}
        </div>
      ) : roles.map((role) => (
        <button key={role.id} type="button" className="flex w-full items-center gap-4 rounded-[18px] border border-[#ebeff2] dark:border-slate-800 bg-white dark:bg-slate-800 px-4 py-3 text-left transition hover:border-[#dde7ed] dark:hover:border-slate-700 hover:bg-[#fbfcfd] dark:hover:bg-slate-700">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#edf3ff] dark:bg-blue-950/40 text-[#214b98] dark:text-blue-400 font-bold text-sm">
            {role.team.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#111827] dark:text-slate-200">{role.title}</div>
            <div className="truncate text-xs text-[#6a7380] dark:text-slate-400">{role.team}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-[#111827] dark:text-slate-200">{role.candidates}</div>
            <div className="text-[9px] uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">{t('rebuild.recruiter.candidates_count', { defaultValue: 'Candidates' })}</div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
        </button>
      ))}
    </div>
  </section>
);

const ResonanceCard: React.FC<{
  resonance: ReturnType<typeof buildRecruiterDashboardViewModel>['resonance'];
  tip: string;
  t: TFunction;
}> = ({ resonance, tip, t }) => (
  <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
    <div className="mb-8 flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.cognitive_resonance', { defaultValue: 'Cognitive resonance' })}</div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.team_resonance', { defaultValue: 'Resonance across the team' })}</h3>
      </div>
      <button type="button" className="text-xs font-semibold text-[color:var(--shell-accent-cyan)] hover:underline">Zobrazit detail</button>
    </div>
    <div className="space-y-6">
      {resonance.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#e3e8ec] dark:border-slate-800 bg-[#fbfcfd] dark:bg-slate-900/50 px-6 text-center text-[13px] leading-6 text-[#6a7380] dark:text-slate-400">
          {t('rebuild.recruiter.resonance_empty', { defaultValue: 'Resonance will be calculated after completing responses.' })}
        </div>
      ) : resonance.map((item) => (
        <div key={item.id} className="group">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold mb-2">
            <span className="text-[color:var(--shell-text-secondary)]">{item.label}</span>
            <span className="text-[color:var(--shell-text-primary)]">{item.value}%</span>
          </div>
          <div className="h-[4px] rounded-full bg-[color:var(--shell-track)]">
            <div className="h-full rounded-full bg-[color:var(--shell-accent-cyan)] transition-all duration-1000" style={{ width: `${item.value}%` }} />
          </div>
        </div>
      ))}
    </div>
    {tip && (
      <div className="mt-8 rounded-[20px] bg-[#f5f9ff] dark:bg-blue-950/20 p-5 border border-[#dbeafe] dark:border-blue-900/40">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#2563eb] dark:text-blue-400">
          <Sparkles size={13} /> {t('rebuild.recruiter.cybershaman_tip', { defaultValue: 'Tip Cybershamana' })}
        </div>
        <p className="mt-3 text-[13px] leading-6 text-slate-600 dark:text-slate-300 italic">“{tip}”</p>
      </div>
    )}
  </section>
);

const TopCandidatesCard: React.FC<{
  candidates: ReturnType<typeof buildRecruiterDashboardViewModel>['topCandidates'];
  t: TFunction;
}> = ({ candidates, t }) => (
  <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
    <div className="mb-8 flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.talent_insights', { defaultValue: 'Talent Insights' })}</div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.top_candidates', { defaultValue: 'Top candidates' })}</h3>
      </div>
      <button type="button" className="text-xs font-semibold text-[color:var(--shell-accent-cyan)] hover:underline">{t('rebuild.recruiter.show_all_short', { defaultValue: 'Show all' })}</button>
    </div>
    <div className="space-y-3">
      {candidates.length === 0 ? (
        <div className="flex h-[240px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#e3e8ec] dark:border-slate-800 bg-[#fbfcfd] dark:bg-slate-900/50 px-6 text-center text-[13px] leading-6 text-[#6a7380] dark:text-slate-400">
          {t('rebuild.recruiter.top_empty', { defaultValue: 'Here you will see the most suitable talents.' })}
        </div>
      ) : candidates.map((candidate) => (
        <button key={candidate.id} type="button" className="flex w-full items-center gap-4 rounded-[18px] border border-[#ebeff2] dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-3 text-left transition hover:border-[#dde7ed] dark:hover:border-slate-700 hover:bg-[#fbfcfd] dark:hover:bg-slate-700">
          <div className="h-11 w-11 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
            {candidate.name.split(/\s+/).slice(0, 2).map((item) => item[0]).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#111827] dark:text-slate-200">{candidate.name}</div>
            <div className="truncate text-xs text-[#6a7380] dark:text-slate-400">{candidate.role}</div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--shell-accent-cyan)] text-[10px] font-black">
            {candidate.score}%
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
        </button>
      ))}
    </div>
  </section>
);

const PipelineCard: React.FC<{
  pipeline: ReturnType<typeof buildRecruiterDashboardViewModel>['pipeline'];
  t: TFunction;
}> = ({ pipeline, t }) => {
  return (
    <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
      <div className="mb-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.hiring_status', { defaultValue: 'Hiring status' })}</div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.pipeline_overview', { defaultValue: 'Pipeline overview' })}</h3>
      </div>
      {pipeline.length === 0 ? (
        <div className="flex h-[240px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#e3e8ec] dark:border-slate-800 bg-[#fbfcfd] dark:bg-slate-900/50 px-6 text-center text-[13px] leading-6 text-[#6a7380] dark:text-slate-400">
          {t('rebuild.recruiter.pipeline_empty', { defaultValue: 'Pipeline does not contain data yet.' })}
        </div>
      ) : (
        <div className="grid gap-6 items-center">
          <div className="space-y-4">
            {pipeline.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between text-xs font-semibold pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">{stage.label}</span>
                <span className="text-slate-900 dark:text-slate-100">{stage.count}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-1">
            {/* Funnel chart simplified for elegant look */}
            <div className="h-[120px] w-full bg-[linear-gradient(180deg,#74a2f5_0%,#a5c4f9_40%,#d0e1fc_100%)] opacity-80" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 20% 100%)' }} />
          </div>
        </div>
      )}
    </section>
  );
};

const CompositionCard: React.FC<{
  composition: ReturnType<typeof buildRecruiterDashboardViewModel>['composition'];
  t: TFunction;
}> = ({ composition, t }) => {
  const gradient = composition.map((slice, index, items) => {
    const start = items.slice(0, index).reduce((sum, item) => sum + item.value, 0);
    const end = start + slice.value;
    return `${slice.color} ${start}% ${end}%`;
  }).join(', ');

  return (
    <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.archetypes', { defaultValue: 'Archetypy' })}</div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.team_composition', { defaultValue: 'Team composition' })}</h3>
        </div>
        <button type="button" className="text-xs font-semibold text-[color:var(--shell-accent-cyan)] hover:underline">{t('rebuild.recruiter.show_map', { defaultValue: 'Zobrazit mapu' })}</button>
      </div>
      {composition.length === 0 ? (
        <div className="flex h-[240px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#e3e8ec] dark:border-slate-800 bg-[#fbfcfd] dark:bg-slate-900/50 px-6 text-center text-[13px] leading-6 text-[#6a7380] dark:text-slate-400">
          {t('rebuild.recruiter.composition_empty', { defaultValue: 'Composition will be displayed after collecting data.' })}
        </div>
      ) : (
        <div className="grid gap-8 items-center md:grid-cols-[180px_1fr]">
          <div className="flex justify-center">
            <div className="relative h-[160px] w-[160px] rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
              <div className="absolute inset-[30px] rounded-full bg-white dark:bg-slate-800 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold dark:text-slate-100">32</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('rebuild.recruiter.members_unit', { defaultValue: 'members' })}</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {composition.map((slice) => (
              <div key={slice.id} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-slate-600 dark:text-slate-300">{slice.label}</span>
                </div>
                <span className="text-slate-900 dark:text-slate-100">{slice.value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const RecruiterActionStrip: React.FC<{
  navigate: (path: string) => void;
  hasLiveSignals: boolean;
  t: TFunction;
}> = ({ navigate, hasLiveSignals, t }) => (
  <section className="rounded-[28px] border border-[#e8ded1] dark:border-slate-800 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.4))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.7),rgba(15,23,42,0.4))] p-8 shadow-sm backdrop-blur-xl">
    <div className="flex flex-wrap items-center justify-between gap-8">
      <div className="flex items-center gap-6 min-w-0 flex-1">
        <div className="h-16 w-16 shrink-0 rounded-[22px] bg-[linear-gradient(135deg,#74a2f5,var(--shell-accent-cyan))] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="text-white" size={24} />
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-[#111827] dark:text-slate-100">{t('rebuild.recruiter.cybershaman_advises', { defaultValue: 'Cybershaman advises you' })}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-6 max-w-2xl">
            {hasLiveSignals
              ? t('rebuild.recruiter.advice_live', { defaultValue: 'New recommendations are calculated from candidate responses, roles, and company signals in real time.' })
              : t('rebuild.recruiter.advice_empty', { defaultValue: 'As soon as you create the first role and responses arrive, specific cognitive recommendations for hiring will appear here.' })}
            </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/recruiter/talent-pool')} className="rounded-[16px] border border-[#e8ded1] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-medium text-[#273243] dark:text-slate-300 shadow-sm transition hover:border-[#d9c39a] dark:hover:border-amber-700 hover:text-[#a96817] dark:hover:text-amber-400">
          {t('rebuild.recruiter.search_talents', { defaultValue: 'Hledat talenty' })}
        </button>
        <button type="button" onClick={() => navigate('/recruiter/roles')} className="rounded-[16px] bg-[#f6d999] px-6 py-3 text-sm font-semibold text-[#4a3515] shadow-sm transition hover:bg-[#f3d58c]">
          {t('rebuild.recruiter.create_challenge', { defaultValue: '+ Create challenge' })}
        </button>
      </div>
    </div>
  </section>
);

export const RecruiterDashboardV2: React.FC<{
  navigate: (path: string) => void;
  userProfile: UserProfile;
  recruiterCompany: { id?: string; name?: string } | null;
  roles: Role[];
  blueprintLibrary: HandshakeBlueprint[];
  candidateInsights: CandidateInsight[];
  dashboardMetrics: RecruiterMetrics;
  onSignOut: () => void;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  t: TFunction;
}> = ({
  navigate,
  userProfile,
  recruiterCompany,
  roles,
  blueprintLibrary,
  candidateInsights,
  dashboardMetrics,
  onSignOut,
  currentLanguage,
  onLanguageChange,
  t,
}) => {
    const navItems = [
      { id: 'dashboard', label: t('rebuild.recruiter.nav_dashboard', { defaultValue: 'Overview' }), icon: LayoutDashboard, path: '/recruiter' },
      { id: 'roles', label: t('rebuild.recruiter.nav_roles', { defaultValue: 'Roles' }), icon: Briefcase, path: '/recruiter/roles' },
      { id: 'talent-pool', label: t('rebuild.recruiter.nav_candidates', { defaultValue: 'Candidates' }), icon: Users, path: '/recruiter/talent-pool' },
      { id: 'settings', label: t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Company profile' }), icon: Settings2, path: '/recruiter/settings' },
    ];
    const vm = React.useMemo(
      () => buildRecruiterDashboardViewModel(roles, candidateInsights, blueprintLibrary, dashboardMetrics, t),
      [blueprintLibrary, candidateInsights, dashboardMetrics, roles],
    );
    const [v2Dashboard, setV2Dashboard] = React.useState<V2CompanyDashboardPayload | null>(null);
    const [v2DashboardLoaded, setV2DashboardLoaded] = React.useState(false);

    React.useEffect(() => {
      let cancelled = false;
      const companyId = recruiterCompany?.id;
      if (!companyId) {
        setV2Dashboard(null);
        setV2DashboardLoaded(false);
        return;
      }
      setV2DashboardLoaded(false);
      void fetchV2CompanyDashboard(companyId).then((payload) => {
        if (!cancelled) {
          setV2Dashboard(payload);
          setV2DashboardLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [recruiterCompany?.id]);

    const dashboardVm = React.useMemo(() => {
      const emptyVm = {
        ...vm,
        metrics: [
          { id: 'active_roles', label: t('rebuild.recruiter.metric_active_roles', { defaultValue: 'Active roles' }), value: '0', delta: v2DashboardLoaded ? t('rebuild.recruiter.no_data_yet', { defaultValue: 'No data yet' }) : t('rebuild.recruiter.loading_data', { defaultValue: 'Loading data' }), tone: 'neutral' as const },
          { id: 'candidates', label: t('rebuild.recruiter.metric_candidates', { defaultValue: 'Candidates in play' }), value: '0', delta: v2DashboardLoaded ? t('rebuild.recruiter.no_data_yet', { defaultValue: 'No data yet' }) : t('rebuild.recruiter.loading_data', { defaultValue: 'Loading data' }), tone: 'blue' as const },
          { id: 'handshake', label: t('rebuild.recruiter.metric_responses', { defaultValue: 'Responses in process' }), value: '0', delta: v2DashboardLoaded ? t('rebuild.recruiter.no_data_yet', { defaultValue: 'No data yet' }) : t('rebuild.recruiter.loading_data', { defaultValue: 'Loading data' }), tone: 'orange' as const },
          { id: 'success', label: t('rebuild.recruiter.metric_hire_success', { defaultValue: 'Hire success' }), value: '0%', delta: v2DashboardLoaded ? t('rebuild.recruiter.no_data_yet', { defaultValue: 'No data yet' }) : t('rebuild.recruiter.loading_data', { defaultValue: 'Loading data' }), tone: 'green' as const },
          { id: 'resonance', label: t('rebuild.recruiter.metric_team_resonance', { defaultValue: 'Team resonance' }), value: '0%', delta: v2DashboardLoaded ? t('rebuild.recruiter.no_data_yet', { defaultValue: 'No data yet' }) : t('rebuild.recruiter.loading_data', { defaultValue: 'Loading data' }), tone: 'blue' as const },
        ],
        radarMetrics: [],
        activeRoles: [],
        resonance: [],
        topCandidates: [],
        pipeline: [],
        composition: [],
        tip: '',
      };
      if (!v2DashboardLoaded) return emptyVm;
      if (!v2Dashboard) {
        return emptyVm;
      }
      return {
        ...vm,
        metrics: [
          { id: 'active_roles', label: t('rebuild.recruiter.metric_active_roles', { defaultValue: 'Active roles' }), value: String(v2Dashboard.metrics.active_roles), delta: t('rebuild.recruiter.active_count', { defaultValue: '▲ {{count}} active', count: Math.max(0, v2Dashboard.metrics.active_roles) }), tone: 'neutral' as const },
          { id: 'candidates', label: t('rebuild.recruiter.metric_candidates', { defaultValue: 'Candidates in play' }), value: String(v2Dashboard.metrics.candidates), delta: t('rebuild.recruiter.in_progress_count', { defaultValue: '▲ {{count}} in progress', count: v2Dashboard.metrics.sandbox_sessions }), tone: 'blue' as const },
          { id: 'handshake', label: t('rebuild.recruiter.metric_responses', { defaultValue: 'Responses in process' }), value: String(v2Dashboard.metrics.handshakes_in_process), delta: t('rebuild.recruiter.submitted_count', { defaultValue: '▲ {{count}} submitted', count: v2Dashboard.metrics.submitted }), tone: 'orange' as const },
          { id: 'success', label: t('rebuild.recruiter.metric_hire_success', { defaultValue: 'Hire success' }), value: `${v2Dashboard.metrics.hire_success}%`, delta: t('rebuild.recruiter.avg_rating', { defaultValue: '▲ {{rating}} avg rating', rating: v2Dashboard.metrics.average_evaluation || 0 }), tone: 'green' as const },
          { id: 'resonance', label: t('rebuild.recruiter.metric_team_resonance', { defaultValue: 'Team resonance' }), value: `${v2Dashboard.metrics.team_resonance}%`, delta: t('rebuild.recruiter.completed_count', { defaultValue: '▲ {{count}} completed', count: v2Dashboard.metrics.sandbox_completed }), tone: 'blue' as const },
        ],
        radarMetrics: v2Dashboard.radar_metrics,
        activeRoles: v2Dashboard.active_roles,
        resonance: v2Dashboard.resonance,
        topCandidates: v2Dashboard.top_candidates.length > 0
          ? v2Dashboard.top_candidates.map((candidate, index) => ({
            id: candidate.handshake_id || candidate.id,
            name: candidate.candidate_name || candidate.candidateName || t('rebuild.recruiter.candidate_n', { defaultValue: 'Candidate {{n}}', n: index + 1 }),
            role: candidate.headline || candidate.status,
            score: candidate.score || candidate.matchPercent || 0,
            avatarSeed: String(index + 1),
          }))
          : [],
        pipeline: v2Dashboard.pipeline,
        composition: v2Dashboard.composition,
        tip: v2Dashboard.tip || '',
      };
    }, [v2Dashboard, v2DashboardLoaded, vm]);
    const hasLiveSignals = Boolean(v2Dashboard && (
      v2Dashboard.metrics.active_roles > 0
      || v2Dashboard.metrics.candidates > 0
      || v2Dashboard.metrics.handshakes_in_process > 0
      || v2Dashboard.metrics.sandbox_sessions > 0
    ));

    return (
      <DashboardLayoutV2
        userRole="recruiter"
        navItems={navItems}
        activeItemId="dashboard"
        onNavigate={(_id, path) => { if (path) navigate(path); }}
        userProfile={userProfile}
        onSignOut={onSignOut}
        onPrimaryActionClick={() => navigate('/recruiter/roles')}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        title={t('rebuild.recruiter.v2_greeting', { defaultValue: `Welcome, ${userProfile.name?.split(' ')[0] || 'User'}` })}
        subtitle={t('rebuild.recruiter.v2_subtitle', { defaultValue: 'Overview of talents, projects, and team resonance in your organization.' })}
        t={t}
      >
        <div className="mt-7 grid gap-4 xl:grid-cols-5">
          {dashboardVm.metrics.map((metric) => (
            <RecruiterMetricCard key={metric.id} label={metric.label} value={metric.value} delta={metric.delta} tone={metric.tone} />
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.35fr)_minmax(360px,0.95fr)]">
          <RecruiterRadarCard metrics={dashboardVm.radarMetrics} t={t} />
          <ActiveRolesCard roles={dashboardVm.activeRoles} t={t} />
          <ResonanceCard resonance={dashboardVm.resonance} tip={dashboardVm.tip} t={t} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(0,1fr)]">
          <TopCandidatesCard candidates={dashboardVm.topCandidates} t={t} />
          <PipelineCard pipeline={dashboardVm.pipeline} t={t} />
          <CompositionCard composition={dashboardVm.composition} t={t} />
        </div>

        <div className="mt-4">
          <RecruiterActionStrip navigate={navigate} hasLiveSignals={hasLiveSignals} t={t} />
        </div>
      </DashboardLayoutV2>
    );
  };
