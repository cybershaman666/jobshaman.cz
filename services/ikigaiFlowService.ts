import { IkigaiSnapshotV1 } from '../types';
import { IKIGAI_PSYCH_ITEMS, scoreIkigaiPsychometrics } from './ikigaiPsychometrics';
import { buildIkigaiRecommendations, scoreIkigaiQuadrants } from './ikigaiScoringService';

export type IkigaiStep = 'love' | 'strength' | 'need' | 'reward' | 'psych' | 'synthesis';

export interface IkigaiDomainState {
  energy: number;
  clarity: number;
  sustainability: number;
  notes: string;
}

export interface IkigaiFlowState {
  love: IkigaiDomainState;
  strength: IkigaiDomainState;
  need: IkigaiDomainState;
  reward: IkigaiDomainState;
  psychAnswers: Record<string, number>;
}

export const canAdvanceIkigaiStep = (step: IkigaiStep, psychAnswers: Record<string, number>): boolean => {
  if (step !== 'psych') return true;
  return IKIGAI_PSYCH_ITEMS.every((item) => psychAnswers[item.id] != null);
};

export const buildIkigaiSnapshot = (step: IkigaiStep, state: IkigaiFlowState): IkigaiSnapshotV1 => {
  const psych = scoreIkigaiPsychometrics(state.psychAnswers);
  const scores = scoreIkigaiQuadrants({
    love: state.love,
    strength: state.strength,
    need: state.need,
    reward: state.reward,
  });
  return {
    schema_version: 'ikigai-v1',
    updated_at: new Date().toISOString(),
    progress_step: step,
    raw_answers: {
      love: state.love,
      strength: state.strength,
      need: state.need,
      reward: state.reward,
      psych_answers: state.psychAnswers,
    },
    psych_profile: psych,
    scores,
    recommended_paths: buildIkigaiRecommendations(scores),
  };
};
