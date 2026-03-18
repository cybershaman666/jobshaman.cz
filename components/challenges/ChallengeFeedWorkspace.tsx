import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Job, SearchDiagnosticsMeta, UserProfile } from '../../types';
import ChallengeEditorialFeed from './ChallengeEditorialFeed';
import MiniChallengesRail from './MiniChallengesRail';
import MobileSwipeJobBrowser from '../MobileSwipeJobBrowser';
import { FilterChip, SurfaceCard } from '../ui/primitives';
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
}) => {
  const { t, i18n } = useTranslation();
  const [mobileMode, setMobileMode] = React.useState<'swipe' | 'feed'>('swipe');
  const activeLocale = String(i18n.resolvedLanguage || i18n.language || locale || 'en');

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

  return (
    <div className="space-y-6 lg:space-y-7">
      {isMobileViewport ? (
        <div className="space-y-4 lg:hidden">
          <SurfaceCard className="space-y-4 rounded-[18px] border-[var(--border)] bg-white shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)] dark:border-[rgba(255,255,255,0.08)] dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="app-eyebrow w-fit">
                  <Sparkles size={12} />
                  {copy.swipeTitle}
                </div>
                <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.swipeBody}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={mobileMode === 'swipe'} onClick={() => setMobileMode('swipe')}>
                  {copy.swipe}
                </FilterChip>
                <FilterChip active={mobileMode === 'feed'} onClick={() => setMobileMode('feed')}>
                  {copy.feed}
                </FilterChip>
              </div>
            </div>

            {showAuthPrompt ? (
              <div className="flex flex-col gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] p-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-white/5">
                <p className="text-sm leading-6 text-[var(--text)]">{copy.authBody}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="app-button-primary app-organic-cta" onClick={() => onOpenAuth('register')}>
                    <Sparkles size={15} />
                    {copy.authCta}
                  </button>
                  <button type="button" className="app-button-secondary" onClick={() => setMobileMode('swipe')}>
                    {copy.later}
                  </button>
                </div>
              </div>
            ) : null}

            {showAddressPrompt ? (
              <div className="flex flex-col gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] p-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-white/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                  <MapPin size={16} className="text-[var(--accent)]" />
                  {copy.addressTitle}
                </div>
                <p className="text-sm leading-6 text-[var(--text)]">{copy.addressBody}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="app-button-primary app-organic-cta" onClick={onOpenProfile}>
                    {copy.addressCta}
                  </button>
                  <button type="button" className="app-button-secondary" onClick={() => setMobileMode('swipe')}>
                    {copy.later}
                  </button>
                </div>
              </div>
            ) : null}
          </SurfaceCard>

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
              theme="light"
              fullscreen={true}
            />
          ) : null}
        </div>
      ) : null}

      <div className={isMobileViewport && mobileMode === 'swipe' ? 'hidden lg:block' : ''}>
        <SurfaceCard className="mb-5 rounded-[18px] border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="app-eyebrow w-fit">
                <Sparkles size={12} />
                {copy.aiTitle}
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{copy.aiBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {copy.aiBullets.map((item) => (
                <FilterChip key={item} active>
                  {item}
                </FilterChip>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <div className="relative rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)]">
          <ChallengeEditorialFeed
            jobs={jobs}
            loading={isLoadingJobs}
            selectedJobId={selectedJobId}
            savedJobIds={savedJobIds}
            locale={activeLocale}
            compactLayout={useCompactSearchLayout}
            onSelect={(jobId: string) => handleJobSelect(jobId)}
            onOpen={(jobId: string) => handleJobSelect(jobId)}
            onToggleSave={(jobId: string) => handleToggleSave(jobId)}
          />
        </div>

        {hasMore || totalCount > jobs.length ? (
          <SurfaceCard className="rounded-[18px] border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm leading-6 text-[var(--text-muted)]">
                {`${Math.min(jobs.length, totalCount)} / ${Math.max(totalCount, jobs.length)}`}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="app-button-secondary"
                  disabled={currentPage === 0}
                  onClick={() => goToPage(Math.max(0, currentPage - 1))}
                >
                  {t('workspace.feed.previous_page', { defaultValue: 'Předchozí' })}
                </button>
                <button
                  type="button"
                  className="app-button-primary app-organic-cta"
                  disabled={loadingMore || !hasMore}
                  onClick={loadMoreJobs}
                >
                  {loadingMore
                    ? t('workspace.feed.loading_more', { defaultValue: 'Načítám další nabídky…' })
                    : t('workspace.feed.load_more', { defaultValue: 'Načíst další nabídky' })}
                </button>
                <button
                  type="button"
                  className="app-button-secondary"
                  disabled={!hasMore}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  {t('workspace.feed.next_page', { defaultValue: 'Další stránka' })}
                </button>
              </div>
            </div>
            <div className="mt-2 text-xs text-[var(--text-faint)]">
              {t('workspace.feed.page_status', {
                defaultValue: `Strana ${currentPage + 1}, velikost dávky ${pageSize}`,
                page: currentPage + 1,
                pageSize,
              })}
            </div>
          </SurfaceCard>
        ) : null}

        <MiniChallengesRail
          jobs={jobs}
          onOpen={(jobId) => handleJobSelect(jobId)}
          onSelect={(jobId) => handleJobSelect(jobId)}
          selectedJobId={selectedJobId}
          locale={activeLocale}
          onCreateTask={onCreateMiniChallenge}
          hidePostBtn={true}
          postInfo={
            <div className="max-w-[160px] text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              {copy.postLead}{' '}
              <button onClick={onOpenProfile} className="text-teal-600 hover:underline">
                {copy.profile}
              </button>{' '}
              {copy.postTail}
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ChallengeFeedWorkspace;
