import { Assessment, CandidateBenchmarkMetrics, CompanyApplicationRow, Job } from '../../types';
import { CompanyActivityLogEntry } from '../../services/companyActivityService';

type TranslateFn = (key: string, options?: any) => string;

export interface QueueItem {
  id: string;
  title: string;
  detail: string;
  action: () => void;
  accent: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  title: string;
  detail: string;
}

export interface TodayActionItem {
  id: string;
  title: string;
  detail: string;
  label: string;
  actionLabel: string;
  action: () => void;
}

const formatDialogueStatusLabel = (t: TranslateFn, status: unknown): string => {
  const normalized = String(status || 'pending').trim().toLowerCase();
  switch (normalized) {
    case 'reviewed':
      return t('company.dashboard.status.approved', { defaultValue: 'Reviewed' });
    case 'shortlisted':
      return t('company.dashboard.status.shortlisted', { defaultValue: 'Shortlisted' });
    case 'rejected':
    case 'closed_rejected':
      return t('company.dashboard.status.refused', { defaultValue: 'Rejected' });
    case 'hired':
      return t('company.dashboard.status.hired', { defaultValue: 'Hired' });
    case 'withdrawn':
    case 'closed_withdrawn':
      return t('company.applications.status.withdrawn', { defaultValue: 'Withdrawn' });
    case 'closed_timeout':
    case 'timeout':
      return t('company.applications.status.timeout', { defaultValue: 'Closed by timeout' });
    case 'closed_role_filled':
      return t('company.applications.status.role_filled', { defaultValue: 'Role filled' });
    case 'closed':
      return t('company.applications.status.closed', { defaultValue: 'Closed' });
    default:
      return t('company.dashboard.status.pending', { defaultValue: 'Pending' });
  }
};

const formatRoleStatusLabel = (t: TranslateFn, status: unknown): string => {
  const normalized = String(status || 'active').trim().toLowerCase();
  switch (normalized) {
    case 'active':
      return t('company.dashboard.role_status.active', { defaultValue: 'Active' });
    case 'paused':
      return t('company.dashboard.role_status.paused', { defaultValue: 'Paused' });
    case 'closed':
      return t('company.dashboard.role_status.closed', { defaultValue: 'Closed' });
    case 'archived':
      return t('company.dashboard.role_status.archived', { defaultValue: 'Archived' });
    case 'draft':
      return t('company.dashboard.role_status.draft', { defaultValue: 'Draft' });
    case 'published_linked':
      return t('company.dashboard.role_status.published', { defaultValue: 'Published' });
    default:
      return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

export interface OverviewHeaderState {
  subscriptionLabel: string;
  isFreeLikeTier: boolean;
  recentApplications: CompanyApplicationRow[];
  candidateCoverageLabel: string;
}

export interface OverviewMetricsState {
  totalViews: number;
  totalApplicants: number;
  averageConversion: number;
  openApplications: CompanyApplicationRow[];
}

export const buildOverviewMetrics = ({
  applications: dialogues,
  jobStats
}: {
  applications: CompanyApplicationRow[];
  jobStats: Record<string, { views: number; applicants: number }>;
}): OverviewMetricsState => {
  const totalViews = Object.values(jobStats).reduce((acc, curr) => acc + curr.views, 0);
  const totalApplicants = Object.values(jobStats).reduce((acc, curr) => acc + curr.applicants, 0);
  const averageConversion = totalViews > 0 ? (totalApplicants / totalViews) * 100 : 0;
  const openApplications = dialogues.filter((dialogue) => ['pending', 'reviewed', 'shortlisted'].includes(String(dialogue.status || 'pending')));

  return {
    totalViews,
    totalApplicants,
    averageConversion,
    openApplications
  };
};

export const buildOverviewHeaderState = ({
  t,
  subscription,
  effectiveSubscriptionTier,
  applications: dialogues,
  candidateBenchmarks
}: {
  t: TranslateFn;
  subscription: any;
  effectiveSubscriptionTier?: string | null;
  applications: CompanyApplicationRow[];
  candidateBenchmarks: CandidateBenchmarkMetrics | null;
}): OverviewHeaderState => {
  const subscriptionTier = String(subscription?.tier || effectiveSubscriptionTier || 'free').toLowerCase();
  const isFreeLikeTier = subscriptionTier === 'free' || subscriptionTier === 'trial';
  const subscriptionLabel = subscription?.tierName
    || (subscriptionTier === 'professional' ? t('company.subscription.tiers.professional', { defaultValue: 'Professional' })
      : subscriptionTier === 'growth' ? t('company.subscription.tiers.growth', { defaultValue: 'Growth' })
        : subscriptionTier === 'starter' ? t('company.subscription.tiers.starter', { defaultValue: 'Starter' })
          : subscriptionTier === 'trial' ? t('company.subscription.tiers.trial', { defaultValue: 'Free (Trial)' })
            : t('company.subscription.tiers.free'));
  const recentApplications = dialogues.slice(0, 5);
  const candidateCoverageLabel = candidateBenchmarks?.assessment?.coverage
    ? `${candidateBenchmarks.assessment.coverage.assessed_candidates}/${candidateBenchmarks.assessment.coverage.total_candidates}`
    : t('company.workspace.cards.candidate_coverage_empty', { defaultValue: 'No completed assessments yet' });

  return {
    subscriptionLabel,
    isFreeLikeTier,
    recentApplications,
    candidateCoverageLabel
  };
};

export const buildRecruiterActionQueue = ({
  t,
  visibleJobs,
  jobStats,
  openApplications,
  selectedJobId,
  assessmentLibraryCount,
  onEditJob,
  onOpenApplicationQueue,
  onOpenApplicationDetail,
  onOpenAssessments,
  onOpenJobs
}: {
  t: TranslateFn;
  visibleJobs: Job[];
  jobStats: Record<string, { views: number; applicants: number }>;
  openApplications: CompanyApplicationRow[];
  selectedJobId: string;
  assessmentLibraryCount: number;
  onEditJob: (jobId: string) => void;
  onOpenApplicationQueue: (jobId: string) => void;
  onOpenApplicationDetail: (applicationId: string) => void;
  onOpenAssessments: () => void;
  onOpenJobs: () => void;
}): QueueItem[] => {
  const queue: QueueItem[] = [];

  const needsReviewJob = visibleJobs.find((job) => ['pending', 'review'].includes(String(job.legality_status || '')));
  if (needsReviewJob) {
    queue.push({
      id: `review-${needsReviewJob.id}`,
      title: t('company.workspace.queue.review_job_title', { defaultValue: 'Role waiting for review' }),
      detail: t('company.workspace.queue.review_job_detail', {
        defaultValue: '{{title}} still needs a compliance review before it can fully perform.',
        title: needsReviewJob.title
      }),
      action: () => onEditJob(needsReviewJob.id),
      accent: 'amber'
    });
  }

  const staleJob = visibleJobs.find((job) => {
    const stats = jobStats[job.id] || { views: 0, applicants: 0 };
    return stats.views > 25 && stats.applicants === 0;
  });
  if (staleJob) {
    queue.push({
      id: `stale-${staleJob.id}`,
      title: t('company.workspace.queue.low_conversion_title', { defaultValue: 'Low conversion role' }),
      detail: t('company.workspace.queue.low_conversion_detail', {
        defaultValue: '{{title}} is getting views but no dialogues are opening. Tighten the role truth, clarity, or handshake path.',
        title: staleJob.title
      }),
      action: () => onEditJob(staleJob.id),
      accent: 'rose'
    });
  }

  const urgentApplication = openApplications[0];
  if (urgentApplication) {
    queue.push({
      id: `application-${urgentApplication.id}`,
      title: t('company.workspace.queue.application_title', { defaultValue: 'Dialogue waiting for recruiter action' }),
      detail: t('company.workspace.queue.application_detail', {
        defaultValue: '{{candidate}} opened a handshake for {{job}} and is waiting for the next recruiter step.',
        candidate: urgentApplication.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }),
        job: urgentApplication.job_title || t('company.dashboard.table.position')
      }),
      action: () => {
        onOpenApplicationQueue(String(urgentApplication.job_id || selectedJobId));
        onOpenApplicationDetail(urgentApplication.id);
      },
      accent: 'cyan'
    });
  }

  if (assessmentLibraryCount === 0) {
    queue.push({
      id: 'assessment-library-empty',
      title: t('company.workspace.queue.assessment_title', { defaultValue: 'Assessment library is empty' }),
      detail: t('company.workspace.queue.assessment_detail', {
        defaultValue: 'Create or save at least one reusable assessment so recruiters can extend a dialogue without losing momentum.'
      }),
      action: onOpenAssessments,
      accent: 'emerald'
    });
  }

  if (queue.length === 0) {
    queue.push({
      id: 'queue-clear',
      title: t('company.workspace.queue.clear_title', { defaultValue: 'No urgent blockers' }),
      detail: t('company.workspace.queue.clear_detail', {
        defaultValue: 'The core hiring workflow is clear right now. Use the workspace below for active monitoring.'
      }),
      action: onOpenJobs,
      accent: 'slate'
    });
  }

  return queue.slice(0, 4);
};

export const buildWorkspaceActivity = ({
  t,
  visibleJobs,
  applications: dialogues,
  assessmentLibrary,
  assessmentInvitations,
  assessmentResultsAudit,
  companyActivityLog
}: {
  t: TranslateFn;
  visibleJobs: Job[];
  applications: CompanyApplicationRow[];
  assessmentLibrary: Assessment[];
  assessmentInvitations: any[];
  assessmentResultsAudit: any[];
  companyActivityLog: CompanyActivityLogEntry[];
}): ActivityItem[] => {
  const items: ActivityItem[] = [];

  visibleJobs.forEach((job) => {
    const createdAt = String((job as any).created_at || job.postedAt || job.scrapedAt || '').trim();
    if (!createdAt) return;
    items.push({
      id: `job-${job.id}`,
      at: createdAt,
      title: t('company.workspace.timeline.job_created', { defaultValue: 'Role published' }),
      detail: `${job.title} • ${job.location}`
    });
  });

  dialogues.forEach((dialogue) => {
    const submittedAt = String(dialogue.submitted_at || dialogue.created_at || '').trim();
    if (!submittedAt) return;
    items.push({
      id: `application-${dialogue.id}`,
      at: submittedAt,
      title: t('company.workspace.timeline.application_received', { defaultValue: 'Handshake opened' }),
      detail: `${dialogue.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' })} • ${dialogue.job_title || t('company.dashboard.table.position')}`
    });
  });

  if (companyActivityLog.length === 0) {
    assessmentLibrary.forEach((assessment) => {
      const createdAt = String(assessment.createdAt || '').trim();
      if (!createdAt) return;
      items.push({
        id: `assessment-${assessment.id}`,
        at: createdAt,
        title: t('company.workspace.timeline.assessment_saved', { defaultValue: 'Assessment saved' }),
        detail: `${assessment.title} • ${assessment.role}`
      });
    });

    assessmentInvitations.forEach((invitation) => {
      const createdAt = String(invitation?.created_at || '').trim();
      if (!createdAt) return;
      const metadata = invitation?.metadata && typeof invitation.metadata === 'object' ? invitation.metadata : null;
      items.push({
        id: `assessment-invitation-${invitation.id}`,
        at: createdAt,
        title: t('company.workspace.timeline.assessment_invited', { defaultValue: 'Assessment invitation sent' }),
        detail: `${String(metadata?.candidate_name || invitation?.candidate_email || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }))} • ${String(metadata?.job_title || t('company.dashboard.table.position'))}`
      });
    });
  }

  assessmentResultsAudit.forEach((result) => {
    const completedAt = String(result?.completed_at || '').trim();
    if (!completedAt) return;
    items.push({
      id: `assessment-completed-${result.id}`,
      at: completedAt,
      title: t('company.workspace.timeline.assessment_completed', { defaultValue: 'Assessment completed' }),
      detail: `${String(result?.role || t('company.assessment_library.selected_role', { defaultValue: 'Selected role' }))} • ${String(result?.assessment_id || '').slice(0, 8)}`
    });
  });

  companyActivityLog.forEach((event) => {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
    let title = '';
    let detail = '';

    switch (event.event_type) {
      case 'application_status_changed':
        {
          const statusLabel = String(
            payload.close_reason_label || formatDialogueStatusLabel(t, payload.status)
          ).trim() || formatDialogueStatusLabel(t, payload.status);
        title = t('company.workspace.timeline.application_status_changed', {
          defaultValue: 'Dialogue moved to {{status}}',
            status: statusLabel
        });
        detail = `${String(payload.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }))} • ${String(payload.job_title || t('company.dashboard.table.position'))}`;
        break;
        }
      case 'job_closed':
        {
          const nextStatusLabel = String(
            payload.role_status_label
            || payload.next_status_label
            || formatRoleStatusLabel(t, payload.role_status || payload.next_status || 'closed')
          );
          const previousStatusLabel = String(
            payload.previous_status_label
            || formatRoleStatusLabel(t, payload.previous_status || 'active')
          );
        title = t('company.workspace.timeline.job_closed', {
          defaultValue: 'Role moved to {{status}}',
            status: nextStatusLabel
        });
          detail = `${String(payload.job_title || t('company.dashboard.table.position'))} • ${previousStatusLabel} -> ${nextStatusLabel}`;
        break;
        }
      case 'job_reopened':
        {
          const nextStatusLabel = String(
            payload.role_status_label
            || payload.next_status_label
            || formatRoleStatusLabel(t, payload.role_status || payload.next_status || 'active')
          );
          const previousStatusLabel = String(
            payload.previous_status_label
            || formatRoleStatusLabel(t, payload.previous_status || 'closed')
          );
        title = t('company.workspace.timeline.job_reopened', {
          defaultValue: 'Role moved to {{status}}',
            status: nextStatusLabel
        });
          detail = `${String(payload.job_title || t('company.dashboard.table.position'))} • ${previousStatusLabel} -> ${nextStatusLabel}`;
        break;
        }
      case 'job_paused':
        {
          const nextStatusLabel = String(
            payload.role_status_label
            || payload.next_status_label
            || formatRoleStatusLabel(t, payload.role_status || payload.next_status || 'paused')
          );
          const previousStatusLabel = String(
            payload.previous_status_label
            || formatRoleStatusLabel(t, payload.previous_status || 'active')
          );
        title = t('company.workspace.timeline.job_paused', {
          defaultValue: 'Role moved to {{status}}',
            status: nextStatusLabel
        });
          detail = `${String(payload.job_title || t('company.dashboard.table.position'))} • ${previousStatusLabel} -> ${nextStatusLabel}`;
        break;
        }
      case 'job_archived':
        {
          const nextStatusLabel = String(
            payload.role_status_label
            || payload.next_status_label
            || formatRoleStatusLabel(t, payload.role_status || payload.next_status || 'archived')
          );
          const previousStatusLabel = String(
            payload.previous_status_label
            || formatRoleStatusLabel(t, payload.previous_status || 'closed')
          );
        title = t('company.workspace.timeline.job_archived', {
          defaultValue: 'Role moved to {{status}}',
            status: nextStatusLabel
        });
          detail = `${String(payload.job_title || t('company.dashboard.table.position'))} • ${previousStatusLabel} -> ${nextStatusLabel}`;
        break;
        }
      case 'job_published':
        title = t('company.workspace.timeline.job_published', {
          defaultValue: 'Role is now {{status}}',
          status: String(
            payload.role_status_label
            || payload.next_status_label
            || formatRoleStatusLabel(t, payload.role_status || payload.next_status || 'active')
          )
        });
        detail = String(payload.job_title || t('company.dashboard.table.position'));
        break;
      case 'job_updated':
        title = t('company.workspace.timeline.job_updated', { defaultValue: 'Role updated' });
        detail = `${String(payload.job_title || t('company.dashboard.table.position'))}${payload.role_status_label ? ` • ${String(payload.role_status_label)}` : ''}`;
        break;
      case 'assessment_invited':
        title = String(
          payload.action_label
          || t('company.workspace.timeline.assessment_invited', { defaultValue: 'Assessment invitation sent' })
        );
        detail = `${String(payload.candidate_name || payload.candidate_email || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }))} • ${String(payload.job_title || t('company.dashboard.table.position'))}`;
        break;
      case 'assessment_saved':
        title = String(
          payload.action_label
          || t('company.workspace.timeline.assessment_saved', { defaultValue: 'Assessment saved' })
        );
        detail = `${String(payload.assessment_title || t('company.assessment_library.title', { defaultValue: 'Assessment' }))} • ${String(payload.job_title || '')}`.replace(/ • $/, '');
        break;
      case 'assessment_duplicated':
        title = String(
          payload.action_label
          || t('company.workspace.timeline.assessment_duplicated', { defaultValue: 'Assessment duplicated' })
        );
        detail = String(payload.assessment_title || t('company.assessment_library.title', { defaultValue: 'Assessment' }));
        break;
      case 'assessment_archived':
        title = String(
          payload.action_label
          || t('company.workspace.timeline.assessment_archived', { defaultValue: 'Assessment archived' })
        );
        detail = String(payload.assessment_title || t('company.assessment_library.title', { defaultValue: 'Assessment' }));
        break;
      case 'application_message_from_candidate':
        title = String(
          payload.direction_label
          || payload.action_label
          || t('company.workspace.timeline.application_message_from_candidate', { defaultValue: 'Candidate replied' })
        );
        detail = payload.has_attachments
          ? t('company.workspace.timeline.application_message_attachment', { defaultValue: 'Dialogue thread updated • Attachment included' })
          : t('company.workspace.timeline.application_message_plain', { defaultValue: 'Dialogue thread updated' });
        break;
      case 'application_message_from_company':
        title = String(
          payload.direction_label
          || payload.action_label
          || t('company.workspace.timeline.application_message_from_company', { defaultValue: 'Company replied' })
        );
        detail = payload.has_attachments
          ? t('company.workspace.timeline.application_message_attachment', { defaultValue: 'Dialogue thread updated • Attachment included' })
          : t('company.workspace.timeline.application_message_plain', { defaultValue: 'Dialogue thread updated' });
        break;
      default:
        title = String(
          payload.action_label
          || t('company.workspace.timeline.activity_logged', { defaultValue: 'Recruiter activity logged' })
        );
        detail = String(payload.detail || payload.job_title || t('company.workspace.timeline.empty', { defaultValue: 'Activity logged' }));
        break;
    }

    items.push({
      id: event.id,
      at: String(event.created_at || '').trim(),
      title,
      detail
    });
  });

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);
};

export const buildTodayActionPlan = ({
  t,
  applications: dialogues,
  assessmentLibraryCount,
  candidateBenchmarks,
  jobs,
  visibleJobs,
  jobStats,
  workspaceActivity,
  onOpenJobs,
  onOpenApplications,
  onOpenApplicationDetail,
  onOpenAssessments,
  onOpenCandidates,
  onEditJob,
  onSelectPausedJob
}: {
  t: TranslateFn;
  applications: CompanyApplicationRow[];
  assessmentLibraryCount: number;
  candidateBenchmarks: CandidateBenchmarkMetrics | null;
  jobs: Job[];
  visibleJobs: Job[];
  jobStats: Record<string, { views: number; applicants: number }>;
  workspaceActivity: ActivityItem[];
  onOpenJobs: () => void;
  onOpenApplications: () => void;
  onOpenApplicationDetail: (applicationId: string) => void;
  onOpenAssessments: () => void;
  onOpenCandidates: () => void;
  onEditJob: (jobId: string) => void;
  onSelectPausedJob: (jobId: string) => void;
}): TodayActionItem[] => {
  const items: TodayActionItem[] = [];
  const pendingApplications = dialogues.filter((dialogue) => String(dialogue.status || 'pending') === 'pending');
  const shortlistedApplications = dialogues.filter((dialogue) => String(dialogue.status || 'pending') === 'shortlisted');
  const staleJob = visibleJobs.find((job) => {
    const stats = jobStats[job.id] || { views: 0, applicants: 0 };
    return stats.views >= 25 && stats.applicants === 0;
  });
  const pausedJob = jobs.find((job) => String((job as any).status || 'active') === 'paused');
  const coverage = candidateBenchmarks?.assessment?.coverage;
  const uncoveredCandidates = coverage
    ? Math.max(0, Number(coverage.total_candidates || 0) - Number(coverage.assessed_candidates || 0))
    : 0;
  const latestActivity = workspaceActivity[0];

  if (visibleJobs.length === 0) {
    items.push({
      id: 'launch-first-role',
      title: t('company.workspace.today.first_role_title', { defaultValue: 'Launch the first live role' }),
      detail: t('company.workspace.today.first_role_detail', { defaultValue: 'The dashboard becomes fully operational after the first role is published from the structured editor.' }),
      label: t('company.workspace.today.now', { defaultValue: 'Now' }),
      actionLabel: t('company.workspace.today.open_editor', { defaultValue: 'Open editor' }),
      action: onOpenJobs
    });
  }

  if (pendingApplications.length > 0) {
    const nextPending = pendingApplications[0];
    items.push({
      id: 'review-pending-applications',
      title: t('company.workspace.today.pending_title', {
        defaultValue: 'Review {{count}} fresh dialogues',
        count: pendingApplications.length
      }),
      detail: t('company.workspace.today.pending_detail', {
        defaultValue: 'Start with {{candidate}} for {{job}} and move the dialogue forward before it stalls.',
        candidate: nextPending.candidate_name || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }),
        job: nextPending.job_title || t('company.dashboard.table.position')
      }),
      label: t('company.workspace.today.today', { defaultValue: 'Today' }),
      actionLabel: t('company.workspace.today.open_queue', { defaultValue: 'Open queue' }),
      action: () => {
        onOpenApplications();
        onOpenApplicationDetail(nextPending.id);
      }
    });
  }

  if (shortlistedApplications.length > 0) {
    items.push({
      id: 'shortlist-next-step',
      title: assessmentLibraryCount > 0
        ? t('company.workspace.today.shortlist_title', {
          defaultValue: 'Advance {{count}} shortlisted candidates',
          count: shortlistedApplications.length
        })
        : t('company.workspace.today.shortlist_setup_title', { defaultValue: 'Prepare assessment flow for shortlisted candidates' }),
      detail: assessmentLibraryCount > 0
        ? t('company.workspace.today.shortlist_detail', { defaultValue: 'Invite shortlisted candidates into your saved assessment workflow while momentum is high.' })
        : t('company.workspace.today.shortlist_setup_detail', { defaultValue: 'Create at least one reusable assessment before the next shortlisted dialogue reaches interview stage.' }),
      label: t('company.workspace.today.next', { defaultValue: 'Next' }),
      actionLabel: assessmentLibraryCount > 0
        ? t('company.workspace.today.open_assessments', { defaultValue: 'Open assessments' })
        : t('company.workspace.today.create_assessment', { defaultValue: 'Create assessment' }),
      action: onOpenAssessments
    });
  }

  if (staleJob) {
    items.push({
      id: 'repair-low-conversion-role',
      title: t('company.workspace.today.conversion_title', { defaultValue: 'Repair a low-conversion role' }),
      detail: t('company.workspace.today.conversion_detail', {
        defaultValue: '{{title}} is visible but not opening dialogues. Tighten the role truth, salary clarity, or handshake path.',
        title: staleJob.title
      }),
      label: t('company.workspace.today.this_week', { defaultValue: 'This week' }),
      actionLabel: t('company.workspace.today.edit_role', { defaultValue: 'Edit role' }),
      action: () => onEditJob(staleJob.id)
    });
  }

  if (pausedJob) {
    items.push({
      id: 'resume-paused-role',
      title: t('company.workspace.today.paused_title', { defaultValue: 'Decide what to do with a paused role' }),
      detail: t('company.workspace.today.paused_detail', {
        defaultValue: '{{title}} is paused. Either reopen it or archive it so the pipeline stays clean.',
        title: pausedJob.title
      }),
      label: t('company.workspace.today.follow_up', { defaultValue: 'Follow up' }),
      actionLabel: t('company.workspace.today.open_jobs', { defaultValue: 'Open jobs' }),
      action: () => onSelectPausedJob(String(pausedJob.id))
    });
  }

  if (uncoveredCandidates > 0) {
    items.push({
      id: 'expand-assessment-coverage',
      title: t('company.workspace.today.coverage_title', { defaultValue: 'Increase assessment coverage' }),
      detail: t('company.workspace.today.coverage_detail', {
        defaultValue: '{{count}} candidates still have no linked assessment result, which limits deeper signal after the first dialogue.',
        count: uncoveredCandidates
      }),
      label: t('company.workspace.today.next', { defaultValue: 'Next' }),
      actionLabel: t('company.workspace.today.open_candidates', { defaultValue: 'Open candidates' }),
      action: onOpenCandidates
    });
  }

  if (latestActivity) {
    items.push({
      id: 'follow-latest-activity',
      title: t('company.workspace.today.latest_title', { defaultValue: 'Follow the latest recruiter activity' }),
      detail: `${latestActivity.title} • ${latestActivity.detail}`,
      label: t('company.workspace.today.latest', { defaultValue: 'Latest' }),
      actionLabel: latestActivity.id.startsWith('application-')
        ? t('company.workspace.today.open_queue', { defaultValue: 'Open queue' })
        : latestActivity.id.startsWith('assessment-')
          ? t('company.workspace.today.open_assessments', { defaultValue: 'Open assessments' })
          : t('company.workspace.today.open_jobs', { defaultValue: 'Open jobs' }),
      action: () => {
        if (latestActivity.id.startsWith('application-')) {
          onOpenApplications();
          return;
        }
        if (latestActivity.id.startsWith('assessment-')) {
          onOpenAssessments();
          return;
        }
        onOpenJobs();
      }
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'steady-state',
      title: t('company.workspace.today.clear_title', { defaultValue: 'No immediate action required' }),
      detail: t('company.workspace.today.clear_detail', { defaultValue: 'The hiring flow is stable right now. Stay in overview for monitoring, then move into a focused workspace only when something changes.' }),
      label: t('company.workspace.today.steady', { defaultValue: 'Steady' }),
      actionLabel: t('company.workspace.today.monitor', { defaultValue: 'Monitor jobs' }),
      action: onOpenJobs
    });
  }

  return items.slice(0, 4);
};
