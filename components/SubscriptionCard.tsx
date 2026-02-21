import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserProfile, CompanyProfile } from '../types';
import { CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import SubscriptionDashboard from './SubscriptionDashboard';
import PlanUpgradeModal from './PlanUpgradeModal';
import PremiumUpsellCard from './PremiumUpsellCard';

interface SubscriptionCardProps {
  userProfile: UserProfile;
  companyProfile?: CompanyProfile | null;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ userProfile, companyProfile }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  
  const isLoading = !userProfile?.isLoggedIn || !userProfile?.id;
  const isCompanyAdmin = !!companyProfile;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div 
          className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/70 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('subscription_card.title')}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {isCompanyAdmin ? t('subscription_card.company_mgmt') : t('subscription_card.personal_mgmt')}
                </p>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div className="p-6 space-y-6">
            {/* Personal User Subscription */}
            {!isCompanyAdmin && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('subscription_card.your_subscription')}</h3>
                <SubscriptionDashboard
                  userId={userProfile.id || ''}
                  onUpgradeClick={() => {
                    setShowUpgradeModal(true);
                  }}
                />
              </div>
            )}

            {/* Company Subscription (for company admins) */}
            {isCompanyAdmin && companyProfile && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {t('subscription_card.company_title', { company: companyProfile.name })}
                </h3>
                <SubscriptionDashboard
                  userId={companyProfile.id || userProfile.id || ''}
                  onUpgradeClick={() => {
                    setShowUpgradeModal(true);
                  }}
                />
              </div>
            )}

            {/* Premium Features Upsell */}
            {!isCompanyAdmin && (
              <PremiumUpsellCard userId={userProfile.id || ''} />
            )}

            {/* Company Benefits */}
            {isCompanyAdmin && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <h4 className="font-bold text-purple-900 dark:text-purple-300 mb-4 flex items-center gap-2">
                  <span>🏢</span> {t('subscription_card.company_benefits_title')}
                </h4>
                <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
                  <li>{t('subscription_card.company_benefits.team_management')}</li>
                  <li>{t('subscription_card.company_benefits.shared_credits')}</li>
                  <li>{t('subscription_card.company_benefits.analytics')}</li>
                  <li>{t('subscription_card.company_benefits.priority_support')}</li>
                  <li>{t('subscription_card.company_benefits.api_access')}</li>
                </ul>
              </div>
            )}

            {/* Personal Subscription (if company admin also has one) */}
            {isCompanyAdmin && userProfile.subscription?.tier && userProfile.subscription.tier !== 'free' && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('subscription_card.personal_subscription')}</h3>
                <SubscriptionDashboard
                  userId={userProfile.id || ''}
                  onUpgradeClick={() => {
                    setShowUpgradeModal(true);
                  }}
                />
              </div>
            )}

            {/* Quick FAQ */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">{t('subscription_card.quick_info_title')}</h4>
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <p>{t('subscription_card.quick_info.renewal')}</p>
                <p>{t('subscription_card.quick_info.pause')}</p>
                <p>{t('subscription_card.quick_info.credits')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && companyProfile && (
        <PlanUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          companyProfile={companyProfile}
        />
      )}
    </>
  );
};

export default SubscriptionCard;
