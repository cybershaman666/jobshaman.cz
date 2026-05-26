import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Clock } from 'lucide-react';
import { cn } from '../../../cn';
import { primaryButtonClass, secondaryButtonClass, textareaClass } from '../../../ui/shellStyles';

export interface ReviewerFeedbackFormProps {
  handshakeId: string;
  currentStatus: string;
  feedbackNote?: string;
  isSubmitting?: boolean;
  onDecide: (action: 'invite' | 'reject' | 'close', note: string) => Promise<void>;
  className?: string;
}

/**
 * Recruiter feedback form for handshake decision
 * Actions: Invite to next round, Reject, Close
 */
export const ReviewerFeedbackForm: React.FC<ReviewerFeedbackFormProps> = ({
  handshakeId,
  currentStatus,
  feedbackNote = '',
  isSubmitting = false,
  onDecide,
  className,
}) => {
  const { t } = useTranslation();
  const [note, setNote] = React.useState(feedbackNote);
  const [selectedAction, setSelectedAction] = React.useState<'invite' | 'reject' | 'close' | null>(null);

  const handleSubmit = async (action: 'invite' | 'reject' | 'close') => {
    try {
      await onDecide(action, note);
      setSelectedAction(null);
      setNote('');
    } catch (error) {
      console.error('Failed to submit decision', error);
    }
  };

  const isDecisionLocked = ['completed', 'rejected', 'closed', 'withdrawn'].includes(currentStatus);

  return (
    <div className={cn('space-y-4', className)}>
      {isDecisionLocked ? (
        <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          {t('rebuild.recruiter.decision_locked', { defaultValue: 'This handshake decision is locked.' })}
        </div>
      ) : (
        <>
          {/* Feedback Note */}
          <div>
            <label className="text-sm font-semibold text-slate-700">
              {t('rebuild.recruiter.feedback_note', { defaultValue: 'Feedback Note' })}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('rebuild.recruiter.feedback_placeholder', {
                defaultValue: 'Add any feedback for the candidate or internal notes for your team.',
              })}
              rows={4}
              maxLength={2000}
              className={cn(textareaClass, 'mt-2')}
            />
            <div className="mt-1 text-xs text-slate-500 text-right">
              {note.length} / 2000
            </div>
          </div>

          {/* Decision Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSubmit('invite')}
              disabled={isSubmitting}
              className={cn(primaryButtonClass, 'w-full inline-flex gap-2 justify-center')}
            >
              <Check size={18} />
              {t('rebuild.recruiter.invite_to_next', { defaultValue: 'Invite to Next Round' })}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit('reject')}
              disabled={isSubmitting}
              className={cn(
                'w-full inline-flex gap-2 justify-center rounded-[8px] border border-red-300 bg-red-50 px-4 py-2.5 font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              <X size={18} />
              {t('rebuild.recruiter.reject', { defaultValue: 'Reject' })}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit('close')}
              disabled={isSubmitting}
              className={cn(secondaryButtonClass, 'w-full inline-flex gap-2 justify-center')}
            >
              <Clock size={18} />
              {t('rebuild.recruiter.close_for_now', { defaultValue: 'Close for Now' })}
            </button>
          </div>

          {/* Help text */}
          <div className="rounded-[12px] bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-2">
            <div className="font-medium text-slate-700">
              {t('rebuild.recruiter.decision_help', { defaultValue: 'Decision Guidelines' })}
            </div>
            <ul className="space-y-1 text-slate-600">
              <li>• <strong>{t('rebuild.recruiter.invite', { defaultValue: 'Invite' })}:</strong> {t('rebuild.recruiter.invite_desc', { defaultValue: 'Ready for next round or conversation' })}</li>
              <li>• <strong>{t('rebuild.recruiter.reject', { defaultValue: 'Reject' })}:</strong> {t('rebuild.recruiter.reject_desc', { defaultValue: 'Not a fit for this role' })}</li>
              <li>• <strong>{t('rebuild.recruiter.close', { defaultValue: 'Close' })}:</strong> {t('rebuild.recruiter.close_desc', { defaultValue: 'Need more time or info before deciding' })}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
