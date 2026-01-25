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

interface PremiumFeaturesPreviewProps {
  userProfile: UserProfile;
  onUpgradeClick?: () => void;
}

const PremiumFeaturesPreview: React.FC<PremiumFeaturesPreviewProps> = ({ 
  userProfile, 
  onUpgradeClick 
}) => {
  const isPremium = userProfile.subscription?.tier === 'premium';
  
  // If user is not logged in or has no id, show a simpler version
  const isIncomplete = !userProfile.isLoggedIn || !userProfile.id;
  
  const premiumFeatures = [
    {
      icon: Wand2,
      title: 'AI Analýza CV',
      description: 'Hluboká analýza vašeho CV a doporučení zlepšení',
      benefits: [
        'Analýza relevance vašich zkušeností',
        'Identifikace nedostatků na trhu',
        'Konkrétní doporučení pro rozvoj',
        'Porovnání s trhem'
      ],
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      icon: Mail,
      title: 'AI Motivační Dopis',
      description: 'Generování personalizovaných motivačních dopisů',
      benefits: [
        'Automatické vytvoření na míru',
        'Přizpůsobení pro konkrétní firmu',
        'Zvýšení šancí na pohovor',
        'Profesionální psaní'
      ],
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      icon: Zap,
      title: 'Doporučení Kurzů',
      description: 'AI doporučení kurzů na základě vašeho profilu',
      benefits: [
        'Personalizovaná na vaši kariéru',
        'Zvyšují vaši hodnotu na trhu',
        'Relevantní pro hledané pozice',
        'Ověřené zdroje'
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
              <h2 className="text-xl md:text-2xl font-bold text-white">Odemkněte JobShaman Premium</h2>
              <p className="text-blue-100 text-sm mt-1">
                AI nástroje pro CV, motivační dopisy a optimalizaci
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">CV Šablony</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Profesionální designy</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Wand2 className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">AI Přepsání CV</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Optimalizace na pozici</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">AI Motivační Dopis</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Personalizované</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl border border-blue-200 dark:border-blue-800 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-slate-600 dark:text-slate-300 mb-1">Přístup ke všem funkcím za</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                199 Kč <span className="text-lg text-slate-500 dark:text-slate-400">/měsíc</span>
              </p>
            </div>

            <button
              onClick={handleUpgrade}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-lg transition-all hover:shadow-lg whitespace-nowrap"
            >
              <Lock className="w-5 h-5" />
              Upgradovat
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
              <h2 className="text-2xl md:text-3xl font-bold text-white">Odemkněte JobShaman Premium</h2>
              <p className="text-blue-100 text-sm md:text-base mt-1">
                Získejte přístup k AI nástrojům, které vám pomohou dostat se na vyšší pozici
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
            Proč upgrade?
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Vyšší šance na zaměstnání
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  AI optimalizace vašeho CV zvýší relevanci pro danou pozici
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Ušetřete čas
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Automatické generování motivačních dopisů
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Profesionální materiály
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Šablony navržené profesionály
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Check className="w-5 h-5 text-green-500 mt-0.5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Trvalý přístup
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Používejte nástroje kdykoli potřebujete
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing and CTA */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl border border-blue-200 dark:border-blue-800 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-slate-600 dark:text-slate-300 mb-2">
              Přístup ke všem premium funkcím za
            </p>
            <p className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
              199 Kč <span className="text-lg text-slate-500 dark:text-slate-400">/měsíc</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Zrušit kdykoli bez pokut
            </p>
          </div>

          <button
            onClick={handleUpgrade}
            className="flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-lg transition-all hover:shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <Lock className="w-5 h-5" />
            Upgradovat na Premium
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Trust Badges */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Zabezpečená platba</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Bez dlouhodobého závazku</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Okamžitý přístup</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumFeaturesPreview;
