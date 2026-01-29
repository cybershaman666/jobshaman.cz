import React, { RefObject } from 'react';
import { Job, UserProfile, CommuteAnalysis, ViewState } from '../types';
import FinancialCard from './FinancialCard';
import WelcomePage from './WelcomePage';
import { ArrowUpRight, Bookmark, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Markdown from 'markdown-to-jsx';

interface JobDetailViewProps {
    mounted: boolean;
    selectedJobId: string | null;
    selectedJob: Job | null;
    dynamicJHI: any;
    savedJobIds: string[];
    handleToggleSave: (jobId: string) => void;
    setSelectedJobId: (id: string | null) => void;
    setIsApplyModalOpen: (open: boolean) => void;
    detailScrollRef: RefObject<HTMLDivElement>;
    userProfile: UserProfile;
    commuteAnalysis: CommuteAnalysis | null;
    showCommuteDetails: boolean;
    showLoginPrompt: boolean;
    showAddressPrompt: boolean;
    handleAuthAction: () => void;
    setViewState: (view: ViewState) => void;
    showFinancialMethodology: boolean;
    setShowFinancialMethodology: (show: boolean) => void;
    getTransportIcon: (mode: string) => React.ComponentType<any>;
    formatJobDescription: (description: string) => string;
}

const JobDetailView: React.FC<JobDetailViewProps> = ({
    mounted,
    selectedJobId,
    selectedJob,
    dynamicJHI,
    savedJobIds,
    handleToggleSave,
    setSelectedJobId,
    setIsApplyModalOpen,
    detailScrollRef,
    userProfile,
    commuteAnalysis,
    showCommuteDetails,
    showLoginPrompt,
    showAddressPrompt,
    handleAuthAction,
    setViewState,
    showFinancialMethodology,
    setShowFinancialMethodology,
    getTransportIcon,
    formatJobDescription
}) => {
    const { t } = useTranslation();

    return (
        <section className={`lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 h-full ${!mounted ? 'flex' : (!selectedJobId ? 'hidden lg:flex' : 'flex')}`}>
            {selectedJob && dynamicJHI ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg flex flex-col h-full overflow-hidden">
                    <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 flex-none bg-white dark:bg-slate-900 z-10">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="w-full">
                                <button className="lg:hidden mb-4 flex items-center gap-1 text-slate-500 text-sm hover:text-slate-900 dark:hover:text-white" onClick={() => setSelectedJobId(null)}>&larr; {t('app.back')}</button>
                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{selectedJob.title}</h1>
                                <div className="flex flex-wrap items-center gap-2 mt-3 text-slate-500 dark:text-slate-400 font-medium">
                                    <span className="text-cyan-600 dark:text-cyan-400">{selectedJob.company}</span>
                                    <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                    <span className="text-slate-600 dark:text-slate-300">{selectedJob.location}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-none">
                                <button onClick={() => handleToggleSave(selectedJob.id)} className={`p-2.5 rounded-lg border transition-all ${savedJobIds.includes(selectedJob.id) ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200'}`}>
                                    <Bookmark size={20} className={savedJobIds.includes(selectedJob.id) ? "fill-current" : ""} />
                                </button>

                                {selectedJob.url ? (
                                    <a
                                        href={selectedJob.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm active:scale-95"
                                    >
                                        {t('app.i_am_interested')} <ArrowUpRight size={18} />
                                    </a>
                                ) : (
                                    <button onClick={() => setIsApplyModalOpen(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm active:scale-95">
                                        {t('app.i_am_interested')} <ArrowUpRight size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div ref={detailScrollRef} className="flex-1 overflow-y-auto custom-scrollbar" data-detail-scroll="true" style={{ overscrollBehavior: 'contain' }}>
                        {/* Detail Content */}
                        <div className="p-6 sm:p-8 space-y-8">
                            {/* Financial Card */}
                            <FinancialCard
                                selectedJob={selectedJob}
                                userProfile={userProfile}
                                commuteAnalysis={commuteAnalysis}
                                showCommuteDetails={showCommuteDetails}
                                showLoginPrompt={showLoginPrompt}
                                showAddressPrompt={showAddressPrompt}
                                handleAuthAction={handleAuthAction}
                                setViewState={setViewState}
                                showFinancialMethodology={showFinancialMethodology}
                                setShowFinancialMethodology={setShowFinancialMethodology}
                                getTransportIcon={getTransportIcon}
                            />

                            {/* Benefits Section */}
                            {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                                <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/20 dark:to-cyan-950/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Gift className="text-emerald-600 dark:text-emerald-400" size={20} />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('job.benefits')}</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedJob.benefits.map((benefit, idx) => (
                                            <span key={idx} className="px-3 py-1.5 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-medium border border-emerald-200 dark:border-emerald-700">
                                                {benefit}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* JHI Chart - Simple display */}
                            {dynamicJHI && (
                                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('job.jhi_score')}</h3>
                                    <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{dynamicJHI.score}</div>
                                </div>
                            )}

                            {/* Job Description */}
                            {selectedJob.description && (
                                <div className="prose dark:prose-invert max-w-none">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('job.description')}</h3>
                                    <Markdown className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {formatJobDescription(selectedJob.description)}
                                    </Markdown>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <WelcomePage />
            )}
        </section>
    );
};

export default JobDetailView;
