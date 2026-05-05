type TrackAnalyticsEventArgs = Parameters<typeof import('./supabaseService').trackAnalyticsEvent>[0];
type TrackPageViewArgs = Parameters<typeof import('./trafficAnalytics').trackPageView>[0];

let supabaseAnalyticsModulePromise: Promise<typeof import('./supabaseService')> | null = null;
let trafficAnalyticsModulePromise: Promise<typeof import('./trafficAnalytics')> | null = null;

const loadSupabaseAnalyticsModule = async () => {
  if (!supabaseAnalyticsModulePromise) {
    supabaseAnalyticsModulePromise = import('./supabaseService');
  }
  return supabaseAnalyticsModulePromise;
};

const loadTrafficAnalyticsModule = async () => {
  if (!trafficAnalyticsModulePromise) {
    trafficAnalyticsModulePromise = import('./trafficAnalytics');
  }
  return trafficAnalyticsModulePromise;
};

export const trackAnalyticsEventDeferred = async (event: TrackAnalyticsEventArgs): Promise<void> => {
  const { trackAnalyticsEvent } = await loadSupabaseAnalyticsModule();
  await trackAnalyticsEvent(event);
};

export const trackPageViewDeferred = async (data?: TrackPageViewArgs): Promise<void> => {
  const { trackPageView } = await loadTrafficAnalyticsModule();
  await trackPageView(data);
};
