import React from 'react';
import { Assessment, AssessmentMode } from '../types';
import { FEATURE_ASSESSMENT_COCKPIT_V2 } from '../constants';
import AssessmentTaker from './AssessmentTaker';

interface Props {
  assessment: Assessment;
  invitationId: string;
  onComplete: (resultId: string) => void;
  mode?: 'taker' | 'preview';
  invitationToken?: string;
  submitViaBackend?: boolean;
  embedded?: boolean;
  forceAssessmentMode?: AssessmentMode;
}

export const resolveAssessmentMode = (cockpitEnabled: boolean): 'game' | 'classic' =>
  cockpitEnabled ? 'game' : 'classic';

const AssessmentExperienceRouter: React.FC<Props> = ({
  assessment,
  invitationId,
  onComplete,
  mode = 'taker',
  invitationToken,
  submitViaBackend = false,
  embedded = false,
  forceAssessmentMode,
}) => {
  const derivedMode = forceAssessmentMode || resolveAssessmentMode(FEATURE_ASSESSMENT_COCKPIT_V2);
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
        assessmentMode={derivedMode}
        modeSwitchCount={0}
        modeSwitchTimestamps={[]}
      />
    </div>
  );
};

export default AssessmentExperienceRouter;
