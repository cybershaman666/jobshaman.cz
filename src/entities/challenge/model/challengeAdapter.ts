import type { Job } from '../../../../types';

export type ChallengeSourceType = 'imported' | 'native' | 'micro';
export type ChallengeHandshakeMode = 'prepare' | 'direct' | 'rapid';

export interface ChallengeViewModel {
  id: string;
  title: string;
  company: string;
  sourceType: ChallengeSourceType;
  handshakeMode: ChallengeHandshakeMode;
  missionLine: string;
  firstStepPrompt: string;
  location: string;
  workModel: string;
  openDialoguesCount: number;
  reactionWindowHours: number | null;
}

export interface ChallengeCollectionSummary {
  totalChallenges: number;
  nativeCount: number;
  importedCount: number;
  microCount: number;
  remoteFriendlyCount: number;
  activeDialogueCount: number;
}

const stripMarkdown = (value: string | null | undefined): string =>
  String(value || '')
    .replace(/[#>*_`~[\]()!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shorten = (value: string | null | undefined, maxLength = 160): string => {
  const plain = stripMarkdown(value);
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 3).trim()}...`;
};

const isRemoteFriendly = (job: Job): boolean => {
  const model = String(job.work_model || job.type || '').toLowerCase();
  return model.includes('remote');
};

export const resolveChallengeSourceType = (job: Job): ChallengeSourceType => {
  if (job.challenge_format === 'micro_job') return 'micro';
  if (job.listingKind === 'imported') return 'imported';
  return 'native';
};

export const resolveChallengeHandshakeMode = (job: Job): ChallengeHandshakeMode => {
  const sourceType = resolveChallengeSourceType(job);
  if (sourceType === 'micro') return 'rapid';
  if (sourceType === 'imported') return 'prepare';
  return 'direct';
};

export const adaptJobToChallenge = (job: Job): ChallengeViewModel => ({
  id: job.id,
  title: job.title,
  company: job.company,
  sourceType: resolveChallengeSourceType(job),
  handshakeMode: resolveChallengeHandshakeMode(job),
  missionLine: shorten(job.challenge || job.companyGoal || job.description),
  firstStepPrompt: shorten(job.firstStepPrompt),
  location: String(job.location || '').trim() || 'Unknown location',
  workModel: String(job.work_model || job.type || '').trim() || 'Unknown setup',
  openDialoguesCount: Number(job.open_dialogues_count || 0),
  reactionWindowHours: Number.isFinite(Number(job.reaction_window_hours))
    ? Number(job.reaction_window_hours)
    : Number.isFinite(Number(job.reaction_window_days))
      ? Number(job.reaction_window_days) * 24
      : null,
});

export const createChallengeCollectionSummary = (
  jobs: Job[],
  totalChallenges?: number
): ChallengeCollectionSummary => {
  const summary = jobs.reduce<ChallengeCollectionSummary>((accumulator, job) => {
    const sourceType = resolveChallengeSourceType(job);
    if (sourceType === 'micro') accumulator.microCount += 1;
    else if (sourceType === 'imported') accumulator.importedCount += 1;
    else accumulator.nativeCount += 1;

    if (isRemoteFriendly(job)) accumulator.remoteFriendlyCount += 1;
    accumulator.activeDialogueCount += Number(job.open_dialogues_count || 0);
    return accumulator;
  }, {
    totalChallenges: Math.max(totalChallenges || 0, jobs.length),
    nativeCount: 0,
    importedCount: 0,
    microCount: 0,
    remoteFriendlyCount: 0,
    activeDialogueCount: 0,
  });

  summary.totalChallenges = Math.max(summary.totalChallenges, summary.nativeCount + summary.importedCount + summary.microCount);
  return summary;
};
