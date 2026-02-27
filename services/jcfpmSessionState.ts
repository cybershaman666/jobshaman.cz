export interface JcfpmDraftState {
  stepIndex: number;
  responses: Record<string, any>;
  variantSeed?: string;
  updatedAt: string;
}

export const JCFPM_V1_DRAFT_KEY = 'jobshaman_jcfpm_v1_draft';

const draftKey = (userId?: string | null): string =>
  `${JCFPM_V1_DRAFT_KEY}_${userId || 'anon'}`;

export const readJcfpmDraft = (userId?: string | null): JcfpmDraftState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JcfpmDraftState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    // fall through to legacy session storage
  }
  try {
    const legacyRaw = window.sessionStorage.getItem(JCFPM_V1_DRAFT_KEY);
    if (!legacyRaw) return null;
    const parsed = JSON.parse(legacyRaw) as JcfpmDraftState;
    if (!parsed || typeof parsed !== 'object') return null;
    writeJcfpmDraft(parsed, userId);
    return parsed;
  } catch {
    return null;
  }
};

export const writeJcfpmDraft = (draft: JcfpmDraftState, userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // ignore
  }
};

export const clearJcfpmDraft = (userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftKey(userId));
    window.sessionStorage.removeItem(JCFPM_V1_DRAFT_KEY);
  } catch {
    // ignore
  }
};
