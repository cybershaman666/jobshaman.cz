import { trackAnalyticsEvent } from './supabaseService';
import { getCookiePreferences } from './cookieConsentService';

const VISITOR_ID_KEY = 'js_analytics_visitor_id';
const SESSION_ID_KEY = 'js_analytics_session_id';
const SESSION_TS_KEY = 'js_analytics_session_last';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const canTrackAnalytics = (): boolean => {
  try {
    const prefs = getCookiePreferences();
    return Boolean(prefs?.analytics);
  } catch {
    return false;
  }
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

const getOrCreateVisitorId = (): string => {
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;
  const newId = generateId();
  localStorage.setItem(VISITOR_ID_KEY, newId);
  return newId;
};

const getOrCreateSession = (): { sessionId: string; isNew: boolean } => {
  const now = Date.now();
  const lastSeen = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
  const existingId = localStorage.getItem(SESSION_ID_KEY);
  const expired = !lastSeen || now - lastSeen > SESSION_TIMEOUT_MS;
  const isNew = !existingId || expired;
  const sessionId = isNew ? generateId() : existingId as string;

  localStorage.setItem(SESSION_ID_KEY, sessionId);
  localStorage.setItem(SESSION_TS_KEY, String(now));

  return { sessionId, isNew };
};

const getUtmParams = (): Record<string, string> => {
  const params = new URLSearchParams(window.location.search || '');
  const utm: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(key => {
    const value = params.get(key);
    if (value) utm[key] = value;
  });
  return utm;
};

const getReferrerDomain = (referrer: string, hostname: string): string => {
  if (!referrer) return '(direct)';
  try {
    const refUrl = new URL(referrer);
    if (!refUrl.hostname || refUrl.hostname === hostname) return '(direct)';
    return refUrl.hostname;
  } catch {
    return '(direct)';
  }
};

export const trackPageView = async (data?: {
  path?: string;
  title?: string;
  viewState?: string;
  jobId?: string | null;
  blogSlug?: string | null;
  locale?: string;
  companyId?: string | null;
}): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (!canTrackAnalytics()) return;

  try {
    const { sessionId } = getOrCreateSession();
    const visitorId = getOrCreateVisitorId();
    const url = new URL(window.location.href);
    const referrer = document.referrer || '';

    const metadata = {
      path: data?.path || url.pathname,
      title: data?.title || document.title,
      view_state: data?.viewState || null,
      job_id: data?.jobId || null,
      blog_slug: data?.blogSlug || null,
      locale: data?.locale || null,
      referrer: referrer || null,
      referrer_domain: getReferrerDomain(referrer, url.hostname),
      session_id: sessionId,
      visitor_id: visitorId,
      host: url.hostname,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      ...getUtmParams()
    };

    await trackAnalyticsEvent({
      event_type: 'page_view',
      company_id: data?.companyId || undefined,
      metadata
    });
  } catch (error) {
    console.warn('Page view tracking failed:', error);
  }
};
