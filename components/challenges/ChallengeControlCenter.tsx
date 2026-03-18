import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/primitives';
import { buildCareerMapGraphModel } from '../../services/careerMapService';
import { computeCandidateAnnotations } from '../../services/candidateIntentService';
import { CareerMapGraphModel, Job, JobSearchFilters, SearchDiagnosticsMeta, UserProfile } from '../../types';
import ChallengeHandshakeCard from './ChallengeHandshakeCard';
import ChallengeSidebar, { type DiscoveryMode } from './ChallengeSidebar';
import CreateMiniChallengeModal from './CreateMiniChallengeModal';
import ChallengeWorkspaceToolbar from './ChallengeWorkspaceToolbar';
import ChallengeMapWorkspace from './ChallengeMapWorkspace';
import ChallengeFeedWorkspace from './ChallengeFeedWorkspace';
import type { ChallengeWorkspaceView } from './challengeWorkspaceTypes';

interface ChallengeControlCenterProps {
  jobs: Job[];
  userProfile: UserProfile;
  lane: 'challenges' | 'imports';
  setLane: (lane: 'challenges' | 'imports') => void;
  discoveryMode: DiscoveryMode;
  searchDiagnostics: SearchDiagnosticsMeta | null;
  setDiscoveryMode: (mode: DiscoveryMode) => void;
  savedJobIds: string[];
  totalCount: number;
  loadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  pageSize: number;
  handleJobSelect: (jobId: string | null) => void;
  handleToggleSave: (jobId: string) => void;
  loadMoreJobs: () => void;
  goToPage: (page: number) => void;
  theme: 'light' | 'dark';
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number) => void;
  applyDiscoveryDefaults: (filters: JobSearchFilters, force?: boolean) => void;
  onOpenProfile: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => Promise<void> | void;
  selectedJobId: string | null;
  workspaceView?: ChallengeWorkspaceView;
  onWorkspaceViewChange?: (view: ChallengeWorkspaceView) => void;
}

const ChallengeControlCenter: React.FC<ChallengeControlCenterProps> = ({
  jobs,
  userProfile,
  lane,
  setLane,
  discoveryMode,
  searchDiagnostics,
  setDiscoveryMode,
  savedJobIds,
  totalCount,
  loadingMore,
  hasMore,
  currentPage,
  pageSize,
  handleJobSelect,
  handleToggleSave,
  loadMoreJobs,
  goToPage,
  theme,
  filterMinSalary,
  setFilterMinSalary,
  remoteOnly,
  setRemoteOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  applyDiscoveryDefaults,
  onOpenProfile,
  onOpenAuth,
  selectedJobId,
  workspaceView: controlledWorkspaceView,
  onWorkspaceViewChange,
}) => {
  const { i18n } = useTranslation();
  const isImportedListing = (job: Job): boolean =>
    job.listingKind === 'imported' || Boolean(job.searchDiagnostics?.external);

  const isMicroJob = (job: Job): boolean => job.challenge_format === 'micro_job';

  const locale = String(i18n.resolvedLanguage || i18n.language || userProfile?.preferredLocale || 'en');
  const language = locale.split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';
  const t = useMemo(() => {
    if (language === 'cs') {
      return {
        you: 'Vy',
        direction: 'Tvůj pracovní směr',
        mapHelper: 'Mapa se větví podle tvého profilu a aktivního výběru.',
        mapLoadFailed: 'Mapu se nepodařilo načíst.',
        feed: 'Co je ve hře',
        map: 'Mapa',
        reset: 'Srovnat to',
        createdMini: 'Fuška byla úspěšně vytvořena (demo: uloženo do logu).',
      };
    }
    if (language === 'sk') {
      return {
        you: 'Vy',
        direction: 'Tvoj pracovný smer',
        mapHelper: 'Mapa sa vetví podľa tvojho profilu a aktívneho výberu.',
        mapLoadFailed: 'Mapu sa nepodarilo načítať.',
        feed: 'Čo je v hre',
        map: 'Mapa',
        reset: 'Utriediť to',
        createdMini: 'Mini výzva bola úspešne vytvorená (demo: uložené do logu).',
      };
    }
    if (language === 'de') {
      return {
        you: 'Sie',
        direction: 'Ihre berufliche Richtung',
        mapHelper: 'Die Karte verzweigt sich nach Ihrem Profil und der aktuellen Auswahl.',
        mapLoadFailed: 'Die Karte konnte nicht geladen werden.',
        feed: 'Was gerade läuft',
        map: 'Karte',
        reset: 'Neu sortieren',
        createdMini: 'Mini-Job erstellt (Demo: im Log gespeichert).',
      };
    }
    if (language === 'pl') {
      return {
        you: 'Ty',
        direction: 'Twój kierunek zawodowy',
        mapHelper: 'Mapa rozgałęzia się według Twojego profilu i aktualnego wyboru.',
        mapLoadFailed: 'Nie udało się załadować mapy.',
        feed: 'Co jest w grze',
        map: 'Mapa',
        reset: 'Poukładaj to',
        createdMini: 'Mini wyzwanie zostało utworzone (demo: zapisano w logu).',
      };
    }
      return {
      you: 'You',
      direction: 'Your work direction',
      mapHelper: 'The map branches from your profile and current selection.',
      mapLoadFailed: 'Failed to load the map.',
      feed: 'What is in play',
      map: 'Map',
      reset: 'Reset clean',
      createdMini: 'Mini challenge created (demo: saved to log).',
    };
  }, [language]);

  const annotatedJobs = useMemo(() => computeCandidateAnnotations(jobs || [], userProfile, locale), [jobs, locale, userProfile]);
  const microJobs = useMemo(() => annotatedJobs.filter(isMicroJob), [annotatedJobs]);
  const importedJobs = useMemo(
    () => annotatedJobs.filter((job) => isImportedListing(job) && !isMicroJob(job)),
    [annotatedJobs]
  );
  const nativeJobs = useMemo(
    () => annotatedJobs.filter((job) => !isImportedListing(job) && !isMicroJob(job)),
    [annotatedJobs]
  );
  const laneScopedJobs = useMemo(() => {
    if (discoveryMode === 'micro_jobs') {
      return microJobs;
    }

    const rankForFeed = (items: Job[]) => [...items].sort((left, right) => {
      const leftScore = Number(left.priorityScore ?? left.searchScore ?? left.aiMatchScore ?? 0);
      const rightScore = Number(right.priorityScore ?? right.searchScore ?? right.aiMatchScore ?? 0);
      if (rightScore !== leftScore) return rightScore - leftScore;
      const leftJhi = Number(left.jhi?.score || 0);
      const rightJhi = Number(right.jhi?.score || 0);
      if (rightJhi !== leftJhi) return rightJhi - leftJhi;
      return 0;
    });

    if (lane === 'imports') {
      return rankForFeed(importedJobs);
    }

    return rankForFeed([...nativeJobs, ...importedJobs, ...microJobs]);
  }, [discoveryMode, importedJobs, lane, microJobs, nativeJobs]);

  useEffect(() => {
    if (discoveryMode !== 'all') return;
    if (lane !== 'challenges') return;
    if (nativeJobs.length > 0) return;
    if (importedJobs.length === 0) return;
    setLane('imports');
  }, [discoveryMode, importedJobs.length, lane, nativeJobs.length, setLane]);

  const forestAccentStyle = useMemo((): React.CSSProperties => {
    const isDark = theme === 'dark';
    const accent = isDark ? '#22c55e' : '#14532d';
    const accentRgb = isDark ? '34, 197, 94' : '20, 83, 45';
    const accentGreen = isDark ? '#16a34a' : '#166534';
    const accentGreenRgb = isDark ? '22, 163, 74' : '22, 101, 52';
    const accentSky = '#0f766e';
    const accentSkyRgb = '15, 118, 110';
    return {
      ['--accent' as any]: accent,
      ['--accent-rgb' as any]: accentRgb,
      ['--accent-green' as any]: accentGreen,
      ['--accent-green-rgb' as any]: accentGreenRgb,
      ['--accent-sky' as any]: accentSky,
      ['--accent-sky-rgb' as any]: accentSkyRgb,
    };
  }, [theme]);

  const [careerMapMode, setCareerMapMode] = useState<'taxonomy' | 'hierarchy'>('hierarchy');
  const [uncontrolledWorkspaceView, setUncontrolledWorkspaceView] = useState<ChallengeWorkspaceView>('feed');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const [filterDomains, setFilterDomains] = useState<string[]>([]);
  const [filterSeniorities, setFilterSeniorities] = useState<string[]>([]);
  const [filterContractTypes, setFilterContractTypes] = useState<string[]>([]);
  const selectedJob = useMemo(() => laneScopedJobs.find((j) => j.id === selectedJobId) || null, [laneScopedJobs, selectedJobId]);
  const workspaceView = controlledWorkspaceView ?? uncontrolledWorkspaceView;
  const isMobileViewport = !isDesktopViewport;

  useEffect(() => {
    if (!selectedJobId) return;
    if (selectedJob) return;
    handleJobSelect(null);
  }, [handleJobSelect, selectedJob, selectedJobId]);

  const mapCenterNode = useMemo(() => {
    const preferredRole = String(
      userProfile.jobTitle
      || userProfile.preferences?.desired_role
      || selectedJob?.title
      || ''
    ).trim();
    const currentDomain = String(
      selectedJob?.inferredDomain
      || selectedJob?.matchedDomains?.[0]
      || userProfile.preferences?.searchProfile?.primaryDomain
      || userProfile.preferences?.searchProfile?.secondaryDomains?.[0]
      || ''
    ).trim();
    const location = String(selectedJob?.location || userProfile.address || '').trim();
    return {
      title: String(userProfile.name || t.you).trim(),
      subtitle: preferredRole || t.direction,
      avatarUrl: userProfile.photo || null,
      helper: [currentDomain, location].filter(Boolean).join(' • ') || t.mapHelper,
    };
  }, [
    selectedJob?.inferredDomain,
    selectedJob?.location,
    selectedJob?.matchedDomains,
    selectedJob?.title,
    t.direction,
    t.mapHelper,
    t.you,
    userProfile.address,
    userProfile.jobTitle,
    userProfile.name,
    userProfile.photo,
    userProfile.preferences?.desired_role,
    userProfile.preferences?.searchProfile?.primaryDomain,
    userProfile.preferences?.searchProfile?.secondaryDomains,
  ]);

  const setWorkspaceView = (view: ChallengeWorkspaceView) => {
    if (isMobileViewport && view === 'map') {
      return;
    }
    if (controlledWorkspaceView == null) {
      setUncontrolledWorkspaceView(view);
    }
    onWorkspaceViewChange?.(view);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileMenuOpen(false);
      return;
    }
    if (workspaceView === 'map') {
      setWorkspaceView('feed');
    }
  }, [isMobileViewport, workspaceView]);


  const mapJobPool = useMemo(() => (laneScopedJobs || []).slice(0, 160), [laneScopedJobs]);
  const jobsKey = useMemo(() => mapJobPool.map((j) => j.id).join('|'), [mapJobPool]);
  const cacheRef = useRef<Map<string, CareerMapGraphModel>>(new Map());
  const [careerMapGraph, setCareerMapGraph] = useState<CareerMapGraphModel | null>(null);
  const [careerMapLoading, setCareerMapLoading] = useState(false);
  const [careerMapError, setCareerMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const shouldLoadCareerMap = !isMobileViewport && workspaceView === 'map';
      if (!shouldLoadCareerMap || mapJobPool.length === 0) {
        setCareerMapGraph(null);
        setCareerMapError(null);
        setCareerMapLoading(false);
        return;
      }
      const cached = cacheRef.current.get(jobsKey);
      if (cached) {
        setCareerMapGraph(cached);
        setCareerMapError(null);
        return;
      }
      setCareerMapLoading(true);
      setCareerMapError(null);
      try {
        const graph = await buildCareerMapGraphModel(mapJobPool);
        if (cancelled) return;
        cacheRef.current.set(jobsKey, graph);
        setCareerMapGraph(graph);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err || '');
        if (!/CareerMap unavailable/i.test(message)) {
          console.warn('CareerMap graph build failed', err);
        }
        setCareerMapGraph(null);
        setCareerMapError(t.mapLoadFailed);
      } finally {
        if (!cancelled) setCareerMapLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isMobileViewport, jobsKey, mapJobPool, t.mapLoadFailed, workspaceView]);

  return (
    <section
      style={forestAccentStyle}
      className="relative min-h-[calc(100dvh-var(--app-header-height))] overflow-hidden bg-white dark:bg-slate-950"
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -z-10',
          'bg-white',
          'dark:bg-slate-950'
        )}
      />

      <div className="flex h-full w-full flex-col px-0 py-2 lg:px-2">
        <ChallengeWorkspaceToolbar
          feedLabel={t.feed}
          mapLabel={t.map}
          resetLabel={t.reset}
          workspaceView={workspaceView}
          careerMapMode={careerMapMode}
          allowMapView={!isMobileViewport}
          mobileMenuLabel={language === 'cs' ? 'Menu a filtry' : language === 'sk' ? 'Menu a filtre' : language === 'de' || language === 'at' ? 'Menü und Filter' : language === 'pl' ? 'Menu i filtry' : 'Menu & filters'}
          onOpenMobileMenu={isMobileViewport ? () => setMobileMenuOpen(true) : undefined}
          onWorkspaceViewChange={setWorkspaceView}
          onCareerMapModeChange={setCareerMapMode}
          onReset={() => {
            setRemoteOnly(false);
            applyDiscoveryDefaults({
              filterMinSalary: 0,
              enableCommuteFilter: false,
              filterMaxDistance: 50,
            }, true);
          }}
        />

        <div className={cn(
          "grid flex-1 items-start transition-all duration-300",
          workspaceView === 'map' ? "grid-cols-1" : "lg:grid-cols-[312px_minmax(0,1fr)] gap-4"
        )}>
          {workspaceView !== 'map' && !isMobileViewport && (
            <div className="h-full pr-1 lg:self-start">
              <ChallengeSidebar
                userProfile={userProfile}
                lane={lane}
                setLane={setLane}
                discoveryMode={discoveryMode}
                setDiscoveryMode={setDiscoveryMode}
                filterMinSalary={filterMinSalary}
                setFilterMinSalary={setFilterMinSalary}
                remoteOnly={remoteOnly}
                setRemoteOnly={setRemoteOnly}
                enableCommuteFilter={enableCommuteFilter}
                setEnableCommuteFilter={setEnableCommuteFilter}
                filterMaxDistance={filterMaxDistance}
                setFilterMaxDistance={setFilterMaxDistance}
                filterDomains={filterDomains}
                setFilterDomains={setFilterDomains}
                filterSeniorities={filterSeniorities}
                setFilterSeniorities={setFilterSeniorities}
                filterContractTypes={filterContractTypes}
                setFilterContractTypes={setFilterContractTypes}
                onOpenProfile={onOpenProfile}
              />
            </div>
          )}

          <div className="h-full overflow-y-auto space-y-4 pb-6">
            {workspaceView === 'map' ? (
              <ChallengeMapWorkspace
                jobs={mapJobPool}
                selectedJobId={selectedJobId}
                selectedCompanyName={selectedJob?.company}
                selectedJobTitle={selectedJob?.title}
                locale={language}
                centerNode={mapCenterNode}
                graphData={careerMapGraph}
                loading={careerMapLoading}
                error={careerMapError}
                mode={careerMapMode}
                onSelectJob={handleJobSelect}
              />
            ) : (
              <ChallengeFeedWorkspace
                jobs={laneScopedJobs}
                selectedJobId={selectedJobId}
                savedJobIds={savedJobIds}
                locale={locale}
                userProfile={userProfile}
                searchDiagnostics={searchDiagnostics}
                totalCount={totalCount}
                loadingMore={loadingMore}
                hasMore={hasMore}
                currentPage={currentPage}
                pageSize={pageSize}
                handleJobSelect={handleJobSelect}
                handleToggleSave={handleToggleSave}
                loadMoreJobs={loadMoreJobs}
                goToPage={goToPage}
                onOpenProfile={onOpenProfile}
                onOpenAuth={onOpenAuth}
                onCreateMiniChallenge={() => {
                  if (userProfile.isLoggedIn) {
                    setIsCreateModalOpen(true);
                  } else {
                    onOpenAuth('register');
                  }
                }}
                isMobileViewport={isMobileViewport}
              />
            )}
          </div>
        </div>

        <CreateMiniChallengeModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          isCsLike={isCsLike}
          locale={language}
          onSubmit={(data) => {
            console.log('New Mini Challenge created:', data);
            alert(t.createdMini);
          }}
        />
      </div>

      {/* Independent Job Detail Overlay / Drawer */}
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="h-full w-[min(88vw,360px)] overflow-y-auto bg-[var(--bg)] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <ChallengeSidebar
              userProfile={userProfile}
              lane={lane}
              setLane={(nextLane) => {
                setLane(nextLane);
                setMobileMenuOpen(false);
              }}
              discoveryMode={discoveryMode}
              setDiscoveryMode={(nextMode) => {
                setDiscoveryMode(nextMode);
                setMobileMenuOpen(false);
              }}
              filterMinSalary={filterMinSalary}
              setFilterMinSalary={setFilterMinSalary}
              remoteOnly={remoteOnly}
              setRemoteOnly={setRemoteOnly}
              enableCommuteFilter={enableCommuteFilter}
              setEnableCommuteFilter={setEnableCommuteFilter}
              filterMaxDistance={filterMaxDistance}
              setFilterMaxDistance={setFilterMaxDistance}
              filterDomains={filterDomains}
              setFilterDomains={setFilterDomains}
              filterSeniorities={filterSeniorities}
              setFilterSeniorities={setFilterSeniorities}
              filterContractTypes={filterContractTypes}
              setFilterContractTypes={setFilterContractTypes}
              onOpenProfile={() => {
                setMobileMenuOpen(false);
                onOpenProfile();
              }}
            />
          </div>
        </div>
      ) : null}

      {selectedJobId && selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm transition-all"
          onClick={() => handleJobSelect(null)}
        >
          <div
            className="h-full w-full max-w-3xl overflow-y-auto bg-[var(--bg-app)] shadow-2xl animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative p-6 lg:p-10">
              <button
                onClick={() => handleJobSelect(null)}
                className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[var(--accent)] shadow-lg backdrop-blur hover:bg-white/20"
              >
                <ArrowRight className="rotate-180" size={20} />
              </button>

              <ChallengeHandshakeCard
                job={selectedJob}
                userProfile={userProfile}
                isSaved={selectedJob ? savedJobIds.includes(selectedJob.id) : false}
                onToggleSave={handleToggleSave}
                onOpen={(jobId) => handleJobSelect(jobId)}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ChallengeControlCenter;
