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
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = locale === 'at' ? 'de' : locale;
  const rawTier = String(userProfile.subscription?.tier || 'free').toLowerCase();
  const normalizedTier = rawTier !== 'premium' && rawTier.endsWith('_premium') ? 'premium' : rawTier;
  const isPremium = normalizedTier === 'premium';

  // If user is not logged in or has no id, show a simpler version
  const isIncomplete = !userProfile.isLoggedIn || !userProfile.id;

  const copy = (() => {
    if (language === 'cs') {
      return {
        title: 'Odemkni premium handshake nástroje',
        subtitle: 'Víc AI podpory pro podklady, follow-up zprávy a čistší signál před prvním rozhovorem.',
        liteFeatures: [
          ['Drafty podpůrných podkladů', 'Připravíš si klidnější supporting context bez CV-first tónu.'],
          ['AI přepis první odpovědi', 'Vyladíš první reakci i navazující zprávy do lidštějšího tónu.'],
          ['Chytré follow-upy', 'Připomeneš se bez spamu a s lepším načasováním.']
        ],
        priceLine: 'Jedním tarifem odemkneš celou premium vrstvu pro handshake workflow.',
        whyUpgrade: 'Proč to dává smysl'
      };
    }
    if (language === 'sk') {
      return {
        title: 'Odomkni premium handshake nástroje',
        subtitle: 'Viac AI podpory pre podklady, follow-up správy a čistejší signál pred prvým rozhovorom.',
        liteFeatures: [
          ['Drafty podporných podkladov', 'Pripravíš si pokojnejší supporting context bez CV-first tónu.'],
          ['AI prepis prvej odpovede', 'Vyladíš prvú reakciu aj nadväzujúce správy do ľudskejšieho tónu.'],
          ['Chytré follow-upy', 'Pripomenieš sa bez spamu a s lepším načasovaním.']
        ],
        priceLine: 'Jedným tarifom odomkneš celú premium vrstvu pre handshake workflow.',
        whyUpgrade: 'Prečo to dáva zmysel'
      };
    }
    if (language === 'de') {
      return {
        title: 'Premium-Handshake-Tools freischalten',
        subtitle: 'Mehr AI-Unterstützung für Unterlagen, Follow-up-Nachrichten und ein klareres Signal vor dem ersten Gespräch.',
        liteFeatures: [
          ['Entwürfe für unterstützende Unterlagen', 'Bereite ruhigeren Supporting Context ohne CV-first Ton vor.'],
          ['AI-Umschreiben der ersten Antwort', 'Verfeinere deine erste Reaktion und Follow-ups in einem menschlicheren Ton.'],
          ['Intelligentere Follow-ups', 'Bleib sichtbar ohne Spam und mit besserem Timing.']
        ],
        priceLine: 'Ein Tarif schaltet die gesamte Premium-Ebene für den Handshake-Workflow frei.',
        whyUpgrade: 'Warum sich das lohnt'
      };
    }
    if (language === 'pl') {
      return {
        title: 'Odblokuj narzędzia premium do handshake',
        subtitle: 'Więcej wsparcia AI dla materiałów, follow-up wiadomości i czystszego sygnału przed pierwszą rozmową.',
        liteFeatures: [
          ['Drafty materiałów wspierających', 'Przygotujesz spokojniejszy supporting context bez tonu CV-first.'],
          ['AI przepisanie pierwszej odpowiedzi', 'Dopracujesz pierwszą reakcję i kolejne wiadomości w bardziej ludzkim tonie.'],
          ['Sprytniejsze follow-upy', 'Przypomnisz się bez spamu i z lepszym timingiem.']
        ],
        priceLine: 'Jeden plan odblokowuje całą warstwę premium dla handshake workflow.',
        whyUpgrade: 'Dlaczego to ma sens'
      };
    }
    return {
      title: 'Unlock premium handshake tools',
      subtitle: 'More AI help for supporting context, follow-up messages, and cleaner signal before the first interview.',
      liteFeatures: [
        ['Supporting context drafts', 'Prepare calmer supporting context without a CV-first tone.'],
        ['AI first-reply rewrites', 'Refine your opening reply and follow-up messages in a more human tone.'],
        ['Smarter follow-ups', 'Stay visible without spamming and with better timing.']
      ],
      priceLine: 'One plan unlocks the full premium layer for the handshake workflow.',
      whyUpgrade: 'Why it is worth it'
    };
  })();

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
      color: 'from-green-500 to-amber-500',
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
              <h2 className="text-xl md:text-2xl font-bold text-white">{copy.title}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {copy.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[FileText, Wand2, Mail].map((Icon, index) => (
              <div key={index} className="flex items-start gap-3">
                <Icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${index === 0 ? 'text-blue-600' : index === 1 ? 'text-purple-600' : 'text-green-600'}`} />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{copy.liteFeatures[index][0]}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{copy.liteFeatures[index][1]}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl border border-blue-200 dark:border-blue-800 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-slate-600 dark:text-slate-300 mb-1">{copy.priceLine}</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {price.eurLabel} <span className="text-lg text-slate-500 dark:text-slate-400">{price.billingLabel}</span>
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {`≈ ${price.czkLabel} / ${price.plnLabel}`}
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
              <h2 className="text-2xl md:text-3xl font-bold text-white">{copy.title}</h2>
              <p className="text-blue-100 text-sm md:text-base mt-1">
                {copy.subtitle}
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
            {copy.whyUpgrade}
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
              {price.eurLabel} <span className="text-lg text-slate-500 dark:text-slate-400">{price.billingLabel}</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {`≈ ${price.czkLabel} / ${price.plnLabel}`}
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
