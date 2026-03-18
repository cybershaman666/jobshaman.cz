import React, { useState, useRef, useEffect } from 'react';
import { Job, UserProfile } from '../types';
import { Bookmark, X, Check, ChevronDown, Sparkles, List, Activity, Clock, MapPin, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { trackJobInteraction } from '../services/jobInteractionService';
import { matchesBrigadaKeywords, matchesFullTimeKeywords, matchesIcoKeywords, matchesPartTimeKeywords } from '../utils/contractType';
import { cn } from './ui/primitives';

interface MobileSwipeJobBrowserProps {
    jobs: Job[];
    swipeStateStorageKey: string;
    savedJobIds: string[];
    userProfile: UserProfile;
    onToggleSave: (jobId: string, options?: { source?: string; position?: number }) => void;
    onRejectJob?: (jobId: string) => void;
    onOpenDetails: (jobId: string) => void;
    onSwitchToList: () => void;
    onOpenAuth?: (mode?: 'login' | 'register') => Promise<void> | void;
    onOpenProfile?: () => void;
    isLoadingMore: boolean;
    isLoading?: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    theme: 'light' | 'dark';
    fullscreen?: boolean;
}

interface SwipeState {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
    gesture: 'idle' | 'pending' | 'swipe' | 'scroll';
}

const SWIPE_LOCATION_REFRESH_SIGNAL_KEY = 'jobshaman_swipe_location_refresh_signal';

const formatRelativePostedAt = (job: Job, locale: string): string => {
    const source = String(job.scrapedAt || job.postedAt || '').trim();
    if (!source) return '';

    const parsedDate = new Date(source);
    if (Number.isNaN(parsedDate.getTime())) return '';

    const diffSeconds = Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / 1000));
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (diffSeconds < 60) return rtf.format(0, 'second');
    if (diffSeconds < 3600) return rtf.format(-Math.floor(diffSeconds / 60), 'minute');
    if (diffSeconds < 86400) return rtf.format(-Math.floor(diffSeconds / 3600), 'hour');
    if (diffSeconds < 604800) return rtf.format(-Math.floor(diffSeconds / 86400), 'day');
    if (diffSeconds < 2_629_800) return rtf.format(-Math.floor(diffSeconds / 604800), 'week');
    return rtf.format(-Math.floor(diffSeconds / 2_629_800), 'month');
};

const buildWhyReasons = (job: Job, t: (key: string, options?: any) => string): string[] => {
    const reasons: string[] = [];

    if (Array.isArray(job.matchReasons) && job.matchReasons.length > 0) {
        for (const reason of job.matchReasons) {
            const text = String(reason || '').trim();
            if (text) reasons.push(text);
        }
    }

    const distance = Number(job.distanceKm ?? 0);
    if (Number.isFinite(distance) && distance > 0 && distance < 40) {
        reasons.push(t('job.why_distance', { defaultValue: `Dojezd ${Math.round(distance)} km`, distance: Math.round(distance) }));
    }

    if ((job.type || '').toLowerCase() === 'remote') {
        reasons.push(t('job.why_remote', { defaultValue: 'Remote režim' }));
    } else if ((job.type || '').toLowerCase() === 'hybrid' || (job.work_model || '').toLowerCase() === 'hybrid') {
        reasons.push(t('job.why_hybrid', { defaultValue: 'Hybridní režim' }));
    }

    const score = Math.round(Number(job.jhi?.score || 0));
    if (score >= 60) {
        reasons.push(t('job.why_jhi', { defaultValue: `Silný JHI (${score})`, score }));
    }

    return Array.from(new Set(reasons)).slice(0, 3);
};

const MobileSwipeJobBrowser: React.FC<MobileSwipeJobBrowserProps> = ({
    jobs,
    swipeStateStorageKey,
    savedJobIds,
    userProfile,
    onToggleSave,
    onRejectJob,
    onOpenDetails,
    onSwitchToList,
    onOpenAuth,
    onOpenProfile,
    isLoadingMore,
    isLoading = false,
    hasMore,
    onLoadMore,
    theme,
    fullscreen = false
}) => {
    const { t, i18n } = useTranslation();
    void theme;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [processedJobIds, setProcessedJobIds] = useState<string[]>([]);
    const [swipeState, setSwipeState] = useState<SwipeState>({
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        isDragging: false,
        gesture: 'idle'
    });
    const [showSwipeCoach, setShowSwipeCoach] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const [exitAnimation, setExitAnimation] = useState<'left' | 'right' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gestureRef = useRef<SwipeState['gesture']>('idle');
    const justSwipedRef = useRef(false);
    const sessionIdRef = useRef(`swipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const viewStartRef = useRef<number | null>(null);
    const lastImpressionJobIdRef = useRef<string | null>(null);
    const hasInteractedThisSessionRef = useRef(false);
    const previousRemainingJobsCountRef = useRef<number | null>(null);
    const processedJobIdsSet = new Set(processedJobIds);
    const swipeStateKey = `jobshaman_swipe_state:${swipeStateStorageKey}`;
    const swipeCoachKey = `jobshaman_swipe_coach_v2:${swipeStateStorageKey}`;
    const isLoggedIn = Boolean(userProfile?.isLoggedIn);
    const hasAddress = Boolean(userProfile?.address || userProfile?.coordinates?.lat || userProfile?.coordinates?.lon);
    const needsRegistration = !isLoggedIn;
    const needsAddress = isLoggedIn && !hasAddress;
    const coachTitle = needsRegistration
        ? t('job.swipe_coach_title_register', { defaultValue: 'Swipe je připravený. Ještě mu dejte kontext.' })
        : needsAddress
            ? t('job.swipe_coach_title_address', { defaultValue: 'Swipe bude mnohem chytřejší s adresou.' })
            : t('job.swipe_tutorial_title');
    const coachBody = needsRegistration
        ? t('job.swipe_coach_body_register', { defaultValue: 'Pár prvních swipů funguje i bez účtu, ale po registraci si AI začne pamatovat, co ukládáte, odmítáte a co je opravdu blízko vašemu životu.' })
        : needsAddress
            ? t('job.swipe_coach_body_address', { defaultValue: 'Bez adresy AI hůř odhadne okolí a dojezd. Po doplnění lokace se feed přeskupí mnohem víc podle reality kolem vás.' })
            : t('job.swipe_tutorial_desc');
    const coachSignal = needsRegistration
        ? t('job.swipe_coach_signal_register', { defaultValue: 'Registrace odemyká paměť swipe a lepší doporučování.' })
        : needsAddress
            ? t('job.swipe_coach_signal_address', { defaultValue: 'Adresa odemyká lokální relevance a realističtější dojezd.' })
            : t('job.swipe_coach_signal_default', { defaultValue: 'AI se učí z každého swipe, otevření detailu i uložení.' });
    const coachPrimaryCta = needsRegistration
        ? t('job.swipe_coach_cta_register', { defaultValue: 'Registrovat a zpřesnit feed' })
        : needsAddress
            ? t('job.swipe_coach_cta_address', { defaultValue: 'Doplnit adresu' })
            : t('job.swipe_tutorial_cta');
    const coachSecondaryCta = t('job.swipe_coach_cta_secondary', { defaultValue: 'Pokračovat do swipe' });

    const findNextUnprocessedIndex = (
        sourceJobs: Job[],
        processedSet: Set<string>,
        startIndex: number
    ): number => {
        const safeStart = Math.max(0, startIndex);
        for (let i = safeStart; i < sourceJobs.length; i += 1) {
            if (!processedSet.has(sourceJobs[i].id)) {
                return i;
            }
        }
        return sourceJobs.length;
    };

    const reviewedCount = jobs.reduce((count, job) => (
        processedJobIdsSet.has(job.id) ? count + 1 : count
    ), 0);
    const displayPosition = jobs.length > 0 ? Math.min(reviewedCount + 1, jobs.length) : 0;

    const currentJob = currentIndex < jobs.length && !processedJobIdsSet.has(jobs[currentIndex].id)
        ? jobs[currentIndex]
        : undefined;
    const relativePostedAt = currentJob ? formatRelativePostedAt(currentJob, i18n.language || 'en-US') : '';
    const whyReasons = currentJob ? buildWhyReasons(currentJob, t) : [];
    const isSaved = currentJob && savedJobIds.includes(currentJob.id);
    const jhiScore = currentJob?.jhi?.score;
    const aiMatchScore = null;
    const dragDelta = Math.abs(swipeState.currentX - swipeState.startX);
    const isTap = !swipeState.isDragging && dragDelta < 10;

    useEffect(() => {
        gestureRef.current = swipeState.gesture;
    }, [swipeState.gesture]);

    // React touch events can be passive in modern React builds, which makes `preventDefault`
    // unreliable. Add a non-passive listener to prevent vertical scroll while a swipe gesture
    // is in progress.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onTouchMove = (event: TouchEvent) => {
            if (gestureRef.current === 'swipe') {
                event.preventDefault();
            }
        };

        el.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => {
            el.removeEventListener('touchmove', onTouchMove);
        };
    }, []);

    const formatJobTypeLabel = (raw?: string) => {
        if (!raw) return t('job.contract_types.unknown');
        if (matchesIcoKeywords(raw)) return t('job.contract_types.ico');
        if (matchesFullTimeKeywords(raw)) return t('job.contract_types.hpp');
        if (matchesPartTimeKeywords(raw)) return t('job.contract_types.part_time');
        if (matchesBrigadaKeywords(raw)) return t('job.contract_types.brigada');
        return raw;
    };

    const currentRecommendationMeta = () => ({
        request_id: (currentJob as any)?.aiRecommendationRequestId,
        scoring_version: (currentJob as any)?.aiMatchScoringVersion,
        model_version: (currentJob as any)?.aiMatchModelVersion,
        score: (currentJob as any)?.aiMatchScore,
        position: (currentJob as any)?.aiRecommendationPosition,
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const hasSeen = window.localStorage.getItem(swipeCoachKey);
        if (!hasSeen) {
            setShowSwipeCoach(true);
        }
    }, [swipeCoachKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!hasAddress) return;

        try {
            const raw = window.localStorage.getItem(SWIPE_LOCATION_REFRESH_SIGNAL_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as { ts?: number; address?: string; userId?: string } | null;
            if (!parsed?.ts || Date.now() - parsed.ts > 10 * 60 * 1000) {
                window.localStorage.removeItem(SWIPE_LOCATION_REFRESH_SIGNAL_KEY);
                return;
            }
            if ((parsed.userId || 'guest') !== (userProfile.id || 'guest')) {
                return;
            }

            const message = t('job.swipe_refresh_message', {
                defaultValue: 'AI feed se právě přeskupil podle vaší lokality a reálného okolí.',
            });
            setRefreshMessage(message);
            window.localStorage.removeItem(SWIPE_LOCATION_REFRESH_SIGNAL_KEY);
        } catch (error) {
            console.warn('Failed to read swipe location refresh signal:', error);
        }
    }, [hasAddress, t, userProfile.id]);

    useEffect(() => {
        if (!refreshMessage) return;
        const timeoutId = window.setTimeout(() => setRefreshMessage(null), 4200);
        return () => window.clearTimeout(timeoutId);
    }, [refreshMessage]);

    const closeSwipeCoach = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(swipeCoachKey, '1');
        }
        setShowSwipeCoach(false);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(swipeStateKey);
            if (!raw) {
                setCurrentIndex(0);
                setProcessedJobIds([]);
                return;
            }
            const parsed = JSON.parse(raw);
            const storedIndex = Number(parsed?.currentIndex);
            const storedProcessed = Array.isArray(parsed?.processedJobIds)
                ? parsed.processedJobIds.filter((id: unknown): id is string => typeof id === 'string')
                : [];
            setProcessedJobIds(Array.from(new Set(storedProcessed)));
            setCurrentIndex(Number.isFinite(storedIndex) && storedIndex >= 0 ? storedIndex : 0);
        } catch (error) {
            console.warn('Failed to restore swipe state:', error);
            setCurrentIndex(0);
            setProcessedJobIds([]);
        }
    }, [swipeStateKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                swipeStateKey,
                JSON.stringify({
                    currentIndex,
                    processedJobIds
                })
            );
        } catch (error) {
            console.warn('Failed to persist swipe state:', error);
        }
    }, [swipeStateKey, currentIndex, processedJobIds]);

    useEffect(() => {
        let nextIndex = findNextUnprocessedIndex(jobs, processedJobIdsSet, currentIndex);
        if (nextIndex >= jobs.length) {
            nextIndex = findNextUnprocessedIndex(jobs, processedJobIdsSet, 0);
        }
        if (nextIndex !== currentIndex) {
            setCurrentIndex(nextIndex);
        }
    }, [jobs, currentIndex, processedJobIds]);

    // Keyboard support
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') handleReject();
            if (e.key === 'ArrowRight') handleSave();
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentIndex, jobs.length]);

    // Track impressions when the current job changes
    useEffect(() => {
        if (!currentJob) return;
        if (lastImpressionJobIdRef.current === currentJob.id) return;

        lastImpressionJobIdRef.current = currentJob.id;
        viewStartRef.current = Date.now();

        trackJobInteraction({
            jobId: currentJob.id,
            eventType: 'impression',
            sessionId: sessionIdRef.current,
            requestId: currentRecommendationMeta().request_id,
            scoringVersion: currentRecommendationMeta().scoring_version,
            modelVersion: currentRecommendationMeta().model_version,
            metadata: {
                index: reviewedCount,
                source: 'mobile_swipe',
                ...currentRecommendationMeta(),
            }
        });
    }, [currentJob?.id, reviewedCount]);

    const handleReject = () => {
        if (currentJob) {
            hasInteractedThisSessionRef.current = true;
            const dwellTimeMs = viewStartRef.current ? Date.now() - viewStartRef.current : undefined;
            const recMeta = currentRecommendationMeta();
            trackJobInteraction({
                jobId: currentJob.id,
                eventType: 'swipe_left',
                dwellTimeMs,
                sessionId: sessionIdRef.current,
                requestId: recMeta.request_id,
                scoringVersion: recMeta.scoring_version,
                modelVersion: recMeta.model_version,
                signalValue: 0,
                metadata: {
                    source: 'mobile_swipe',
                    ...recMeta,
                }
            });
            onRejectJob?.(currentJob.id);
            setExitAnimation('left');
            setTimeout(() => {
                setProcessedJobIds(prev => {
                    const next = prev.includes(currentJob.id) ? prev : [...prev, currentJob.id];
                    const nextIndex = findNextUnprocessedIndex(jobs, new Set(next), currentIndex + 1);
                    setCurrentIndex(nextIndex);
                    return next;
                });
                setExitAnimation(null);
            }, 300);
        }
    };

    const handleSave = () => {
        hasInteractedThisSessionRef.current = true;
        const dwellTimeMs = viewStartRef.current ? Date.now() - viewStartRef.current : undefined;
        if (currentJob) {
            const recMeta = currentRecommendationMeta();
            onToggleSave(currentJob.id, { source: 'mobile_swipe', position: displayPosition });
            if (!isSaved) {
                trackJobInteraction({
                    jobId: currentJob.id,
                    eventType: 'swipe_right',
                    dwellTimeMs,
                    sessionId: sessionIdRef.current,
                    requestId: recMeta.request_id,
                    scoringVersion: recMeta.scoring_version,
                    modelVersion: recMeta.model_version,
                    signalValue: 1,
                    metadata: {
                        source: 'mobile_swipe',
                        ...recMeta,
                    }
                });
            }
        }
        if (currentJob) {
            setExitAnimation('right');
            setTimeout(() => {
                setProcessedJobIds(prev => {
                    const next = prev.includes(currentJob.id) ? prev : [...prev, currentJob.id];
                    const nextIndex = findNextUnprocessedIndex(jobs, new Set(next), currentIndex + 1);
                    setCurrentIndex(nextIndex);
                    return next;
                });
                setExitAnimation(null);
            }, 300);
        }
    };

    const handleOpenDetails = () => {
        if (!currentJob) return;
        const dwellTimeMs = viewStartRef.current ? Date.now() - viewStartRef.current : undefined;
        const recMeta = currentRecommendationMeta();
        trackJobInteraction({
            jobId: currentJob.id,
            eventType: 'open_detail',
            dwellTimeMs,
            sessionId: sessionIdRef.current,
            requestId: recMeta.request_id,
            scoringVersion: recMeta.scoring_version,
            modelVersion: recMeta.model_version,
            signalValue: 1,
            scrollDepth: 100,
            metadata: {
                source: 'mobile_swipe',
                ...recMeta,
            }
        });
        onOpenDetails(currentJob.id);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setSwipeState({
            startX: touch.clientX,
            startY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
            isDragging: false,
            gesture: 'pending'
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setSwipeState(prev => {
            if (prev.gesture === 'idle' || prev.gesture === 'scroll') {
                return prev;
            }

            const dx = touch.clientX - prev.startX;
            const dy = touch.clientY - prev.startY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);

            let gesture: SwipeState['gesture'] = prev.gesture;
            let isDragging = prev.isDragging;

            // Direction lock with tolerance: one-handed swipes are rarely perfectly horizontal.
            const LOCK_THRESHOLD_PX = 6;
            const HORIZONTAL_TOLERANCE_RATIO = 0.7; // allow some vertical drift
            const VERTICAL_DOMINANCE_RATIO = 1.25;

            if (gesture === 'pending') {
                if (absX >= LOCK_THRESHOLD_PX && absX >= absY * HORIZONTAL_TOLERANCE_RATIO) {
                    gesture = 'swipe';
                    isDragging = true;
                } else if (absY >= LOCK_THRESHOLD_PX && absY >= absX * VERTICAL_DOMINANCE_RATIO) {
                    gesture = 'scroll';
                    isDragging = false;
                }
            }

            // Only update drag position once we know it's a swipe.
            if (gesture !== 'swipe') {
                return { ...prev, currentY: touch.clientY, gesture, isDragging };
            }

            return {
                ...prev,
                currentX: touch.clientX,
                currentY: touch.clientY,
                gesture,
                isDragging
            };
        });
    };

    const handleTouchEnd = () => {
        if (!swipeState.isDragging || swipeState.gesture !== 'swipe') {
            setSwipeState({
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0,
                isDragging: false,
                gesture: 'idle'
            });
            return;
        }

        const deltaX = swipeState.currentX - swipeState.startX;
        const threshold = 50; // pixels

        if (Math.abs(deltaX) > threshold) {
            justSwipedRef.current = true;
            setTimeout(() => { justSwipedRef.current = false; }, 300);
            if (deltaX > 0) {
                // Right swipe - save
                handleSave();
            } else {
                // Left swipe - reject
                handleReject();
            }
        }

        setSwipeState({
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            isDragging: false,
            gesture: 'idle'
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setSwipeState({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            isDragging: true,
            gesture: 'swipe'
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!swipeState.isDragging) return;
        
        setSwipeState(prev => ({
            ...prev,
            currentX: e.clientX,
            currentY: e.clientY
        }));
    };

    const handleMouseUp = () => {
        if (!swipeState.isDragging) return;

        const deltaX = swipeState.currentX - swipeState.startX;
        const threshold = 50;

        if (Math.abs(deltaX) > threshold) {
            justSwipedRef.current = true;
            setTimeout(() => { justSwipedRef.current = false; }, 300);
            if (deltaX > 0) {
                handleSave();
            } else {
                handleReject();
            }
        }

        setSwipeState({
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            isDragging: false,
            gesture: 'idle'
        });
    };

    // Load more when reaching the end
    useEffect(() => {
        const remainingJobsCount = Math.max(0, jobs.length - reviewedCount);
        const previousRemaining = previousRemainingJobsCountRef.current;
        previousRemainingJobsCountRef.current = remainingJobsCount;

        const crossedIntoLoadThreshold =
            previousRemaining !== null &&
            previousRemaining > 3 &&
            remainingJobsCount <= 3;

        if (
            hasInteractedThisSessionRef.current &&
            crossedIntoLoadThreshold &&
            hasMore &&
            !isLoadingMore
        ) {
            onLoadMore();
        }
    }, [jobs.length, reviewedCount, hasMore, isLoadingMore, onLoadMore]);

    // No jobs message
    if (jobs.length === 0) {
        if (isLoading) {
            return (
                <div className="app-surface flex min-h-[64dvh] flex-col items-center justify-center rounded-[var(--radius-2xl)] border p-6 text-center shadow-[var(--shadow-card)]">
                    <Activity className="mb-3 animate-spin text-[var(--accent)]" size={28} />
                    <p className="text-[var(--text-muted)]">{t('app.searching')}</p>
                </div>
            );
        }
        return (
            <div className="app-surface flex min-h-[64dvh] flex-col items-center justify-center rounded-[var(--radius-2xl)] border p-6 text-center shadow-[var(--shadow-card)]">
                <div className="mb-4 text-5xl text-[var(--text-faint)]">🎯</div>
                <h2 className="text-xl font-bold mb-2">{t('job.no_jobs_title')}</h2>
                <p className="text-[var(--text-muted)]">{t('job.no_jobs_message')}</p>
            </div>
        );
    }

    // All jobs swiped
    if (!currentJob || reviewedCount >= jobs.length) {
        return (
            <div className="app-surface flex min-h-[64dvh] flex-col items-center justify-center rounded-[var(--radius-2xl)] border p-6 text-center shadow-[var(--shadow-card)]">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold mb-2">{t('job.all_reviewed')}</h2>
                <p className="mb-6 text-[var(--text-muted)]">
                    {t('job.swiped_count', { count: reviewedCount })}
                </p>
                {hasMore ? (
                    <button
                        onClick={() => {
                            if (!isLoadingMore) {
                                onLoadMore();
                            }
                        }}
                        disabled={isLoadingMore}
                        className="app-button-primary mb-3"
                    >
                        {isLoadingMore
                            ? t('job.loading_more', { defaultValue: 'Načítám další nabídky…' })
                            : t('job.load_more', { defaultValue: 'Načíst další nabídky' })}
                    </button>
                ) : null}
                <button
                    onClick={() => {
                        setCurrentIndex(0);
                        setProcessedJobIds([]);
                        if (typeof window !== 'undefined') {
                            window.localStorage.removeItem(swipeStateKey);
                        }
                    }}
                    className="app-button-primary"
                >
                    {t('job.start_over')}
                </button>
            </div>
        );
    }

    const dragX = swipeState.isDragging ? swipeState.currentX - swipeState.startX : 0;
    const rotation = (dragX / 100) * 5; // Max 5 degree rotation
    const opacity = 1 - Math.abs(dragX) / 200;

    return (
        <div
            ref={containerRef}
            className={cn(
                "app-surface relative flex w-full flex-col overflow-hidden border shadow-[var(--shadow-card)]",
                fullscreen
                    ? "min-h-[calc(100dvh-var(--app-header-offset)-4rem)] rounded-[var(--radius-xl)]"
                    : "min-h-[70dvh] rounded-[var(--radius-2xl)]",
                swipeState.gesture === 'swipe' ? 'touch-none' : 'touch-pan-y'
            )}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Header with job counter */}
            <div className="flex-none border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--accent)]">{displayPosition}</span>
                        <span className="text-sm text-[var(--text-muted)]">
                            / {jobs.length} {t('job.jobs')}
                        </span>
                    </div>
                    <div className="text-xs font-medium text-[var(--text-faint)]">
                        {t('job.swipe_hint')}
                    </div>
                </div>
                {(needsRegistration || needsAddress) && (
                    <div className="mt-3 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.07)] px-3 py-2.5">
                        <div className="mt-0.5 rounded-full bg-white/80 p-1.5 text-[var(--accent)] dark:bg-white/10">
                            {needsRegistration ? <UserPlus size={14} /> : <MapPin size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-[var(--text-strong)]">
                                {needsRegistration
                                    ? t('job.swipe_nudge_register_title', { defaultValue: 'AI si zatím nepamatuje vaše preference naplno' })
                                    : t('job.swipe_nudge_address_title', { defaultValue: 'Lokalita zatím chybí pro přesný lokální swipe' })}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                {needsRegistration
                                    ? t('job.swipe_nudge_register_body', { defaultValue: 'Registrace pomůže držet historii swipe a zlepšit doporučení v dalších relacích.' })
                                    : t('job.swipe_nudge_address_body', { defaultValue: 'Doplňte adresu a AI začne lépe filtrovat blízké nabídky a reálný dojezd.' })}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (needsRegistration) {
                                    onOpenAuth?.('register');
                                } else {
                                    onOpenProfile?.();
                                }
                            }}
                            className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-white dark:bg-white/10"
                        >
                            {needsRegistration
                                ? t('job.swipe_nudge_register_cta', { defaultValue: 'Registrovat' })
                                : t('job.swipe_nudge_address_cta', { defaultValue: 'Doplnit adresu' })}
                        </button>
                    </div>
                )}
                {refreshMessage && (
                    <div className="mt-3 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-green-rgb),0.22)] bg-[rgba(var(--accent-green-rgb),0.10)] px-3 py-2.5">
                        <div className="mt-0.5 rounded-full bg-white/80 p-1.5 text-[var(--accent-green)] dark:bg-white/10">
                            <Sparkles size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-[var(--text-strong)]">
                                {t('job.swipe_refresh_title', { defaultValue: 'AI právě přepočítala swipe podle vaší lokality' })}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                {refreshMessage}
                            </div>
                        </div>
                    </div>
                )}
                {/* Progress bar */}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                    <div
                        className="h-full bg-[linear-gradient(90deg,rgba(var(--accent-rgb),0.55),var(--accent))] transition-all"
                        style={{ width: `${(displayPosition / jobs.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Card Stack */}
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                <AnimatePresence>
                    {showSwipeCoach && (
                        <motion.div
                            className="absolute inset-0 z-30 flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="absolute inset-0 bg-black/40" onClick={closeSwipeCoach}></div>
                            <motion.div
                                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                                transition={{ duration: 0.2 }}
                                className="app-surface relative z-10 w-[92%] max-w-sm rounded-[var(--radius-xl)] border p-5 text-center shadow-[var(--shadow-overlay)]"
                            >
                                <div className="mb-1 text-sm font-bold text-[var(--text-strong)]">
                                    {coachTitle}
                                </div>
                                <div className="mb-4 text-xs leading-5 text-[var(--text-muted)]">
                                    {coachBody}
                                </div>
                                <div className="mb-3 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] px-3 py-2 text-xs font-medium leading-5 text-[var(--text-strong)]">
                                    {coachSignal}
                                </div>
                                <div className="relative mb-4 flex h-24 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                                    <motion.div
                                        className="absolute left-4 text-rose-500 text-2xl font-bold"
                                        animate={{ x: [-4, -12, -4], opacity: [0.6, 1, 0.6] }}
                                        transition={{ duration: 1.4, repeat: Infinity }}
                                    >
                                        ←
                                    </motion.div>
                                    <motion.div
                                        className="absolute right-4 text-amber-500 text-2xl font-bold"
                                        animate={{ x: [4, 12, 4], opacity: [0.6, 1, 0.6] }}
                                        transition={{ duration: 1.4, repeat: Infinity }}
                                    >
                                        →
                                    </motion.div>
                                    <motion.div
                                        className="absolute h-16 w-28 rounded-[1.1rem] border border-[var(--border-subtle)] bg-white shadow-sm dark:bg-slate-900"
                                        animate={{ x: [0, 18, 0, -18, 0], rotate: [0, 2, 0, -2, 0] }}
                                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                    <motion.div
                                        className="absolute top-4 left-4 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"
                                        animate={{ opacity: [0.45, 1, 0.45] }}
                                        transition={{ duration: 1.4, repeat: Infinity }}
                                    >
                                        {t('job.pass', { defaultValue: 'Pass' })}
                                    </motion.div>
                                    <motion.div
                                        className="absolute bottom-4 right-4 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                        animate={{ opacity: [0.45, 1, 0.45] }}
                                        transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
                                    >
                                        {t('job.save', { defaultValue: 'Save' })}
                                    </motion.div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {(needsRegistration || needsAddress) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeSwipeCoach();
                                                if (needsRegistration) {
                                                    onOpenAuth?.('register');
                                                } else {
                                                    onOpenProfile?.();
                                                }
                                            }}
                                            className="app-button-primary w-full"
                                        >
                                            {needsRegistration ? <UserPlus size={16} /> : <MapPin size={16} />}
                                            {coachPrimaryCta}
                                        </button>
                                    )}
                                    <button
                                        onClick={closeSwipeCoach}
                                        className={cn(
                                            'w-full rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition',
                                            needsRegistration || needsAddress
                                                ? 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-strong)] hover:bg-[var(--surface)]'
                                                : 'app-button-primary'
                                        )}
                                    >
                                        {needsRegistration || needsAddress ? coachSecondaryCta : coachPrimaryCta}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {!exitAnimation && currentJob && (
                        <motion.div
                            key={currentJob.id}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                transform: swipeState.isDragging
                                    ? `translateX(${dragX}px) rotate(${rotation}deg)`
                                    : 'translateX(0) rotate(0deg)',
                                opacity: swipeState.isDragging ? opacity : 1,
                            }}
                            className="absolute inset-4 app-surface custom-scrollbar cursor-grab select-none overflow-y-auto rounded-[var(--radius-xl)] border bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)] active:cursor-grabbing"
                            drag={swipeState.isDragging ? 'x' : false}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                if (isTap && !justSwipedRef.current) handleOpenDetails();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleOpenDetails();
                                }
                            }}
                        >
                            {/* Job Title and Company */}
                            <div className="mb-4">
                                <h2 className="mb-2 text-2xl font-bold text-[var(--text-strong)]">
                                    {currentJob.title}
                                </h2>
                                <p className="text-lg font-semibold text-[var(--accent)]">
                                    {currentJob.company}
                                </p>
                            </div>

                            {/* Quick Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                {currentJob.location && (
                                    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-3">
                                        <p className="text-xs font-semibold text-[var(--text-faint)]">
                                            {t('job.location')}
                                        </p>
                                        <p className="break-words text-sm font-medium leading-snug text-[var(--text-strong)]">
                                            {currentJob.location}
                                        </p>
                                    </div>
                                )}
                                {currentJob.salaryRange && (
                                    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-3">
                                        <p className="text-xs font-semibold text-[var(--text-faint)]">
                                            {t('job.salary')}
                                        </p>
                                        <p className="break-words text-sm font-medium leading-snug text-[var(--text-strong)]">
                                            {currentJob.salaryRange}
                                        </p>
                                    </div>
                                )}
                                {currentJob.type && (
                                    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-3">
                                        <p className="text-xs font-semibold text-[var(--text-faint)]">
                                            {t('job.type')}
                                        </p>
                                        <p className="break-words text-sm font-medium leading-snug text-[var(--text-strong)]">
                                            {formatJobTypeLabel(currentJob.type)}
                                        </p>
                                    </div>
                                )}
                                {jhiScore !== undefined && (
                                    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-3">
                                        <p className="text-xs font-semibold text-[var(--text-faint)]">
                                            {t('job.jhi_score')}
                                        </p>
                                        <p className="text-sm font-semibold text-[var(--accent)]">
                                            {Math.round(jhiScore)} {t('job.points')}
                                        </p>
                                    </div>
                                )}
                                {relativePostedAt && (
                                    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-3">
                                        <p className="text-xs font-semibold text-[var(--text-faint)]">
                                            {t('job.posted', { defaultValue: 'Published' })}
                                        </p>
                                        <p className="flex items-center gap-1.5 text-sm font-medium leading-snug text-[var(--text-strong)]">
                                            <Clock size={14} className="text-[var(--accent)]" />
                                            {relativePostedAt}
                                        </p>
                                    </div>
                                )}
                                {aiMatchScore !== null && (
                                    <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
                                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                            {t('job.ai_match')}
                                        </p>
                                        <p className="text-sm font-semibold text-amber-600">
                                            {aiMatchScore}%
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Description Preview */}
                            <div className="mb-6">
                                <h3 className="mb-2 text-sm font-bold uppercase text-[var(--text-faint)]">
                                    {t('job.description')}
                                </h3>
                                <p className="line-clamp-6 text-sm leading-relaxed text-[var(--text-muted)]">
                                    {currentJob.description?.substring(0, 300)}...
                                </p>
                            </div>

                            {whyReasons.length > 0 && (
                                <div className="mb-6 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] p-4">
                                    <h3 className="mb-2 text-sm font-bold uppercase text-[var(--accent)]">
                                        {t('job.why_seen', { defaultValue: 'Proč to vidíš' })}
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {whyReasons.map((reason) => (
                                            <span
                                                key={reason}
                                                className="inline-flex max-w-full items-center rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] ring-1 ring-inset ring-[rgba(15,23,42,0.07)] dark:bg-white/8 dark:text-white/90"
                                            >
                                                <span className="truncate">{reason}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hint about full details */}
                            <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] p-3">
                                <ChevronDown size={16} className="flex-shrink-0 text-[var(--accent)]" />
                                <p className="text-xs font-medium text-[var(--accent)]">
                                    {t('job.tap_to_see_more')}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Swipe Indicators */}
                {swipeState.isDragging && dragX < -50 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute left-4 top-4 text-red-500"
                    >
                        <X size={32} className="drop-shadow-lg" />
                    </motion.div>
                )}

                {swipeState.isDragging && dragX > 50 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute right-4 top-4 text-green-500"
                    >
                        <Check size={32} className="drop-shadow-lg" />
                    </motion.div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex-none border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                <div className="grid grid-cols-4 gap-3">
                {/* Reject Button */}
                <button
                    onClick={handleReject}
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-3 font-semibold text-[var(--text-strong)] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-900/30 dark:hover:bg-rose-950/20"
                    title={t('job.swipe_left_title')}
                >
                    <X size={20} />
                    <span className="hidden sm:inline">{t('job.pass')}</span>
                </button>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-3 font-semibold text-white transition',
                        isSaved ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                    )}
                    title={t('job.swipe_right_title')}
                >
                    <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
                    <span className="hidden sm:inline">
                        {isSaved ? t('job.saved') : t('job.save')}
                    </span>
                </button>

                {/* View Details */}
                <button
                    onClick={handleOpenDetails}
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-3 font-semibold text-[var(--text-strong)] transition hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--surface)]"
                    title={t('job.see_full_details_title')}
                >
                    <Sparkles size={20} />
                    <span className="hidden sm:inline">{t('job.details')}</span>
                </button>

                {/* List View */}
                <button
                    onClick={onSwitchToList}
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-3 font-semibold text-[var(--text-strong)] transition hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--surface)]"
                    title={t('job.switch_to_list_title')}
                >
                    <List size={20} />
                    <span className="hidden sm:inline">{t('job.list_view')}</span>
                </button>
                </div>
            </div>

            {/* Loading indicator for infinite scroll */}
            {isLoadingMore && (
                <div className="flex-none p-2 flex justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[var(--accent)]" />
                </div>
            )}
        </div>
    );
};

export default MobileSwipeJobBrowser;
