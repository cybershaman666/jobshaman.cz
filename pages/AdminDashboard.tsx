import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BarChart3, RefreshCcw, Search, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { BACKEND_URL } from '../constants';
import { adminSearch, getAdminAiQuality, getAdminNotifications, getAdminPushSubscriptions, getAdminStats, getAdminSubscriptionAudit, getAdminSubscriptions, getAdminUserDigest, updateAdminSubscription, updateAdminUserDigest } from '../services/adminService';
import { useTranslation } from 'react-i18next';

interface AdminDashboardProps {
  userProfile: UserProfile;
}

const TIERS = [
  'free',
  'premium',
  'basic',
  'professional',
  'trial',
  'enterprise',
  'assessment_bundle',
  'single_assessment'
];

const STATUSES = ['active', 'trialing', 'inactive', 'canceled'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ userProfile }) => {
  const { t, i18n } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingAiQuality, setLoadingAiQuality] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [aiQuality, setAiQuality] = useState<any | null>(null);
  const [searchKind, setSearchKind] = useState<'company' | 'user'>('company');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showTrafficDetails, setShowTrafficDetails] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [digestUser, setDigestUser] = useState<any | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [pushSubs, setPushSubs] = useState<any[]>([]);
  const [pushSubsLoading, setPushSubsLoading] = useState(false);
  const [pushSubsQuery, setPushSubsQuery] = useState('');
  const [mailingQuery, setMailingQuery] = useState('');
  const [mailingResults, setMailingResults] = useState<any[]>([]);
  const [mailingLoading, setMailingLoading] = useState(false);
  const [wakeStatus, setWakeStatus] = useState<'idle' | 'ok' | 'error' | 'loading'>('idle');

  const [filters, setFilters] = useState({
    q: '',
    tier: '',
    status: '',
    kind: '',
    limit: 50,
    offset: 0
  });
  const [searchInput, setSearchInput] = useState('');
  const [total, setTotal] = useState(0);

  const [edits, setEdits] = useState<Record<string, any>>({});
  const [createForm, setCreateForm] = useState({
    target_type: 'company',
    target_id: '',
    tier: 'professional',
    status: 'active',
    set_trial_days: '14'
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters(prev => ({ ...prev, q: searchInput, offset: 0 }));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const loadSubscriptions = async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await getAdminSubscriptions({
        q: filters.q || undefined,
        tier: filters.tier || undefined,
        status: filters.status || undefined,
        kind: (filters.kind as any) || undefined,
        limit: filters.limit,
        offset: filters.offset
      });
      setSubscriptions(data.items || []);
      setTotal(data.count || 0);
      const nextEdits: Record<string, any> = {};
      (data.items || []).forEach((sub: any) => {
        nextEdits[sub.id] = {
          tier: sub.tier || 'free',
          status: sub.status || 'inactive',
          set_trial_days: '',
          set_trial_until: ''
        };
      });
      setEdits(nextEdits);
    } catch (err: any) {
      const message = err?.message || t('admin_dashboard.errors.load_failed');
      if (message.toLowerCase().includes('admin') || message.toLowerCase().includes('forbidden')) {
        setForbidden(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const data = await getAdminNotifications(7);
      setNotifications(data.items || []);
    } catch (err) {
      // Silence notifications errors for now
    } finally {
      setLoadingNotifications(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadAiQuality = async () => {
    setLoadingAiQuality(true);
    try {
      const data = await getAdminAiQuality(30);
      setAiQuality(data);
    } catch (err) {
      setAiQuality(null);
    } finally {
      setLoadingAiQuality(false);
    }
  };

  const loadPushSubscriptions = async () => {
    setPushSubsLoading(true);
    try {
      const data = await getAdminPushSubscriptions({
        q: pushSubsQuery || undefined,
        limit: 100,
        offset: 0,
        activeOnly: true
      });
      setPushSubs(data.items || []);
    } catch (err) {
      setPushSubs([]);
    } finally {
      setPushSubsLoading(false);
    }
  };

  const handleMailingSearch = async () => {
    if (mailingQuery.trim().length < 2) {
      setMailingResults([]);
      return;
    }
    setMailingLoading(true);
    try {
      const data = await adminSearch(mailingQuery.trim(), 'user');
      setMailingResults(data.items || []);
    } catch (err) {
      setMailingResults([]);
    } finally {
      setMailingLoading(false);
    }
  };

  const handleWakeBackend = async () => {
    setWakeStatus('loading');
    try {
      const response = await fetch(`${BACKEND_URL}/healthz`, { method: 'GET' });
      setWakeStatus(response.ok ? 'ok' : 'error');
    } catch {
      setWakeStatus('error');
    }
  };

  const exportPushCsv = () => {
    if (pushSubs.length === 0) return;
    const header = ['name', 'email', 'updated_at', 'user_agent'];
    const rows = pushSubs.map((row: any) => ([
      (row.profiles?.full_name || '').replaceAll('"', '""'),
      (row.profiles?.email || '').replaceAll('"', '""'),
      row.updated_at || '',
      (row.user_agent || '').replaceAll('"', '""')
    ]));
    const csv = [header, ...rows]
      .map(line => line.map(value => `"${value}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `push_subscriptions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadAudit = async (subscriptionId: string) => {
    setLoadingAudit(true);
    try {
      const data = await getAdminSubscriptionAudit(subscriptionId, 50);
      setAuditLogs(data.items || []);
    } catch (err) {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (userProfile?.isLoggedIn) {
      loadSubscriptions();
      loadNotifications();
      loadStats();
      loadAiQuality();
      loadPushSubscriptions();
      handleWakeBackend();
    }
  }, [filters.q, filters.tier, filters.status, filters.kind, filters.limit, filters.offset, pushSubsQuery, userProfile?.isLoggedIn]);

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatNumber = (value?: number) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat(i18n.language).format(value);
  };

  const formatPercent = (value?: number) => {
    if (value === null || value === undefined) return '—';
    return `${value}%`;
  };
  const formatUsd = (value?: number) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value);
  };

  const getEntityLabel = (sub: any) => {
    if (sub.company_id) {
      return t('admin_dashboard.entity.company');
    }
    return t('admin_dashboard.entity.user');
  };

  const getEntityName = (sub: any) => {
    if (sub.company_id) {
      return sub.companies?.name || sub.company_id;
    }
    return sub.profiles?.full_name || sub.profiles?.email || sub.user_id;
  };

  const getEntityEmail = (sub: any) => {
    return sub.profiles?.email || '—';
  };

  const getChangedFields = (entry: any) => {
    const before = entry.before || {};
    const after = entry.after || {};
    const keys = Object.keys(after || {});
    const changed = keys.filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    return changed.slice(0, 6);
  };

  const stripLocale = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    const locales = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
    if (parts.length > 0 && locales.includes(parts[0])) parts.shift();
    const normalized = `/${parts.join('/')}`;
    return normalized === '/' ? '/' : normalized.replace(/\/$/, '');
  };

  const handleEditChange = (id: string, key: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const handleSave = async (sub: any) => {
    const edit = edits[sub.id] || {};
    const payload: any = { subscription_id: sub.id };
    if (edit.tier && edit.tier !== sub.tier) payload.tier = edit.tier;
    if (edit.status && edit.status !== sub.status) payload.status = edit.status;
    if (edit.set_trial_days) payload.set_trial_days = Number(edit.set_trial_days);
    if (edit.set_trial_until) payload.set_trial_until = edit.set_trial_until;

    if (Object.keys(payload).length <= 1) return;

    try {
      await updateAdminSubscription(payload);
      await loadSubscriptions();
      await loadNotifications();
    } catch (err: any) {
      setError(err?.message || t('admin_dashboard.errors.save_failed'));
    }
  };

  const handleQuickAction = async (sub: any, action: 'trial14' | 'activate' | 'cancel') => {
    try {
      if (action === 'trial14') {
        await updateAdminSubscription({
          subscription_id: sub.id,
          set_trial_days: 14,
          tier: 'trial'
        });
      } else if (action === 'activate') {
        await updateAdminSubscription({
          subscription_id: sub.id,
          status: 'active'
        });
      } else if (action === 'cancel') {
        await updateAdminSubscription({
          subscription_id: sub.id,
          status: 'canceled'
        });
      }
      await loadSubscriptions();
      await loadNotifications();
    } catch (err: any) {
      setError(err?.message || t('admin_dashboard.errors.action_failed'));
    }
  };

  const handleSelect = async (sub: any) => {
    setSelectedSub(sub);
    await loadAudit(sub.id);
  };

  const handleCreateSubscription = async () => {
    if (!createForm.target_id.trim()) {
      setError(t('admin_dashboard.errors.target_required'));
      return;
    }
    try {
      await updateAdminSubscription({
        target_type: createForm.target_type as any,
        target_id: createForm.target_id.trim(),
        tier: createForm.tier,
        status: createForm.status,
        set_trial_days: createForm.set_trial_days ? Number(createForm.set_trial_days) : undefined
      });
      setCreateForm(prev => ({ ...prev, target_id: '' }));
      await loadSubscriptions();
      await loadNotifications();
    } catch (err: any) {
      setError(err?.message || t('admin_dashboard.errors.create_failed'));
    }
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
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadDigestUser = async (userId: string) => {
    setDigestLoading(true);
    setDigestError(null);
    try {
      const data = await getAdminUserDigest(userId);
      setDigestUser(data);
    } catch (err: any) {
      setDigestUser(null);
      setDigestError(err?.message || t('admin_dashboard.errors.digest_load_failed'));
    } finally {
      setDigestLoading(false);
    }
  };

  const saveDigestUser = async () => {
    if (!digestUser?.id) return;
    setDigestSaving(true);
    setDigestError(null);
    try {
      const data = await updateAdminUserDigest(digestUser.id, {
        daily_digest_enabled: Boolean(digestUser.daily_digest_enabled),
        daily_digest_push_enabled: Boolean(digestUser.daily_digest_push_enabled),
        daily_digest_time: digestUser.daily_digest_time,
        daily_digest_timezone: digestUser.daily_digest_timezone
      });
      setDigestUser(data);
    } catch (err: any) {
      setDigestError(err?.message || t('admin_dashboard.errors.digest_save_failed'));
    } finally {
      setDigestSaving(false);
    }
  };

  const paginationLabel = useMemo(() => {
    const start = total === 0 ? 0 : filters.offset + 1;
    const end = Math.min(total, filters.offset + filters.limit);
    return `${start}-${end} / ${total}`;
  }, [filters.offset, filters.limit, total]);

  const trafficSeries = useMemo(() => {
    const raw = stats?.traffic?.daily || [];
    const map = new Map<string, any>();
    raw.forEach((entry: any) => {
      if (!entry?.day) return;
      const key = new Date(entry.day).toISOString().slice(0, 10);
      map.set(key, {
        pageviews: Number(entry.pageviews) || 0,
        unique_visitors: Number(entry.unique_visitors) || 0,
        sessions: Number(entry.sessions) || 0
      });
    });

    const days: any[] = [];
    const today = new Date();
    const totalDays = 14;
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        ...map.get(key),
        pageviews: map.get(key)?.pageviews || 0,
        unique_visitors: map.get(key)?.unique_visitors || 0,
        sessions: map.get(key)?.sessions || 0
      });
    }
    return days;
  }, [stats?.traffic]);

  const maxTrafficPageviews = useMemo(() => {
    if (!trafficSeries.length) return 1;
    return Math.max(...trafficSeries.map(item => item.pageviews || 0), 1);
  }, [trafficSeries]);

  if (!userProfile?.isLoggedIn) {
    return (
      <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-sm relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-40 h-40 bg-cyan-500/10 blur-3xl rounded-full" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t('admin_dashboard.auth.admin_zone')}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin_dashboard.auth.login_required')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-3xl p-8 text-center shadow-sm relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-40 h-40 bg-rose-500/10 blur-3xl rounded-full" />
            <h2 className="text-2xl font-black text-rose-700 dark:text-rose-300 mb-2">{t('admin_dashboard.auth.access_denied')}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin_dashboard.auth.no_admin_rights')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold mb-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                {t('admin_dashboard.header.control')}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{t('admin_dashboard.header.title')}</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                {t('admin_dashboard.header.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  loadSubscriptions();
                  loadNotifications();
                  loadStats();
                  loadAiQuality();
                  loadPushSubscriptions();
                }}
                className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 shadow-sm transition-colors flex items-center gap-2"
              >
                <RefreshCcw size={16} />
                {t('admin_dashboard.actions.refresh_data')}
              </button>
              <button
                onClick={handleWakeBackend}
                className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors flex items-center gap-2"
              >
                <span className={`inline-flex w-2.5 h-2.5 rounded-full ${wakeStatus === 'ok' ? 'bg-emerald-500' : wakeStatus === 'error' ? 'bg-rose-500' : wakeStatus === 'loading' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                {wakeStatus === 'loading' ? t('admin_dashboard.actions.waking') : wakeStatus === 'ok' ? t('admin_dashboard.actions.backend_ok') : t('admin_dashboard.actions.wake_backend')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_dashboard.notifications.title')}</h3>
                <p className="text-xs text-slate-500">{t('admin_dashboard.notifications.subtitle')}</p>
              </div>
            </div>
            {loadingNotifications ? (
              <p className="text-sm text-slate-500">{t('admin_dashboard.common.loading')}</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-slate-500">{t('admin_dashboard.notifications.empty')}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {notifications.map((n: any) => (
                  <div key={n.subscription_id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{n.company_name || n.user_email || n.subscription_id}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${n.severity === 'today' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : n.severity === 'expired' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                        {n.severity === 'today' ? t('admin_dashboard.notifications.severity.today') : n.severity === 'expired' ? t('admin_dashboard.notifications.severity.expired') : t('admin_dashboard.notifications.severity.soon')}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                      {getEntityLabel(n)} · {formatDate(n.current_period_end)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm xl:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_dashboard.create_subscription.title')}</h3>
                <p className="text-xs text-slate-500">{t('admin_dashboard.create_subscription.subtitle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
              <select
                value={createForm.target_type}
                onChange={e => setCreateForm(prev => ({ ...prev, target_type: e.target.value }))}
                className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="company">{t('admin_dashboard.entity.company')}</option>
                <option value="user">{t('admin_dashboard.entity.user')}</option>
              </select>
              <input
                value={createForm.target_id}
                onChange={e => setCreateForm(prev => ({ ...prev, target_id: e.target.value }))}
                placeholder={t('admin_dashboard.create_subscription.target_uuid')}
                className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 md:col-span-2 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
              <select
                value={createForm.tier}
                onChange={e => setCreateForm(prev => ({ ...prev, tier: e.target.value }))}
                className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              >
                {TIERS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={createForm.status}
                onChange={e => setCreateForm(prev => ({ ...prev, status: e.target.value }))}
                className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="number"
                value={createForm.set_trial_days}
                onChange={e => setCreateForm(prev => ({ ...prev, set_trial_days: e.target.value }))}
                placeholder={t('admin_dashboard.create_subscription.trial_days')}
                className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
              <button
                onClick={handleCreateSubscription}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 md:col-span-2 shadow-sm transition-colors"
              >
                {t('admin_dashboard.create_subscription.create_or_update')}
              </button>
            </div>
            <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={searchKind}
                  onChange={e => setSearchKind(e.target.value as 'company' | 'user')}
                  className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="company">{t('admin_dashboard.search.search_company')}</option>
                  <option value="user">{t('admin_dashboard.search.search_user')}</option>
                </select>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('admin_dashboard.search.placeholder')}
                  className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 flex-1 min-w-[220px] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                />
                <button
                  onClick={handleSearch}
                  className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
                >
                  {t('admin_dashboard.search.search_button')}
                </button>
              </div>
              {searchLoading && (
                <div className="text-xs text-slate-500 mt-2">{t('admin_dashboard.search.searching')}</div>
              )}
              {searchResults.length > 0 && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchResults.map(item => (
                    <div
                      key={item.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-left hover:bg-cyan-50/60 dark:hover:bg-cyan-950/30 transition-colors"
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.secondary || item.id}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          onClick={() => {
                            setCreateForm(prev => ({
                              ...prev,
                              target_type: item.kind,
                              target_id: item.id
                            }));
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
                        >
                          {t('admin_dashboard.search.use_for_subscription')}
                        </button>
                        {item.kind === 'user' && (
                          <button
                            onClick={() => loadDigestUser(item.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                          >
                            {t('admin_dashboard.search.manage_digest')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(digestLoading || digestUser || digestError) && (
                <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('admin_dashboard.digest.title')}</div>
                      <div className="text-xs text-slate-500">{t('admin_dashboard.digest.subtitle')}</div>
                    </div>
                    {digestUser && (
                      <button
                        onClick={() => setDigestUser(null)}
                        className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
                      >
                        {t('admin_dashboard.common.close')}
                      </button>
                    )}
                  </div>

                  {digestLoading && (
                    <div className="text-xs text-slate-500">{t('admin_dashboard.digest.loading_settings')}</div>
                  )}

                  {digestError && (
                    <div className="text-xs text-rose-600">{digestError}</div>
                  )}

                  {digestUser && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900">
                        <div className="text-xs text-slate-500">{t('admin_dashboard.entity.user')}</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{digestUser.full_name || '—'}</div>
                        <div className="text-xs text-slate-500">{digestUser.email}</div>
                      </div>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900">
                        <div className="text-xs text-slate-500">{t('admin_dashboard.digest.locale_country')}</div>
                        <div className="text-slate-700 dark:text-slate-300">{digestUser.preferred_locale || '—'}</div>
                        <div className="text-slate-700 dark:text-slate-300">{digestUser.preferred_country_code || '—'}</div>
                      </div>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900">
                        <div className="text-xs text-slate-500">{t('admin_dashboard.digest.last_sent')}</div>
                        <div className="text-slate-700 dark:text-slate-300">{digestUser.daily_digest_last_sent_at ? formatDate(digestUser.daily_digest_last_sent_at) : '—'}</div>
                      </div>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900 md:col-span-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={Boolean(digestUser.daily_digest_enabled)}
                            onChange={e => setDigestUser((prev: any) => ({ ...prev, daily_digest_enabled: e.target.checked }))}
                          />
                          {t('admin_dashboard.digest.subscribe_daily')}
                        </label>
                        <button
                          onClick={saveDigestUser}
                          disabled={digestSaving}
                          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:text-emerald-600 transition-colors disabled:opacity-60"
                        >
                          {digestSaving ? t('admin_dashboard.common.saving') : t('admin_dashboard.common.save')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_dashboard.push.title')}</h3>
              <p className="text-xs text-slate-500">{t('admin_dashboard.push.subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={pushSubsQuery}
                onChange={(e) => setPushSubsQuery(e.target.value)}
                placeholder={t('admin_dashboard.search.email_or_name')}
                className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
              <button
                onClick={loadPushSubscriptions}
                className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors flex items-center gap-2"
              >
                <RefreshCcw size={14} />
                {t('admin_dashboard.actions.refresh')}
              </button>
              <button
                onClick={exportPushCsv}
                className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              >
                {t('admin_dashboard.actions.export_csv')}
              </button>
            </div>
          </div>
          {pushSubsLoading ? (
            <p className="text-sm text-slate-500">{t('admin_dashboard.common.loading')}</p>
          ) : pushSubs.length === 0 ? (
            <p className="text-sm text-slate-500">{t('admin_dashboard.push.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2 pr-3">{t('admin_dashboard.entity.user')}</th>
                    <th className="py-2 pr-3">{t('admin_dashboard.table.email')}</th>
                    <th className="py-2 pr-3">{t('admin_dashboard.push.updated')}</th>
                    <th className="py-2 pr-3">{t('admin_dashboard.push.user_agent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pushSubs.map((row: any) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                        {row.profiles?.full_name || row.user_id}
                      </td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                        {row.profiles?.email || '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                        {formatDate(row.updated_at)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {row.user_agent || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_dashboard.mailing.title')}</h3>
              <p className="text-xs text-slate-500">{t('admin_dashboard.mailing.subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={mailingQuery}
                onChange={(e) => setMailingQuery(e.target.value)}
                placeholder={t('admin_dashboard.search.email_or_name')}
                className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
              <button
                onClick={handleMailingSearch}
                className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
              >
                {t('admin_dashboard.search.search_button')}
              </button>
            </div>
          </div>

          {mailingLoading && (
            <div className="text-xs text-slate-500">{t('admin_dashboard.search.searching')}</div>
          )}

          {mailingResults.length > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {mailingResults.map(item => (
                <button
                  key={item.id}
                  onClick={() => loadDigestUser(item.id)}
                  className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-left hover:bg-cyan-50/60 dark:hover:bg-cyan-950/30 transition-colors"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.secondary || item.id}</div>
                </button>
              ))}
            </div>
          )}

          {(digestLoading || digestUser || digestError) && (
            <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('admin_dashboard.mailing.digest_settings_title')}</div>
                  <div className="text-xs text-slate-500">{t('admin_dashboard.mailing.digest_settings_subtitle')}</div>
                </div>
                {digestUser && (
                  <button
                    onClick={() => setDigestUser(null)}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
                  >
                    {t('admin_dashboard.common.close')}
                  </button>
                )}
              </div>

              {digestLoading && (
                <div className="text-xs text-slate-500">{t('admin_dashboard.digest.loading_settings')}</div>
              )}

              {digestError && (
                <div className="text-xs text-rose-600">{digestError}</div>
              )}

              {digestUser && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.entity.user')}</div>
                    <div className="font-semibold text-slate-900 dark:text-white">{digestUser.full_name || '—'}</div>
                    <div className="text-xs text-slate-500">{digestUser.email}</div>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.digest.locale_country')}</div>
                    <div className="text-slate-700 dark:text-slate-300">{digestUser.preferred_locale || '—'}</div>
                    <div className="text-slate-700 dark:text-slate-300">{digestUser.preferred_country_code || '—'}</div>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.digest.last_sent')}</div>
                    <div className="text-slate-700 dark:text-slate-300">{digestUser.daily_digest_last_sent_at ? formatDate(digestUser.daily_digest_last_sent_at) : '—'}</div>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(digestUser.daily_digest_enabled)}
                        onChange={e => setDigestUser((prev: any) => ({ ...prev, daily_digest_enabled: e.target.checked }))}
                      />
                      {t('admin_dashboard.digest.email_digest')}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(digestUser.daily_digest_push_enabled)}
                        onChange={e => setDigestUser((prev: any) => ({ ...prev, daily_digest_push_enabled: e.target.checked }))}
                      />
                      {t('admin_dashboard.digest.push_digest')}
                    </label>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('admin_dashboard.digest.time')}</label>
                      <input
                        type="time"
                        value={digestUser.daily_digest_time || '07:30'}
                        onChange={e => setDigestUser((prev: any) => ({ ...prev, daily_digest_time: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('admin_dashboard.digest.timezone')}</label>
                      <input
                        type="text"
                        value={digestUser.daily_digest_timezone || 'Europe/Prague'}
                        onChange={e => setDigestUser((prev: any) => ({ ...prev, daily_digest_timezone: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        onClick={saveDigestUser}
                        disabled={digestSaving}
                        className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:text-emerald-600 transition-colors disabled:opacity-60"
                      >
                        {digestSaving ? t('admin_dashboard.common.saving') : t('admin_dashboard.common.save')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500/70 rounded-t-2xl" />
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.15em] mt-1.5">{t('admin_dashboard.stats.users')}</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {loadingStats ? '…' : stats?.users?.total ?? '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">+ {stats?.users?.new_7d ?? '—'} {t('admin_dashboard.stats.in_7_days')}</div>
          </div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500/70 rounded-t-2xl" />
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.15em] mt-1.5">{t('admin_dashboard.stats.users_30_days')}</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {loadingStats ? '…' : stats?.users?.new_30d ?? '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">{t('admin_dashboard.stats.new_in_30_days')}</div>
          </div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500/70 rounded-t-2xl" />
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.15em] mt-1.5">{t('admin_dashboard.stats.companies')}</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {loadingStats ? '…' : stats?.companies?.total ?? '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">+ {stats?.companies?.new_7d ?? '—'} {t('admin_dashboard.stats.in_7_days')}</div>
          </div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500/70 rounded-t-2xl" />
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.15em] mt-1.5">{t('admin_dashboard.stats.companies_30_days')}</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {loadingStats ? '…' : stats?.companies?.new_30d ?? '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {t('admin_dashboard.stats.new_companies_30_days')}
            </div>
          </div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm col-span-2 lg:col-span-1">
            <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500/70 rounded-t-2xl" />
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.15em] mt-1.5">{t('admin_dashboard.stats.paid_conversion')}</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {loadingStats ? '…' : `${stats?.conversion?.company_paid_percent ?? '—'}%`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {t('admin_dashboard.stats.companies_ratio')} {stats?.conversion?.paid_companies ?? '—'} / {stats?.companies?.total ?? '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {t('admin_dashboard.stats.users')} {stats?.conversion?.user_paid_percent ?? '—'}%
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <BarChart3 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_dashboard.traffic.title')}</h3>
                <p className="text-xs text-slate-500">{t('admin_dashboard.traffic.last_30_days')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowTrafficDetails(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
            >
              {showTrafficDetails ? t('admin_dashboard.traffic.hide_details') : t('admin_dashboard.traffic.show_details')}
            </button>
          </div>

          {loadingStats ? (
            <div className="text-sm text-slate-500">{t('admin_dashboard.traffic.loading')}</div>
          ) : !stats?.traffic?.totals_30 ? (
            <div className="text-sm text-slate-500">{t('admin_dashboard.traffic.unavailable')}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.traffic.pageviews')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(stats?.traffic?.totals_30?.pageviews)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t('admin_dashboard.stats.in_7_days')}: {formatNumber(stats?.traffic?.totals_7?.pageviews)}
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.traffic.visitors')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(stats?.traffic?.totals_30?.unique_visitors)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t('admin_dashboard.stats.in_7_days')}: {formatNumber(stats?.traffic?.totals_7?.unique_visitors)}
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.traffic.sessions')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(stats?.traffic?.totals_30?.sessions)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t('admin_dashboard.stats.in_7_days')}: {formatNumber(stats?.traffic?.totals_7?.sessions)}
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.traffic.bounce_rate')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatPercent(stats?.traffic?.totals_30?.bounce_rate)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t('admin_dashboard.stats.in_7_days')}: {formatPercent(stats?.traffic?.totals_7?.bounce_rate)}
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40 col-span-2 lg:col-span-1">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.traffic.pages_per_session')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats?.traffic?.totals_30?.pages_per_session ?? '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t('admin_dashboard.stats.in_7_days')}: {stats?.traffic?.totals_7?.pages_per_session ?? '—'}
                  </div>
                </div>
              </div>

              {showTrafficDetails && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  <div className="lg:col-span-2">
                    <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.traffic.daily_visits_14_days')}</div>
                    <div className="h-28 flex items-end gap-2">
                      {trafficSeries.map(day => {
                        const height = Math.round((day.pageviews / maxTrafficPageviews) * 100);
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              title={`${day.date} • ${day.pageviews} pv`}
                              className="w-full rounded-md bg-gradient-to-t from-cyan-600/80 to-cyan-400/80 dark:from-cyan-400/80 dark:to-cyan-200/80"
                              style={{ height: `${Math.max(height, 6)}%` }}
                            />
                            <div className="text-[10px] text-slate-400">
                              {day.date.slice(5)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.traffic.top_pages')}</div>
                      <div className="space-y-2">
                        {(stats?.traffic?.top_pages || []).length === 0 ? (
                          <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                        ) : (
                          stats?.traffic?.top_pages?.map((item: any) => (
                            <div key={item.path} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {stripLocale(item.path || '/')}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatNumber(item.pageviews)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.traffic.traffic_source')}</div>
                      <div className="space-y-2">
                        {(stats?.traffic?.top_referrers || []).length === 0 ? (
                          <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                        ) : (
                          stats?.traffic?.top_referrers?.map((item: any) => (
                            <div key={item.referrer} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {item.referrer || '(direct)'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatNumber(item.sessions)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.traffic.top_countries_30_days')}</div>
                      <div className="space-y-2">
                        {(stats?.traffic?.geo?.top_countries || []).length === 0 ? (
                          <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                        ) : (
                          stats?.traffic?.geo?.top_countries?.map((item: any) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {item.label}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatNumber(item.count)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.traffic.devices_30_days')}</div>
                      <div className="space-y-2">
                        {(stats?.traffic?.geo?.top_devices || []).length === 0 ? (
                          <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                        ) : (
                          stats?.traffic?.geo?.top_devices?.map((item: any) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {item.label}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatNumber(item.count)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.traffic.os_30_days')}</div>
                      <div className="space-y-2">
                        {(stats?.traffic?.geo?.top_os || []).length === 0 ? (
                          <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                        ) : (
                          stats?.traffic?.geo?.top_os?.map((item: any) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {item.label}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatNumber(item.count)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                      <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.traffic.browsers_30_days')}</div>
                      <div className="space-y-2">
                        {(stats?.traffic?.geo?.top_browsers || []).length === 0 ? (
                          <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                        ) : (
                          stats?.traffic?.geo?.top_browsers?.map((item: any) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {item.label}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatNumber(item.count)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_dashboard.ai_quality.title')}</h3>
                <p className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAiDetails(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
            >
              {showAiDetails ? t('admin_dashboard.ai_quality.hide_details') : t('admin_dashboard.ai_quality.show_details')}
            </button>
          </div>

          {loadingAiQuality ? (
            <div className="text-sm text-slate-500">{t('admin_dashboard.ai_quality.loading')}</div>
          ) : !aiQuality?.summary ? (
            <div className="text-sm text-slate-500">{t('admin_dashboard.ai_quality.unavailable')}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.schema_pass_rate')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{aiQuality.summary.schema_pass_rate}%</div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.fallback_rate')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{aiQuality.summary.fallback_rate}%</div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.diff_volatility')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{aiQuality.summary.diff_volatility}%</div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.apply_rate_ai_users')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{aiQuality.summary.ai_apply_rate}%</div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40 col-span-2 lg:col-span-1">
                  <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.conversion_impact')}</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{aiQuality.summary.conversion_impact_on_applications}%</div>
                </div>
              </div>

              {aiQuality.offline_eval_latest && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.offline_auc')}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{aiQuality.offline_eval_latest.auc ?? '—'}</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.log_loss')}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{aiQuality.offline_eval_latest.log_loss ?? '—'}</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.precision_at_5')}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{aiQuality.offline_eval_latest.precision_at_5 ?? '—'}</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.exposures')}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{aiQuality.summary.recommendation_exposures ?? '—'}</div>
                  </div>
                </div>
              )}

              {aiQuality.summary && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.exploration_share')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{aiQuality.summary.exploration_share ?? '—'}%</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.new_job_share')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{aiQuality.summary.new_job_share ?? '—'}%</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.long_tail_share')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{aiQuality.summary.long_tail_share ?? '—'}%</div>
                  </div>
                </div>
              )}

              {aiQuality.summary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.ai_users')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(aiQuality.summary.ai_unique_users)}</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.total_tokens')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(aiQuality.summary.total_tokens)}</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.estimated_ai_cost')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{formatUsd(aiQuality.summary.total_estimated_cost)}</div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500">{t('admin_dashboard.ai_quality.avg_cost_per_generation')}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{formatUsd(aiQuality.summary.avg_estimated_cost_per_generation)}</div>
                  </div>
                </div>
              )}

              {showAiDetails && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.ai_quality.active_models')}</div>
                    <div className="space-y-2 max-h-44 overflow-auto">
                      {(aiQuality.active_models || []).slice(0, 8).map((row: any) => (
                        <div key={`${row.subsystem}-${row.feature}-${row.model_name}`} className="text-sm flex items-center justify-between gap-3">
                          <span className="text-slate-700 dark:text-slate-300 truncate">{row.subsystem}/{row.feature} · {row.model_name}</span>
                          <span className="text-xs text-slate-500">{row.version}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.ai_quality.top_models_by_cost')}</div>
                    <div className="space-y-2 max-h-44 overflow-auto">
                      {(aiQuality.usage_by_model || []).length === 0 ? (
                        <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                      ) : (
                        (aiQuality.usage_by_model || []).slice(0, 8).map((row: any) => (
                          <div key={row.model} className="text-sm flex items-center justify-between gap-3">
                            <span className="text-slate-700 dark:text-slate-300 truncate">{row.model}</span>
                            <span className="text-xs text-slate-500">{formatUsd(row.estimated_cost)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40 lg:col-span-2">
                    <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.ai_quality.top_users_by_usage')}</div>
                    <div className="space-y-2 max-h-56 overflow-auto">
                      {(aiQuality.usage_by_user || []).length === 0 ? (
                        <div className="text-xs text-slate-400">{t('admin_dashboard.common.no_data')}</div>
                      ) : (
                        (aiQuality.usage_by_user || []).slice(0, 10).map((row: any) => (
                          <div key={row.user_id} className="text-sm flex items-center justify-between gap-3">
                            <span className="text-slate-700 dark:text-slate-300 truncate">{row.user_id}</span>
                            <span className="text-xs text-slate-500">{formatNumber(row.requests)} {t('admin_dashboard.ai_quality.requests')} • {formatUsd(row.estimated_cost)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500 mb-2">{t('admin_dashboard.ai_quality.release_flags')}</div>
                    <div className="space-y-2 max-h-44 overflow-auto">
                      {(aiQuality.release_flags || []).slice(0, 10).map((flag: any) => (
                        <div key={flag.flag_key} className="text-sm flex items-center justify-between gap-3">
                          <span className="text-slate-700 dark:text-slate-300 truncate">{flag.flag_key}</span>
                          <span className={`text-xs font-semibold ${flag.is_enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {flag.is_enabled ? `${t('admin_dashboard.ai_quality.on')} ${flag.rollout_percent}%` : t('admin_dashboard.ai_quality.off')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Search size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_dashboard.filters.title')}</h3>
              <p className="text-xs text-slate-500">{t('admin_dashboard.filters.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={t('admin_dashboard.filters.search_placeholder')}
              className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 flex-1 min-w-[220px] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            />
            <select
              value={filters.kind}
              onChange={e => setFilters(prev => ({ ...prev, kind: e.target.value, offset: 0 }))}
              className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value="">{t('admin_dashboard.filters.all')}</option>
              <option value="company">{t('admin_dashboard.filters.companies')}</option>
              <option value="user">{t('admin_dashboard.filters.users')}</option>
            </select>
            <select
              value={filters.tier}
              onChange={e => setFilters(prev => ({ ...prev, tier: e.target.value, offset: 0 }))}
              className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value="">{t('admin_dashboard.filters.tier_all')}</option>
              {TIERS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={e => setFilters(prev => ({ ...prev, status: e.target.value, offset: 0 }))}
              className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value="">{t('admin_dashboard.filters.status_all')}</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="text-xs text-slate-500 ml-auto">{paginationLabel}</div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm mb-5 shadow-sm">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 uppercase font-mono text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">{t('admin_dashboard.table.subject')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold">{t('admin_dashboard.table.email')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold">{t('admin_dashboard.table.tier')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold">{t('admin_dashboard.table.status')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold">{t('admin_dashboard.table.validity')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold">{t('admin_dashboard.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">{t('admin_dashboard.common.loading')}</td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">{t('admin_dashboard.table.no_records')}</td>
                  </tr>
                ) : (
                  subscriptions.map(sub => (
                    <tr
                      key={sub.id}
                      className={`border-t border-slate-100 dark:border-slate-800 transition-colors hover:bg-cyan-50/60 dark:hover:bg-cyan-950/30 ${selectedSub?.id === sub.id ? 'bg-cyan-50/70 dark:bg-cyan-950/40' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{getEntityName(sub)}</div>
                        <div className="text-xs text-slate-500">{getEntityLabel(sub)}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{sub.id}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {getEntityEmail(sub)}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={edits[sub.id]?.tier || sub.tier}
                          onChange={e => handleEditChange(sub.id, 'tier', e.target.value)}
                          className="border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        >
                          {TIERS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={edits[sub.id]?.status || sub.status}
                          onChange={e => handleEditChange(sub.id, 'status', e.target.value)}
                          className="border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        <div>{formatDate(sub.current_period_end)}</div>
                        <div className="flex gap-2 mt-2">
                          <input
                            type="number"
                            value={edits[sub.id]?.set_trial_days || ''}
                            onChange={e => handleEditChange(sub.id, 'set_trial_days', e.target.value)}
                            placeholder={t('admin_dashboard.table.trial_days_placeholder')}
                            className="border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-900 w-20 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                          />
                          <input
                            type="date"
                            value={edits[sub.id]?.set_trial_until || ''}
                            onChange={e => handleEditChange(sub.id, 'set_trial_until', e.target.value)}
                            className="border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleSelect(sub)}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-600/10 text-cyan-700 dark:text-cyan-300 text-xs font-semibold hover:bg-cyan-600/20"
                          >
                            {t('admin_dashboard.table.detail')}
                          </button>
                          <button
                            onClick={() => handleQuickAction(sub, 'trial14')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/20"
                          >
                            {t('admin_dashboard.table.trial_14d')}
                          </button>
                          <button
                            onClick={() => handleQuickAction(sub, 'activate')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20"
                          >
                            {t('admin_dashboard.table.activate')}
                          </button>
                          <button
                            onClick={() => handleQuickAction(sub, 'cancel')}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-500/20"
                          >
                            {t('admin_dashboard.table.cancel')}
                          </button>
                          <button
                            onClick={() => handleSave(sub)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                          >
                            {t('admin_dashboard.common.save')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <button
              disabled={filters.offset === 0}
              onClick={() => setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 disabled:opacity-50"
            >
              {t('admin_dashboard.table.previous')}
            </button>
            <div className="text-xs text-slate-500">{paginationLabel}</div>
            <button
              disabled={filters.offset + filters.limit >= total}
              onClick={() => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 disabled:opacity-50"
            >
              {t('admin_dashboard.table.next')}
            </button>
          </div>
        </div>

        {selectedSub && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('admin_dashboard.detail.title')}</h3>
                <p className="text-xs text-slate-500">{selectedSub.id}</p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
              >
                {t('admin_dashboard.common.close')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-xs text-slate-500">{t('admin_dashboard.detail.subject')}</div>
                <div className="font-semibold text-slate-900 dark:text-white">{getEntityName(selectedSub)}</div>
                <div className="text-xs text-slate-500">{getEntityLabel(selectedSub)}</div>
                <div className="text-xs text-slate-500 mt-2">{getEntityEmail(selectedSub)}</div>
              </div>
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-xs text-slate-500">{t('admin_dashboard.detail.tier_status')}</div>
                <div className="font-semibold text-slate-900 dark:text-white">{selectedSub.tier} · {selectedSub.status}</div>
                <div className="text-xs text-slate-500 mt-2">{t('admin_dashboard.detail.valid_until')}</div>
                <div className="text-slate-700 dark:text-slate-300">{formatDate(selectedSub.current_period_end)}</div>
              </div>
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-xs text-slate-500">{t('admin_dashboard.detail.stripe')}</div>
                <div className="text-slate-700 dark:text-slate-300 break-words">
                  {selectedSub.stripe_subscription_id || '—'}
                </div>
                <div className="text-xs text-slate-500 mt-2">{t('admin_dashboard.detail.customer')}</div>
                <div className="text-slate-700 dark:text-slate-300 break-words">
                  {selectedSub.stripe_customer_id || '—'}
                </div>
              </div>
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-xs text-slate-500">{t('admin_dashboard.detail.period')}</div>
                <div className="text-slate-700 dark:text-slate-300">
                  {formatDate(selectedSub.current_period_start)}
                </div>
                <div className="text-xs text-slate-500 mt-2">{t('admin_dashboard.detail.cancel_at_period_end')}</div>
                <div className="text-slate-700 dark:text-slate-300">
                  {selectedSub.cancel_at_period_end ? t('admin_dashboard.common.yes') : t('admin_dashboard.common.no')}
                </div>
              </div>
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-xs text-slate-500">{t('admin_dashboard.detail.created')}</div>
                <div className="text-slate-700 dark:text-slate-300">{formatDate(selectedSub.created_at)}</div>
                <div className="text-xs text-slate-500 mt-2">{t('admin_dashboard.detail.updated')}</div>
                <div className="text-slate-700 dark:text-slate-300">{formatDate(selectedSub.updated_at)}</div>
              </div>
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-xs text-slate-500">{t('admin_dashboard.detail.price_id')}</div>
                <div className="text-slate-700 dark:text-slate-300 break-words">
                  {selectedSub.stripe_price_id || '—'}
                </div>
                <div className="text-xs text-slate-500 mt-2">{t('admin_dashboard.detail.target_id')}</div>
                <div className="text-slate-700 dark:text-slate-300 break-words">
                  {selectedSub.company_id || selectedSub.user_id || '—'}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('admin_dashboard.audit.title')}</h4>
                <button
                  onClick={() => loadAudit(selectedSub.id)}
                  className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
                >
                  {t('admin_dashboard.audit.refresh')}
                </button>
              </div>
              {loadingAudit ? (
                <div className="text-sm text-slate-500">{t('admin_dashboard.audit.loading')}</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map(entry => {
                    const changed = getChangedFields(entry);
                    return (
                      <div key={entry.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
                        <div className="text-xs text-slate-500">{formatDate(entry.created_at)}</div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          {entry.action} · {entry.admin_email || t('admin_dashboard.audit.admin')}
                        </div>
                        {changed.length > 0 && (
                          <div className="text-xs text-slate-500 mt-1">
                            {t('admin_dashboard.audit.changed')}: {changed.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
