import React from 'react';
import { Assessment, AssessmentMode } from '../types';
import AssessmentJourneyFlow from './AssessmentJourneyFlow';

interface Props {
  assessment: Assessment;
  invitationId: string;
  onComplete: (resultId: string) => void;
  mode?: 'taker' | 'preview';
  invitationToken?: string;
  submitViaBackend?: boolean;
  embedded?: boolean;
  assessmentMode?: AssessmentMode;
  modeSwitchCount?: number;
  modeSwitchTimestamps?: string[];
}

const AssessmentTaker: React.FC<Props> = ({
  assessment,
  invitationId,
  onComplete,
  mode = 'taker',
  invitationToken,
  submitViaBackend = false,
  embedded = false,
  assessmentMode = 'classic',
  modeSwitchCount = 0,
  modeSwitchTimestamps = [],
}) => (
  <AssessmentJourneyFlow
    assessment={assessment}
    invitationId={invitationId}
    onComplete={onComplete}
    mode={mode}
    invitationToken={invitationToken}
    submitViaBackend={submitViaBackend}
    embedded={embedded}
    assessmentMode={assessmentMode}
    modeSwitchCount={modeSwitchCount}
    modeSwitchTimestamps={modeSwitchTimestamps}
  />
);

export default AssessmentTaker;
