import React from 'react';
import { ArrowRight, CheckCircle2, Compass, MapPin, Scale, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BlogSection from './BlogSection';
import OfferImpactSnapshot from './OfferImpactSnapshot';
import CrossBorderPromo from './CrossBorderPromo';

interface WelcomePageProps {
  onTryFree?: () => void;
  onBrowseOffers?: () => void;
  totalJobsCount?: number;
  todayNewJobsCount?: number;
  selectedBlogPostSlug: string | null;
  handleBlogPostSelect: (slug: string | null) => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({
  onTryFree,
  onBrowseOffers,
  totalJobsCount = 0,
  todayNewJobsCount = 0,
  selectedBlogPostSlug,
  handleBlogPostSelect
}) => {
  const { t } = useTranslation();

  const handlePrimary = () => {
    if (onTryFree) {
      onTryFree();
      return;
    }
    onBrowseOffers?.();
  };

  return (
    <div className="min-h-screen app-grid-bg app-grid-bg--soft text-slate-900 dark:text-slate-100">
      <section className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-10 pb-10 lg:pt-16 lg:pb-14 overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              {t('landing.hero.headline')}
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 mt-5 max-w-xl">
              {t('landing.hero.subheadline')}
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
              <button
                onClick={handlePrimary}
                className="px-7 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-600/20 inline-flex items-center justify-center gap-2"
              >
                {t('landing.hero.cta_primary')}
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => onBrowseOffers?.()}
                className="px-7 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-white/60 dark:hover:bg-slate-900"
              >
                {t('landing.hero.cta_browse')}
              </button>
            </div>

            {(totalJobsCount > 0 || todayNewJobsCount > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-slate-300/80 dark:border-slate-700/80 bg-white/85 dark:bg-slate-900/80 px-3 py-1 text-slate-700 dark:text-slate-200">
                  {t('landing.hero.active_jobs_count', {
                    count: totalJobsCount,
                    defaultValue: 'Aktivní inzeráty: {{count}}',
                  })}
                </span>
                <span className="rounded-full border border-cyan-300/70 dark:border-cyan-700/70 bg-cyan-50/80 dark:bg-cyan-950/40 px-3 py-1 text-cyan-700 dark:text-cyan-300">
                  {t('landing.hero.jhi_reviewed_today_count', {
                    count: todayNewJobsCount,
                    defaultValue: 'Dnes prověřeno na JHI: {{count}}',
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-slate-700 bg-[#1e293b] p-6 shadow-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-1">
                {t('landing.hero.snapshot_intro')}
              </p>
              <p className="text-sm text-slate-200 mb-4 font-semibold">
                {t('landing.hero.snapshot_label')}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                {t('landing.hero.snapshot_example')}
              </p>

              <OfferImpactSnapshot
                className="bg-slate-900/40 rounded-xl border border-slate-700"
                rows={[
                  {
                    label: t('landing.hero.snapshot_rows.gross_label'),
                    value: t('landing.hero.snapshot_rows.gross_value')
                  },
                  {
                    label: t('landing.hero.snapshot_rows.tax_label'),
                    value: t('landing.hero.snapshot_rows.tax_value'),
                    tone: 'negative'
                  },
                  {
                    label: t('landing.hero.snapshot_rows.net_base_label'),
                    value: t('landing.hero.snapshot_rows.net_base_value')
                  },
                  {
                    label: t('landing.hero.snapshot_rows.benefits_label'),
                    value: t('landing.hero.snapshot_rows.benefits_value'),
                    tone: 'positive'
                  },
                  {
                    label: t('landing.hero.snapshot_rows.commute_label'),
                    value: t('landing.hero.snapshot_rows.commute_value'),
                    tone: 'negative'
                  },
                  {
                    label: t('landing.hero.snapshot_rows.final_label'),
                    value: t('landing.hero.snapshot_rows.final_value'),
                    tone: 'emphasis'
                  },
                  {
                    label: t('landing.hero.snapshot_rows.jhi_label'),
                    value: t('landing.hero.snapshot_rows.jhi_value')
                  }
                ]}
              />

              <div className="mt-4 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3">
                <p className="text-xs font-semibold text-rose-300">
                  {t('landing.hero.snapshot_commute_time.title')}
                </p>
                <p className="text-sm text-rose-200 mt-1">
                  {t('landing.hero.snapshot_commute_time.value')}
                </p>
                <p className="text-sm text-rose-200 mt-1 font-medium">
                  {t('landing.hero.snapshot_commute_time.note')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-10">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8">
          <h2 className="text-2xl font-bold mb-2">{t('landing.difference.title')}</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">{t('landing.difference.lead')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                {t('landing.difference.standard_title')}
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <li>• {t('landing.difference.standard_items.role')}</li>
                <li>• {t('landing.difference.standard_items.company')}</li>
                <li>• {t('landing.difference.standard_items.gross')}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/60 dark:bg-cyan-950/20 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300 mb-3">
                {t('landing.difference.jobshaman_title')}
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <li>• {t('landing.difference.jobshaman_items.net')}</li>
                <li>• {t('landing.difference.jobshaman_items.commute')}</li>
                <li>• {t('landing.difference.jobshaman_items.contract')}</li>
                <li>• {t('landing.difference.jobshaman_items.jhi')}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-10">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8">
          <h2 className="text-2xl font-bold mb-6">{t('landing.how.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2 mb-2 text-cyan-700 dark:text-cyan-300 font-semibold text-sm">
                <Users size={16} />
                {t('landing.how.step1_title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('landing.how.step1_desc')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2 mb-2 text-cyan-700 dark:text-cyan-300 font-semibold text-sm">
                <Scale size={16} />
                {t('landing.how.step2_title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('landing.how.step2_desc')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2 mb-2 text-cyan-700 dark:text-cyan-300 font-semibold text-sm">
                <CheckCircle2 size={16} />
                {t('landing.how.step3_title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('landing.how.step3_desc')}</p>
            </div>
          </div>

          <p className="mt-5 text-sm text-slate-700 dark:text-slate-200 font-medium">
            {t('landing.how.no_cv_note')}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-10">
        <CrossBorderPromo />
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-10">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8">
          <h2 className="text-2xl font-bold mb-6">{t('landing.audience.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Compass size={16} className="text-cyan-600" />
                {t('landing.audience.person1_title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('landing.audience.person1_desc')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <MapPin size={16} className="text-cyan-600" />
                {t('landing.audience.person2_title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('landing.audience.person2_desc')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Scale size={16} className="text-cyan-600" />
                {t('landing.audience.person3_title')}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('landing.audience.person3_desc')}</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-700 dark:text-slate-200 font-medium">
            {t('landing.audience.crossborder_note')}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8">
          <h2 className="text-2xl font-bold mb-2">{t('landing.unique.title')}</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-5">{t('landing.unique.lead')}</p>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>• {t('landing.unique.items.crossborder')}</li>
            <li>• {t('landing.unique.items.tax')}</li>
            <li>• {t('landing.unique.items.net')}</li>
            <li>• {t('landing.unique.items.transparency')}</li>
          </ul>
          <p className="mt-5 text-sm font-medium text-slate-700 dark:text-slate-200">{t('landing.unique.decision_platform')}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <h3 className="text-lg font-semibold mb-4">{t('landing.blog.title')}</h3>
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
