import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '../../cn';
import { primaryButtonClass, secondaryButtonClass, shellPageClass } from '../../ui/shellStyles';
import { CandidateAnswersPanel } from './readout/CandidateAnswersPanel';
import { AssessmentMetricsPanel } from './readout/AssessmentMetricsPanel';
import { MatchScoreCard } from './readout/MatchScoreCard';
import { ReviewerFeedbackForm } from './readout/ReviewerFeedbackForm';
import { useHandshakeReadout } from './hooks/useHandshakeReadout';

export interface RecruiterHandshakeViewProps {
  companyId: string;
  handshakeId: string;
  candidateName?: string;
  onNavigateBack: () => void;
  className?: string;
}

/**
 * Main recruiter view for handshake readout & decision
 * Dual-panel layout:
 * - Left: Candidate answers + metrics
 * - Right: Decision form
 */
export const RecruiterHandshakeView: React.FC<RecruiterHandshakeViewProps> = ({
  companyId,
  handshakeId,
  candidateName = 'Candidate',
  onNavigateBack,
  className,
}) => {
  const { t } = useTranslation();
  const { readout, isLoading, isDeciding, makeDecision } = useHandshakeReadout(companyId, handshakeId);

  if (isLoading) {
    return (
      <div className={cn(shellPageClass, 'flex items-center justify-center', className)}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-[#1f5fbf] mx-auto mb-3" />
          <div className="text-sm text-slate-600">
            {t('rebuild.recruiter.loading_readout', { defaultValue: 'Loading handshake...' })}
          </div>
        </div>
      </div>
    );
  }

  if (!readout) {
    return (
      <div className={cn(shellPageClass, 'flex items-center justify-center', className)}>
        <div className="text-center rounded-[12px] border border-slate-200 bg-white p-8 max-w-md">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            {t('rebuild.recruiter.not_found', { defaultValue: 'Handshake Not Found' })}
          </div>
          <p className="text-sm text-slate-600 mb-4">
            {t('rebuild.recruiter.try_again_later', { defaultValue: 'This handshake is no longer available.' })}
          </p>
          <button
            type="button"
            onClick={onNavigateBack}
            className={cn(primaryButtonClass)}
          >
            {t('rebuild.recruiter.go_back', { defaultValue: 'Go Back' })}
          </button>
        </div>
      </div>
    );
  }

  // Calculate fit assessment based on score
  const getFitAssessment = (score: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 55) return 'fair';
    return 'poor';
  };

  return (
    <div className={cn(shellPageClass, 'space-y-6', className)}>
      {/* Header */}
      <div className="rounded-[12px] border border-slate-200 bg-white px-6 py-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onNavigateBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-slate-200 text-slate-500 transition hover:border-[#1f5fbf] hover:text-[#1f5fbf]"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{readout.candidateName}</h1>
              {readout.candidateHeadline && (
                <p className="text-xs text-slate-600">{readout.candidateHeadline}</p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-[#dbeafe] text-[#1f5fbf]">
              {readout.status === 'in_progress'
                ? t('rebuild.recruiter.status_in_progress', { defaultValue: 'In Progress' })
                : readout.status === 'submitted'
                ? t('rebuild.recruiter.status_submitted', { defaultValue: 'Submitted' })
                : readout.status === 'company_reviewing'
                ? t('rebuild.recruiter.status_reviewing', { defaultValue: 'Reviewing' })
                : readout.status === 'mutual_handshake'
                ? t('rebuild.recruiter.status_mutual', { defaultValue: 'Mutual Handshake' })
                : readout.status}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Answers + Metrics */}
        <div className="space-y-6">
          {/* Match Score Card */}
          <MatchScoreCard
            score={readout.matchScore}
            fit={getFitAssessment(readout.matchScore)}
            benchmarks={[
              {
                label: t('rebuild.recruiter.clarity', { defaultValue: 'Clarity' }),
                value: '85/100',
              },
              {
                label: t('rebuild.recruiter.communication', { defaultValue: 'Communication' }),
                value: '78/100',
              },
            ]}
          />

          {/* Answers */}
          <div>
            <h2 className="text-sm font-bold uppercase text-slate-700 tracking-wide mb-3">
              {t('rebuild.recruiter.candidate_answers', { defaultValue: 'Candidate Answers' })}
            </h2>
            <CandidateAnswersPanel answers={readout.answers} />
          </div>

          {/* Assessment Metrics */}
          <div>
            <h2 className="text-sm font-bold uppercase text-slate-700 tracking-wide mb-3">
              {t('rebuild.recruiter.assessment_breakdown', { defaultValue: 'Assessment Breakdown' })}
            </h2>
            <AssessmentMetricsPanel
              metrics={[
                { label: t('rebuild.recruiter.clarity', { defaultValue: 'Clarity' }), value: 85 },
                { label: t('rebuild.recruiter.insight', { defaultValue: 'Insight' }), value: 78 },
                { label: t('rebuild.recruiter.practicality', { defaultValue: 'Practicality' }), value: 72 },
              ]}
              summary={t('rebuild.recruiter.metric_summary', {
                defaultValue: 'Candidate shows strong communication skills and clear problem-solving approach.',
              })}
            />
          </div>
        </div>

        {/* Right: Decision Panel */}
        <aside className="space-y-4">
          {/* Decision Form */}
          <div className="rounded-[12px] border border-slate-200 bg-white p-5 sticky top-24">
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              {t('rebuild.recruiter.your_decision', { defaultValue: 'Your Decision' })}
            </h3>
            <ReviewerFeedbackForm
              handshakeId={handshakeId}
              currentStatus={readout.status}
              isSubmitting={isDeciding}
              onDecide={makeDecision}
            />
          </div>

          {/* Quick Info */}
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-3">
            <div>
              <div className="font-semibold text-slate-700">
                {t('rebuild.recruiter.candidate_id', { defaultValue: 'Candidate ID' })}
              </div>
              <div className="font-mono text-xs mt-1 break-all">{handshakeId}</div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <div className="font-semibold text-slate-700">
                {t('rebuild.recruiter.last_updated', { defaultValue: 'Last Updated' })}
              </div>
              <div className="mt-1">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
