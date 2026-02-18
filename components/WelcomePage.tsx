import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Brain, CheckCircle2, Mic, Search, Shield, Sparkles, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BlogSection from './BlogSection';
import ABTestService from '../services/abTestService';
import AnalyticsService from '../services/analyticsService';
import { getJobCount, getTodayAnalyzedCount } from '../services/jobService';

interface WelcomePageProps {
  onTryFree?: () => void;
  onBrowseOffers?: () => void;
  selectedBlogPostSlug: string | null;
  handleBlogPostSelect: (slug: string | null) => void;
}

type HeroVariantId = 'problem_first' | 'aspiration_first' | 'efficiency_first';

type DemoSkill = {
  key: 'negotiation' | 'process_optimization' | 'leadership' | 'crisis_management' | 'data_analysis' | 'people_motivation' | 'pattern_recognition' | 'communication' | 'strategic_thinking';
  level: 'expert' | 'advanced' | 'strong' | 'natural';
};

type DemoResult = {
  skills: DemoSkill[];
  unlockedPaths: number;
};

type CaseStudyCard = {
  name: string;
  context: string;
  found: string[];
  match: string;
  quote: string;
};

const WELCOME_V2_ENABLED = import.meta.env.VITE_WELCOME_V2_ENABLED !== 'false';
const HERO_TEST_ID = 'welcome_hero_test';

const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1280) return 'tablet';
  return 'desktop';
};

const detectDemo = (input: string): DemoResult => {
  const text = input.toLowerCase();
  const skills: DemoSkill[] = [];

  const rules: Array<{ keywords: string[]; skill: DemoSkill }> = [
    { keywords: ['account', 'klient', 'client', 'obchod', 'zákazník'], skill: { key: 'negotiation', level: 'expert' } },
    { keywords: ['proces', 'process', 'optimaliz', 'opakování', 'organiz'], skill: { key: 'process_optimization', level: 'advanced' } },
    { keywords: ['team', 'ved', 'lead', 'kapitán', 'směna'], skill: { key: 'leadership', level: 'strong' } },
    { keywords: ['krize', 'stres', 'incident', 'problem', 'nehoda'], skill: { key: 'crisis_management', level: 'strong' } },
    { keywords: ['data', 'analýz', 'analysis', 'report', 'tabulka'], skill: { key: 'data_analysis', level: 'advanced' } },
    { keywords: ['motiv', 'hodnot', 'pomáhat', 'volunteer', 'podpora'], skill: { key: 'people_motivation', level: 'natural' } }
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      skills.push(rule.skill);
    }
  }

  const uniqueSkills = Array.from(new Map(skills.map((skill) => [skill.key, skill])).values());
  const fallbackSkills: DemoSkill[] = [
    { key: 'pattern_recognition', level: 'strong' },
    { key: 'communication', level: 'advanced' },
    { key: 'strategic_thinking', level: 'natural' }
  ];

  const finalSkills = (uniqueSkills.length > 0 ? uniqueSkills : fallbackSkills).slice(0, 6);
  const unlockedPaths = Math.min(60, 12 + finalSkills.length * 7);

  return { skills: finalSkills, unlockedPaths };
};

const WelcomePage: React.FC<WelcomePageProps> = ({
  onTryFree,
  onBrowseOffers,
  selectedBlogPostSlug,
  handleBlogPostSelect
}) => {
  const { t, i18n } = useTranslation();
  const demoDefaultText = t('welcome_v2.demo.default_text');
  const lastDemoDefaultRef = useRef(demoDefaultText);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoText, setDemoText] = useState(demoDefaultText);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [visualStep, setVisualStep] = useState(0);
  const [totalJobsCount, setTotalJobsCount] = useState<number>(0);
  const [todayAnalyzedCount, setTodayAnalyzedCount] = useState<number>(0);

  const variant = useMemo<HeroVariantId>(() => {
    const selected = ABTestService.getVariant(HERO_TEST_ID)?.id as HeroVariantId | undefined;
    if (selected === 'problem_first' || selected === 'aspiration_first' || selected === 'efficiency_first') {
      return selected;
    }
    return 'problem_first';
  }, []);

  const baseMeta = useMemo(() => ({
    hero_variant: variant,
    locale: i18n.resolvedLanguage || i18n.language || 'cs',
    device_type: getDeviceType()
  }), [i18n.language, i18n.resolvedLanguage, variant]);

  useEffect(() => {
    AnalyticsService.trackEvent('welcome_hero_impression', baseMeta);
  }, [baseMeta]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisualStep((prev) => (prev + 1) % 3);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getJobCount(), getTodayAnalyzedCount()])
      .then(([jobsCount, analyzedToday]) => {
        if (!isMounted) return;
        setTotalJobsCount(Math.max(0, jobsCount));
        setTodayAnalyzedCount(Math.max(0, analyzedToday));
      })
      .catch(() => {
        if (!isMounted) return;
        setTotalJobsCount(0);
        setTodayAnalyzedCount(0);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setDemoText((prev) => {
      const lastDefault = lastDemoDefaultRef.current;
      lastDemoDefaultRef.current = demoDefaultText;
      if (!prev || prev === lastDefault) {
        return demoDefaultText;
      }
      return prev;
    });
  }, [demoDefaultText]);

  const track = (event: string, extra?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(event, { ...baseMeta, demo_used: demoResult !== null, ...extra });
  };

  const handlePrimaryCta = () => {
    track('welcome_primary_cta_click');
    track('welcome_try_free_click');
    onTryFree?.();
  };

  const handleBrowseOffers = () => {
    track('welcome_browse_offers_click');
    onBrowseOffers?.();
  };

  const handleOpenDemo = () => {
    if (!demoOpen) {
      track('welcome_demo_open');
    }
    setDemoOpen(true);
  };

  const handleAnalyzeDemo = () => {
    track('welcome_demo_analyze_click');
    setDemoLoading(true);
    setDemoResult(null);

    window.setTimeout(() => {
      const result = detectDemo(demoText);
      setDemoResult(result);
      setDemoLoading(false);
      track('welcome_demo_results_shown', { skills_count: result.skills.length, unlocked_paths: result.unlockedPaths });
    }, 550);
  };

  const handleShowMatches = () => {
    track('welcome_demo_show_matches_click');
    onTryFree?.();
  };

  const caseCardsRaw = t('welcome_v2.proof.cards', { returnObjects: true }) as unknown;
  const comparisonRowsRaw = t('welcome_v2.comparison.rows', { returnObjects: true }) as unknown;
  const heroBeforeItemsRaw = t('welcome_v2.hero.visual.before_items', { returnObjects: true }) as unknown;
  const caseCards = Array.isArray(caseCardsRaw) ? caseCardsRaw as CaseStudyCard[] : [];
  const comparisonRows = Array.isArray(comparisonRowsRaw)
    ? comparisonRowsRaw as Array<{ old: string; career_os: string }>
    : [];
  const heroBeforeItems = Array.isArray(heroBeforeItemsRaw) && heroBeforeItemsRaw.length > 0
    ? heroBeforeItemsRaw as string[]
    : ['7 years in operations', 'Strong communication', 'Operational experience'];
  const insightsStats = [
    {
      label: t('blog.stats.active_jobs'),
      value: totalJobsCount > 0 ? `${totalJobsCount.toLocaleString(i18n.language || 'cs')}+` : '36 594+',
      icon: Search,
      color: 'text-cyan-500'
    },
    {
      label: t('blog.stats.transparency_rate'),
      value: '45%',
      icon: Shield,
      color: 'text-emerald-500'
    },
    {
      label: t('blog.stats.avg_jhi'),
      value: '57/100',
      icon: BarChart3,
      color: 'text-violet-500'
    }
  ];

  if (!WELCOME_V2_ENABLED) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <section className="max-w-6xl mx-auto px-4 py-14 lg:py-20">
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">{t('welcome_v2.legacy_fallback_title')}</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">{t('welcome_v2.legacy_fallback_desc')}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={handlePrimaryCta} className="px-7 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
              {t('welcome_v2.common.cta_primary')}
            </button>
            <button onClick={handleBrowseOffers} className="px-7 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
              {t('welcome_v2.common.cta_secondary')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              {t(`welcome_v2.hero.variants.${variant}.line1`)}
              <br />
              <span className="text-cyan-600 dark:text-cyan-400">{t(`welcome_v2.hero.variants.${variant}.line2`)}</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mt-4 max-w-xl">{t('welcome_v2.hero.subheadline')}</p>
            <div className="mt-7 flex flex-col sm:flex-row gap-4 sm:items-center">
              <button onClick={handlePrimaryCta} className="px-7 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-600/20">
                {t('welcome_v2.common.cta_primary')}
              </button>
              <button onClick={handleBrowseOffers} className="text-slate-700 dark:text-slate-200 underline underline-offset-4 text-left">
                {t('welcome_v2.common.cta_secondary')}
              </button>
            </div>
            <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300 font-medium">{t('welcome_v2.hero.trust')}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
              {t('welcome_v2.hero.live_stats', {
                jobs_count: totalJobsCount.toLocaleString(i18n.language || 'cs'),
                analyzed_count: todayAnalyzedCount.toLocaleString(i18n.language || 'cs')
              })}
            </p>
          </div>

          <div className="rounded-2xl border-2 border-cyan-200 dark:border-cyan-900 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <div className="p-5 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-3">{t('welcome_v2.hero.visual.before')}</div>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {heroBeforeItems.map((item) => (
                    <div key={item} className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">• {item}</div>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300 mb-3">{t('welcome_v2.hero.visual.after')}</div>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-2.5 transition font-medium ${visualStep >= index ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 opacity-60'}`}
                    >
                      ✓ {t(`welcome_v2.hero.visual.items.${index}`)}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-base font-bold text-cyan-800 dark:text-cyan-200">{t('welcome_v2.hero.visual.paths')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-10 lg:pb-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              {t('blog.category_label', 'Shamanic Insights')}
            </span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
            {t('blog.title')}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mt-2 mb-5">
            {t('blog.subtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insightsStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <stat.icon size={20} className={stat.color} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-10 lg:pb-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 lg:p-6">
          <h2 className="text-xl lg:text-2xl font-bold mb-4">{t('welcome_v2.anti_ats.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4">
              <h3 className="font-semibold text-rose-900 dark:text-rose-200 mb-2">{t('welcome_v2.anti_ats.ats_title')}</h3>
              <p className="text-sm text-rose-900/90 dark:text-rose-200/90">{t('welcome_v2.anti_ats.ats_desc')}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-2">{t('welcome_v2.anti_ats.career_os_title')}</h3>
              <p className="text-sm text-emerald-900/90 dark:text-emerald-200/90">{t('welcome_v2.anti_ats.career_os_desc')}</p>
            </div>
          </div>
          <p className="mt-4 text-sm lg:text-base text-slate-700 dark:text-slate-200 font-medium">{t('welcome_v2.anti_ats.quote')}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 lg:pb-16">
        <h2 className="text-2xl lg:text-3xl font-bold mb-6">{t('welcome_v2.how_it_works.title')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center mb-3"><Mic size={20} /></div>
            <h3 className="font-semibold mb-2">{t('welcome_v2.how_it_works.step1.title')}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('welcome_v2.how_it_works.step1.desc')}</p>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center mb-3"><Brain size={20} /></div>
            <h3 className="font-semibold mb-2">{t('welcome_v2.how_it_works.step2.title')}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('welcome_v2.how_it_works.step2.desc')}</p>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center mb-3"><Sparkles size={20} /></div>
            <h3 className="font-semibold mb-2">{t('welcome_v2.how_it_works.step3.title')}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('welcome_v2.how_it_works.step3.desc')}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-gradient-to-r from-cyan-50 to-emerald-50 dark:from-slate-900 dark:to-slate-900 border-2 border-cyan-200 dark:border-cyan-900 p-5 lg:p-6 shadow-lg shadow-cyan-100/70 dark:shadow-none">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-xl text-cyan-800 dark:text-cyan-200">{t('welcome_v2.demo.title')}</h3>
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">{t('welcome_v2.demo.subtitle')}</p>
            </div>
            <button onClick={handleOpenDemo} className="px-5 py-2.5 rounded-lg border border-cyan-300 dark:border-cyan-800 bg-white/80 dark:bg-slate-800 text-cyan-900 dark:text-cyan-200 hover:bg-white dark:hover:bg-slate-700 font-semibold">
              {t('welcome_v2.demo.open_button')}
            </button>
          </div>

          {demoOpen && (
            <div className="space-y-4">
              <textarea
                value={demoText}
                onChange={(event) => setDemoText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 min-h-[130px]"
                placeholder={t('welcome_v2.demo.placeholder')}
              />
              <button
                onClick={handleAnalyzeDemo}
                disabled={demoLoading || demoText.trim().length === 0}
                className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white"
              >
                {demoLoading ? t('welcome_v2.demo.loading') : t('welcome_v2.demo.analyze_button')}
              </button>

              {demoResult && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                  <h4 className="font-semibold mb-3">{t('welcome_v2.demo.result_title')}</h4>
                  <div className="space-y-2 mb-4">
                    {demoResult.skills.map((skill) => (
                      <div key={`${skill.key}-${skill.level}`} className="text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <span>{t(`welcome_v2.demo.skills.${skill.key}`)}</span>
                        <span className="text-xs text-emerald-800 dark:text-emerald-300">({t(`welcome_v2.demo.levels.${skill.level}`)})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-medium mb-4">{t('welcome_v2.demo.unlocked_paths', { count: demoResult.unlockedPaths })}</p>
                  <button onClick={handleShowMatches} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    {t('welcome_v2.demo.show_matches_button')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 lg:pb-16">
        <h2 className="text-2xl lg:text-3xl font-bold mb-6">{t('welcome_v2.proof.title')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {caseCards.map((card) => (
            <article key={card.name} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2"><UserRound size={16} />{card.name}</div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{card.context}</p>
              <ul className="text-sm space-y-1 mb-3">
                {card.found.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <p className="font-semibold mb-2">{card.match}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic">{card.quote}</p>
            </article>
          ))}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">{t('welcome_v2.proof.note')}</p>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 lg:pb-16">
        <h2 className="text-2xl lg:text-3xl font-bold mb-6">{t('welcome_v2.comparison.title')}</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 text-sm font-semibold">
            <div className="p-4 border-r border-slate-200 dark:border-slate-700">{t('welcome_v2.comparison.col_old')}</div>
            <div className="p-4">{t('welcome_v2.comparison.col_new')}</div>
          </div>
          {comparisonRows.map((row, index) => (
            <div key={`${row.old}-${index}`} className="grid grid-cols-2 text-sm border-t border-slate-200 dark:border-slate-800">
              <div className="p-4 border-r border-slate-200 dark:border-slate-800">{row.old}</div>
              <div className="p-4">{row.career_os}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 lg:px-8 pb-14 lg:pb-20">
        <div className="rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white p-7 lg:p-9">
          <h2 className="text-2xl lg:text-3xl font-bold mb-3">{t('welcome_v2.final_cta.title')}</h2>
          <button onClick={handlePrimaryCta} className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold mb-4">
            {t('welcome_v2.final_cta.button')}
          </button>
          <div className="text-sm space-y-1 opacity-95">
            <p>{t('welcome_v2.final_cta.trust_1')}</p>
            <p>{t('welcome_v2.final_cta.trust_2')}</p>
            <p>{t('welcome_v2.final_cta.trust_3')}</p>
          </div>
          <p className="text-sm mt-4 opacity-90">{t('welcome_v2.final_cta.privacy')}</p>
          {import.meta.env.VITE_WELCOME_V2_SHOW_BETA !== 'false' && (
            <p className="text-sm mt-2 opacity-90">{t('welcome_v2.final_cta.beta')}</p>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <h3 className="text-lg font-semibold mb-4">{t('welcome_v2.blog_title')}</h3>
        <BlogSection
          selectedBlogPostSlug={selectedBlogPostSlug}
          setSelectedBlogPostSlug={handleBlogPostSelect}
          showOverview={false}
        />
      </section>
    </div>
  );
};

export default WelcomePage;
