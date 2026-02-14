import React from 'react';
import { useTranslation } from 'react-i18next';
import { Building, TrendingUp, Shield, BrainCircuit, Target, Star, CheckCircle, Crown, Sparkles, BarChart, Info, LogIn } from 'lucide-react';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

interface PricingPlan {
  name: string;
  price: string;
  originalPrice?: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  isPromotional?: boolean;
}

const CompanyLandingPage: React.FC<CompanyLandingPageProps> = ({ onRegister, onRequestDemo, onLogin }) => {
  const { t } = useTranslation();
  const plans: PricingPlan[] = [
    {
      name: t('company_landing.pricing.plans.basic.name'),
      price: t('company_landing.pricing.always_free'),
      period: '',
      description: t('company_landing.pricing.plans.basic.desc'),
      features: [
        t('company_landing.pricing.plans.basic.f1'),
        t('company_landing.pricing.plans.basic.f2'),
        t('company_landing.pricing.plans.basic.f3'),
        t('company_landing.pricing.plans.basic.f4'),
        t('company_landing.pricing.plans.basic.f5')
      ],
      highlighted: false
    },
    {
      name: t('company_landing.pricing.plans.business.name'),
      price: '4 990 Kč',
      originalPrice: '9 990 Kč',
      period: t('company_landing.pricing.period'),
      description: t('company_landing.pricing.plans.business.desc'),
      features: [
        t('company_landing.pricing.plans.business.f1'),
        t('company_landing.pricing.plans.business.f2'),
        t('company_landing.pricing.plans.business.f3'),
        t('company_landing.pricing.plans.business.f4'),
        t('company_landing.pricing.plans.business.f5')
      ],
      highlighted: true,
      isPromotional: true
    },
    {
      name: t('company_landing.pricing.plans.enterprise.name'),
      price: t('company_landing.pricing.price_custom'),
      period: '',
      description: t('company_landing.pricing.plans.enterprise.desc'),
      features: [
        t('company_landing.pricing.plans.enterprise.f1'),
        t('company_landing.pricing.plans.enterprise.f2'),
        t('company_landing.pricing.plans.enterprise.f3'),
        t('company_landing.pricing.plans.enterprise.f4'),
        'Dedicated account manager',
        'SLA garance',
        'Vlastní branding',
        'API přístupy'
      ],
      highlighted: false
    }
  ];

  const featuresList = [
    {
      icon: Sparkles,
      title: t('company_landing.features.optimization.title'),
      description: t('company_landing.features.optimization.desc'),
      color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400'
    },
    {
      icon: BrainCircuit,
      title: t('company_landing.features.assessment.title'),
      description: t('company_landing.features.assessment.desc'),
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400'
    },
    {
      icon: Target,
      title: t('company_landing.features.posting.title'),
      description: t('company_landing.features.posting.desc'),
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
    },
    {
      icon: BarChart,
      title: t('company_landing.features.insights.title'),
      description: t('company_landing.features.insights.desc'),
      color: 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400'
    },
    {
      icon: Shield,
      title: t('company_landing.features.dashboard.title'),
      description: t('company_landing.features.dashboard.desc'),
      color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
    }
  ];

  // Remove fake statistics - keep it simple
  const benefits = [
    { icon: Sparkles, text: t('company_landing.benefits.ai_powered') },
    { icon: Target, text: t('company_landing.benefits.easy_posting') },
    { icon: TrendingUp, text: t('company_landing.benefits.insights') },
    {
      icon: CheckCircle,
      text: t('company_landing.benefits.conversion_without_assessment', {
        defaultValue: 'Vyšší konverze a relevance odpovědí i bez AI assessmentu'
      })
    }
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
      {/* Login Button in top right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={onLogin}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors shadow-sm"
        >
          <LogIn size={16} />
          {t('company_landing.hero.login')}
        </button>
      </div>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-8 lg:p-16 w-full">
        <div className="my-auto w-full max-w-5xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-6 border border-slate-300/50 dark:border-slate-700">
              <Building size={12} />
              {t('company_landing.hero.badge')}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              {t('company_landing.hero.title_start')} <span className="text-cyan-600 dark:text-cyan-400">{t('company_landing.hero.title_highlight')}</span> {t('company_landing.hero.title_end')}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
              {t('company_landing.hero.subtitle')}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <TrendingUp size={16} />
              {t('company_landing.hero.value_prop', {
                defaultValue: 'Nejen levnější nábor. Lepší konverze a relevantnější odpovědi.'
              })}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <button
                onClick={onRegister}
                className="flex items-center gap-2 text-sm font-bold text-white dark:text-slate-900 bg-cyan-600 dark:bg-cyan-400 hover:bg-cyan-500 dark:hover:bg-cyan-300 px-8 py-3 rounded-lg transition-colors shadow-lg"
              >
                <Building size={18} />
                {t('company_landing.hero.start_free')}
              </button>
              <button
                onClick={onLogin}
                className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-8 py-3 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
              >
                <LogIn size={18} />
                {t('company_landing.hero.login')}
              </button>
            </div>
            <div className="mt-4 max-w-3xl mx-auto text-sm text-slate-600 dark:text-slate-300">
              {t('company_landing.hero.value_prop_detail', {
                defaultValue: 'JobShaman cílí nabídky podle reálného chování kandidátů (zobrazení, otevření detailu, reakce), takže firmy dostávají kvalitnější odpovědi už v základním flow, i bez zapnutí AI assessmentu.'
              })}
            </div>
          </div>

          {/* Benefits Grid - Simple and Honest */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg">
                    <benefit.icon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{benefit.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Features Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles size={24} className="text-cyan-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.features.title')}</h3>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuresList.map((feature, index) => (
                <div key={index} className="p-6 bg-slate-50 dark:bg-slate-950 rounded-lg">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${feature.color}`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-base mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Section - Matching App Style */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Crown size={24} className="text-amber-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.pricing.title')}</h3>
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Info size={14} />
                {t('company_landing.pricing.badge')}
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan, index) => (
                <div key={index} className={`relative bg-slate-50 dark:bg-slate-950 rounded-xl p-6 border-2 transition-all ${plan.highlighted
                  ? 'border-cyan-500 dark:border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20'
                  : plan.price === 'Zdarma'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-700'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                  {plan.price === t('company_landing.pricing.always_free') && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <Star className="w-3 h-3" />
                        {t('company_landing.pricing.always_free')}
                      </div>
                    </div>
                  )}
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="flex items-center gap-1 bg-cyan-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <Star className="w-3 h-3" />
                        {plan.isPromotional ? t('company_landing.pricing.offer') : t('company_landing.pricing.best_choice')}
                      </div>
                    </div>
                  )}
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {plan.name}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      {plan.description}
                    </p>
                    <div className="mb-4">
                      {plan.isPromotional && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold mb-2">
                          <Sparkles size={12} />
                          {t('company_landing.pricing.promo_discount')}
                        </div>
                      )}
                      <div className="space-y-1">
                        {plan.originalPrice && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg text-slate-400 line-through">
                              {plan.originalPrice}
                            </span>
                            {plan.period && (
                              <span className="text-slate-400 text-sm">
                                /{plan.period}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-bold ${plan.price === t('company_landing.pricing.always_free')
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-cyan-600 dark:text-cyan-400'
                            }`}>
                            {plan.price}
                          </span>
                          {plan.period && !plan.originalPrice && (
                            <span className="text-slate-600 dark:text-slate-400 text-sm">
                              /{plan.period}
                            </span>
                          )}
                        </div>
                      </div>
                      {plan.isPromotional && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t('company_landing.pricing.promo_hint')}
                        </p>
                      )}
                      {plan.name === t('company_landing.pricing.plans.business.name') && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t('company_landing.pricing.extra_assessment')}
                        </p>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    {plan.features.slice(0, 4).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 dark:text-slate-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                    {plan.features.length > 4 && (
                      <li className="text-xs text-slate-500 dark:text-slate-400 text-center pt-1">
                        {t('company_landing.pricing.more_features', { count: plan.features.length - 4 })}
                      </li>
                    )}
                  </ul>
                  <button
                    onClick={plan.name === t('company_landing.pricing.plans.enterprise.name') ? onRequestDemo : onRegister}
                    className={`w-full py-2.5 rounded-lg font-semibold transition-all text-sm ${plan.price === t('company_landing.pricing.always_free')
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : plan.highlighted
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white'
                      }`}
                  >
                    {plan.name === t('company_landing.pricing.plans.enterprise.name') ? t('company_landing.pricing.cta_contact') : plan.price === t('company_landing.pricing.always_free') ? t('company_landing.pricing.cta_start_free') : t('company_landing.pricing.cta_start')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Final CTA - Matching App Style */}
          <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 text-xs font-semibold mb-4">
                <Building size={12} />
                {t('company_landing.cta.badge')}
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                {t('company_landing.cta.title_start')} <span className="text-cyan-400">{t('company_landing.cta.title_highlight')}</span> {t('company_landing.cta.title_end')}
              </h3>
              <p className="text-slate-300 mb-6">
                {t('company_landing.cta.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={onRegister}
                  className="flex items-center gap-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-8 py-3 rounded-lg transition-colors shadow-lg"
                >
                  <Building size={18} />
                  {t('company_landing.cta.register')}
                </button>
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 text-sm font-bold text-white hover:text-cyan-400 bg-transparent hover:bg-slate-800 px-8 py-3 rounded-lg transition-colors border border-slate-700"
                >
                  <LogIn size={18} />
                  {t('company_landing.cta.login')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyLandingPage;
