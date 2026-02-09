import React, { useState, useEffect } from 'react';
import { MapPin, Clock, TrendingUp, Eye, CheckCircle, Heart, Target, Brain, BarChart3, Zap, Smartphone, Wallet, Home, Calculator, Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getJobCount } from '../services/jobService';
import BlogSection from './BlogSection';
import CrossBorderPromo from './CrossBorderPromo';

interface WelcomePageProps {
  onTryFree?: () => void;
  onBrowseOffers?: () => void;
  selectedBlogPostSlug: string | null;
  handleBlogPostSelect: (slug: string | null) => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({
  onTryFree,
  onBrowseOffers,
  selectedBlogPostSlug,
  handleBlogPostSelect
}) => {
  const { t } = useTranslation();
  const [activeScenario, setActiveScenario] = useState(0);
  const [jobCount, setJobCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const count = await getJobCount();
        setJobCount(count);
      } catch (error) {
        console.error("Error fetching job count:", error);
      }
    };
    fetchCount();
  }, []);



  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveScenario((prev) => (prev + 1) % 2);
    }, 5200);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => `${amount.toLocaleString('cs-CZ')} Kč`;

  const showcaseScenarios = [
    {
      label: 'Home office',
      headline: 'Nižší hrubá mzda, vyšší realita',
      grossMonthly: 35000,
      estimatedTax: 8000,
      benefitsMonthly: 4200,
      commuteCost: 0,
      dailyMinutes: 0,
      distanceKm: 0,
      finalRealMonthly: 31200
    },
    {
      label: 'Dojíždění 25 km',
      headline: 'Vyšší hrubá mzda, nižší realita',
      grossMonthly: 40000,
      estimatedTax: 9200,
      benefitsMonthly: 1200,
      commuteCost: 5200,
      dailyMinutes: 75,
      distanceKm: 25,
      finalRealMonthly: 26800
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HERO / ABOVE THE FOLD */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left column: Text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 mb-6 text-amber-700 dark:text-amber-400">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.5 rounded">{t('app.beta_badge')}</span>
              <span className="text-xs font-medium">{t('app.beta_description')}</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-slate-900 dark:text-white">{t('welcome.page_hero.title_job')}</span><span className="text-cyan-600 dark:text-cyan-400">{t('welcome.page_hero.title_shaman')}</span> <span className="text-slate-900 dark:text-white">{t('welcome.page_hero.title_end')}</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed max-w-lg">
              {t('welcome.page_hero.subtitle')}
            </p>

            {/* Primary CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onTryFree}
                className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
              >
                {t('welcome.page_hero.try_free_btn')}
              </button>
              <button
                onClick={onBrowseOffers}
                className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                {t('welcome.page_hero.browse_offers_btn', { count: jobCount ?? 0 })}
              </button>
            </div>
          </div>

          {/* Right column: Financial & Commute Reality Showcase */}
          <div className="flex justify-center items-center">
            <div className="relative w-full max-w-xl">
              {/* Decorative elements behind */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl -z-10"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-400/20 rounded-full blur-3xl -z-10"></div>

              <div className="bg-[#1e293b] text-slate-200 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative">
                <div className="p-6 border-b border-slate-700 flex justify-between items-start">
                  <div>
                    <h3 className="text-white text-lg font-bold flex items-center gap-2">
                      <Wallet className="text-emerald-400" size={20} /> Finanční a dojezdová realita
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      I nižší hrubá mzda může vycházet finančně lépe.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SCÉNÁŘ</div>
                    <div className="text-sm font-bold text-white">{showcaseScenarios[activeScenario].label}</div>
                  </div>
                </div>

                <div className="relative min-h-[380px] md:min-h-[340px]">
                  {showcaseScenarios.map((scenario, idx) => {
                    const otherScenario = showcaseScenarios[idx === 0 ? 1 : 0];
                    const diff = scenario.finalRealMonthly - otherScenario.finalRealMonthly;
                    const diffLabel = `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`;

                    return (
                      <div
                        key={scenario.label}
                        className={`absolute inset-0 transition-all duration-700 ${idx === activeScenario ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6 pointer-events-none'}`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2">
                          <div className="p-6 md:border-r border-slate-700 flex flex-col justify-center">
                            {scenario.distanceKm === 0 ? (
                              <div className="text-center py-2">
                                <Home size={40} className="text-emerald-400 mx-auto mb-3 opacity-80" />
                                <h4 className="text-white font-bold text-lg mb-1">Home office</h4>
                                <div className="text-emerald-400 text-sm font-medium mb-2">
                                  Úspora za dojíždění
                                </div>
                                <div className="text-xs text-emerald-400 mb-3 text-center">
                                  <div className="flex items-center gap-1 justify-center">
                                    <span className="text-green-400">🏠</span>
                                    <div>
                                      <div>0 Kč / 0 min</div>
                                      <div>Čas i peníze zůstávají vám.</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                  <MapPin size={12} /> Dojezdová realita
                                </h4>
                                <div className="relative h-12 mb-6">
                                  <div className="absolute top-2 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                    <span>Domov</span>
                                    <span>Práce</span>
                                  </div>
                                  <div className="absolute top-6 left-0 right-0 h-1.5 bg-slate-900/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-rose-500" style={{ width: '42%' }}></div>
                                  </div>
                                  <div className="absolute top-4 p-1.5 bg-slate-600 border border-slate-500 rounded-full text-white shadow-md transition-all" style={{ left: '42%', transform: 'translateX(-50%)' }}>
                                    <Navigation size={14} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-2xl font-mono text-white font-light flex items-center gap-2">
                                      <Clock size={20} className="text-slate-400" /> {scenario.dailyMinutes}
                                      <span className="text-sm text-slate-400 font-sans font-bold">min</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">denně</div>
                                  </div>
                                  <div>
                                    <div className="text-2xl font-mono text-white font-light">
                                      {scenario.distanceKm} <span className="text-sm text-slate-400 font-sans font-bold">km</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">jedna cesta</div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="p-6 bg-slate-900/30 flex flex-col">
                            <div className="flex-1">
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <Calculator size={12} /> Realita vs. mzda
                              </h4>
                              <div className="space-y-1 text-sm font-mono">
                                <div className="flex justify-between text-slate-300">
                                  <span>Hrubá mzda</span>
                                  <span>{formatCurrency(scenario.grossMonthly)}</span>
                                </div>
                                <div className="flex justify-between text-rose-300 text-xs">
                                  <span>- Daně a pojištění</span>
                                  <span>{formatCurrency(scenario.estimatedTax)}</span>
                                </div>
                                <div className="flex justify-between text-white font-bold pt-2 mt-1 border-t border-slate-700">
                                  <span>Čistý základ</span>
                                  <span>{formatCurrency(scenario.grossMonthly - scenario.estimatedTax)}</span>
                                </div>
                                <div className="flex justify-between text-emerald-400">
                                  <span>+ Benefity</span>
                                  <span>{formatCurrency(scenario.benefitsMonthly)}</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-2 italic">
                                  13. plat, stravenky, multisport karta
                                </div>
                                <div className="flex justify-between text-rose-400">
                                  <span>- Doprava</span>
                                  <span>{formatCurrency(scenario.commuteCost)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold text-white pt-3 mt-3 border-t border-slate-700">
                                  <span>Čistá realita</span>
                                  <span>{formatCurrency(scenario.finalRealMonthly)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                              <TrendingUp size={12} className={`${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                              <span>
                                Rozdíl oproti druhému scénáři:
                                <span className={`font-bold ml-1 ${diff >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{diffLabel}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CrossBorderPromo />

      {/* DIVIDER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 my-6">
        <div className="h-px bg-slate-200 dark:bg-slate-800"></div>
      </div>

      {/* SECTION: CO JOBSHAMAN JE (A NENÍ) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">
              <span className="text-cyan-600">{t('welcome.page_what_is.title_job')}</span><span className="text-slate-900 dark:text-white">{t('welcome.page_what_is.title_shaman')}</span> <span className="text-slate-900 dark:text-white">{t('welcome.page_what_is.title_end')}</span>
            </h2>
            <div className="max-w-3xl">
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                {t('welcome.page_what_is.desc_1')}
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                {t('welcome.page_what_is.desc_2')}
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                {t('welcome.page_what_is.desc_3')}
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('welcome.page_what_is.desc_4')}
              </p>
            </div>
          </div>

          {/* Right: Graphics */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition-all">
              <div className="flex items-center gap-4">
                <div className="bg-cyan-100 dark:bg-cyan-900/30 p-4 rounded-lg flex-shrink-0">
                  <Target className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">{t('welcome.page_what_is.card_1_title')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('welcome.page_what_is.card_1_desc')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition-all">
              <div className="flex items-center gap-4">
                <div className="bg-cyan-100 dark:bg-cyan-900/30 p-4 rounded-lg flex-shrink-0">
                  <BarChart3 className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">{t('welcome.page_what_is.card_2_title')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('welcome.page_what_is.card_2_desc')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition-all">
              <div className="flex items-center gap-4">
                <div className="bg-cyan-100 dark:bg-cyan-900/30 p-4 rounded-lg flex-shrink-0">
                  <Zap className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">{t('welcome.page_what_is.card_3_title')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('welcome.page_what_is.card_3_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 my-6">
        <div className="h-px bg-slate-200 dark:bg-slate-800"></div>
      </div>

      {/* SECTION: JAK TO POČÍTÁME */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-16">
          {t('welcome_extra.how_it_works.title')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Card 1: Financial Reality */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:border-cyan-300 dark:hover:border-cyan-700 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('welcome_extra.how_it_works.financial.title')}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('welcome_extra.how_it_works.financial.desc')}
            </p>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold mt-4">
              {t('welcome_extra.how_it_works.financial.hint')}
            </p>
          </div>

          {/* Card 2: Commute Impact */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:border-cyan-300 dark:hover:border-cyan-700 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg">
                <MapPin className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('welcome_extra.how_it_works.commute.title')}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              {t('welcome_extra.how_it_works.commute.desc')}
            </p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <li className="flex items-center gap-2">
                <span className="text-cyan-600">•</span> {t('welcome_extra.how_it_works.commute.items.distance')}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-600">•</span> {t('welcome_extra.how_it_works.commute.items.mode')}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-600">•</span> {t('welcome_extra.how_it_works.commute.items.loss')}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-600">•</span> {t('welcome_extra.how_it_works.commute.items.costs')}
              </li>
            </ul>
          </div>

          {/* Card 3: JHI Score */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:border-cyan-300 dark:hover:border-cyan-700 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg">
                <Heart className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('welcome_extra.how_it_works.jhi.title')}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              {t('welcome_extra.how_it_works.jhi.desc')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              {t('welcome_extra.how_it_works.jhi.hint')}
            </p>
          </div>

          {/* Card 4: Transparency */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:border-cyan-300 dark:hover:border-cyan-700 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg">
                <Eye className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('welcome_extra.how_it_works.transparency.title')}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              {t('welcome_extra.how_it_works.transparency.desc')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('welcome_extra.how_it_works.transparency.hint')}
            </p>
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 my-6">
        <div className="h-px bg-slate-200 dark:bg-slate-800"></div>
      </div>

      {/* SECTION: MOBILE SWIPE BROWSING */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Graphics */}
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                {t('job.swipe_tutorial_title') || 'Jak funguje swipování'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {t('job.swipe_tutorial_desc') || 'Táhni kartu doleva pro zamítnutí, doprava pro uložení.'}
              </div>
              <div className="relative h-16 flex items-center justify-center">
                <div className="absolute left-4 text-rose-500 text-2xl font-bold swipe-coach-arrow-left">←</div>
                <div className="absolute right-4 text-emerald-500 text-2xl font-bold swipe-coach-arrow-right">→</div>
                <div className="w-24 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-sm swipe-coach-card"></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-8 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <Smartphone className="w-8 h-8 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">{t('welcome.page_mobile.mobile_title')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('welcome.page_mobile.mobile_desc')}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-8 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">{t('welcome.page_mobile.progress_title')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('welcome.page_mobile.progress_desc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Text */}
          <div className="order-1 lg:order-2">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">
              {t('welcome.page_mobile.title_browse')}<span className="text-cyan-600">{t('welcome.page_mobile.title_jobs')}</span> {t('welcome.page_mobile.title_like')}
            </h2>

            <div className="space-y-6 text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
              <p>
                {t('welcome.page_mobile.desc_1')}
              </p>
              <p>
                {t('welcome.page_mobile.desc_2')}
              </p>
              <p>
                {t('welcome.page_mobile.desc_3')}
              </p>
            </div>

            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
              <p className="text-sm text-cyan-900 dark:text-cyan-200">
                <span className="font-bold">{t('welcome.page_mobile.tip_label')}</span> {t('welcome.page_mobile.tip_text')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 my-6">
        <div className="h-px bg-slate-200 dark:bg-slate-800"></div>
      </div>

      {/* PROČ TO VZNIKLO SECTION STARTS HERE */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">
              {t('welcome.page_why.title_job')}<span className="text-cyan-600">{t('welcome.page_why.title_shaman')}</span> {t('welcome.page_why.title_end')}
            </h2>

            <div className="space-y-6 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              <p>
                {t('welcome.page_why.desc_1')}
              </p>
              <p>
                {t('welcome.page_why.desc_2')}
              </p>
              <p className="text-base leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-white">
                  {t('welcome.page_why.reason')}
                </span>
              </p>
            </div>
          </div>

          {/* Right: Graphics */}
          <div className="flex flex-col gap-8">
            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl border border-red-200 dark:border-red-800 p-8">
              <div className="flex items-start gap-4">
                <Clock className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">{t('welcome.page_why.time_title')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('welcome.page_why.time_desc')}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-8">
              <div className="flex items-start gap-4">
                <TrendingUp className="w-8 h-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">{t('welcome.page_why.money_title')}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('welcome.page_why.money_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 my-6">
        <div className="h-px bg-slate-200 dark:bg-slate-800"></div>
      </div>



      {/* DIVIDER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 my-6">
        <div className="h-px bg-slate-200 dark:bg-slate-800"></div>
      </div>

      {/* SECTION: KDY POUŽÍVÁME AI (A KDY NE) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-12">
          {t('welcome.page_ai.title')}
        </h2>

        <div className="max-w-3xl mb-12">
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            <span className="text-cyan-600 font-bold">{t('welcome.page_ai.intro_job')}</span><span className="text-slate-900 dark:text-white font-bold">{t('welcome.page_ai.intro_shaman')}</span> <span className="text-slate-600 dark:text-slate-400">{t('welcome.page_ai.intro_end')}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Algorithms */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="text-blue-600 dark:text-blue-400 text-2xl">∑</span> {t('welcome.page_ai.algo_title')}
            </h3>
            <ul className="space-y-4">
              {[
                t('welcome.page_ai.algo_1'),
                t('welcome.page_ai.algo_2'),
                t('welcome.page_ai.algo_3'),
                t('welcome.page_ai.algo_4')
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* AI */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="text-purple-600 dark:text-purple-400 text-2xl">🤖</span> {t('welcome.page_ai.ai_title')}
            </h3>
            <ul className="space-y-4">
              {[
                t('welcome.page_ai.ai_1'),
                t('welcome.page_ai.ai_2'),
                t('welcome.page_ai.ai_3'),
                t('welcome.page_ai.ai_4')
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 p-6 bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-200 dark:border-cyan-800">
          <p className="text-slate-700 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">{t('welcome.page_ai.important')}</span>
          </p>
        </div>
      </section>

      {/* SECTION: ZÁVĚR / CTA */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-10 text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-900/30 dark:to-cyan-900/10 rounded-full flex items-center justify-center">
            <Brain className="w-10 h-10 text-cyan-600 dark:text-cyan-400" />
          </div>
        </div>
        <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-6">
          {t('welcome.page_cta.title_job')} <span className="text-cyan-600">{t('welcome.page_cta.title_end')}</span>.
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onTryFree}
            className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
          >
            {t('welcome.page_cta.button')}
          </button>
        </div>
      </section>

      {/* BLOG SECTION */}
      <BlogSection
        selectedBlogPostSlug={selectedBlogPostSlug}
        setSelectedBlogPostSlug={handleBlogPostSelect}
      />
    </div>
  );
};

export default WelcomePage;
