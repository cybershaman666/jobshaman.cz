
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import Markdown from 'markdown-to-jsx';
import { Job, Candidate, AIAdOptimizationResult, CompanyProfile } from '../types';
import { MOCK_COMPANY_PROFILE } from '../constants';
import { optimizeJobDescription } from '../services/geminiService';
import { publishJob } from '../services/jobPublishService';
import { canCompanyUseFeature, canCompanyPostJob } from '../services/billingService';
import { supabase, incrementAdOptimizationUsage } from '../services/supabaseService';
import AnalyticsService from '../services/analyticsService';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import BullshitMeter from './BullshitMeter';
import CompanySettings from './CompanySettings';
import AssessmentCreator from './AssessmentCreator';
import BenefitInsights from './BenefitInsights';
import PlanUpgradeModal from './PlanUpgradeModal';
import AssessmentInvitationModal from './AssessmentInvitationModal';
import MyInvitations from './MyInvitations';
import {
    Briefcase,
    Users,
    TrendingUp,
    PenTool,
    Sparkles,
    CheckCircle,
    Search,
    Settings,
    BrainCircuit,
    DollarSign,
    Clock,
    Zap,
    Filter,
    ArrowRight,
    TrendingDown,
    Target,
    Bold,
    Italic,
    List,
    Heading,
    Link as LinkIcon,
    Quote,
    Code,
    Smile,
    Eye,
    LayoutTemplate,
    RefreshCw,
    Crown,
    Edit,
    Trash2,
    X,
    MoreVertical
} from 'lucide-react';

// Curated Emojis for Job Ads
const JOB_EMOJIS = [
    '🚀', '⭐', '💼', '✅', '🔥', '💰', '🎯', '📍', '📈', '🤝',
    '🎓', '💡', '⏰', '🌍', '💻', '🎉', '🛡️', '🏆', '🦄', '⚖️'
];

interface CompanyDashboardProps {
    companyProfile?: CompanyProfile | null;
    userEmail?: string;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ companyProfile: propProfile, userEmail }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'overview' | 'create-ad' | 'candidates' | 'settings' | 'assessments' | 'marketplace'>('overview');
    const [showUpgradeModal, setShowUpgradeModal] = useState<{ open: boolean, feature?: string }>({ open: false });
    const [showInvitationModal, setShowInvitationModal] = useState(false);
    const [showInvitationsList, setShowInvitationsList] = useState(false);
    const [activeDropdownJobId, setActiveDropdownJobId] = useState<string | null>(null);

    // Real User Detection
    const isRealUser = !!propProfile;

    // Profile State
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(propProfile || MOCK_COMPANY_PROFILE);

    // Data State (Empty for Real, Mocks for Demo)
    // Data State (Empty for initial load, fetched from Supabase)
    const [jobs, setJobs] = useState<Job[]>([]);
    const [candidates] = useState<Candidate[]>([]);

    // Subscription state
    const [subscription, setSubscription] = useState<any>(null);

    const [adDraft, setAdDraft] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [optimizationResult, setOptimizationResult] = useState<AIAdOptimizationResult | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Editor Ref
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Candidate State
    const [selectedJobId, setSelectedJobId] = useState<string>(jobs.length > 0 ? jobs[0].id : '');
    const [candidateMatches, setCandidateMatches] = useState<Record<string, { score: number, reason: string }>>({});
    const [isMatching, setIsMatching] = useState(false);

    // Recruiter Handling
    const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('all');
    const recruiters = companyProfile.members || [
        { id: 'all', name: t('company.dashboard.all_recruiters'), email: '', role: 'admin', joinedAt: '' },
        { id: '1', name: 'Floki Shaman', email: 'floki@jobshaman.cz', role: 'admin', joinedAt: '' }
    ];

    // Load subscription data
    useEffect(() => {
        const loadSubscription = async () => {
            if (!companyProfile?.id) return;

            try {
                const subscriptionData = await getSubscriptionStatus(companyProfile.id);
                setSubscription(subscriptionData);
            } catch (error) {
                console.error('Failed to load subscription:', error);
            }
        };

        loadSubscription();
    }, [companyProfile?.id]);

    // Load initial data for Real User
    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch real jobs
                if (supabase) {
                    const { data: realJobs } = await supabase.from('jobs').select('*').order('scraped_at', { ascending: false });
                    if (realJobs) {
                        setJobs(realJobs as Job[]);
                        if (realJobs.length > 0) setSelectedJobId(realJobs[0].id);
                    }
                }
            } catch (e) {
                console.error("Failed to load dashboard data", e);
            }
        };
        loadData();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.relative')) {
                setActiveDropdownJobId(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handlePublish = async () => {
        if (!jobTitle.trim() || !adDraft.trim()) {
            alert(t('company.ad_editor.fill_required'));
            return;
        }

        // Job Limit Check
        const { allowed, reason } = canCompanyPostJob(companyProfile, userEmail);

        if (!allowed) {
            // Track upgrade trigger
            AnalyticsService.trackUpgradeTrigger({
                companyId: companyProfile?.id,
                feature: 'JOB_POSTING',
                currentTier: companyProfile?.subscription?.tier || 'basic',
                reason: reason || 'Job posting limit exceeded'
            });

            setShowUpgradeModal({ open: true, feature: t('company_extra.features.more_than_5') });
            return;
        }

        setIsPublishing(true);
        try {
            await publishJob({
                title: jobTitle,
                company: companyProfile.name,
                description: adDraft,
                location: companyProfile.address || 'Česká republika',
            });
            alert(t('company.ad_editor.publish_success'));
            if (isRealUser) {
                setAdDraft('');
                setJobTitle('');
            }
        } catch (e) {
            console.error(e);
            alert(t('company.ad_editor.publish_error'));
        } finally {
            setIsPublishing(false);
        }
    };

    const handleOptimize = async () => {
        // Feature Gating
        if (!canCompanyUseFeature(companyProfile, 'COMPANY_AI_AD', userEmail)) {
            // Track upgrade trigger
            AnalyticsService.trackUpgradeTrigger({
                companyId: companyProfile?.id,
                feature: 'COMPANY_AI_AD',
                currentTier: companyProfile?.subscription?.tier || 'basic',
                reason: 'AI ad optimization feature access denied'
            });

            setShowUpgradeModal({ open: true, feature: t('company_extra.features.ai_optimization') });
            return;
        }

        setIsOptimizing(true);
        try {
            const result = await optimizeJobDescription(adDraft, companyProfile);
            setOptimizationResult(result);
            if (result) {
                setViewMode('write');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsOptimizing(false);
        }
    };

    const applyOptimization = async () => {
        if (optimizationResult) {
            setAdDraft(optimizationResult.rewrittenText);
            setOptimizationResult(null);

            // Track usage for companies
            if (companyProfile?.id) {
                await incrementAdOptimizationUsage(companyProfile.id);

                // Track feature usage analytics
                AnalyticsService.trackFeatureUsage({
                    companyId: companyProfile.id,
                    feature: 'AI_AD_OPTIMIZATION',
                    tier: companyProfile.subscription?.tier || 'basic'
                });
            }
        }
    };

    const insertFormat = (before: string, after: string) => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = adDraft;
        const newText = text.substring(0, start) + before + text.substring(start, end) + after + text.substring(end);
        setAdDraft(newText);

        // Restore focus and selection
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start + before.length, end + before.length);
            }
        }, 0);
    };

    const insertEmoji = (emoji: string) => {
        insertFormat(emoji, '');
        setShowEmojiPicker(false);
    };

    const runCandidateMatch = () => {
        setIsMatching(true);
        // Simulate or run actual matching logic
        setTimeout(() => {
            const matches: Record<string, { score: number, reason: string }> = {};
            candidates.forEach(c => {
                const score = 60 + Math.floor(Math.random() * 35);
                matches[c.id] = {
                    score,
                    reason: "Shoda v dovednostech: React, TypeScript"
                };
            });
            setCandidateMatches(matches);
            setIsMatching(false);
        }, 1500);
    };

    const handleEditJob = (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            setJobTitle(job.title);
            setAdDraft(job.description);
            setActiveTab('create-ad');
            setActiveDropdownJobId(null);
        }
    };

    const handleDeleteJob = (jobId: string) => {
        if (confirm(t('company.dashboard.actions.confirm_delete'))) {
            setJobs(jobs.filter(job => job.id !== jobId));
            setActiveDropdownJobId(null);
        }
    };

    const handleCloseJob = (jobId: string) => {
        if (confirm(t('company.dashboard.actions.confirm_close'))) {
            setJobs(jobs.map(job =>
                job.id === jobId ? { ...job, status: 'closed' } : job
            ));
            setActiveDropdownJobId(null);
        }
    };

    const toggleDropdown = (jobId: string) => {
        setActiveDropdownJobId(activeDropdownJobId === jobId ? null : jobId);
    };

    const renderOverview = () => {
        // Show Empty State if no jobs
        if (jobs.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <Briefcase size={40} className="text-slate-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('company.dashboard.welcome_title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md text-center mb-8">
                        {t('company.dashboard.empty_state_desc')}
                    </p>
                    <button
                        onClick={() => setActiveTab('create-ad')}
                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-500 transition-colors flex items-center gap-2"
                    >
                        <PenTool size={20} />
                        {t('company.dashboard.create_first_ad')}
                    </button>
                </div>
            );
        }

        const agencySavings = 450000;
        const percentSpent = 65;
        const projectedSpend = 1200000;
        const costPerHire = 12500;
        const marketAvgCostPerHire = 35000;

        return (
            <div className="space-y-6 animate-in fade-in">
                {/* Subscription Status Card */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 mb-1">{t('company.subscription.title')}</h3>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {subscription?.tier === 'business' ? t('company.subscription.tiers.business') : subscription?.tier === 'basic' ? t('company.subscription.tiers.basic') : t('company.subscription.tiers.free')} Plan
                                </span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${subscription?.tier === 'free' || !subscription?.status
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : subscription?.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                    }`}>
                                    {subscription?.tier === 'free' || !subscription?.status ? t('company.subscription.active') : subscription?.status === 'active' ? t('company.subscription.active') : t('company.subscription.inactive')}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            {subscription?.expiresAt && subscription?.tier !== 'free' && (
                                <div className="text-sm text-indigo-700 dark:text-indigo-300">
                                    <div className="font-medium">{t('company.subscription.next_payment')}</div>
                                    <div className="font-mono">{new Date(subscription.expiresAt).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')}</div>
                                    <div className="text-xs opacity-75">({t('company.subscription.days_left', { count: subscription.daysUntilRenewal || 0 })})</div>
                                </div>
                            )}
                            <div className="mt-2">
                                <button
                                    onClick={() => setShowUpgradeModal({ open: true, feature: 'Změna plánu' })}
                                    className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-medium"
                                >
                                    {t('company.subscription.manage')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Credits and Usage */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-indigo-200 dark:border-indigo-800">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.ai_assessments')}</span>
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {subscription?.assessmentsAvailable || 0}
                            </div>
                            <div className="text-xs text-slate-500">
                                {subscription?.assessmentsUsed || 0} {t('company.subscription.used')}
                            </div>
                            {subscription?.tier === 'free' && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                                    <button
                                        onClick={() => setShowUpgradeModal({ open: true, feature: 'AI Assessmenty' })}
                                        className="underline hover:no-underline"
                                    >
                                        {t('company.subscription.buy_credits')}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Briefcase className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.job_ads')}</span>
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {subscription?.tier === 'business' ? t('company.subscription.unlimited') : subscription?.tier === 'basic' || subscription?.tier === 'free' ? '3' : '0'}
                            </div>
                            <div className="text-xs text-slate-500">
                                {subscription?.tier === 'business' ? t('company.subscription.no_limit') : t('company.subscription.this_month')}
                            </div>
                            {subscription?.tier === 'free' && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                                    <button
                                        onClick={() => setShowUpgradeModal({ open: true, feature: 'Více inzerátů' })}
                                        className="underline hover:no-underline"
                                    >
                                        {t('company.subscription.upgrade')}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.team_members')}</span>
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {companyProfile?.members?.length || 1}
                            </div>
                            <div className="text-xs text-slate-500">
                                {subscription?.tier === 'business' ? t('company.subscription.unlimited') : t('company.subscription.no_limit')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Header & Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('company.dashboard.title')}</h2>
                        <p className="text-sm text-slate-500">{t('company.dashboard.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setActiveTab('create-ad')}
                            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-500 transition-colors flex items-center gap-2"
                        >
                            <PenTool size={18} />
                            {t('company.dashboard.create_ad_btn')}
                        </button>
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                            <Users size={16} className="ml-2 text-slate-400" />
                            <select
                                value={selectedRecruiterId}
                                onChange={(e) => setSelectedRecruiterId(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-300 pr-8 cursor-pointer"
                            >
                                <option value="all">{t('company.dashboard.all_recruiters')}</option>
                                {recruiters.filter(r => r.id !== 'all').map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Pipeline Metric */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{t('company.dashboard.stats.pipeline')}</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">1,240</div>
                            </div>
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <Users size={20} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                <div className="bg-emerald-500 w-[30%]" title="New: 340"></div>
                                <div className="bg-blue-500 w-[45%]" title="Screening: 520"></div>
                                <div className="bg-purple-500 w-[15%]" title="Interview: 280"></div>
                                <div className="bg-amber-500 w-[10%]" title="Offer: 100"></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>New</span>
                                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Screen</span>
                                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>Int</span>
                                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>Off</span>
                            </div>
                        </div>
                    </div>

                    {/* Quality Metric */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{t('company.dashboard.stats.match_score')}</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">68<span className="text-lg text-slate-400 font-normal">/100</span></div>
                            </div>
                            <div className="p-2 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
                                <Target size={20} />
                            </div>
                        </div>
                        <div className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium bg-emerald-50 dark:bg-emerald-900/10 py-1 px-2 rounded w-fit mb-2">
                            <TrendingUp size={14} /> +12% Open Rate
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Vs Market Avg: <span className="font-bold text-slate-700 dark:text-slate-300">55/100</span>.
                        </p>
                    </div>

                    {/* Time to Hire Metric */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{t('company.dashboard.stats.time_to_hire')}</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">24 <span className="text-lg font-normal text-slate-500">{t('company.dashboard.stats.days')}</span></div>
                            </div>
                            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                                <Clock size={20} />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-sm border-t border-slate-100 dark:border-slate-800 pt-2">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <TrendingDown size={14} /> -8 {t('company.dashboard.stats.days')}
                            </span>
                            <span className="text-slate-400">{t('company.dashboard.stats.vs_avg')}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                            <div className="flex justify-between">
                                <span>IT / Tech</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">18 {t('company_extra.stats.days_unit')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Marketing</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">31 {t('company_extra.stats.days_unit')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Budget Metric */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{t('company.dashboard.stats.saved')}</div>
                                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {(agencySavings / 1000).toFixed(0)}k <span className="text-lg font-normal text-slate-500 dark:text-slate-400">CZK</span>
                                </div>
                            </div>
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                                <DollarSign size={20} />
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1 mt-2">
                            <div
                                className={`h-full rounded-full ${percentSpent > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                style={{ width: `${percentSpent}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                            <span>{t('company.dashboard.stats.spent')}: {(percentSpent).toFixed(0)}%</span>
                            <span>{t('company.dashboard.stats.projected')}: {(projectedSpend / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Cost/Hire</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{costPerHire.toLocaleString()} Kč</span>
                            </div>
                            <div className="text-xs text-right text-emerald-500">
                                vs. {marketAvgCostPerHire.toLocaleString()} (Trh)
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Predictive Insights */}
                <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-indigo-500">
                        <BrainCircuit size={80} />
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 z-10">
                        <Sparkles size={20} />
                    </div>
                    <div className="flex-1 z-10">
                        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-1">{t('company.dashboard.ai_insights.title')}</h3>
                        <div className="flex flex-col md:flex-row gap-4 text-sm text-indigo-800 dark:text-indigo-300">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500" />
                                <span>{t('company.dashboard.ai_insights.hired_prediction', { days: 21, count: 45 })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ArrowRight size={14} className="text-amber-500" />
                                <span>{t('company.dashboard.ai_insights.low_match_warning', { avg: 22 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Active Postings Table */}
                    <div className="xl:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Briefcase size={20} className="text-cyan-600" /> {t('company.dashboard.active_postings')}
                            </h3>
                            <div className="flex gap-2">
                                <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    <Search size={16} />
                                </button>
                                <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    <Filter size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-mono text-xs">
                                        <tr>
                                            <th className="px-4 py-3">{t('company.dashboard.table.position')}</th>
                                            <th className="px-4 py-3">{t('company.dashboard.table.pipeline')}</th>
                                            <th className="px-4 py-3 text-center">{t('company.dashboard.table.ai_match')}</th>
                                            <th className="px-4 py-3 text-center">{t('company.dashboard.table.performance')}</th>
                                            <th className="px-4 py-3 text-right">{t('company.dashboard.table.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                        {jobs.slice(0, 5).map((job) => {
                                            let baseViews = 200;
                                            let conversionRate = 0.08;
                                            if (job.title.includes('React')) { baseViews = 450; conversionRate = 0.12; }
                                            if (job.title.includes('Crypto')) { baseViews = 800; conversionRate = 0.02; }
                                            if (job.title.includes('Store')) { baseViews = 600; conversionRate = 0.18; }

                                            const views = Math.floor(baseViews * (0.8 + Math.random() * 0.4));
                                            const applied = Math.floor(views * (conversionRate * (0.9 + Math.random() * 0.2)));
                                            const realConversion = (applied / views) * 100;
                                            const avgMatch = Math.floor(Math.random() * 30) + 60;
                                            const isLowPerf = realConversion < 4;

                                            return (
                                                <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{job.title}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                            {job.location} • {job.postedAt}
                                                            {isLowPerf && <span className="text-rose-500 font-bold ml-1 flex items-center gap-0.5"><TrendingDown size={12} /> {t('company.dashboard.stats.low_perf')}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{applied}</span>
                                                            <span className="text-xs text-slate-400">{t('company.dashboard.stats.candidates_count')}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (applied / 50) * 100)}%` }}></div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${avgMatch > 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                            {avgMatch}%
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                                            {views} views
                                                        </div>
                                                        <div className={`text-[10px] ${isLowPerf ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                            {realConversion.toFixed(1)}% conv
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => toggleDropdown(job.id)}
                                                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>

                                                            {activeDropdownJobId === job.id && (
                                                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-lg z-50">
                                                                    <button
                                                                        onClick={() => handleEditJob(job.id)}
                                                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <Edit size={14} />
                                                                        {t('company.dashboard.actions.edit')}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCloseJob(job.id)}
                                                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <X size={14} />
                                                                        {t('company.dashboard.actions.close')}
                                                                    </button>
                                                                    <div className="border-t border-slate-200 dark:border-slate-700"></div>
                                                                    <button
                                                                        onClick={() => handleDeleteJob(job.id)}
                                                                        className="w-full text-left px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        {t('company.dashboard.actions.delete')}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Feed & Team */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                <Zap size={16} className="text-amber-500" />
                                {t('company.dashboard.team_activity')}
                            </div>
                            <div className="space-y-4">
                                <div className="flex gap-3 relative pb-4 border-l-2 border-slate-100 dark:border-slate-800 pl-4 ml-2">
                                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900"></div>
                                    <div className="text-xs">
                                        <p className="text-slate-900 dark:text-white" dangerouslySetInnerHTML={{ __html: t('company_extra.activity.added_comment', { name: 'Floki', target: 'Jan Novák' }) }} />
                                        <p className="text-slate-500 mt-0.5">{t('company_extra.activity.time_ago', { count: 20 })}</p>
                                        <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-950 rounded text-slate-600 dark:text-slate-400 italic">
                                            "{t('company_extra.activity.no_redux')}"
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 relative pl-4 ml-2">
                                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900"></div>
                                    <div className="text-xs">
                                        <p className="text-slate-900 dark:text-white" dangerouslySetInnerHTML={{ __html: t('company_extra.activity.rejected_spam', { count: 15 }) }} />
                                        <p className="text-slate-500 mt-0.5">{t('company_extra.activity.hour_ago', { count: 1 })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                <Crown size={16} className="text-indigo-500" />
                                {t('company.dashboard.leaderboard')}
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300">P</div>
                                        <div className="text-xs">
                                            <div className="font-bold dark:text-white">Petra N..</div>
                                            <div className="text-slate-500">8 {t('company_extra.stats.hires')}</div>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs">
                                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">19 {t('company_extra.stats.days_unit')}</div>
                                        <div className="text-slate-400">{t('company_extra.stats.avg_tth')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCreateAd = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px] animate-in slide-in-from-right-4">
            <div className="lg:col-span-8 flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden order-2 lg:order-1">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <PenTool size={16} /> {t('company.ad_editor.title')}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">{t('company.ad_editor.tone_prefix')} <span className="font-semibold text-slate-700 dark:text-slate-300">{companyProfile.tone}</span></span>
                </div>

                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('company.ad_editor.position_name')}</label>
                    <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder={t('company.ad_editor.placeholder_title')}
                        className="w-full text-xl font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                    />
                </div>

                <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <button onClick={() => setViewMode(viewMode === 'write' ? 'preview' : 'write')} className={`p-1.5 rounded transition-colors flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'preview' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`} title={t('company.ad_editor.switch_preview')}>
                        {viewMode === 'preview' ? <Eye size={16} /> : <LayoutTemplate size={16} />}
                        {viewMode === 'preview' ? t('company.ad_editor.preview') : t('company.ad_editor.editor')}
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <button onClick={() => insertFormat('**', '**')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title={t('company.ad_editor.bold')}>
                        <Bold size={16} />
                    </button>
                    <button onClick={() => insertFormat('*', '*')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title={t('company.ad_editor.italic')}>
                        <Italic size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <button onClick={() => insertFormat('\n### ', '\n')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title={t('company.ad_editor.heading')}>
                        <Heading size={16} />
                    </button>
                    <button onClick={() => insertFormat('\n- ', '')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title={t('company.ad_editor.list')}>
                        <List size={16} />
                    </button>
                    <button onClick={() => insertFormat('\n> ', '\n')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title={t('company.ad_editor.quote')}>
                        <Quote size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <div className="relative">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors ${showEmojiPicker ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''}`}
                            title={t('company.ad_editor.emoji')}
                        >
                            <Smile size={16} />
                        </button>

                        {showEmojiPicker && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-3 z-50 grid grid-cols-5 gap-1 animate-in zoom-in-95">
                                {JOB_EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => insertEmoji(emoji)}
                                        className="h-9 w-9 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <button onClick={() => insertFormat('[', '](url)')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title={t('company.ad_editor.link')}>
                        <LinkIcon size={16} />
                    </button>
                    <button onClick={() => insertFormat('`', '`')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title={t('company.ad_editor.code')}>
                        <Code size={16} />
                    </button>
                </div>

                {viewMode === 'write' ? (
                    <textarea
                        ref={textareaRef}
                        className="flex-1 w-full p-6 resize-none focus:outline-none text-slate-800 dark:text-slate-200 font-mono text-base leading-relaxed bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={adDraft}
                        onChange={(e) => setAdDraft(e.target.value)}
                        placeholder={t('company.ad_editor.placeholder_description')}
                    />
                ) : (
                    <div className="flex-1 w-full p-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950/30">
                        <article className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                            <Markdown>{adDraft}</Markdown>
                        </article>
                    </div>
                )}

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex justify-end gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mr-auto">
                        <Settings size={14} />
                        Profil: {companyProfile.name}
                    </div>
                    <button
                        onClick={handleOptimize}
                        disabled={isOptimizing}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 shadow-sm disabled:opacity-50"
                    >
                        {isOptimizing ? <Sparkles className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        {isOptimizing ? t('company.ad_editor.analyzing') : t('company.ad_editor.ai_noise_btn')}
                    </button>

                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                    >
                        {isPublishing ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                        {isPublishing ? t('company.ad_editor.publishing') : t('company.ad_editor.publish_btn')}
                    </button>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar order-1 lg:order-2 h-full">
                {optimizationResult && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-6 animate-in zoom-in-95 shadow-sm">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-4">
                            <CheckCircle size={20} />
                            <h3 className="font-bold">{t('company.ad_editor.optimization_title')}</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase block mb-1">{t('company.ad_editor.what_removed')}</span>
                                <div className="flex flex-wrap gap-1">
                                    {optimizationResult.removedCliches.map((w, i) => (
                                        <span key={i} className="text-xs bg-rose-500/10 text-rose-500 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 line-through">
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase block mb-1">{t('company.ad_editor.why_better')}</span>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{optimizationResult.improvedClarity}</p>
                            </div>

                            <div className="border-t border-emerald-200 dark:border-emerald-900/50 pt-4">
                                <button
                                    onClick={applyOptimization}
                                    className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors shadow-sm"
                                >
                                    {t('company.ad_editor.use_text_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <BullshitMeter metrics={{
                    score: adDraft.toLowerCase().includes('ninja') || adDraft.toLowerCase().includes('rockstar') ? 85 : 20,
                    flags: adDraft.toLowerCase().includes('ninja') ? ['Ninja', 'Hype', 'Grind'] : [],
                    tone: adDraft.toLowerCase().includes('ninja') ? 'Hype-heavy' : 'Professional'
                }} variant="dark" />

                <BenefitInsights />
            </div>
        </div>
    );

    const renderCandidates = () => {
        if (isRealUser && candidates.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <Users size={32} className="text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('company.candidates.no_candidates_title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                        {t('company.candidates.no_candidates_desc')}
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg">
                            <Briefcase size={20} />
                        </div>
                        <select
                            value={selectedJobId}
                            onChange={(e) => setSelectedJobId(e.target.value)}
                            className="bg-transparent font-semibold text-slate-900 dark:text-slate-200 focus:outline-none cursor-pointer border-none ring-0"
                        >
                            {jobs.map(job => (
                                <option key={job.id} value={job.id} className="bg-white dark:bg-slate-900">{job.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full md:w-auto flex flex-col items-end gap-1">
                        <button
                            onClick={runCandidateMatch}
                            disabled={isMatching}
                            className="w-full md:w-auto px-6 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                            {isMatching ? <Sparkles className="animate-spin" size={16} /> : <Search size={16} />}
                            {isMatching ? t('company.candidates.matching_analysing') : t('company.candidates.match_btn')}
                        </button>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium italic pr-1">
                            AI doporučuje. Rozhoduje člověk.
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {candidates.map(candidate => {
                        const match = candidateMatches[candidate.id];
                        return (
                            <div key={candidate.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-all relative overflow-hidden group">
                                {match && (
                                    <div className="absolute top-0 right-0 p-4 text-right">
                                        <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400 font-mono">{match.score}%</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Shoda</div>
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{candidate.name}</h3>
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded font-medium border border-slate-200 dark:border-slate-700">{candidate.role || (candidate as any).job_title}</span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4 max-w-2xl">{candidate.bio}</p>

                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {candidate.skills.map(skill => (
                                                <span key={skill} className="px-2 py-1 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded font-medium bg-slate-50 dark:bg-slate-950/50">
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Briefcase size={14} /> {candidate.experienceYears} let praxe
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <TrendingUp size={14} />
                                                {candidate.salaryExpectation.toLocaleString()} Kč/měs
                                            </span>
                                        </div>
                                    </div>

                                    {/* Risk Assessment Card */}
                                    <div className="md:w-64 bg-slate-50 dark:bg-slate-950/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 font-mono">Analýza Rizik</h4>

                                        <div className="mb-3">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-slate-500 dark:text-slate-400">Riziko odchodu</span>
                                                <span className={`font-bold ${candidate.flightRisk === 'High' ? 'text-rose-500' : candidate.flightRisk === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {candidate.flightRisk === 'High' ? 'Vysoké' : candidate.flightRisk === 'Medium' ? 'Střední' : 'Nízké'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full">
                                                <div
                                                    className={`h-1.5 rounded-full ${candidate.flightRisk === 'High' ? 'bg-rose-500' : candidate.flightRisk === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                    style={{ width: candidate.flightRisk === 'High' ? '80%' : candidate.flightRisk === 'Medium' ? '50%' : '20%' }}
                                                ></div>
                                            </div>
                                        </div>

                                        {match && (
                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{match.reason}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-[1920px] mx-auto min-h-full pb-10">
            {/* Company Header */}
            <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('company.portal.title')}</h1>
                    <p className="text-slate-500 dark:text-slate-400">{t('company.portal.subtitle')}</p>
                </div>

                <div className="flex flex-wrap bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.dashboard.tabs.overview')}
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.dashboard.tabs.dna_culture')}
                    </button>
                    <button
                        onClick={() => setActiveTab('create-ad')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'create-ad' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.dashboard.tabs.ai_editor')}
                    </button>
                    <button
                        onClick={() => setActiveTab('assessments')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'assessments' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.dashboard.tabs.assessments')}
                    </button>
                    <button
                        onClick={() => setActiveTab('candidates')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'candidates' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.dashboard.tabs.candidates')}
                    </button>
                    <button
                        onClick={() => setActiveTab('marketplace')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'marketplace' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.dashboard.tabs.marketplace')}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'settings' && <CompanySettings profile={companyProfile} onSave={setCompanyProfile} />}
                {activeTab === 'create-ad' && renderCreateAd()}
                {activeTab === 'assessments' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-slate-500">Vytvářejte a spravujte interview‑replacement assessmenty</div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowInvitationsList(prev => !prev)} className="px-3 py-1 rounded-md border text-sm">{showInvitationsList ? 'Zavřít pozvánky' : 'Spravovat pozvánky'}</button>
                                <button onClick={() => setShowInvitationModal(true)} className="px-3 py-1 rounded-md bg-cyan-600 text-white text-sm">Pozvat kandidáta</button>
                            </div>
                        </div>

                        {showInvitationsList && (
                            <div className="mb-6">
                                <MyInvitations forCompany />
                            </div>
                        )}

                        {showInvitationModal && (
                            <AssessmentInvitationModal
                                companyId={companyProfile?.id || ''}
                                onClose={() => setShowInvitationModal(false)}
                                onSent={() => setShowInvitationsList(true)}
                            />
                        )}

                        <AssessmentCreator companyProfile={companyProfile} />
                    </div>
                )}
                {activeTab === 'candidates' && renderCandidates()}
                {/* {activeTab === 'marketplace' && <CompanyMarketplace />} */}
            </div>

            <PlanUpgradeModal
                isOpen={showUpgradeModal.open}
                onClose={() => setShowUpgradeModal({ open: false })}
                feature={showUpgradeModal.feature}
                companyProfile={companyProfile}
            />
        </div>
    );
};

export default CompanyDashboard;
