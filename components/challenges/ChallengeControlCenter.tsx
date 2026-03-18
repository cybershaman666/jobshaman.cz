import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/primitives';
import { computeCandidateAnnotations } from '../../services/candidateIntentService';
import { Job, SearchDiagnosticsMeta, UserProfile } from '../../types';
import ChallengeHandshakeCard from './ChallengeHandshakeCard';
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


  return (
    <section
      style={forestAccentStyle}
      className="relative min-h-[calc(100dvh-var(--app-header-height))] overflow-hidden bg-[var(--bg)] dark:bg-slate-950"
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -z-10',
          'bg-[linear-gradient(180deg,#f7f9fc_0%,#f4f7fb_100%)]',
          'dark:bg-slate-950'
        )}
      />

      <div className="flex h-full w-full flex-col px-0 py-3 lg:px-3">
        <div className={cn(
          "grid flex-1 items-start transition-all duration-300",
          "gap-5 lg:grid-cols-[312px_minmax(0,1fr)] lg:gap-7"
        )}>
          {!isMobileViewport && (
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

          <div className="h-full overflow-y-auto space-y-4 pb-6">
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
