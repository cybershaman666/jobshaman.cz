import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Job, SearchDiagnosticsMeta, UserProfile } from '../../types';
import { getMainDatabaseJobCount } from '../../services/jobService';
import ChallengeEditorialFeed from './ChallengeEditorialFeed';
import MiniChallengesRail from './MiniChallengesRail';
import MobileSwipeJobBrowser from '../MobileSwipeJobBrowser';
import { Button, FilterChip, MetricTile, SectionPanel, SurfaceCard } from '../ui/primitives';
import { MapPin, Sparkles } from 'lucide-react';

interface ChallengeFeedWorkspaceProps {
  jobs: Job[];
  selectedJobId: string | null;
  savedJobIds: string[];
  locale: string;
  userProfile: UserProfile;
  searchDiagnostics: SearchDiagnosticsMeta | null;
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
  onOpenProfile: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => Promise<void> | void;
  onCreateMiniChallenge: () => void;
  isMobileViewport?: boolean;
  embeddedVariant?: 'default' | 'career_map_offers';
}

const ChallengeFeedWorkspace: React.FC<ChallengeFeedWorkspaceProps> = ({
  jobs,
  selectedJobId,
  savedJobIds,
  locale,
  userProfile,
  searchDiagnostics,
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
  onOpenProfile,
  onOpenAuth,
  onCreateMiniChallenge,
  isMobileViewport = false,
  embeddedVariant = 'default',
}) => {
  const { t, i18n } = useTranslation();
  const [mobileMode, setMobileMode] = React.useState<'swipe' | 'feed'>('swipe');
  const [databaseJobCount, setDatabaseJobCount] = React.useState<number | null>(null);
  const [liveCandidateDelta, setLiveCandidateDelta] = React.useState(0);
  const activeLocale = String(i18n.resolvedLanguage || i18n.language || locale || 'en');
  const dbCountCacheKey = 'jobshaman:workspace:global-job-count';

  const copy = {
    postLead: t('workspace.feed.post_lead'),
    profile: t('workspace.feed.profile'),
    postTail: t('workspace.feed.post_tail'),
    swipe: t('workspace.feed.swipe'),
    feed: t('workspace.feed.feed'),
    swipeTitle: t('workspace.feed.swipe_title'),
    swipeBody: t('workspace.feed.swipe_body'),
    aiTitle: t('workspace.feed.ai_title'),
    aiBody: t('workspace.feed.ai_body'),
    aiBullets: t('workspace.feed.ai_bullets', { returnObjects: true }) as string[],
    authBody: t('workspace.feed.auth_body'),
    addressTitle: t('workspace.feed.address_title'),
    addressBody: t('workspace.feed.address_body'),
    authCta: t('workspace.feed.auth_cta'),
    addressCta: t('workspace.feed.address_cta'),
    later: t('workspace.feed.later'),
  };

  const hasAddress = Boolean(userProfile.address || userProfile.coordinates?.lat);
  const showAuthPrompt = isMobileViewport && !userProfile.isLoggedIn;
  const showAddressPrompt = isMobileViewport && userProfile.isLoggedIn && !hasAddress;
  const useCompactSearchLayout = searchDiagnostics?.search_mode === 'manual_query';
  const shouldUseCompactEditorialLayout = !isMobileViewport || useCompactSearchLayout;
  const isCareerMapOffersMode = embeddedVariant === 'career_map_offers';
  React.useEffect(() => {
    let cancelled = false;

    try {
      const cached = window.sessionStorage.getItem(dbCountCacheKey);
      if (cached) {
        const parsed = Number(cached);
        if (Number.isFinite(parsed) && parsed >= 0) {
          setDatabaseJobCount(parsed);
        }
      }
    } catch {
      // Ignore storage issues and continue with live fetch.
    }

    void getMainDatabaseJobCount()
      .then((count) => {
        if (cancelled || !Number.isFinite(count) || count < 0) return;
        setDatabaseJobCount(count);
        try {
          window.sessionStorage.setItem(dbCountCacheKey, String(count));
        } catch {
          // Ignore storage issues.
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDatabaseJobCount((current) => current ?? 0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dbCountCacheKey]);

  const visibleJobsCount = Math.max(0, databaseJobCount ?? 0);
  const formattedJobsCount = React.useMemo(
    () => (databaseJobCount === null ? '...' : new Intl.NumberFormat(activeLocale).format(visibleJobsCount)),
    [activeLocale, visibleJobsCount]
  );
  const simulatedActiveCandidates = React.useMemo(() => {
    const now = new Date();
    const daySeed = Number(
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    );
    const base = 16 + (daySeed % 8);
    const trafficLift = Math.min(22, Math.floor(visibleJobsCount / 320));
    const hour = now.getHours();
    const hourAdjustment = hour >= 20
      ? -7
      : hour >= 18
        ? -4
        : hour >= 9 && hour <= 17
          ? 3
          : hour >= 6 && hour < 9
            ? 1
            : -2;
    const weekendAdjustment = now.getDay() === 0 || now.getDay() === 6 ? -3 : 0;
    return Math.max(8, base + trafficLift + hourAdjustment + weekendAdjustment);
  }, [visibleJobsCount]);
  React.useEffect(() => {
    const intervalMs = 45_000 + Math.floor(Math.random() * 20_000);
    const intervalId = window.setInterval(() => {
      setLiveCandidateDelta((current) => {
        const drift = Math.random() < 0.55 ? 1 : -1;
        const next = current + drift;
        if (next > 4) return 3;
        if (next < -4) return -3;
        return next;
      });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);
  const liveCandidatesNow = Math.max(6, simulatedActiveCandidates + liveCandidateDelta);
  const formattedActiveCandidates = React.useMemo(
    () => new Intl.NumberFormat(activeLocale).format(liveCandidatesNow),
    [activeLocale, liveCandidatesNow]
  );
  const mobileSupportPanel = showAuthPrompt ? (
    <SurfaceCard className="space-y-3" variant="spatial" tone="muted">
      <div className="app-eyebrow w-fit">
        <Sparkles size={12} />
        {copy.aiTitle}
      </div>
      <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.authBody}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="hero" onClick={() => onOpenAuth('register')}>
          <Sparkles size={15} />
          {copy.authCta}
        </Button>
        <Button variant="quiet" onClick={() => setMobileMode('swipe')}>
          {copy.later}
        </Button>
      </div>
    </SurfaceCard>
  ) : showAddressPrompt ? (
    <SurfaceCard className="space-y-3" variant="spatial" tone="muted">
      <div className="app-eyebrow w-fit">
        <MapPin size={12} />
        {copy.addressTitle}
      </div>
      <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.addressBody}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="hero" onClick={onOpenProfile}>
          {copy.addressCta}
        </Button>
        <Button variant="quiet" onClick={() => setMobileMode('swipe')}>
          {copy.later}
        </Button>
      </div>
    </SurfaceCard>
  ) : (
    <SurfaceCard className="space-y-3" variant="spatial">
      <div className="app-eyebrow w-fit">
        <Sparkles size={12} />
        {copy.aiTitle}
      </div>
      <p className="text-sm leading-6 text-[var(--text-muted)]">
        {copy.postLead}{' '}
        <button type="button" onClick={onOpenProfile} className="font-semibold text-[var(--accent)] hover:text-[var(--text-strong)]">
          {copy.profile}
        </button>{' '}
        {copy.postTail}
      </p>
    </SurfaceCard>
  );
  const paginationPanel = hasMore || totalCount > jobs.length ? (
    <SectionPanel className="space-y-3" variant="dock">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm leading-6 text-[var(--text-muted)]">
          {`${Math.min(jobs.length, totalCount)} / ${Math.max(totalCount, jobs.length)}`}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="quiet"
            disabled={currentPage === 0}
            onClick={() => goToPage(Math.max(0, currentPage - 1))}
          >
            {t('workspace.feed.previous_page', { defaultValue: 'Předchozí' })}
          </Button>
          <Button
            variant="hero"
            disabled={loadingMore || !hasMore}
            onClick={loadMoreJobs}
          >
            {loadingMore
              ? t('workspace.feed.loading_more', { defaultValue: 'Načítám další nabídky…' })
              : t('workspace.feed.load_more', { defaultValue: 'Načíst další nabídky' })}
          </Button>
          <Button
            variant="quiet"
            disabled={!hasMore}
            onClick={() => goToPage(currentPage + 1)}
          >
            {t('workspace.feed.next_page', { defaultValue: 'Další stránka' })}
          </Button>
        </div>
      </div>
      <div className="mt-2 text-xs text-[var(--text-faint)]">
        {t('workspace.feed.page_status', {
          defaultValue: `Strana ${currentPage + 1}, velikost dávky ${pageSize}`,
          page: currentPage + 1,
          pageSize,
        })}
      </div>
    </SectionPanel>
  ) : null;

  const statsPanel = (
    <div className="grid gap-3 sm:grid-cols-2 xl:max-w-[540px]">
      <MetricTile
        label={t('workspace.feed.stats_jobs_label', { defaultValue: 'V databázi právě máme' })}
        value={formattedJobsCount}
        helper={t('workspace.feed.stats_jobs_body', { defaultValue: 'aktivních nabídek.' })}
        tone="muted"
        className="h-full border-[rgba(16,32,51,0.08)] bg-[rgba(255,255,255,0.82)] shadow-[0_18px_34px_-26px_rgba(16,32,51,0.14)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(10,17,25,0.66)]"
      />
      <MetricTile
        label={t('workspace.feed.stats_live_label', { defaultValue: 'Právě ve výzvách' })}
        value={(
          <div className="flex items-center gap-2 text-[var(--text-strong)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.14)] animate-pulse" />
            <span className="text-[var(--text-strong)]">{formattedActiveCandidates}</span>
          </div>
        )}
        helper={t('workspace.feed.stats_live_body', { defaultValue: 'Počet uchazečů online' })}
        tone="muted"
        className="h-full border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(255,255,255,0.84)] text-[var(--text-strong)] shadow-[0_18px_34px_-26px_rgba(16,32,51,0.14)] dark:!border-cyan-500/30 dark:!bg-none dark:!bg-slate-900 dark:text-slate-100 dark:shadow-[0_18px_34px_-24px_rgba(8,145,178,0.32)]"
      />
    </div>
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      {isMobileViewport ? (
        <div className="space-y-4 lg:hidden">
          {!isCareerMapOffersMode ? statsPanel : null}
          <div className="flex flex-wrap gap-2">
            <FilterChip active={mobileMode === 'swipe'} onClick={() => setMobileMode('swipe')}>
              {copy.swipe}
            </FilterChip>
            <FilterChip active={mobileMode === 'feed'} onClick={() => setMobileMode('feed')}>
              {copy.feed}
            </FilterChip>
          </div>

          {mobileMode === 'swipe' ? (
            <MobileSwipeJobBrowser
              jobs={jobs}
              swipeStateStorageKey={`mobile-feed:${activeLocale}:${userProfile.id || 'guest'}`}
              savedJobIds={savedJobIds}
              userProfile={userProfile}
              onToggleSave={(jobId) => handleToggleSave(jobId)}
              onOpenDetails={(jobId) => handleJobSelect(jobId)}
              onSwitchToList={() => setMobileMode('feed')}
              onOpenAuth={onOpenAuth}
              onOpenProfile={onOpenProfile}
              isLoadingMore={loadingMore}
              isLoading={false}
              hasMore={hasMore}
              onLoadMore={loadMoreJobs}
              fullscreen={true}
            />
          ) : null}
        </div>
      ) : null}

      <div className={isMobileViewport && mobileMode === 'swipe' ? 'hidden lg:block' : ''}>
        {isMobileViewport ? (
          <div className="space-y-4">
            <div className="space-y-4">
              <ChallengeEditorialFeed
                jobs={jobs}
                loading={isLoadingJobs}
                selectedJobId={selectedJobId}
                savedJobIds={savedJobIds}
                locale={activeLocale}
                compactLayout={shouldUseCompactEditorialLayout}
                embeddedVariant={embeddedVariant}
                onSelect={(jobId: string) => handleJobSelect(jobId)}
                onOpen={(jobId: string) => handleJobSelect(jobId)}
                onToggleSave={(jobId: string) => handleToggleSave(jobId)}
              />
            </div>

            {!isCareerMapOffersMode && mobileMode === 'feed' ? mobileSupportPanel : null}
            {!isCareerMapOffersMode ? paginationPanel : null}

            {!isCareerMapOffersMode ? (
              <MiniChallengesRail
                jobs={jobs}
                onOpen={(jobId) => handleJobSelect(jobId)}
                onSelect={(jobId) => handleJobSelect(jobId)}
                selectedJobId={selectedJobId}
                locale={activeLocale}
                onCreateTask={onCreateMiniChallenge}
                hidePostBtn={true}
                postInfo={
                  <div className="max-w-[160px] text-[10px] leading-tight text-[var(--text-faint)]">
                    {copy.postLead}{' '}
                    <button type="button" onClick={onOpenProfile} className="text-[var(--accent)] hover:underline">
                      {copy.profile}
                    </button>{' '}
                    {copy.postTail}
                  </div>
                }
              />
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {!isCareerMapOffersMode ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,540px)_minmax(420px,1fr)] xl:items-start">
                {statsPanel}
                {mobileSupportPanel}
              </div>
            ) : null}

            <div className="space-y-4">
              <ChallengeEditorialFeed
                jobs={jobs}
                loading={isLoadingJobs}
                selectedJobId={selectedJobId}
                savedJobIds={savedJobIds}
                locale={activeLocale}
                compactLayout={shouldUseCompactEditorialLayout}
                embeddedVariant={embeddedVariant}
                onSelect={(jobId: string) => handleJobSelect(jobId)}
                onOpen={(jobId: string) => handleJobSelect(jobId)}
                onToggleSave={(jobId: string) => handleToggleSave(jobId)}
              />
            </div>

            {!isCareerMapOffersMode ? paginationPanel : null}

            {!isCareerMapOffersMode ? (
              <MiniChallengesRail
                jobs={jobs}
                onOpen={(jobId) => handleJobSelect(jobId)}
                onSelect={(jobId) => handleJobSelect(jobId)}
                selectedJobId={selectedJobId}
                locale={activeLocale}
                onCreateTask={onCreateMiniChallenge}
                hidePostBtn={true}
                postInfo={
                  <div className="max-w-[160px] text-[10px] leading-tight text-[var(--text-faint)]">
                    {copy.postLead}{' '}
                    <button type="button" onClick={onOpenProfile} className="text-[var(--accent)] hover:underline">
                      {copy.profile}
                    </button>{' '}
                    {copy.postTail}
                  </div>
                }
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChallengeFeedWorkspace;
