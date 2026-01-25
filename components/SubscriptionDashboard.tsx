import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Zap, BarChart3, CreditCard } from 'lucide-react';
import { getSubscriptionStatus } from '../services/serverSideBillingService';

interface SubscriptionData {
  tier: string;
  tierName: string;
  status: string;
  expiresAt?: string;
  daysUntilRenewal?: number;
  currentPeriodStart?: string;
  assessmentsAvailable: number;
  assessmentsUsed: number;
  jobPostingsAvailable: number;
  stripeSubscriptionId?: string;
  canceledAt?: string;
}

interface SubscriptionDashboardProps {
  userId: string;
  onUpgradeClick?: () => void;
}

export const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({
  userId,
  onUpgradeClick,
}) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const data = await getSubscriptionStatus(userId);
        setSubscription(data as SubscriptionData);
        setError(null);
      } catch (err) {
        setError('Failed to load subscription information');
        console.error('Subscription fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchSubscription();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-red-900">Unable to load subscription</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const tierColors = {
    free: 'bg-gray-50 border-gray-200',
    basic: 'bg-blue-50 border-blue-200',
    business: 'bg-purple-50 border-purple-200',
    assessment_bundle: 'bg-amber-50 border-amber-200',
  };

  const tierBadgeColors = {
    free: 'bg-gray-100 text-gray-800',
    basic: 'bg-blue-100 text-blue-800',
    business: 'bg-purple-100 text-purple-800',
    assessment_bundle: 'bg-amber-100 text-amber-800',
  };

  const statusColors = {
    active: 'text-green-700 bg-green-100',
    inactive: 'text-gray-700 bg-gray-100',
    paused: 'text-yellow-700 bg-yellow-100',
    canceled: 'text-red-700 bg-red-100',
    expired: 'text-red-700 bg-red-100',
  };

  const assessmentPercentage =
    subscription.assessmentsAvailable > 0
      ? Math.min(100, (subscription.assessmentsUsed / subscription.assessmentsAvailable) * 100)
      : 0;

  const isExpired =
    subscription.expiresAt && new Date(subscription.expiresAt) < new Date();
  const isExpiringSoon =
    !isExpired &&
    subscription.daysUntilRenewal !== undefined &&
    subscription.daysUntilRenewal <= 7;

  return (
    <div className={`border rounded-lg p-6 ${tierColors[subscription.tier as keyof typeof tierColors]}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">{subscription.tierName} Plan</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${tierBadgeColors[subscription.tier as keyof typeof tierBadgeColors]}`}>
              {subscription.tier.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[subscription.status as keyof typeof statusColors]}`}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </span>
          </div>
        </div>

        {subscription.tier === 'free' && onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Upgrade Plan
          </button>
        )}
      </div>

      {/* Renewal Information */}
      {subscription.status === 'active' && subscription.expiresAt && (
        <div className={`mb-6 p-4 rounded-lg border-2 ${isExpiringSoon ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start gap-3">
            {isExpiringSoon ? (
              <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={`font-medium ${isExpiringSoon ? 'text-yellow-900' : 'text-green-900'}`}>
                {isExpiringSoon ? 'Renews Soon' : 'Active Subscription'}
              </p>
              <p className={`text-sm ${isExpiringSoon ? 'text-yellow-700' : 'text-green-700'}`}>
                Renews on {new Date(subscription.expiresAt).toLocaleDateString()} (in {subscription.daysUntilRenewal} days)
              </p>
              {subscription.currentPeriodStart && (
                <p className={`text-xs ${isExpiringSoon ? 'text-yellow-600' : 'text-green-600'}`}>
                  Current period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border-2 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Subscription Expired</p>
              <p className="text-sm text-red-700">
                Your subscription expired on {new Date(subscription.expiresAt!).toLocaleDateString()}
              </p>
              {onUpgradeClick && (
                <button
                  onClick={onUpgradeClick}
                  className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors font-medium"
                >
                  Renew Subscription
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {subscription.status === 'canceled' && (
        <div className="mb-6 p-4 rounded-lg bg-gray-50 border-2 border-gray-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Subscription Canceled</p>
              <p className="text-sm text-gray-700">
                Canceled on {new Date(subscription.canceledAt!).toLocaleDateString()}
              </p>
              {onUpgradeClick && (
                <button
                  onClick={onUpgradeClick}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors font-medium"
                >
                  Reactivate Plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Assessments */}
        {subscription.assessmentsAvailable > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">AI Assessments</span>
              </div>
              <span className="text-sm font-semibold text-blue-600">
                {subscription.assessmentsUsed}/{subscription.assessmentsAvailable}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${assessmentPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {subscription.assessmentsAvailable - subscription.assessmentsUsed} remaining
            </p>
          </div>
        )}

        {/* Job Postings */}
        {subscription.jobPostingsAvailable > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900">Job Postings</span>
              </div>
              <span className="text-sm font-semibold text-purple-600">Unlimited</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full w-full"></div>
            </div>
            <p className="text-xs text-gray-600 mt-2">Unlimited monthly postings</p>
          </div>
        )}

        {subscription.tier === 'free' && (
          <div className="bg-white rounded-lg p-4 border border-gray-200 md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Plan Limits</span>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Upgrade to unlock AI assessments, job postings, and premium features
            </p>
          </div>
        )}
      </div>

      {/* Plan Features */}
      <div className="border-t pt-4">
        <h3 className="font-medium text-gray-900 mb-3">Plan Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {subscription.tier === 'free' && (
            <>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                Limited job view
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                No assessments
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                Basic analytics
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                Community support
              </div>
            </>
          )}

          {subscription.tier === 'basic' && (
            <>
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle className="w-4 h-4" />
                20 AI assessments/month
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle className="w-4 h-4" />
                50 job postings/month
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle className="w-4 h-4" />
                Advanced analytics
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle className="w-4 h-4" />
                Email support
              </div>
            </>
          )}

          {subscription.tier === 'business' && (
            <>
              <div className="flex items-center gap-2 text-purple-700">
                <CheckCircle className="w-4 h-4" />
                Unlimited assessments
              </div>
              <div className="flex items-center gap-2 text-purple-700">
                <CheckCircle className="w-4 h-4" />
                Unlimited job postings
              </div>
              <div className="flex items-center gap-2 text-purple-700">
                <CheckCircle className="w-4 h-4" />
                Custom analytics & reports
              </div>
              <div className="flex items-center gap-2 text-purple-700">
                <CheckCircle className="w-4 h-4" />
                Priority 24/7 support
              </div>
              <div className="flex items-center gap-2 text-purple-700">
                <CheckCircle className="w-4 h-4" />
                Team management
              </div>
              <div className="flex items-center gap-2 text-purple-700">
                <CheckCircle className="w-4 h-4" />
                API access
              </div>
            </>
          )}

          {subscription.tier === 'assessment_bundle' && (
            <>
              <div className="flex items-center gap-2 text-amber-700">
                <CheckCircle className="w-4 h-4" />
                50 AI assessments (one-time)
              </div>
              <div className="flex items-center gap-2 text-amber-700">
                <CheckCircle className="w-4 h-4" />
                Valid for 12 months
              </div>
              <div className="flex items-center gap-2 text-amber-700">
                <CheckCircle className="w-4 h-4" />
                Advanced assessment insights
              </div>
              <div className="flex items-center gap-2 text-amber-700">
                <CheckCircle className="w-4 h-4" />
                Email support
              </div>
            </>
          )}
        </div>
      </div>

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 pt-4 border-t text-xs text-gray-500">
          <p>Stripe ID: {subscription.stripeSubscriptionId || 'N/A'}</p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionDashboard;
