import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building, Shield, Target, Star, CheckCircle, Crown, Sparkles, Info, LogIn, SearchX, Lightbulb, BarChart3, ChevronDown } from 'lucide-react';
import AnalyticsService from '../services/analyticsService';
import { convertCurrency } from '../services/exchangeRatesService';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

interface PricingPlan {
  key: 'trial' | 'starter' | 'growth' | 'professional' | 'enterprise';
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
  const { t, i18n } = useTranslation();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const resolveCalculatorCurrency = (language: string): 'CZK' | 'PLN' | 'EUR' => {
    const lang = (language || 'cs').split('-')[0].toLowerCase();
    if (lang === 'pl') return 'PLN';
    if (lang === 'cs' || lang === 'sk') return 'CZK';
    return 'EUR';
  };
  const selectedCurrency = resolveCalculatorCurrency(i18n.language);
  const [hiresPerYear, setHiresPerYear] = useState(10);
  const [screeningHoursPerHire, setScreeningHoursPerHire] = useState(10);
  const [hrHourlyCostCzk, setHrHourlyCostCzk] = useState(() => Math.round(convertCurrency(350, 'CZK', selectedCurrency)));
  const [adsPerMonth, setAdsPerMonth] = useState(3);
  const [portalDailyCostCzk, setPortalDailyCostCzk] = useState(() => Math.round(convertCurrency(1350, 'CZK', selectedCurrency)));
  const hasTrackedView = useRef(false);
  const previousCurrencyRef = useRef<'CZK' | 'PLN' | 'EUR'>(selectedCurrency);

  const trackEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(eventName, {
      locale: i18n.language,
      ...metadata
    });
  };

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackEvent('company_landing_view', { section: 'landing' });
  }, []);

  useEffect(() => {
    const previousCurrency = previousCurrencyRef.current;
    if (previousCurrency === selectedCurrency) return;
    setHrHourlyCostCzk((value) => Math.round(convertCurrency(value, previousCurrency, selectedCurrency)));
    setPortalDailyCostCzk((value) => Math.round(convertCurrency(value, previousCurrency, selectedCurrency)));
    previousCurrencyRef.current = selectedCurrency;
  }, [selectedCurrency]);

  const plans: PricingPlan[] = [
    {
      key: 'trial',
      name: t('company_landing.pricing.plans.trial.name', { defaultValue: 'Free (Trial)' }),
      price: '0 €',
      period: '',
      description: t('company_landing.pricing.plans.trial.desc', { defaultValue: 'For small local companies to try' }),
      features: [
        t('company_landing.pricing.plans.trial.f1', { defaultValue: '1 active job posting' }),
        t('company_landing.pricing.plans.trial.f2', { defaultValue: 'No AI assessment' })
      ],
      highlighted: false
    },
    {
      key: 'starter',
      name: t('company_landing.pricing.plans.basic.name', { defaultValue: 'Starter' }),
      price: '249 €',
      period: t('company_landing.pricing.period'),
      description: t('company_landing.pricing.plans.basic_v2.desc', { defaultValue: 'For startups and smaller agencies' }),
      features: [
        t('company_landing.pricing.plans.basic_v2.f1', { defaultValue: '3 active job postings' }),
        t('company_landing.pricing.plans.basic_v2.f2', { defaultValue: '15 AI screenings / month' }),
        t('company_landing.pricing.plans.basic_v2.f3', { defaultValue: 'Basic decision overview' })
      ],
      highlighted: false
    },
    {
      key: 'growth',
      name: t('company_landing.pricing.plans.professional.name', { defaultValue: 'Growth' }),
      price: '599 €',
      period: t('company_landing.pricing.period'),
      description: t('company_landing.pricing.plans.professional.desc', { defaultValue: 'For SMEs and active recruiters' }),
      features: [
        t('company_landing.pricing.plans.professional.f1', { defaultValue: '10 active job postings' }),
        t('company_landing.pricing.plans.professional.f2', { defaultValue: '60 AI screenings / month' }),
        t('company_landing.pricing.plans.professional.f3', { defaultValue: 'JHI insights' })
      ],
      highlighted: true
    },
    {
      key: 'professional',
      name: t('company_landing.pricing.plans.professional_pro.name', { defaultValue: 'Professional' }),
      price: '899 €',
      period: t('company_landing.pricing.period'),
      description: t('company_landing.pricing.plans.professional_pro.desc', { defaultValue: 'For larger hiring teams with analytics needs' }),
      features: [
        t('company_landing.pricing.plans.professional_pro.f1', { defaultValue: '20 active job postings' }),
        t('company_landing.pricing.plans.professional_pro.f2', { defaultValue: '150 AI screenings / month' }),
        t('company_landing.pricing.plans.professional_pro.f3', { defaultValue: 'Decision analytics dashboard' })
      ],
      highlighted: false
    },
    {
      key: 'enterprise',
      name: t('company_landing.pricing.plans.enterprise.name'),
      price: t('company_landing.pricing.price_custom'),
      period: '',
      description: t('company_landing.pricing.plans.enterprise.desc'),
      features: [
        t('company_landing.pricing.plans.enterprise.f1'),
        t('company_landing.pricing.plans.enterprise.f2'),
        t('company_landing.pricing.plans.enterprise.f3'),
        t('company_landing.pricing.plans.enterprise.f4')
      ],
      highlighted: false
    }
  ];

  const solutionPillars = [
    {
      icon: Lightbulb,
      title: t('company_landing.solution.pillar_skill_title'),
      description: t('company_landing.solution.pillar_skill_desc'),
      color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400'
    },
    {
      icon: Target,
      title: t('company_landing.solution.pillar_relevance_title'),
      description: t('company_landing.solution.pillar_relevance_desc'),
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
    },
    {
      icon: BarChart3,
      title: t('company_landing.solution.pillar_measure_title'),
      description: t('company_landing.solution.pillar_measure_desc'),
      color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
    }
  ];

  const atsProblems = [
    t('company_landing.ats_problem.ats_p1'),
    t('company_landing.ats_problem.ats_p2'),
    t('company_landing.ats_problem.ats_p3')
  ];

  const jobshamanAdvantages = [
    t('company_landing.ats_problem.js_p1'),
    t('company_landing.ats_problem.js_p2'),
    t('company_landing.ats_problem.js_p3')
  ];

  const faqItems = [
    {
      question: t('company_landing.faq.q1'),
      answer: t('company_landing.faq.a1')
    },
    {
      question: t('company_landing.faq.q2'),
      answer: t('company_landing.faq.a2')
    },
    {
      question: t('company_landing.faq.q3'),
      answer: t('company_landing.faq.a3')
    },
    {
      question: t('company_landing.faq.q4'),
      answer: t('company_landing.faq.a4')
    },
    {
      question: t('company_landing.faq.q5'),
      answer: t('company_landing.faq.a5')
    }
  ];

  const trustItems = [
    t('company_landing.trust.i1'),
    t('company_landing.trust.i2'),
    t('company_landing.trust.i3')
  ];

  const benefits = [
    { icon: Target, text: t('company_landing.benefits.relevance') },
    { icon: CheckCircle, text: t('company_landing.benefits.transparency') },
    { icon: BarChart3, text: t('company_landing.benefits.measurable_funnel') },
    { icon: Lightbulb, text: t('company_landing.benefits.hidden_talents') }
  ];

  const statsCards = [
    {
      title: t('company_landing.stats.cards.avg_time_fill_eu_title'),
      value: t('company_landing.stats.cards.avg_time_fill_eu_value'),
      note: t('company_landing.stats.cards.avg_time_fill_eu_note')
    },
    {
      title: t('company_landing.stats.cards.avg_time_fill_uk_title'),
      value: t('company_landing.stats.cards.avg_time_fill_uk_value'),
      note: t('company_landing.stats.cards.avg_time_fill_uk_note')
    },
    {
      title: t('company_landing.stats.cards.ai_speedup_title'),
      value: t('company_landing.stats.cards.ai_speedup_value'),
      note: t('company_landing.stats.cards.ai_speedup_note')
    },
    {
      title: t('company_landing.stats.cards.eu_labor_cost_title'),
      value: t('company_landing.stats.cards.eu_labor_cost_value'),
      note: t('company_landing.stats.cards.eu_labor_cost_note')
    }
  ];

  const speedupRate = 0.26;
  const savedHoursPerYear = hiresPerYear * screeningHoursPerHire * speedupRate;
  const savedCzkPerYear = savedHoursPerYear * hrHourlyCostCzk;
  const daysPerMonth = 30;
  const portalMonthlyCostCzk = adsPerMonth * portalDailyCostCzk * daysPerMonth;
  const jobshamanStarterMonthly = convertCurrency(249, 'EUR', selectedCurrency);
  const jobshamanGrowthMonthly = convertCurrency(599, 'EUR', selectedCurrency);
  const jobshamanPromoSavings = Math.max(0, portalMonthlyCostCzk - jobshamanStarterMonthly);
  const jobshamanStandardSavings = Math.max(0, portalMonthlyCostCzk - jobshamanGrowthMonthly);
  const numberFormatter = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
  const currencyFormatter = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: selectedCurrency, maximumFractionDigits: 0 });

  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
      {/* Login Button in top right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => {
            trackEvent('company_landing_cta_login_click', { section: 'topbar' });
            onLogin?.();
          }}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors shadow-sm"
        >
          <LogIn size={16} />
          {t('company_landing.hero.login')}
        </button>
      </div>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-8 lg:p-16 w-full">
        <div className="my-auto w-full max-w-5xl relative">
          <div className="relative text-center mb-16">
            <div className="absolute inset-x-0 -top-8 h-40 bg-gradient-to-r from-cyan-100/60 via-transparent to-emerald-100/60 dark:from-cyan-950/50 dark:via-transparent dark:to-emerald-950/40 blur-3xl" />
            <div className="relative inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-6 border border-slate-300/50 dark:border-slate-700">
              <Building size={12} />
              {t('company_landing.hero.badge')}
            </div>
            <h1 className="relative text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              {t('company_landing.hero.title_start')} <span className="bg-gradient-to-r from-cyan-600 via-emerald-500 to-cyan-600 bg-clip-text text-transparent">{t('company_landing.hero.title_highlight')}</span> {t('company_landing.hero.title_end')}
            </h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest mb-6">
              {t('company_landing.hero.tagline')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <button
                onClick={() => {
                  trackEvent('company_landing_cta_register_click', { section: 'hero' });
                  onRegister?.();
                }}
                className="flex items-center gap-2 text-sm font-bold text-white dark:text-slate-900 bg-cyan-600 dark:bg-cyan-400 hover:bg-cyan-500 dark:hover:bg-cyan-300 px-8 py-3 rounded-lg transition-colors shadow-lg"
              >
                <Building size={18} />
                {t('company_landing.hero.start_free')}
              </button>
              <button
                onClick={() => {
                  trackEvent('company_landing_cta_login_click', { section: 'hero' });
                  if (onRequestDemo) {
                    onRequestDemo();
                  } else {
                    onLogin?.();
                  }
                }}
                className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-8 py-3 rounded-lg transition-colors border border-slate-300 dark:border-slate-600"
              >
                <LogIn size={18} />
                {t('company_landing.hero.cta_companies')}
              </button>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
              <Shield size={14} />
              {t('company_landing.hero.trust')}
            </div>
            <div className="mt-4 max-w-3xl mx-auto text-sm text-slate-600 dark:text-slate-300">
              {t('company_landing.hero.value_prop_detail')}
            </div>
          </div>

          <div aria-hidden="true" className="absolute right-6 top-24 hidden lg:block h-[1320px] w-[2px] bg-gradient-to-b from-cyan-400/0 via-cyan-400/35 to-emerald-400/0">
            <div className="guide-dot absolute h-3 w-3 rounded-full bg-cyan-400/70 shadow-[0_0_14px_rgba(34,211,238,0.6)]" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-12">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-rose-500/70" />
              <div className="flex items-center gap-2 mb-4">
                <SearchX size={22} className="text-rose-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.ats_problem.ats_title')}</h3>
              </div>
              <ul className="space-y-3">
                {atsProblems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t('company_landing.ats_problem.ats_result')}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500/70" />
              <div className="flex items-center gap-2 mb-4">
                <Target size={22} className="text-cyan-500" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.ats_problem.js_title')}</h3>
              </div>
              <ul className="space-y-3">
                {jobshamanAdvantages.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t('company_landing.ats_problem.js_result')}
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t('company_landing.solution.title')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('company_landing.solution.subtitle')}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="grid md:grid-cols-4 gap-6">
              {solutionPillars.map((feature, index) => (
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

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-3 border border-slate-200 dark:border-slate-700">
                  <BarChart3 size={12} />
                  {t('company_landing.stats.badge')}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t('company_landing.stats.title')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company_landing.stats.subtitle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statsCards.map((card, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{card.value}</div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{card.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{card.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12 overflow-hidden">
            <div className="absolute inset-x-0 -top-8 h-24 bg-gradient-to-r from-emerald-100/80 via-cyan-100/50 to-emerald-100/80 dark:from-emerald-950/40 dark:via-cyan-950/30 dark:to-emerald-950/40 blur-2xl" />
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t('company_landing.calculator.title')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('company_landing.calculator.subtitle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <label className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('company_landing.calculator.input_hires')}</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={hiresPerYear}
                    onChange={(event) => setHiresPerYear(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('company_landing.calculator.unit_hires')}</span>
                </div>
              </label>
              <label className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('company_landing.calculator.input_screening_hours')}</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={screeningHoursPerHire}
                    onChange={(event) => setScreeningHoursPerHire(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('company_landing.calculator.unit_hours')}</span>
                </div>
              </label>
              <label className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('company_landing.calculator.input_hourly_cost')}</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={hrHourlyCostCzk}
                    onChange={(event) => setHrHourlyCostCzk(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{selectedCurrency}</span>
                </div>
              </label>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <label className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('company_landing.calculator.input_ads_per_month')}</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={adsPerMonth}
                    onChange={(event) => setAdsPerMonth(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('company_landing.calculator.unit_ads')}</span>
                </div>
              </label>
              <label className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('company_landing.calculator.input_portal_daily_cost')}</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={portalDailyCostCzk}
                    onChange={(event) => setPortalDailyCostCzk(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{selectedCurrency}</span>
                </div>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t('company_landing.calculator.output_saved_hours')}</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{numberFormatter.format(savedHoursPerYear)} {t('company_landing.calculator.unit_hours')}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t('company_landing.calculator.output_saved_czk')}</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{currencyFormatter.format(savedCzkPerYear)}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-5 border border-emerald-200 dark:border-emerald-900/60 shadow-md relative overflow-hidden">
                <div className="absolute right-3 top-3 rounded-full bg-emerald-600 text-white text-[10px] font-bold px-2 py-1">
                  {t('company_landing.calculator.badge_best')}
                </div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">{t('company_landing.calculator.output_portal_savings_promo')}</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{currencyFormatter.format(jobshamanPromoSavings)}</div>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                  {t('company_landing.calculator.output_portal_savings_note', {
                    price: currencyFormatter.format(jobshamanStarterMonthly)
                  })}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t('company_landing.calculator.output_portal_savings_standard')}</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{currencyFormatter.format(jobshamanStandardSavings)}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('company_landing.calculator.output_portal_savings_note', {
                    price: currencyFormatter.format(jobshamanGrowthMonthly)
                  })}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">{t('company_landing.calculator.note')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg">
                    <benefit.icon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{benefit.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
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
                  : plan.price === '0 €'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-700'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                  {plan.price === '0 €' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <Star className="w-3 h-3" />
                          {t('company_landing.pricing.always_free', { defaultValue: 'Free' })}
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
                          <span className={`text-2xl font-bold ${plan.price === '0 €'
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
                      {plan.key === 'professional' && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t('company_landing.pricing.extra_assessment', { defaultValue: 'Advanced tier with API access and priority support' })}
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
                    onClick={() => {
                      trackEvent('company_landing_pricing_plan_click', {
                        section: 'pricing',
                        plan_name: plan.name
                      });
                      if (plan.key === 'enterprise') {
                        onRequestDemo?.();
                      } else {
                        onRegister?.();
                      }
                    }}
                    className={`w-full py-2.5 rounded-lg font-semibold transition-all text-sm ${plan.price === '0 €'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : plan.highlighted
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white'
                      }`}
                  >
                    {plan.key === 'enterprise' ? t('company_landing.pricing.cta_contact') : plan.price === '0 €' ? t('company_landing.pricing.cta_start_free') : t('company_landing.pricing.cta_start')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Info size={22} className="text-cyan-500" />
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.faq.title')}</h3>
            </div>
            <div className="space-y-3">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={index} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                    <button
                      onClick={() => {
                        const next = isOpen ? null : index;
                        setOpenFaqIndex(next);
                        if (!isOpen) {
                          trackEvent('company_landing_faq_expand', {
                            section: 'faq',
                            faq_index: index
                          });
                        }
                      }}
                      className="w-full flex items-center justify-between text-left px-4 py-3"
                    >
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.question}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-sm text-slate-700 dark:text-slate-300">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={20} className="text-cyan-500" />
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('company_landing.trust_block.title')}</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('company_landing.trust_block.text')}</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-8 shadow-sm border border-amber-200 dark:border-amber-900/60 relative mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={20} className="text-amber-600 dark:text-amber-300" />
              <h3 className="text-amber-900 dark:text-amber-200 font-bold text-lg">{t('company_landing.risk.title')}</h3>
            </div>
            <p className="text-sm text-amber-900/80 dark:text-amber-200/80">{t('company_landing.risk.text')}</p>
          </div>

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
              <div className="grid sm:grid-cols-3 gap-2 mb-6 max-w-3xl mx-auto">
                {trustItems.map((item, index) => (
                  <div key={index} className="text-xs text-slate-300 border border-slate-700 rounded-lg px-3 py-2 bg-slate-800/40">
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    trackEvent('company_landing_cta_register_click', { section: 'final_cta' });
                    onRegister?.();
                  }}
                  className="flex items-center gap-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-8 py-3 rounded-lg transition-colors shadow-lg"
                >
                  <Building size={18} />
                  {t('company_landing.cta.register')}
                </button>
                <button
                  onClick={() => {
                    trackEvent('company_landing_cta_login_click', { section: 'final_cta' });
                    onLogin?.();
                  }}
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
