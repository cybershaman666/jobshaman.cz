import React from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Users, Zap } from 'lucide-react';
import { CompanyProfile } from '../../types';

interface CompanySubscriptionHeroProps {
  companyProfile: CompanyProfile;
  subscription: any;
  subscriptionLabel: string;
  isFreeLikeTier: boolean;
  onManagePlan: () => void;
}

const CompanySubscriptionHero: React.FC<CompanySubscriptionHeroProps> = ({
  companyProfile,
  subscription,
  subscriptionLabel,
  isFreeLikeTier,
  onManagePlan
}) => {
  const { t, i18n } = useTranslation();
  const normalizedTier = String(subscription?.tier || 'free').toLowerCase();
  const derivedRoleOpensAvailable = normalizedTier === 'enterprise'
    ? 999
    : normalizedTier === 'professional'
      ? 25
      : normalizedTier === 'growth'
        ? 10
        : normalizedTier === 'starter'
          ? 3
          : 1;
  const derivedDialogueSlotsAvailable = normalizedTier === 'enterprise'
    ? 999
    : normalizedTier === 'professional'
      ? 100
      : normalizedTier === 'growth'
        ? 40
        : normalizedTier === 'starter'
          ? 12
          : 3;
  const assessmentsUsed = subscription?.assessmentsUsed ?? companyProfile?.subscription?.usage?.aiAssessmentsUsed ?? 0;
  const assessmentsAvailable = subscription?.assessmentsAvailable ?? (
    normalizedTier === 'enterprise'
      ? 999
      : normalizedTier === 'professional'
        ? 150
        : normalizedTier === 'growth'
          ? 60
          : normalizedTier === 'starter'
            ? 15
            : 0
  );
  const roleOpensUsed = subscription?.roleOpensUsed
    ?? companyProfile?.subscription?.usage?.roleOpensUsed
    ?? subscription?.jobPostingsUsed
    ?? companyProfile?.subscription?.usage?.activeJobsCount
    ?? 0;
  const roleOpensAvailable = subscription?.roleOpensAvailable ?? derivedRoleOpensAvailable;
  const dialogueSlotsUsed = subscription?.dialogueSlotsUsed ?? companyProfile?.subscription?.usage?.activeDialogueSlotsUsed ?? 0;
  const dialogueSlotsAvailable = subscription?.dialogueSlotsAvailable ?? derivedDialogueSlotsAvailable;
  const nextPaymentLabel = subscription?.expiresAt && !isFreeLikeTier
    ? new Date(subscription.expiresAt).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')
    : null;

  return (
    <div className="company-surface rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              {t('company.subscription.title')}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${isFreeLikeTier || !subscription?.status
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : subscription?.status === 'active'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}>
              {isFreeLikeTier || !subscription?.status ? t('company.subscription.active') : subscription?.status === 'active' ? t('company.subscription.active') : t('company.subscription.inactive')}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-base font-semibold tracking-tight text-[var(--text-strong)]">
              {subscriptionLabel} {t('company.subscription.plan_suffix')}
            </span>
            {nextPaymentLabel ? (
              <span className="text-xs text-[var(--text-muted)]">
                {t('company.subscription.next_payment')}: <span className="font-medium">{nextPaymentLabel}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onManagePlan}
            className="app-button-secondary self-start rounded-full px-3.5 py-2 text-xs"
          >
            {t('company.subscription.manage')}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-3 xl:grid-cols-1">
        <div className="company-surface-subtle rounded-[var(--radius-md)] border p-2.5">
          <div className="mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{t('company.subscription.ai_assessments')}</span>
          </div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">{assessmentsAvailable}</div>
          <div className="text-xs text-[var(--text-muted)]">{assessmentsUsed} {t('company.subscription.used')}</div>
        </div>
        <div className="company-surface-subtle rounded-[var(--radius-md)] border p-2.5">
          <div className="mb-1 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {t('company.subscription.role_opens', { defaultValue: 'Otevřené role' })}
            </span>
          </div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">
            {`${roleOpensUsed || 0} / ${(roleOpensAvailable === 999 || roleOpensAvailable === 9999) ? t('company.subscription.unlimited') : (roleOpensAvailable ?? 0)}`}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {t('company.subscription.used_this_period', { defaultValue: 'využito v tomto období' })}
          </div>
        </div>
        <div className="company-surface-subtle rounded-[var(--radius-md)] border p-2.5">
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {t('company.subscription.dialogue_slots', { defaultValue: 'Dialogové sloty' })}
            </span>
          </div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">
            {`${dialogueSlotsUsed || 0} / ${(dialogueSlotsAvailable === 999 || dialogueSlotsAvailable === 9999) ? t('company.subscription.unlimited') : (dialogueSlotsAvailable ?? 0)}`}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {t('company.subscription.occupied_now', { defaultValue: 'obsazeno právě teď' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanySubscriptionHero;
