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
    <div className="company-surface rounded-[1.05rem] border border-cyan-200/80 bg-[linear-gradient(135deg,_rgba(236,254,255,0.96),_rgba(239,246,255,0.92))] p-3.5 shadow-[0_18px_34px_-30px_rgba(6,182,212,0.36)] dark:border-cyan-900/30 dark:bg-[linear-gradient(135deg,_rgba(8,47,73,0.45),_rgba(15,23,42,0.9))]">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              {t('company.subscription.title')}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${isFreeLikeTier || !subscription?.status
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : subscription?.status === 'active'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
            }`}>
              {isFreeLikeTier || !subscription?.status ? t('company.subscription.active') : subscription?.status === 'active' ? t('company.subscription.active') : t('company.subscription.inactive')}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-base font-semibold tracking-tight text-cyan-900 dark:text-cyan-200">
              {subscriptionLabel} {t('company.subscription.plan_suffix')}
            </span>
            {nextPaymentLabel ? (
              <span className="text-xs text-cyan-700 dark:text-cyan-300">
                {t('company.subscription.next_payment')}: <span className="font-medium">{nextPaymentLabel}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onManagePlan}
            className="rounded-full bg-white/90 px-3.5 py-2 text-xs font-semibold text-cyan-800 shadow-sm transition-colors hover:bg-white dark:bg-slate-950/70 dark:text-cyan-200 dark:hover:bg-slate-950 self-start"
          >
            {t('company.subscription.manage')}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-cyan-200/80 pt-3 sm:grid-cols-3 xl:grid-cols-1 dark:border-cyan-900/30">
        <div className="company-surface-subtle rounded-[0.95rem] border border-white/70 bg-white/85 p-2.5 dark:border-slate-800 dark:bg-slate-950/35">
          <div className="mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('company.subscription.ai_assessments')}</span>
          </div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">{assessmentsAvailable}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{assessmentsUsed} {t('company.subscription.used')}</div>
        </div>
        <div className="company-surface-subtle rounded-[0.95rem] border border-white/70 bg-white/85 p-2.5 dark:border-slate-800 dark:bg-slate-950/35">
          <div className="mb-1 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t('company.subscription.role_opens', { defaultValue: 'Role opens' })}
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">
            {`${roleOpensUsed || 0} / ${(roleOpensAvailable === 999 || roleOpensAvailable === 9999) ? t('company.subscription.unlimited') : (roleOpensAvailable ?? 0)}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('company.subscription.used', { defaultValue: 'used this period' })}
          </div>
        </div>
        <div className="company-surface-subtle rounded-[0.95rem] border border-white/70 bg-white/85 p-2.5 dark:border-slate-800 dark:bg-slate-950/35">
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t('company.subscription.dialogue_slots', { defaultValue: 'Dialogue slots' })}
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">
            {`${dialogueSlotsUsed || 0} / ${(dialogueSlotsAvailable === 999 || dialogueSlotsAvailable === 9999) ? t('company.subscription.unlimited') : (dialogueSlotsAvailable ?? 0)}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('company.subscription.active', { defaultValue: 'occupied now' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanySubscriptionHero;
