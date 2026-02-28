import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Building2,
  Download,
  Globe,
  Layers,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types';
import { BACKEND_URL } from '../constants';
import {
  adminSearch,
  createAdminJobRole,
  deleteAdminJobRole,
  getAdminAiQuality,
  getAdminJobRoles,
  getAdminNotifications,
  getAdminStats,
  getAdminSubscriptions,
  updateAdminJobRole,
  updateAdminSubscription,
} from '../services/adminService';
import { useTranslation } from 'react-i18next';

interface AdminDashboardProps {
  userProfile: UserProfile;
}

type ViewMode = 'overview' | 'operations' | 'jcfpm';

const TIERS = ['free', 'premium', 'starter', 'growth', 'professional', 'trial', 'enterprise'];
const STATUSES = ['active', 'trialing', 'inactive', 'canceled'];

const num = (value: any) => Number(value) || 0;

const MiniBars: React.FC<{ values: number[]; color?: string }> = ({ values, color = 'bg-cyan-500' }) => {
  const max = Math.max(1, ...values, 1);
  return (
    <div className="flex h-10 items-end gap-1">
      {values.map((v, idx) => {
        const height = Math.max(4, Math.round((v / max) * 40));
        return <div key={idx} className={`w-2 rounded-sm ${color}`} style={{ height }} />;
      })}
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ userProfile }) => {
  const { t, i18n } = useTranslation();

  const [view, setView] = useState<ViewMode>('overview');
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any | null>(null);
  const [aiQuality, setAiQuality] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [totalSubscriptions, setTotalSubscriptions] = useState(0);
  const [subFilters, setSubFilters] = useState({ q: '', tier: '', status: '', kind: '', limit: 25, offset: 0 });
  const [edits, setEdits] = useState<Record<string, any>>({});

  const [searchKind, setSearchKind] = useState<'company' | 'user'>('company');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [jobRoles, setJobRoles] = useState<any[]>([]);
  const [jobRolesQuery, setJobRolesQuery] = useState('');
  const [jobRoleEdits, setJobRoleEdits] = useState<Record<string, any>>({});
  const [jobRoleCreate, setJobRoleCreate] = useState({
    title: '', d1: '', d2: '', d3: '', d4: '', d5: '', d6: '',
    salary_range: '', growth_potential: '', ai_impact: '', ai_intensity: 'medium', remote_friendly: '',
  });

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatNumber = (value?: number) => new Intl.NumberFormat(i18n.language).format(value || 0);
  const formatPercent = (value?: number) => `${num(value).toFixed(2)}%`;
  const formatUsd = (value?: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(num(value));

  const handleAuthError = (message: string) => {
    const lower = String(message || '').toLowerCase();
    if (lower.includes('admin') || lower.includes('forbidden') || lower.includes('403')) {
      setForbidden(true);
    } else {
      setError(message || 'Operation failed');
    }
  };

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [statsData, aiData, notifData] = await Promise.all([
        getAdminStats(),
        getAdminAiQuality(30),
        getAdminNotifications(7),
      ]);
      setStats(statsData || null);
      setAiQuality(aiData || null);
      setNotifications(notifData?.items || []);
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const data = await getAdminSubscriptions({
        q: subFilters.q || undefined,
        tier: subFilters.tier || undefined,
        status: subFilters.status || undefined,
        kind: (subFilters.kind as any) || undefined,
        limit: subFilters.limit,
        offset: subFilters.offset,
      });
      setSubscriptions(data.items || []);
      setTotalSubscriptions(data.count || 0);
      const nextEdits: Record<string, any> = {};
      (data.items || []).forEach((sub: any) => {
        nextEdits[sub.id] = {
          tier: sub.tier || 'free',
          status: sub.status || 'inactive',
          set_trial_days: '',
        };
      });
      setEdits(nextEdits);
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to load subscriptions');
    }
  };

  const loadJobRoles = async () => {
    try {
      const data = await getAdminJobRoles({ q: jobRolesQuery || undefined, limit: 200, offset: 0 });
      const items = data.items || [];
      setJobRoles(items);
      const next: Record<string, any> = {};
      items.forEach((role: any) => {
        next[role.id] = {
          title: role.title || '', d1: role.d1 ?? '', d2: role.d2 ?? '', d3: role.d3 ?? '',
          d4: role.d4 ?? '', d5: role.d5 ?? '', d6: role.d6 ?? '', salary_range: role.salary_range || '',
          growth_potential: role.growth_potential || '', ai_impact: role.ai_impact || '',
          ai_intensity: role.ai_intensity || 'medium', remote_friendly: role.remote_friendly || '',
        };
      });
      setJobRoleEdits(next);
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to load JCFPM roles');
    }
  };

  useEffect(() => {
    if (!userProfile?.isLoggedIn) return;
    loadOverview();
  }, [userProfile?.isLoggedIn]);

  useEffect(() => {
    if (!userProfile?.isLoggedIn || view !== 'operations') return;
    loadSubscriptions();
  }, [userProfile?.isLoggedIn, view, subFilters.q, subFilters.tier, subFilters.status, subFilters.kind, subFilters.limit, subFilters.offset]);

  useEffect(() => {
    if (!userProfile?.isLoggedIn || view !== 'jcfpm') return;
    loadJobRoles();
  }, [userProfile?.isLoggedIn, view, jobRolesQuery]);

  const kpis = useMemo(() => {
    const users = stats?.users || {};
    const companies = stats?.companies || {};
    const conv = stats?.conversion || {};
    const ai = aiQuality?.summary || {};
    return [
      { label: 'Users', value: formatNumber(users.total), hint: `+${formatNumber(users.new_30d)} / 30d`, icon: Users },
      { label: 'Companies', value: formatNumber(companies.total), hint: `+${formatNumber(companies.new_30d)} / 30d`, icon: Building2 },
      { label: 'Paid Conversion', value: `${formatPercent(conv.company_paid_percent)} / ${formatPercent(conv.user_paid_percent)}`, hint: 'Company / User', icon: Activity },
      { label: 'AI Generations', value: formatNumber(ai.total_generations), hint: `${formatNumber(ai.ai_unique_users)} unique AI users`, icon: Brain },
      { label: 'AI Cost', value: formatUsd(ai.total_estimated_cost), hint: `Avg ${formatUsd(ai.avg_estimated_cost_per_generation)}`, icon: Sparkles },
      { label: 'Apply Uplift', value: formatPercent(ai.conversion_impact_on_applications), hint: `AI ${formatPercent(ai.ai_apply_rate)} vs baseline ${formatPercent(ai.baseline_apply_rate)}`, icon: BarChart3 },
    ];
  }, [stats, aiQuality]);

  const trafficSeries = useMemo(() => {
    const daily = stats?.traffic?.daily || [];
    const normalized = daily.map((d: any) => ({
      day: String(d.day || '').slice(5, 10),
      pageviews: num(d.pageviews),
      visitors: num(d.unique_visitors),
      sessions: num(d.sessions),
    }));
    return normalized.slice(-14);
  }, [stats]);

  const tokenTrend = useMemo(() => {
    const rows = aiQuality?.token_usage_trend || [];
    return [...rows]
      .reverse()
      .slice(-14)
      .map((r: any) => ({
        day: String(r.day || '').slice(5, 10),
        tokens: num(r.tokens_in) + num(r.tokens_out),
      }));
  }, [aiQuality]);

  const topCountries = stats?.traffic?.geo?.top_countries || [];
  const topDevices = stats?.traffic?.geo?.top_devices || [];
  const modelUsage = aiQuality?.usage_by_model || [];
  const ctrByModel = aiQuality?.ctr_by_model_version || [];
  const ctrByScoring = aiQuality?.ctr_by_scoring_version || [];
  const scoreDistribution = aiQuality?.score_distribution || { lt_40: 0, '40_60': 0, '60_80': 0, gte_80: 0 };
  const strategyCounts = aiQuality?.selection_strategy_counts || {};

  const exportInvestorPack = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      kpis,
      traffic: {
        summary: stats?.traffic || null,
        trend_14d: trafficSeries,
        top_countries: topCountries,
        top_devices: topDevices,
      },
      ai: {
        summary: aiQuality?.summary || null,
        token_trend_14d: tokenTrend,
        usage_by_model: modelUsage,
        ctr_by_model: ctrByModel,
        ctr_by_scoring: ctrByScoring,
        score_distribution: scoreDistribution,
        selection_strategy_counts: strategyCounts,
      },
      notifications,
    };

    const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `jobshaman_admin_pack_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);

    const csvRows = [
      ['metric', 'value'],
      ['users_total', stats?.users?.total || 0],
      ['companies_total', stats?.companies?.total || 0],
      ['company_paid_percent', num(stats?.conversion?.company_paid_percent).toFixed(2)],
      ['user_paid_percent', num(stats?.conversion?.user_paid_percent).toFixed(2)],
      ['ai_generations', aiQuality?.summary?.total_generations || 0],
      ['ai_unique_users', aiQuality?.summary?.ai_unique_users || 0],
      ['ai_total_estimated_cost', num(aiQuality?.summary?.total_estimated_cost).toFixed(6)],
      ['apply_uplift_percent', num(aiQuality?.summary?.conversion_impact_on_applications).toFixed(2)],
      ['schema_pass_rate_percent', num(aiQuality?.summary?.schema_pass_rate).toFixed(2)],
      ['fallback_rate_percent', num(aiQuality?.summary?.fallback_rate).toFixed(2)],
    ];

    const csv = csvRows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement('a');
    csvLink.href = csvUrl;
    csvLink.download = `jobshaman_admin_kpis_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(csvLink);
    csvLink.click();
    document.body.removeChild(csvLink);
    URL.revokeObjectURL(csvUrl);
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const data = await adminSearch(searchQuery.trim(), searchKind);
      setSearchResults(data.items || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSaveSubscription = async (sub: any) => {
    const edit = edits[sub.id] || {};
    const payload: any = { subscription_id: sub.id };
    if (edit.tier && edit.tier !== sub.tier) payload.tier = edit.tier;
    if (edit.status && edit.status !== sub.status) payload.status = edit.status;
    if (edit.set_trial_days) payload.set_trial_days = Number(edit.set_trial_days);
    if (Object.keys(payload).length <= 1) return;
    try {
      await updateAdminSubscription(payload);
      await loadSubscriptions();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to save subscription');
    }
  };

  const handleCreateRole = async () => {
    try {
      await createAdminJobRole({
        title: jobRoleCreate.title.trim(),
        d1: Number(jobRoleCreate.d1),
        d2: Number(jobRoleCreate.d2),
        d3: Number(jobRoleCreate.d3),
        d4: Number(jobRoleCreate.d4),
        d5: Number(jobRoleCreate.d5),
        d6: Number(jobRoleCreate.d6),
        salary_range: jobRoleCreate.salary_range || undefined,
        growth_potential: jobRoleCreate.growth_potential || undefined,
        ai_impact: jobRoleCreate.ai_impact || undefined,
        ai_intensity: jobRoleCreate.ai_intensity || undefined,
        remote_friendly: jobRoleCreate.remote_friendly || undefined,
      });
      setJobRoleCreate({
        title: '', d1: '', d2: '', d3: '', d4: '', d5: '', d6: '',
        salary_range: '', growth_potential: '', ai_impact: '', ai_intensity: 'medium', remote_friendly: '',
      });
      await loadJobRoles();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to create role');
    }
  };

  const handleUpdateRole = async (roleId: string) => {
    const draft = jobRoleEdits[roleId];
    if (!draft) return;
    try {
      await updateAdminJobRole(roleId, {
        title: draft.title?.trim(),
        d1: draft.d1 !== '' ? Number(draft.d1) : undefined,
        d2: draft.d2 !== '' ? Number(draft.d2) : undefined,
        d3: draft.d3 !== '' ? Number(draft.d3) : undefined,
        d4: draft.d4 !== '' ? Number(draft.d4) : undefined,
        d5: draft.d5 !== '' ? Number(draft.d5) : undefined,
        d6: draft.d6 !== '' ? Number(draft.d6) : undefined,
        salary_range: draft.salary_range || undefined,
        growth_potential: draft.growth_potential || undefined,
        ai_impact: draft.ai_impact || undefined,
        ai_intensity: draft.ai_intensity || undefined,
        remote_friendly: draft.remote_friendly || undefined,
      });
      await loadJobRoles();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      await deleteAdminJobRole(roleId);
      await loadJobRoles();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to delete role');
    }
  };

  if (!userProfile?.isLoggedIn) {
    return (
      <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('admin_dashboard.auth.admin_zone')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('admin_dashboard.auth.login_required')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="rounded-3xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-8 text-center">
            <h2 className="text-2xl font-black text-rose-700 dark:text-rose-300">{t('admin_dashboard.auth.access_denied')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('admin_dashboard.auth.no_admin_rights')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold mb-2">
                <Layers size={14} />
                Executive Analytics Cockpit
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Traffic, AI performance, recommendation outcomes, and operational controls in one view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadOverview}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors"
              >
                <RefreshCcw size={15} /> Refresh
              </button>
              <button
                onClick={exportInvestorPack}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
              >
                <Download size={15} /> Export Pack
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch(`${BACKEND_URL}/healthz`);
                  } catch {
                    // noop
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                <Activity size={15} /> Backend ping
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {([
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'operations', label: 'Operations', icon: Settings },
              { id: 'jcfpm', label: 'JCFPM Role Lab', icon: Sparkles },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-cyan-600'}`}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </section>

        {view === 'overview' && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <article key={kpi.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{kpi.label}</div>
                      <Icon size={16} className="text-cyan-600" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</div>
                    <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>
                  </article>
                );
              })}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-cyan-600" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Traffic Trend (14 days)</h3>
                </div>
                {loading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                  <>
                    <MiniBars values={trafficSeries.map((x: any) => x.pageviews)} />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <div>Latest pageviews: <span className="font-semibold">{formatNumber(trafficSeries[trafficSeries.length - 1]?.pageviews || 0)}</span></div>
                      <div>Latest visitors: <span className="font-semibold">{formatNumber(trafficSeries[trafficSeries.length - 1]?.visitors || 0)}</span></div>
                    </div>
                  </>
                )}
              </article>

              <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} className="text-cyan-600" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">AI Token Trend (14 days)</h3>
                </div>
                {loading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : (
                  <>
                    <MiniBars values={tokenTrend.map((x: any) => x.tokens)} color="bg-emerald-500" />
                    <p className="mt-3 text-xs text-slate-500">
                      Schema pass rate: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatPercent(aiQuality?.summary?.schema_pass_rate)}</span>
                      {' '}• Fallback rate: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatPercent(aiQuality?.summary?.fallback_rate)}</span>
                    </p>
                  </>
                )}
              </article>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm xl:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={16} className="text-cyan-600" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Recommendation Performance</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <div className="font-semibold mb-2">CTR by model version</div>
                    <div className="space-y-1 max-h-44 overflow-auto pr-1">
                      {ctrByModel.length === 0 && <p className="text-xs text-slate-500">No data</p>}
                      {ctrByModel.map((row: any) => (
                        <div key={row.model_version} className="flex items-center justify-between text-xs">
                          <span className="truncate mr-2">{row.model_version}</span>
                          <span className="font-semibold">{formatPercent(row.ctr_apply)} ({formatNumber(row.applies)}/{formatNumber(row.exposures)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <div className="font-semibold mb-2">CTR by scoring version</div>
                    <div className="space-y-1 max-h-44 overflow-auto pr-1">
                      {ctrByScoring.length === 0 && <p className="text-xs text-slate-500">No data</p>}
                      {ctrByScoring.map((row: any) => (
                        <div key={row.scoring_version} className="flex items-center justify-between text-xs">
                          <span className="truncate mr-2">{row.scoring_version}</span>
                          <span className="font-semibold">{formatPercent(row.ctr_apply)} ({formatNumber(row.applies)}/{formatNumber(row.exposures)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={16} className="text-cyan-600" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Anonymous User Decisions</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between"><span>Score &lt; 40</span><span className="font-semibold">{formatNumber(scoreDistribution.lt_40)}</span></div>
                  <div className="flex items-center justify-between"><span>Score 40-60</span><span className="font-semibold">{formatNumber(scoreDistribution['40_60'])}</span></div>
                  <div className="flex items-center justify-between"><span>Score 60-80</span><span className="font-semibold">{formatNumber(scoreDistribution['60_80'])}</span></div>
                  <div className="flex items-center justify-between"><span>Score ≥ 80</span><span className="font-semibold">{formatNumber(scoreDistribution.gte_80)}</span></div>
                </div>
                <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="text-xs font-semibold mb-2">Selection Strategy</div>
                  <div className="space-y-1 text-xs">
                    {Object.keys(strategyCounts).length === 0 && <p className="text-slate-500">No data</p>}
                    {Object.entries(strategyCounts).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between"><span>{k}</span><span className="font-semibold">{formatNumber(Number(v))}</span></div>
                    ))}
                  </div>
                </div>
              </article>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="font-semibold mb-3">Top Countries</div>
                <div className="space-y-1 text-xs">
                  {topCountries.length === 0 && <p className="text-slate-500">No data</p>}
                  {topCountries.map((row: any) => (
                    <div key={row.label} className="flex items-center justify-between"><span>{row.label}</span><span className="font-semibold">{formatNumber(row.count)}</span></div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="font-semibold mb-3">Top Devices</div>
                <div className="space-y-1 text-xs">
                  {topDevices.length === 0 && <p className="text-slate-500">No data</p>}
                  {topDevices.map((row: any) => (
                    <div key={row.label} className="flex items-center justify-between"><span>{row.label}</span><span className="font-semibold">{formatNumber(row.count)}</span></div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="font-semibold mb-3">Top AI Models by Cost</div>
                <div className="space-y-1 text-xs max-h-36 overflow-auto pr-1">
                  {modelUsage.length === 0 && <p className="text-slate-500">No data</p>}
                  {modelUsage.map((row: any) => (
                    <div key={row.model} className="flex items-center justify-between">
                      <span className="truncate mr-2">{row.model}</span>
                      <span className="font-semibold">{formatUsd(row.estimated_cost)}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={16} className="text-cyan-600" />
                <h3 className="font-semibold">Notifications (expiring trials)</h3>
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming trial expirations in selected window.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {notifications.slice(0, 9).map((n: any) => (
                    <div key={n.subscription_id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{n.company_name || n.user_email || n.subscription_id}</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${n.severity === 'expired' ? 'bg-rose-100 text-rose-700' : n.severity === 'today' ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'}`}>{n.severity}</span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">{formatDate(n.current_period_end)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view === 'operations' && (
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <article className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Subscription Operations</h3>
                <span className="text-xs text-slate-500">{formatNumber(totalSubscriptions)} total</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
                <input
                  value={subFilters.q}
                  onChange={(e) => setSubFilters((prev) => ({ ...prev, q: e.target.value, offset: 0 }))}
                  placeholder="Search company/user/subscription"
                  className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
                <select value={subFilters.tier} onChange={(e) => setSubFilters((prev) => ({ ...prev, tier: e.target.value, offset: 0 }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                  <option value="">All tiers</option>
                  {TIERS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <select value={subFilters.status} onChange={(e) => setSubFilters((prev) => ({ ...prev, status: e.target.value, offset: 0 }))} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                  <option value="">All statuses</option>
                  {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <button onClick={loadSubscriptions} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">Refresh</button>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {subscriptions.map((sub: any) => (
                  <div key={sub.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center text-xs">
                      <div className="md:col-span-2">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{sub.companies?.name || sub.profiles?.full_name || sub.profiles?.email || sub.id}</div>
                        <div className="text-slate-500">{sub.company_id ? 'Company' : 'User'} • {formatDate(sub.current_period_end)}</div>
                      </div>
                      <select
                        value={edits[sub.id]?.tier || sub.tier || 'free'}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], tier: e.target.value } }))}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                      >
                        {TIERS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <select
                        value={edits[sub.id]?.status || sub.status || 'inactive'}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], status: e.target.value } }))}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                      >
                        {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <input
                        value={edits[sub.id]?.set_trial_days || ''}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], set_trial_days: e.target.value } }))}
                        placeholder="trial days"
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                      />
                      <button
                        onClick={() => handleSaveSubscription(sub)}
                        className="rounded-lg bg-emerald-600 px-2 py-1.5 font-semibold text-white hover:bg-emerald-500"
                      >Save</button>
                    </div>
                  </div>
                ))}
                {!subscriptions.length && <p className="text-sm text-slate-500">No subscription records found.</p>}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h3 className="font-semibold mb-3">Admin Search</h3>
              <div className="space-y-2">
                <select
                  value={searchKind}
                  onChange={(e) => setSearchKind(e.target.value as 'company' | 'user')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  <option value="company">Company</option>
                  <option value="user">User</option>
                </select>
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <button onClick={handleSearch} className="rounded-lg bg-cyan-600 px-3 text-white"><Search size={14} /></button>
                </div>
              </div>
              <div className="mt-3 space-y-2 max-h-80 overflow-auto pr-1">
                {searchLoading && <p className="text-sm text-slate-500">Searching...</p>}
                {!searchLoading && searchResults.map((row: any) => (
                  <div key={`${row.kind}-${row.id}`} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-xs">
                    <div className="font-semibold">{row.label}</div>
                    <div className="text-slate-500">{row.secondary || row.id}</div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {view === 'jcfpm' && (
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <article className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">JCFPM Role Profiles</h3>
                <input
                  value={jobRolesQuery}
                  onChange={(e) => setJobRolesQuery(e.target.value)}
                  placeholder="Search title..."
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
                {jobRoles.map((role: any) => (
                  <div key={role.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="grid grid-cols-2 md:grid-cols-8 gap-2 text-xs items-center">
                      <input
                        value={jobRoleEdits[role.id]?.title || ''}
                        onChange={(e) => setJobRoleEdits((prev) => ({ ...prev, [role.id]: { ...prev[role.id], title: e.target.value } }))}
                        className="md:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                      />
                      {['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((key) => (
                        <input
                          key={key}
                          value={jobRoleEdits[role.id]?.[key] ?? ''}
                          onChange={(e) => setJobRoleEdits((prev) => ({ ...prev, [role.id]: { ...prev[role.id], [key]: e.target.value } }))}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => handleUpdateRole(role.id)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white">Update</button>
                      <button onClick={() => handleDeleteRole(role.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Delete</button>
                    </div>
                  </div>
                ))}
                {!jobRoles.length && <p className="text-sm text-slate-500">No role profiles found.</p>}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h3 className="font-semibold mb-3">Create Role</h3>
              <div className="space-y-2">
                <input value={jobRoleCreate.title} onChange={(e) => setJobRoleCreate((p) => ({ ...p, title: e.target.value }))} placeholder="Title" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  {['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((d) => (
                    <input
                      key={d}
                      value={(jobRoleCreate as any)[d]}
                      onChange={(e) => setJobRoleCreate((p) => ({ ...p, [d]: e.target.value }))}
                      placeholder={d.toUpperCase()}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    />
                  ))}
                </div>
                <input value={jobRoleCreate.salary_range} onChange={(e) => setJobRoleCreate((p) => ({ ...p, salary_range: e.target.value }))} placeholder="Salary range" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                <input value={jobRoleCreate.growth_potential} onChange={(e) => setJobRoleCreate((p) => ({ ...p, growth_potential: e.target.value }))} placeholder="Growth potential" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                <input value={jobRoleCreate.ai_impact} onChange={(e) => setJobRoleCreate((p) => ({ ...p, ai_impact: e.target.value }))} placeholder="AI impact" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                <select value={jobRoleCreate.ai_intensity} onChange={(e) => setJobRoleCreate((p) => ({ ...p, ai_intensity: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
                <select value={jobRoleCreate.remote_friendly} onChange={(e) => setJobRoleCreate((p) => ({ ...p, remote_friendly: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                  <option value="">remote_friendly</option>
                  <option value="yes">yes</option>
                  <option value="hybrid">hybrid</option>
                  <option value="no">no</option>
                </select>
                <button onClick={handleCreateRole} className="w-full rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Create</button>
              </div>
            </article>
          </section>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
