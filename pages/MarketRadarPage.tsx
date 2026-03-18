import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Compass, RefreshCw, Sparkles, TowerControl } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CareerOpsAction, CareerOpsCompany, CareerOpsFeedResponse, CareerOpsJob, UserProfile } from '../types';
import { fetchCareerOpsFeed } from '../services/careerOpsService';

type MarketRadarPageProps = {
  userProfile: UserProfile;
  onOpenAuth: (mode?: 'login' | 'register') => Promise<void> | void;
  onOpenProfile: () => void;
};

const sectionTitle = (title: string, subtitle: string) => (
  <div className="mb-4 flex items-end justify-between gap-4">
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">{subtitle}</div>
      <h2 className="mt-1 text-2xl font-black text-[var(--text-strong)]">{title}</h2>
    </div>
  </div>
);

const ActionCard = ({ action, openSourceLabel }: { action: CareerOpsAction; openSourceLabel: string }) => (
  <article className="rounded-[26px] border border-[rgba(var(--accent-rgb),0.12)] bg-white/80 p-5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:bg-white/5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">{action.kind.replace(/_/g, ' ')}</div>
        <h3 className="mt-2 text-lg font-bold text-[var(--text-strong)]">{action.title}</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{action.subtitle}</p>
      </div>
      {typeof action.score === 'number' ? (
        <div className="rounded-full bg-[rgba(var(--accent-rgb),0.12)] px-3 py-1 text-sm font-bold text-[var(--accent)]">
          {Math.round(action.score)}
        </div>
      ) : null}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {(action.reason_lines || []).slice(0, 3).map((line) => (
        <span key={line} className="rounded-full border border-[rgba(var(--accent-rgb),0.12)] bg-[rgba(var(--accent-rgb),0.06)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
          {line}
        </span>
      ))}
    </div>
    {action.source_url ? (
      <button
        type="button"
        onClick={() => window.open(action.source_url || '', '_blank', 'noopener,noreferrer')}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white"
      >
        {openSourceLabel}
        <ArrowUpRight size={16} />
      </button>
    ) : null}
  </article>
);

const JobCard = ({ job, fitLabel, openRoleLabel }: { job: CareerOpsJob; fitLabel: string; openRoleLabel: string }) => (
  <article className="rounded-[24px] border border-[rgba(var(--accent-rgb),0.12)] bg-white/80 p-5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:bg-white/5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
          {job.source_site} · {job.freshness_bucket}
        </div>
        <h3 className="mt-2 text-lg font-bold text-[var(--text-strong)]">{job.title}</h3>
        <p className="mt-1 text-sm font-medium text-[var(--text)]">{job.company}</p>
        <p className="text-sm text-[var(--text-muted)]">{job.location}</p>
      </div>
      <div className="rounded-[18px] bg-[rgba(var(--accent-rgb),0.12)] px-3 py-2 text-right">
        <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">{fitLabel}</div>
        <div className="text-xl font-black text-[var(--accent)]">{Math.round(job.fit_score)}</div>
      </div>
    </div>
    <p className="mt-4 text-sm leading-6 text-[var(--text)]">{job.description_excerpt}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {(job.fit_reasons || []).slice(0, 3).map((line) => (
        <span key={line} className="rounded-full border border-[rgba(var(--accent-rgb),0.12)] bg-[rgba(var(--accent-rgb),0.06)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
          {line}
        </span>
      ))}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
      {job.primary_domain ? <span>{job.primary_domain.replace(/_/g, ' ')}</span> : null}
      {job.primary_role_family ? <span>• {job.primary_role_family.replace(/_/g, ' ')}</span> : null}
      {job.inferred_seniority ? <span>• {job.inferred_seniority}</span> : null}
      <span>• {job.work_mode_normalized}</span>
    </div>
    {job.job_url ? (
      <button
        type="button"
        onClick={() => window.open(job.job_url || '', '_blank', 'noopener,noreferrer')}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.2)] bg-[rgba(var(--accent-rgb),0.08)] px-4 py-2 text-sm font-bold text-[var(--accent)]"
      >
        {openRoleLabel}
        <ArrowUpRight size={16} />
      </button>
    ) : null}
  </article>
);

const CompanyCard = ({ company, companySignalLabel, avgFitLabel, openingsLabel }: { company: CareerOpsCompany; companySignalLabel: string; avgFitLabel: string; openingsLabel: string }) => (
  <article className="rounded-[24px] border border-[rgba(var(--accent-rgb),0.12)] bg-white/80 p-5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:bg-white/5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">{companySignalLabel}</div>
        <h3 className="mt-2 text-lg font-bold text-[var(--text-strong)]">{company.company}</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{company.why_now}</p>
      </div>
      <div className="rounded-[18px] bg-[rgba(var(--accent-rgb),0.12)] px-3 py-2 text-right">
        <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">{avgFitLabel}</div>
        <div className="text-xl font-black text-[var(--accent)]">{Math.round(company.avg_fit_score)}</div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <span className="rounded-full bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
        {company.open_jobs_count} {openingsLabel}
      </span>
      {(company.top_locations || []).slice(0, 2).map((location) => (
        <span key={location} className="rounded-full bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
          {location}
        </span>
      ))}
    </div>
    <div className="mt-4 space-y-2">
      {(company.sample_titles || []).slice(0, 3).map((title) => (
        <div key={title} className="text-sm text-[var(--text)]">{title}</div>
      ))}
    </div>
  </article>
);

export default function MarketRadarPage({ userProfile, onOpenAuth, onOpenProfile }: MarketRadarPageProps) {
  const { i18n } = useTranslation();
  const [feed, setFeed] = useState<CareerOpsFeedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const language = String(i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();

  const copy = useMemo(() => {
    const isCs = language === 'cs';
    const isSk = language === 'sk';
    const isDe = language === 'de' || language === 'at';
    const isPl = language === 'pl';
    if (isCs) {
      return {
        marketRadar: 'Radar trhu',
        guestBody: 'Přihlaste se a proměníme externí JobSpy discovery na seřazený akční přehled podle role, domény a pracovního nastavení.',
        signIn: 'Přihlásit se',
        heroEyebrow: 'radar trhu',
        heroTitle: 'Discovery, enrichment, scoring a akční vrstva',
        heroBody: 'Tento pohled převádí externí JobSpy korpus na kandidátně orientovanou pracovní vrstvu pro JobShaman. Řadí čerstvé role, company clustery i follow-up příležitosti podle vaší aktuální trajektorie.',
        refresh: 'Obnovit radar',
        refineProfile: 'Vyladit profil',
        rawJobs: 'Nalezené role',
        scoredJobs: 'Seřazené role',
        companies: 'Firmy',
        actions: 'Akce',
        fallbackNote: 'Radar běží v náhradním režimu z externího cached feedu, protože nasazený backend zatím nevystavuje plný career-ops endpoint.',
        loading: 'Načítám radar trhu…',
        actionQueue: 'Akční fronta',
        nextMoves: 'další nejlepší kroky',
        highFitRoles: 'Nejrelevantnější externí role',
        rankedJobs: 'seřazené nabídky',
        companySignals: 'Signály firem',
        hiringClusters: 'náborové clustery',
        openSource: 'Otevřít zdroj',
        openRole: 'Otevřít nabídku',
        companySignal: 'signál firmy',
        avgFit: 'průměrný fit',
        fit: 'fit',
        openings: 'otevřených rolí',
        marketRoleDirection: 'Směr další role',
        marketDiscovery: 'průzkum trhu',
        failed: 'Nepodařilo se načíst radar trhu.',
      };
    }
    if (isSk) {
      return {
        marketRadar: 'Radar trhu',
        guestBody: 'Prihláste sa a externé JobSpy discovery premeníme na zoradený akčný prehľad podľa role, domény a pracovného nastavenia.',
        signIn: 'Prihlásiť sa',
        heroEyebrow: 'radar trhu',
        heroTitle: 'Discovery, enrichment, scoring a akčná vrstva',
        heroBody: 'Tento pohľad premieňa externý JobSpy korpus na kandidátsku pracovnú vrstvu pre JobShaman. Zoraďuje čerstvé role, firemné clustre aj follow-up príležitosti podľa vašej aktuálnej trajektórie.',
        refresh: 'Obnoviť radar',
        refineProfile: 'Vyladiť profil',
        rawJobs: 'Nájdené role',
        scoredJobs: 'Zoradené role',
        companies: 'Firmy',
        actions: 'Akcie',
        fallbackNote: 'Radar beží v náhradnom režime z externého cached feedu, pretože nasadený backend zatiaľ nevystavuje plný career-ops endpoint.',
        loading: 'Načítavam radar trhu…',
        actionQueue: 'Akčná fronta',
        nextMoves: 'ďalšie najlepšie kroky',
        highFitRoles: 'Najrelevantnejšie externé role',
        rankedJobs: 'zoradené ponuky',
        companySignals: 'Signály firiem',
        hiringClusters: 'náborové clustre',
        openSource: 'Otvoriť zdroj',
        openRole: 'Otvoriť ponuku',
        companySignal: 'signál firmy',
        avgFit: 'priemerný fit',
        fit: 'fit',
        openings: 'otvorených rolí',
        marketRoleDirection: 'Smer ďalšej role',
        marketDiscovery: 'prieskum trhu',
        failed: 'Nepodarilo sa načítať radar trhu.',
      };
    }
    if (isDe) {
      return {
        marketRadar: 'Marktradar',
        guestBody: 'Melden Sie sich an und wir verwandeln externe JobSpy-Discovery in eine sortierte Aktionsansicht rund um Rolle, Domain und Arbeitsmodus.',
        signIn: 'Anmelden',
        heroEyebrow: 'marktradar',
        heroTitle: 'Discovery, Enrichment, Scoring und Aktionsschicht',
        heroBody: 'Diese Ansicht verwandelt den externen JobSpy-Korpus in eine kandidatenorientierte Arbeitsoberfläche für JobShaman. Sie priorisiert frische Rollen, Firmencluster und Follow-up-Chancen entlang Ihrer aktuellen Richtung.',
        refresh: 'Radar aktualisieren',
        refineProfile: 'Profil schärfen',
        rawJobs: 'Gefundene Rollen',
        scoredJobs: 'Gerankte Rollen',
        companies: 'Firmen',
        actions: 'Aktionen',
        fallbackNote: 'Der Radar läuft im Fallback-Modus aus dem externen Cached Feed, weil das bereitgestellte Backend den vollständigen Career-Ops-Endpunkt noch nicht ausliefert.',
        loading: 'Marktradar wird geladen…',
        actionQueue: 'Aktionsliste',
        nextMoves: 'nächste beste Schritte',
        highFitRoles: 'Relevanteste externe Rollen',
        rankedJobs: 'gerankte Jobs',
        companySignals: 'Firmensignale',
        hiringClusters: 'Hiring-Cluster',
        openSource: 'Quelle öffnen',
        openRole: 'Rolle öffnen',
        companySignal: 'firmensignal',
        avgFit: 'Ø fit',
        fit: 'fit',
        openings: 'offene Rollen',
        marketRoleDirection: 'Richtung der nächsten Rolle',
        marketDiscovery: 'Markterkundung',
        failed: 'Marktradar konnte nicht geladen werden.',
      };
    }
    if (isPl) {
      return {
        marketRadar: 'Radar rynku',
        guestBody: 'Zaloguj się, a zamienimy zewnętrzny JobSpy discovery w uporządkowany widok działań wokół roli, domeny i modelu pracy.',
        signIn: 'Zaloguj się',
        heroEyebrow: 'radar rynku',
        heroTitle: 'Discovery, enrichment, scoring i warstwa działań',
        heroBody: 'Ten widok zamienia zewnętrzny korpus JobSpy w operacyjną warstwę dla kandydata w JobShaman. Ustawia priorytety świeżych ról, klastrów firm i follow-upów zgodnie z Twoim obecnym kierunkiem.',
        refresh: 'Odśwież radar',
        refineProfile: 'Dopracuj profil',
        rawJobs: 'Znalezione role',
        scoredJobs: 'Uszeregowane role',
        companies: 'Firmy',
        actions: 'Akcje',
        fallbackNote: 'Radar działa w trybie awaryjnym z zewnętrznego cached feedu, ponieważ wdrożony backend nie udostępnia jeszcze pełnego endpointu career-ops.',
        loading: 'Ładowanie radaru rynku…',
        actionQueue: 'Kolejka działań',
        nextMoves: 'kolejne najlepsze ruchy',
        highFitRoles: 'Najbardziej trafne role zewnętrzne',
        rankedJobs: 'uszeregowane oferty',
        companySignals: 'Sygnały firm',
        hiringClusters: 'klastry rekrutacyjne',
        openSource: 'Otwórz źródło',
        openRole: 'Otwórz ofertę',
        companySignal: 'sygnał firmy',
        avgFit: 'średni fit',
        fit: 'fit',
        openings: 'otwartych ról',
        marketRoleDirection: 'Kierunek kolejnej roli',
        marketDiscovery: 'odkrywanie rynku',
        failed: 'Nie udało się załadować radaru rynku.',
      };
    }
    return {
      marketRadar: 'Market Radar',
      guestBody: 'Sign in and we will turn external JobSpy discovery into a ranked action queue around your role direction, domain and work setup.',
      signIn: 'Sign in',
      heroEyebrow: 'market radar',
      heroTitle: 'Discovery to enrichment to scoring to action queue',
      heroBody: 'This view turns the external JobSpy corpus into a candidate-specific operating layer for JobShaman. It ranks fresh roles, company clusters and follow-up opportunities around your current direction.',
      refresh: 'Refresh radar',
      refineProfile: 'Refine profile',
      rawJobs: 'Raw jobs seen',
      scoredJobs: 'Enriched + scored',
      companies: 'Company clusters',
      actions: 'Action queue',
      fallbackNote: 'Radar is running in fallback mode from the external cached feed because the deployed backend does not yet expose the full career-ops endpoint.',
      loading: 'Loading market radar…',
      actionQueue: 'Action Queue',
      nextMoves: 'next best moves',
      highFitRoles: 'High-Fit External Roles',
      rankedJobs: 'ranked jobs',
      companySignals: 'Company Signals',
      hiringClusters: 'hiring clusters',
      openSource: 'Open source',
      openRole: 'Open role',
      companySignal: 'company signal',
      avgFit: 'avg fit',
      fit: 'fit',
      openings: 'openings',
      marketRoleDirection: 'Your next role direction',
      marketDiscovery: 'market discovery',
      failed: 'Failed to load market radar.',
    };
  }, [language]);

  const load = async (refresh = false) => {
    if (!userProfile.isLoggedIn || !userProfile.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCareerOpsFeed({ refresh, jobLimit: 18, companyLimit: 8, actionLimit: 12 });
      setFeed(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, [userProfile.id, userProfile.isLoggedIn]);

  const hero = useMemo(() => {
    const intent = feed?.meta?.candidate_intent;
    const reco = feed?.meta?.recommendation_intelligence;
    return {
      role: intent?.target_role || userProfile.preferences?.desired_role || userProfile.jobTitle || copy.marketRoleDirection,
      domain: intent?.primary_domain || reco?.primary_domain || copy.marketDiscovery,
      keywords: (reco?.priority_keywords || []).slice(0, 4),
    };
  }, [copy.marketDiscovery, copy.marketRoleDirection, feed?.meta?.candidate_intent, feed?.meta?.recommendation_intelligence, userProfile.jobTitle, userProfile.preferences?.desired_role]);

  if (!userProfile.isLoggedIn) {
    return (
      <div className="col-span-1 lg:col-span-12 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-[rgba(var(--accent-rgb),0.16)] bg-white/80 p-8 text-center shadow-[0_26px_70px_-38px_rgba(15,23,42,0.34)] backdrop-blur-xl dark:bg-white/5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)]">
            <TowerControl size={26} />
          </div>
          <h1 className="mt-5 text-3xl font-black text-[var(--text-strong)]">{copy.marketRadar}</h1>
          <p className="mt-3 text-base leading-7 text-[var(--text-muted)]">
            {copy.guestBody}
          </p>
          <button type="button" onClick={() => onOpenAuth('login')} className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-black text-white">
            {copy.signIn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-1 lg:col-span-12 px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[34px] border border-[rgba(var(--accent-rgb),0.16)] bg-[radial-gradient(circle_at_top_left,rgba(var(--accent-rgb),0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,250,252,0.82))] p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.34)] dark:bg-[radial-gradient(circle_at_top_left,rgba(var(--accent-rgb),0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(var(--accent-rgb),0.12)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
              <Compass size={14} />
              {copy.heroEyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-strong)] sm:text-4xl">
              {copy.heroTitle}
            </h1>
            <p className="mt-3 text-base leading-7 text-[var(--text-muted)]">
              {copy.heroBody}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--text)]">
                {hero.role}
              </span>
              <span className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--text)]">
                {String(hero.domain).replace(/_/g, ' ')}
              </span>
              {hero.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full border border-[rgba(var(--accent-rgb),0.12)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void load(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-black text-white">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {copy.refresh}
            </button>
            <button type="button" onClick={onOpenProfile} className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/70 px-5 py-3 text-sm font-black text-[var(--accent)]">
              <Sparkles size={16} />
              {copy.refineProfile}
            </button>
          </div>
        </div>
        {feed?.meta?.counts ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: copy.rawJobs, value: feed.meta.counts.raw_jobs_seen },
              { label: copy.scoredJobs, value: feed.meta.counts.enriched_jobs_scored },
              { label: copy.companies, value: feed.meta.counts.companies_ranked },
              { label: copy.actions, value: feed.meta.counts.actions },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-[rgba(var(--accent-rgb),0.12)] bg-white/72 p-4 backdrop-blur-xl dark:bg-white/5">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.label}</div>
                <div className="mt-2 text-3xl font-black text-[var(--text-strong)]">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}
        {String(feed?.meta?.fallback_mode || '') === 'lite_cached_external' ? (
          <div className="mt-4 rounded-[20px] border border-[rgba(var(--accent-rgb),0.14)] bg-white/72 px-4 py-3 text-sm text-[var(--text-muted)] dark:bg-white/5">
            {copy.fallbackNote}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && !feed ? (
        <div className="mt-8 text-sm font-semibold text-[var(--text-muted)]">{copy.loading}</div>
      ) : null}

      {feed ? (
        <>
          <section className="mt-10">
            {sectionTitle(copy.actionQueue, copy.nextMoves)}
            <div className="grid gap-4 xl:grid-cols-2">
              {(feed.actions || []).map((action) => (
                <ActionCard key={action.id} action={action} openSourceLabel={copy.openSource} />
              ))}
            </div>
          </section>

          <section className="mt-12">
            {sectionTitle(copy.highFitRoles, copy.rankedJobs)}
            <div className="grid gap-4 xl:grid-cols-2">
              {(feed.jobs || []).map((job) => (
                <JobCard key={job.raw_job_id} job={job} fitLabel={copy.fit} openRoleLabel={copy.openRole} />
              ))}
            </div>
          </section>

          <section className="mt-12">
            {sectionTitle(copy.companySignals, copy.hiringClusters)}
            <div className="grid gap-4 xl:grid-cols-2">
              {(feed.companies || []).map((company) => (
                <CompanyCard
                  key={company.company_key}
                  company={company}
                  companySignalLabel={copy.companySignal}
                  avgFitLabel={copy.avgFit}
                  openingsLabel={copy.openings}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
