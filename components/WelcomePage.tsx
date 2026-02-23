import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Shield, Wallet, BarChart3, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BlogSection from './BlogSection';
import BullshitMeter from './BullshitMeter';
import JHIChart from './JHIChart';
import FinancialRealityComponent from './FinancialReality';
import { DEFAULT_USER_PROFILE } from '../constants';
import { Job, JHI, NoiseMetrics } from '../types';
import { calculateJHI } from '../utils/jhiCalculator';
import { estimateNoise } from '../utils/noise';
import { extractSalaryHint, SalaryHint } from '../utils/jobAdExtract';
import { matchHeuristic } from '../utils/matchHeuristic';
import { calculateFinancialReality } from '../services/financialService';

interface WelcomePageProps {
  onTryFree?: () => void;
  onBrowseOffers?: () => void;
  selectedBlogPostSlug: string | null;
  handleBlogPostSelect: (slug: string | null) => void;
}

type AnalyzerResult = {
  jhi: JHI;
  noise: NoiseMetrics;
  financialReality: Awaited<ReturnType<typeof calculateFinancialReality>> | null;
  match: ReturnType<typeof matchHeuristic> | null;
  hasSalary: boolean;
};

const _defaultDemoJobText = `Senior Frontend Developer (React)

Hledáme rockstara do dynamického prostředí. Tah na branku je nutnost.
Nabízíme 70 000 – 90 000 Kč měsíčně + bonusy. Hybrid / Home Office.
Občasné přesčasy, odolnost vůči stresu.
`;

const isMobileViewport = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};

const inferJobType = (text: string): Job['type'] => {
  const t = (text || '').toLowerCase();
  if (/(remote|home\s*office|homeoffice|full\s*remote|remote[-\s]?first)/i.test(t)) return 'Remote';
  if (/hybrid/i.test(t)) return 'Hybrid';
  return 'On-site';
};

const inferCountryCode = (currency?: string): string | undefined => {
  const cur = String(currency || '').toUpperCase();
  if (cur === 'CZK') return 'CZ';
  if (cur === 'EUR') return 'DE';
  if (cur === 'PLN') return 'PL';
  if (cur === 'CHF') return 'CH';
  if (cur === 'USD') return 'US';
  if (cur === 'GBP') return 'GB';
  return undefined;
};

const defaultCurrencyForLocale = (locale: string): string => {
  const l = String(locale || 'cs').toLowerCase();
  if (l.startsWith('cs')) return 'CZK';
  if (l.startsWith('sk')) return 'EUR';
  if (l.startsWith('pl')) return 'PLN';
  if (l.startsWith('de') || l.startsWith('at')) return 'EUR';
  if (l.startsWith('en')) return 'EUR';
  return 'CZK';
};

const formatSalaryRange = (from?: number, to?: number, currency?: string): string | undefined => {
  if (!from && !to) return undefined;
  const cur = currency || '';
  const fmt = (v: number) => v.toLocaleString('cs-CZ');
  if (from && to) return `${fmt(from)} - ${fmt(to)} ${cur}`.trim();
  if (from) return `${fmt(from)} ${cur}`.trim();
  return `${fmt(to || 0)} ${cur}`.trim();
};

const buildDemoJob = (jobText: string, salaryHint: SalaryHint, noise: NoiseMetrics, jhi: JHI) => {
  const nowIso = new Date().toISOString();
  const salaryRange = formatSalaryRange(salaryHint.salaryFrom, salaryHint.salaryTo, salaryHint.currency);
  const type = inferJobType(jobText);
  const country_code = inferCountryCode(salaryHint.currency) || 'CZ';

  const job: Job = {
    id: 'demo',
    title: 'Inzerát (demo)',
    company: '—',
    location: '—',
    type,
    work_model: type === 'Remote' ? 'remote' : type === 'Hybrid' ? 'hybrid' : 'on-site',
    salaryRange: salaryRange,
    description: jobText,
    postedAt: nowIso,
    source: 'demo',
    jhi,
    noiseMetrics: noise,
    transparency: {
      turnoverRate: 0,
      avgTenure: 0,
      ghostingRate: 0,
      hiringSpeed: '—',
      redFlags: []
    },
    market: {
      marketAvgSalary: 0,
      percentile: 0,
      inDemandSkills: []
    },
    tags: [],
    benefits: [],
    required_skills: [],
    salary_from: salaryHint.salaryFrom,
    salary_to: salaryHint.salaryTo,
    salary_timeframe: salaryHint.timeframe,
    country_code
  };

  return { job, salaryHint };
};

const WelcomePage: React.FC<WelcomePageProps> = ({
  onTryFree,
  onBrowseOffers,
  selectedBlogPostSlug,
  handleBlogPostSelect
}) => {
  const { t, i18n } = useTranslation();
  const analyzerRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(isMobileViewport());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  const [adText, setAdText] = useState(_defaultDemoJobText);
  const [aboutYouText, setAboutYouText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzerResult | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(isMobileViewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const update = () => setTheme(el.classList.contains('dark') ? 'dark' : 'light');
    update();

    const observer = new MutationObserver(() => update());
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handlePrimary = () => {
    if (isMobile) {
      onBrowseOffers?.();
      return;
    }
    analyzerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const salaryHintTopRaw = extractSalaryHint(adText);
      const salaryHintTop: SalaryHint = {
        ...salaryHintTopRaw,
        currency:
          salaryHintTopRaw.currency ||
          (salaryHintTopRaw.salaryFrom || salaryHintTopRaw.salaryTo ? defaultCurrencyForLocale(i18n.language) : undefined)
      };
      const noise = estimateNoise(adText);
      const demoJhi = calculateJHI({
        title: 'Inzerát',
        description: adText,
        salary_from: salaryHintTop.salaryFrom,
        salary_to: salaryHintTop.salaryTo,
        salaryRange: formatSalaryRange(salaryHintTop.salaryFrom, salaryHintTop.salaryTo, salaryHintTop.currency),
        country_code: inferCountryCode(salaryHintTop.currency),
        location: '—',
        benefits: []
      });

      const { job, salaryHint: builtHint } = buildDemoJob(adText, salaryHintTop, noise, demoJhi);
      const hasSalary = Boolean(builtHint.salaryFrom || builtHint.salaryTo);
      const financialReality = hasSalary
        ? await calculateFinancialReality(job, DEFAULT_USER_PROFILE, [])
        : null;

      const match = aboutYouText.trim()
        ? matchHeuristic(aboutYouText, adText)
        : null;

      setResult({
        jhi: demoJhi,
        noise,
        financialReality,
        match,
        hasSalary
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen app-grid-bg app-grid-bg--soft text-slate-900 dark:text-slate-100">
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 pb-10 lg:pt-16 lg:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold mb-6 border border-slate-300/40 dark:border-slate-700">
              <Sparkles size={14} />
              {t('landing.manifest.tag', { defaultValue: 'Career reality check' })}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              {t('landing.manifest.headline', {
                defaultValue: 'Nerozhodujte se podle marketingu. Poznejte realitu dřív, než pošlete CV.'
              })}
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 mt-5 max-w-xl">
              {t('landing.manifest.subheadline', {
                defaultValue: 'Uvidíte rizika, čistou mzdu a shodu za 60 sekund.'
              })}
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
              <button
                onClick={handlePrimary}
                className="px-7 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-600/20 inline-flex items-center justify-center gap-2"
              >
                {t('landing.manifest.cta_primary', { defaultValue: 'Prověřit nabídku' })}
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => onBrowseOffers?.()}
                className="px-7 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-white/60 dark:hover:bg-slate-900"
              >
                {t('landing.manifest.cta_browse', { defaultValue: 'Prohlédnout nabídky' })}
              </button>
            </div>

            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="font-medium">
                {t('landing.manifest.microcopy', { defaultValue: 'Vyberte nabídku vlevo (1 klik).' })}
              </div>
              <button
                onClick={() => onTryFree?.()}
                className="mt-1 text-cyan-700 dark:text-cyan-300 underline underline-offset-4"
              >
                {t('landing.manifest.cta_secondary', { defaultValue: 'Vytvořit profil (volitelné)' })}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-2">
                {t('landing.paradigm.title', {
                  defaultValue: 'Shaman nepřidává další nabídky. Pomáhá vám rozhodnout se správně.'
                })}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
                {t('landing.paradigm.desc', {
                  defaultValue: 'Místo „dalšího feedu“ dostanete filtr, který kryje záda kandidátům.'
                })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                    <Shield size={16} className="text-rose-500" />
                    {t('landing.paradigm.p1', { defaultValue: 'Rizika' })}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t('landing.paradigm.p1_desc', { defaultValue: 'Red flags a „bullshit“ v textu.' })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                    <Wallet size={16} className="text-emerald-500" />
                    {t('landing.paradigm.p2', { defaultValue: 'Čistá realita' })}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t('landing.paradigm.p2_desc', { defaultValue: 'Co vám reálně zůstane (mzda, daně, dojíždění).' })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                    <BarChart3 size={16} className="text-cyan-500" />
                    {t('landing.paradigm.p3', { defaultValue: 'JHI' })}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t('landing.paradigm.p3_desc', { defaultValue: 'Jedno skóre kvality nabídky 0–100.' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={analyzerRef} className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 lg:pb-16">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold">
                {t('landing.analyzer.title', { defaultValue: 'Prověřovač nabídky' })}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                {t('landing.analyzer.subtitle', { defaultValue: 'Vložte text inzerátu. Přidejte 3 věty o sobě pro shodu.' })}
              </p>
            </div>
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing || adText.trim().length === 0}
              className="shrink-0 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-2"
            >
              {isAnalyzing
                ? t('landing.analyzer.running', { defaultValue: 'Prověřuji…' })
                : t('landing.analyzer.run', { defaultValue: 'Prověřit nabídku' })}
              <CheckCircle2 size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {t('landing.analyzer.input_job', { defaultValue: 'Vložte text inzerátu (nebo část)' })}
              </label>
              <textarea
                value={adText}
                onChange={(e) => setAdText(e.target.value)}
                className="w-full min-h-[220px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm"
                placeholder={t('landing.analyzer.input_job_ph', { defaultValue: 'Sem vložte text inzerátu…' })}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t('landing.analyzer.tip', { defaultValue: 'Tip: Když inzerát nemá mzdu, je to samo o sobě signál.' })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {t('landing.analyzer.input_you', { defaultValue: 'Napište 3 věty o sobě (volitelné – pro shodu)' })}
              </label>
              <textarea
                value={aboutYouText}
                onChange={(e) => setAboutYouText(e.target.value)}
                className="w-full min-h-[220px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm"
                placeholder={t('landing.analyzer.input_you_ph', { defaultValue: 'Např. 5 let React, TypeScript, rád/a řeším UX a výkon…' })}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {t('landing.analyzer.privacy_hint', { defaultValue: 'Vaše data nikam neposíláme, shoda se počítá anonymně.' })}
              </p>
            </div>
          </div>

          {result && (
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-5">
                <div className="bg-white dark:bg-slate-950 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-bold">{t('landing.result.jhi_title', { defaultValue: 'JHI skóre' })}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('landing.result.jhi_desc', { defaultValue: 'Finance · čas · psychika · růst · hodnoty' })}
                      </p>
                    </div>
                    <div className="text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {result.jhi.score}
                    </div>
                  </div>
                  <JHIChart jhi={result.jhi} theme={theme} />
                </div>
              </div>

              <div className="xl:col-span-7">
                <BullshitMeter metrics={result.noise} variant={theme} />
              </div>

              <div className="xl:col-span-12">
                {result.financialReality ? (
                  <FinancialRealityComponent
                    financialReality={result.financialReality}
                    isLoading={false}
                    error={null}
                  />
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6">
                    <h3 className="font-bold mb-1">{t('landing.result.finance_title', { defaultValue: 'Čistá realita' })}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {result.hasSalary
                        ? t('landing.result.finance_unavailable', { defaultValue: 'Nepodařilo se spočítat čistou realitu pro tento text.' })
                        : t('landing.result.finance_missing_salary', { defaultValue: 'Bez mzdy nejde spočítat čistou realitu. To je samo o sobě signál.' })}
                    </p>
                  </div>
                )}
              </div>

              {result.match && aboutYouText.trim() && (
                <div className="xl:col-span-12">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold">{t('landing.result.match_title', { defaultValue: 'Shoda' })}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {result.match.reasons[0] || t('landing.result.match_desc', { defaultValue: 'Rychlý odhad podle shody výrazů.' })}
                        </p>
                        {result.match.reasons[1] && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{result.match.reasons[1]}</p>
                        )}
                      </div>
                      <div className="text-4xl font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {result.match.matchScore}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <h3 className="text-lg font-semibold mb-4">
          {t('landing.blog.title', { defaultValue: 'Jak přemýšlet o nabídce práce (krátce)' })}
        </h3>
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
