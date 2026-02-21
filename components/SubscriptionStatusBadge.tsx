import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import { useTranslation } from 'react-i18next';

interface SubscriptionStatusBadgeProps {
  userId?: string;
  className?: string;
}

const SubscriptionStatusBadge: React.FC<SubscriptionStatusBadgeProps> = ({ userId, className = '' }) => {
  const { t } = useTranslation();
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const data = await getSubscriptionStatus(userId);
        setTier(data?.tier || 'free');
      } catch (err) {
        console.error('Failed to fetch subscription status:', err);
        setTier('free');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [userId]);

  if (loading || !tier) return null;
  const normalizedTier = (tier && tier !== 'premium' && tier.endsWith('_premium'))
      ? 'premium'
      : tier;

  const tierConfig = {
    free: { color: 'bg-slate-100 text-slate-700', label: t('subscription_badge.free') },
    premium: { color: 'bg-cyan-100 text-cyan-700', label: t('subscription_badge.premium') },
    basic: { color: 'bg-blue-100 text-blue-700', label: t('subscription_badge.basic') },
    professional: { color: 'bg-purple-100 text-purple-700', label: t('subscription_badge.professional', { defaultValue: 'Professional' }) },
    trial: { color: 'bg-indigo-100 text-indigo-700', label: t('subscription_badge.trial') },
    enterprise: { color: 'bg-emerald-100 text-emerald-700', label: t('subscription_badge.enterprise') },
    assessment_bundle: { color: 'bg-amber-100 text-amber-700', label: t('subscription_badge.assessment_bundle') },
    single_assessment: { color: 'bg-orange-100 text-orange-700', label: t('subscription_badge.single_assessment') }
  };

  const config = tierConfig[normalizedTier as keyof typeof tierConfig] || tierConfig.free;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${config.color} ${className}`}>
      <CreditCard size={12} />
      {config.label}
    </div>
  );
};

export default SubscriptionStatusBadge;
