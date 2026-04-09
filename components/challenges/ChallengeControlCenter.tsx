import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/primitives';
import { Job, SearchDiagnosticsMeta, UserProfile } from '../../types';
import ChallengeSidebar, { type DiscoveryMode } from './ChallengeSidebar';
import CreateMiniChallengeModal from './CreateMiniChallengeModal';
import ChallengeFeedWorkspace from './ChallengeFeedWorkspace';

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
  isLoadingJobs: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  pageSize: number;
  handleJobSelect: (jobId: string | null) => void;
  handleToggleSave: (jobId: string) => void;
  loadMoreJobs: () => void;
  goToPage: (page: number) => void;
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
  filterBenefits: string[];
  setFilterBenefits: (benefits: string[]) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number) => void;
  onOpenProfile: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => Promise<void> | void;
  selectedJobId: string | null;
  showSidebar?: boolean;
  embeddedInCareerOS?: boolean;
  embeddedVariant?: 'default' | 'career_map_offers';
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
  isLoadingJobs,
  loadingMore,
  hasMore,
  currentPage,
  pageSize,
  handleJobSelect,
  handleToggleSave,
  loadMoreJobs,
  goToPage,
  filterMinSalary,
  setFilterMinSalary,
  filterBenefits,
  setFilterBenefits,
  remoteOnly,
  setRemoteOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  onOpenProfile,
  onOpenAuth,
  selectedJobId,
  showSidebar = true,
  embeddedInCareerOS = false,
  embeddedVariant = 'default',
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
        createdMini: 'Fuška byla úspěšně vytvořena (demo: uloženo do logu).',
      };
    }
    if (language === 'sk') {
      return {
        createdMini: 'Mini výzva bola úspešne vytvorená (demo: uložené do logu).',
      };
    }
    if (language === 'de') {
      return {
        createdMini: 'Mini-Job erstellt (Demo: im Log gespeichert).',
      };
    }
    if (language === 'pl') {
      return {
        createdMini: 'Mini wyzwanie zostało utworzone (demo: zapisano w logu).',
      };
    }
    return {
      createdMini: 'Mini challenge created (demo: saved to log).',
    };
  }, [language]);

  const microJobs = useMemo(() => (jobs || []).filter(isMicroJob), [jobs]);
  const standardJobs = useMemo(() => (jobs || []).filter((job) => !isMicroJob(job)), [jobs]);
  const importedJobs = useMemo(
    () => standardJobs.filter((job) => isImportedListing(job)),
    [standardJobs]
  );
  const nativeJobs = useMemo(
    () => standardJobs.filter((job) => !isImportedListing(job)),
    [standardJobs]
  );
  const effectiveSearchMode = searchDiagnostics?.search_mode || 'discovery_default';
  const laneScopedJobs = useMemo(() => {
    if (discoveryMode === 'micro_jobs') {
      return microJobs;
    }

    if (effectiveSearchMode === 'manual_query') {
      if (lane === 'imports') {
        return standardJobs.filter((job) => isImportedListing(job));
      }
      return standardJobs;
    }

    if (lane === 'imports') {
      return importedJobs;
    }

    return [...nativeJobs, ...importedJobs, ...microJobs];
  }, [discoveryMode, effectiveSearchMode, importedJobs, lane, microJobs, nativeJobs, standardJobs]);

  useEffect(() => {
    if (discoveryMode !== 'all') return;
    if (lane !== 'challenges') return;
    if (nativeJobs.length > 0) return;
    if (importedJobs.length === 0) return;
    setLane('imports');
  }, [discoveryMode, importedJobs.length, lane, nativeJobs.length, setLane]);

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
  const isMobileViewport = !isDesktopViewport;

  useEffect(() => {
    if (!selectedJobId) return;
    if (selectedJob) return;
    handleJobSelect(null);
  }, [handleJobSelect, selectedJob, selectedJobId]);

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
    }
  }, [isMobileViewport]);

  useEffect(() => {
    if (embeddedInCareerOS) {
      return undefined;
    }
    const root = document.documentElement;
    root.style.setProperty('--app-atmosphere-image', 'none');
    root.style.setProperty('--app-atmosphere-opacity', '0');
    root.style.setProperty('--app-atmosphere-blur', '0');
    root.style.setProperty(
      '--app-atmosphere-overlay-light',
      'linear-gradient(180deg, rgba(255,255,255,0.62), transparent 22%), linear-gradient(rgba(16,32,51,0.038) 1px, transparent 1px), linear-gradient(90deg, rgba(16,32,51,0.038) 1px, transparent 1px), linear-gradient(180deg, rgba(243,246,251,0.96) 0%, rgba(239,244,250,0.98) 100%)'
    );
    root.style.setProperty(
      '--app-atmosphere-overlay-dark',
      'radial-gradient(circle at 16% 10%, rgba(var(--accent-rgb), 0.08), transparent 22%), linear-gradient(180deg, rgba(6, 13, 20, 0.68) 0%, rgba(6, 13, 20, 0.82) 100%)'
    );

    return () => {
      root.style.setProperty('--app-atmosphere-image', 'none');
      root.style.setProperty('--app-atmosphere-opacity', '0');
      root.style.setProperty('--app-atmosphere-blur', '96px');
      root.style.setProperty(
        '--app-atmosphere-overlay-light',
        'linear-gradient(180deg, rgba(243, 246, 251, 0.82) 0%, rgba(243, 246, 251, 0.9) 36%, rgba(243, 246, 251, 0.96) 100%)'
      );
      root.style.setProperty(
        '--app-atmosphere-overlay-dark',
        'linear-gradient(180deg, rgba(6, 13, 20, 0.7) 0%, rgba(6, 13, 20, 0.82) 36%, rgba(6, 13, 20, 0.92) 100%)'
      );
    };
  }, []);


  return (
    <section
      className={cn(
        'relative overflow-visible',
        embeddedInCareerOS
          ? 'min-h-full bg-transparent'
          : 'app-shell-bg app-shell-bg-clean min-h-[calc(100dvh-var(--app-header-height))]'
      )}
    >
      <div className={cn(
        'relative mx-auto flex h-full w-full flex-col px-3 pb-4 pt-2 sm:px-4 sm:pt-2.5 lg:px-5 lg:pt-3',
        embeddedInCareerOS ? 'max-w-[1720px]' : 'max-w-[1720px]'
      )}>
        <div className={cn(
          "grid flex-1 items-start transition-all duration-300",
          showSidebar ? "gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5" : "gap-4"
        )}>
          {showSidebar && !isMobileViewport && (
            <div className="h-full lg:self-start">
              <ChallengeSidebar
                userProfile={userProfile}
                lane={lane}
                setLane={setLane}
                discoveryMode={discoveryMode}
                setDiscoveryMode={setDiscoveryMode}
                filterMinSalary={filterMinSalary}
                setFilterMinSalary={setFilterMinSalary}
                filterBenefits={filterBenefits}
                setFilterBenefits={setFilterBenefits}
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

          <div className="app-workspace-stage app-workspace-stage-flat min-w-0 p-0">
            <div className="space-y-4 rounded-[calc(var(--radius-hero)+2px)] px-1 pb-6 sm:px-2">
              <ChallengeFeedWorkspace
                jobs={laneScopedJobs}
                selectedJobId={selectedJobId}
                savedJobIds={savedJobIds}
                locale={locale}
                userProfile={userProfile}
                searchDiagnostics={searchDiagnostics}
                totalCount={totalCount}
                isLoadingJobs={isLoadingJobs}
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
              embeddedVariant={embeddedVariant}
            />
          </div>
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
      {showSidebar && mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-[rgba(8,12,10,0.44)] backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="h-full w-[min(88vw,360px)] overflow-y-auto bg-[var(--surface-cosmic-strong)] p-4 shadow-[var(--shadow-overlay)]"
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
              filterBenefits={filterBenefits}
              setFilterBenefits={setFilterBenefits}
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
    </section>
  );
};

export default ChallengeControlCenter;
