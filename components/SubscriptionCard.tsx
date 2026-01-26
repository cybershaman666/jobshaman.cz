import React from 'react';
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
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Předplatné</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {isCompanyAdmin ? 'Správa předplatného společnosti' : 'Správa vašeho předplatného'}
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Vaše Předplatné</h3>
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
                  {companyProfile.name} - Předplatné Společnosti
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
                  <span>🏢</span> Výhody Společnosti
                </h4>
                <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2">
                  <li>✓ Správa týmu a více uživatelských účtů</li>
                  <li>✓ Sdílené kredity hodnocení v celém týmu</li>
                  <li>✓ Pokročilá analytika a vlastní zprávy</li>
                  <li>✓ Prioritní podpora a vyhrazený správce účtu</li>
                  <li>✓ API přístup pro integrace</li>
                </ul>
              </div>
            )}

            {/* Personal Subscription (if company admin also has one) */}
            {isCompanyAdmin && userProfile.subscription?.tier && userProfile.subscription.tier !== 'free' && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Vaše Osobní Předplatné</h3>
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
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Rychlé informace</h4>
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <p><strong>Co se stane při obnovení?</strong> Předplatné se automaticky obnoví a bude vám účtována platební metoda.</p>
                <p><strong>Lze pozastavit?</strong> Ano, kontaktujte podporu pro pozastavení až na 3 měsíce.</p>
                <p><strong>Nevyužité kredity?</strong> Měsíční kredity se resetují, balíčky jsou platné 12 měsíců.</p>
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