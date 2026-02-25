import { IkigaiSnapshotV1 } from '../types';

export const IKIGAI_V1_DRAFT_KEY = 'jobshaman_ikigai_v1_draft';

export const readIkigaiDraft = (): IkigaiSnapshotV1 | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(IKIGAI_V1_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IkigaiSnapshotV1;
    if (!parsed || parsed.schema_version !== 'ikigai-v1') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeIkigaiDraft = (snapshot: IkigaiSnapshotV1): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(IKIGAI_V1_DRAFT_KEY, JSON.stringify(snapshot));
  } catch {
    // no-op for storage limits/private mode
  }
};

export const clearIkigaiDraft = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(IKIGAI_V1_DRAFT_KEY);
  } catch {
    // no-op
  }
};
