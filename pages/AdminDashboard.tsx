import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Building2,
  Clock3,
  Download,
  Globe,
  Layers,
  Lightbulb,
  Mail,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types';
import { BACKEND_URL } from '../constants';
import {
  createAdminCrmLead,
  createAdminFounderBoardComment,
  createAdminFounderBoardCard,
  createAdminJobRole,
  deleteAdminJobRole,
  getAdminAiQuality,
  getAdminCrmEntities,
  getAdminCrmEntityDetail,
  getAdminCrmJobReactionsSummary,
  getAdminCrmLeads,
  getAdminFounderBoard,
  getAdminJobRoles,
  getAdminNotifications,
  getAdminSubscriptionAudit,
  getAdminStats,
  getAdminUserDigest,
  updateAdminCrmLead,
  updateAdminFounderBoardCard,
  updateAdminJobRole,
  updateAdminSubscription,
  updateAdminUserDigest,
} from '../services/adminService';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../components/ui/primitives';

interface AdminDashboardProps {
  userProfile: UserProfile;
}

type ViewMode = 'overview' | 'crm' | 'workspace' | 'jcfpm';
type CrmEntityKind = 'company' | 'user' | 'lead';

type CrmRecord = {
  key: string;
  entityKind: CrmEntityKind;
  entityId: string;
  label: string;
  secondary?: string;
  subscription?: any | null;
  subscriptionId?: string | null;
  source: 'subscription' | 'lookup' | 'entity';
};

const TIERS = ['free', 'premium', 'starter', 'growth', 'professional', 'trial', 'enterprise'];
const STATUSES = ['active', 'trialing', 'inactive', 'canceled'];
const CRM_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'meeting', 'proposal', 'won', 'lost'] as const;
const CRM_LEAD_PRIORITIES = ['low', 'medium', 'high'] as const;
const CRM_LEAD_SOURCES = ['manual', 'outbound', 'inbound', 'referral', 'event'] as const;
const FOUNDER_CARD_TYPES = ['idea', 'opinion', 'task', 'note'] as const;
const FOUNDER_CARD_STATUSES = ['inbox', 'active', 'done', 'archived'] as const;
const FOUNDER_CARD_PRIORITIES = ['low', 'medium', 'high'] as const;
const FOUNDER_BOARD_COLUMN_KEYS = ['inbox', 'active', 'done'] as const;

const num = (value: any) => Number(value) || 0;

const AdminDashboard: React.FC<AdminDashboardProps> = ({ userProfile }) => {
  const { t, i18n } = useTranslation();

  const [view, setView] = useState<ViewMode>('overview');
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any | null>(null);
  const [aiQuality, setAiQuality] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [jobRoles, setJobRoles] = useState<any[]>([]);
  const [jobRolesQuery, setJobRolesQuery] = useState('');
  const [jobRoleEdits, setJobRoleEdits] = useState<Record<string, any>>({});
  const [jobRoleCreate, setJobRoleCreate] = useState({
    title: '', d1: '', d2: '', d3: '', d4: '', d5: '', d6: '',
    salary_range: '', growth_potential: '', ai_impact: '', ai_intensity: 'medium', remote_friendly: '',
  });
  const [crmQuery, setCrmQuery] = useState('');
  const [crmKind, setCrmKind] = useState<'all' | CrmEntityKind>('all');
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmRecords, setCrmRecords] = useState<CrmRecord[]>([]);
  const [crmTopJobs, setCrmTopJobs] = useState<any[]>([]);
  const [crmTopJobsCollapsed, setCrmTopJobsCollapsed] = useState(false);
  const [crmTopJobsCompanyFilter, setCrmTopJobsCompanyFilter] = useState('');
  const [crmTopJobsPositionFilter, setCrmTopJobsPositionFilter] = useState('');
  const [selectedCrmKey, setSelectedCrmKey] = useState<string | null>(null);
  const [crmDraft, setCrmDraft] = useState({
    tier: 'free',
    status: 'inactive',
    set_trial_days: '',
    set_trial_until: ''
  });
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmDigest, setCrmDigest] = useState<any | null>(null);
  const [crmDigestDraft, setCrmDigestDraft] = useState({
    daily_digest_enabled: true,
    daily_digest_push_enabled: false,
    daily_digest_time: '07:30',
    daily_digest_timezone: 'Europe/Prague'
  });
  const [crmDigestSaving, setCrmDigestSaving] = useState(false);
  const [crmAuditLoading, setCrmAuditLoading] = useState(false);
  const [crmAuditItems, setCrmAuditItems] = useState<any[]>([]);
  const [crmAuditAvailable, setCrmAuditAvailable] = useState(true);
  const [crmDetailLoading, setCrmDetailLoading] = useState(false);
  const [crmEntityDetail, setCrmEntityDetail] = useState<any | null>(null);
  const [crmTimelineFilter, setCrmTimelineFilter] = useState<string>('all');
  const [crmJobFilter, setCrmJobFilter] = useState<string>('all');
  const [crmLeadSaving, setCrmLeadSaving] = useState(false);
  const [crmLeadCreate, setCrmLeadCreate] = useState({
    company_name: '',
    contact_name: '',
    contact_role: '',
    email: '',
    phone: '',
    website: '',
    city: '',
    country: '',
    status: 'new',
    priority: 'medium',
    source: 'manual',
    notes: '',
    next_follow_up_at: '',
  });
  const [crmLeadEdit, setCrmLeadEdit] = useState({
    company_name: '',
    contact_name: '',
    contact_role: '',
    email: '',
    phone: '',
    website: '',
    city: '',
    country: '',
    status: 'new',
    priority: 'medium',
    source: 'manual',
    notes: '',
    next_follow_up_at: '',
    last_contacted_at: '',
  });
  const [founderBoardLoading, setFounderBoardLoading] = useState(false);
  const [founderBoardUnsupported, setFounderBoardUnsupported] = useState(false);
  const [founderCards, setFounderCards] = useState<any[]>([]);
  const [founderBoardQuery, setFounderBoardQuery] = useState('');
  const [founderBoardStatus, setFounderBoardStatus] = useState<'all' | (typeof FOUNDER_CARD_STATUSES)[number]>('all');
  const [founderBoardSaving, setFounderBoardSaving] = useState(false);
  const [founderCommentSavingId, setFounderCommentSavingId] = useState<string | null>(null);
  const [founderCommentDrafts, setFounderCommentDrafts] = useState<Record<string, string>>({});
  const [founderCardCreate, setFounderCardCreate] = useState({
    title: '',
    body: '',
    card_type: 'idea',
    status: 'inbox',
    priority: 'medium',
    assignee_name: '',
    assignee_email: '',
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
  const panelClass = 'app-surface rounded-[1.08rem] border p-4 shadow-[var(--shadow-soft)]';
  const panelSoftClass = 'company-surface-soft rounded-[0.95rem] border p-3';
  const inputClass = 'company-control w-full rounded-[0.82rem] px-3 py-2 text-sm outline-none';

  const handleAuthError = (message: string) => {
    const lower = String(message || '').toLowerCase();
    const isForbiddenError =
      lower.includes('admin access required') ||
      lower.includes('access denied') ||
      lower.includes('forbidden') ||
      lower.includes('csrf validation failed') ||
      lower.includes('permission denied') ||
      lower.includes('rls') ||
      lower.includes('401') ||
      lower.includes('403');
    if (isForbiddenError) {
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
      const [statsResult, aiResult, notifResult] = await Promise.allSettled([
        getAdminStats(),
        getAdminAiQuality(30),
        getAdminNotifications(7),
      ]);

      const nextStats = statsResult.status === 'fulfilled' ? (statsResult.value || null) : null;
      const nextAiQuality = aiResult.status === 'fulfilled' ? (aiResult.value || null) : null;
      const nextNotifications = notifResult.status === 'fulfilled' ? (notifResult.value?.items || []) : [];

      setStats(nextStats);
      setAiQuality(nextAiQuality);
      setNotifications(nextNotifications);

      const failures = [statsResult, aiResult, notifResult].filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length === 3) {
        throw new Error(failures[0]?.reason?.message || 'Failed to load dashboard overview');
      }
      if (failures.length > 0) {
        setError(t('admin_dashboard.partial_data', { defaultValue: 'Část admin dat se nepodařilo načíst. Zbytek přehledu je dostupný.' }));
      }
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to load dashboard overview');
    } finally {
      setLoading(false);
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

  const loadFounderBoard = async () => {
    setFounderBoardLoading(true);
    try {
      const data = await getAdminFounderBoard({
        q: founderBoardQuery || undefined,
        status: founderBoardStatus === 'all' ? undefined : founderBoardStatus,
        limit: 160,
      });
      setFounderBoardUnsupported(Boolean((data as any)?.unsupported));
      setFounderCards(data.items || []);
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to load founder board');
      setFounderBoardUnsupported(false);
      setFounderCards([]);
    } finally {
      setFounderBoardLoading(false);
    }
  };

  const toCrmRecordFromEntity = (item: any): CrmRecord => ({
    key: `entity:${item.kind}:${item.id}`,
    entityKind: item.kind === 'company' ? 'company' : 'user',
    entityId: String(item.id),
    label: item.label || item.id,
    secondary: item.secondary || '',
    subscription: item.subscription || null,
    subscriptionId: item.subscription?.id || null,
    source: item.subscription ? 'subscription' : 'entity',
  });

  const toCrmRecordFromLead = (lead: any): CrmRecord => ({
    key: `lead:${lead.id}`,
    entityKind: 'lead',
    entityId: String(lead.id),
    label: lead.company_name || lead.id,
    secondary: [lead.contact_name, lead.contact_role, lead.email || lead.phone].filter(Boolean).join(' • '),
    subscription: null,
    subscriptionId: null,
    source: 'lookup',
  });

  const loadCrmWorkspace = async () => {
    setCrmLoading(true);
    setError(null);
    try {
      const normalizedQuery = crmQuery.trim();
      const entitiesPromise = crmKind === 'lead'
        ? Promise.resolve({ items: [] as any[] })
        : getAdminCrmEntities({
            q: normalizedQuery || undefined,
            kind: crmKind === 'all' ? 'all' : crmKind,
            limit: 300,
          });
      const leadsPromise = crmKind === 'all' || crmKind === 'lead'
        ? getAdminCrmLeads({ q: normalizedQuery || undefined, limit: 120, offset: 0 })
        : Promise.resolve({ items: [] as any[] });
      const topJobsPromise = getAdminCrmJobReactionsSummary({
        q: normalizedQuery || undefined,
        limit: 20,
        window_days: 90,
      });

      const [entitiesData, leadsData, topJobsData] = await Promise.all([entitiesPromise, leadsPromise, topJobsPromise]);
      const entityRows: CrmRecord[] = (entitiesData?.items || []).map((item: any) => toCrmRecordFromEntity(item));
      const leadRows: CrmRecord[] = (leadsData?.items || []).map((lead: any) => toCrmRecordFromLead(lead));
      const entityToRecord = new Map<string, CrmRecord>();

      entityRows.forEach((row) => {
        entityToRecord.set(`${row.entityKind}:${row.entityId}`, row);
      });
      leadRows.forEach((row) => {
        entityToRecord.set(`${row.entityKind}:${row.entityId}`, row);
      });

      const records = Array.from(entityToRecord.values()).sort((a, b) => {
        const aWeight = a.subscription ? 0 : 1;
        const bWeight = b.subscription ? 0 : 1;
        if (aWeight !== bWeight) return aWeight - bWeight;
        return a.label.localeCompare(b.label, i18n.language || 'cs');
      });

      setCrmRecords(records);
      setCrmTopJobs(topJobsData?.items || []);
      setSelectedCrmKey((prev) => (prev && records.some((row) => row.key === prev) ? prev : records[0]?.key || null));
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to load CRM workspace');
      setCrmRecords([]);
      setCrmTopJobs([]);
      setSelectedCrmKey(null);
    } finally {
      setCrmLoading(false);
    }
  };

  useEffect(() => {
    if (!userProfile?.isLoggedIn) return;
    loadOverview();
  }, [userProfile?.isLoggedIn]);

  useEffect(() => {
    if (!userProfile?.isLoggedIn || view !== 'jcfpm') return;
    loadJobRoles();
  }, [userProfile?.isLoggedIn, view, jobRolesQuery]);

  useEffect(() => {
    if (!userProfile?.isLoggedIn || view !== 'crm') return;
    loadCrmWorkspace();
  }, [userProfile?.isLoggedIn, view, crmKind]);

  useEffect(() => {
    if (!userProfile?.isLoggedIn || view !== 'workspace') return;
    loadFounderBoard();
  }, [userProfile?.isLoggedIn, view, founderBoardStatus]);

  const selectedCrmRecord = useMemo(
    () => crmRecords.find((row) => row.key === selectedCrmKey) || null,
    [crmRecords, selectedCrmKey]
  );

  useEffect(() => {
    let cancelled = false;

    const hydrateCrmDetail = async () => {
      if (!selectedCrmRecord) {
        setCrmDigest(null);
        setCrmAuditItems([]);
        setCrmAuditAvailable(true);
        setCrmEntityDetail(null);
        return;
      }

      const sub = selectedCrmRecord.subscription;
      setCrmTimelineFilter('all');
      setCrmJobFilter('all');
      setCrmDraft({
        tier: sub?.tier || 'free',
        status: sub?.status || 'inactive',
        set_trial_days: '',
        set_trial_until: ''
      });

      setCrmDetailLoading(true);
      try {
        const detail = await getAdminCrmEntityDetail(selectedCrmRecord.entityKind, selectedCrmRecord.entityId);
        if (!cancelled) {
          setCrmEntityDetail(detail || null);
        }
      } catch {
        if (!cancelled) setCrmEntityDetail(null);
      } finally {
        if (!cancelled) setCrmDetailLoading(false);
      }

      if (selectedCrmRecord.entityKind === 'user') {
        try {
          const digest = await getAdminUserDigest(selectedCrmRecord.entityId);
          if (!cancelled) {
            setCrmDigest(digest);
            setCrmDigestDraft({
              daily_digest_enabled: Boolean(digest?.daily_digest_enabled),
              daily_digest_push_enabled: Boolean(digest?.daily_digest_push_enabled),
              daily_digest_time: digest?.daily_digest_time || '07:30',
              daily_digest_timezone: digest?.daily_digest_timezone || 'Europe/Prague'
            });
          }
        } catch {
          if (!cancelled) setCrmDigest(null);
        }
      } else {
        setCrmDigest(null);
      }

      if (selectedCrmRecord.entityKind === 'lead') {
        setCrmAuditItems([]);
        setCrmAuditAvailable(true);
      } else if (sub?.id) {
        setCrmAuditLoading(true);
        try {
          const audit = await getAdminSubscriptionAudit(sub.id, 20);
          if (!cancelled) {
            setCrmAuditItems(audit?.items || []);
            setCrmAuditAvailable(audit?.audit_available !== false);
          }
        } catch {
          if (!cancelled) {
            setCrmAuditItems([]);
            setCrmAuditAvailable(false);
          }
        } finally {
          if (!cancelled) setCrmAuditLoading(false);
        }
      } else {
        setCrmAuditItems([]);
        setCrmAuditAvailable(true);
      }
    };

    hydrateCrmDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedCrmRecord]);

  useEffect(() => {
    if (selectedCrmRecord?.entityKind !== 'lead') return;
    const entity = crmEntityDetail?.entity || {};
    setCrmLeadEdit({
      company_name: entity.company_name || '',
      contact_name: entity.contact_name || '',
      contact_role: entity.contact_role || '',
      email: entity.email || '',
      phone: entity.phone || '',
      website: entity.website || '',
      city: entity.city || '',
      country: entity.country || '',
      status: entity.status || 'new',
      priority: entity.priority || 'medium',
      source: entity.source || 'manual',
      notes: entity.notes || '',
      next_follow_up_at: entity.next_follow_up_at ? String(entity.next_follow_up_at).slice(0, 16) : '',
      last_contacted_at: entity.last_contacted_at ? String(entity.last_contacted_at).slice(0, 16) : '',
    });
  }, [selectedCrmRecord?.entityKind, crmEntityDetail]);

  const kpis = useMemo(() => {
    const users = stats?.users || {};
    const companies = stats?.companies || {};
    const conv = stats?.conversion || {};
    const ai = aiQuality?.summary || {};
    return [
      { label: t('admin_dashboard.kpis.users'), value: formatNumber(users.total), hint: `+${formatNumber(users.new_30d)} / 30d`, icon: Users },
      { label: t('admin_dashboard.kpis.companies'), value: formatNumber(companies.total), hint: `+${formatNumber(companies.new_30d)} / 30d`, icon: Building2 },
      { label: t('admin_dashboard.kpis.paid_conversion'), value: `${formatPercent(conv.company_paid_percent)} / ${formatPercent(conv.user_paid_percent)}`, hint: 'Company / User', icon: Activity },
      { label: t('admin_dashboard.kpis.ai_generations'), value: formatNumber(ai.total_generations), hint: `${formatNumber(ai.ai_unique_users)} unique AI users`, icon: Brain },
      { label: t('admin_dashboard.kpis.ai_cost'), value: formatUsd(ai.total_estimated_cost), hint: `Avg ${formatUsd(ai.avg_estimated_cost_per_generation)}`, icon: Sparkles },
      { label: t('admin_dashboard.kpis.apply_uplift'), value: formatPercent(ai.conversion_impact_on_applications), hint: `AI ${formatPercent(ai.ai_apply_rate)} vs baseline ${formatPercent(ai.baseline_apply_rate)}`, icon: BarChart3 },
    ];
  }, [stats, aiQuality, t]);

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
  const crmSummary = useMemo(() => {
    const companies = crmRecords.filter((row) => row.entityKind === 'company').length;
    const users = crmRecords.filter((row) => row.entityKind === 'user').length;
    const leads = crmRecords.filter((row) => row.entityKind === 'lead').length;
    const subscribed = crmRecords.filter((row) => Boolean(row.subscription)).length;
    const trialing = crmRecords.filter((row) => row.subscription?.status === 'trialing').length;
    return {
      total: crmRecords.length,
      companies,
      users,
      leads,
      subscribed,
      trialing,
    };
  }, [crmRecords]);
  const crmFilteredTopJobs = useMemo(() => {
    const companyNeedle = crmTopJobsCompanyFilter.trim().toLowerCase();
    const positionNeedle = crmTopJobsPositionFilter.trim().toLowerCase();
    return crmTopJobs.filter((row: any) => {
      const companyHaystack = String(row?.company || '').toLowerCase();
      const positionHaystack = String(row?.job_title || '').toLowerCase();
      if (companyNeedle && !companyHaystack.includes(companyNeedle)) return false;
      if (positionNeedle && !positionHaystack.includes(positionNeedle)) return false;
      return true;
    });
  }, [crmTopJobs, crmTopJobsCompanyFilter, crmTopJobsPositionFilter]);
  const crmMetricCards = useMemo(() => {
    const metrics = crmEntityDetail?.metrics || {};
    const isCompany = crmEntityDetail?.kind === 'company';
    const isLead = crmEntityDetail?.kind === 'lead';
    const items = isLead
      ? [
        { label: t('admin_dashboard.crm.metrics.days_open', { defaultValue: 'Dní v pipeline' }), value: metrics.days_open },
        { label: t('admin_dashboard.crm.metrics.follow_up_scheduled', { defaultValue: 'Naplánovaný follow-up' }), value: metrics.follow_up_scheduled },
        { label: t('admin_dashboard.crm.metrics.has_email', { defaultValue: 'Má e-mail' }), value: metrics.has_email },
        { label: t('admin_dashboard.crm.metrics.has_phone', { defaultValue: 'Má telefon' }), value: metrics.has_phone },
        { label: t('admin_dashboard.crm.metrics.linked_company', { defaultValue: 'Navázaná firma' }), value: metrics.linked_company },
      ]
      : isCompany
      ? [
        { label: t('admin_dashboard.crm.metrics.jobs_active', { defaultValue: 'Aktivní role' }), value: metrics.jobs_active },
        { label: t('admin_dashboard.crm.metrics.jobs_total', { defaultValue: 'Role celkem' }), value: metrics.jobs_total },
        { label: t('admin_dashboard.crm.metrics.applications_total', { defaultValue: 'Handshake celkem' }), value: metrics.applications_total },
        { label: t('admin_dashboard.crm.metrics.members', { defaultValue: 'Členové workspace' }), value: metrics.company_members },
        { label: t('admin_dashboard.crm.metrics.jobs_recent', { defaultValue: 'Nové role 30d' }), value: metrics.jobs_recent_30d },
        { label: t('admin_dashboard.crm.metrics.applications_recent', { defaultValue: 'Handshake 30d' }), value: metrics.applications_recent_30d },
      ]
      : [
        { label: t('admin_dashboard.crm.metrics.applications_total', { defaultValue: 'Handshake celkem' }), value: metrics.applications_total },
        { label: t('admin_dashboard.crm.metrics.applications_recent', { defaultValue: 'Handshake 30d' }), value: metrics.applications_recent_30d },
        { label: t('admin_dashboard.crm.metrics.interactions_total', { defaultValue: 'Interakce celkem' }), value: metrics.interactions_total },
        { label: t('admin_dashboard.crm.metrics.interactions_recent', { defaultValue: 'Interakce 30d' }), value: metrics.interactions_recent_30d },
        { label: t('admin_dashboard.crm.metrics.apply_clicks', { defaultValue: 'Apply click 30d' }), value: metrics.apply_click_recent_30d },
        { label: t('admin_dashboard.crm.metrics.member_companies', { defaultValue: 'Firmy v členství' }), value: metrics.member_companies },
      ];

    return items.map((item) => ({ ...item, value: Number(item.value) || 0 }));
  }, [crmEntityDetail, t]);
  const crmApplicationStatusBreakdown = useMemo(() => {
    if (crmJobFilter !== 'all') {
      const reactionRow = (crmEntityDetail?.breakdowns?.job_reactions || []).find((item: any) => String(item?.job_id) === crmJobFilter);
      const statusCounts = reactionRow?.application_status_counts || {};
      return Object.entries(statusCounts)
        .map(([key, value]) => ({ key, value: Number(value) || 0 }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value);
    }
    const raw = crmEntityDetail?.breakdowns?.application_status || {};
    return Object.entries(raw)
      .map(([key, value]) => ({ key, value: Number(value) || 0 }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [crmEntityDetail, crmJobFilter]);
  const crmJobReactionBreakdown = useMemo(() => {
    const raw = crmEntityDetail?.breakdowns?.job_reactions || [];
    const rows = Array.isArray(raw) ? raw.filter((item: any) => item && item.job_id) : [];
    if (crmJobFilter === 'all') return rows;
    return rows.filter((item: any) => String(item.job_id) === crmJobFilter);
  }, [crmEntityDetail, crmJobFilter]);
  const crmJobFilterOptions = useMemo(() => {
    const raw = crmEntityDetail?.breakdowns?.job_reactions || [];
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map((item: any) => ({
      value: String(item.job_id),
      label: String(item.job_title || `job #${item.job_id}`),
    }));
  }, [crmEntityDetail]);
  const crmSelectedJobReaction = useMemo(
    () => crmJobReactionBreakdown[0] || null,
    [crmJobReactionBreakdown]
  );
  const crmTimelineCategories = useMemo(() => {
    const raw = crmEntityDetail?.timeline_categories || [];
    return Array.isArray(raw) ? raw.filter((value) => typeof value === 'string' && value.length > 0) : [];
  }, [crmEntityDetail]);
  const crmTimelineEntries = useMemo(() => {
    const raw = crmEntityDetail?.timeline || [];
    const entries = Array.isArray(raw) ? raw : [];
    const byCategory = crmTimelineFilter === 'all'
      ? entries
      : entries.filter((item: any) => item?.category === crmTimelineFilter);
    if (crmJobFilter === 'all') return byCategory;
    return byCategory.filter((item: any) => String(item?.job_id || '') === crmJobFilter);
  }, [crmEntityDetail, crmTimelineFilter, crmJobFilter]);
  const crmRecentJobs = useMemo(() => {
    const rows = crmEntityDetail?.recent?.jobs || [];
    if (crmJobFilter === 'all') return rows;
    return rows.filter((job: any) => String(job?.id || '') === crmJobFilter);
  }, [crmEntityDetail, crmJobFilter]);
  const crmRecentApplications = useMemo(() => {
    const rows = crmEntityDetail?.recent?.applications || [];
    if (crmJobFilter === 'all') return rows;
    return rows.filter((app: any) => String(app?.job_id || '') === crmJobFilter);
  }, [crmEntityDetail, crmJobFilter]);
  const crmRecentInteractions = useMemo(() => {
    const rows = crmEntityDetail?.recent?.interactions || [];
    if (crmJobFilter === 'all') return rows;
    return rows.filter((evt: any) => String(evt?.job_id || '') === crmJobFilter);
  }, [crmEntityDetail, crmJobFilter]);

  const founderBoardColumns = useMemo(() => {
    const grouped: Record<(typeof FOUNDER_BOARD_COLUMN_KEYS)[number], any[]> = {
      inbox: [] as any[],
      active: [] as any[],
      done: [] as any[],
    };
    founderCards.forEach((card) => {
      const status: (typeof FOUNDER_BOARD_COLUMN_KEYS)[number] = card?.status === 'active' || card?.status === 'done' ? card.status : 'inbox';
      grouped[status].push(card);
    });
    return grouped;
  }, [founderCards]);

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

  const exportCrmTopJobs = () => {
    const rows = [
      ['job_id', 'job_title', 'company', 'company_id', 'job_status', 'location', 'open_detail', 'apply_click', 'save', 'unsave', 'swipe_left', 'swipe_right', 'unique_users', 'applications_total'],
      ...crmFilteredTopJobs.map((row: any) => [
        row.job_id || '',
        row.job_title || '',
        row.company || '',
        row.company_id || '',
        row.job_status || '',
        row.location || '',
        num(row.open_detail),
        num(row.apply_click),
        num(row.save),
        num(row.unsave),
        num(row.swipe_left),
        num(row.swipe_right),
        num(row.unique_users),
        num(row.applications_total),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jobshaman_crm_top_positions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCrmSaveSubscription = async () => {
    if (!selectedCrmRecord || crmSaving) return;
    const currentSub = selectedCrmRecord.subscription;
    const payload: any = {};

    if (currentSub?.id) {
      payload.subscription_id = currentSub.id;
    } else {
      payload.target_type = selectedCrmRecord.entityKind;
      payload.target_id = selectedCrmRecord.entityId;
    }

    const normalizedTier = String(crmDraft.tier || '').trim();
    const normalizedStatus = String(crmDraft.status || '').trim();
    const normalizedTrialDays = String(crmDraft.set_trial_days || '').trim();
    const normalizedTrialUntil = String(crmDraft.set_trial_until || '').trim();

    if (normalizedTier && normalizedTier !== currentSub?.tier) payload.tier = normalizedTier;
    if (normalizedStatus && normalizedStatus !== currentSub?.status) payload.status = normalizedStatus;
    if (normalizedTrialDays) payload.set_trial_days = Number(normalizedTrialDays);
    if (normalizedTrialUntil) payload.set_trial_until = normalizedTrialUntil;

    if (!currentSub && !payload.tier && !payload.status && !payload.set_trial_days && !payload.set_trial_until) {
      payload.tier = 'free';
      payload.status = 'inactive';
    }

    if (Object.keys(payload).length <= 1) return;

    setCrmSaving(true);
    try {
      await updateAdminSubscription(payload);
      await loadCrmWorkspace();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to save CRM subscription');
    } finally {
      setCrmSaving(false);
    }
  };

  const handleCrmDigestSave = async () => {
    if (!selectedCrmRecord || selectedCrmRecord.entityKind !== 'user' || crmDigestSaving) return;
    setCrmDigestSaving(true);
    try {
      const updated = await updateAdminUserDigest(selectedCrmRecord.entityId, crmDigestDraft);
      setCrmDigest(updated);
      setCrmDigestDraft({
        daily_digest_enabled: Boolean(updated?.daily_digest_enabled),
        daily_digest_push_enabled: Boolean(updated?.daily_digest_push_enabled),
        daily_digest_time: updated?.daily_digest_time || '07:30',
        daily_digest_timezone: updated?.daily_digest_timezone || 'Europe/Prague'
      });
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to update digest settings');
    } finally {
      setCrmDigestSaving(false);
    }
  };

  const handleCreateLead = async () => {
    if (!crmLeadCreate.company_name.trim() || crmLeadSaving) return;
    setCrmLeadSaving(true);
    try {
      await createAdminCrmLead({
        ...crmLeadCreate,
        company_name: crmLeadCreate.company_name.trim(),
        status: crmLeadCreate.status as (typeof CRM_LEAD_STATUSES)[number],
        priority: crmLeadCreate.priority as (typeof CRM_LEAD_PRIORITIES)[number],
        source: crmLeadCreate.source as (typeof CRM_LEAD_SOURCES)[number],
        next_follow_up_at: crmLeadCreate.next_follow_up_at ? new Date(crmLeadCreate.next_follow_up_at).toISOString() : undefined,
      });
      setCrmLeadCreate({
        company_name: '',
        contact_name: '',
        contact_role: '',
        email: '',
        phone: '',
        website: '',
        city: '',
        country: '',
        status: 'new',
        priority: 'medium',
        source: 'manual',
        notes: '',
        next_follow_up_at: '',
      });
      await loadCrmWorkspace();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to create CRM lead');
    } finally {
      setCrmLeadSaving(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedCrmRecord || selectedCrmRecord.entityKind !== 'lead' || crmLeadSaving) return;
    setCrmLeadSaving(true);
    try {
      await updateAdminCrmLead(selectedCrmRecord.entityId, {
        ...crmLeadEdit,
        company_name: crmLeadEdit.company_name.trim(),
        status: crmLeadEdit.status as (typeof CRM_LEAD_STATUSES)[number],
        priority: crmLeadEdit.priority as (typeof CRM_LEAD_PRIORITIES)[number],
        source: crmLeadEdit.source as (typeof CRM_LEAD_SOURCES)[number],
        next_follow_up_at: crmLeadEdit.next_follow_up_at ? new Date(crmLeadEdit.next_follow_up_at).toISOString() : undefined,
        last_contacted_at: crmLeadEdit.last_contacted_at ? new Date(crmLeadEdit.last_contacted_at).toISOString() : undefined,
      });
      await loadCrmWorkspace();
      const detail = await getAdminCrmEntityDetail('lead', selectedCrmRecord.entityId);
      setCrmEntityDetail(detail || null);
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to update CRM lead');
    } finally {
      setCrmLeadSaving(false);
    }
  };

  const handleCreateFounderCard = async () => {
    if (!founderCardCreate.title.trim() || founderBoardSaving || founderBoardUnsupported) return;
    setFounderBoardSaving(true);
    try {
      await createAdminFounderBoardCard({
        ...founderCardCreate,
        title: founderCardCreate.title.trim(),
        card_type: founderCardCreate.card_type as (typeof FOUNDER_CARD_TYPES)[number],
        status: founderCardCreate.status as (typeof FOUNDER_CARD_STATUSES)[number],
        priority: founderCardCreate.priority as (typeof FOUNDER_CARD_PRIORITIES)[number],
      });
      setFounderCardCreate({
        title: '',
        body: '',
        card_type: 'idea',
        status: 'inbox',
        priority: 'medium',
        assignee_name: '',
        assignee_email: '',
      });
      await loadFounderBoard();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to create founder card');
    } finally {
      setFounderBoardSaving(false);
    }
  };

  const handleFounderCardQuickUpdate = async (cardId: string, payload: Record<string, unknown>) => {
    if (founderBoardSaving || founderBoardUnsupported) return;
    setFounderBoardSaving(true);
    try {
      await updateAdminFounderBoardCard(cardId, payload);
      await loadFounderBoard();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to update founder card');
    } finally {
      setFounderBoardSaving(false);
    }
  };

  const handleCreateFounderComment = async (cardId: string) => {
    const draft = String(founderCommentDrafts[cardId] || '').trim();
    if (!draft || founderBoardUnsupported || founderCommentSavingId === cardId) return;
    setFounderCommentSavingId(cardId);
    try {
      await createAdminFounderBoardComment(cardId, { body: draft });
      setFounderCommentDrafts((prev) => ({ ...prev, [cardId]: '' }));
      await loadFounderBoard();
    } catch (err: any) {
      handleAuthError(err?.message || 'Failed to add founder board comment');
    } finally {
      setFounderCommentSavingId(null);
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
          <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/90 p-8 text-center shadow-[0_20px_40px_-34px_rgba(15,23,42,0.26)] dark:border-slate-800/80 dark:bg-slate-900/80">
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
          <div className="rounded-[1.15rem] border border-rose-200 bg-white/90 p-8 text-center shadow-[0_20px_40px_-34px_rgba(15,23,42,0.26)] dark:border-rose-900 dark:bg-slate-900/80">
            <h2 className="text-2xl font-black text-rose-700 dark:text-rose-300">{t('admin_dashboard.auth.access_denied')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('admin_dashboard.auth.no_admin_rights')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar bg-slate-100/80 dark:bg-slate-950">
      <div className="mx-auto max-w-[1680px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-page-header overflow-hidden rounded-[1.35rem] border p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                <Layers size={14} />
                {t('admin_dashboard.header.control')}
              </div>
              <h1 className="text-2xl font-black text-[var(--text-strong)] sm:text-3xl">{t('admin_dashboard.header.title')}</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {t('admin_dashboard.header.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadOverview}
                className="app-button-secondary !rounded-xl !px-4 !py-2 text-sm"
              >
                <RefreshCcw size={15} /> {t('admin_dashboard.actions.refresh')}
              </button>
              <button
                onClick={exportInvestorPack}
                className="app-button-primary !rounded-xl !px-4 !py-2 text-sm"
              >
                <Download size={15} /> {t('admin_dashboard.actions.export_csv')}
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch(`${BACKEND_URL}/healthz`);
                  } catch {
                    // noop
                  }
                }}
                className="app-button-secondary !rounded-xl !px-4 !py-2 text-sm"
              >
                <Activity size={15} /> {t('admin_dashboard.actions.wake_backend')}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
            {([
              { id: 'overview', label: t('admin_dashboard.tabs.overview'), icon: BarChart3 },
              { id: 'crm', label: t('admin_dashboard.tabs.crm', { defaultValue: 'CRM' }), icon: Users },
              { id: 'workspace', label: t('admin_dashboard.tabs.workspace', { defaultValue: 'Board' }), icon: Lightbulb },
              { id: 'jcfpm', label: t('admin_dashboard.tabs.jcfpm'), icon: Sparkles },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-[0.95rem] px-4 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(var(--accent-rgb),0.18)]'
                      : 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:border-[rgba(var(--accent-rgb),0.18)] hover:text-[var(--text-strong)]'
                  )}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
        </section>

        {view === 'overview' && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <article key={kpi.label} className={panelClass}>
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{kpi.label}</div>
                      <Icon size={16} className="text-[var(--accent)]" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</div>
                    <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>
                  </article>
                );
              })}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <article className={`${panelClass} h-[400px] flex flex-col`}>
                <div className="flex items-center gap-2 mb-4">
                  <Globe size={16} className="text-[var(--accent)]" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('admin_dashboard.sections.traffic_trend')}</h3>
                </div>
                {loading ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                    {t('admin_dashboard.common.loading', { defaultValue: 'Loading...' })}
                  </div>
                ) : (
                  <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trafficSeries}>
                        <defs>
                          <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d97706" stopOpacity={0.26} />
                            <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="pageviews" stroke="#d97706" fillOpacity={1} fill="url(#colorPv)" />
                        <Area type="monotone" dataKey="visitors" stroke="#10b981" fillOpacity={0} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </article>

              <article className={`${panelClass} h-[400px] flex flex-col`}>
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={16} className="text-[var(--accent)]" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('admin_dashboard.sections.ai_token_trend')}</h3>
                </div>
                {loading ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                    {t('admin_dashboard.common.loading', { defaultValue: 'Loading...' })}
                  </div>
                ) : (
                  <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tokenTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="tokens" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {!loading && (
                  <p className="mt-3 text-xs text-slate-500">
                    {t('admin_dashboard.ai_quality.schema_pass_rate', { defaultValue: 'Schema pass rate' })}:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatPercent(aiQuality?.summary?.schema_pass_rate)}</span>
                    {' '}• {t('admin_dashboard.ai_quality.fallback_rate', { defaultValue: 'Fallback rate' })}:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatPercent(aiQuality?.summary?.fallback_rate)}</span>
                  </p>
                )}
              </article>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <article className={`${panelClass} xl:col-span-2`}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-[var(--accent)]" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('admin_dashboard.sections.recommendation_performance')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[250px]">
                  <div className="flex flex-col">
                    <div className="text-xs font-semibold mb-2 text-slate-500">{t('admin_dashboard.sections.ctr_by_model')}</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ctrByModel} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="model_version" type="category" width={80} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="ctr_apply" fill="#d97706" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs font-semibold mb-2 text-slate-500">{t('admin_dashboard.sections.ctr_by_scoring')}</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ctrByScoring} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="scoring_version" type="category" width={80} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="ctr_apply" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </article>

              <article className={`${panelClass} flex flex-col min-h-[300px]`}>
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-[var(--accent)]" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('admin_dashboard.sections.score_distribution')}</h3>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: '< 40', value: scoreDistribution.lt_40 || 0, color: '#f43f5e' },
                          { name: '40-60', value: scoreDistribution['40_60'] || 0, color: '#fbbf24' },
                          { name: '60-80', value: scoreDistribution['60_80'] || 0, color: '#d97706' },
                          { name: '≥ 80', value: scoreDistribution.gte_80 || 0, color: '#10b981' },
                        ]}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[0, 1, 2, 3].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#f43f5e', '#fbbf24', '#d97706', '#10b981'][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <article className={panelClass}>
                <div className="font-semibold mb-3 text-sm">{t('admin_dashboard.sections.top_countries')}</div>
                <div className="space-y-1 text-xs">
                  {topCountries.length === 0 && <p className="text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</p>}
                  {topCountries.map((row: any) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{formatNumber(row.count)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className={panelClass}>
                <div className="font-semibold mb-3 text-sm">{t('admin_dashboard.sections.top_devices')}</div>
                <div className="space-y-1 text-xs">
                  {topDevices.length === 0 && <p className="text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</p>}
                  {topDevices.map((row: any) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{formatNumber(row.count)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className={panelClass}>
                <div className="font-semibold mb-3 text-sm">{t('admin_dashboard.sections.top_models_cost')}</div>
                <div className="space-y-1 text-xs max-h-40 overflow-auto pr-1">
                  {modelUsage.length === 0 && <p className="text-slate-500">{t('admin_dashboard.common.no_data', { defaultValue: 'No data.' })}</p>}
                  {modelUsage.map((row: any) => (
                    <div key={row.model} className="flex items-center justify-between py-0.5">
                      <span className="truncate mr-2 text-slate-600 dark:text-slate-400">{row.model}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{formatUsd(row.estimated_cost)}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className={panelClass}>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={16} className="text-[var(--accent)]" />
                <h3 className="font-semibold">{t('admin_dashboard.sections.notifications')}</h3>
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t('admin_dashboard.notifications.empty_window', { defaultValue: 'No upcoming trial expirations in selected window.' })}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {notifications.slice(0, 9).map((n: any) => (
                    <div key={n.subscription_id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{n.company_name || n.user_email || n.subscription_id}</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${n.severity === 'expired' ? 'bg-rose-100 text-rose-700' : n.severity === 'today' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>{n.severity}</span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">{formatDate(n.current_period_end)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {view === 'crm' && (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { label: t('admin_dashboard.crm.total_entities', { defaultValue: 'CRM entity' }), value: crmSummary.total },
                { label: t('admin_dashboard.crm.companies', { defaultValue: 'Firmy' }), value: crmSummary.companies },
                { label: t('admin_dashboard.crm.users', { defaultValue: 'Uživatelé' }), value: crmSummary.users },
                { label: t('admin_dashboard.crm.leads', { defaultValue: 'Leady' }), value: crmSummary.leads },
                { label: t('admin_dashboard.crm.with_subscription', { defaultValue: 'S předplatným' }), value: crmSummary.subscribed },
                { label: t('admin_dashboard.crm.trialing', { defaultValue: 'Trialing' }), value: crmSummary.trialing },
              ].map((item) => (
                <article key={item.label} className={panelClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.label}</div>
                  <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatNumber(item.value)}</div>
                </article>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <article className={`xl:col-span-5 ${panelClass}`}>
                <div className={`${panelSoftClass} mb-3`}>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Plus size={15} className="text-[var(--accent)]" />
                    {t('admin_dashboard.crm.add_lead', { defaultValue: 'Přidat firmu jako lead' })}
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      value={crmLeadCreate.company_name}
                      onChange={(e) => setCrmLeadCreate((prev) => ({ ...prev, company_name: e.target.value }))}
                      placeholder={t('admin_dashboard.crm.company_name', { defaultValue: 'Firma' })}
                      className={inputClass}
                    />
                    <input
                      value={crmLeadCreate.contact_name}
                      onChange={(e) => setCrmLeadCreate((prev) => ({ ...prev, contact_name: e.target.value }))}
                      placeholder={t('admin_dashboard.crm.contact_name', { defaultValue: 'Kontaktní osoba' })}
                      className={inputClass}
                    />
                    <input
                      value={crmLeadCreate.email}
                      onChange={(e) => setCrmLeadCreate((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="E-mail"
                      className={inputClass}
                    />
                    <input
                      value={crmLeadCreate.phone}
                      onChange={(e) => setCrmLeadCreate((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder={t('admin_dashboard.crm.phone', { defaultValue: 'Telefon' })}
                      className={inputClass}
                    />
                    <select
                      value={crmLeadCreate.status}
                      onChange={(e) => setCrmLeadCreate((prev) => ({ ...prev, status: e.target.value }))}
                      className={inputClass}
                    >
                      {CRM_LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <input
                      type="datetime-local"
                      value={crmLeadCreate.next_follow_up_at}
                      onChange={(e) => setCrmLeadCreate((prev) => ({ ...prev, next_follow_up_at: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <textarea
                    value={crmLeadCreate.notes}
                    onChange={(e) => setCrmLeadCreate((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('admin_dashboard.crm.notes', { defaultValue: 'Poznámka k leadu' })}
                    className={`${inputClass} mt-2 min-h-[92px] resize-y`}
                  />
                  <div className="mt-3">
                    <button
                      onClick={handleCreateLead}
                      disabled={crmLeadSaving || !crmLeadCreate.company_name.trim()}
                      className="app-button-primary !rounded-[0.85rem] !px-4 !py-2 text-sm disabled:opacity-60"
                    >
                      <Plus size={14} />
                      {crmLeadSaving ? t('app.saving') : t('admin_dashboard.crm.create_lead_cta', { defaultValue: 'Uložit lead' })}
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={crmQuery}
                      onChange={(e) => setCrmQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          loadCrmWorkspace();
                        }
                      }}
                      placeholder={t('admin_dashboard.crm.search_placeholder', { defaultValue: 'Hledat firmu nebo uživatele…' })}
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                  <select
                    value={crmKind}
                    onChange={(e) => setCrmKind(e.target.value as 'all' | CrmEntityKind)}
                    className={inputClass}
                  >
                    <option value="all">{t('admin_dashboard.crm.kind_all', { defaultValue: 'Vše' })}</option>
                    <option value="company">{t('admin_dashboard.entity.company')}</option>
                    <option value="user">{t('admin_dashboard.entity.user')}</option>
                    <option value="lead">{t('admin_dashboard.crm.leads', { defaultValue: 'Leady' })}</option>
                  </select>
                  <button
                    onClick={loadCrmWorkspace}
                    className="app-button-primary !rounded-[0.82rem] !px-3 !py-2 text-sm"
                  >
                    <RefreshCcw size={14} />
                    {t('admin_dashboard.actions.refresh')}
                  </button>
                </div>

                <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
                  {crmLoading && (
                    <div className={panelSoftClass}>
                      <p className="text-sm text-slate-500">{t('admin_dashboard.search.searching')}</p>
                    </div>
                  )}
                  {!crmLoading && crmRecords.length === 0 && (
                    <div className={panelSoftClass}>
                      <p className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</p>
                    </div>
                  )}
                  {!crmLoading && crmRecords.map((record) => {
                    const selected = selectedCrmKey === record.key;
                    const sub = record.subscription;
                    return (
                      <button
                        key={record.key}
                        type="button"
                        onClick={() => setSelectedCrmKey(record.key)}
                        className={`w-full rounded-[0.95rem] border p-3 text-left transition-colors ${selected
                          ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[rgba(255,248,233,0.96)]'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/45 hover:border-[rgba(var(--accent-rgb),0.2)]'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{record.label}</div>
                            <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{record.secondary || record.entityId}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${record.entityKind === 'company'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : record.entityKind === 'lead'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                              {record.entityKind}
                            </span>
                            {record.entityKind === 'lead' ? (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                lead
                              </span>
                            ) : sub ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sub.status === 'active'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : sub.status === 'trialing'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                                {sub.status}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                no sub
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>

              <article className={`xl:col-span-7 ${panelClass}`}>
                {!selectedCrmRecord ? (
                  <div className={`${panelSoftClass} flex min-h-[260px] items-center justify-center`}>
                    <p className="text-sm text-slate-500">
                      {t('admin_dashboard.crm.select_entity', { defaultValue: 'Vyberte záznam vlevo pro detail CRM.' })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedCrmRecord.label}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedCrmRecord.secondary || selectedCrmRecord.entityId}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            <Building2 size={12} />
                            {selectedCrmRecord.entityKind === 'company'
                              ? t('admin_dashboard.entity.company')
                              : selectedCrmRecord.entityKind === 'lead'
                                ? t('admin_dashboard.crm.lead', { defaultValue: 'Lead' })
                                : t('admin_dashboard.entity.user')}
                          </span>
                          {selectedCrmRecord.subscriptionId && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-semibold text-[var(--accent)]">
                              sub #{selectedCrmRecord.subscriptionId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={loadCrmWorkspace}
                        className="app-button-secondary !rounded-[0.85rem] !px-3 !py-2 text-sm hover:!text-[var(--accent)]"
                      >
                        <RefreshCcw size={14} />
                        {t('admin_dashboard.actions.refresh')}
                      </button>
                    </div>

                    <div className={panelSoftClass}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t('admin_dashboard.crm.entity_overview', { defaultValue: 'Souhrn entity' })}
                        </div>
                        {crmDetailLoading && (
                          <span className="text-xs text-slate-500">{t('app.loading')}</span>
                        )}
                      </div>
                      {!crmDetailLoading && !crmEntityDetail ? (
                        <p className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</p>
                      ) : (
                        <>
                          {selectedCrmRecord.entityKind === 'company' && crmJobFilterOptions.length > 0 && (
                            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {t('admin_dashboard.crm.position_filter', { defaultValue: 'Filtr pozice' })}
                              </div>
                              <select
                                value={crmJobFilter}
                                onChange={(e) => setCrmJobFilter(e.target.value)}
                                className={`${inputClass} lg:max-w-md`}
                              >
                                <option value="all">{t('admin_dashboard.crm.position_filter_all', { defaultValue: 'Všechny pozice' })}</option>
                                {crmJobFilterOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                            {crmMetricCards.map((item) => (
                              <div key={item.label} className="rounded-lg border border-slate-200/80 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                                <div className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{item.label}</div>
                                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatNumber(item.value)}</div>
                              </div>
                            ))}
                          </div>
                          {selectedCrmRecord.entityKind === 'company' && crmSelectedJobReaction && crmJobFilter !== 'all' && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {[
                                ['open', crmSelectedJobReaction.open_detail_90d],
                                ['apply', crmSelectedJobReaction.apply_click_90d],
                                ['save', crmSelectedJobReaction.save_90d],
                                ['dismiss', crmSelectedJobReaction.swipe_left_90d],
                                ['users', crmSelectedJobReaction.unique_users_90d],
                                ['handshakes', crmSelectedJobReaction.applications_total],
                              ].map(([label, value]) => (
                                <span
                                  key={label}
                                  className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]"
                                >
                                  {label}: {formatNumber(Number(value) || 0)}
                                </span>
                              ))}
                            </div>
                          )}
                          {crmApplicationStatusBreakdown.length > 0 && (
                            <div className="mt-3">
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {t('admin_dashboard.crm.application_status_breakdown', { defaultValue: 'Statusy handshake' })}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {crmApplicationStatusBreakdown.map((item) => (
                                  <span
                                    key={item.key}
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                  >
                                    {item.key}: {formatNumber(item.value)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedCrmRecord.entityKind === 'company' && crmJobReactionBreakdown.length > 0 && (
                            <div className="mt-3 rounded-lg border border-slate-200/80 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {t('admin_dashboard.crm.job_reaction_breakdown', { defaultValue: 'Reakce podle pozice' })}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-slate-500 dark:text-slate-400">
                                      <th className="pb-2 pr-3 font-semibold">{t('admin_dashboard.crm.position', { defaultValue: 'Pozice' })}</th>
                                      <th className="pb-2 pr-3 font-semibold">Open</th>
                                      <th className="pb-2 pr-3 font-semibold">Apply</th>
                                      <th className="pb-2 pr-3 font-semibold">Save</th>
                                      <th className="pb-2 pr-3 font-semibold">Dismiss</th>
                                      <th className="pb-2 pr-3 font-semibold">{t('admin_dashboard.crm.people', { defaultValue: 'Lidé' })}</th>
                                      <th className="pb-2 pr-3 font-semibold">{t('admin_dashboard.crm.handshakes', { defaultValue: 'Handshake' })}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {crmJobReactionBreakdown.map((row: any) => (
                                      <tr key={row.job_id} className="border-t border-slate-200/70 align-top dark:border-slate-700/70">
                                        <td className="py-2 pr-3">
                                          <div className="font-semibold text-slate-800 dark:text-slate-100">{row.job_title || `job #${row.job_id}`}</div>
                                          <div className="text-slate-500">{row.job_status || '—'}{row.job_location ? ` • ${row.job_location}` : ''}</div>
                                        </td>
                                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.open_detail_90d)}</td>
                                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.apply_click_90d)}</td>
                                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.save_90d)}</td>
                                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.swipe_left_90d)}</td>
                                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.unique_users_90d)}</td>
                                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.applications_total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                            {crmRecentJobs?.length > 0 && (
                              <div className="rounded-lg border border-slate-200/80 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {t('admin_dashboard.crm.recent_jobs', { defaultValue: 'Poslední role' })}
                                </div>
                                <div className="space-y-1.5">
                                  {crmRecentJobs.slice(0, 5).map((job: any) => (
                                    <div key={job.id} className="text-xs">
                                      <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{job.title || `#${job.id}`}</div>
                                      <div className="text-slate-500">{job.status || (job.is_active ? 'active' : 'inactive')} • {formatDate(job.updated_at || job.created_at)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {crmRecentApplications?.length > 0 && (
                              <div className="rounded-lg border border-slate-200/80 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {t('admin_dashboard.crm.recent_applications', { defaultValue: 'Poslední handshaky' })}
                                </div>
                                <div className="space-y-1.5">
                                  {crmRecentApplications.slice(0, 5).map((app: any) => (
                                    <div key={app.id} className="text-xs">
                                      <div className="font-semibold text-slate-800 dark:text-slate-100">#{String(app.job_id || app.id).slice(0, 10)}</div>
                                      <div className="text-slate-500">{app.status || 'pending'} • {formatDate(app.submitted_at || app.created_at)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {crmRecentInteractions?.length > 0 && (
                              <div className="rounded-lg border border-slate-200/80 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {t('admin_dashboard.crm.recent_interactions', { defaultValue: 'Poslední interakce' })}
                                </div>
                                <div className="space-y-1.5">
                                  {crmRecentInteractions.slice(0, 5).map((evt: any) => (
                                    <div key={evt.id || `${evt.job_id}-${evt.created_at}`} className="text-xs">
                                      <div className="font-semibold text-slate-800 dark:text-slate-100">{evt.event_type || 'event'}</div>
                                      <div className="text-slate-500">job #{evt.job_id || '—'} • {formatDate(evt.created_at)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {crmEntityDetail?.recent?.activity?.length > 0 && (
                              <div className="rounded-lg border border-slate-200/80 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {t('admin_dashboard.crm.recent_activity', { defaultValue: 'Aktivita firmy' })}
                                </div>
                                <div className="space-y-1.5">
                                  {crmEntityDetail.recent.activity.slice(0, 5).map((item: any) => (
                                    <div key={item.id || `${item.event_type}-${item.created_at}`} className="text-xs">
                                      <div className="font-semibold text-slate-800 dark:text-slate-100">{item.event_type || 'event'}</div>
                                      <div className="text-slate-500">{formatDate(item.created_at)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className={panelSoftClass}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t('admin_dashboard.crm.timeline', { defaultValue: 'Timeline událostí' })}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatNumber(crmTimelineEntries.length)} {t('admin_dashboard.crm.timeline_items', { defaultValue: 'událostí' })}
                        </div>
                      </div>

                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCrmTimelineFilter('all')}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${crmTimelineFilter === 'all'
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                        >
                          {t('admin_dashboard.crm.timeline_all', { defaultValue: 'Vše' })}
                        </button>
                        {crmTimelineCategories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setCrmTimelineFilter(category)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${crmTimelineFilter === category
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>

                      {crmTimelineEntries.length === 0 ? (
                        <p className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</p>
                      ) : (
                        <div className="max-h-64 space-y-1.5 overflow-auto pr-1">
                          {crmTimelineEntries.slice(0, 40).map((item: any) => {
                            const severity = String(item?.severity || 'info');
                            const toneClass = severity === 'danger'
                              ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-900/20'
                              : severity === 'success'
                                ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-900/20'
                                : 'border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/75';
                            return (
                              <div
                                key={item.id || `${item.category}-${item.timestamp}-${item.type}`}
                                className={`rounded-lg border p-2 text-xs ${toneClass}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{item.title || item.type || 'event'}</div>
                                    {item.detail ? (
                                      <div className="mt-0.5 truncate text-slate-500 dark:text-slate-400">{item.detail}</div>
                                    ) : null}
                                  </div>
                                  <div className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                                    {formatDate(item.timestamp)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {selectedCrmRecord.entityKind === 'lead' && (
                      <div className={panelSoftClass}>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <Phone size={15} className="text-[var(--accent)]" />
                          {t('admin_dashboard.crm.lead_detail', { defaultValue: 'Obchodní lead' })}
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <input value={crmLeadEdit.company_name} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, company_name: e.target.value }))} placeholder={t('admin_dashboard.crm.company_name', { defaultValue: 'Firma' })} className={inputClass} />
                          <input value={crmLeadEdit.contact_name} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, contact_name: e.target.value }))} placeholder={t('admin_dashboard.crm.contact_name', { defaultValue: 'Kontaktní osoba' })} className={inputClass} />
                          <input value={crmLeadEdit.contact_role} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, contact_role: e.target.value }))} placeholder={t('admin_dashboard.crm.contact_role', { defaultValue: 'Role kontaktu' })} className={inputClass} />
                          <input value={crmLeadEdit.email} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, email: e.target.value }))} placeholder="E-mail" className={inputClass} />
                          <input value={crmLeadEdit.phone} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, phone: e.target.value }))} placeholder={t('admin_dashboard.crm.phone', { defaultValue: 'Telefon' })} className={inputClass} />
                          <input value={crmLeadEdit.website} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, website: e.target.value }))} placeholder="https://..." className={inputClass} />
                          <input value={crmLeadEdit.city} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, city: e.target.value }))} placeholder={t('admin_dashboard.crm.city', { defaultValue: 'Město' })} className={inputClass} />
                          <input value={crmLeadEdit.country} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, country: e.target.value }))} placeholder={t('admin_dashboard.crm.country', { defaultValue: 'Země' })} className={inputClass} />
                          <select value={crmLeadEdit.status} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, status: e.target.value }))} className={inputClass}>
                            {CRM_LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                          <select value={crmLeadEdit.priority} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, priority: e.target.value }))} className={inputClass}>
                            {CRM_LEAD_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                          </select>
                          <select value={crmLeadEdit.source} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, source: e.target.value }))} className={inputClass}>
                            {CRM_LEAD_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
                          </select>
                          <input type="datetime-local" value={crmLeadEdit.last_contacted_at} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, last_contacted_at: e.target.value }))} className={inputClass} />
                          <input type="datetime-local" value={crmLeadEdit.next_follow_up_at} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, next_follow_up_at: e.target.value }))} className={inputClass} />
                        </div>
                        <textarea value={crmLeadEdit.notes} onChange={(e) => setCrmLeadEdit((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t('admin_dashboard.crm.notes', { defaultValue: 'Poznámka k leadu' })} className={`${inputClass} mt-2 min-h-[120px] resize-y`} />
                        <div className="mt-3">
                          <button onClick={handleUpdateLead} disabled={crmLeadSaving || !crmLeadEdit.company_name.trim()} className="app-button-primary !rounded-[0.85rem] !px-4 !py-2 text-sm disabled:opacity-60">
                            {crmLeadSaving ? t('app.saving') : t('admin_dashboard.common.save')}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedCrmRecord.entityKind !== 'lead' && (
                    <div className={panelSoftClass}>
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Clock3 size={15} className="text-[var(--accent)]" />
                        {t('admin_dashboard.crm.subscription', { defaultValue: 'Předplatné' })}
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        <select
                          value={crmDraft.tier}
                          onChange={(e) => setCrmDraft((prev) => ({ ...prev, tier: e.target.value }))}
                          className={inputClass}
                        >
                          {TIERS.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                        <select
                          value={crmDraft.status}
                          onChange={(e) => setCrmDraft((prev) => ({ ...prev, status: e.target.value }))}
                          className={inputClass}
                        >
                          {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                        <input
                          value={crmDraft.set_trial_days}
                          onChange={(e) => setCrmDraft((prev) => ({ ...prev, set_trial_days: e.target.value }))}
                          placeholder={t('admin_dashboard.create_subscription.trial_days')}
                          className={inputClass}
                        />
                        <input
                          value={crmDraft.set_trial_until}
                          onChange={(e) => setCrmDraft((prev) => ({ ...prev, set_trial_until: e.target.value }))}
                          placeholder="2026-12-31T23:59:59Z"
                          className={inputClass}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleCrmSaveSubscription}
                          disabled={crmSaving}
                          className="inline-flex items-center gap-2 rounded-[0.85rem] bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                        >
                          {crmSaving ? t('app.saving') : t('admin_dashboard.common.save')}
                        </button>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedCrmRecord.subscription?.current_period_end
                            ? `${t('admin_dashboard.crm.period_end', { defaultValue: 'Konec období' })}: ${formatDate(selectedCrmRecord.subscription.current_period_end)}`
                            : t('admin_dashboard.crm.no_subscription_period', { defaultValue: 'Bez aktivního období.' })}
                        </span>
                      </div>
                    </div>
                    )}

                    {selectedCrmRecord.entityKind === 'user' && (
                      <div className={panelSoftClass}>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <Mail size={15} className="text-[var(--accent)]" />
                          {t('admin_dashboard.crm.digest', { defaultValue: 'Digest notifikace uživatele' })}
                        </div>
                        {!crmDigest ? (
                          <p className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={Boolean(crmDigestDraft.daily_digest_enabled)}
                                  onChange={(e) => setCrmDigestDraft((prev) => ({ ...prev, daily_digest_enabled: e.target.checked }))}
                                />
                                {t('profile.digest_email', { defaultValue: 'Denní digest e‑mailem' })}
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={Boolean(crmDigestDraft.daily_digest_push_enabled)}
                                  onChange={(e) => setCrmDigestDraft((prev) => ({ ...prev, daily_digest_push_enabled: e.target.checked }))}
                                />
                                {t('profile.digest_push', { defaultValue: 'Denní digest jako push' })}
                              </label>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input
                                type="time"
                                value={crmDigestDraft.daily_digest_time}
                                onChange={(e) => setCrmDigestDraft((prev) => ({ ...prev, daily_digest_time: e.target.value }))}
                                className={inputClass}
                              />
                              <input
                                value={crmDigestDraft.daily_digest_timezone}
                                onChange={(e) => setCrmDigestDraft((prev) => ({ ...prev, daily_digest_timezone: e.target.value }))}
                                className={inputClass}
                                placeholder="Europe/Prague"
                              />
                            </div>
                            <div className="mt-3">
                              <button
                                onClick={handleCrmDigestSave}
                                disabled={crmDigestSaving}
                                className="app-button-primary !rounded-[0.85rem] !px-4 !py-2 text-sm disabled:opacity-60"
                              >
                                {crmDigestSaving ? t('app.saving') : t('admin_dashboard.common.save')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {selectedCrmRecord.entityKind !== 'lead' && (
                    <div className={panelSoftClass}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t('admin_dashboard.crm.audit', { defaultValue: 'Audit změn předplatného' })}
                        </div>
                        {!crmAuditAvailable && (
                          <span className="text-xs text-amber-600 dark:text-amber-300">
                            {t('admin_dashboard.crm.audit_unavailable', { defaultValue: 'Audit tabulka není dostupná.' })}
                          </span>
                        )}
                      </div>
                      {crmAuditLoading ? (
                        <p className="text-sm text-slate-500">{t('app.loading')}</p>
                      ) : crmAuditItems.length === 0 ? (
                        <p className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</p>
                      ) : (
                        <div className="max-h-48 space-y-2 overflow-auto pr-1">
                          {crmAuditItems.map((item: any) => (
                            <div key={item.id || `${item.created_at}-${item.action}`} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{item.action}</span>
                                <span className="text-slate-500">{formatDate(item.created_at)}</span>
                              </div>
                              <div className="mt-1 text-slate-500">{item.admin_email || item.admin_user_id || 'admin'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </article>
            </section>

            <section className={panelClass}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t('admin_dashboard.crm.top_positions', { defaultValue: 'Top pozice podle reakcí' })}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t('admin_dashboard.crm.top_positions_hint', { defaultValue: 'Posledních 90 dní, napříč firmami. Vyhledávání vlevo filtruje i tento přehled.' })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatNumber(crmFilteredTopJobs.length)} {t('admin_dashboard.crm.positions', { defaultValue: 'pozic' })}
                  </div>
                  <button
                    type="button"
                    onClick={exportCrmTopJobs}
                    disabled={crmFilteredTopJobs.length === 0}
                    className="app-button-secondary !rounded-[0.75rem] !px-3 !py-1.5 text-xs disabled:opacity-60"
                  >
                    <Download size={12} />
                    {t('admin_dashboard.export', { defaultValue: 'Export' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmTopJobsCollapsed((prev) => !prev)}
                    className="app-button-secondary !rounded-[0.75rem] !px-3 !py-1.5 text-xs"
                  >
                    {crmTopJobsCollapsed
                      ? t('admin_dashboard.crm.expand', { defaultValue: 'Rozbalit' })
                      : t('admin_dashboard.crm.collapse', { defaultValue: 'Sbalit' })}
                  </button>
                </div>
              </div>
              {!crmTopJobsCollapsed && (
                <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input
                    value={crmTopJobsCompanyFilter}
                    onChange={(e) => setCrmTopJobsCompanyFilter(e.target.value)}
                    placeholder={t('admin_dashboard.crm.filter_company', { defaultValue: 'Filtrovat podle firmy…' })}
                    className={inputClass}
                  />
                  <input
                    value={crmTopJobsPositionFilter}
                    onChange={(e) => setCrmTopJobsPositionFilter(e.target.value)}
                    placeholder={t('admin_dashboard.crm.filter_position', { defaultValue: 'Filtrovat podle pozice…' })}
                    className={inputClass}
                  />
                </div>
              )}
              {crmTopJobsCollapsed ? (
                <p className="text-sm text-slate-500">{t('admin_dashboard.crm.top_positions_collapsed', { defaultValue: 'Sekce je sbalená.' })}</p>
              ) : crmLoading ? (
                <p className="text-sm text-slate-500">{t('admin_dashboard.search.searching')}</p>
              ) : crmFilteredTopJobs.length === 0 ? (
                <p className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400">
                        <th className="pb-2 pr-3 font-semibold">{t('admin_dashboard.crm.position', { defaultValue: 'Pozice' })}</th>
                        <th className="pb-2 pr-3 font-semibold">{t('admin_dashboard.entity.company', { defaultValue: 'Firma' })}</th>
                        <th className="pb-2 pr-3 font-semibold">Open</th>
                        <th className="pb-2 pr-3 font-semibold">Apply</th>
                        <th className="pb-2 pr-3 font-semibold">Save</th>
                        <th className="pb-2 pr-3 font-semibold">Dismiss</th>
                        <th className="pb-2 pr-3 font-semibold">{t('admin_dashboard.crm.people', { defaultValue: 'Lidé' })}</th>
                        <th className="pb-2 pr-3 font-semibold">{t('admin_dashboard.crm.handshakes', { defaultValue: 'Handshake' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crmFilteredTopJobs.map((row: any) => (
                        <tr key={`${row.job_id}-${row.company_id || row.company}`} className="border-t border-slate-200/70 align-top dark:border-slate-700/70">
                          <td className="py-2 pr-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{row.job_title || `job #${row.job_id}`}</div>
                            <div className="text-slate-500">{row.job_status || '—'}{row.location ? ` • ${row.location}` : ''}</div>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{row.company || 'Unknown company'}</div>
                            <div className="text-slate-500">{row.company_id ? `#${String(row.company_id).slice(0, 8)}` : 'bez company_id'}</div>
                          </td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.open_detail)}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.apply_click)}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.save)}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.swipe_left)}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.unique_users)}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{formatNumber(row.applications_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {view === 'workspace' && (
          <>
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <article className={`xl:col-span-4 ${panelClass}`}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Plus size={15} className="text-[var(--accent)]" />
                  {t('admin_dashboard.workspace.create', { defaultValue: 'Nová karta pro tým' })}
                </div>
                {founderBoardUnsupported && (
                  <div className="mb-3 rounded-[0.9rem] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    {t('admin_dashboard.workspace.unsupported', { defaultValue: 'Board ještě není nasazený na aktuálním backendu.' })}
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    value={founderCardCreate.title}
                    onChange={(e) => setFounderCardCreate((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={t('admin_dashboard.workspace.title', { defaultValue: 'Nadpis myšlenky nebo úkolu' })}
                    className={inputClass}
                  />
                  <textarea
                    value={founderCardCreate.body}
                    onChange={(e) => setFounderCardCreate((prev) => ({ ...prev, body: e.target.value }))}
                    placeholder={t('admin_dashboard.workspace.body', { defaultValue: 'Kontext, názor, další krok nebo otevřená otázka' })}
                    className={`${inputClass} min-h-[140px] resize-y`}
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <select value={founderCardCreate.card_type} onChange={(e) => setFounderCardCreate((prev) => ({ ...prev, card_type: e.target.value }))} className={inputClass}>
                      {FOUNDER_CARD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <select value={founderCardCreate.priority} onChange={(e) => setFounderCardCreate((prev) => ({ ...prev, priority: e.target.value }))} className={inputClass}>
                      {FOUNDER_CARD_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                    <input value={founderCardCreate.assignee_name} onChange={(e) => setFounderCardCreate((prev) => ({ ...prev, assignee_name: e.target.value }))} placeholder={t('admin_dashboard.workspace.assignee_name', { defaultValue: 'Komu to patří' })} className={inputClass} />
                    <input value={founderCardCreate.assignee_email} onChange={(e) => setFounderCardCreate((prev) => ({ ...prev, assignee_email: e.target.value }))} placeholder="mail@..." className={inputClass} />
                  </div>
                  <button onClick={handleCreateFounderCard} disabled={founderBoardSaving || founderBoardUnsupported || !founderCardCreate.title.trim()} className="app-button-primary !rounded-[0.9rem] !px-4 !py-2 text-sm disabled:opacity-60">
                    <Plus size={14} />
                    {founderBoardSaving ? t('app.saving') : t('admin_dashboard.workspace.create_cta', { defaultValue: 'Přidat kartu' })}
                  </button>
                </div>
              </article>

              <article className={`xl:col-span-8 ${panelClass}`}>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={founderBoardQuery}
                      onChange={(e) => setFounderBoardQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          loadFounderBoard();
                        }
                      }}
                      placeholder={t('admin_dashboard.workspace.search', { defaultValue: 'Hledat v myšlenkách, úkolech a poznámkách…' })}
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                  <select value={founderBoardStatus} onChange={(e) => setFounderBoardStatus(e.target.value as any)} className={inputClass}>
                    <option value="all">{t('admin_dashboard.workspace.all_statuses', { defaultValue: 'Všechny stavy' })}</option>
                    {FOUNDER_CARD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button onClick={loadFounderBoard} className="app-button-secondary !rounded-[0.82rem] !px-3 !py-2 text-sm">
                    <RefreshCcw size={14} />
                    {t('admin_dashboard.actions.refresh')}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  {([
                    ['inbox', t('admin_dashboard.workspace.column_inbox', { defaultValue: 'Inbox' })],
                    ['active', t('admin_dashboard.workspace.column_active', { defaultValue: 'Rozpracované' })],
                    ['done', t('admin_dashboard.workspace.column_done', { defaultValue: 'Hotovo' })],
                  ] as const).map(([statusKey, label]) => (
                    <div key={statusKey} className="rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</div>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                          {founderBoardColumns[statusKey].length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {founderBoardLoading && founderCards.length === 0 && (
                          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70">
                            {t('app.loading')}
                          </div>
                        )}
                        {!founderBoardLoading && founderBoardColumns[statusKey].length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
                            {t('admin_dashboard.workspace.empty', { defaultValue: 'Zatím nic.' })}
                          </div>
                        )}
                        {founderBoardColumns[statusKey].map((card) => (
                          <div key={card.id} className="rounded-[1rem] border border-slate-200/80 bg-white/90 p-3 shadow-[var(--shadow-soft)] dark:border-slate-700 dark:bg-slate-900/80">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">{card.card_type}</span>
                                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">{card.priority}</span>
                                </div>
                              </div>
                              <select
                                value={card.status || 'inbox'}
                                onChange={(e) => void handleFounderCardQuickUpdate(card.id, { status: e.target.value })}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {FOUNDER_CARD_STATUSES.filter((status) => status !== 'archived').map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </div>
                            {card.body ? (
                              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.body}</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{card.assignee_name || card.assignee_email || t('admin_dashboard.workspace.unassigned', { defaultValue: 'Nepřiřazeno' })}</span>
                              <span>{card.author_admin_email || 'admin'} · {formatDate(card.updated_at || card.created_at)}</span>
                            </div>
                            <div className="mt-3 space-y-2">
                              {(card.comments || []).length > 0 ? (
                                <div className="space-y-2">
                                  {(card.comments || []).map((comment: any) => (
                                    <div key={comment.id} className="rounded-[0.9rem] border border-slate-200/80 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/60">
                                      <div className="text-sm leading-6 text-slate-700 dark:text-slate-200">{comment.body}</div>
                                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        {comment.author_name || comment.author_admin_email || 'admin'} · {formatDate(comment.created_at || comment.updated_at)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <div className="space-y-2">
                                <textarea
                                  value={founderCommentDrafts[card.id] || ''}
                                  onChange={(e) => setFounderCommentDrafts((prev) => ({ ...prev, [card.id]: e.target.value }))}
                                  placeholder={t('admin_dashboard.workspace.comment_placeholder', { defaultValue: 'Přidat komentář, reakci nebo doplnění…' })}
                                  className={`${inputClass} min-h-[84px] resize-y`}
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => void handleCreateFounderComment(card.id)}
                                    disabled={!String(founderCommentDrafts[card.id] || '').trim() || founderCommentSavingId === card.id || founderBoardUnsupported}
                                    className="app-button-secondary !rounded-[0.82rem] !px-3 !py-2 text-xs disabled:opacity-60"
                                  >
                                    {founderCommentSavingId === card.id
                                      ? t('app.saving')
                                      : t('admin_dashboard.workspace.add_comment', { defaultValue: 'Přidat komentář' })}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleFounderCardQuickUpdate(card.id, { priority: card.priority === 'high' ? 'medium' : 'high' })}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:border-[rgba(var(--accent-rgb),0.2)] hover:text-[var(--accent)] dark:border-slate-700 dark:text-slate-200"
                              >
                                {t('admin_dashboard.workspace.raise_priority', { defaultValue: 'Priorita' })}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleFounderCardQuickUpdate(card.id, { card_type: card.card_type === 'task' ? 'idea' : 'task' })}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:border-[rgba(var(--accent-rgb),0.2)] hover:text-[var(--accent)] dark:border-slate-700 dark:text-slate-200"
                              >
                                {t('admin_dashboard.workspace.toggle_task', { defaultValue: 'Přepnout typ' })}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

          </>
        )}

        {view === 'jcfpm' && (
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <article className={`xl:col-span-2 ${panelClass}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{t('admin_dashboard.jcfpm.title')}</h3>
                <input
                  value={jobRolesQuery}
                  onChange={(e) => setJobRolesQuery(e.target.value)}
                  placeholder={t('admin_dashboard.jcfpm.search_placeholder')}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
                {jobRoles.map((role: any) => (
                  <div key={role.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="grid grid-cols-2 md:grid-cols-8 gap-2 text-xs items-center">
                      <input
                        value={jobRoleEdits[role.id]?.title || ''}
                        onChange={(e) => setJobRoleEdits((prev) => ({ ...prev, [role.id]: { ...prev[role.id], title: e.target.value } }))}
                        className={`md:col-span-2 ${inputClass}`}
                      />
                      {['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((key) => (
                        <input
                          key={key}
                          value={jobRoleEdits[role.id]?.[key] ?? ''}
                          onChange={(e) => setJobRoleEdits((prev) => ({ ...prev, [role.id]: { ...prev[role.id], [key]: e.target.value } }))}
                          className={inputClass}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => handleUpdateRole(role.id)} className="app-button-primary !rounded-lg !px-3 !py-1.5 text-xs">{t('admin_dashboard.jcfpm.update')}</button>
                      <button onClick={() => handleDeleteRole(role.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">{t('admin_dashboard.jcfpm.delete')}</button>
                    </div>
                  </div>
                ))}
                {!jobRoles.length && <p className="text-sm text-slate-500">{t('admin_dashboard.common.no_data')}</p>}
              </div>
            </article>

            <article className={`${panelClass} text-xs`}>
              <h3 className="font-semibold mb-3 text-sm">{t('admin_dashboard.jcfpm.create_title')}</h3>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500">{t('admin_dashboard.jcfpm.fields.title')}</label>
                  <input value={jobRoleCreate.title} onChange={(e) => setJobRoleCreate((p) => ({ ...p, title: e.target.value }))} placeholder="Title" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((d) => (
                    <input
                      key={d}
                      value={(jobRoleCreate as any)[d]}
                      onChange={(e) => setJobRoleCreate((p) => ({ ...p, [d]: e.target.value }))}
                      placeholder={d.toUpperCase()}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2"
                    />
                  ))}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500">{t('admin_dashboard.jcfpm.fields.salary_range')}</label>
                  <input value={jobRoleCreate.salary_range} onChange={(e) => setJobRoleCreate((p) => ({ ...p, salary_range: e.target.value }))} placeholder="Salary range" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500">{t('admin_dashboard.jcfpm.fields.growth_potential')}</label>
                  <input value={jobRoleCreate.growth_potential} onChange={(e) => setJobRoleCreate((p) => ({ ...p, growth_potential: e.target.value }))} placeholder="Growth potential" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500">{t('admin_dashboard.jcfpm.fields.ai_impact')}</label>
                  <input value={jobRoleCreate.ai_impact} onChange={(e) => setJobRoleCreate((p) => ({ ...p, ai_impact: e.target.value }))} placeholder="AI impact" className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500">{t('admin_dashboard.jcfpm.fields.ai_intensity')}</label>
                  <select value={jobRoleCreate.ai_intensity} onChange={(e) => setJobRoleCreate((p) => ({ ...p, ai_intensity: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500">{t('admin_dashboard.jcfpm.fields.remote_friendly')}</label>
                  <select value={jobRoleCreate.remote_friendly} onChange={(e) => setJobRoleCreate((p) => ({ ...p, remote_friendly: e.target.value }))} className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                    <option value="">remote_friendly</option>
                    <option value="yes">yes</option>
                    <option value="hybrid">hybrid</option>
                    <option value="no">no</option>
                  </select>
                </div>
                <button onClick={handleCreateRole} className="w-full rounded-xl bg-amber-600 py-2 mt-2 text-sm font-semibold text-white hover:bg-amber-500">{t('admin_dashboard.jcfpm.create')}</button>
              </div>
            </article>
          </section>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
