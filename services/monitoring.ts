// Lightweight monitoring wrapper with optional Sentry integration.
// Dynamically imports Sentry only when a DSN is provided to avoid bundling it by default.

export const SENTRY_DSN = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SENTRY_DSN)
  || (typeof process !== 'undefined' && (process.env as any).REACT_APP_SENTRY_DSN)
  || '';

let _sentry: any = null;
let _initialized = false;

async function ensureSentry() {
  if (_initialized) return _sentry;
  if (!SENTRY_DSN) return null;

  try {
    const Sentry = await import('@sentry/browser');
    Sentry.init({ dsn: SENTRY_DSN });
    _sentry = Sentry;
    _initialized = true;
    return _sentry;
  } catch (e) {
    // If import fails (package not installed), fall back to console
    // eslint-disable-next-line no-console
    console.warn('Sentry not available or failed to load:', e);
    return null;
  }
}

export async function captureException(err: any, context?: any) {
  try {
    const Sentry = await ensureSentry();
    if (Sentry) {
      Sentry.withScope((scope: any) => {
        if (context) scope.setExtras(context);
        Sentry.captureException(err);
      });
    } else {
      // Fallback: log to console
      // eslint-disable-next-line no-console
      console.error('Captured exception (no Sentry):', err, context || '');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to capture exception:', e);
  }
}

export async function captureMessage(msg: string, context?: any) {
  try {
    const Sentry = await ensureSentry();
    if (Sentry) {
      Sentry.withScope((scope: any) => {
        if (context) scope.setExtras(context);
        Sentry.captureMessage(msg);
      });
    } else {
      // eslint-disable-next-line no-console
      console.log('Captured message (no Sentry):', msg, context || '');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to capture message:', e);
  }
}
