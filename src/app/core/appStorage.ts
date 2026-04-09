// LocalStorage persistence helpers for App state

export function loadFromStorage<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function saveToStorage(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded, ignore */ }
}

export function removeFromStorage(key: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(key);
    } catch { /* ignore */ }
}

// Apply followup
export const APPLY_FOLLOWUP_STORAGE_KEY = 'jobshaman_apply_followup';

export interface PendingApplyFollowup {
    jobId: number;
    title?: string;
    company?: string;
    url?: string;
    openedAt: string;
    sessionId?: string;
    requestId?: string;
    scoringVersion?: string;
    modelVersion?: string;
    snoozeUntil?: number;
}

export function loadPendingApplyFollowup(): PendingApplyFollowup | null {
    return loadFromStorage<PendingApplyFollowup | null>(APPLY_FOLLOWUP_STORAGE_KEY, null);
}

export function savePendingApplyFollowup(payload: PendingApplyFollowup | null): void {
    if (payload === null) {
        removeFromStorage(APPLY_FOLLOWUP_STORAGE_KEY);
    } else {
        saveToStorage(APPLY_FOLLOWUP_STORAGE_KEY, payload);
    }
}

// Email confirmation
export const EMAIL_CONFIRMATION_STORAGE_KEY = 'jobshaman_email_confirmation_pending';

export interface PendingEmailConfirmation {
    email?: string;
}

export function loadPendingEmailConfirmation(): PendingEmailConfirmation | null {
    return loadFromStorage<PendingEmailConfirmation | null>(EMAIL_CONFIRMATION_STORAGE_KEY, null);
}

export function clearPendingEmailConfirmation(): void {
    removeFromStorage(EMAIL_CONFIRMATION_STORAGE_KEY);
}

// Activation nudge
export function readActivationNudgeAt(userId: string, nudgeStep: string): number | null {
    if (!userId || typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(`jobshaman_activation_nudge_at:${userId}:${nudgeStep}`);
        return raw ? Number(raw) : null;
    } catch {
        return null;
    }
}

export function writeActivationNudgeAt(userId: string, nudgeStep: string, timestamp: number): void {
    if (!userId || typeof window === 'undefined') return;
    localStorage.setItem(`jobshaman_activation_nudge_at:${userId}:${nudgeStep}`, String(timestamp));
}

// Notification read IDs
export function readNotificationIdsKey(userId: string): string {
    return `careeros.notifications.read.${userId}`;
}

// Saved job ID normalization
export function normalizeSavedJobId(jobId: string): string {
    const raw = String(jobId || '').trim();
    if (!raw) return '';
    return raw.startsWith('db-') ? raw.substring(3) : raw;
}

export function getSavedJobIdAliases(jobId: string): string[] {
    const raw = String(jobId || '').trim();
    const normalized = normalizeSavedJobId(raw);
    return Array.from(new Set([raw, normalized, normalized ? `db-${normalized}` : ''].filter(Boolean)));
}
