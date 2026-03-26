import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/browser';
import App from './App';
import './index.css';
import './styles/filter-components.css';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (SENTRY_ENABLED) {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error">
          <div className="app-error__panel">
            <h1 className="app-error__title">Something went wrong.</h1>
            <div className="app-error__details">
              <p className="app-error__message">{this.state.error?.message}</p>
              <pre className="app-error__stack">
                {this.state.error?.stack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="app-error__button"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const SENTRY_ENV = (import.meta.env.VITE_SENTRY_ENV as string | undefined) || import.meta.env.MODE;
const SENTRY_ENABLED = Boolean(SENTRY_DSN);
const CHUNK_RELOAD_GUARD_KEY = 'jobshaman:chunk-reload-once';
const IS_DEV = import.meta.env.DEV;
const SERVICE_WORKER_ENABLED = import.meta.env.VITE_ENABLE_SERVICE_WORKER === 'true';

const extractErrorMessage = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    const message = (reason as { message: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
};

const isDynamicImportFetchFailure = (reason: unknown): boolean => {
  const message = extractErrorMessage(reason).toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('importing a module script failed')
  );
};

const reloadForUpdatedAssets = () => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === '1') return;
  sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1');

  const refreshedUrl = new URL(window.location.href);
  refreshedUrl.searchParams.set('_chunk_reload', Date.now().toString());
  window.location.replace(refreshedUrl.toString());
};

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    tracesSampleRate: 0.1,
  });
}

try {
  if (typeof window !== 'undefined') {
    window.addEventListener('vite:preloadError', (event: Event) => {
      event.preventDefault();
      reloadForUpdatedAssets();
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      if (!isDynamicImportFetchFailure(event.reason)) return;
      event.preventDefault();
      reloadForUpdatedAssets();
    });

    window.addEventListener('error', (event: ErrorEvent) => {
      if (!isDynamicImportFetchFailure(event.error || event.message)) return;
      reloadForUpdatedAssets();
    });
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = createRoot(rootElement);
  const appTree = (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  root.render(
    IS_DEV ? appTree : <React.StrictMode>{appTree}</React.StrictMode>
  );

  if (!IS_DEV && SERVICE_WORKER_ENABLED && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  }

  // Clear reload guard after successful boot, so future deployments can recover once.
  if (typeof sessionStorage !== 'undefined') {
    window.setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY), 10000);
  }
} catch (e) {
  console.error("Mounting error:", e);
  document.body.innerHTML = `<div style="color:red; padding:20px;"><h1>Failed to mount app</h1><p>${e instanceof Error ? e.message : String(e)}</p></div>`;
}
