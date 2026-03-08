import React, { useState, useRef, useEffect } from 'react';
import { Job } from '../types';
import { Bookmark, X, Check, ChevronDown, Sparkles, List, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { trackJobInteraction } from '../services/jobInteractionService';
import { matchesBrigadaKeywords, matchesFullTimeKeywords, matchesIcoKeywords, matchesPartTimeKeywords } from '../utils/contractType';
import { cn } from './ui/primitives';

interface MobileSwipeJobBrowserProps {
    jobs: Job[];
    swipeStateStorageKey: string;
    savedJobIds: string[];
    onToggleSave: (jobId: string, options?: { source?: string; position?: number }) => void;
    onRejectJob?: (jobId: string) => void;
    onOpenDetails: (jobId: string) => void;
    onSwitchToList: () => void;
    isLoadingMore: boolean;
    isLoading?: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    theme: 'light' | 'dark';
}

interface SwipeState {
    startX: number;
    currentX: number;
    isDragging: boolean;
}

const MobileSwipeJobBrowser: React.FC<MobileSwipeJobBrowserProps> = ({
    jobs,
    swipeStateStorageKey,
    savedJobIds,
    onToggleSave,
    onRejectJob,
    onOpenDetails,
    onSwitchToList,
    isLoadingMore,
    isLoading = false,
    hasMore,
    onLoadMore,
    theme
}) => {
    const { t } = useTranslation();
    void theme;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [processedJobIds, setProcessedJobIds] = useState<string[]>([]);
    const [swipeState, setSwipeState] = useState<SwipeState>({
        startX: 0,
        currentX: 0,
        isDragging: false
    });
    const [showSwipeCoach, setShowSwipeCoach] = useState(false);
    const [exitAnimation, setExitAnimation] = useState<'left' | 'right' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const justSwipedRef = useRef(false);
    const sessionIdRef = useRef(`swipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const viewStartRef = useRef<number | null>(null);
    const lastImpressionJobIdRef = useRef<string | null>(null);
    const processedJobIdsSet = new Set(processedJobIds);
    const swipeStateKey = `jobshaman_swipe_state:${swipeStateStorageKey}`;

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
    const isSaved = currentJob && savedJobIds.includes(currentJob.id);
    const jhiScore = currentJob?.jhi?.score;
    const aiMatchScore = null;
    const dragDelta = Math.abs(swipeState.currentX - swipeState.startX);
    const isTap = !swipeState.isDragging && dragDelta < 10;

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
        const key = 'swipe_tutorial_seen';
        const hasSeen = window.localStorage.getItem(key);
        if (!hasSeen) {
            setShowSwipeCoach(true);
            window.localStorage.setItem(key, '1');
        }
    }, []);

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
        setSwipeState({
            startX: e.touches[0].clientX,
            currentX: e.touches[0].clientX,
            isDragging: true
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!swipeState.isDragging) return;
        
        setSwipeState(prev => ({
            ...prev,
            currentX: e.touches[0].clientX
        }));
    };

    const handleTouchEnd = () => {
        if (!swipeState.isDragging) return;

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
            currentX: 0,
            isDragging: false
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setSwipeState({
            startX: e.clientX,
            currentX: e.clientX,
            isDragging: true
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!swipeState.isDragging) return;
        
        setSwipeState(prev => ({
            ...prev,
            currentX: e.clientX
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
            currentX: 0,
            isDragging: false
        });
    };

    // Load more when reaching the end
    useEffect(() => {
        const remainingJobsCount = Math.max(0, jobs.length - reviewedCount);
        if (remainingJobsCount <= 3 && hasMore && !isLoadingMore) {
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
            className="app-surface relative flex min-h-[70dvh] w-full flex-col overflow-hidden rounded-[var(--radius-2xl)] border shadow-[var(--shadow-card)]"
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
                            <div className="absolute inset-0 bg-black/40" onClick={() => setShowSwipeCoach(false)}></div>
                            <motion.div
                                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                                transition={{ duration: 0.2 }}
                                className="app-surface relative z-10 w-[90%] max-w-sm rounded-[var(--radius-xl)] border p-5 text-center shadow-[var(--shadow-overlay)]"
                            >
                                <div className="mb-1 text-sm font-bold text-[var(--text-strong)]">
                                    {t('job.swipe_tutorial_title')}
                                </div>
                                <div className="mb-4 text-xs text-[var(--text-muted)]">
                                    {t('job.swipe_tutorial_desc')}
                                </div>
                                <div className="relative h-16 mb-4 flex items-center justify-center">
                                    <motion.div
                                        className="absolute left-4 text-rose-500 text-2xl font-bold"
                                        animate={{ x: [-4, -12, -4], opacity: [0.6, 1, 0.6] }}
                                        transition={{ duration: 1.4, repeat: Infinity }}
                                    >
                                        ←
                                    </motion.div>
                                    <motion.div
                                        className="absolute right-4 text-emerald-500 text-2xl font-bold"
                                        animate={{ x: [4, 12, 4], opacity: [0.6, 1, 0.6] }}
                                        transition={{ duration: 1.4, repeat: Infinity }}
                                    >
                                        →
                                    </motion.div>
                                    <motion.div
                                        className="h-14 w-24 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] shadow-sm"
                                        animate={{ x: [0, 18, 0, -18, 0], rotate: [0, 2, 0, -2, 0] }}
                                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                </div>
                                <button
                                    onClick={() => setShowSwipeCoach(false)}
                                    className="app-button-primary w-full"
                                >
                                    {t('job.swipe_tutorial_cta')}
                                </button>
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
                                {aiMatchScore !== null && (
                                    <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                            {t('job.ai_match')}
                                        </p>
                                        <p className="text-sm font-semibold text-emerald-600">
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
                        isSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
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
