
import React, { useState, useRef } from 'react';
import Markdown from 'markdown-to-jsx';
import { Job, Candidate, AIAdOptimizationResult, CompanyProfile } from '../types';
import { MOCK_CANDIDATES, MOCK_JOBS, MOCK_COMPANY_PROFILE } from '../constants';
import { optimizeJobDescription, matchCandidateToJob } from '../services/geminiService';
import { publishJob, getCandidateMatches } from '../services/jobPublishService';
import { canCompanyUseFeature, canCompanyPostJob, getRemainingAssessments } from '../services/billingService';
import { redirectToCheckout } from '../services/stripeService';
import { supabase } from '../services/supabaseService';
import BullshitMeter from './BullshitMeter';
import CompanySettings from './CompanySettings';
import AssessmentCreator from './AssessmentCreator';
import BenefitInsights from './BenefitInsights';
// import CompanyMarketplace from './CompanyMarketplace';
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
    UserCheck,
    Phone,
    Mail,
    XCircle,
    PauseCircle,
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
    Loader2
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
    const [activeTab, setActiveTab] = useState<'overview' | 'create-ad' | 'candidates' | 'settings' | 'assessments' | 'marketplace'>('overview');
    const [showUpgradeModal, setShowUpgradeModal] = useState<{ open: boolean, feature?: string }>({ open: false });

    // Real User Detection
    // If propProfile exists, we are in "Real" mode and should start empty.
    // If propProfile is null/undefined, we are in "Demo" mode and use Mocks.
    const isRealUser = !!propProfile;

    // Profile State
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(propProfile || MOCK_COMPANY_PROFILE);

    // Data State (Empty for Real, Mocks for Demo)
    const [jobs, setJobs] = useState<Job[]>(isRealUser ? [] : MOCK_JOBS);
    const [candidates, setCandidates] = useState<Candidate[]>(isRealUser ? [] : MOCK_CANDIDATES);

    const [adDraft, setAdDraft] = useState(isRealUser ? '' : MOCK_JOBS[1].description);
    const [jobTitle, setJobTitle] = useState(isRealUser ? '' : MOCK_JOBS[1].title);
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

    const handlePublish = async () => {
        if (!jobTitle.trim() || !adDraft.trim()) {
            alert("Prosím vyplňte název pozice i popis.");
            return;
        }

        // Job Limit Check
        const { allowed, reason } = canCompanyPostJob(companyProfile, userEmail);
        if (!allowed) {
            setShowUpgradeModal({ open: true, feature: 'Více než 5 inzerátů' });
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
            alert("Inzerát byl odeslán ke kontrole a bude brzy zveřejněn!");
            if (isRealUser) {
                setAdDraft('');
                setJobTitle('');
            }
        } catch (e) {
            console.error(e);
            alert("Chyba při zveřejňování inzerátu.");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleOptimize = async () => {
        // Feature Gating
        if (!canCompanyUseFeature(companyProfile, 'COMPANY_AI_AD', userEmail)) {
            setShowUpgradeModal({ open: true, feature: 'AI Optimalizace Inzerátů' });
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

    const PlanUpgradeModal = () => {
        if (!showUpgradeModal.open) return null;

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                    onClick={() => setShowUpgradeModal({ open: false })}
                ></div>
                <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-600 to-blue-600"></div>

                    <div className="p-10 flex flex-col md:flex-row gap-10">
                        <div className="flex-1">
                            <div className="w-16 h-16 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-6">
                                <Crown size={32} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Vylepšete svůj Nábor</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                                Funkce <span className="font-bold text-cyan-600 dark:text-cyan-400">"{showUpgradeModal.feature}"</span> je dostupná v tarifu <span className="font-bold text-slate-900 dark:text-white">Business</span> a vyšším.
                            </p>

                            <div className="space-y-4">
                                {[
                                    { icon: Briefcase, text: 'Neomezený počet inzerátů' },
                                    { icon: BrainCircuit, text: '10 AI Assessmentů měsíčně' },
                                    { icon: Sparkles, text: 'AI Optimalizace inzerátů' },
                                    { icon: Users, text: 'Doporučení vhodných kandidátů' }
                                ].map((f, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
                                            <f.icon size={16} />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{f.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="w-full md:w-64 flex flex-col gap-4">
                            <div className="p-6 bg-cyan-50 dark:bg-cyan-950/20 border-2 border-cyan-500 rounded-2xl relative">
                                <div className="absolute -top-3 right-4 bg-cyan-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Nejoblíbenější</div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1">Business</h3>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">4 990 Kč</span>
                                    <span className="text-xs text-slate-500">/měs</span>
                                </div>
                                <button
                                    onClick={() => {
                                        if (companyProfile.id) {
                                            redirectToCheckout('business', companyProfile.id);
                                        } else {
                                            alert('Chyba: ID firmy nebylo nalezeno. Zkuste prosím znovu načíst stránku.');
                                        }
                                    }}
                                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20"
                                >
                                    Vybrat Business
                                </button>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1">Enterprise</h3>
                                <div className="text-sm text-slate-500 mb-4">Na míru velkým firmám</div>
                                <button
                                    onClick={() => setShowUpgradeModal({ open: false })}
                                    className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl transition-all"
                                >
                                    Kontaktovat nás
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const applyOptimization = () => {
        if (optimizationResult) {
            setAdDraft(optimizationResult.rewrittenText);
            setOptimizationResult(null);
        }
    };

    // Editor Formatting Helper
    const insertFormat = (prefix: string, suffix: string = '') => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = adDraft;
        const before = text.substring(0, start);
        const selection = text.substring(start, end);
        const after = text.substring(end);

        const newText = before + prefix + selection + suffix + after;
        setAdDraft(newText);

        // Restore focus and cursor position after state update
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newCursorPos = start + prefix.length + selection.length + suffix.length;
                // Ideally place cursor inside if selection was empty, or at end if not
                const nextPos = selection.length === 0 ? start + prefix.length : newCursorPos;
                textareaRef.current.setSelectionRange(nextPos, nextPos);
            }
        }, 0);
    };

    const insertEmoji = (emoji: string) => {
        insertFormat(emoji);
        setShowEmojiPicker(false);
    };

    const runCandidateMatch = async () => {
        setIsMatching(true);
        const job = jobs.find(j => j.id === selectedJobId);
        if (!job) return;

        if (isRealUser) {
            try {
                const result = await getCandidateMatches(selectedJobId);
                const newMatches: Record<string, { score: number, reason: string }> = {};
                const backendCandidates: Candidate[] = [];

                result.matches.forEach((m: any) => {
                    newMatches[m.candidate_id] = { score: m.score, reason: m.reasons.join(", ") };
                    // Reconstruct basic candidate info from the backend response
                    backendCandidates.push({
                        id: m.candidate_id,
                        name: m.profile.name,
                        job_title: m.profile.job_title,
                        skills: m.profile.skills,
                        bio: m.profile.bio
                    });
                });

                setCandidates(backendCandidates);
                setCandidateMatches(newMatches);
            } catch (e) {
                console.error("Match fetch failed", e);
            }
        } else {
            const newMatches: Record<string, { score: number, reason: string }> = {};
            // Simulate parallel requests for demo
            for (const c of candidates) {
                const result = await matchCandidateToJob(c.bio + " " + c.skills.join(", "), job.description);
                newMatches[c.id] = result;
            }
            setCandidateMatches(newMatches);
        }

        setIsMatching(false);
    };

    // Load initial data for Real User
    React.useEffect(() => {
        if (isRealUser) {
            const loadData = async () => {
                try {
                    // Fetch real jobs
                    const { data: realJobs } = await supabase.from('jobs').select('*').order('scraped_at', { ascending: false });
                    if (realJobs) {
                        setJobs(realJobs as Job[]);
                        if (realJobs.length > 0) setSelectedJobId(realJobs[0].id);
                    }
                } catch (e) {
                    console.error("Failed to load dashboard data", e);
                }
            };
            loadData();
        }
    }, [isRealUser]);

    // Recruiter Filtering
    const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('all');
    const recruiters = companyProfile.members || [
        { id: 'all', name: 'Všichni náboraři', email: '', role: 'admin', joinedAt: '' },
        { id: '1', name: 'Floki Shaman', email: 'floki@jobshaman.cz', role: 'admin', joinedAt: '' }
    ];

    const filteredJobs = selectedRecruiterId === 'all'
        ? jobs
        : jobs.filter(j => j.company_id === companyProfile.id); // In a real app we'd filter by recruiter_id

    const renderOverview = () => {
        // If Real User & Empty, show Empty State
        if (isRealUser && jobs.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <Sparkles size={40} className="text-slate-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Vítejte v JobShaman, {companyProfile.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md text-center mb-8">
                        Zatím nemáte žádná data. Vytvořte svůj první inzerát pomocí našeho AI editoru a začněte nabírat bez balastu.
                    </p>
                    <button
                        onClick={() => setActiveTab('create-ad')}
                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-500 transition-colors flex items-center gap-2"
                    >
                        <PenTool size={20} />
                        Vytvořit První Inzerát
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-in fade-in">

                {/* Recruiter Selector & Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Přehled Náboru</h2>
                        <p className="text-sm text-slate-500">Statistiky pro celou společnost a jednotlivé náboraře.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <Users size={16} className="ml-2 text-slate-400" />
                        <select
                            value={selectedRecruiterId}
                            onChange={(e) => setSelectedRecruiterId(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-300 pr-8 cursor-pointer"
                        >
                            <option value="all">Všichni náboraři (Celá Firma)</option>
                            {recruiters.filter(r => r.id !== 'all').map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 1. Top Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Pipeline Metric */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Pipeline</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">1,240</div>
                            </div>
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <Users size={20} />
                            </div>
                        </div>

                        {/* Micro Breakdown */}
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
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Match Score</div>
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
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Time to Hire</div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">24 <span className="text-lg font-normal text-slate-500">dní</span></div>
                            </div>
                            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                                <Clock size={20} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 text-sm border-t border-slate-100 dark:border-slate-800 pt-2">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <TrendingDown size={14} /> -8 dní
                            </span>
                            <span className="text-slate-400">vs CZ Průměr (32)</span>
                        </div>

                        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                            <div className="flex justify-between">
                                <span>IT / Tech</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">18 dní</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Marketing</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">31 dní</span>
                            </div>
                        </div>
                    </div>

                    {/* Budget Metric */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Ušetřeno</div>
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
                            <span>Vyčerpáno: {(percentSpent).toFixed(0)}%</span>
                            <span>Proj: {(projectedSpend / 1000000).toFixed(1)}M</span>
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

                {/* 2. AI Predictive Insights */}
                <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-indigo-500">
                        <BrainCircuit size={80} />
                    </div>

                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 z-10">
                        <Sparkles size={20} />
                    </div>

                    <div className="flex-1 z-10">
                        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-1">AI Strategický Vhled</h3>
                        <div className="flex flex-col md:flex-row gap-4 text-sm text-indigo-800 dark:text-indigo-300">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500" />
                                <span><strong>React Senior:</strong> Na základě historie budete mít hired do 21 dnů (45 kandidátů v pipeline). Jste v plánu.</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ArrowRight size={14} className="text-amber-500" />
                                <span><strong>Store Assistant:</strong> Nízká AI shoda (22% avg). Doporučujeme upravit popis pracovní doby v inzerátu.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* 3. Left Column: Active Postings Table (2/3) */}
                    <div className="xl:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Briefcase size={20} className="text-cyan-600" /> Aktivní Inzerce
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
                                            <th className="px-4 py-3">Pozice</th>
                                            <th className="px-4 py-3">Pipeline Health</th>
                                            <th className="px-4 py-3 text-center">AI Shoda</th>
                                            <th className="px-4 py-3 text-center">Výkon</th>
                                            <th className="px-4 py-3 text-right">Akce</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                        {jobs.slice(0, 5).map((job) => {
                                            // Generate stats based on job characteristics to ensure visual consistency
                                            let baseViews = 200;
                                            let conversionRate = 0.08;

                                            // Customize per mock job to ensure realistic demo data
                                            if (job.title.includes('React')) { baseViews = 450; conversionRate = 0.12; }
                                            if (job.title.includes('Crypto')) { baseViews = 800; conversionRate = 0.02; } // Clickbait: High views, low apply
                                            if (job.title.includes('Store')) { baseViews = 600; conversionRate = 0.18; } // High volume

                                            // Add randomness
                                            const views = Math.floor(baseViews * (0.8 + Math.random() * 0.4));
                                            const applied = Math.floor(views * (conversionRate * (0.9 + Math.random() * 0.2)));

                                            const realConversion = (applied / views) * 100;
                                            const avgMatch = Math.floor(Math.random() * 30) + 60;

                                            // Dynamic "Low Performance" badge based on actual calculated conversion (< 4%)
                                            const isLowPerf = realConversion < 4;

                                            return (
                                                <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{job.title}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                            {job.location} • {job.postedAt}
                                                            {isLowPerf && <span className="text-rose-500 font-bold ml-1 flex items-center gap-0.5"><TrendingDown size={12} /> Slabý výkon</span>}
                                                        </div>
                                                    </td>

                                                    {/* Pipeline Visual */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{applied}</span>
                                                            <span className="text-xs text-slate-400">uchazečů</span>
                                                        </div>
                                                        <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                            <div className="bg-emerald-500" style={{ width: '20%' }}></div>
                                                            <div className="bg-blue-500" style={{ width: '40%' }}></div>
                                                            <div className="bg-purple-500" style={{ width: '10%' }}></div>
                                                        </div>
                                                    </td>

                                                    {/* AI Match */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${avgMatch > 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                            {avgMatch}%
                                                        </span>
                                                    </td>

                                                    {/* Performance stats */}
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="text-xs text-slate-500">
                                                            <div className="font-bold text-slate-700 dark:text-slate-300">{views} views</div>
                                                            <div className={isLowPerf ? "text-rose-500 font-bold" : ""}>{realConversion.toFixed(1)}% conv.</div>
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded" title="Boostovat inzerát">
                                                                <Zap size={16} />
                                                            </button>
                                                            <button className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded" title="Pozastavit">
                                                                <PauseCircle size={16} />
                                                            </button>
                                                            <button className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded" title="Upravit">
                                                                <PenTool size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Recruitment Funnel Viz */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Celkový Funnel Konverze</h4>
                                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 relative">
                                    {/* Connecting Line */}
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10 transform -translate-y-1/2"></div>

                                    <div className="bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-center">
                                        <div className="font-bold">12,450</div>
                                        <div className="text-xs text-slate-400">Views</div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-center">
                                        <div className="font-bold">1,240</div>
                                        <div className="text-xs text-slate-400">Applicants (10%)</div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-center">
                                        <div className="font-bold">280</div>
                                        <div className="text-xs text-slate-400">Interviews (22%)</div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-center border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10">
                                        <div className="font-bold text-emerald-600 dark:text-emerald-400">42</div>
                                        <div className="text-xs text-emerald-500">Hires (15%)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Right Column: Feed & Team (1/3) */}
                    <div className="space-y-6">

                        {/* Activity Feed */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <BrainCircuit size={20} className="text-purple-500" /> Live Feed
                                </h3>
                                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Real-time</span>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {candidates.map((candidate, idx) => {
                                        const status = idx === 0 ? 'Top Pick' : idx === 1 ? 'Review' : 'Assessment';
                                        const statusStyle = idx === 0
                                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                            : 'text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';

                                        return (
                                            <div key={candidate.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shadow-inner">
                                                            {candidate.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 transition-colors flex items-center gap-2">
                                                                {candidate.name}
                                                                <span className={`text-xs px-1.5 rounded uppercase font-bold border ${statusStyle}`}>{status}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">{candidate.role}</div>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40" title="Zavolat">
                                                            <Phone size={14} />
                                                        </button>
                                                        <button className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40" title="Email">
                                                            <Mail size={14} />
                                                        </button>
                                                        <button className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40" title="Zamítnout">
                                                            <XCircle size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-2 rounded border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                    <span className="truncate italic max-w-[70%]">"{idx === 0 ? 'Silný kulturní fit, leader.' : 'Technicky ok, drahý.'}"</span>
                                                    <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-white" title="Match Score">
                                                        <Target size={14} className={idx === 0 ? "text-emerald-500" : "text-amber-500"} />
                                                        {85 - (idx * 12)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button className="w-full py-2 text-xs font-bold text-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800">
                                    Zobrazit všechny notifikace
                                </button>
                            </div>
                        </div>

                        {/* Team Leaderboard (Bonus) */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                <UserCheck size={16} className="text-indigo-500" /> Top Recruiter (Měsíc)
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300">P</div>
                                    <div className="text-xs">
                                        <div className="font-bold dark:text-white">Petra N.</div>
                                        <div className="text-slate-500">8 Hires</div>
                                    </div>
                                </div>
                                <div className="text-right text-xs">
                                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">19 dní</div>
                                    <div className="text-slate-400">Avg TTH</div>
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

            {/* Editor (Center) */}
            <div className="lg:col-span-8 flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden order-2 lg:order-1">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <PenTool size={16} /> Editor Inzerátu
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Aplikuji tón: <span className="font-semibold text-slate-700 dark:text-slate-300">{companyProfile.tone}</span></span>
                </div>

                {/* Title Input */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Název Pozice</label>
                    <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Napište název pracovní pozice..."
                        className="w-full text-xl font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                    />
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <button onClick={() => setViewMode(viewMode === 'write' ? 'preview' : 'write')} className={`p-1.5 rounded transition-colors flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'preview' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`} title="Přepnout náhled">
                        {viewMode === 'preview' ? <Eye size={16} /> : <LayoutTemplate size={16} />}
                        {viewMode === 'preview' ? 'Náhled' : 'Editor'}
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <button onClick={() => insertFormat('**', '**')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Tučně">
                        <Bold size={16} />
                    </button>
                    <button onClick={() => insertFormat('*', '*')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Kurzíva">
                        <Italic size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <button onClick={() => insertFormat('\n### ', '\n')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Nadpis">
                        <Heading size={16} />
                    </button>
                    <button onClick={() => insertFormat('\n- ', '')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Seznam">
                        <List size={16} />
                    </button>
                    <button onClick={() => insertFormat('\n> ', '\n')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Citace">
                        <Quote size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    {/* Emoji Picker Button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors ${showEmojiPicker ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''}`}
                            title="Vložit Emoji"
                        >
                            <Smile size={16} />
                        </button>

                        {/* Emoji Popover */}
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
                    <button onClick={() => insertFormat('[', '](url)')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Odkaz">
                        <LinkIcon size={16} />
                    </button>
                    <button onClick={() => insertFormat('`', '`')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors" title="Kód">
                        <Code size={16} />
                    </button>
                </div>

                {viewMode === 'write' ? (
                    <textarea
                        ref={textareaRef}
                        className="flex-1 w-full p-6 resize-none focus:outline-none text-slate-800 dark:text-slate-200 font-mono text-base leading-relaxed bg-white dark:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={adDraft}
                        onChange={(e) => setAdDraft(e.target.value)}
                        placeholder="Začněte psát popis pozice..."
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
                        {isOptimizing ? 'Analyzuji...' : 'Odstranit Šum (AI)'}
                    </button>

                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                    >
                        {isPublishing ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                        {isPublishing ? 'Zveřejňuji...' : 'Zveřejnit Inzerát'}
                    </button>
                </div>
            </div>

            {/* Right Sidebar: Tools */}
            <div className="lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar order-1 lg:order-2 h-full">

                {/* Optimization Result Overlay */}
                {optimizationResult && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-6 animate-in zoom-in-95 shadow-sm">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-4">
                            <CheckCircle size={20} />
                            <h3 className="font-bold">Návrh Optimalizace</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase block mb-1">Co jsme vyhodili</span>
                                <div className="flex flex-wrap gap-1">
                                    {optimizationResult.removedCliches.map((w, i) => (
                                        <span key={i} className="text-xs bg-rose-500/10 text-rose-500 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 line-through">
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase block mb-1">Proč je to lepší</span>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{optimizationResult.improvedClarity}</p>
                            </div>

                            <div className="border-t border-emerald-200 dark:border-emerald-900/50 pt-4">
                                <button
                                    onClick={applyOptimization}
                                    className="w-full py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors shadow-sm"
                                >
                                    Použít tento text
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bullshit Meter Live */}
                <BullshitMeter metrics={{
                    score: adDraft.toLowerCase().includes('ninja') || adDraft.toLowerCase().includes('rockstar') ? 85 : 20,
                    flags: adDraft.toLowerCase().includes('ninja') ? ['Ninja', 'Hype', 'Grind'] : [],
                    tone: adDraft.toLowerCase().includes('ninja') ? 'Hype-heavy' : 'Professional'
                }} variant="dark" />

                {/* Benefit Insights Widget */}
                <BenefitInsights />
            </div>
        </div>
    );

    const renderCandidates = () => {
        // Empty state for Real Users
        if (isRealUser && candidates.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <Users size={32} className="text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Žádní kandidáti</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                        Jakmile zveřejníte nabídku, zde se začnou objevovat profily uchazečů s vypočítaným skóre shody.
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
                            {isMatching ? 'Analyzuji shodu...' : 'Najít nejlepší shodu'}
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
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded font-medium border border-slate-200 dark:border-slate-700">{candidate.role}</span>
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
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Firemní Portál</h1>
                    <p className="text-slate-500 dark:text-slate-400">Nábor bez pozlátka, data bez zkreslení.</p>
                </div>

                <div className="flex flex-wrap bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Přehled
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        DNA & Kultura
                    </button>
                    <button
                        onClick={() => setActiveTab('create-ad')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'create-ad' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        AI Editor
                    </button>
                    <button
                        onClick={() => setActiveTab('assessments')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'assessments' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Assessmenty
                    </button>
                    <button
                        onClick={() => setActiveTab('candidates')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'candidates' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Kandidáti
                    </button>
                    <button
                        onClick={() => setActiveTab('marketplace')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'marketplace' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Marketplace kurzů
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'settings' && <CompanySettings profile={companyProfile} onSave={setCompanyProfile} />}
                {activeTab === 'create-ad' && renderCreateAd()}
                {activeTab === 'assessments' && <AssessmentCreator />}
                {activeTab === 'candidates' && renderCandidates()}
                {/* {activeTab === 'marketplace' && <CompanyMarketplace />} */}
            </div>

            <PlanUpgradeModal />
        </div>
    );
};

export default CompanyDashboard;
