import React from 'react';
import {
  Zap,
  FileText,
  Wand2,
  Mail,
  Lock,
  ArrowRight,
  Star,
  Check
} from 'lucide-react';
import { UserProfile } from '../types';
import { redirectToCheckout } from '../services/stripeService';
import { useTranslation } from 'react-i18next';
import { getPremiumPriceDisplay } from '../services/premiumPricingService';

interface PremiumFeaturesPreviewProps {
  userProfile: UserProfile;
  onUpgradeClick?: () => void;
}

const PremiumFeaturesPreview: React.FC<PremiumFeaturesPreviewProps> = ({
  userProfile,
  onUpgradeClick
}) => {
  const { t, i18n } = useTranslation();
  const price = getPremiumPriceDisplay(i18n.language || 'cs');
  const isPremium = userProfile.subscription?.tier === 'premium';

  // If user is not logged in or has no id, show a simpler version
  const isIncomplete = !userProfile.isLoggedIn || !userProfile.id;

  const premiumFeatures = [
    {
      icon: Wand2,
      title: t('premium.feature_1_title'),
      description: t('premium.feature_1_desc'),
      benefits: [
        t('premium.feature_1_benefit_1'),
        t('premium.feature_1_benefit_2'),
        t('premium.feature_1_benefit_3'),
        t('premium.feature_1_benefit_4')
      ],
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      icon: Mail,
      title: t('premium.feature_2_title'),
      description: t('premium.feature_2_desc'),
      benefits: [
        t('premium.feature_2_benefit_1'),
        t('premium.feature_2_benefit_2'),
        t('premium.feature_2_benefit_3'),
        t('premium.feature_2_benefit_4')
      ],
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      icon: Zap,
      title: t('premium.feature_3_title'),
      description: t('premium.feature_3_desc'),
      benefits: [
        t('premium.feature_3_benefit_1'),
        t('premium.feature_3_benefit_2'),
        t('premium.feature_3_benefit_3'),
        t('premium.feature_3_benefit_4')
      ],
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    }
  ];

  const handleUpgrade = () => {
    if (!userProfile.isLoggedIn || !userProfile.id) {
      // If user is not logged in, they'll need to log in first
      onUpgradeClick?.();
      return;
    }
    redirectToCheckout('premium', userProfile.id);
  };

  if (isPremium) {
    return null; // Don't show upselling to premium users
  }

  // Show a simplified version for users without id
  if (isIncomplete) {
    return (
      <div className="w-full bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 md:px-8 py-6">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-white" fill="white" />
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">{t('premium.unlock_title')}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {t('premium.unlock_subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{t('premium.short_cv_templates')}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t('premium.short_cv_templates_desc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Wand2 className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{t('premium.short_ai_rewrite')}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t('premium.short_ai_rewrite_desc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{t('premium.short_ai_letter')}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t('premium.short_ai_letter_desc')}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl border border-blue-200 dark:border-blue-800 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-slate-600 dark:text-slate-300 mb-1">{t('premium.price_access_all')}</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {price.eurMonthlyLabel} <span className="text-lg text-slate-500 dark:text-slate-400">/{t('financial.per_month')}</span>
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {`≈ ${price.czkMonthlyLabel} / ${price.plnMonthlyLabel}`}
              </p>
            </div>

            <button
              onClick={handleUpgrade}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-lg transition-all hover:shadow-lg whitespace-nowrap"
            >
              <Lock className="w-5 h-5" />
              {t('premium.upgrade_btn_short')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 md:px-8 py-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-lg">
              <Star className="w-6 h-6 text-white" fill="white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">{t('premium.unlock_title')}</h2>
              <p className="text-blue-100 text-sm md:text-base mt-1">
                {t('premium.unlock_desc_full')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="px-6 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {premiumFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={`rounded-xl p-6 border border-blue-200 dark:border-blue-800 ${feature.bgColor} transition-all hover:shadow-lg`}
              >
                <div className={`bg-gradient-to-br ${feature.color} w-12 h-12 rounded-lg flex items-center justify-center text-white mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {feature.title}
                </h3>

                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  {feature.description}
                </p>

                <div className="space-y-2">
                  {feature.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Value Proposition */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            {t('premium.why_upgrade')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t('premium.reason_1_title')}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {t('premium.reason_1_desc')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t('premium.reason_2_title')}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {t('premium.reason_2_desc')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t('premium.reason_3_title')}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {t('premium.reason_3_desc')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t('premium.reason_4_title')}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {t('premium.reason_4_desc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing and CTA */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl border border-blue-200 dark:border-blue-800 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-slate-600 dark:text-slate-300 mb-2">
              {t('premium.price_access_all')}
            </p>
            <p className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
              {price.eurMonthlyLabel} <span className="text-lg text-slate-500 dark:text-slate-400">/{t('financial.per_month')}</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {`≈ ${price.czkMonthlyLabel} / ${price.plnMonthlyLabel}`}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {t('premium.cancel_anytime')}
            </p>
          </div>

          <button
            onClick={handleUpgrade}
            className="flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-lg transition-all hover:shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <Lock className="w-5 h-5" />
            {t('premium.upgrade_btn')}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Trust Badges */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>{t('premium.trust_1')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>{t('premium.trust_2')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>{t('premium.trust_3')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumFeaturesPreview;
