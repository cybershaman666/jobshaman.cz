import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BrainCircuit,
  KanbanSquare,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Users
} from 'lucide-react';

import {
  AdminRequestError,
  createAdminCrmLead,
  createAdminFounderBoardCard,
  createAdminFounderBoardComment,
  createAdminJobRole,
  getAdminAiQuality,
  getAdminCrmEntities,
  getAdminCrmEntityDetail,
  getAdminCrmJobReactionsSummary,
  getAdminCrmLeads,
  getAdminFounderBoard,
  getAdminJobRoles,
  getAdminMe,
  getAdminNotifications,
  getAdminStats,
  getAdminSubscriptionAudit,
  getAdminSubscriptions,
  getAdminUserDigest,
  updateAdminCrmLead,
  updateAdminFounderBoardCard,
  updateAdminJobRole,
  updateAdminSubscription,
  updateAdminUserDigest,
  deleteAdminJobRole
} from '../services/adminService';
import { BACKEND_URL } from '../constants';

type AdminTab = 'overview' | 'operations' | 'crm' | 'workspace' | 'jcfpm';

type Dict = Record<string, any>;

type AuthState = 'loading' | 'login_required' | 'access_denied' | 'ready' | 'error';

type LeadFormState = {
  company_name: string;
  contact_name: string;
  contact_role: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  city: string;
  status: 'new' | 'contacted' | 'qualified' | 'meeting' | 'proposal' | 'won' | 'lost';
  priority: 'low' | 'medium' | 'high';
  source: 'manual' | 'outbound' | 'inbound' | 'referral' | 'event';
  notes: string;
};

type WorkspaceFormState = {
  title: string;
  body: string;
  card_type: 'idea' | 'opinion' | 'task' | 'note';
  status: 'inbox' | 'active' | 'done' | 'archived';
  priority: 'low' | 'medium' | 'high';
  assignee_name: string;
  assignee_email: string;
};

const DEFAULT_ROLE_FORM = {
  title: '',
  d1: '0',
  d2: '0',
  d3: '0',
  d4: '0',
  d5: '0',
  d6: '0',
  salary_range: '',
  growth_potential: '',
  ai_impact: '',
  ai_intensity: '',
  remote_friendly: ''
};

const DEFAULT_LEAD_FORM: LeadFormState = {
  company_name: '',
  contact_name: '',
  contact_role: '',
  email: '',
  phone: '',
  website: '',
  country: '',
  city: '',
  status: 'new' as const,
  priority: 'medium' as const,
  source: 'manual' as const,
  notes: ''
};

const DEFAULT_WORKSPACE_FORM: WorkspaceFormState = {
  title: '',
  body: '',
  card_type: 'task' as const,
  status: 'inbox' as const,
  priority: 'medium' as const,
  assignee_name: '',
  assignee_email: ''
};

const STATUS_OPTIONS = ['inactive', 'trialing', 'active', 'canceled', 'past_due'];
const TIER_OPTIONS = ['free', 'trial', 'starter', 'pro', 'premium', 'enterprise'];
const LEAD_STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'meeting', 'proposal', 'won', 'lost'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high'];
const BOARD_STATUS_COLUMNS = ['inbox', 'active', 'done'] as const;

const numberFormatter = new Intl.NumberFormat('cs-CZ');

const formatNumber = (value: unknown): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0';
  return numberFormatter.format(numeric);
};

const formatPercent = (value: unknown): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0%';
  return `${numeric.toFixed(numeric >= 10 ? 1 : 2)}%`;
};

const formatCurrency = (value: unknown): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0';
  return `$${numeric.toFixed(4)}`;
};

const formatDateTime = (value: unknown): string => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(String(value)));
  } catch {
    return String(value);
  }
};

const formatDate = (value: unknown): string => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium'
    }).format(new Date(String(value)));
  } catch {
    return String(value);
  }
};

const normalizeError = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const downloadText = (filename: string, text: string, mimeType: string) => {
  const blob = new Blob([text], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
};

function MetricCard({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {detail ? <div className="mt-1 text-sm text-slate-500">{detail}</div> : null}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  actions,
  children,
  className = ''
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`.trim()}>
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${props.className || ''}`.trim()}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${props.className || ''}`.trim()}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${props.className || ''}`.trim()}
    />
  );
}

function Button({
  children,
  tone = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const toneClass =
    tone === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-700'
      : tone === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-500'
        : tone === 'ghost'
          ? 'bg-transparent text-slate-700 hover:bg-slate-100'
          : 'bg-slate-100 text-slate-900 hover:bg-slate-200';
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass} ${props.className || ''}`.trim()}
    >
      {children}
    </button>
  );
}

function AdminDashboard() {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<AdminTab>('overview');
  const [authState, setAuthState] = React.useState<AuthState>('loading');
  const [adminIdentity, setAdminIdentity] = React.useState<Dict | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [flashMessage, setFlashMessage] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const [overview, setOverview] = React.useState<{ loading: boolean; error: string | null; partial: string | null; stats: Dict | null; aiQuality: Dict | null; notifications: Dict | null }>({
    loading: false,
    error: null,
    partial: null,
    stats: null,
    aiQuality: null,
    notifications: null
  });

  const [operations, setOperations] = React.useState<{
    loading: boolean;
    error: string | null;
    items: Dict[];
    count: number;
    filters: Dict;
    selectedSubscriptionId: string | null;
    audit: Dict[];
    auditAvailable: boolean;
    auditLoading: boolean;
  }>({
    loading: false,
    error: null,
    items: [],
    count: 0,
    filters: { q: '', tier: '', status: '', kind: '', limit: 50, offset: 0 },
    selectedSubscriptionId: null,
    audit: [],
    auditAvailable: true,
    auditLoading: false
  });
  const [subscriptionDrafts, setSubscriptionDrafts] = React.useState<Record<string, Dict>>({});

  const [crm, setCrm] = React.useState<{
    loading: boolean;
    error: string | null;
    entities: Dict[];
    leads: Dict[];
    jobSummary: Dict[];
    selectedKind: 'company' | 'user' | 'lead' | null;
    selectedId: string | null;
    detail: Dict | null;
    detailLoading: boolean;
    detailError: string | null;
    filters: Dict;
    digest: Dict | null;
    digestLoading: boolean;
  }>({
    loading: false,
    error: null,
    entities: [],
    leads: [],
    jobSummary: [],
    selectedKind: null,
    selectedId: null,
    detail: null,
    detailLoading: false,
    detailError: null,
    filters: { q: '', kind: 'all', leadStatus: '' },
    digest: null,
    digestLoading: false
  });
  const [leadForm, setLeadForm] = React.useState<LeadFormState>(DEFAULT_LEAD_FORM);
  const [leadSaving, setLeadSaving] = React.useState(false);
  const [digestDraft, setDigestDraft] = React.useState<Dict | null>(null);

  const [workspace, setWorkspace] = React.useState<{
    loading: boolean;
    error: string | null;
    items: Dict[];
    count: number;
    filters: Dict;
  }>({
    loading: false,
    error: null,
    items: [],
    count: 0,
    filters: { q: '', status: '' }
  });
  const [workspaceForm, setWorkspaceForm] = React.useState<WorkspaceFormState>(DEFAULT_WORKSPACE_FORM);
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [workspaceCommentDrafts, setWorkspaceCommentDrafts] = React.useState<Record<string, string>>({});

  const [roleState, setRoleState] = React.useState<{
    loading: boolean;
    error: string | null;
    items: Dict[];
    count: number;
    selectedRoleId: string | null;
    filters: Dict;
  }>({
    loading: false,
    error: null,
    items: [],
    count: 0,
    selectedRoleId: null,
    filters: { q: '', limit: 100, offset: 0 }
  });
  const [roleForm, setRoleForm] = React.useState(DEFAULT_ROLE_FORM);
  const [roleSaving, setRoleSaving] = React.useState(false);

  const selectedRole = React.useMemo(
    () => roleState.items.find((item) => String(item.id) === roleState.selectedRoleId) || null,
    [roleState.items, roleState.selectedRoleId]
  );

  const loadOverview = React.useCallback(async () => {
    setOverview((current) => ({ ...current, loading: true, error: null, partial: null }));
    const [statsResult, aiResult, notificationsResult] = await Promise.allSettled([
      getAdminStats(),
      getAdminAiQuality(30),
      getAdminNotifications(7)
    ]);

    const nextState = {
      loading: false,
      error: null as string | null,
      partial: null as string | null,
      stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
      aiQuality: aiResult.status === 'fulfilled' ? aiResult.value : null,
      notifications: notificationsResult.status === 'fulfilled' ? notificationsResult.value : null
    };

    const failures = [statsResult, aiResult, notificationsResult].filter((result) => result.status === 'rejected');
    if (failures.length === 3) {
      nextState.error = normalizeError((failures[0] as PromiseRejectedResult).reason, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' }));
    } else if (failures.length > 0) {
      nextState.partial = t('admin_dashboard.partial_data', { defaultValue: 'Část admin dat se nepodařilo načíst. Zbytek přehledu je dostupný.' });
    }

    setOverview(nextState);
  }, [t]);

  const loadOperations = React.useCallback(async () => {
    setOperations((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await getAdminSubscriptions({
        q: operations.filters.q || undefined,
        tier: operations.filters.tier || undefined,
        status: operations.filters.status || undefined,
        kind: operations.filters.kind || undefined,
        limit: operations.filters.limit,
        offset: operations.filters.offset
      });
      const items = toArray<Dict>(response.items);
      const drafts: Record<string, Dict> = {};
      items.forEach((item) => {
        drafts[String(item.id)] = {
          tier: item.tier || '',
          status: item.status || '',
          trialDays: ''
        };
      });
      setSubscriptionDrafts((current) => ({ ...drafts, ...current }));
      setOperations((current) => ({
        ...current,
        loading: false,
        items,
        count: Number(response.count || 0),
        error: null
      }));
    } catch (error) {
      setOperations((current) => ({
        ...current,
        loading: false,
        error: normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' }))
      }));
    }
  }, [operations.filters, t]);

  const loadCrm = React.useCallback(async () => {
    setCrm((current) => ({ ...current, loading: true, error: null }));
    try {
      const [entitiesResponse, leadsResponse, jobsResponse] = await Promise.all([
        getAdminCrmEntities({
          q: crm.filters.q || undefined,
          kind: crm.filters.kind || 'all',
          limit: 120
        }),
        getAdminCrmLeads({
          q: crm.filters.q || undefined,
          status: crm.filters.leadStatus || undefined,
          limit: 120,
          offset: 0
        }),
        getAdminCrmJobReactionsSummary({
          q: crm.filters.q || undefined,
          limit: 20,
          window_days: 90
        })
      ]);

      setCrm((current) => ({
        ...current,
        loading: false,
        error: null,
        entities: toArray<Dict>(entitiesResponse.items),
        leads: toArray<Dict>(leadsResponse.items),
        jobSummary: toArray<Dict>(jobsResponse.items)
      }));
    } catch (error) {
      setCrm((current) => ({
        ...current,
        loading: false,
        error: normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' }))
      }));
    }
  }, [crm.filters, t]);

  const loadCrmDetail = React.useCallback(async (kind: 'company' | 'user' | 'lead', entityId: string) => {
    setCrm((current) => ({
      ...current,
      selectedKind: kind,
      selectedId: entityId,
      detail: null,
      detailLoading: true,
      detailError: null,
      digest: null
    }));
    try {
      const detail = await getAdminCrmEntityDetail(kind, entityId);
      setCrm((current) => ({
        ...current,
        detail,
        detailLoading: false,
        detailError: null
      }));
      if (kind === 'user') {
        setCrm((current) => ({ ...current, digestLoading: true }));
        try {
          const digest = await getAdminUserDigest(entityId);
          setCrm((current) => ({ ...current, digest, digestLoading: false }));
          setDigestDraft({
            daily_digest_enabled: Boolean(digest.daily_digest_enabled),
            daily_digest_push_enabled: Boolean(digest.daily_digest_push_enabled),
            daily_digest_time: digest.daily_digest_time || '',
            daily_digest_timezone: digest.daily_digest_timezone || ''
          });
        } catch {
          setCrm((current) => ({ ...current, digestLoading: false }));
        }
      }
    } catch (error) {
      setCrm((current) => ({
        ...current,
        detailLoading: false,
        detailError: normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' }))
      }));
    }
  }, [t]);

  const loadWorkspace = React.useCallback(async () => {
    setWorkspace((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await getAdminFounderBoard({
        q: workspace.filters.q || undefined,
        status: workspace.filters.status || undefined,
        limit: 120
      });
      setWorkspace((current) => ({
        ...current,
        loading: false,
        error: null,
        items: toArray<Dict>(response.items),
        count: Number(response.count || 0)
      }));
    } catch (error) {
      setWorkspace((current) => ({
        ...current,
        loading: false,
        error: normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' }))
      }));
    }
  }, [workspace.filters, t]);

  const loadJobRoles = React.useCallback(async () => {
    setRoleState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await getAdminJobRoles({
        q: roleState.filters.q || undefined,
        limit: roleState.filters.limit,
        offset: roleState.filters.offset
      });
      setRoleState((current) => ({
        ...current,
        loading: false,
        error: null,
        items: toArray<Dict>(response.items),
        count: Number(response.count || 0),
        selectedRoleId: current.selectedRoleId || String((response.items || [])[0]?.id || '')
      }));
    } catch (error) {
      setRoleState((current) => ({
        ...current,
        loading: false,
        error: normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' }))
      }));
    }
  }, [roleState.filters, t]);

  const refreshCurrentTab = React.useCallback(async () => {
    setIsRefreshing(true);
    setGlobalError(null);
    try {
      if (tab === 'overview') await loadOverview();
      if (tab === 'operations') await loadOperations();
      if (tab === 'crm') await loadCrm();
      if (tab === 'workspace') await loadWorkspace();
      if (tab === 'jcfpm') await loadJobRoles();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' })));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCrm, loadJobRoles, loadOperations, loadOverview, loadWorkspace, t, tab]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setAuthState('loading');
      try {
        const me = await getAdminMe();
        if (cancelled) return;
        setAdminIdentity(me);
        setAuthState('ready');
      } catch (error) {
        if (cancelled) return;
        const status = error instanceof AdminRequestError ? error.status : undefined;
        if (status === 401) {
          setAuthState('login_required');
          return;
        }
        if (status === 403) {
          setAuthState('access_denied');
          return;
        }
        setAuthState('error');
        setGlobalError(normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' })));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [t]);

  React.useEffect(() => {
    if (authState !== 'ready') return;
    void refreshCurrentTab();
  }, [authState, refreshCurrentTab]);

  React.useEffect(() => {
    if (!flashMessage) return;
    const timeout = window.setTimeout(() => setFlashMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [flashMessage]);

  React.useEffect(() => {
    if (!selectedRole) {
      setRoleForm(DEFAULT_ROLE_FORM);
      return;
    }
    setRoleForm({
      title: selectedRole.title || '',
      d1: String(selectedRole.d1 ?? 0),
      d2: String(selectedRole.d2 ?? 0),
      d3: String(selectedRole.d3 ?? 0),
      d4: String(selectedRole.d4 ?? 0),
      d5: String(selectedRole.d5 ?? 0),
      d6: String(selectedRole.d6 ?? 0),
      salary_range: selectedRole.salary_range || '',
      growth_potential: selectedRole.growth_potential || '',
      ai_impact: selectedRole.ai_impact || '',
      ai_intensity: selectedRole.ai_intensity || '',
      remote_friendly: selectedRole.remote_friendly || ''
    });
  }, [selectedRole]);

  const tabItems = [
    { id: 'overview' as const, label: t('admin_dashboard.tabs.overview', { defaultValue: 'Overview' }), icon: BarChart3 },
    { id: 'operations' as const, label: t('admin_dashboard.tabs.operations', { defaultValue: 'Operations' }), icon: Settings2 },
    { id: 'crm' as const, label: t('admin_dashboard.tabs.crm', { defaultValue: 'CRM' }), icon: Users },
    { id: 'workspace' as const, label: t('admin_dashboard.tabs.workspace', { defaultValue: 'Board' }), icon: KanbanSquare },
    { id: 'jcfpm' as const, label: t('admin_dashboard.tabs.jcfpm', { defaultValue: 'JCFPM Role Lab' }), icon: BrainCircuit }
  ];

  const handleExportPack = () => {
    const payload = {
      generated_at: new Date().toISOString(),
      admin: adminIdentity,
      tab,
      overview,
      operations,
      crm,
      workspace,
      roles: roleState
    };
    downloadText(`admin-pack-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  };

  const handleWakeBackend = async () => {
    try {
      await fetch(`${BACKEND_URL}/admin/me`, { credentials: 'include' });
      setFlashMessage(t('admin_dashboard.actions.backend_ok', { defaultValue: 'Backend OK' }));
    } catch {
      setFlashMessage(t('admin_dashboard.actions.wake_backend', { defaultValue: 'Wake backend' }));
    }
  };

  const operationsRows = operations.items;
  const crmSummary = React.useMemo(() => {
    const allRecords = [
      ...crm.entities.map((item) => ({ kind: item.kind, subscription: item.subscription })),
      ...crm.leads.map(() => ({ kind: 'lead', subscription: null }))
    ];
    return {
      total: allRecords.length,
      companies: allRecords.filter((item) => item.kind === 'company').length,
      users: allRecords.filter((item) => item.kind === 'user').length,
      leads: allRecords.filter((item) => item.kind === 'lead').length,
      subscribed: allRecords.filter((item) => item.subscription).length,
      trialing: allRecords.filter((item) => item.subscription?.status === 'trialing').length
    };
  }, [crm.entities, crm.leads]);

  const workspaceColumns = React.useMemo(() => {
    const columns: Record<(typeof BOARD_STATUS_COLUMNS)[number], Dict[]> = {
      inbox: [],
      active: [],
      done: []
    };
    workspace.items.forEach((item) => {
      const status = BOARD_STATUS_COLUMNS.includes(item.status as (typeof BOARD_STATUS_COLUMNS)[number])
        ? (item.status as (typeof BOARD_STATUS_COLUMNS)[number])
        : 'inbox';
      columns[status].push(item);
    });
    return columns;
  }, [workspace.items]);

  const detailMetrics = crm.detail?.metrics ? Object.entries(crm.detail.metrics) : [];
  const detailTimeline = toArray<Dict>(crm.detail?.timeline);
  const detailRecent = crm.detail?.recent || {};
  const detailBreakdowns = crm.detail?.breakdowns || {};

  const renderAuthState = () => {
    if (authState === 'loading') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
            <div className="text-lg font-semibold text-slate-900">{t('admin_dashboard.common.loading', { defaultValue: 'Loading...' })}</div>
          </div>
        </div>
      );
    }

    if (authState === 'login_required' || authState === 'access_denied' || authState === 'error') {
      const icon = authState === 'access_denied' ? ShieldAlert : ShieldCheck;
      const Icon = icon;
      const title =
        authState === 'login_required'
          ? t('admin_dashboard.auth.admin_zone', { defaultValue: 'Admin zone' })
          : authState === 'access_denied'
            ? t('admin_dashboard.auth.access_denied', { defaultValue: 'Access denied' })
            : t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' });
      const body =
        authState === 'login_required'
          ? t('admin_dashboard.auth.login_required', { defaultValue: 'Please sign in first to access this section.' })
          : authState === 'access_denied'
            ? t('admin_dashboard.auth.no_admin_rights', { defaultValue: 'This account does not have admin permissions.' })
            : globalError || t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' });
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <div className="max-w-xl rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <Icon size={26} />
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button tone="secondary" onClick={() => window.location.assign('/')}>
                JobShaman
              </Button>
              <Button onClick={() => window.location.reload()}>{t('admin_dashboard.actions.refresh', { defaultValue: 'Refresh' })}</Button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (authState !== 'ready') {
    return renderAuthState();
  }

  const handleSubscriptionDraftChange = (id: string, field: string, value: string) => {
    setSubscriptionDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [field]: value
      }
    }));
  };

  const saveSubscription = async (row: Dict) => {
    const rowId = String(row.id);
    const draft = subscriptionDrafts[rowId] || {};
    try {
      await updateAdminSubscription({
        subscription_id: row.id,
        target_type: row.company_id ? 'company' : 'user',
        target_id: row.company_id || row.user_id,
        tier: draft.tier || row.tier,
        status: draft.status || row.status,
        set_trial_days: draft.trialDays ? Number(draft.trialDays) : undefined
      });
      setFlashMessage(t('admin_dashboard.common.save', { defaultValue: 'Save' }));
      await loadOperations();
      if (operations.selectedSubscriptionId === rowId) {
        const auditResponse = await getAdminSubscriptionAudit(rowId, 50);
        setOperations((current) => ({
          ...current,
          audit: toArray<Dict>(auditResponse.items),
          auditAvailable: Boolean(auditResponse.audit_available ?? true)
        }));
      }
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.save_failed', { defaultValue: 'Saving failed' })));
    }
  };

  const openSubscriptionAudit = async (subscriptionId: string) => {
    setOperations((current) => ({
      ...current,
      selectedSubscriptionId: subscriptionId,
      auditLoading: true
    }));
    try {
      const response = await getAdminSubscriptionAudit(subscriptionId, 50);
      setOperations((current) => ({
        ...current,
        auditLoading: false,
        audit: toArray<Dict>(response.items),
        auditAvailable: Boolean(response.audit_available ?? true)
      }));
    } catch (error) {
      setOperations((current) => ({
        ...current,
        auditLoading: false,
        error: normalizeError(error, t('admin_dashboard.errors.load_failed', { defaultValue: 'Loading failed' }))
      }));
    }
  };

  const handleLeadCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLeadSaving(true);
    try {
      await createAdminCrmLead({
        ...leadForm,
        status: leadForm.status as 'new' | 'contacted' | 'qualified' | 'meeting' | 'proposal' | 'won' | 'lost',
        priority: leadForm.priority as 'low' | 'medium' | 'high',
        source: leadForm.source as 'manual' | 'outbound' | 'inbound' | 'referral' | 'event',
        website: leadForm.website || undefined,
        email: leadForm.email || undefined,
        phone: leadForm.phone || undefined,
        notes: leadForm.notes || undefined,
        contact_name: leadForm.contact_name || undefined,
        contact_role: leadForm.contact_role || undefined,
        country: leadForm.country || undefined,
        city: leadForm.city || undefined
      });
      setLeadForm(DEFAULT_LEAD_FORM);
      setFlashMessage(t('admin_dashboard.crm.create_lead_cta', { defaultValue: 'Uložit lead' }));
      await loadCrm();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.create_failed', { defaultValue: 'Creation failed' })));
    } finally {
      setLeadSaving(false);
    }
  };

  const handleLeadUpdate = async () => {
    if (crm.selectedKind !== 'lead' || !crm.selectedId || !crm.detail?.entity) return;
    const entity = crm.detail.entity;
    try {
      await updateAdminCrmLead(crm.selectedId, {
        status: entity.status,
        priority: entity.priority,
        notes: entity.notes,
        next_follow_up_at: entity.next_follow_up_at || undefined
      });
      setFlashMessage(t('admin_dashboard.common.save', { defaultValue: 'Save' }));
      await loadCrmDetail('lead', crm.selectedId);
      await loadCrm();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.save_failed', { defaultValue: 'Saving failed' })));
    }
  };

  const handleDigestSave = async () => {
    if (!crm.selectedId || crm.selectedKind !== 'user' || !digestDraft) return;
    try {
      const updated = await updateAdminUserDigest(crm.selectedId, {
        daily_digest_enabled: Boolean(digestDraft.daily_digest_enabled),
        daily_digest_push_enabled: Boolean(digestDraft.daily_digest_push_enabled),
        daily_digest_time: digestDraft.daily_digest_time || undefined,
        daily_digest_timezone: digestDraft.daily_digest_timezone || undefined
      });
      setCrm((current) => ({ ...current, digest: updated }));
      setFlashMessage(t('admin_dashboard.common.save', { defaultValue: 'Save' }));
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.digest_save_failed', { defaultValue: 'Failed to save digest settings' })));
    }
  };

  const handleWorkspaceCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorkspaceSaving(true);
    try {
      await createAdminFounderBoardCard({
        ...workspaceForm,
        card_type: workspaceForm.card_type as 'idea' | 'opinion' | 'task' | 'note',
        status: workspaceForm.status as 'inbox' | 'active' | 'done' | 'archived',
        priority: workspaceForm.priority as 'low' | 'medium' | 'high',
        assignee_name: workspaceForm.assignee_name || undefined,
        assignee_email: workspaceForm.assignee_email || undefined,
        body: workspaceForm.body || undefined
      });
      setWorkspaceForm(DEFAULT_WORKSPACE_FORM);
      setFlashMessage(t('admin_dashboard.workspace.create', { defaultValue: 'Create' }));
      await loadWorkspace();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.create_failed', { defaultValue: 'Creation failed' })));
    } finally {
      setWorkspaceSaving(false);
    }
  };

  const handleWorkspaceUpdate = async (cardId: string, payload: Dict) => {
    try {
      await updateAdminFounderBoardCard(cardId, payload);
      await loadWorkspace();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.save_failed', { defaultValue: 'Saving failed' })));
    }
  };

  const handleWorkspaceComment = async (cardId: string) => {
    const body = (workspaceCommentDrafts[cardId] || '').trim();
    if (!body) return;
    try {
      await createAdminFounderBoardComment(cardId, { body });
      setWorkspaceCommentDrafts((current) => ({ ...current, [cardId]: '' }));
      await loadWorkspace();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.save_failed', { defaultValue: 'Saving failed' })));
    }
  };

  const handleRoleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      title: roleForm.title,
      d1: Number(roleForm.d1),
      d2: Number(roleForm.d2),
      d3: Number(roleForm.d3),
      d4: Number(roleForm.d4),
      d5: Number(roleForm.d5),
      d6: Number(roleForm.d6),
      salary_range: roleForm.salary_range || undefined,
      growth_potential: roleForm.growth_potential || undefined,
      ai_impact: roleForm.ai_impact || undefined,
      ai_intensity: roleForm.ai_intensity || undefined,
      remote_friendly: roleForm.remote_friendly || undefined
    };
    setRoleSaving(true);
    try {
      if (roleState.selectedRoleId) {
        await updateAdminJobRole(roleState.selectedRoleId, payload);
      } else {
        await createAdminJobRole(payload);
      }
      setFlashMessage(roleState.selectedRoleId ? t('admin_dashboard.jcfpm.update', { defaultValue: 'Update' }) : t('admin_dashboard.jcfpm.create', { defaultValue: 'Create' }));
      await loadJobRoles();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.save_failed', { defaultValue: 'Saving failed' })));
    } finally {
      setRoleSaving(false);
    }
  };

  const handleRoleDelete = async () => {
    if (!roleState.selectedRoleId) return;
    if (!window.confirm(t('admin_dashboard.jcfpm.delete', { defaultValue: 'Delete' }))) return;
    try {
      await deleteAdminJobRole(roleState.selectedRoleId);
      setRoleState((current) => ({ ...current, selectedRoleId: null }));
      setRoleForm(DEFAULT_ROLE_FORM);
      await loadJobRoles();
    } catch (error) {
      setGlobalError(normalizeError(error, t('admin_dashboard.errors.action_failed', { defaultValue: 'Action failed' })));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('admin_dashboard.header.control', { defaultValue: 'Admin Control' })}
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950">
                {t('admin_dashboard.header.title', { defaultValue: 'Admin Dashboard' })}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {t('admin_dashboard.header.subtitle', { defaultValue: 'Manage subscriptions, trials, audits and traffic analytics' })}
              </p>
              {adminIdentity ? (
                <div className="mt-4 text-sm text-slate-500">
                  {adminIdentity.email} · {adminIdentity.role || 'admin'}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button tone="secondary" onClick={handleExportPack}>
                {t('admin_dashboard.actions.export_csv', { defaultValue: 'Export CSV' })}
              </Button>
              <Button tone="secondary" onClick={() => void handleWakeBackend()}>
                {t('admin_dashboard.actions.wake_backend', { defaultValue: 'Wake backend' })}
              </Button>
              <Button onClick={() => void refreshCurrentTab()} disabled={isRefreshing}>
                <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('admin_dashboard.actions.refresh', { defaultValue: 'Refresh' })}
              </Button>
            </div>
          </div>

          {flashMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {flashMessage}
            </div>
          ) : null}
          {globalError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {tabItems.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {tab === 'overview' ? (
            <>
              {overview.error ? (
                <Panel title={t('admin_dashboard.tabs.overview', { defaultValue: 'Overview' })}>
                  <div className="text-sm text-red-600">{overview.error}</div>
                </Panel>
              ) : (
                <>
                  {overview.partial ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{overview.partial}</div>
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
                    <MetricCard label={t('admin_dashboard.kpis.users', { defaultValue: 'Users' })} value={formatNumber(overview.stats?.users?.total)} detail={`${formatNumber(overview.stats?.users?.new_30d)} / 30d`} />
                    <MetricCard label={t('admin_dashboard.kpis.companies', { defaultValue: 'Companies' })} value={formatNumber(overview.stats?.companies?.total)} detail={`${formatNumber(overview.stats?.companies?.new_30d)} / 30d`} />
                    <MetricCard label={t('admin_dashboard.kpis.paid_conversion', { defaultValue: 'Paid conversion' })} value={formatPercent(overview.stats?.conversion?.company_paid_percent)} detail={`${formatNumber(overview.stats?.conversion?.paid_companies)} paid companies`} />
                    <MetricCard label={t('admin_dashboard.kpis.ai_generations', { defaultValue: 'AI generations' })} value={formatNumber(overview.aiQuality?.summary?.total_generations)} detail={`${formatNumber(overview.aiQuality?.summary?.ai_users)} AI users`} />
                    <MetricCard label={t('admin_dashboard.kpis.ai_cost', { defaultValue: 'AI cost' })} value={formatCurrency(overview.aiQuality?.summary?.estimated_ai_cost)} detail={`${formatNumber(overview.aiQuality?.summary?.total_tokens)} tokens`} />
                    <MetricCard label={t('admin_dashboard.kpis.apply_uplift', { defaultValue: 'Apply uplift' })} value={formatPercent(overview.aiQuality?.summary?.conversion_impact_on_applications)} detail={`${formatPercent(overview.aiQuality?.summary?.schema_pass_rate)} schema`} />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-3">
                    <Panel title={t('admin_dashboard.sections.notifications', { defaultValue: 'Notifications (expiring trials)' })} subtitle={t('admin_dashboard.notifications.subtitle', { defaultValue: 'Nearest expirations' })}>
                      <div className="space-y-3">
                        {toArray<Dict>(overview.notifications?.items).length === 0 ? (
                          <div className="text-sm text-slate-500">
                            {t('admin_dashboard.notifications.empty_window', { defaultValue: 'No upcoming trial expirations in selected window.' })}
                          </div>
                        ) : null}
                        {toArray<Dict>(overview.notifications?.items).map((item) => (
                          <div key={String(item.subscription_id)} className="rounded-2xl border border-slate-200 px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="font-medium text-slate-900">{item.company_name || item.user_name || item.user_email || item.subscription_id}</div>
                                <div className="mt-1 text-sm text-slate-500">{item.tier} · {formatDateTime(item.current_period_end)}</div>
                              </div>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                                {item.severity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel title={t('admin_dashboard.sections.top_countries', { defaultValue: 'Top countries' })}>
                      <div className="space-y-3">
                        {toArray<Dict>(overview.stats?.traffic?.geo?.top_countries).map((item) => (
                          <div key={String(item.label)} className="flex items-center justify-between text-sm text-slate-700">
                            <span>{item.label}</span>
                            <span className="font-medium text-slate-900">{formatNumber(item.count)}</span>
                          </div>
                        ))}
                        {toArray<Dict>(overview.stats?.traffic?.geo?.top_countries).length === 0 ? <div className="text-sm text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</div> : null}
                      </div>
                    </Panel>

                    <Panel title={t('admin_dashboard.sections.top_devices', { defaultValue: 'Top devices' })}>
                      <div className="space-y-3">
                        {toArray<Dict>(overview.stats?.traffic?.geo?.top_devices).map((item) => (
                          <div key={String(item.label)} className="flex items-center justify-between text-sm text-slate-700">
                            <span>{item.label}</span>
                            <span className="font-medium text-slate-900">{formatNumber(item.count)}</span>
                          </div>
                        ))}
                        {toArray<Dict>(overview.stats?.traffic?.geo?.top_devices).length === 0 ? <div className="text-sm text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</div> : null}
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Panel title={t('admin_dashboard.sections.ai_token_trend', { defaultValue: 'AI token trend (14 days)' })}>
                      <div className="space-y-3">
                        {toArray<Dict>(overview.aiQuality?.token_usage_trend).map((row) => (
                          <div key={String(row.day)} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
                            <span className="text-slate-500">{row.day}</span>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min(100, Number(row.tokens_in || 0) / Math.max(1, Number(overview.aiQuality?.summary?.avg_tokens_per_generation || 1)))}%` }} />
                            </div>
                            <span className="font-medium text-slate-900">{formatNumber(Number(row.tokens_in || 0) + Number(row.tokens_out || 0))}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel title={t('admin_dashboard.sections.top_models_cost', { defaultValue: 'Top AI models by cost' })}>
                      <div className="space-y-3">
                        {toArray<Dict>(overview.aiQuality?.usage_by_model).map((row) => (
                          <div key={String(row.model)} className="flex items-center justify-between gap-3 text-sm">
                            <div>
                              <div className="font-medium text-slate-900">{row.model}</div>
                              <div className="text-slate-500">{formatNumber(row.requests)} {t('admin_dashboard.ai_quality.requests', { defaultValue: 'req' })}</div>
                            </div>
                            <div className="text-right font-medium text-slate-900">{formatCurrency(row.estimated_cost)}</div>
                          </div>
                        ))}
                        {toArray<Dict>(overview.aiQuality?.usage_by_model).length === 0 ? <div className="text-sm text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</div> : null}
                      </div>
                    </Panel>
                  </div>
                </>
              )}
            </>
          ) : null}

          {tab === 'operations' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_420px]">
              <Panel
                title={t('admin_dashboard.operations.title', { defaultValue: 'Subscription operations' })}
                subtitle={`${formatNumber(operations.count)} ${t('admin_dashboard.operations.total', { defaultValue: 'total' })}`}
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <Input value={operations.filters.q} onChange={(event) => setOperations((current) => ({ ...current, filters: { ...current.filters, q: event.target.value } }))} placeholder={t('admin_dashboard.operations.search_placeholder', { defaultValue: 'Search company/user/subscription' })} />
                  <Select value={operations.filters.tier} onChange={(event) => setOperations((current) => ({ ...current, filters: { ...current.filters, tier: event.target.value } }))}>
                    <option value="">{t('admin_dashboard.operations.all_tiers', { defaultValue: 'All tiers' })}</option>
                    {TIER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                  <Select value={operations.filters.status} onChange={(event) => setOperations((current) => ({ ...current, filters: { ...current.filters, status: event.target.value } }))}>
                    <option value="">{t('admin_dashboard.operations.all_statuses', { defaultValue: 'All statuses' })}</option>
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                  <Button onClick={() => void loadOperations()} disabled={operations.loading}>
                    {t('admin_dashboard.actions.refresh', { defaultValue: 'Refresh' })}
                  </Button>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="pb-3 pr-4">{t('admin_dashboard.table.subject', { defaultValue: 'Subject' })}</th>
                        <th className="pb-3 pr-4">{t('admin_dashboard.table.email', { defaultValue: 'Email' })}</th>
                        <th className="pb-3 pr-4">{t('admin_dashboard.table.tier', { defaultValue: 'Tier' })}</th>
                        <th className="pb-3 pr-4">{t('admin_dashboard.table.status', { defaultValue: 'Status' })}</th>
                        <th className="pb-3 pr-4">{t('admin_dashboard.table.validity', { defaultValue: 'Validity' })}</th>
                        <th className="pb-3">{t('admin_dashboard.table.actions', { defaultValue: 'Actions' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operationsRows.map((row) => {
                        const draft = subscriptionDrafts[String(row.id)] || {};
                        return (
                          <tr key={String(row.id)} className="border-b border-slate-100 align-top">
                            <td className="py-4 pr-4">
                              <div className="font-medium text-slate-900">{row.subject_name || row.company_name || row.user_name || row.user_email || row.id}</div>
                              <div className="mt-1 text-xs text-slate-500">{row.company_id || row.user_id || row.id}</div>
                            </td>
                            <td className="py-4 pr-4 text-slate-600">{row.subject_email || row.user_email || '-'}</td>
                            <td className="py-4 pr-4">
                              <Select value={draft.tier || row.tier || ''} onChange={(event) => handleSubscriptionDraftChange(String(row.id), 'tier', event.target.value)}>
                                {TIER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                              </Select>
                            </td>
                            <td className="py-4 pr-4">
                              <Select value={draft.status || row.status || ''} onChange={(event) => handleSubscriptionDraftChange(String(row.id), 'status', event.target.value)}>
                                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                              </Select>
                            </td>
                            <td className="py-4 pr-4">
                              <div className="text-slate-700">{formatDate(row.current_period_end)}</div>
                              <Input
                                className="mt-2"
                                value={draft.trialDays || ''}
                                onChange={(event) => handleSubscriptionDraftChange(String(row.id), 'trialDays', event.target.value)}
                                placeholder={t('admin_dashboard.operations.trial_days', { defaultValue: 'trial days' })}
                              />
                            </td>
                            <td className="py-4">
                              <div className="flex flex-wrap gap-2">
                                <Button tone="secondary" onClick={() => void saveSubscription(row)}>
                                  {t('admin_dashboard.operations.save', { defaultValue: 'Save' })}
                                </Button>
                                <Button tone="ghost" onClick={() => void openSubscriptionAudit(String(row.id))}>
                                  {t('admin_dashboard.crm.audit', { defaultValue: 'Audit' })}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {operationsRows.length === 0 ? <div className="py-6 text-sm text-slate-500">{t('admin_dashboard.table.no_records', { defaultValue: 'No records.' })}</div> : null}
                </div>
              </Panel>

              <Panel title={t('admin_dashboard.crm.audit', { defaultValue: 'Audit' })} subtitle={operations.selectedSubscriptionId || t('admin_dashboard.crm.audit_unavailable', { defaultValue: 'Audit unavailable' })}>
                {operations.auditLoading ? <div className="text-sm text-slate-500">{t('admin_dashboard.common.loading', { defaultValue: 'Loading...' })}</div> : null}
                {!operations.auditAvailable ? <div className="text-sm text-slate-500">{t('admin_dashboard.crm.audit_unavailable', { defaultValue: 'Audit unavailable' })}</div> : null}
                <div className="space-y-3">
                  {operations.audit.map((item) => (
                    <div key={String(item.id)} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-medium text-slate-900">{item.action || 'update'}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">{item.admin_email || '-'}</div>
                    </div>
                  ))}
                  {operations.audit.length === 0 && !operations.auditLoading ? <div className="text-sm text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</div> : null}
                </div>
              </Panel>
            </div>
          ) : null}

          {tab === 'crm' ? (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-6">
                <MetricCard label={t('admin_dashboard.crm.total_entities', { defaultValue: 'CRM entity' })} value={formatNumber(crmSummary.total)} />
                <MetricCard label={t('admin_dashboard.crm.companies', { defaultValue: 'Firmy' })} value={formatNumber(crmSummary.companies)} />
                <MetricCard label={t('admin_dashboard.crm.users', { defaultValue: 'Uživatelé' })} value={formatNumber(crmSummary.users)} />
                <MetricCard label={t('admin_dashboard.crm.leads', { defaultValue: 'Leady' })} value={formatNumber(crmSummary.leads)} />
                <MetricCard label={t('admin_dashboard.crm.with_subscription', { defaultValue: 'S předplatným' })} value={formatNumber(crmSummary.subscribed)} />
                <MetricCard label={t('admin_dashboard.crm.trialing', { defaultValue: 'Trialing' })} value={formatNumber(crmSummary.trialing)} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-6">
                  <Panel title={t('admin_dashboard.crm.add_lead', { defaultValue: 'Přidat firmu jako lead' })}>
                    <form className="space-y-3" onSubmit={handleLeadCreate}>
                      <Input value={leadForm.company_name} onChange={(event) => setLeadForm((current) => ({ ...current, company_name: event.target.value }))} placeholder={t('admin_dashboard.crm.company_name', { defaultValue: 'Firma' })} required />
                      <Input value={leadForm.contact_name} onChange={(event) => setLeadForm((current) => ({ ...current, contact_name: event.target.value }))} placeholder={t('admin_dashboard.crm.contact_name', { defaultValue: 'Kontaktní osoba' })} />
                      <Input value={leadForm.contact_role} onChange={(event) => setLeadForm((current) => ({ ...current, contact_role: event.target.value }))} placeholder={t('admin_dashboard.crm.contact_role', { defaultValue: 'Role' })} />
                      <Input value={leadForm.email} onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
                      <Input value={leadForm.phone} onChange={(event) => setLeadForm((current) => ({ ...current, phone: event.target.value }))} placeholder={t('admin_dashboard.crm.phone', { defaultValue: 'Telefon' })} />
                      <Textarea rows={4} value={leadForm.notes} onChange={(event) => setLeadForm((current) => ({ ...current, notes: event.target.value }))} placeholder={t('admin_dashboard.crm.notes', { defaultValue: 'Poznámka k leadu' })} />
                      <Button type="submit" disabled={leadSaving}>
                        {leadSaving ? t('admin_dashboard.common.saving', { defaultValue: 'Saving...' }) : t('admin_dashboard.crm.create_lead_cta', { defaultValue: 'Uložit lead' })}
                      </Button>
                    </form>
                  </Panel>

                  <Panel title={t('admin_dashboard.sections.admin_search', { defaultValue: 'Admin search' })}>
                    <div className="space-y-3">
                      <Input value={crm.filters.q} onChange={(event) => setCrm((current) => ({ ...current, filters: { ...current.filters, q: event.target.value } }))} placeholder={t('admin_dashboard.crm.search_placeholder', { defaultValue: 'Hledat firmu nebo uživatele…' })} />
                      <Select value={crm.filters.kind} onChange={(event) => setCrm((current) => ({ ...current, filters: { ...current.filters, kind: event.target.value } }))}>
                        <option value="all">{t('admin_dashboard.crm.kind_all', { defaultValue: 'Vše' })}</option>
                        <option value="company">{t('admin_dashboard.crm.companies', { defaultValue: 'Firmy' })}</option>
                        <option value="user">{t('admin_dashboard.crm.users', { defaultValue: 'Uživatelé' })}</option>
                      </Select>
                      <Select value={crm.filters.leadStatus} onChange={(event) => setCrm((current) => ({ ...current, filters: { ...current.filters, leadStatus: event.target.value } }))}>
                        <option value="">{t('admin_dashboard.crm.timeline_all', { defaultValue: 'All' })}</option>
                        {LEAD_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </Select>
                      <Button onClick={() => void loadCrm()}>{t('admin_dashboard.actions.refresh', { defaultValue: 'Refresh' })}</Button>
                    </div>
                  </Panel>

                  <Panel title={t('admin_dashboard.crm.title', { defaultValue: 'CRM' })}>
                    <div className="space-y-2">
                      {crm.entities.map((item) => (
                        <button
                          key={`${item.kind}:${item.id}`}
                          type="button"
                          onClick={() => void loadCrmDetail(item.kind, String(item.id))}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            crm.selectedKind === item.kind && crm.selectedId === String(item.id)
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="font-medium">{item.label}</div>
                          <div className={`mt-1 text-xs ${crm.selectedKind === item.kind && crm.selectedId === String(item.id) ? 'text-slate-200' : 'text-slate-500'}`}>{item.secondary}</div>
                        </button>
                      ))}
                      {crm.leads.map((item) => (
                        <button
                          key={`lead:${item.id}`}
                          type="button"
                          onClick={() => void loadCrmDetail('lead', String(item.id))}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            crm.selectedKind === 'lead' && crm.selectedId === String(item.id)
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-amber-200 bg-amber-50 hover:border-amber-300'
                          }`}
                        >
                          <div className="font-medium">{item.company_name}</div>
                          <div className={`mt-1 text-xs ${crm.selectedKind === 'lead' && crm.selectedId === String(item.id) ? 'text-slate-200' : 'text-slate-500'}`}>{item.status || 'lead'}</div>
                        </button>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div className="space-y-6">
                  <Panel title={t('admin_dashboard.crm.job_reaction_breakdown', { defaultValue: 'Reakce podle pozice' })}>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-500">
                          <tr>
                            <th className="pb-3 pr-4">{t('admin_dashboard.crm.position', { defaultValue: 'Pozice' })}</th>
                            <th className="pb-3 pr-4">{t('admin_dashboard.crm.people', { defaultValue: 'Lidé' })}</th>
                            <th className="pb-3 pr-4">{t('admin_dashboard.crm.handshakes', { defaultValue: 'Handshakes' })}</th>
                            <th className="pb-3">{t('admin_dashboard.crm.recent_activity', { defaultValue: 'Recent activity' })}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crm.jobSummary.map((item, index) => (
                            <tr key={`${item.job_id || item.position || index}`} className="border-b border-slate-100">
                              <td className="py-3 pr-4 font-medium text-slate-900">{item.job_title || item.position || item.job_id}</td>
                              <td className="py-3 pr-4 text-slate-600">{formatNumber(item.unique_users_90d || item.people || item.unique_users || 0)}</td>
                              <td className="py-3 pr-4 text-slate-600">{formatNumber(item.applications_total || item.handshakes || 0)}</td>
                              <td className="py-3 text-slate-600">{formatNumber(item.interaction_total_90d || item.interactions_total || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>

                  <Panel title={crm.selectedId ? `${crm.selectedKind}: ${crm.selectedId}` : t('admin_dashboard.crm.select_entity', { defaultValue: 'Vyberte záznam vlevo pro detail CRM.' })}>
                    {crm.detailLoading ? <div className="text-sm text-slate-500">{t('admin_dashboard.common.loading', { defaultValue: 'Loading...' })}</div> : null}
                    {crm.detailError ? <div className="text-sm text-red-600">{crm.detailError}</div> : null}
                    {!crm.detailLoading && !crm.detail && !crm.detailError ? <div className="text-sm text-slate-500">{t('admin_dashboard.crm.select_entity', { defaultValue: 'Vyberte záznam vlevo pro detail CRM.' })}</div> : null}

                    {crm.detail ? (
                      <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          {detailMetrics.map(([key, value]) => (
                            <MetricCard key={key} label={t(`admin_dashboard.crm.metrics.${key}`, { defaultValue: key })} value={formatNumber(value)} />
                          ))}
                        </div>

                        <div className="grid gap-6 xl:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-sm font-semibold text-slate-900">{t('admin_dashboard.crm.entity_overview', { defaultValue: 'Souhrn entity' })}</div>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              {Object.entries(crm.detail.entity || {}).slice(0, 16).map(([key, value]) => (
                                <div key={key} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                                  <span className="text-slate-500">{key}</span>
                                  <span className="max-w-[65%] break-words text-right">{String(value ?? '-')}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-sm font-semibold text-slate-900">{t('admin_dashboard.crm.timeline', { defaultValue: 'Timeline' })}</div>
                            <div className="mt-3 space-y-3">
                              {detailTimeline.map((item) => (
                                <div key={String(item.id)} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium text-slate-900">{item.title}</div>
                                    <div className="text-xs text-slate-500">{formatDateTime(item.timestamp)}</div>
                                  </div>
                                  <div className="mt-1 text-sm text-slate-600">{item.detail || item.type}</div>
                                </div>
                              ))}
                              {detailTimeline.length === 0 ? <div className="text-sm text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</div> : null}
                            </div>
                          </div>
                        </div>

                        {crm.selectedKind === 'lead' ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Select value={crm.detail.entity?.status || ''} onChange={(event) => setCrm((current) => ({ ...current, detail: { ...current.detail, entity: { ...current.detail?.entity, status: event.target.value } } }))}>
                              {LEAD_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </Select>
                            <Select value={crm.detail.entity?.priority || 'medium'} onChange={(event) => setCrm((current) => ({ ...current, detail: { ...current.detail, entity: { ...current.detail?.entity, priority: event.target.value } } }))}>
                              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </Select>
                            <Input value={crm.detail.entity?.next_follow_up_at || ''} onChange={(event) => setCrm((current) => ({ ...current, detail: { ...current.detail, entity: { ...current.detail?.entity, next_follow_up_at: event.target.value } } }))} placeholder="2026-04-20T10:00:00Z" />
                            <Button onClick={() => void handleLeadUpdate()}>{t('admin_dashboard.common.save', { defaultValue: 'Save' })}</Button>
                            <div className="md:col-span-2">
                              <Textarea rows={4} value={crm.detail.entity?.notes || ''} onChange={(event) => setCrm((current) => ({ ...current, detail: { ...current.detail, entity: { ...current.detail?.entity, notes: event.target.value } } }))} />
                            </div>
                          </div>
                        ) : null}

                        {crm.selectedKind === 'user' && digestDraft ? (
                          <Panel title={t('admin_dashboard.crm.digest', { defaultValue: 'User digest notifications' })}>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                                <input type="checkbox" checked={Boolean(digestDraft.daily_digest_enabled)} onChange={(event) => setDigestDraft((current) => ({ ...(current || {}), daily_digest_enabled: event.target.checked }))} />
                                {t('admin_dashboard.digest.email_digest', { defaultValue: 'Email digest' })}
                              </label>
                              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                                <input type="checkbox" checked={Boolean(digestDraft.daily_digest_push_enabled)} onChange={(event) => setDigestDraft((current) => ({ ...(current || {}), daily_digest_push_enabled: event.target.checked }))} />
                                {t('admin_dashboard.digest.push_digest', { defaultValue: 'Push digest' })}
                              </label>
                              <Input value={digestDraft.daily_digest_time || ''} onChange={(event) => setDigestDraft((current) => ({ ...(current || {}), daily_digest_time: event.target.value }))} placeholder={t('admin_dashboard.digest.time', { defaultValue: 'Time' })} />
                              <Input value={digestDraft.daily_digest_timezone || ''} onChange={(event) => setDigestDraft((current) => ({ ...(current || {}), daily_digest_timezone: event.target.value }))} placeholder={t('admin_dashboard.digest.timezone', { defaultValue: 'Timezone' })} />
                              <div className="md:col-span-2">
                                <Button onClick={() => void handleDigestSave()}>{t('admin_dashboard.common.save', { defaultValue: 'Save' })}</Button>
                              </div>
                            </div>
                          </Panel>
                        ) : null}

                        <div className="grid gap-6 xl:grid-cols-2">
                          {Object.entries(detailBreakdowns).map(([key, value]) => (
                            <div key={key} className="rounded-2xl border border-slate-200 p-4">
                              <div className="text-sm font-semibold text-slate-900">{key}</div>
                              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(value, null, 2)}</pre>
                            </div>
                          ))}
                          {Object.entries(detailRecent).map(([key, value]) => (
                            <div key={key} className="rounded-2xl border border-slate-200 p-4">
                              <div className="text-sm font-semibold text-slate-900">{key}</div>
                              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(value, null, 2)}</pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Panel>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'workspace' ? (
            <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <div className="space-y-6">
                <Panel title={t('admin_dashboard.workspace.create', { defaultValue: 'Create' })}>
                  <form className="space-y-3" onSubmit={handleWorkspaceCreate}>
                    <Input value={workspaceForm.title} onChange={(event) => setWorkspaceForm((current) => ({ ...current, title: event.target.value }))} placeholder={t('admin_dashboard.workspace.title', { defaultValue: 'Title' })} required />
                    <Textarea rows={5} value={workspaceForm.body} onChange={(event) => setWorkspaceForm((current) => ({ ...current, body: event.target.value }))} placeholder={t('admin_dashboard.workspace.body', { defaultValue: 'Body' })} />
                    <Select value={workspaceForm.status} onChange={(event) => setWorkspaceForm((current) => ({ ...current, status: event.target.value as WorkspaceFormState['status'] }))}>
                      {BOARD_STATUS_COLUMNS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                    <Select value={workspaceForm.priority} onChange={(event) => setWorkspaceForm((current) => ({ ...current, priority: event.target.value as WorkspaceFormState['priority'] }))}>
                      {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                    <Button type="submit" disabled={workspaceSaving}>
                      {workspaceSaving ? t('admin_dashboard.common.saving', { defaultValue: 'Saving...' }) : t('admin_dashboard.workspace.create_cta', { defaultValue: 'Create task' })}
                    </Button>
                  </form>
                </Panel>

                <Panel title={t('admin_dashboard.workspace.search', { defaultValue: 'Search' })}>
                  <div className="space-y-3">
                    <Input value={workspace.filters.q} onChange={(event) => setWorkspace((current) => ({ ...current, filters: { ...current.filters, q: event.target.value } }))} placeholder={t('admin_dashboard.workspace.search', { defaultValue: 'Search' })} />
                    <Select value={workspace.filters.status} onChange={(event) => setWorkspace((current) => ({ ...current, filters: { ...current.filters, status: event.target.value } }))}>
                      <option value="">{t('admin_dashboard.workspace.all_statuses', { defaultValue: 'All statuses' })}</option>
                      {BOARD_STATUS_COLUMNS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                    <Button onClick={() => void loadWorkspace()}>{t('admin_dashboard.actions.refresh', { defaultValue: 'Refresh' })}</Button>
                  </div>
                </Panel>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                {BOARD_STATUS_COLUMNS.map((column) => (
                  <Panel key={column} title={t(`admin_dashboard.workspace.column_${column}`, { defaultValue: column })} className="min-h-[360px]">
                    <div className="space-y-4">
                      {workspaceColumns[column].map((card) => (
                        <div key={String(card.id)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">{card.title}</div>
                              <div className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{card.priority || 'medium'}</div>
                            </div>
                            <Select className="max-w-[140px]" value={card.status || 'inbox'} onChange={(event) => void handleWorkspaceUpdate(String(card.id), { status: event.target.value })}>
                              {BOARD_STATUS_COLUMNS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </Select>
                          </div>
                          {card.body ? <div className="mt-3 text-sm leading-6 text-slate-600">{card.body}</div> : null}
                          <div className="mt-3 text-xs text-slate-500">{card.assignee_name || t('admin_dashboard.workspace.unassigned', { defaultValue: 'Unassigned' })}</div>
                          <div className="mt-4 space-y-2">
                            {toArray<Dict>(card.comments).map((comment) => (
                              <div key={String(comment.id)} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                                <div className="font-medium text-slate-900">{comment.author_name || comment.author_admin_email || 'Admin'}</div>
                                <div className="mt-1">{comment.body}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Input value={workspaceCommentDrafts[String(card.id)] || ''} onChange={(event) => setWorkspaceCommentDrafts((current) => ({ ...current, [String(card.id)]: event.target.value }))} placeholder={t('admin_dashboard.workspace.comment_placeholder', { defaultValue: 'Add comment' })} />
                            <Button tone="secondary" onClick={() => void handleWorkspaceComment(String(card.id))}>
                              {t('admin_dashboard.workspace.add_comment', { defaultValue: 'Add comment' })}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {workspaceColumns[column].length === 0 ? <div className="text-sm text-slate-500">{t('admin_dashboard.workspace.empty', { defaultValue: 'No cards in this column.' })}</div> : null}
                    </div>
                  </Panel>
                ))}
              </div>
            </div>
          ) : null}

          {tab === 'jcfpm' ? (
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Panel title={t('admin_dashboard.jcfpm.title', { defaultValue: 'JCFPM Role Profiles' })}>
                <div className="space-y-3">
                  <Input value={roleState.filters.q} onChange={(event) => setRoleState((current) => ({ ...current, filters: { ...current.filters, q: event.target.value } }))} placeholder={t('admin_dashboard.jcfpm.search_placeholder', { defaultValue: 'Search title...' })} />
                  <div className="flex gap-2">
                    <Button onClick={() => void loadJobRoles()}>{t('admin_dashboard.actions.refresh', { defaultValue: 'Refresh' })}</Button>
                    <Button tone="secondary" onClick={() => { setRoleState((current) => ({ ...current, selectedRoleId: null })); setRoleForm(DEFAULT_ROLE_FORM); }}>
                      {t('admin_dashboard.jcfpm.create', { defaultValue: 'Create' })}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {roleState.items.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => setRoleState((current) => ({ ...current, selectedRoleId: String(item.id) }))}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        roleState.selectedRoleId === String(item.id) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium">{item.title}</div>
                      <div className={`mt-1 text-xs ${roleState.selectedRoleId === String(item.id) ? 'text-slate-200' : 'text-slate-500'}`}>{item.salary_range || '-'}</div>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title={roleState.selectedRoleId ? t('admin_dashboard.jcfpm.update', { defaultValue: 'Update' }) : t('admin_dashboard.jcfpm.create_title', { defaultValue: 'Create role' })}>
                <form className="space-y-4" onSubmit={handleRoleSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={roleForm.title} onChange={(event) => setRoleForm((current) => ({ ...current, title: event.target.value }))} placeholder={t('admin_dashboard.jcfpm.fields.title', { defaultValue: 'Title' })} required />
                    <Input value={roleForm.salary_range} onChange={(event) => setRoleForm((current) => ({ ...current, salary_range: event.target.value }))} placeholder={t('admin_dashboard.jcfpm.fields.salary_range', { defaultValue: 'Salary range' })} />
                    <Input value={roleForm.growth_potential} onChange={(event) => setRoleForm((current) => ({ ...current, growth_potential: event.target.value }))} placeholder={t('admin_dashboard.jcfpm.fields.growth_potential', { defaultValue: 'Growth potential' })} />
                    <Input value={roleForm.ai_impact} onChange={(event) => setRoleForm((current) => ({ ...current, ai_impact: event.target.value }))} placeholder={t('admin_dashboard.jcfpm.fields.ai_impact', { defaultValue: 'AI impact' })} />
                    <Input value={roleForm.ai_intensity} onChange={(event) => setRoleForm((current) => ({ ...current, ai_intensity: event.target.value }))} placeholder={t('admin_dashboard.jcfpm.fields.ai_intensity', { defaultValue: 'AI intensity' })} />
                    <Input value={roleForm.remote_friendly} onChange={(event) => setRoleForm((current) => ({ ...current, remote_friendly: event.target.value }))} placeholder={t('admin_dashboard.jcfpm.fields.remote_friendly', { defaultValue: 'Remote friendly' })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((field) => (
                      <Input key={field} type="number" step="0.1" value={(roleForm as Record<string, string>)[field]} onChange={(event) => setRoleForm((current) => ({ ...current, [field]: event.target.value }))} placeholder={field.toUpperCase()} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={roleSaving}>
                      {roleSaving ? t('admin_dashboard.common.saving', { defaultValue: 'Saving...' }) : roleState.selectedRoleId ? t('admin_dashboard.jcfpm.update', { defaultValue: 'Update' }) : t('admin_dashboard.jcfpm.create', { defaultValue: 'Create' })}
                    </Button>
                    {roleState.selectedRoleId ? (
                      <Button type="button" tone="danger" onClick={() => void handleRoleDelete()}>
                        {t('admin_dashboard.jcfpm.delete', { defaultValue: 'Delete' })}
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Panel>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
