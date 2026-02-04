import React, { useState, useRef, useEffect } from 'react';
import { Job } from '../types';
import { Bookmark, X, Check, ChevronDown, Sparkles, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { trackJobInteraction } from '../services/jobInteractionService';

interface MobileSwipeJobBrowserProps {
    jobs: Job[];
    savedJobIds: string[];
    onToggleSave: (jobId: string) => void;
    onOpenDetails: (jobId: string) => void;
    onSwitchToList: () => void;
    isLoadingMore: boolean;
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
    savedJobIds,
    onToggleSave,
    onOpenDetails,
    onSwitchToList,
    isLoadingMore,
    hasMore,
    onLoadMore,
    theme
}) => {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(0);
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

    const currentJob = jobs[currentIndex];
    const isSaved = currentJob && savedJobIds.includes(currentJob.id);
    const jhiScore = currentJob?.jhi?.score;
    const dragDelta = Math.abs(swipeState.currentX - swipeState.startX);
    const isTap = !swipeState.isDragging && dragDelta < 10;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = 'swipe_tutorial_seen';
        const hasSeen = window.localStorage.getItem(key);
        if (!hasSeen) {
            setShowSwipeCoach(true);
            window.localStorage.setItem(key, '1');
        }
    }, []);

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
            metadata: {
                index: currentIndex,
                source: 'mobile_swipe'
            }
        });
    }, [currentJob?.id, currentIndex]);

    const handleReject = () => {
        if (currentIndex < jobs.length) {
            const dwellTimeMs = viewStartRef.current ? Date.now() - viewStartRef.current : undefined;
            if (currentJob) {
                trackJobInteraction({
                    jobId: currentJob.id,
                    eventType: 'swipe_left',
                    dwellTimeMs,
                    sessionId: sessionIdRef.current,
                    metadata: {
                        source: 'mobile_swipe'
                    }
                });
            }
            setExitAnimation('left');
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setExitAnimation(null);
            }, 300);
        }
    };

    const handleSave = () => {
        const dwellTimeMs = viewStartRef.current ? Date.now() - viewStartRef.current : undefined;
        if (currentJob) {
            onToggleSave(currentJob.id);
            trackJobInteraction({
                jobId: currentJob.id,
                eventType: 'swipe_right',
                dwellTimeMs,
                sessionId: sessionIdRef.current,
                metadata: {
                    source: 'mobile_swipe'
                }
            });
            trackJobInteraction({
                jobId: currentJob.id,
                eventType: isSaved ? 'unsave' : 'save',
                dwellTimeMs,
                sessionId: sessionIdRef.current,
                metadata: {
                    source: 'mobile_swipe'
                }
            });
        }
        if (currentIndex < jobs.length) {
            setExitAnimation('right');
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setExitAnimation(null);
            }, 300);
        }
    };

    const handleOpenDetails = () => {
        if (!currentJob) return;
        const dwellTimeMs = viewStartRef.current ? Date.now() - viewStartRef.current : undefined;
        trackJobInteraction({
            jobId: currentJob.id,
            eventType: 'open_detail',
            dwellTimeMs,
            sessionId: sessionIdRef.current,
            metadata: {
                source: 'mobile_swipe'
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
        if (currentIndex >= jobs.length - 3 && hasMore && !isLoadingMore) {
            onLoadMore();
        }
    }, [currentIndex, jobs.length]);

    // No jobs message
    if (jobs.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center h-full p-6 text-center rounded-xl ${
                theme === 'dark' ? 'bg-slate-900' : 'bg-white'
            }`}>
                <div className={`text-5xl mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}>
                    🎯
                </div>
                <h2 className="text-xl font-bold mb-2">{t('job.no_jobs_title') || 'No jobs available'}</h2>
                <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                    {t('job.no_jobs_message') || 'Try adjusting your filters'}
                </p>
            </div>
        );
    }

    // All jobs swiped
    if (currentIndex >= jobs.length) {
        return (
            <div className={`flex flex-col items-center justify-center h-full p-6 text-center rounded-xl ${
                theme === 'dark' ? 'bg-slate-900' : 'bg-white'
            }`}>
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold mb-2">{t('job.all_reviewed') || 'You\'ve reviewed all jobs'}</h2>
                <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('job.swiped_count', {
                        count: currentIndex,
                        defaultValue: `You swiped through ${currentIndex} jobs`
                    })}
                </p>
                <button
                    onClick={() => setCurrentIndex(0)}
                    className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                >
                    {t('job.start_over') || 'Start over'}
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
            className={`relative w-full h-full flex flex-col ${
                theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'
            } overflow-hidden`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Header with job counter */}
            <div className={`flex-none px-4 py-3 border-b ${
                theme === 'dark' 
                    ? 'border-slate-800 bg-slate-900' 
                    : 'border-slate-200 bg-white'
            }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-cyan-600">{currentIndex + 1}</span>
                        <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            / {jobs.length} {t('job.jobs') || 'jobs'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                        {t('job.swipe_hint') || 'Swipe to decide'}
                    </div>
                </div>
                {/* Progress bar */}
                <div className={`mt-2 h-1 rounded-full overflow-hidden ${
                    theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'
                }`}>
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all"
                        style={{ width: `${((currentIndex + 1) / jobs.length) * 100}%` }}
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
                                className="relative z-10 w-[90%] max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 text-center"
                            >
                                <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                                    {t('job.swipe_tutorial_title') || 'Jak funguje swipování'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    {t('job.swipe_tutorial_desc') || 'Táhni kartu doprava pro uložení, doleva pro přeskočení.'}
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
                                        className="w-24 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-sm"
                                        animate={{ x: [0, 18, 0, -18, 0], rotate: [0, 2, 0, -2, 0] }}
                                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                </div>
                                <button
                                    onClick={() => setShowSwipeCoach(false)}
                                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-colors"
                                >
                                    {t('job.swipe_tutorial_cta') || 'Rozumím'}
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
                            className={`absolute inset-4 rounded-2xl p-6 overflow-y-auto custom-scrollbar cursor-grab active:cursor-grabbing select-none ${
                                theme === 'dark'
                                    ? 'bg-slate-900 border border-slate-800 shadow-xl'
                                    : 'bg-white border border-slate-200 shadow-xl'
                            }`}
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
                                <h2 className={`text-2xl font-bold mb-2 ${
                                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                                }`}>
                                    {currentJob.title}
                                </h2>
                                <p className={`text-lg font-semibold ${
                                    theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                                }`}>
                                    {currentJob.company}
                                </p>
                            </div>

                            {/* Quick Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                {currentJob.location && (
                                    <div className={`p-3 rounded-lg ${
                                        theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
                                    }`}>
                                        <p className={`text-xs font-semibold ${
                                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                        }`}>
                                            {t('job.location') || 'Location'}
                                        </p>
                                        <p className={`text-sm font-medium leading-snug break-words ${
                                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                                        }`}>
                                            {currentJob.location}
                                        </p>
                                    </div>
                                )}
                                {currentJob.salaryRange && (
                                    <div className={`p-3 rounded-lg ${
                                        theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
                                    }`}>
                                        <p className={`text-xs font-semibold ${
                                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                        }`}>
                                            {t('job.salary') || 'Salary'}
                                        </p>
                                        <p className={`text-sm font-medium leading-snug break-words ${
                                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                                        }`}>
                                            {currentJob.salaryRange}
                                        </p>
                                    </div>
                                )}
                                {currentJob.type && (
                                    <div className={`p-3 rounded-lg ${
                                        theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
                                    }`}>
                                        <p className={`text-xs font-semibold ${
                                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                        }`}>
                                            {t('job.type') || 'Type'}
                                        </p>
                                        <p className={`text-sm font-medium leading-snug break-words ${
                                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                                        }`}>
                                            {currentJob.type}
                                        </p>
                                    </div>
                                )}
                                {jhiScore !== undefined && (
                                    <div className={`p-3 rounded-lg ${
                                        theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
                                    }`}>
                                        <p className={`text-xs font-semibold ${
                                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                        }`}>
                                            {t('job.jhi_score') || 'JHI Score'}
                                        </p>
                                        <p className="text-sm font-semibold text-cyan-600">
                                            {Math.round(jhiScore)} {t('job.points') || 'points'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Description Preview */}
                            <div className="mb-6">
                                <h3 className={`text-sm font-bold uppercase mb-2 ${
                                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                    {t('job.description') || 'Description'}
                                </h3>
                                <p className={`text-sm leading-relaxed line-clamp-6 ${
                                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                                }`}>
                                    {currentJob.description?.substring(0, 300)}...
                                </p>
                            </div>

                            {/* Hint about full details */}
                            <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                                theme === 'dark' ? 'bg-cyan-500/10' : 'bg-cyan-50'
                            }`}>
                                <ChevronDown size={16} className="text-cyan-600 flex-shrink-0" />
                                <p className="text-xs text-cyan-600 font-medium">
                                    {t('job.tap_to_see_more') || 'Tap card to see full details'}
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
            <div className={`flex-none flex gap-4 p-4 border-t ${
                theme === 'dark'
                    ? 'border-slate-800 bg-slate-900'
                    : 'border-slate-200 bg-white'
            }`}>
                {/* Reject Button */}
                <button
                    onClick={handleReject}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 border-2 ${
                        theme === 'dark'
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 hover:border-slate-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300 hover:border-slate-400'
                    }`}
                    title="Swipe left or press ← to reject"
                >
                    <X size={20} />
                    <span className="hidden sm:inline">{t('job.pass') || 'Pass'}</span>
                </button>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                        isSaved
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : theme === 'dark'
                            ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                            : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                    }`}
                    title="Swipe right or press → to save"
                >
                    <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
                    <span className="hidden sm:inline">
                        {isSaved ? (t('job.saved') || 'Saved') : (t('job.save') || 'Save')}
                    </span>
                </button>

                {/* View Details */}
                <button
                    onClick={handleOpenDetails}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 border-2 ${
                        theme === 'dark'
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 hover:border-slate-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300 hover:border-slate-400'
                    }`}
                    title="See full job details"
                >
                    <Sparkles size={20} />
                    <span className="hidden sm:inline">{t('job.details') || 'Details'}</span>
                </button>

                {/* List View */}
                <button
                    onClick={onSwitchToList}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 border-2 ${
                        theme === 'dark'
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 hover:border-slate-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300 hover:border-slate-400'
                    }`}
                    title="Switch to list view"
                >
                    <List size={20} />
                    <span className="hidden sm:inline">{t('job.list_view') || 'List'}</span>
                </button>
            </div>

            {/* Loading indicator for infinite scroll */}
            {isLoadingMore && (
                <div className="flex-none p-2 flex justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500" />
                </div>
            )}
        </div>
    );
};

export default MobileSwipeJobBrowser;
