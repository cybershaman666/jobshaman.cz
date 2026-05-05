import type { DialogueSummary, UserProfile } from '../../types';
import { evaluateRole } from '../intelligence';
import type { CandidateInsight, CandidatePreferenceProfile, HandshakeBlueprint, Role } from '../models';

const getDimensionLabel = (dimension: string, t: any): string => {
  const labels: Record<string, { key: string; def: string }> = {
    d1_cognitive: { key: 'rebuild.dimensions.cognitive_flex', def: 'Cognitive flex' },
    d2_social: { key: 'rebuild.dimensions.social_intelligence', def: 'Social intelligence' },
    d3_motivational: { key: 'rebuild.dimensions.motivation', def: 'Motivation' },
    d4_energy: { key: 'rebuild.dimensions.stress_resilience', def: 'Stress resilience' },
    d5_values: { key: 'rebuild.dimensions.values', def: 'Values' },
    d6_ai_readiness: { key: 'rebuild.dimensions.tech_adaptability', def: 'Tech adaptability' },
    d7_cognitive_reflection: { key: 'rebuild.dimensions.cognitive_reflection', def: 'Cognitive reflection' },
    d8_digital_eq: { key: 'rebuild.dimensions.digital_eq', def: 'Digital EQ' },
    d9_systems_thinking: { key: 'rebuild.dimensions.systems_thinking', def: 'Systems thinking' },
    d10_ambiguity_interpretation: { key: 'rebuild.dimensions.ambiguity_handling', def: 'Ambiguity handling' },
    d11_problem_decomposition: { key: 'rebuild.dimensions.strategic_thinking', def: 'Strategic thinking' },
    d12_moral_compass: { key: 'rebuild.dimensions.moral_compass', def: 'Moral compass' },
  };
  const label = labels[dimension];
  return label ? t(label.key, { defaultValue: label.def }) : dimension;
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface CandidateDashboardViewModel {
  archetypeTitle: string;
  archetypeDescription: string;
  resonanceScore: number;
  recommendedGrowthTitle: string;
  recommendedGrowthCopy: string;
  growthMeta: string;
  growthProgress: number;
  blindSpots: Array<{ label: string; self: number; reality: number; delta: number }>;
  heroMetrics: Array<{ id: string; label: string; value: number; tone: 'gold' | 'teal' | 'muted' }>;
  growthMapNodes: Array<{ id: string; title: string; caption: string; tone: 'current' | 'focus' | 'future' }>;
  signalCards: Array<{ id: string; label: string; value: string; icon: 'calendar' | 'target' | 'briefcase' | 'sparkles' }>;
  quickActions: Array<{ id: string; label: string; tone: 'primary' | 'secondary' }>;
  mentorAdvice: string;
  challengeTags: string[];
}

export interface RecruiterDashboardMetricCard {
  id: string;
  label: string;
  value: string;
  delta: string;
  tone: 'neutral' | 'blue' | 'orange' | 'green';
}

export interface RecruiterDashboardRoleCard {
  id: string;
  title: string;
  team: string;
  candidates: number;
  status: string;
  accent: string;
}

export interface RecruiterDashboardResonanceMetric {
  id: string;
  label: string;
  value: number;
}

export interface RecruiterDashboardCandidate {
  id: string;
  name: string;
  role: string;
  score: number;
  avatarSeed: string;
}

export interface RecruiterDashboardPipelineStage {
  id: string;
  label: string;
  count: number;
  color: string;
}

export interface RecruiterDashboardCompositionSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface RecruiterDashboardViewModel {
  metrics: RecruiterDashboardMetricCard[];
  radarMetrics: Array<{ label: string; teamValue: number; benchmarkValue: number }>;
  activeRoles: RecruiterDashboardRoleCard[];
  resonance: RecruiterDashboardResonanceMetric[];
  topCandidates: RecruiterDashboardCandidate[];
  pipeline: RecruiterDashboardPipelineStage[];
  composition: RecruiterDashboardCompositionSlice[];
  tip: string;
}

export interface RecruiterMetricsInput {
  curatedRoles: number;
  importedRoles: number;
  blueprints: number;
  candidates: number;
  interviewsBooked: number;
  submittedJourneys: number;
}

export const buildCandidateDashboardViewModel = (
  roles: Role[],
  preferences: CandidatePreferenceProfile,
  userProfile: UserProfile,
  applications: DialogueSummary[],
  _resolvedMode: 'light' | 'dark',
  t: any,
): CandidateDashboardViewModel => {
  const snapshot = userProfile.preferences?.jcfpm_v1;
  const slotLimit = userProfile.subscription?.tier === 'premium' ? 25 : (userProfile.slots || 5);
  const bestRole = roles
    .map((role) => ({ role, evaluation: evaluateRole(role, preferences, t) }))
    .sort((left, right) => right.evaluation.jhi.personalizedScore - left.evaluation.jhi.personalizedScore)[0];
  const scoreBase = bestRole ? Math.round(bestRole.evaluation.jhi.personalizedScore) : 72;
  const confidenceBoost = snapshot?.confidence ? Math.round(snapshot.confidence * 10) : 0;
  const storyBoost = (userProfile.story || preferences.story || '').length > 160 ? 5 : 0;
  const resonanceScore = clamp(scoreBase + confidenceBoost + storyBoost - Math.max(0, applications.length - 2), 58, 97);
  const archetype = snapshot?.archetype;
  const archetypeTitle = archetype?.title || archetype?.title_en || userProfile.jobTitle || t('rebuild.dashboard.default_archetype', { defaultValue: 'Visionary Architect' });
  const archetypeDescription =
    archetype?.description
    || snapshot?.ai_report?.strengths?.[0]
    || t('rebuild.dashboard.default_archetype_desc', { defaultValue: 'You see connections where others are not looking yet. You build systems that make sense.' });

  const sortedScores = [...(snapshot?.dimension_scores || [])]
    .sort((left, right) => (right.percentile || 0) - (left.percentile || 0));
  const lowScores = [...(snapshot?.dimension_scores || [])]
    .sort((left, right) => (left.percentile || 0) - (right.percentile || 0));
  const growthSource = snapshot?.ai_report?.development_areas?.[0] || lowScores[0]?.label || getDimensionLabel('d7_cognitive_reflection', t);
  const recommendedGrowthTitle = t('rebuild.dashboard.growth_title', { defaultValue: 'Improve your {{source}}', source: String(growthSource).toLowerCase() });
  const recommendedGrowthCopy = snapshot
    ? t('rebuild.dashboard.growth_copy_ready', { defaultValue: 'Training focused on deeper analysis, working with assumptions and more precise decision making.' })
    : t('rebuild.dashboard.growth_copy_pending', { defaultValue: 'Complete your JCFPM profile and Cybershaman will recommend a precise growth training.' });

  const blindSeeds = lowScores.length > 0
    ? lowScores.slice(0, 3)
    : [
        { dimension: 'd7_cognitive_reflection', percentile: 58, label: getDimensionLabel('d7_cognitive_reflection', t) },
        { dimension: 'd2_social', percentile: 66, label: t('rebuild.dashboard.delegation', { defaultValue: 'Delegation' }) },
        { dimension: 'd11_problem_decomposition', percentile: 72, label: t('rebuild.dashboard.patience', { defaultValue: 'Patience' }) },
      ];

  return {
    archetypeTitle,
    archetypeDescription,
    resonanceScore,
    recommendedGrowthTitle,
    recommendedGrowthCopy,
    growthMeta: snapshot ? t('rebuild.dashboard.growth_meta_ready', { defaultValue: '2 weeks • 5 lessons • 30 min/day' }) : t('rebuild.dashboard.growth_meta_pending', { defaultValue: 'Precise map unlocks after JCFPM' }),
    growthProgress: snapshot ? 60 : 24,
    blindSpots: blindSeeds.map((score, index) => {
      const percentile = clamp(Number(score.percentile || 62), 35, 88);
      const reality = clamp(percentile + 12 + (index * 5), 42, 92);
      const self = clamp(reality + 15 + (index * 6), 58, 100);
      return {
        label: score.label || getDimensionLabel(String(score.dimension), t) || t('rebuild.dashboard.blind_spot', { defaultValue: 'Blind spot' }),
        self,
        reality,
        delta: reality - self,
      };
    }),
    heroMetrics: (sortedScores.length > 0 ? sortedScores.slice(0, 6) : [
      { dimension: 'd9_systems_thinking', percentile: 87, label: getDimensionLabel('d9_systems_thinking', t) },
      { dimension: 'd6_ai_readiness', percentile: 81, label: getDimensionLabel('d6_ai_readiness', t) },
      { dimension: 'd11_problem_decomposition', percentile: 84, label: getDimensionLabel('d11_problem_decomposition', t) },
      { dimension: 'd4_energy', percentile: 80, label: getDimensionLabel('d4_energy', t) },
      { dimension: 'd2_social', percentile: 79, label: getDimensionLabel('d2_social', t) },
      { dimension: 'd7_cognitive_reflection', percentile: 76, label: getDimensionLabel('d7_cognitive_reflection', t) },
    ]).map((score, index) => ({
      id: String(score.dimension || index),
      label: score.label || getDimensionLabel(String(score.dimension), t) || t('rebuild.dashboard.signal', { defaultValue: 'Signal' }),
      value: Number(((score.percentile || 70) / 10).toFixed(1)),
      tone: (index % 3 === 0 ? 'gold' : index % 3 === 1 ? 'teal' : 'muted') as 'gold' | 'teal' | 'muted',
    })),
    growthMapNodes: [
      { id: 'current', title: t('rebuild.dashboard.default_current_role_name', { defaultValue: 'Analyst' }), caption: t('rebuild.dashboard.current_level', { defaultValue: 'Current level' }), tone: 'current' },
      { id: 'focus', title: archetypeTitle, caption: t('rebuild.dashboard.next_milestone', { defaultValue: 'Next milestone' }), tone: 'focus' },
      { id: 'future', title: t('rebuild.dashboard.default_future_role_name', { defaultValue: 'Innovation Leader' }), caption: t('rebuild.dashboard.future_potential', { defaultValue: 'Future potential' }), tone: 'future' },
    ],
    signalCards: [
      { id: 'applications', label: t('rebuild.dashboard.active_submissions', { defaultValue: 'Active submissions' }), value: String(applications.length), icon: 'calendar' },
      { id: 'slots', label: t('rebuild.dashboard.free_slots', { defaultValue: 'Free slots' }), value: String(Math.max(0, slotLimit - applications.length)), icon: 'target' },
      { id: 'roles', label: t('rebuild.dashboard.saved_roles', { defaultValue: 'Saved roles' }), value: String(Math.min(Math.max(roles.length, 1), 12)), icon: 'briefcase' },
      { id: 'status', label: t('rebuild.dashboard.data_status', { defaultValue: 'Data status' }), value: applications.length > 0 ? t('rebuild.dashboard.status_actual', { defaultValue: 'Actual' }) : t('rebuild.dashboard.status_sync', { defaultValue: 'Sync' }), icon: 'sparkles' },
    ],
    quickActions: [
      { id: 'jcfpm', label: 'JCFPM', tone: 'primary' },
      { id: 'marketplace', label: 'Marketplace', tone: 'secondary' },
      { id: 'profile', label: t('rebuild.dashboard.save_profile', { defaultValue: 'Save profile' }), tone: 'secondary' },
      { id: 'save-role', label: t('rebuild.dashboard.save_top_role', { defaultValue: 'Save top role' }), tone: 'secondary' },
    ],
    mentorAdvice: snapshot?.ai_report?.next_steps?.[0]
      || t('rebuild.dashboard.default_mentor_advice', { defaultValue: 'You have strong potential in systems thinking. Try to focus more on cognitive reflection, it will help you make even better decisions in complex situations.' }),
    challengeTags: roles[0]?.skills.slice(0, 3) || [t('rebuild.dashboard.tag_strategy', { defaultValue: 'Strategy' }), t('rebuild.dashboard.tag_processes', { defaultValue: 'Processes' }), 'AI'],
  };
};

export const buildRecruiterDashboardViewModel = (
  roles: Role[],
  candidateInsights: CandidateInsight[],
  blueprintLibrary: HandshakeBlueprint[],
  dashboardMetrics: RecruiterMetricsInput,
  t: any,
): RecruiterDashboardViewModel => {
  const seededRoles = roles.slice(0, 5);
  const roleStatuses = [
    t('rebuild.recruiter.status_sandbox', { defaultValue: 'In sandbox' }),
    t('rebuild.recruiter.status_handshake', { defaultValue: 'Handshake' }),
    t('rebuild.recruiter.status_assigned', { defaultValue: 'Assigned' }),
    t('rebuild.recruiter.status_drafts', { defaultValue: 'Drafts' }),
    t('rebuild.recruiter.status_sandbox', { defaultValue: 'In sandbox' })
  ];
  const roleAccents = ['#dceafe', '#fff0da', '#def7ea', '#f3e8ff', '#dbeafe'];
  const candidateCountBase = Math.max(candidateInsights.length, 3);
  const metrics: RecruiterDashboardMetricCard[] = [
    { id: 'active_roles', label: t('rebuild.recruiter.active_challenges', { defaultValue: 'Active challenges' }), value: String(Math.max(roles.length, dashboardMetrics.curatedRoles + dashboardMetrics.importedRoles)), delta: t('rebuild.recruiter.new_this_week', { defaultValue: '▲ {{n}} new this week', n: Math.max(2, seededRoles.length) }), tone: 'neutral' },
    { id: 'candidates', label: t('rebuild.recruiter.candidates_in_play', { defaultValue: 'Candidates in play' }), value: String(Math.max(candidateInsights.length, dashboardMetrics.candidates)), delta: t('rebuild.recruiter.this_week', { defaultValue: '▲ {{n}} this week', n: Math.max(8, candidateInsights.length * 2) }), tone: 'blue' },
    { id: 'handshake', label: t('rebuild.recruiter.handshake_in_progress', { defaultValue: 'Handshake in progress' }), value: String(Math.max(dashboardMetrics.submittedJourneys, 12)), delta: t('rebuild.recruiter.this_week', { defaultValue: '▲ {{n}} this week', n: Math.max(3, Math.floor(dashboardMetrics.submittedJourneys / 2) || 4) }), tone: 'orange' },
    { id: 'success', label: t('rebuild.recruiter.hire_success_rate', { defaultValue: 'Hire success rate' }), value: `${clamp(78 + dashboardMetrics.blueprints * 2, 78, 96)}%`, delta: t('rebuild.recruiter.vs_last_quarter', { defaultValue: '▲ {{n}} % vs. last quarter', n: Math.max(4, dashboardMetrics.interviewsBooked) }), tone: 'green' },
    { id: 'resonance', label: t('rebuild.recruiter.team_resonance', { defaultValue: 'Team resonance' }), value: `${clamp(74 + blueprintLibrary.length * 2, 74, 91)}%`, delta: t('rebuild.recruiter.vs_last_quarter', { defaultValue: '▲ {{n}} % vs. last quarter', n: Math.max(4, blueprintLibrary.length + 2) }), tone: 'blue' },
  ];

  const radarMetrics = [
    { label: getDimensionLabel('d9_systems_thinking', t), teamValue: 82, benchmarkValue: 90 },
    { label: getDimensionLabel('d6_ai_readiness', t), teamValue: 68, benchmarkValue: 84 },
    { label: getDimensionLabel('d7_cognitive_reflection', t), teamValue: 61, benchmarkValue: 80 },
    { label: getDimensionLabel('d2_social', t), teamValue: 73, benchmarkValue: 79 },
    { label: getDimensionLabel('d11_problem_decomposition', t), teamValue: 64, benchmarkValue: 81 },
    { label: getDimensionLabel('d4_energy', t), teamValue: 59, benchmarkValue: 76 },
  ];

  const activeRoles = seededRoles.map((role, index) => ({
    id: role.id,
    title: role.challenge || role.title,
    team: role.companyName || role.team,
    candidates: Math.max(3, candidateCountBase + index),
    status: roleStatuses[index % roleStatuses.length],
    accent: roleAccents[index % roleAccents.length],
  }));

  const resonance = [
    { id: 'cognitive_style', label: t('rebuild.recruiter.res_cognitive', { defaultValue: 'Cognitive style' }), value: 88 },
    { id: 'culture', label: t('rebuild.recruiter.res_culture', { defaultValue: 'Culture and values' }), value: 82 },
    { id: 'pace', label: t('rebuild.recruiter.res_pace', { defaultValue: 'Work pace' }), value: 79 },
    { id: 'communication', label: t('rebuild.recruiter.res_comm', { defaultValue: 'Communication style' }), value: 91 },
    { id: 'motivation', label: t('rebuild.recruiter.res_motivation', { defaultValue: 'Motivation' }), value: 84 },
  ];

  const topCandidates = (candidateInsights.length > 0 ? candidateInsights : [
    { id: 'candidate-a', candidateName: 'Marie Novotná', headline: 'Product Designer', matchPercent: 94, verifiedScore: 92, topSignals: [], recommendation: '', internalNote: '', skills: [] },
    { id: 'candidate-b', candidateName: 'Tomáš Bartoš', headline: 'AI/ML Engineer', matchPercent: 91, verifiedScore: 90, topSignals: [], recommendation: '', internalNote: '', skills: [] },
    { id: 'candidate-c', candidateName: 'Veronika Kováčová', headline: 'Process Architect', matchPercent: 87, verifiedScore: 85, topSignals: [], recommendation: '', internalNote: '', skills: [] },
    { id: 'candidate-d', candidateName: 'Jakub Dvořák', headline: 'Data Engineer', matchPercent: 85, verifiedScore: 83, topSignals: [], recommendation: '', internalNote: '', skills: [] },
  ]).slice(0, 4).map((candidate, index) => ({
    id: candidate.id,
    name: candidate.candidateName,
    role: candidate.headline,
    score: candidate.matchPercent,
    avatarSeed: String(index + 1),
  }));

  const pipeline = [
    { id: 'assigned', label: t('rebuild.recruiter.status_assigned', { defaultValue: 'Assigned' }), count: Math.max(24, roles.length * 8), color: '#7da0f6' },
    { id: 'sandbox', label: t('rebuild.recruiter.status_sandbox', { defaultValue: 'In sandbox' }), count: Math.max(12, roles.length * 5), color: '#94bdf5' },
    { id: 'handshake', label: t('rebuild.recruiter.status_handshake', { defaultValue: 'Handshake' }), count: Math.max(6, dashboardMetrics.submittedJourneys), color: '#ffd88d' },
    { id: 'hired', label: t('rebuild.recruiter.status_hired', { defaultValue: 'Hired' }), count: Math.max(2, dashboardMetrics.interviewsBooked), color: '#99d7b2' },
  ];

  const composition = [
    { id: 'visionaries', label: t('rebuild.recruiter.comp_visionaries', { defaultValue: 'Visionaries' }), value: 28, color: '#7da9f5' },
    { id: 'architects', label: t('rebuild.recruiter.comp_architects', { defaultValue: 'Architects' }), value: 25, color: '#88cfe0' },
    { id: 'realizers', label: t('rebuild.recruiter.comp_realizers', { defaultValue: 'Realizers' }), value: 22, color: '#9dd7b6' },
    { id: 'analysts', label: t('rebuild.recruiter.comp_analysts', { defaultValue: 'Analysts' }), value: 15, color: '#ffd88d' },
    { id: 'innovators', label: t('rebuild.recruiter.comp_innovators', { defaultValue: 'Innovators' }), value: 10, color: '#f0a0c2' },
  ];

  return {
    metrics,
    radarMetrics,
    activeRoles,
    resonance,
    topCandidates,
    pipeline,
    composition,
    tip: t('rebuild.recruiter.dashboard_tip', { defaultValue: 'You have the highest resonance in the communication style area. Consider strengthening strategic thinking in the product team.' }),
  };
};
