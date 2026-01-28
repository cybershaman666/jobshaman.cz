import React from 'react';
import { useTranslation } from 'react-i18next';
import { Building, TrendingUp, Shield, Users, BrainCircuit, Target, Eye, Star, CheckCircle, Crown, Sparkles, BarChart, MessageSquare, Info, LogIn } from 'lucide-react';

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
      icon: BrainCircuit,
      title: t('company_landing.features.assessment.title'),
      description: t('company_landing.features.assessment.desc'),
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
    },
    {
      icon: Target,
      title: t('company_landing.features.analysis.title'),
      description: t('company_landing.features.analysis.desc'),
      color: 'bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400'
    },
    {
      icon: Sparkles,
      title: t('company_landing.features.optimization.title'),
      description: t('company_landing.features.optimization.desc'),
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400'
    },
    {
      icon: BarChart,
      title: t('company_landing.features.analytics.title'),
      description: t('company_landing.features.analytics.desc'),
      color: 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400'
    },
    {
      icon: Shield,
      title: t('company_landing.features.transparent.title'),
      description: t('company_landing.features.transparent.desc'),
      color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
    }
  ];

  const statsList = [
    { value: '75%', label: t('company_landing.stats.screening') },
    { value: '40%', label: t('company_landing.stats.costs') },
    { value: '3x', label: t('company_landing.stats.filling') },
    { value: '89%', label: t('company_landing.stats.satisfaction') }
  ];

  const testimonials = [
    {
      company: 'TechInnovate s.r.o.',
      role: 'HR Director',
      name: 'Petra Nováková',
      text: 'JobShaman kompletně změnil náš náborový proces. AI analýza kandidátů nám ušetřila desítky hodin měsíčně.',
      rating: 5
    },
    {
      company: 'Digital Solutions',
      role: 'Tech Lead',
      name: 'Martin Dvořák',
      text: 'Assessment Center je naprosto geniální. Rychle identifikujeme skutečné talenty bez zbytečných kolapsů.',
      rating: 5
    },
    {
      company: 'Finance Group CZ',
      role: 'Recruitment Manager',
      name: 'Lucie Horáková',
      text: 'Optimalizace inzerátů pomocí AI přinesla o 60% kvalitnějších kandidátů. Skvělá investice.',
      rating: 5
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onRegister}
                className="flex items-center gap-2 text-sm font-bold text-white dark:text-slate-900 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 px-6 py-2.5 rounded-lg transition-colors"
              >
                <Building size={18} />
                {t('company_landing.hero.start_free')}
              </button>
              <button
                onClick={onLogin}
                className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-6 py-2.5 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
              >
                <LogIn size={18} />
                {t('company_landing.hero.login')}
              </button>
              <button
                onClick={onRequestDemo}
                className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-6 py-2.5 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
              >
                <Eye size={18} />
                {t('company_landing.hero.view_demo')}
              </button>
            </div>
          </div>

          {/* Stats Section - Matching App Card Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp size={24} className="text-emerald-500" />
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.stats.title')}</h3>
                </div>
                <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <Info size={14} />
                  {t('company_landing.stats.badge')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {statsList.map((stat, index) => (
                  <div key={index} className="text-center p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={24} className="text-purple-500" />
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.features.title')}</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {featuresList.slice(0, 3).map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${feature.color}`}>
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* More Features */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Shield size={24} className="text-indigo-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.features.more_title')}</h3>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuresList.slice(3).map((feature, index) => (
                <div key={index} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${feature.color}`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
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

          {/* Testimonials - Matching App Card Style */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users size={24} className="text-blue-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.testimonials.title')}</h3>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-950 rounded-lg p-4">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 italic leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {testimonial.role} @ {testimonial.company}
                    </div>
                  </div>
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
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('company_landing.cta.title_start')} <span className="text-cyan-600 dark:text-cyan-400">{t('company_landing.cta.title_highlight')}</span> {t('company_landing.cta.title_end')}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {t('company_landing.cta.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={onRegister}
                  className="flex items-center gap-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-6 py-2.5 rounded-lg transition-colors"
                >
                  <Building size={18} />
                  {t('company_landing.cta.register')}
                </button>
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-6 py-2.5 rounded-lg transition-colors border border-slate-700"
                >
                  <LogIn size={18} />
                  {t('company_landing.cta.login')}
                </button>
                <button
                  onClick={onRequestDemo}
                  className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-6 py-2.5 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
                >
                  <MessageSquare size={18} />
                  {t('company_landing.cta.demo')}
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