import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserProfile, CompanyProfile } from '../types';
import { useUserProfile } from '../hooks/useUserProfile';
import { CreditCard } from 'lucide-react';
import SubscriptionDashboard from '../components/SubscriptionDashboard';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import PremiumUpsellCard from '../components/PremiumUpsellCard';

/**
 * Subscription Management Page
 * Displays subscription status and usage for both individual users and companies
 * 
 * Usage:
 * - Individual users: Shows their personal subscription
 * - Company admins: Can view and manage their company subscription
 * 
 * Props are optional - component will fall back to useUserProfile hook if not provided
 */
interface SubscriptionManagementPageProps {
  userProfile?: UserProfile;
  companyProfile?: CompanyProfile | null;
}

export const SubscriptionManagementPage: React.FC<SubscriptionManagementPageProps> = ({
  userProfile: propsUser,
  companyProfile: propsCompany
}) => {
  const { t } = useTranslation();
  // Fall back to useUserProfile hook if props not provided
  const hookData = useUserProfile();
  const user = propsUser || hookData.userProfile;
  const company = propsCompany || hookData.companyProfile;
  // Check if user is still loading (not yet logged in and no id)
  const isLoading = !user?.isLoggedIn || !user?.id;
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !user.isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">{t('subscription_page.login_required')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user.id) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{t('subscription_page.user_id_missing')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isCompanyAdmin = !!company;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
      {/* Header */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur border-b border-blue-100 dark:border-blue-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {t('subscription_page.title')}
              </h1>
              <p className="text-lg text-blue-700 dark:text-blue-300 mt-2">
                {t('subscription_page.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Personal User Subscription */}
        {!isCompanyAdmin && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg border border-blue-100 dark:border-blue-800">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('subscription_page.personal_title')}</h2>
              <SubscriptionDashboard
                userId={user.id || ''}
                isCompany={false}
                onUpgradeClick={() => {
                  setShowUpgradeModal(true);
                }}
              />
            </div>

            {/* Premium Features Upsell */}
            <PremiumUpsellCard userId={user.id || ''} />

            {/* Additional Info */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span>💡</span> {t('subscription_page.tip_title')}
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {t('subscription_page.tip_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Company Subscription (for company admins) */}
        {isCompanyAdmin && company && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg border border-blue-100 dark:border-blue-800">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                {t('subscription_page.company_title', { company: company.name })}
              </h2>
              <SubscriptionDashboard
                userId={company.id || user.id || ''}
                isCompany={true}
                onUpgradeClick={() => {
                  setShowUpgradeModal(true);
                }}
              />
            </div>

            {/* Company Benefits */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
              <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-4 flex items-center gap-2">
                <span>🏢</span> {t('subscription_page.company_benefits_title')}
              </h3>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
                <li>{t('subscription_page.company_benefits.team_management')}</li>
                <li>{t('subscription_page.company_benefits.shared_credits')}</li>
                <li>{t('subscription_page.company_benefits.analytics')}</li>
                <li>{t('subscription_page.company_benefits.priority_support')}</li>
                <li>{t('subscription_page.company_benefits.api_access')}</li>
              </ul>
            </div>

            {/* Personal Subscription (if they also have one) */}
            {user.subscription?.tier && user.subscription.tier !== 'free' && (
              <div className="border-t border-blue-200 dark:border-blue-800 pt-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg border border-blue-100 dark:border-blue-800">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('subscription_page.personal_title')}</h2>
                  <SubscriptionDashboard
                    userId={user.id || ''}
                    isCompany={false}
                    onUpgradeClick={() => {
                      setShowUpgradeModal(true);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('subscription_page.faq_title')}</h2>

          <div className="space-y-4">
            <details className="bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800 p-6 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer group">
              <summary className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                {t('subscription_page.faq.renewal_q')}
                <span className="text-blue-600 dark:text-blue-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                {t('subscription_page.faq.renewal_a')}
              </p>
            </details>

            <details className="bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800 p-6 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer group">
              <summary className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                {t('subscription_page.faq.pause_q')}
                <span className="text-blue-600 dark:text-blue-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                {t('subscription_page.faq.pause_a')}
              </p>
            </details>

            <details className="bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800 p-6 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer group">
              <summary className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                {t('subscription_page.faq.plan_contents_q')}
                <span className="text-blue-600 dark:text-blue-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 text-slate-600 dark:text-slate-300 space-y-2">
                <p>{t('subscription_page.faq.plan_free')}</p>
                <p>{t('subscription_page.faq.plan_basic')}</p>
                <p>{t('subscription_page.faq.plan_business')}</p>
                <p>{t('subscription_page.faq.plan_bundle')}</p>
              </div>
            </details>

            <details className="bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800 p-6 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer group">
              <summary className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                {t('subscription_page.faq.rollover_q')}
                <span className="text-blue-600 dark:text-blue-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                {t('subscription_page.faq.rollover_a')}
              </p>
            </details>

            <details className="bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800 p-6 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer group">
              <summary className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                {t('subscription_page.faq.support_q')}
                <span className="text-blue-600 dark:text-blue-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                {t('subscription_page.faq.support_a')}
              </p>
            </details>
          </div>
        </div>

        {/* Upgrade Modal */}
        {showUpgradeModal && company && (
          <PlanUpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            companyProfile={company}
          />
        )}
      </div>
    </div>
  );
};

export default SubscriptionManagementPage;
