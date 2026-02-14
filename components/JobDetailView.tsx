import React, { RefObject } from 'react';
import { Job, UserProfile, CommuteAnalysis, ViewState, AIAnalysisResult } from '../types';
import FinancialCard from './FinancialCard';
import WelcomePage from './WelcomePage';
import JHIChart from './JHIChart';
import BullshitMeter from './BullshitMeter';
import TransparencyCard from './TransparencyCard';
import ContextualRelevance from './ContextualRelevance';
import { ArrowUpRight, Bookmark, Gift, Zap, Share2, Sparkles, Home, Briefcase } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Markdown from 'markdown-to-jsx';
import { getCompanyLogoUrl, getCompanyPublicInfo, trackAnalyticsEvent } from '../services/supabaseService';
import { useEffect } from 'react';
import { removeAccents } from '../utils/benefits';

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
    handleAuthAction: (mode?: 'login' | 'register') => void;
    setViewState: (view: ViewState) => void;
    showFinancialMethodology: boolean;
    setShowFinancialMethodology: (show: boolean) => void;
    getTransportIcon: (mode: string) => React.ComponentType<any>;
    formatJobDescription: (description: string) => string;
    theme: 'light' | 'dark';
    aiAnalysis: AIAnalysisResult | null;
    analyzing: boolean;
    handleAnalyzeJob: () => void;
    selectedBlogPostSlug: string | null;
    handleBlogPostSelect: (slug: string | null) => void;
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
    aiAnalysis,
    analyzing,
    handleAnalyzeJob,
    selectedBlogPostSlug,
    handleBlogPostSelect
}) => {
    const { t } = useTranslation();
    const highValueKeywords = [
        'remote',
        'home office',
        'flex',
        'flexibil',
        '5 tydn',
        '25 dn',
        'dovolena navic',
        'vzdel',
        'skoleni',
        'cert',
        'penzij',
        'pension',
        'bonus',
        'prem',
        'akcie',
        'stock',
        'zdravot',
        'sick',
        'multisport'
    ];

    const isHighValueBenefit = (benefit: string) => {
        const normalized = removeAccents(benefit);
        return highValueKeywords.some(keyword => normalized.includes(keyword));
    };
    const [shareTooltip, setShareTooltip] = React.useState(false);
    const [companyLogoUrl, setCompanyLogoUrl] = React.useState<string | null>(null);
    const [companyPublicInfo, setCompanyPublicInfo] = React.useState<any | null>(null);

    const formatWorkModelLabel = (raw: string) => {
        if (!raw) return t('job.work_model.unknown') || t('job.contract_types.unknown') || 'Neuvedeno';
        const normalized = raw.trim().toLowerCase();
        const key = normalized
            .replace(/\s+/g, '_')
            .replace(/-+/g, '_')
            .replace(/[^\wáčďéěíňóřšťúůýž]+/g, '');

        const labelMap: Record<string, string> = {
            remote: t('job.work_model.remote') || 'Remote',
            hybrid: t('job.work_model.hybrid') || 'Hybrid',
            on_site: t('job.work_model.on_site') || 'On-site',
            onsite: t('job.work_model.on_site') || 'On-site'
        };

        return labelMap[key] || raw;
    };

    const handleShare = async () => {
        if (!selectedJob) return;

        const shareUrl = `${window.location.origin}/jobs/${selectedJob.id}`;

        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareTooltip(true);
            setTimeout(() => setShareTooltip(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Track job view
    useEffect(() => {
        if (selectedJobId && selectedJob) {
            trackAnalyticsEvent({
                event_type: 'job_view',
                user_id: userProfile.id,
                company_id: selectedJob.company_id,
                metadata: {
                    job_id: selectedJobId,
                    job_title: selectedJob.title
                }
            });
        }
    }, [selectedJobId, selectedJob?.id]);

    useEffect(() => {
        let isMounted = true;
        const loadLogo = async () => {
            if (!selectedJob?.company_id) {
                if (isMounted) setCompanyLogoUrl(null);
                if (isMounted) setCompanyPublicInfo(null);
                return;
            }
            const logo = await getCompanyLogoUrl(selectedJob.company_id);
            if (isMounted) setCompanyLogoUrl(logo);
            const info = await getCompanyPublicInfo(selectedJob.company_id);
            if (isMounted) setCompanyPublicInfo(info);
        };
        loadLogo();
        return () => { isMounted = false; };
    }, [selectedJob?.company_id]);

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
                                    {companyLogoUrl && (
                                        <img src={companyLogoUrl} alt={selectedJob.company} className="w-7 h-7 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
                                    )}
                                    <span className="text-cyan-600 dark:text-cyan-400">{selectedJob.company}</span>
                                    <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                    <span className="text-slate-600 dark:text-slate-300">{selectedJob.location}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <Briefcase size={12} /> {selectedJob.type}
                                    </span>
                                    {selectedJob.work_model && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <Home size={12} /> {formatWorkModelLabel(selectedJob.work_model)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-none">
                                <div className="relative">
                                    <button
                                        onClick={handleShare}
                                        className="p-2.5 rounded-lg border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                        title={t('app.share')}
                                    >
                                        <Share2 size={20} />
                                    </button>
                                    {shareTooltip && (
                                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-lg">
                                            {t('app.link_copied')}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => handleToggleSave(selectedJob.id)} className={`p-2.5 rounded-lg border transition-all ${savedJobIds.includes(selectedJob.id) ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200'}`}>
                                    <Bookmark size={20} className={savedJobIds.includes(selectedJob.id) ? "fill-current" : ""} />
                                </button>

                                {selectedJob.source !== 'jobshaman.cz' && selectedJob.url ? (
                                    <a
                                        href={selectedJob.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-slate-900 dark:bg-cyan-500/15 hover:bg-slate-800 dark:hover:bg-cyan-500/25 text-white dark:text-cyan-200 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm dark:ring-1 dark:ring-cyan-500/50 active:scale-95"
                                    >
                                        {t('app.i_am_interested')} <ArrowUpRight size={18} />
                                    </a>
                                ) : (
                                    <button onClick={() => setIsApplyModalOpen(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-cyan-500/15 hover:bg-slate-800 dark:hover:bg-cyan-500/25 text-white dark:text-cyan-200 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm dark:ring-1 dark:ring-cyan-500/50 active:scale-95">
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
                                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-6 border border-cyan-200 dark:border-cyan-900/40">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Gift className="text-cyan-600 dark:text-cyan-400" size={20} />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('job.benefits')}</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedJob.benefits.map((benefit, idx) => {
                                            const highlight = isHighValueBenefit(benefit);
                                            return (
                                                <span
                                                    key={idx}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                                                        highlight
                                                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                                            : 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                                                    }`}
                                                >
                                                    {highlight && <Sparkles size={14} className="text-white" />}
                                                    {benefit}
                                                </span>
                                            );
                                        })}
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

                            {/* Company Legal Info */}
                            {(companyPublicInfo?.legal_address || companyPublicInfo?.registry_info || companyPublicInfo?.ico || companyPublicInfo?.dic) && (
                                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                                        {t('job_detail.company_legal_title')}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
                                        {companyPublicInfo?.ico && (
                                            <div><span className="font-semibold">{t('job_detail.company_ico')}:</span> {companyPublicInfo.ico}</div>
                                        )}
                                        {companyPublicInfo?.dic && (
                                            <div><span className="font-semibold">{t('job_detail.company_dic')}:</span> {companyPublicInfo.dic}</div>
                                        )}
                                        {companyPublicInfo?.legal_address && (
                                            <div className="md:col-span-2"><span className="font-semibold">{t('job_detail.company_legal_address')}:</span> {companyPublicInfo.legal_address}</div>
                                        )}
                                        {companyPublicInfo?.registry_info && (
                                            <div className="md:col-span-2"><span className="font-semibold">{t('job_detail.company_registry')}:</span> {companyPublicInfo.registry_info}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* GDPR Consent Notice */}
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {t('job_detail.gdpr_consent')}
                            </div>
                        </div>

                        {/* Bottom section with JHI Chart and Analysis */}
                        <div className="bg-slate-50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-800 p-6 sm:p-8">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {/* Left Column - JHI Chart and AI Analysis */}
                                <div className="space-y-6">
                                    {/* JHI Chart with Spider Graph */}
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"><Zap size={20} /></div>
                                                <div><h3 className="text-slate-900 dark:text-slate-100 font-bold">{t('job_detail.jhi_title')}</h3><p className="text-slate-500 dark:text-slate-400 text-xs">{t('job_detail.jhi_desc')}</p></div>
                                            </div>
                                            <span className={`text-3xl font-mono font-bold ${commuteAnalysis ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300'}`}>{dynamicJHI.score}</span>
                                        </div>
                                        {(!selectedJob?.salary_from && !selectedJob?.salary_to) && (
                                            <div className="mb-4 text-[11px] text-amber-700 dark:text-amber-400">
                                                {t('job_detail.jhi_missing_salary_hint') || 'Nízké JHI je způsobené chybějící mzdou v inzerátu.'}
                                            </div>
                                        )}
                                        <JHIChart
                                            jhi={dynamicJHI}
                                            theme={theme}
                                            highlightGrowth={false}
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

                                    {typeof selectedJob.aiMatchScore === 'number' && (
                                        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-6 shadow-sm">
                                            <h3 className="font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                                                AI Doporučení: {Math.round(selectedJob.aiMatchScore)}%
                                            </h3>
                                            {selectedJob.aiMatchBreakdown && (
                                                <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                    skill={Math.round((selectedJob.aiMatchBreakdown.skill_match || 0) * 100)}% ·
                                                    demand={Math.round((selectedJob.aiMatchBreakdown.demand_boost || 0) * 100)}% ·
                                                    salary={Math.round((selectedJob.aiMatchBreakdown.salary_alignment || 0) * 100)}%
                                                </div>
                                            )}
                                            {!!selectedJob.aiMatchReasons?.length && (
                                                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1 list-disc pl-5">
                                                    {selectedJob.aiMatchReasons.slice(0, 3).map((reason, idx) => (
                                                        <li key={`${reason}-${idx}`}>{reason}</li>
                                                    ))}
                                                </ul>
                                            )}
                                            {!!selectedJob.aiMatchBreakdown?.missing_core_skills?.length && (
                                                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                                    Chybějící klíčové dovednosti: {selectedJob.aiMatchBreakdown.missing_core_skills.slice(0, 3).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Transparency Card */}
                                    <TransparencyCard variant={theme} />
                                </div>

                                {/* Right Column - BullshitMeter */}
                                <div className="space-y-6">
                                    {/* BullshitMeter */}
                                    <BullshitMeter metrics={selectedJob.noiseMetrics} variant={theme} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full overflow-y-auto custom-scrollbar">
                    <WelcomePage
                        onTryFree={() => handleAuthAction('register')}
                        onBrowseOffers={() => {
                            setViewState(ViewState.LIST);
                            setSelectedJobId(null);
                        }}
                        selectedBlogPostSlug={selectedBlogPostSlug}
                        handleBlogPostSelect={handleBlogPostSelect}
                    />
                </div>
            )}
        </section>
    );
};

export default JobDetailView;
