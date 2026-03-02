
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Assessment, Job, Candidate, CompanyProfile, CandidateBenchmarkMetric, CandidateBenchmarkMetrics, CompanyApplicationRow, ApplicationDossier } from '../types';
import { supabase } from '../services/supabaseService';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import CompanySettings from './CompanySettings';
import CompanyJobEditor from './CompanyJobEditor';
import AssessmentCreator from './AssessmentCreator';
import PlanUpgradeModal from './PlanUpgradeModal';
import AssessmentInvitationModal from './AssessmentInvitationModal';
import MyInvitations from './MyInvitations';
import AssessmentResultsList from './AssessmentResultsList';
import { fetchCandidateBenchmarkMetrics, fetchCompanyCandidates } from '../services/benchmarkService';
import { fetchCompanyApplicationDetail, fetchCompanyApplications, updateCompanyApplicationStatus } from '../services/jobApplicationService';
import { fetchCompanyJobViews } from '../services/companyDashboardService';
import { updateCompanyJobLifecycle } from '../services/companyJobDraftService';
import { duplicateCompanyAssessment, listCompanyAssessmentLibrary, updateCompanyAssessmentStatus } from '../services/assessmentLibraryService';
import { openAssessmentPreviewPage } from '../services/assessmentPreviewNavigation';
import {
    Briefcase,
    Users,
    TrendingUp,
    PenTool,
    CheckCircle,
    Search,
    DollarSign,
    Clock,
    Zap,
    Filter,
    TrendingDown,
    Eye,
    Edit,
    X,
    Trash2,
    Crown,
    MoreVertical,
    Info,
    BrainCircuit
} from 'lucide-react';

interface CompanyDashboardProps {
    companyProfile?: CompanyProfile | null;
    userEmail?: string;
    onDeleteAccount?: () => Promise<boolean>;
    onProfileUpdate?: (profile: CompanyProfile) => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ companyProfile: propProfile, userEmail, onDeleteAccount, onProfileUpdate }) => {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'applications' | 'candidates' | 'settings' | 'assessments'>('overview');
    const [showUpgradeModal, setShowUpgradeModal] = useState<{ open: boolean, feature?: string }>({ open: false });
    const [showInvitationModal, setShowInvitationModal] = useState(false);
    const [showInvitationsList, setShowInvitationsList] = useState(false);
    const [activeDropdownJobId, setActiveDropdownJobId] = useState<string | null>(null);
    const [editorSeedJobId, setEditorSeedJobId] = useState<string | null>(null);

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const tab = params.get('tab');
            if (tab === 'assessments') {
                setActiveTab('assessments');
            }
        } catch {
            // no-op
        }
    }, []);

    // Data State (Empty for initial load, fetched from Supabase)

    // Data State (Empty for Real, Mocks for Demo)
    // Data State (Empty for initial load, fetched from Supabase)
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobStats, setJobStats] = useState<Record<string, { views: number, applicants: number }>>({});
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [applications, setApplications] = useState<CompanyApplicationRow[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [applicationsUpdating, setApplicationsUpdating] = useState<Record<string, boolean>>({});
    const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
    const [selectedApplicationDetail, setSelectedApplicationDetail] = useState<ApplicationDossier | null>(null);
    const [applicationDetailLoading, setApplicationDetailLoading] = useState(false);
    const [assessmentContext, setAssessmentContext] = useState<{
        jobId?: string;
        jobTitle?: string;
        candidateEmail?: string;
        candidateId?: string;
        candidateName?: string;
        applicationId?: string;
        assessmentId?: string;
        assessmentName?: string;
    } | null>(null);
    const [assessmentLibrary, setAssessmentLibrary] = useState<Assessment[]>([]);
    const [assessmentLibraryLoading, setAssessmentLibraryLoading] = useState(false);
    const [assessmentLibraryBusyId, setAssessmentLibraryBusyId] = useState<string | null>(null);

    // Subscription state
    const [subscription, setSubscription] = useState<any>(null);

    const [assessmentJobId, setAssessmentJobId] = useState<string | undefined>(undefined);

    // Candidate State
    const [selectedJobId, setSelectedJobId] = useState<string>(jobs.length > 0 ? jobs[0].id : '');
    const [candidateBenchmarks, setCandidateBenchmarks] = useState<CandidateBenchmarkMetrics | null>(null);
    const [isLoadingCandidateBenchmarks, setIsLoadingCandidateBenchmarks] = useState(false);

    // Simplified Profile management
    const companyProfile = propProfile;
    const isRealUser = !!companyProfile;

    // Recruiter Handling
    const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('all');
    const recruiters = companyProfile?.members || [
        { id: 'all', name: t('company.dashboard.all_recruiters'), email: '', role: 'admin', joinedAt: '' }
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

    useEffect(() => {
        let active = true;
        const loadAssessmentLibrary = async () => {
            if (!companyProfile?.id || activeTab !== 'assessments') return;
            setAssessmentLibraryLoading(true);
            const rows = await listCompanyAssessmentLibrary();
            if (active) {
                setAssessmentLibrary(rows.filter((item) => item.status !== 'archived'));
                setAssessmentLibraryLoading(false);
            }
        };
        loadAssessmentLibrary();
        return () => { active = false; };
    }, [companyProfile?.id, activeTab]);

    // GUARD: If no profile (and we are expecting one), show loading or empty state
    // This satisfies TypeScript because subsequent code knows companyProfile is not null
    if (!companyProfile) {
        return (
            <div className="min-h-[500px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                    <p>{t('common.loading') || 'Načítám...'}</p>
                </div>
            </div>
        );
    }

    const effectiveCompanyProfile = useMemo(() => {
        if (!subscription) return companyProfile;
        return {
            ...companyProfile,
            subscription: {
                ...companyProfile.subscription,
                tier: subscription.tier || companyProfile.subscription?.tier || 'free',
                expiresAt: subscription.expiresAt || companyProfile.subscription?.expiresAt,
                usage: {
                    ...companyProfile.subscription?.usage,
                    aiAssessmentsUsed: subscription.assessmentsUsed || 0,
                    activeJobsCount: subscription.jobPostingsUsed || 0
                }
            } as any
        };
    }, [companyProfile, subscription]);

    // Load initial data for Real User
    useEffect(() => {
        const loadData = async () => {
            if (!companyProfile?.id) return;

            try {
                // Fetch real jobs for this company
                if (supabase) {
                    const { data: realJobs } = await supabase
                        .from('jobs')
                        .select('*')
                        .eq('company_id', companyProfile.id)
                        .order('created_at', { ascending: false });

                    if (realJobs) {
                        setJobs(realJobs as Job[]);
                        if (realJobs.length > 0) setSelectedJobId(realJobs[0].id);

                        // Fetch stats for these jobs
                        const jobIds = (realJobs as Job[]).map((j: Job) => j.id);
                        if (jobIds.length > 0) {
                            // 1. Fetch Applications count
                            const { data: apps } = await supabase
                                .from('job_applications')
                                .select('job_id')
                                .in('job_id', jobIds);

                            // 2. Fetch Views count from analytics
                            const viewsResponse = await fetchCompanyJobViews(companyProfile.id, 90);

                            // Aggregate stats
                            const stats: Record<string, { views: number, applicants: number }> = {};
                            jobIds.forEach((id: string) => stats[id] = { views: 0, applicants: 0 });

                            apps?.forEach((app: any) => {
                                if (stats[app.job_id]) stats[app.job_id].applicants++;
                            });

                            viewsResponse?.job_views?.forEach((v: any) => {
                                const jId = String(v?.job_id || '');
                                if (jId && stats[jId]) {
                                    stats[jId].views = Number(v?.views || 0);
                                }
                            });

                            setJobStats(stats);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load dashboard data", e);
            }
        };
        loadData();
    }, [companyProfile?.id]);

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

    useEffect(() => {
        let active = true;
        const loadCandidateBenchmarks = async () => {
            if (!companyProfile?.id || activeTab !== 'candidates') return;
            setIsLoadingCandidateBenchmarks(true);
            try {
                const data = await fetchCandidateBenchmarkMetrics(companyProfile.id, selectedJobId || undefined);
                if (active) setCandidateBenchmarks(data);
            } catch (error) {
                console.warn('Candidate benchmark fetch failed:', error);
                if (active) setCandidateBenchmarks(null);
            } finally {
                if (active) setIsLoadingCandidateBenchmarks(false);
            }
        };
        loadCandidateBenchmarks();
        return () => { active = false; };
    }, [companyProfile?.id, activeTab, selectedJobId]);

    useEffect(() => {
        let active = true;
        const parseDateSafe = (value: unknown): Date | null => {
            if (!value) return null;
            const dt = new Date(String(value));
            return Number.isNaN(dt.getTime()) ? null : dt;
        };
        const estimateExperienceYears = (workHistory: unknown): number => {
            if (!Array.isArray(workHistory) || workHistory.length === 0) return 0;
            let months = 0;
            const now = new Date();
            for (const entry of workHistory as any[]) {
                const fromRaw = entry?.from || entry?.start || entry?.start_date;
                const toRaw = entry?.to || entry?.end || entry?.end_date;
                const start = parseDateSafe(fromRaw);
                const end = parseDateSafe(toRaw) || now;
                if (start && end >= start) {
                    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                    months += Math.max(0, diffMonths);
                }
            }
            if (months <= 0) return Math.max(1, workHistory.length);
            return Math.max(1, Math.round(months / 12));
        };
        const normalizeSkills = (skills: unknown, workHistory: unknown, jobTitle: unknown): string[] => {
            if (Array.isArray(skills)) return skills.filter(Boolean).map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
            if (typeof skills === 'string' && skills.trim()) {
                return skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
            }
            const fromHistory = Array.isArray(workHistory)
                ? (workHistory as any[])
                    .flatMap((w) => Array.isArray(w?.skills) ? w.skills : [])
                    .filter(Boolean)
                    .map((s) => String(s).trim())
                : [];
            if (fromHistory.length > 0) return Array.from(new Set(fromHistory)).slice(0, 12);
            const title = String(jobTitle || '').trim();
            return title ? [title] : [];
        };

        const loadCandidates = async () => {
            if (!companyProfile?.id || activeTab !== 'candidates') return;
            try {
                const backendCandidates = await fetchCompanyCandidates(companyProfile.id, 500);
                if (active) setCandidates(backendCandidates);
            } catch (e) {
                console.warn('Candidate API loading failed, trying direct Supabase fallback:', e);
                if (!supabase) {
                    if (active) setCandidates([]);
                    return;
                }
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select(`
                            id,
                            full_name,
                            email,
                            role,
                            created_at,
                            candidate_profiles (
                                job_title,
                                skills,
                                work_history,
                                values
                            )
                        `)
                        .eq('role', 'candidate')
                        .order('created_at', { ascending: false })
                        .limit(500);

                    if (error) {
                        console.error('Failed to load candidates from Supabase fallback:', error);
                        if (active) setCandidates([]);
                        return;
                    }

                    let mapped: Candidate[] = (data || []).map((row: any) => {
                        const candidateProfile = Array.isArray(row.candidate_profiles)
                            ? row.candidate_profiles[0]
                            : row.candidate_profiles;
                        const workHistory = Array.isArray(candidateProfile?.work_history) ? candidateProfile.work_history : [];
                        const skills = normalizeSkills(candidateProfile?.skills, workHistory, candidateProfile?.job_title);
                        const values = Array.isArray(candidateProfile?.values) ? candidateProfile.values : [];
                        const fullName = String(row.full_name || '').trim();
                        const email = String(row.email || '').trim();
                        const derivedName = fullName || email.split('@')[0] || 'Candidate';
                        const jobTitle = String(candidateProfile?.job_title || '').trim();

                        return {
                            id: String(row.id),
                            name: derivedName,
                            role: jobTitle || t('company.candidates.role_unknown', { defaultValue: 'Uchazeč' }),
                            experienceYears: estimateExperienceYears(workHistory),
                            salaryExpectation: 0,
                            skills,
                            bio: t('company.candidates.registered_user_bio', {
                                defaultValue: 'Registrovaný uchazeč na JobShaman.',
                                name: derivedName
                            }),
                            flightRisk: 'Medium',
                            values
                        };
                    });

                    const lowDataCoverage = mapped.length > 0 && mapped.filter((c) => c.skills.length === 0 || c.experienceYears === 0).length / mapped.length > 0.6;
                    if (lowDataCoverage) {
                        const { data: cpRows, error: cpError } = await supabase
                            .from('candidate_profiles')
                            .select('id,job_title,skills,work_history,values')
                            .limit(500);
                        if (!cpError && Array.isArray(cpRows) && cpRows.length > 0) {
                            const ids = cpRows.map((row: any) => row.id).filter(Boolean);
                            const { data: profileRows } = await supabase
                                .from('profiles')
                                .select('id,full_name,email,created_at')
                                .in('id', ids)
                                .limit(500);
                            const profileMap = new Map((profileRows || []).map((row: any) => [String(row.id), row]));
                            mapped = cpRows.map((cp: any) => {
                                const p = profileMap.get(String(cp.id)) || {};
                                const workHistory = Array.isArray(cp?.work_history) ? cp.work_history : [];
                                const jobTitle = String(cp?.job_title || '').trim();
                                const fullName = String((p as any).full_name || '').trim();
                                const email = String((p as any).email || '').trim();
                                const derivedName = fullName || email.split('@')[0] || 'Candidate';
                                return {
                                    id: String(cp.id),
                                    name: derivedName,
                                    role: jobTitle || t('company.candidates.role_unknown', { defaultValue: 'Uchazeč' }),
                                    experienceYears: estimateExperienceYears(workHistory),
                                    salaryExpectation: 0,
                                    skills: normalizeSkills(cp?.skills, workHistory, jobTitle),
                                    bio: t('company.candidates.registered_user_bio', {
                                        defaultValue: 'Registrovaný uchazeč na JobShaman.',
                                        name: derivedName
                                    }),
                                    flightRisk: 'Medium',
                                    values: Array.isArray(cp?.values) ? cp.values : []
                                } as Candidate;
                            });
                        }
                    }

                    if (active) setCandidates(mapped);
                } catch (fallbackError) {
                    console.error('Candidate fallback loading failed:', fallbackError);
                    if (active) setCandidates([]);
                }
            }
        };
        loadCandidates();
        return () => { active = false; };
    }, [activeTab, t, companyProfile?.id]);

    useEffect(() => {
        let active = true;
        const loadApplications = async () => {
            if (!companyProfile?.id || activeTab !== 'applications') return;
            setApplicationsLoading(true);
            const jobId = selectedJobId || undefined;
            const rows = await fetchCompanyApplications(companyProfile.id, jobId, 500);
            if (active) {
                setApplications(rows);
                setApplicationsLoading(false);
            }
        };
        loadApplications();
        return () => { active = false; };
    }, [companyProfile?.id, activeTab, selectedJobId]);

    const handleApplicationStatusChange = async (applicationId: string, status: CompanyApplicationRow['status']) => {
        if (!applicationId) return;
        setApplicationsUpdating(prev => ({ ...prev, [applicationId]: true }));
        const ok = await updateCompanyApplicationStatus(applicationId, status);
        if (ok) {
            setApplications(prev => prev.map(app => app.id === applicationId ? { ...app, status } : app));
            setSelectedApplicationDetail(prev => prev && prev.id === applicationId ? { ...prev, status } : prev);
        }
        setApplicationsUpdating(prev => ({ ...prev, [applicationId]: false }));
    };

    const openApplicationDetail = async (applicationId: string) => {
        if (!applicationId) return;
        setSelectedApplicationId(applicationId);
        setApplicationDetailLoading(true);
        const detail = await fetchCompanyApplicationDetail(applicationId);
        setSelectedApplicationDetail(detail);
        setApplicationDetailLoading(false);
    };

    const formatPct = (value: number | null | undefined): string => {
        if (typeof value !== 'number' || Number.isNaN(value)) return '—';
        return `${(value * 100).toFixed(1)}%`;
    };

    const renderMetricCard = (
        title: string,
        metric: CandidateBenchmarkMetric | null,
        display: string,
        peerDisplay?: string
    ) => (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{title}</div>
            {!metric || metric.insufficient_data ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Insufficient data</div>
            ) : (
                <div className="space-y-2">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{display}</div>
                    {peerDisplay ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {t('company.candidates.benchmark.vs_peer', { defaultValue: 'Vs trh/peer: {{value}}', value: peerDisplay })}
                        </div>
                    ) : null}
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2">
                        source: {metric.source_name} • N={metric.sample_size} • window={metric.data_window_days}d • confidence={metric.confidence_tier}
                    </div>
                </div>
            )}
        </div>
    );

    const handleEditJob = (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            setEditorSeedJobId(jobId);
            setSelectedJobId(jobId);
            setActiveTab('jobs');
            setActiveDropdownJobId(null);
        }
    };

    const handleOpenApplications = (jobId: string) => {
        setSelectedJobId(jobId);
        setSelectedApplicationId(null);
        setSelectedApplicationDetail(null);
        setActiveTab('applications');
        setActiveDropdownJobId(null);
    };

    const updateJobLifecycleWithFallback = async (
        jobId: string,
        status: 'active' | 'paused' | 'closed' | 'archived'
    ): Promise<boolean> => {
        const ok = await updateCompanyJobLifecycle(jobId, status);
        if (ok) return true;
        if (!supabase) return false;
        const { error } = await supabase
            .from('jobs')
            .update({ status })
            .eq('id', jobId);
        return !error;
    };

    const handleDeleteJob = async (jobId: string) => {
        if (confirm(t('company.dashboard.actions.confirm_delete'))) {
            try {
                const ok = await updateJobLifecycleWithFallback(jobId, 'archived');
                if (!ok) {
                    alert(t('common.error_occurred'));
                    return;
                }
                setJobs((prev) => prev.filter(job => job.id !== jobId));
                setActiveDropdownJobId(null);
            } catch (error) {
                console.error("Failed to archive job:", error);
                alert(t('common.error_occurred'));
            }
        }
    };

    const handleCloseJob = async (jobId: string) => {
        if (confirm(t('company.dashboard.actions.confirm_close'))) {
            try {
                const ok = await updateJobLifecycleWithFallback(jobId, 'closed');
                if (!ok) {
                    alert(t('common.error_occurred'));
                    return;
                }
                setJobs((prev) => prev.map(job =>
                    job.id === jobId ? { ...job, status: 'closed' as any } : job
                ));
                setActiveDropdownJobId(null);
            } catch (error) {
                console.error("Failed to close job:", error);
                alert(t('common.error_occurred'));
            }
        }
    };

    const toggleDropdown = (jobId: string) => {
        setActiveDropdownJobId(activeDropdownJobId === jobId ? null : jobId);
    };

    const handleCreateAssessmentFromJob = (jobId: string) => {
        const linkedJob = jobs.find((job) => job.id === jobId);
        setAssessmentJobId(jobId);
        setAssessmentContext((prev) => ({
            ...prev,
            jobId,
            jobTitle: linkedJob?.title || prev?.jobTitle,
        }));
        setActiveTab('assessments');
        setActiveDropdownJobId(null);
    };

    const handleCreateAssessmentFromApplication = () => {
        if (!selectedApplicationDetail) return;
        setAssessmentJobId(String(selectedApplicationDetail.job_id));
        setAssessmentContext((prev) => ({
            ...prev,
            jobId: String(selectedApplicationDetail.job_id),
            jobTitle: selectedApplicationDetail.job_title || prev?.jobTitle,
            candidateEmail: selectedApplicationDetail.candidate_profile_snapshot?.email || selectedApplicationDetail.candidate_email || prev?.candidateEmail,
            candidateId: selectedApplicationDetail.candidate_id || prev?.candidateId,
            candidateName: selectedApplicationDetail.candidate_profile_snapshot?.name || selectedApplicationDetail.candidate_name || prev?.candidateName,
            applicationId: selectedApplicationDetail.id,
        }));
        setActiveTab('assessments');
    };

    const handleInviteCandidateFromApplication = () => {
        if (!selectedApplicationDetail) return;
        handleCreateAssessmentFromApplication();
        setShowInvitationModal(true);
    };

    const handleUseSavedAssessment = (assessment: Assessment) => {
        setAssessmentContext((prev) => ({
            ...(prev || {}),
            assessmentId: assessment.id,
            assessmentName: assessment.title,
            jobTitle: prev?.jobTitle || assessment.role,
        }));
    };

    const handleDuplicateAssessment = async (assessmentId: string) => {
        if (!assessmentId) return;
        setAssessmentLibraryBusyId(assessmentId);
        const duplicated = await duplicateCompanyAssessment(assessmentId);
        if (duplicated) {
            setAssessmentLibrary((prev) => [duplicated, ...prev]);
            handleUseSavedAssessment(duplicated);
        }
        setAssessmentLibraryBusyId(null);
    };

    const handleArchiveAssessment = async (assessmentId: string) => {
        if (!assessmentId) return;
        setAssessmentLibraryBusyId(assessmentId);
        const ok = await updateCompanyAssessmentStatus(assessmentId, 'archived');
        if (ok) {
            setAssessmentLibrary((prev) => prev.filter((item) => item.id !== assessmentId));
            setAssessmentContext((prev) => (
                prev?.assessmentId === assessmentId
                    ? { ...prev, assessmentId: undefined, assessmentName: undefined }
                    : prev
            ));
        }
        setAssessmentLibraryBusyId(null);
    };

    const handleEditorLifecycleChange = (jobId: string | number, status: 'active' | 'paused' | 'closed' | 'archived') => {
        setJobs((prev) => prev.map((job) => (
            String(job.id) === String(jobId)
                ? { ...(job as any), status }
                : job
        )));
    };

    const renderOverview = () => {
        const subscriptionTier = (subscription?.tier || effectiveCompanyProfile.subscription?.tier || 'free').toLowerCase();
        const isFreeLikeTier = subscriptionTier === 'free' || subscriptionTier === 'trial';
        const subscriptionLabel = subscription?.tierName
            || (subscriptionTier === 'professional' ? t('company.subscription.tiers.professional', { defaultValue: 'Professional' })
                : subscriptionTier === 'growth' ? t('company.subscription.tiers.growth', { defaultValue: 'Growth' })
                    : subscriptionTier === 'starter' ? t('company.subscription.tiers.starter', { defaultValue: 'Starter' })
                    : subscriptionTier === 'trial' ? t('company.subscription.tiers.trial', { defaultValue: 'Free (Trial)' })
                        : t('company.subscription.tiers.free'));

        return (
            <div className="space-y-6 animate-in fade-in">
                {/* Subscription Status Card */}
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-cyan-900 dark:text-cyan-300 mb-1">{t('company.subscription.title')}</h3>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                    {subscriptionLabel} {t('company.subscription.plan_suffix')}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${isFreeLikeTier || !subscription?.status
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : subscription?.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                    }`}>
                                    {isFreeLikeTier || !subscription?.status ? t('company.subscription.active') : subscription?.status === 'active' ? t('company.subscription.active') : t('company.subscription.inactive')}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            {subscription?.expiresAt && !isFreeLikeTier && (
                                <div className="text-sm text-cyan-700 dark:text-cyan-300">
                                    <div className="font-medium">{t('company.subscription.next_payment')}</div>
                                    <div className="font-mono">{new Date(subscription.expiresAt).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')}</div>
                                    <div className="text-xs opacity-75">({t('company.subscription.days_left', { count: Math.ceil((new Date(subscription.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) })})</div>
                                </div>
                            )}
                            <div className="mt-2">
                                <button
                                    onClick={() => setShowUpgradeModal({ open: true, feature: 'Změna plánu' })}
                                    className="text-sm px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors font-medium"
                                >
                                    {t('company.subscription.manage')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Credits and Usage */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-cyan-200 dark:border-cyan-800">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-4 h-4 text-cyan-600" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.ai_assessments')}</span>
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {subscription?.assessmentsAvailable || 0}
                            </div>
                            <div className="text-xs text-slate-500">
                                {subscription?.assessmentsUsed || 0} {t('company.subscription.used')}
                            </div>
                            {isFreeLikeTier && (
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
                                <Briefcase className="w-4 h-4 text-cyan-600" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.job_ads')}</span>
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {subscription?.jobPostingsUsed || 0} / {subscription?.jobPostingsAvailable === 999 ? t('company.subscription.unlimited') : subscription?.jobPostingsAvailable || '1'}
                            </div>
                            <div className="text-xs text-slate-500">
                                {t('company.subscription.used')}
                            </div>
                            {isFreeLikeTier && (
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
                                <Users className="w-4 h-4 text-cyan-600" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('company.subscription.team_members')}</span>
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {companyProfile?.members?.length || 1}
                            </div>
                            <div className="text-xs text-slate-500">
                                {['growth', 'professional', 'enterprise'].includes(subscriptionTier) ? t('company.subscription.unlimited') : t('company.subscription.no_limit')}
                            </div>
                        </div>
                    </div>
                </div>
                {jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                            <Briefcase size={40} className="text-slate-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('company.dashboard.welcome_title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-md text-center mb-8">
                            {t('company.dashboard.empty_state_desc')}
                        </p>
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className="px-8 py-3 bg-cyan-600 text-white font-bold rounded-xl shadow-lg hover:bg-cyan-500 transition-colors flex items-center gap-2"
                        >
                            <PenTool size={20} />
                            {t('company.dashboard.create_first_ad')}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header & Actions */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">

                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('company.dashboard.title')}</h2>
                                <p className="text-sm text-slate-500">{t('company.dashboard.subtitle')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setActiveTab('jobs')}
                                    className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg shadow-sm hover:bg-cyan-500 transition-colors flex items-center gap-2"
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
                                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                            {Object.values(jobStats).reduce((acc, curr) => acc + curr.applicants, 0)}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
                                        <Users size={20} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                        <div className="bg-emerald-500 w-[100%]" title="Applicants"></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{t('company.dashboard.stats.new')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Views Metric (Replaces Match Score for now as it's more useful) */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{t('company.dashboard.table.views_count')}</div>
                                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                            {Object.values(jobStats).reduce((acc, curr) => acc + curr.views, 0)}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
                                        <Eye size={20} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    {t('company.dashboard.stats.analyzing_market')}
                                </p>
                            </div>

                            {/* Conversion Metric */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{t('company.dashboard.table.conv_rate')}</div>
                                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                            {(() => {
                                                const totalViews = Object.values(jobStats).reduce((acc, curr) => acc + curr.views, 0);
                                                const totalApps = Object.values(jobStats).reduce((acc, curr) => acc + curr.applicants, 0);
                                                return totalViews > 0 ? ((totalApps / totalViews) * 100).toFixed(1) : '0.0';
                                            })()}%
                                        </div>
                                    </div>
                                    <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                                        <TrendingUp size={20} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3 text-sm border-t border-slate-100 dark:border-slate-800 pt-2">
                                    <span className="text-slate-400">{t('company.dashboard.stats.pipeline')}</span>
                                </div>
                            </div>

                            {/* Budget Metric */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{t('company.dashboard.stats.saved')}</div>
                                        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                            {Object.values(jobStats).reduce((acc, curr) => acc + curr.applicants, 0) * 1250} <span className="text-lg font-normal text-slate-500 dark:text-slate-400">{t('company.dashboard.stats.currency')}</span>
                                        </div>
                                    </div>
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                                        <DollarSign size={20} />
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1 mt-2">
                                    <div
                                        className="h-full rounded-full bg-emerald-500"
                                        style={{ width: `100%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 mb-2">
                                    <span>{t('company.dashboard.stats.potential_savings')}</span>
                                </div>
                            </div>
                        </div>


                        {/* AI Predictive Insights - Temporarily disabled until real data is available */}
                        {/* 
                        <div className="bg-gradient-to-r from-cyan-50 to-cyan-50 dark:from-cyan-950/20 dark:to-cyan-950/20 border border-cyan-100 dark:border-cyan-900/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-cyan-500">
                                <BrainCircuit size={80} />
                            </div>
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800 z-10">
                                <Sparkles size={20} />
                            </div>
                            <div className="flex-1 z-10">
                                <h3 className="text-sm font-bold text-cyan-900 dark:text-cyan-200 mb-1">{t('company.dashboard.ai_insights.title')}</h3>
                                <div className="flex flex-col md:flex-row gap-4 text-sm text-cyan-800 dark:text-cyan-300">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle size={14} className="text-emerald-500" />
                                        <span>{jobs.length > 0 ? t('company.dashboard.ai_insights.hired_prediction', { days: 21, count: Math.max(1, Math.floor(jobs.length * 1.5)) }) : t('company.dashboard.ai_insights.analyzing_market')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ArrowRight size={14} className="text-amber-500" />
                                        <span>{jobs.length > 0 ? t('company.dashboard.ai_insights.low_match_warning', { avg: 22 }) : t('company.dashboard.ai_insights.awaiting_data')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        */}

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

                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="overflow-x-visible min-h-[300px]">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-mono text-xs">
                                                <tr>
                                                    <th className="px-4 py-3">{t('company.dashboard.table.position')}</th>
                                                    <th className="px-4 py-3">{t('company.dashboard.table.status')}</th>
                                                    <th className="px-4 py-3">{t('company.dashboard.table.pipeline')}</th>
                                                    <th className="px-4 py-3 text-center">{t('company.dashboard.table.ai_match')}</th>
                                                    <th className="px-4 py-3 text-center">{t('company.dashboard.table.performance')}</th>
                                                    <th className="px-4 py-3 text-right">{t('company.dashboard.table.actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                                {jobs.slice(0, 5).map((job) => {
                                                    const stats = jobStats[job.id] || { views: 0, applicants: 0 };
                                                    const views = stats.views;
                                                    const applied = stats.applicants;
                                                    const realConversion = views > 0 ? (applied / views) * 100 : 0;
                                                    const avgMatch = 0;
                                                    const isLowPerf = views > 20 && realConversion < 2;

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
                                                                {job.legality_status === 'pending' && (
                                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1 w-fit">
                                                                        <Clock size={10} /> {t('company.dashboard.status.pending')}
                                                                    </span>
                                                                )}
                                                                {job.legality_status === 'legal' && (
                                                                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1 w-fit">
                                                                        <CheckCircle size={10} /> {t('company.dashboard.status.approved')}
                                                                    </span>
                                                                )}
                                                                {(job.legality_status === 'review' || job.legality_status === 'illegal') && (
                                                                    <div className="group/status relative w-fit">
                                                                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded border border-amber-200 dark:border-amber-800/50 flex items-center gap-1 cursor-help">
                                                                            <Info size={10} /> {job.legality_status === 'illegal' ? t('company.dashboard.status.refused') : t('company.dashboard.status.flagged')}
                                                                        </span>
                                                                        {job.legality_reasons && job.legality_reasons.length > 0 && (
                                                                            <div className="absolute left-0 top-full mt-2 w-48 p-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-[60] text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                                                                <ul className="list-disc pl-3 space-y-1">
                                                                                    {job.legality_reasons.map((r, i) => <li key={i}>{r}</li>)}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{applied}</span>
                                                                    <span className="text-xs text-slate-400">{t('company.dashboard.stats.candidates_count')}</span>
                                                                </div>
                                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, (applied / 50) * 100)}%` }}></div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${avgMatch > 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                                    {avgMatch > 0 ? `${avgMatch}%` : '--'}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                                                    {views} {t('company.dashboard.table.views_count')}
                                                                </div>
                                                                <div className={`text-[10px] ${isLowPerf ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                    {realConversion.toFixed(1)}% {t('company.dashboard.table.conv_rate')}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={() => toggleDropdown(job.id)}
                                                                        className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors p-1"
                                                                    >
                                                                        <MoreVertical size={16} />
                                                                    </button>

                                                                    {activeDropdownJobId === job.id && (
                                                                        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-lg z-50 overflow-hidden">
                                                                            <a
                                                                                href={`/jobs/${job.id}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                                onClick={() => setActiveDropdownJobId(null)}
                                                                            >
                                                                                <Eye size={14} />
                                                                                {t('company.dashboard.actions.view_as_user')}
                                                                            </a>
                                                                            <button
                                                                                onClick={() => handleCreateAssessmentFromJob(job.id)}
                                                                                className="w-full text-left px-3 py-2 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium"
                                                                            >
                                                                                <BrainCircuit size={14} />
                                                                                {t('company.dashboard.actions.create_assessment')}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleOpenApplications(job.id)}
                                                                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                                            >
                                                                                <Users size={14} />
                                                                                {t('company.jobs.open_applications', { defaultValue: 'Open applications' })}
                                                                            </button>
                                                                            <div className="border-t border-slate-200 dark:border-slate-700"></div>
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
                                {/* Only show activity if there are jobs or it's not a brand new company */}
                                {jobs.length > 0 && (
                                    <>
                                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                                <Zap size={16} className="text-amber-500" />
                                                {t('company.dashboard.team_activity')}
                                            </div>
                                            <div className="space-y-4 text-xs text-slate-500 text-center py-4">
                                                {t('company.dashboard.empty_state_desc')}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                        <Crown size={16} className="text-cyan-500" />
                                        {t('company.dashboard.leaderboard')}
                                    </div>
                                    <div className="space-y-3 text-xs text-slate-500 text-center py-4">
                                        {t('company.dashboard.leaderboard_empty')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const renderJobs = () => {
        const visibleJobs = jobs.filter((job) => String((job as any).status || 'active') !== 'archived');

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {t('company.jobs.title', { defaultValue: 'Jobs workspace' })}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        {t('company.jobs.subtitle', { defaultValue: 'Manage live roles, route candidates into review, and publish through structured drafts.' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setEditorSeedJobId(null);
                                        setActiveTab('jobs');
                                    }}
                                    className="px-3 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-500 transition-colors"
                                >
                                    {t('company.jobs.new_draft_cta', { defaultValue: 'New draft' })}
                                </button>
                            </div>
                        </div>

                        {visibleJobs.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400">
                                {t('company.jobs.empty', { defaultValue: 'No live roles yet. Start by creating a structured draft on the right.' })}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {visibleJobs.map((job) => {
                                    const stats = jobStats[job.id] || { views: 0, applicants: 0 };
                                    const lifecycleStatus = String((job as any).status || 'active');
                                    const isClosed = lifecycleStatus === 'closed';
                                    const isPaused = lifecycleStatus === 'paused';
                                    return (
                                        <div key={job.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{job.title}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        {job.location} • {job.company}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                                        isClosed
                                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                                            : isPaused
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                    }`}>
                                                        {lifecycleStatus}
                                                    </span>
                                                    {job.legality_status && (
                                                        <span className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                            {job.legality_status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                                                    <div className="text-slate-500">Views</div>
                                                    <div className="font-semibold text-slate-900 dark:text-white">{stats.views}</div>
                                                </div>
                                                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                                                    <div className="text-slate-500">Applications</div>
                                                    <div className="font-semibold text-slate-900 dark:text-white">{stats.applicants}</div>
                                                </div>
                                                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/30 p-2">
                                                    <div className="text-slate-500">Conversion</div>
                                                    <div className="font-semibold text-slate-900 dark:text-white">
                                                        {stats.views > 0 ? `${((stats.applicants / stats.views) * 100).toFixed(1)}%` : '0.0%'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => handleEditJob(job.id)}
                                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                >
                                                    {t('company.dashboard.actions.edit')}
                                                </button>
                                                <button
                                                    onClick={() => handleOpenApplications(job.id)}
                                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                >
                                                    {t('company.jobs.open_applications', { defaultValue: 'Open applications' })}
                                                </button>
                                                <button
                                                    onClick={() => handleCreateAssessmentFromJob(job.id)}
                                                    className="px-3 py-2 rounded-lg border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                                                >
                                                    {t('company.dashboard.actions.create_assessment')}
                                                </button>
                                                {isClosed ? (
                                                    <button
                                                        onClick={async () => {
                                                            const ok = await updateJobLifecycleWithFallback(job.id, 'active');
                                                            if (!ok) {
                                                                alert(t('common.error_occurred'));
                                                                return;
                                                            }
                                                            handleEditorLifecycleChange(job.id, 'active');
                                                        }}
                                                        className="px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                                                    >
                                                        {t('company.job_editor.reopen', { defaultValue: 'Reopen' })}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleCloseJob(job.id)}
                                                        className="px-3 py-2 rounded-lg border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-950/20"
                                                    >
                                                        {t('company.dashboard.actions.close')}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteJob(job.id)}
                                                    className="px-3 py-2 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-950/20"
                                                >
                                                    {t('company.dashboard.actions.delete')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <CompanyJobEditor
                        companyProfile={companyProfile}
                        jobs={visibleJobs}
                        userEmail={userEmail}
                        seedJobId={editorSeedJobId}
                        onSeedConsumed={() => setEditorSeedJobId(null)}
                        onJobLifecycleChange={handleEditorLifecycleChange}
                    />
                </div>
            </div>
        );
    };

    const renderApplications = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {t('company.applications.title', { defaultValue: 'Applications workspace' })}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('company.applications.subtitle', { defaultValue: 'Review structured application dossiers, update statuses, and inspect shared JCFPM context.' })}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg">
                        <Briefcase size={20} />
                    </div>
                    <select
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        className="bg-transparent font-semibold text-slate-900 dark:text-slate-200 focus:outline-none cursor-pointer border-none ring-0 min-w-[220px]"
                    >
                        {jobs.map(job => (
                            <option key={job.id} value={job.id} className="bg-white dark:bg-slate-900">{job.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {t('company.candidates.applications_title', { defaultValue: 'Applications' })}
                    </h3>
                    {applicationsLoading && (
                        <span className="text-xs text-slate-500">{t('common.loading') || 'Načítám...'}</span>
                    )}
                </div>
                {applications.length === 0 && !applicationsLoading ? (
                    <div className="text-sm text-slate-500">
                        {t('company.candidates.applications_empty', { defaultValue: 'Zatím žádné aplikace pro vybranou pozici.' })}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {applications.map((app) => (
                            <div key={app.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
                                <div className="text-sm">
                                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                                        {app.candidate_name || 'Candidate'}
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-1">
                                        <div>
                                            {app.job_title || t('company.dashboard.table.position')}
                                        </div>
                                        {app.candidateHeadline && (
                                            <div className="text-[11px] text-slate-400">
                                                {app.candidateHeadline}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2 text-[11px]">
                                            {app.hasCv && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">CV</span>}
                                            {app.hasCoverLetter && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Cover letter</span>}
                                            {app.hasJcfpm && (
                                                <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                                                    JCFPM: {app.jcfpmShareLevel === 'full_report' ? 'Full' : 'Summary'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openApplicationDetail(app.id)}
                                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                                            selectedApplicationId === app.id
                                                ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                        }`}
                                    >
                                        {t('company.candidates.open_application', { defaultValue: 'Open' })}
                                    </button>
                                    <select
                                        value={app.status}
                                        onChange={(e) => handleApplicationStatusChange(app.id, e.target.value as CompanyApplicationRow['status'])}
                                        className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        disabled={applicationsUpdating[app.id]}
                                    >
                                        <option value="pending">{t('company.dashboard.status.pending')}</option>
                                        <option value="reviewed">{t('company.dashboard.status.approved', { defaultValue: 'Reviewed' })}</option>
                                        <option value="shortlisted">{t('company.dashboard.status.shortlisted', { defaultValue: 'Shortlisted' })}</option>
                                        <option value="rejected">{t('company.dashboard.status.refused', { defaultValue: 'Rejected' })}</option>
                                        <option value="hired">{t('company.dashboard.status.hired', { defaultValue: 'Hired' })}</option>
                                    </select>
                                    {applicationsUpdating[app.id] && (
                                        <span className="text-[11px] text-slate-400">{t('common.saving', { defaultValue: 'Ukládám…' })}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {(applicationDetailLoading || selectedApplicationDetail) && (
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {t('company.candidates.application_review_title', { defaultValue: 'Application review' })}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedApplicationDetail?.submitted_at
                                    ? new Date(selectedApplicationDetail.submitted_at).toLocaleString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')
                                    : t('company.candidates.application_review_desc', { defaultValue: 'Structured dossier for recruiter review.' })}
                            </p>
                        </div>
                        {selectedApplicationDetail && (
                            <button
                                onClick={() => {
                                    setSelectedApplicationId(null);
                                    setSelectedApplicationDetail(null);
                                }}
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {applicationDetailLoading ? (
                        <div className="text-sm text-slate-500">{t('common.loading') || 'Loading...'}</div>
                    ) : selectedApplicationDetail ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Candidate</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {selectedApplicationDetail.candidate_profile_snapshot?.name || selectedApplicationDetail.candidate_name || 'Candidate'}
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-300">
                                        {selectedApplicationDetail.candidate_profile_snapshot?.email || selectedApplicationDetail.candidate_email || 'No email'}
                                    </div>
                                    {selectedApplicationDetail.candidate_profile_snapshot?.phone && (
                                        <div className="text-sm text-slate-600 dark:text-slate-300">
                                            {selectedApplicationDetail.candidate_profile_snapshot.phone}
                                        </div>
                                    )}
                                    {selectedApplicationDetail.candidate_profile_snapshot?.jobTitle && (
                                        <div className="text-xs text-slate-500 mt-2">
                                            {selectedApplicationDetail.candidate_profile_snapshot.jobTitle}
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Documents</div>
                                    <div className="text-sm text-slate-700 dark:text-slate-200">
                                        {selectedApplicationDetail.cv_snapshot?.originalName || selectedApplicationDetail.cv_snapshot?.label || 'No CV attached'}
                                    </div>
                                    {selectedApplicationDetail.cv_snapshot?.fileUrl && (
                                        <a
                                            href={selectedApplicationDetail.cv_snapshot.fileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-block mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                                        >
                                            {t('company.candidates.open_cv', { defaultValue: 'Open CV' })}
                                        </a>
                                    )}
                                    <div className="text-xs text-slate-500 mt-2">
                                        Source: {selectedApplicationDetail.source || 'application_modal'}
                                    </div>
                                </div>
                            </div>

                            {selectedApplicationDetail.candidate_profile_snapshot?.skills?.length ? (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Skills</div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedApplicationDetail.candidate_profile_snapshot.skills.map((skill) => (
                                            <span key={skill} className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {selectedApplicationDetail.cover_letter ? (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Cover letter</div>
                                    <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                        {selectedApplicationDetail.cover_letter}
                                    </div>
                                </div>
                            ) : null}

                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                                <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Assessment actions</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handleCreateAssessmentFromApplication}
                                        className="px-3 py-2 rounded-lg border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                                    >
                                        Create assessment for this role
                                    </button>
                                    <button
                                        onClick={handleInviteCandidateFromApplication}
                                        className="px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                                    >
                                        Invite this candidate
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Moves you into the assessments workspace with this application context attached.
                                </p>
                            </div>

                            {selectedApplicationDetail.shared_jcfpm_payload ? (
                                <div className="rounded-lg border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/70 dark:bg-cyan-950/20 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">JCFPM</div>
                                        <div className="text-[11px] text-cyan-700 dark:text-cyan-300">
                                            {selectedApplicationDetail.jcfpm_share_level === 'full_report' ? 'Extended report' : 'Summary'}
                                        </div>
                                    </div>
                                    {selectedApplicationDetail.shared_jcfpm_payload.archetype?.title && (
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {selectedApplicationDetail.shared_jcfpm_payload.archetype.title}
                                        </div>
                                    )}
                                    {selectedApplicationDetail.shared_jcfpm_payload.strengths?.length ? (
                                        <div>
                                            <div className="text-xs text-slate-500 mb-2">Strengths</div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedApplicationDetail.shared_jcfpm_payload.strengths.map((item) => (
                                                    <span key={item} className="px-2 py-1 text-xs rounded-md bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border border-cyan-100 dark:border-cyan-900/40">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {selectedApplicationDetail.shared_jcfpm_payload.environment_fit_summary?.length ? (
                                        <div>
                                            <div className="text-xs text-slate-500 mb-2">Environment fit</div>
                                            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                                {selectedApplicationDetail.shared_jcfpm_payload.environment_fit_summary.map((item) => (
                                                    <li key={item}>• {item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                    {selectedApplicationDetail.shared_jcfpm_payload.top_dimensions?.length ? (
                                        <div>
                                            <div className="text-xs text-slate-500 mb-2">Top dimensions</div>
                                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                                {selectedApplicationDetail.shared_jcfpm_payload.top_dimensions.map((item) => (
                                                    <div key={`${item.dimension}-${item.percentile}`} className="flex items-center justify-between">
                                                        <span>{item.label || item.dimension}</span>
                                                        <span className="text-xs text-slate-500">{Math.round(item.percentile)}th pct</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                                    {t('company.candidates.no_jcfpm_shared', { defaultValue: 'No JCFPM result was shared with this application.' })}
                                </div>
                            )}

                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                                <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Related assessments</div>
                                <AssessmentResultsList
                                    companyId={companyProfile.id || ''}
                                    applicationIdFilter={selectedApplicationDetail.id}
                                    candidateEmailFilter={selectedApplicationDetail.candidate_profile_snapshot?.email || selectedApplicationDetail.candidate_email || undefined}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-500">
                            {t('company.candidates.application_detail_unavailable', { defaultValue: 'Application details are not available yet.' })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderCandidates = () => {
        const assessmentMetric = candidateBenchmarks?.assessment || null;
        const shortlistMetric = candidateBenchmarks?.shortlist_rate || null;
        const hireMetric = candidateBenchmarks?.hire_rate || null;

        if (isRealUser && candidates.length === 0) {
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
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {isLoadingCandidateBenchmarks
                                ? t('common.loading')
                                : (candidateBenchmarks?.transparency?.note || t('company.candidates.benchmark.note', { defaultValue: 'Oddělené metriky bez agregovaného quality indexu.' }))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {renderMetricCard(
                            t('company.candidates.benchmark.assessment_avg', { defaultValue: 'Assessment avg' }),
                            assessmentMetric,
                            assessmentMetric?.value != null ? `${assessmentMetric.value.toFixed(1)} / 100` : '—',
                            assessmentMetric?.peer_value != null ? `${assessmentMetric.peer_value.toFixed(1)} / 100` : undefined
                        )}
                        {renderMetricCard(
                            t('company.candidates.benchmark.shortlist_rate', { defaultValue: 'Shortlist rate' }),
                            shortlistMetric,
                            formatPct(shortlistMetric?.value),
                            formatPct(shortlistMetric?.peer_value)
                        )}
                        {renderMetricCard(
                            t('company.candidates.benchmark.hire_rate', { defaultValue: 'Hire rate' }),
                            hireMetric,
                            formatPct(hireMetric?.value),
                            formatPct(hireMetric?.peer_value)
                        )}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                            {t('company.candidates.benchmark.assessment_coverage', { defaultValue: 'Assessment coverage' })}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {assessmentMetric?.coverage
                                ? `${assessmentMetric.coverage.assessed_candidates}/${assessmentMetric.coverage.total_candidates} (${formatPct(assessmentMetric.coverage.coverage_ratio)})`
                                : 'Insufficient data'}
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                            <Users size={32} className="text-slate-400" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('company.candidates.no_candidates_title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                            {t('company.candidates.no_candidates_desc')}
                        </p>
                    </div>
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

                    <div className="w-full md:w-auto text-xs text-slate-500 dark:text-slate-400">
                        {candidateBenchmarks?.transparency?.note || t('company.candidates.benchmark.note', { defaultValue: 'Oddělené metriky bez agregovaného quality indexu.' })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderMetricCard(
                        t('company.candidates.benchmark.assessment_avg', { defaultValue: 'Assessment avg' }),
                        assessmentMetric,
                        assessmentMetric?.value != null ? `${assessmentMetric.value.toFixed(1)} / 100` : '—',
                        assessmentMetric?.peer_value != null ? `${assessmentMetric.peer_value.toFixed(1)} / 100` : undefined
                    )}
                    {renderMetricCard(
                        t('company.candidates.benchmark.shortlist_rate', { defaultValue: 'Shortlist rate' }),
                        shortlistMetric,
                        formatPct(shortlistMetric?.value),
                        formatPct(shortlistMetric?.peer_value)
                    )}
                    {renderMetricCard(
                        t('company.candidates.benchmark.hire_rate', { defaultValue: 'Hire rate' }),
                        hireMetric,
                        formatPct(hireMetric?.value),
                        formatPct(hireMetric?.peer_value)
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {candidates.map(candidate => {
                        return (
                            <div key={candidate.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-all relative overflow-hidden group">
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
                                                <Briefcase size={14} /> {candidate.experienceYears} {t('company.candidates.exp_years')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <TrendingUp size={14} />
                                                {candidate.salaryExpectation.toLocaleString()} {t('company.candidates.salary_per_month')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Risk Assessment Card */}
                                    <div className="md:w-64 bg-slate-50 dark:bg-slate-950/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 font-mono">{t('company.candidates.risk_analysis')}</h4>

                                        <div className="mb-3">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-slate-500 dark:text-slate-400">{t('company.candidates.flight_risk')}</span>
                                                <span className={`font-bold ${candidate.flightRisk === 'High' ? 'text-rose-500' : candidate.flightRisk === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {candidate.flightRisk === 'High' ? t('company.candidates.risk_levels.high') : candidate.flightRisk === 'Medium' ? t('company.candidates.risk_levels.medium') : t('company.candidates.risk_levels.low')}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full">
                                                <div
                                                    className={`h-1.5 rounded-full ${candidate.flightRisk === 'High' ? 'bg-rose-500' : candidate.flightRisk === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.max(8, Math.min(100, typeof candidate.flightRiskScore === 'number' ? candidate.flightRiskScore : (candidate.flightRisk === 'High' ? 80 : candidate.flightRisk === 'Medium' ? 50 : 20)))}%` }}
                                                ></div>
                                            </div>
                                            {typeof candidate.flightRiskScore === 'number' && (
                                                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                    Score: {candidate.flightRiskScore}/100
                                                </div>
                                            )}
                                        </div>

                                        {Array.isArray(candidate.flightRiskBreakdown) && candidate.flightRiskBreakdown.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                                                {candidate.flightRiskBreakdown.slice(0, 4).map((factor, idx) => (
                                                    <div key={`${candidate.id}-risk-${idx}`} className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed flex justify-between gap-2">
                                                        <span>{factor.reason}</span>
                                                        <span className={factor.impact_points > 0 ? 'text-rose-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                                                            {factor.impact_points > 0 ? '+' : ''}{factor.impact_points}
                                                        </span>
                                                    </div>
                                                ))}
                                                {candidate.flightRiskMethodVersion && (
                                                    <div className="text-[10px] text-slate-400 pt-1">
                                                        method: {candidate.flightRiskMethodVersion}
                                                    </div>
                                                )}
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
                        onClick={() => setActiveTab('jobs')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'jobs' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.jobs.nav', { defaultValue: 'Jobs' })}
                    </button>
                    <button
                        onClick={() => setActiveTab('applications')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'applications' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        {t('company.applications.nav', { defaultValue: 'Applications' })}
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
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'settings' && effectiveCompanyProfile && <CompanySettings profile={effectiveCompanyProfile} onSave={onProfileUpdate || (() => { })} onDeleteAccount={onDeleteAccount} />}
                {activeTab === 'jobs' && renderJobs()}
                {activeTab === 'applications' && renderApplications()}
                {activeTab === 'assessments' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-slate-500">{t('company.assessments_tab.desc')}</div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowInvitationsList(prev => !prev)} className="px-3 py-1 rounded-md border text-sm">{showInvitationsList ? t('company.assessments_tab.close_invites') : t('company.assessments_tab.manage_invites')}</button>
                                <button onClick={() => setShowInvitationModal(true)} className="px-3 py-1 rounded-md bg-cyan-600 text-white text-sm">{t('company.assessments_tab.invite_btn')}</button>
                            </div>
                        </div>

                        {assessmentContext && (
                            <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/30 dark:bg-cyan-950/20">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Linked review context</div>
                                        <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 font-semibold">
                                            {assessmentContext.jobTitle || 'Selected role'}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-2">
                                            {assessmentContext.candidateName && <span>{assessmentContext.candidateName}</span>}
                                            {assessmentContext.candidateEmail && <span>{assessmentContext.candidateEmail}</span>}
                                            {assessmentContext.assessmentId && (
                                                <span className="px-2 py-0.5 rounded bg-white/70 dark:bg-slate-900/40 border border-cyan-100 dark:border-cyan-900/30">
                                                    Assessment ID: {assessmentContext.assessmentId.slice(0, 8)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {assessmentContext.applicationId && (
                                            <button
                                                onClick={() => setActiveTab('applications')}
                                                className="px-3 py-1 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                            >
                                                Back to application
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowInvitationModal(true)}
                                            className="px-3 py-1 rounded-md border border-cyan-200 text-sm text-cyan-700 hover:bg-white dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-slate-900"
                                        >
                                            Invite from this context
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Saved assessment library
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        Reuse, duplicate, preview, and retire assessments without leaving this workspace.
                                    </div>
                                </div>
                                {assessmentLibraryLoading && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</div>
                                )}
                            </div>

                            {assessmentLibrary.length === 0 && !assessmentLibraryLoading ? (
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    No saved assessments yet. Generate one below and it will appear here.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {assessmentLibrary.map((item) => {
                                        const isActiveAssessment = assessmentContext?.assessmentId === item.id;
                                        const busy = assessmentLibraryBusyId === item.id;
                                        return (
                                            <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-3">
                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {item.title}
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{item.role}</span>
                                                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">ID: {item.id.slice(0, 8)}</span>
                                                            {isActiveAssessment && (
                                                                <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                                                                    Selected
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => handleUseSavedAssessment(item)}
                                                            className="px-3 py-1.5 rounded-md border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                                                        >
                                                            Use
                                                        </button>
                                                        <button
                                                            onClick={() => openAssessmentPreviewPage(item)}
                                                            className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                        >
                                                            Preview
                                                        </button>
                                                        <button
                                                            onClick={() => handleDuplicateAssessment(item.id)}
                                                            disabled={busy}
                                                            className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                                                        >
                                                            Duplicate
                                                        </button>
                                                        <button
                                                            onClick={() => handleArchiveAssessment(item.id)}
                                                            disabled={busy}
                                                            className="px-3 py-1.5 rounded-md border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-950/20 disabled:opacity-50"
                                                        >
                                                            Archive
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {showInvitationsList && (
                            <div className="mb-6">
                                <MyInvitations forCompany />
                            </div>
                        )}

                        <div className="mb-6">
                            <AssessmentResultsList
                                companyId={companyProfile.id || ''}
                                jobTitleFilter={assessmentContext?.jobTitle}
                                candidateEmailFilter={assessmentContext?.candidateEmail}
                                applicationIdFilter={assessmentContext?.applicationId}
                            />
                        </div>

                        {showInvitationModal && (
                            <AssessmentInvitationModal
                                companyId={companyProfile?.id || ''}
                                onClose={() => setShowInvitationModal(false)}
                                onSent={() => setShowInvitationsList(true)}
                                initialAssessmentId={assessmentContext?.assessmentId}
                                initialCandidateEmail={assessmentContext?.candidateEmail}
                                initialCandidateId={assessmentContext?.candidateId || null}
                                initialApplicationId={assessmentContext?.applicationId || null}
                                initialJobId={assessmentContext?.jobId || null}
                                initialJobTitle={assessmentContext?.jobTitle}
                                initialAssessmentName={assessmentContext?.assessmentName}
                                initialMetadata={assessmentContext ? {
                                    application_id: assessmentContext.applicationId || null,
                                    job_id: assessmentContext.jobId || null,
                                    candidate_name: assessmentContext.candidateName || null
                                } : null}
                            />
                        )}

                        <AssessmentCreator
                            companyProfile={effectiveCompanyProfile || null}
                            jobs={jobs}
                            initialJobId={assessmentJobId}
                            onAssessmentSaved={(assessment) => {
                                setAssessmentLibrary((prev) => [assessment, ...prev.filter((item) => item.id !== assessment.id)]);
                                setAssessmentContext((prev) => ({
                                    ...(prev || {}),
                                    assessmentId: assessment.id,
                                    assessmentName: assessment.title,
                                    jobTitle: prev?.jobTitle || assessment.role
                                }));
                            }}
                        />
                    </div>
                )}
                {activeTab === 'candidates' && renderCandidates()}
            </div>

            <PlanUpgradeModal
                isOpen={showUpgradeModal.open}
                onClose={() => setShowUpgradeModal({ open: false })}
                feature={showUpgradeModal.feature}
                companyProfile={effectiveCompanyProfile}
            />
        </div>
    );
};

export default CompanyDashboard;
