import { Assessment } from '../types';

const PREVIEW_STORAGE_KEY = 'jobshaman_assessment_preview_payload';
const PREVIEW_RETURN_TO_KEY = 'jobshaman_assessment_preview_return_to';
const PREVIEW_MODE_KEY = 'jobshaman_assessment_preview_mode';
const SUPPORTED_LOCALES = ['cs', 'en', 'de', 'pl', 'sk', 'at'];

const resolveLocalePrefix = (): string => {
  try {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const maybe = parts[0]?.toLowerCase();
    if (maybe && SUPPORTED_LOCALES.includes(maybe)) {
      return `/${maybe}`;
    }
  } catch {
    // ignore and use root route
  }
  return '';
};

export const openAssessmentPreviewPage = (
  assessment: Assessment,
  options?: { forceMode?: 'game' | 'classic' }
) => {
  try {
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(assessment));
    const current = window.location.pathname + window.location.search + window.location.hash;
    const localePrefix = resolveLocalePrefix();
    const returnTo = /\/(company-dashboard|dashboard)(\/|$)/.test(current)
      ? `${localePrefix}/company-dashboard?tab=assessments`
      : current;
    sessionStorage.setItem(PREVIEW_RETURN_TO_KEY, returnTo);
    if (options?.forceMode) {
      sessionStorage.setItem(PREVIEW_MODE_KEY, options.forceMode);
    } else {
      sessionStorage.removeItem(PREVIEW_MODE_KEY);
    }
  } catch (error) {
    console.warn('Failed to persist assessment preview payload:', error);
  }
  window.location.assign(`${resolveLocalePrefix()}/assessment-preview`);
};

export const readAssessmentPreviewPayload = (): Assessment | null => {
  try {
    const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Assessment;
  } catch {
    return null;
  }
};

export const readAssessmentPreviewReturnTo = (): string | null => {
  try {
    return sessionStorage.getItem(PREVIEW_RETURN_TO_KEY);
  } catch {
    return null;
  }
};

export const readAssessmentPreviewMode = (): 'game' | 'classic' | null => {
  try {
    const raw = sessionStorage.getItem(PREVIEW_MODE_KEY);
    return raw === 'game' || raw === 'classic' ? raw : null;
  } catch {
    return null;
  }
};
