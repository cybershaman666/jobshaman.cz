import React from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
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
 */
export const SubscriptionManagementPage = () => {
  const { userProfile: user, companyProfile: company } = useUserProfile();
  
  // Check if user is still loading (not yet logged in and no id)
  const isLoading = !user?.isLoggedIn || !user?.id;
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  console.log('📄 SubscriptionManagementPage - user:', {
    isLoggedIn: user?.isLoggedIn,
    hasId: !!user?.id,
    userId: user?.id,
    email: user?.email
  });

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
            <p className="text-yellow-800">Please log in to view your subscription.</p>
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
            <p className="text-red-800">Error: User ID not available. Please try logging in again.</p>
          </div>
        </div>
      </div>
    );
  }

  const isCompanyAdmin = !!company;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription & Billing</h1>
          <p className="text-gray-600">
            Manage your {isCompanyAdmin ? 'company' : 'account'} subscription and view your usage limits.
          </p>
        </div>

        {/* Personal User Subscription */}
        {!isCompanyAdmin && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Personal Subscription</h2>
              <SubscriptionDashboard
                userId={user.id || ''}
                onUpgradeClick={() => {
                  setShowUpgradeModal(true);
                }}
              />
            </div>

            {/* Premium Features Upsell */}
            <PremiumUpsellCard userId={user.id || ''} />

            {/* Additional Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">💡 Pro Tip</h3>
              <p className="text-sm text-blue-800">
                Need more assessments? Consider upgrading to our Business plan for unlimited access to all features.
              </p>
            </div>
          </div>
        )}

        {/* Company Subscription (for company admins) */}
        {isCompanyAdmin && company && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {company.name} - Company Subscription
              </h2>
              <SubscriptionDashboard
                userId={company.id || user.id || ''}
                onUpgradeClick={() => {
                  setShowUpgradeModal(true);
                }}
              />
            </div>

            {/* Company Benefits */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-medium text-purple-900 mb-2">🏢 Company Benefits</h3>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>✓ Team management and multiple user accounts</li>
                <li>✓ Shared assessment credits across your team</li>
                <li>✓ Advanced analytics and custom reports</li>
                <li>✓ Priority support and dedicated account manager</li>
                <li>✓ API access for integrations</li>
              </ul>
            </div>

            {/* Personal Subscription (if they also have one) */}
            {user.subscription?.tier && user.subscription.tier !== 'free' && (
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Personal Subscription</h2>
                <SubscriptionDashboard
                  userId={user.id || ''}
                  onUpgradeClick={() => {
                    setShowUpgradeModal(true);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>

          <div className="space-y-4">
            <details className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 cursor-pointer">
              <summary className="font-medium text-gray-900">
                What happens when my subscription renews?
              </summary>
              <p className="mt-2 text-gray-600">
                Your subscription will automatically renew on the date shown in your dashboard. We'll charge your payment method on file. If you want to pause or cancel, you can do so anytime.
              </p>
            </details>

            <details className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 cursor-pointer">
              <summary className="font-medium text-gray-900">
                Can I pause my subscription?
              </summary>
              <p className="mt-2 text-gray-600">
                Yes, you can pause your subscription to retain your data without being charged. Contact our support team to pause for up to 3 months.
              </p>
            </details>

            <details className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 cursor-pointer">
              <summary className="font-medium text-gray-900">
                What's included in each plan?
              </summary>
              <div className="mt-2 text-gray-600 space-y-2">
                <p><strong>Free:</strong> Limited job view, basic features</p>
                <p><strong>Basic:</strong> 20 assessments/month, 50 job postings/month</p>
                <p><strong>Business:</strong> Unlimited assessments, unlimited postings, priority support</p>
                <p><strong>Assessment Bundle:</strong> 50 one-time assessments valid for 12 months</p>
              </div>
            </details>

            <details className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 cursor-pointer">
              <summary className="font-medium text-gray-900">
                Do unused credits roll over?
              </summary>
              <p className="mt-2 text-gray-600">
                No, monthly credits reset on your renewal date. However, assessment bundle purchases are valid for 12 months from purchase.
              </p>
            </details>

            <details className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 cursor-pointer">
              <summary className="font-medium text-gray-900">
                How do I contact support?
              </summary>
              <p className="mt-2 text-gray-600">
                Email us at support@jobshaman.cz or use the chat widget in the app. Business plan users get priority 24/7 support.
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
