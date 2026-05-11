import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';

import { cn } from '../cn';
import { getSubscriptionStatus } from '../../services/serverSideBillingService';
import { cancelSubscription, checkPaymentStatus, openBillingPortal, redirectToCheckout } from '../../services/stripeService';

type TFunction = (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;

interface BillingPageProps {
  companyId: string;
  companyName: string;
  navigate: (path: string) => void;
  t: TFunction;
}

interface SubscriptionData {
  tier: string;
  tierName: string;
  status: string;
  expiresAt?: string;
  daysUntilRenewal?: number;
  assessmentsAvailable: number;
  assessmentsUsed: number;
  jobPostingsAvailable: number;
  jobPostingsUsed?: number;
  roleOpensAvailable?: number;
  roleOpensUsed?: number;
  dialogueSlotsAvailable?: number;
  dialogueSlotsUsed?: number;
  stripeSubscriptionId?: string;
  canceledAt?: string;
}

const TIER_ORDER = ['free', 'trial', 'starter', 'growth', 'professional', 'enterprise'] as const;

const TIER_CONFIG: Record<string, { color: string; gradient: string; icon: typeof Crown; badge: string }> = {
  free: { color: '#6b7280', gradient: 'from-slate-400 to-slate-500', icon: ShieldCheck, badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  trial: { color: '#6b7280', gradient: 'from-slate-400 to-slate-500', icon: ShieldCheck, badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  starter: { color: '#c28a2c', gradient: 'from-amber-400 to-amber-600', icon: Zap, badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  growth: { color: '#0f95ac', gradient: 'from-cyan-400 to-cyan-600', icon: TrendingUp, badge: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
  professional: { color: '#7c3aed', gradient: 'from-violet-400 to-violet-600', icon: Crown, badge: 'bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
  enterprise: { color: '#1e40af', gradient: 'from-blue-500 to-blue-700', icon: Sparkles, badge: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
};

const PLANS = [
  { id: 'starter', name: 'Starter', price: '249 EUR', cadence: '/měsíc', roles: 3, dialogues: 12, assessments: 80, team: 2 },
  { id: 'growth', name: 'Growth', price: '599 EUR', cadence: '/měsíc', roles: 10, dialogues: 40, assessments: 250, team: 5 },
  { id: 'professional', name: 'Professional', price: '899 EUR', cadence: '/měsíc', roles: 25, dialogues: 100, assessments: 500, team: 12 },
];

const UsageMeter: React.FC<{ label: string; used: number; total: number; icon: React.ReactNode; color: string }> = ({ label, used, total, icon, color }) => {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const isNearLimit = pct >= 80;
  return (
    <div className="rounded-[20px] border border-[color:var(--shell-panel-border)] bg-white/60 dark:bg-slate-900/60 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--shell-text-muted)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{used}<span className="text-sm font-medium text-[color:var(--shell-text-muted)]"> / {total}</span></span>
        {isNearLimit && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">⚠ {pct}%</span>}
      </div>
      <div className="mt-3 h-[6px] rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: isNearLimit ? '#d97706' : color }} />
      </div>
    </div>
  );
};

export const RecruiterBillingPage: React.FC<BillingPageProps> = ({ companyId, companyName, navigate, t }) => {
  const [sub, setSub] = React.useState<SubscriptionData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [checkoutBusy, setCheckoutBusy] = React.useState<string | null>(null);
  const [portalBusy, setPortalBusy] = React.useState(false);
  const [cancelBusy, setCancelBusy] = React.useState(false);
  const [cancelConfirm, setCancelConfirm] = React.useState(false);
  const [paymentNotice, setPaymentNotice] = React.useState<'success' | 'cancel' | null>(null);

  const loadSubscription = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSubscriptionStatus(companyId);
      setSub(data as SubscriptionData);
    } catch (err) {
      console.error('Failed to load subscription status', err);
      setError(t('rebuild.billing.load_error', { defaultValue: 'Failed to load subscription details.' }));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  React.useEffect(() => { void loadSubscription(); }, [loadSubscription]);

  React.useEffect(() => {
    const status = checkPaymentStatus();
    if (status) {
      setPaymentNotice(status);
      if (status === 'success') {
        // Clear cache and reload fresh subscription data
        localStorage.removeItem('subscription_status_cache_v1');
        setTimeout(() => void loadSubscription(), 1500);
      }
    }
  }, [loadSubscription]);

  const currentTier = (sub?.tier || 'free').toLowerCase();
  const tierCfg = TIER_CONFIG[currentTier] || TIER_CONFIG.free;
  const TierIcon = tierCfg.icon;
  const isActive = sub?.status === 'active' || sub?.status === 'trialing';
  const isPaid = ['starter', 'growth', 'professional', 'enterprise'].includes(currentTier);

  const daysUntilRenewal = React.useMemo(() => {
    if (!sub?.expiresAt) return null;
    const diff = new Date(sub.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [sub?.expiresAt]);

  const handleUpgrade = async (tier: 'starter' | 'growth' | 'professional') => {
    setCheckoutBusy(tier);
    try {
      await redirectToCheckout(tier, companyId);
    } finally {
      setCheckoutBusy(null);
    }
  };

  const handlePortal = async () => {
    setPortalBusy(true);
    try { await openBillingPortal(); } finally { setPortalBusy(false); }
  };

  const handleCancel = async () => {
    setCancelBusy(true);
    try {
      const ok = await cancelSubscription();
      if (ok) {
        setCancelConfirm(false);
        localStorage.removeItem('subscription_status_cache_v1');
        await loadSubscription();
      } else {
        alert(t('rebuild.billing.cancel_error', { defaultValue: 'Failed to cancel subscription. Please try again.' }));
      }
    } finally { setCancelBusy(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[color:var(--shell-accent-cyan)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-[22px] border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-8 text-center">
        <XCircle size={32} className="mx-auto text-rose-500" />
        <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>
        <button type="button" onClick={() => void loadSubscription()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
          <RefreshCw size={14} /> {t('rebuild.actions.try_again', { defaultValue: 'Try again' })}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment notices */}
      {paymentNotice === 'success' && (
        <div className="flex items-center gap-3 rounded-[18px] border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={18} className="shrink-0" />
          {t('rebuild.billing.payment_success', { defaultValue: 'Payment was successful! Your subscription is now active. 🎉' })}
          <button type="button" onClick={() => setPaymentNotice(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}
      {paymentNotice === 'cancel' && (
        <div className="flex items-center gap-3 rounded-[18px] border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 text-sm font-medium text-amber-800 dark:text-amber-300">
          <AlertTriangle size={18} className="shrink-0" />
          {t('rebuild.billing.payment_cancelled', { defaultValue: 'Payment was cancelled. You can try again anytime.' })}
          <button type="button" onClick={() => setPaymentNotice(null)} className="ml-auto text-amber-500 hover:text-amber-700">✕</button>
        </div>
      )}

      {/* Current plan card */}
      <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn('flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br shadow-lg', tierCfg.gradient)}>
              <TierIcon size={24} className="text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">
                {t('rebuild.billing.current_plan', { defaultValue: 'Current plan' })}
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--shell-text-primary)]">
                {sub?.tierName || 'Free'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-3 py-0.5 text-[11px] font-bold', isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400')}>
                  {isActive ? t('rebuild.billing.active', { defaultValue: 'Active' }) : (sub?.status || 'inactive')}
                </span>
                {companyName && <span className="text-xs text-[color:var(--shell-text-muted)]">· {companyName}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPaid && isActive && (
              <button type="button" onClick={() => void handlePortal()} disabled={portalBusy} className="inline-flex items-center gap-2 rounded-[14px] border border-[color:var(--shell-panel-border)] bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-[color:var(--shell-text-secondary)] shadow-sm transition hover:border-[#c99a4a] disabled:opacity-60">
                {portalBusy ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                {t('rebuild.billing.manage_payments', { defaultValue: 'Manage payments' })}
              </button>
            )}
            <button type="button" onClick={() => void loadSubscription()} className="inline-flex items-center gap-2 rounded-[14px] border border-[color:var(--shell-panel-border)] bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-[color:var(--shell-text-secondary)] shadow-sm transition hover:border-slate-400 dark:hover:border-slate-600">
              <RefreshCw size={14} />
              {t('rebuild.billing.refresh', { defaultValue: 'Refresh' })}
            </button>
          </div>
        </div>

        {/* Renewal / expiry info */}
        {sub?.expiresAt && (
          <div className="mt-5 flex flex-wrap items-center gap-6 rounded-[16px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--shell-text-muted)]">
                {sub.status === 'canceled' ? t('rebuild.billing.expires', { defaultValue: 'Expires' }) : t('rebuild.billing.next_renewal', { defaultValue: 'Next renewal' })}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[color:var(--shell-text-primary)]">
                {new Date(sub.expiresAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            {daysUntilRenewal !== null && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--shell-text-muted)]">
                  {t('rebuild.billing.days_remaining', { defaultValue: 'Days remaining' })}
                </div>
                <div className={cn('mt-0.5 text-sm font-bold', daysUntilRenewal <= 5 ? 'text-amber-600' : 'text-[color:var(--shell-text-primary)]')}>
                  {daysUntilRenewal}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Usage meters */}
      <section>
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">
          {t('rebuild.billing.usage_overview', { defaultValue: 'Usage overview' })}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UsageMeter
            label={t('rebuild.billing.ai_screenings', { defaultValue: 'AI screenings' })}
            used={sub?.assessmentsUsed ?? 0}
            total={(sub?.assessmentsUsed ?? 0) + (sub?.assessmentsAvailable ?? 0)}
            icon={<Sparkles size={12} />}
            color="#7c3aed"
          />
          <UsageMeter
            label={t('rebuild.billing.active_roles', { defaultValue: 'Active roles' })}
            used={sub?.jobPostingsUsed ?? 0}
            total={sub?.jobPostingsAvailable ?? 1}
            icon={<CreditCard size={12} />}
            color="#0f95ac"
          />
          <UsageMeter
            label={t('rebuild.billing.dialogue_slots', { defaultValue: 'Dialogue slots' })}
            used={sub?.dialogueSlotsUsed ?? 0}
            total={sub?.dialogueSlotsAvailable ?? 3}
            icon={<Zap size={12} />}
            color="#c28a2c"
          />
          <UsageMeter
            label={t('rebuild.billing.role_opens', { defaultValue: 'Role opens' })}
            used={sub?.roleOpensUsed ?? 0}
            total={sub?.roleOpensAvailable ?? 1}
            icon={<TrendingUp size={12} />}
            color="#059669"
          />
        </div>
      </section>

      {/* Upgrade plans */}
      <section className="rounded-[28px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 p-7 shadow-sm backdrop-blur-xl">
        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">
            {t('rebuild.billing.plans', { defaultValue: 'Available plans' })}
          </div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-[color:var(--shell-text-primary)]">
            {t('rebuild.billing.choose_plan', { defaultValue: 'Choose the right plan for your team' })}
          </h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const currentIdx = TIER_ORDER.indexOf(currentTier as any);
            const planIdx = TIER_ORDER.indexOf(plan.id as any);
            const isUpgrade = planIdx > currentIdx;
            const isDowngrade = planIdx < currentIdx && isPaid;
            const planCfg = TIER_CONFIG[plan.id] || TIER_CONFIG.starter;

            return (
              <div key={plan.id} className={cn(
                'relative flex flex-col rounded-[22px] border p-6 transition',
                isCurrent
                  ? 'border-2 border-[color:var(--shell-accent-cyan)] bg-[color:var(--shell-panel-solid)] shadow-[0_0_0_4px_rgba(15,149,172,0.08)]'
                  : 'border-[color:var(--shell-panel-border)] bg-white/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600',
              )}>
                {isCurrent && (
                  <div className="absolute -top-3 left-5 rounded-full bg-[color:var(--shell-accent-cyan)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {t('rebuild.billing.current', { defaultValue: 'Current' })}
                  </div>
                )}
                <h4 className="text-xl font-semibold text-[color:var(--shell-text-primary)]">{plan.name}</h4>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight" style={{ color: planCfg.color }}>{plan.price}</span>
                  <span className="text-sm text-[color:var(--shell-text-muted)]">{plan.cadence}</span>
                </div>
                <div className="mt-5 flex-1 space-y-2.5 text-sm text-[color:var(--shell-text-secondary)]">
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: planCfg.color }} /> {plan.roles} {t('rebuild.billing.active_roles', { defaultValue: 'active roles' })}</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: planCfg.color }} /> {plan.dialogues} {t('rebuild.billing.candidates_in_process', { defaultValue: 'candidates in process' })}</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: planCfg.color }} /> {plan.assessments} {t('rebuild.billing.ai_screenings_month', { defaultValue: 'AI screenings/month' })}</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: planCfg.color }} /> {plan.team} {t('rebuild.billing.team_members', { defaultValue: 'team members' })}</div>
                </div>
                <button
                  type="button"
                  disabled={isCurrent || !!checkoutBusy}
                  onClick={() => void handleUpgrade(plan.id as 'starter' | 'growth' | 'professional')}
                  className={cn(
                    'mt-6 w-full rounded-[14px] py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
                    isCurrent
                      ? 'border border-[color:var(--shell-panel-border)] bg-transparent text-[color:var(--shell-text-muted)]'
                      : isUpgrade
                        ? 'bg-gradient-to-r text-white shadow-md hover:shadow-lg ' + planCfg.gradient
                        : 'border border-[color:var(--shell-panel-border)] bg-white dark:bg-slate-800 text-[color:var(--shell-text-secondary)] hover:border-slate-400',
                  )}
                >
                  {checkoutBusy === plan.id ? <Loader2 size={16} className="mx-auto animate-spin" /> : isCurrent ? t('rebuild.billing.current_plan_btn', { defaultValue: 'Current plan' }) : isUpgrade ? t('rebuild.billing.upgrade', { defaultValue: 'Upgrade' }) : isDowngrade ? t('rebuild.billing.switch', { defaultValue: 'Switch plan' }) : t('rebuild.billing.select', { defaultValue: 'Select' })}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cancel subscription */}
      {isPaid && isActive && (
        <section className="rounded-[22px] border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-6">
          {cancelConfirm ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <AlertTriangle size={32} className="text-red-500" />
              <p className="max-w-md text-sm leading-6 text-slate-700 dark:text-slate-300">
                {t('rebuild.billing.cancel_warning', { defaultValue: 'Are you sure you want to cancel? Your subscription will remain active until the end of the current billing period.' })}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setCancelConfirm(false)} className="rounded-[12px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {t('rebuild.billing.keep_plan', { defaultValue: 'Keep plan' })}
                </button>
                <button type="button" onClick={() => void handleCancel()} disabled={cancelBusy} className="inline-flex items-center gap-2 rounded-[12px] bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  {cancelBusy && <Loader2 size={14} className="animate-spin" />}
                  {t('rebuild.billing.confirm_cancel', { defaultValue: 'Yes, cancel subscription' })}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('rebuild.billing.cancel_title', { defaultValue: 'Cancel subscription' })}</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('rebuild.billing.cancel_desc', { defaultValue: 'Your features will stay active until the end of the billing period.' })}</p>
              </div>
              <button type="button" onClick={() => setCancelConfirm(true)} className="shrink-0 rounded-[12px] border border-red-200 dark:border-red-900 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                {t('rebuild.billing.cancel_btn', { defaultValue: 'Cancel' })}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
