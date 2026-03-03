import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Briefcase, Search, TrendingUp, Users } from 'lucide-react';
import { Candidate, CandidateBenchmarkMetric, CandidateBenchmarkMetrics, Job } from '../../types';
import MetricCard from './MetricCard';
import SectionHeader from './SectionHeader';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspacePanel from './WorkspacePanel';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

interface CompanyCandidatesWorkspaceProps {
    jobs: Job[];
    selectedJobId: string;
    selectedJob: Job | null;
    candidates: Candidate[];
    candidateBenchmarks: CandidateBenchmarkMetrics | null;
    isLoadingCandidateBenchmarks: boolean;
    lastSyncedAt?: string | null;
    onSelectedJobChange: (jobId: string) => void;
    onRefresh: () => void;
}

const formatPct = (value: number | null | undefined): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return `${(value * 100).toFixed(1)}%`;
};

const getCandidateMatchScore = (candidate: Candidate): number | null => {
    const raw = (candidate as any).matchScore ?? (candidate as any).fitScore ?? (candidate as any).profile_fit_score;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
};

const getCandidateHasJcfpm = (candidate: Candidate): boolean => {
    const anyCandidate = candidate as any;
    return Boolean(
        anyCandidate.hasJcfpm
        || anyCandidate.has_jcfpm
        || anyCandidate.jcfpmSummary
        || anyCandidate.jcfpm_summary
        || anyCandidate.sharedJcfpmPayload
        || anyCandidate.shared_jcfpm_payload
    );
};

const getCandidateCreatedAt = (candidate: Candidate): number => {
    const raw = (candidate as any).createdAt ?? (candidate as any).created_at;
    const ts = raw ? new Date(String(raw)).getTime() : NaN;
    return Number.isFinite(ts) ? ts : 0;
};

const getCandidateComparisonSignals = (candidate: Candidate) => {
    return Array.isArray(candidate.jcfpmComparisonSignals) ? candidate.jcfpmComparisonSignals.slice(0, 4) : [];
};

const getCandidateComparisonSignalScore = (candidate: Candidate, key: string): number => {
    if (!Array.isArray(candidate.jcfpmComparisonSignals)) return -1;
    const signal = candidate.jcfpmComparisonSignals.find((entry) => entry.key === key);
    return typeof signal?.score === 'number' && Number.isFinite(signal.score) ? signal.score : -1;
};

const CompanyCandidatesWorkspace: React.FC<CompanyCandidatesWorkspaceProps> = ({
    jobs,
    selectedJobId,
    selectedJob,
    candidates,
    candidateBenchmarks,
    isLoadingCandidateBenchmarks,
    lastSyncedAt,
    onSelectedJobChange,
    onRefresh
}) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [candidateRoleFilter, setCandidateRoleFilter] = useState('all');
    const [fitFilter, setFitFilter] = useState<'all' | 'high' | 'mid' | 'low' | 'unknown'>('all');
    const [jcfpmFilter, setJcfpmFilter] = useState<'all' | 'with' | 'without'>('all');
    const [sortBy, setSortBy] = useState<
        'recent'
        | 'fit_desc'
        | 'name_asc'
        | 'role_asc'
        | 'experience_desc'
        | 'risk_asc'
        | 'analytical_desc'
        | 'collaboration_desc'
        | 'adaptability_desc'
        | 'judgement_desc'
    >('recent');
    const assessmentMetric = candidateBenchmarks?.assessment || null;
    const shortlistMetric = candidateBenchmarks?.shortlist_rate || null;
    const hireMetric = candidateBenchmarks?.hire_rate || null;
    const candidateRoleOptions = useMemo(
        () => Array.from(new Set(
            candidates
                .map((candidate) => String(candidate.role || '').trim())
                .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b)),
        [candidates]
    );
    const filteredCandidates = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const next = candidates.filter((candidate) => {
            const role = String(candidate.role || '').trim();
            const matchScore = getCandidateMatchScore(candidate);
            const hasJcfpm = getCandidateHasJcfpm(candidate);
            const haystack = [
                candidate.name,
                role,
                candidate.bio,
                ...(candidate.skills || []),
                ...((candidate.values || []).map((value) => String(value)))
            ].join(' ').toLowerCase();

            if (query && !haystack.includes(query)) return false;
            if (candidateRoleFilter !== 'all' && role !== candidateRoleFilter) return false;
            if (jcfpmFilter === 'with' && !hasJcfpm) return false;
            if (jcfpmFilter === 'without' && hasJcfpm) return false;
            if (fitFilter === 'high' && (matchScore == null || matchScore < 75)) return false;
            if (fitFilter === 'mid' && (matchScore == null || matchScore < 50 || matchScore >= 75)) return false;
            if (fitFilter === 'low' && (matchScore == null || matchScore >= 50)) return false;
            if (fitFilter === 'unknown' && matchScore != null) return false;
            return true;
        });

        next.sort((a, b) => {
            if (sortBy === 'analytical_desc') return getCandidateComparisonSignalScore(b, 'analytical') - getCandidateComparisonSignalScore(a, 'analytical');
            if (sortBy === 'collaboration_desc') return getCandidateComparisonSignalScore(b, 'collaboration') - getCandidateComparisonSignalScore(a, 'collaboration');
            if (sortBy === 'adaptability_desc') return getCandidateComparisonSignalScore(b, 'adaptability') - getCandidateComparisonSignalScore(a, 'adaptability');
            if (sortBy === 'judgement_desc') return getCandidateComparisonSignalScore(b, 'judgement') - getCandidateComparisonSignalScore(a, 'judgement');
            if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
            if (sortBy === 'role_asc') return String(a.role || '').localeCompare(String(b.role || ''));
            if (sortBy === 'experience_desc') return (b.experienceYears || 0) - (a.experienceYears || 0);
            if (sortBy === 'risk_asc') return (a.flightRiskScore ?? 999) - (b.flightRiskScore ?? 999);
            if (sortBy === 'fit_desc') return (getCandidateMatchScore(b) ?? -1) - (getCandidateMatchScore(a) ?? -1);
            return getCandidateCreatedAt(b) - getCandidateCreatedAt(a);
        });

        return next;
    }, [candidates, searchQuery, candidateRoleFilter, fitFilter, jcfpmFilter, sortBy]);
    const renderMetricCard = (
        title: string,
        metric: CandidateBenchmarkMetric | null,
        display: string,
        peerDisplay?: string
    ) => (
        <MetricCard
            label={title}
            value={!metric || metric.insufficient_data ? (
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {t('company.candidates.benchmark.insufficient_data', { defaultValue: 'Insufficient data' })}
                </span>
            ) : display}
            hint={!metric || metric.insufficient_data
                ? undefined
                : peerDisplay
                    ? t('company.candidates.benchmark.vs_peer', { defaultValue: 'Vs market/peer: {{value}}', value: peerDisplay })
                    : t('company.candidates.benchmark.data_summary', {
                        defaultValue: 'Source: {{source}} • N={{sample}} • {{days}}d • confidence {{confidence}}',
                        source: metric.source_name,
                        sample: metric.sample_size,
                        days: metric.data_window_days,
                        confidence: metric.confidence_tier
                    })}
        />
    );

    return (
        <div className="space-y-4 animate-in fade-in">
            <WorkspaceHeader
                badgeIcon={<Users size={12} />}
                badgeLabel={t('company.dashboard.tabs.candidates', { defaultValue: 'Talent view' })}
                title={t('company.dashboard.tabs.candidates', { defaultValue: 'Talent view' })}
                subtitle={t('company.workspace.cards.candidate_intelligence_desc', { defaultValue: 'A quick read on candidate flow quality, coverage, and shortlist health.' })}
                actions={
                    <>
                        <WorkspaceSyncBadge
                            loading={isLoadingCandidateBenchmarks}
                            syncedAt={lastSyncedAt}
                            loadingKey="company.workspace.sync.syncing_candidates"
                            loadingDefault="Syncing candidate signals..."
                            onRefresh={onRefresh}
                        />
                        <div className="company-surface rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 min-w-[240px] shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/50">
                            <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                                {t('company.assessment_library.selected_role', { defaultValue: 'Selected role' })}
                            </div>
                            <select
                                value={selectedJobId}
                                onChange={(e) => onSelectedJobChange(e.target.value)}
                                className="w-full bg-transparent font-semibold text-slate-900 dark:text-slate-200 focus:outline-none cursor-pointer border-none ring-0 p-0"
                            >
                                {jobs.map((job) => (
                                    <option key={job.id} value={job.id} className="bg-white dark:bg-slate-900">{job.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="company-surface rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400 max-w-md">
                            {isLoadingCandidateBenchmarks
                                ? t('common.loading')
                                : (candidateBenchmarks?.transparency?.note || t('company.candidates.benchmark.note', { defaultValue: 'Separate operational metrics without an aggregated quality index yet.' }))}
                        </div>
                    </>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard
                    label={t('company.workspace.cards.candidate_count', { defaultValue: 'People in view' })}
                    value={filteredCandidates.length}
                    hint={selectedJob?.title || t('company.dashboard.table.position')}
                />
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

            <WorkspacePanel className="p-3">
                <SectionHeader
                    title={t('company.candidates.benchmark.assessment_coverage', { defaultValue: 'Assessment coverage' })}
                    subtitle={t('company.workspace.cards.candidate_coverage_desc', { defaultValue: 'Completed assessments compared with the total candidate pool for the selected role.' })}
                    className="mb-2"
                />
                <div className="text-sm text-slate-600 dark:text-slate-300">
                    {assessmentMetric?.coverage
                        ? `${assessmentMetric.coverage.assessed_candidates}/${assessmentMetric.coverage.total_candidates} (${formatPct(assessmentMetric.coverage.coverage_ratio)})`
                        : t('company.workspace.cards.candidate_coverage_empty', { defaultValue: 'No completed assessments yet' })}
                </div>
            </WorkspacePanel>

            <WorkspacePanel className="p-3">
                <SectionHeader
                    title={t('company.candidates.filters_title', { defaultValue: 'Search, filter, and rank candidates' })}
                    subtitle={t('company.candidates.filters_desc', { defaultValue: 'Slice the list by role, fit score, JCFPM availability, or keyword before opening a profile.' })}
                    className="mb-3"
                />
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.6fr))]">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                        <Search size={16} className="text-slate-400" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('company.candidates.search_placeholder', { defaultValue: 'Search by name, role, skill, value, keyword...' })}
                            className="w-full bg-transparent outline-none placeholder:text-slate-400"
                        />
                    </label>

                    <select
                        value={candidateRoleFilter}
                        onChange={(e) => setCandidateRoleFilter(e.target.value)}
                        className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200"
                    >
                        <option value="all">{t('company.candidates.filters.all_roles', { defaultValue: 'All candidate roles' })}</option>
                        {candidateRoleOptions.map((role) => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>

                    <select
                        value={fitFilter}
                        onChange={(e) => setFitFilter(e.target.value as typeof fitFilter)}
                        className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200"
                    >
                        <option value="all">{t('company.candidates.filters.fit_all', { defaultValue: 'Any fit score' })}</option>
                        <option value="high">{t('company.candidates.filters.fit_high', { defaultValue: 'Fit 75+' })}</option>
                        <option value="mid">{t('company.candidates.filters.fit_mid', { defaultValue: 'Fit 50-74' })}</option>
                        <option value="low">{t('company.candidates.filters.fit_low', { defaultValue: 'Fit under 50' })}</option>
                        <option value="unknown">{t('company.candidates.filters.fit_unknown', { defaultValue: 'Fit missing' })}</option>
                    </select>

                    <select
                        value={jcfpmFilter}
                        onChange={(e) => setJcfpmFilter(e.target.value as typeof jcfpmFilter)}
                        className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200"
                    >
                        <option value="all">{t('company.candidates.filters.jcfpm_all', { defaultValue: 'JCFPM: all' })}</option>
                        <option value="with">{t('company.candidates.filters.jcfpm_with', { defaultValue: 'Has JCFPM' })}</option>
                        <option value="without">{t('company.candidates.filters.jcfpm_without', { defaultValue: 'No JCFPM' })}</option>
                    </select>

                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
                        <ArrowUpDown size={15} className="text-slate-400" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="w-full bg-transparent outline-none"
                        >
                            <option value="recent">{t('company.candidates.sort.recent', { defaultValue: 'Newest first' })}</option>
                            <option value="fit_desc">{t('company.candidates.sort.fit_desc', { defaultValue: 'Best fit first' })}</option>
                            <option value="experience_desc">{t('company.candidates.sort.experience_desc', { defaultValue: 'Most experience' })}</option>
                            <option value="risk_asc">{t('company.candidates.sort.risk_asc', { defaultValue: 'Lowest risk' })}</option>
                            <option value="analytical_desc">{t('company.candidates.sort.analytical_desc', { defaultValue: 'Analytical signal' })}</option>
                            <option value="collaboration_desc">{t('company.candidates.sort.collaboration_desc', { defaultValue: 'Collaboration signal' })}</option>
                            <option value="adaptability_desc">{t('company.candidates.sort.adaptability_desc', { defaultValue: 'Adaptability signal' })}</option>
                            <option value="judgement_desc">{t('company.candidates.sort.judgement_desc', { defaultValue: 'Judgement signal' })}</option>
                            <option value="name_asc">{t('company.candidates.sort.name_asc', { defaultValue: 'Name A-Z' })}</option>
                            <option value="role_asc">{t('company.candidates.sort.role_asc', { defaultValue: 'Role A-Z' })}</option>
                        </select>
                    </label>
                </div>
            </WorkspacePanel>

            {filteredCandidates.length === 0 ? (
                <div className="company-surface rounded-[22px] border border-dashed border-slate-200 dark:border-slate-800 bg-white/90 p-6 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)] dark:bg-slate-900/90">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <Users size={28} className="text-slate-400" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        {candidates.length === 0
                            ? t('company.candidates.no_candidates_title')
                            : t('company.candidates.no_filtered_candidates_title', { defaultValue: 'No candidates match these filters' })}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        {candidates.length === 0
                            ? t('company.candidates.no_candidates_desc')
                            : t('company.candidates.no_filtered_candidates_desc', { defaultValue: 'Try a broader search, reset the role filter, or allow candidates without fit/JCFPM data.' })}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredCandidates.map((candidate) => (
                        <div key={candidate.id} className="company-surface group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.42)] transition-all hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/92 dark:hover:border-slate-700">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{candidate.name}</h3>
                                        <span className="company-pill-surface rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{candidate.role || (candidate as any).job_title}</span>
                                        {getCandidateHasJcfpm(candidate) && (
                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                {t('company.candidates.jcfpm_badge', { defaultValue: 'JCFPM' })}
                                            </span>
                                        )}
                                        {getCandidateMatchScore(candidate) != null && (
                                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-900/30 dark:bg-cyan-950/20 dark:text-cyan-300">
                                                {t('company.candidates.fit_badge', { defaultValue: 'Fit' })}: {Math.round(getCandidateMatchScore(candidate) || 0)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 mb-3 max-w-2xl text-sm">{candidate.bio}</p>

                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {candidate.skills.map((skill) => (
                                            <span key={skill} className="company-pill-surface rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-5 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Briefcase size={14} /> {candidate.experienceYears} {t('company.candidates.exp_years')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <TrendingUp size={14} />
                                            {candidate.salaryExpectation.toLocaleString()} {t('company.candidates.salary_per_month')}
                                        </span>
                                    </div>

                                    {getCandidateComparisonSignals(candidate).length > 0 && (
                                        <div className="mt-4 rounded-2xl border border-cyan-100/80 bg-cyan-50/60 p-3 dark:border-cyan-900/30 dark:bg-cyan-950/10">
                                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                                                {t('company.candidates.comparison_signals', { defaultValue: 'Comparable signal' })}
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {getCandidateComparisonSignals(candidate).map((signal) => (
                                                    <div key={`${candidate.id}-${signal.key}`} className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                                                        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                                            {signal.label}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-cyan-500"
                                                                    style={{ width: `${Math.max(6, Math.min(100, signal.score || 0))}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{signal.score}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="company-surface-soft md:w-60 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/85 p-3 dark:bg-slate-950/50">
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
                                                {t('company.candidates.risk_score', { defaultValue: 'Score: {{value}}/100', value: candidate.flightRiskScore })}
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
                                                    {t('company.candidates.risk_method', { defaultValue: 'Method: {{value}}', value: candidate.flightRiskMethodVersion })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CompanyCandidatesWorkspace;
