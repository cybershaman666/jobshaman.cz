export interface JcfpmDraftState {
  stepIndex: number;
  responses: Record<string, number>;
  updatedAt: string;
}

export const JCFPM_V1_DRAFT_KEY = 'jobshaman_jcfpm_v1_draft';

export const readJcfpmDraft = (): JcfpmDraftState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(JCFPM_V1_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JcfpmDraftState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeJcfpmDraft = (draft: JcfpmDraftState): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(JCFPM_V1_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
};

export const clearJcfpmDraft = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(JCFPM_V1_DRAFT_KEY);
  } catch {
    // ignore
  }
};
