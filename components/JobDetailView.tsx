import React, { RefObject } from 'react';
import { Job, UserProfile, CommuteAnalysis, ViewState, CareerPathfinderResult, AIAnalysisResult } from '../types';
import FinancialCard from './FinancialCard';
import WelcomePage from './WelcomePage';
import JHIChart from './JHIChart';
import SkillsGapBox from './SkillsGapBox';
import BullshitMeter from './BullshitMeter';
import TransparencyCard from './TransparencyCard';
import ContextualRelevance from './ContextualRelevance';
import { ArrowUpRight, Bookmark, Gift, Zap } from 'lucide-react';
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
    // New props for full functionality
    theme: 'light' | 'dark';
    pathfinderAnalysis: CareerPathfinderResult | null;
    aiAnalysis: AIAnalysisResult | null;
    analyzing: boolean;
    handleAnalyzeJob: () => void;
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
    formatJobDescription,
    theme,
    pathfinderAnalysis,
    aiAnalysis,
    analyzing,
    handleAnalyzeJob
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

                            {/* Contextual Relevance Section */}
                            {selectedJob.contextualRelevance && (
                                <div className="mb-8">
                                    <ContextualRelevance contextualRelevance={selectedJob.contextualRelevance} compact={false} />
                                </div>
                            )}

                            {/* Job Description */}
                            {selectedJob.description && (
                                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 break-words whitespace-pre-wrap">
                                    <Markdown options={{ forceBlock: true }}>{formatJobDescription(selectedJob.description)}</Markdown>
                                </div>
                            )}
                        </div>

                        {/* Bottom section with JHI Chart and Analysis */}
                        <div className="bg-slate-50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-800 p-6 sm:p-8">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {/* Left Column - JHI Chart and AI Analysis */}
                                <div className="space-y-6">
                                    {/* JHI Chart with Spider Graph */}
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"><Zap size={20} /></div>
                                                <div><h3 className="text-slate-900 dark:text-slate-100 font-bold">{t('job_detail.jhi_title')}</h3><p className="text-slate-500 dark:text-slate-400 text-xs">{t('job_detail.jhi_desc')}</p></div>
                                            </div>
                                            <span className={`text-3xl font-mono font-bold ${commuteAnalysis ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300'}`}>{dynamicJHI.score}</span>
                                        </div>
                                        <JHIChart
                                            jhi={dynamicJHI}
                                            theme={theme}
                                            highlightGrowth={!!(pathfinderAnalysis?.skillsGapAnalysis?.recommended_resources?.length)}
                                        />
                                    </div>

                                    {/* AI Analysis Section */}
                                    {aiAnalysis ? (
                                        <div className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-500/30 rounded-xl p-6 shadow-sm">
                                            <h3 className="font-bold text-cyan-600 dark:text-cyan-400 mb-2">{t('job_detail.ai_analysis')}</h3>
                                            <p className="text-sm text-slate-700 dark:text-slate-200">{aiAnalysis.summary}</p>
                                        </div>
                                    ) : (
                                        <button onClick={handleAnalyzeJob} disabled={analyzing} className="w-full py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 hover:border-cyan-300 rounded-xl flex items-center justify-center gap-3 text-sm font-bold shadow-sm">
                                            {analyzing ? t('job_detail.analyzing') : t('job_detail.run_ai_analysis')}
                                        </button>
                                    )}

                                    {/* Transparency Card */}
                                    <TransparencyCard data={selectedJob.transparency} variant={theme} />
                                </div>

                                {/* Right Column - Skills Gap Analysis & BullshitMeter */}
                                <div className="space-y-6">
                                    {/* Career Pathfinder - Skills Gap Analysis */}
                                    <SkillsGapBox
                                        skillsGapAnalysis={pathfinderAnalysis?.skillsGapAnalysis || null}
                                        isLoading={pathfinderAnalysis?.isLoading || false}
                                        error={pathfinderAnalysis?.error || null}
                                        theme={theme}
                                        userProfile={{
                                            isLoggedIn: userProfile.isLoggedIn,
                                            hasCV: !!userProfile.cvText || !!userProfile.cvUrl,
                                            name: userProfile.name
                                        }}
                                        onResourceClick={(resource) => {
                                            window.open(resource.url, '_blank');
                                        }}
                                        onShowMarketplace={() => {
                                            setViewState(ViewState.MARKETPLACE);
                                            setSelectedJobId(null);
                                        }}
                                        onShowProfile={() => {
                                            setViewState(ViewState.PROFILE);
                                            setSelectedJobId(null);
                                        }}
                                    />

                                    {/* BullshitMeter */}
                                    <BullshitMeter metrics={selectedJob.noiseMetrics} variant={theme} />
                                </div>
                            </div>
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
