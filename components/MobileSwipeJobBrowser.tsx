import React, { useState, useRef, useEffect } from 'react';
import { Job } from '../types';
import { Bookmark, X, Check, ChevronDown, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileSwipeJobBrowserProps {
    jobs: Job[];
    savedJobIds: string[];
    onToggleSave: (jobId: string) => void;
    onJobSelect: (jobId: string | null) => void;
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
    onJobSelect,
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
    const [exitAnimation, setExitAnimation] = useState<'left' | 'right' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentJob = jobs[currentIndex];
    const isSaved = currentJob && savedJobIds.includes(currentJob.id);

    // Keyboard support
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') handleReject();
            if (e.key === 'ArrowRight') handleSave();
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentIndex, jobs.length]);

    const handleReject = () => {
        if (currentIndex < jobs.length) {
            setExitAnimation('left');
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setExitAnimation(null);
            }, 300);
        }
    };

    const handleSave = () => {
        if (currentJob) {
            onToggleSave(currentJob.id);
        }
        if (currentIndex < jobs.length) {
            setExitAnimation('right');
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setExitAnimation(null);
            }, 300);
        }
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
                    {t('job.swiped_count', { defaultValue: `You swiped through ${currentIndex} jobs` })}
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
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {currentJob.location && (
                                    <div className={`p-3 rounded-lg ${
                                        theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
                                    }`}>
                                        <p className={`text-xs font-semibold ${
                                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                        }`}>
                                            {t('job.location') || 'Location'}
                                        </p>
                                        <p className={`font-medium ${
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
                                        <p className={`font-medium ${
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
                                        <p className={`font-medium ${
                                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                                        }`}>
                                            {currentJob.type}
                                        </p>
                                    </div>
                                )}
                                {currentJob.jhi?.score !== undefined && (
                                    <div className={`p-3 rounded-lg ${
                                        theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
                                    }`}>
                                        <p className={`text-xs font-semibold ${
                                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                        }`}>
                                            {t('job.jhi') || 'JHI Score'}
                                        </p>
                                        <p className="font-medium text-cyan-600 text-lg">
                                            {(currentJob.jhi.score * 100).toFixed(0)}%
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
                    onClick={() => currentJob && onJobSelect(currentJob.id)}
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
