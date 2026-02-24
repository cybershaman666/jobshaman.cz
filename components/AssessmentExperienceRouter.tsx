import React from 'react';
import { Assessment } from '../types';
import AssessmentTaker from './AssessmentTaker';

interface Props {
  assessment: Assessment;
  invitationId: string;
  onComplete: (resultId: string) => void;
  mode?: 'taker' | 'preview';
  invitationToken?: string;
  submitViaBackend?: boolean;
  embedded?: boolean;
}

const AssessmentExperienceRouter: React.FC<Props> = ({
  assessment,
  invitationId,
  onComplete,
  mode = 'taker',
  invitationToken,
  submitViaBackend = false,
  embedded = false,
}) => {
  return (
    <div className="relative h-full">
      <AssessmentTaker
        assessment={assessment}
        invitationId={invitationId}
        onComplete={onComplete}
        mode={mode}
        invitationToken={invitationToken}
        submitViaBackend={submitViaBackend}
        embedded={embedded}
        assessmentMode="classic"
        modeSwitchCount={0}
        modeSwitchTimestamps={[]}
      />
    </div>
  );
};

export default AssessmentExperienceRouter;
