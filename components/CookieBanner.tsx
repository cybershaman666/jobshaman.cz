import React, { useEffect, useState } from 'react';
import { BarChart3, ChevronUp, Cookie, Info, Settings2, Shield, SlidersHorizontal, Target, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, cn } from './ui/primitives';

interface CookieBannerProps {
  onAccept?: (preferences: CookiePreferences) => void;
  onCustomize?: () => void;
}

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  preferences: boolean;
}

const CookieBanner: React.FC<CookieBannerProps> = ({
  onAccept,
  onCustomize,
}) => {
  const { t, i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    marketing: false,
    functional: false,
    preferences: false,
  });

  useEffect(() => {
    const hasConsent = localStorage.getItem('cookie-consent');
    const hasVisitedBefore = sessionStorage.getItem('cookie-banner-shown');

    if (!hasConsent && !hasVisitedBefore) {
      setIsVisible(true);
      sessionStorage.setItem('cookie-banner-shown', 'true');
    }
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(prefs));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());

    if ((window as any).gtag && prefs.analytics) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'granted',
        security_storage: 'granted',
      });
    }
  };

  const closeWithPreferences = (prefs: CookiePreferences) => {
    setPreferences(prefs);
    saveConsent(prefs);
    onAccept?.(prefs);
    setIsVisible(false);
  };

  const handleAcceptAll = () => {
    closeWithPreferences({
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
      preferences: true,
    });
  };

  const handleAcceptNecessary = () => {
    closeWithPreferences({
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
      preferences: false,
    });
  };

  const handleSavePreferences = () => {
    closeWithPreferences(preferences);
  };

  if (!isVisible) return null;

  if (isMinimized) {
    return (
      <div className="app-surface app-frost-panel fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-[var(--radius-panel)] border p-3 shadow-[var(--shadow-overlay)]">
        <Cookie className="h-4 w-4 flex-shrink-0 text-[var(--accent-gold)]" />
        <span className="text-sm font-medium text-[var(--text-strong)]">
          {t('cookie_banner.minimized.title')}
        </span>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
          title={t('cookie_banner.minimized.expand_title')}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="app-modal-backdrop bottom-0 left-0 right-0 top-auto z-50 items-end justify-center px-4 pb-4 pt-0">
      <div className="app-modal-panel mx-auto mt-auto max-w-7xl rounded-[var(--radius-hero)] border">
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[rgba(var(--accent-gold-rgb),0.2)] bg-[rgba(var(--accent-gold-rgb),0.14)] text-[var(--accent-gold)]">
                <Cookie className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                    {t('cookie_banner.header.title')}
                  </h3>
                  <span className="app-modal-kicker">
                    {t('cookie_banner.header.gdpr_badge')}
                  </span>
                </div>

                <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                  {t('cookie_banner.header.description')}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="hero" onClick={handleAcceptAll}>
                    <Shield className="h-4 w-4" />
                    {t('cookie_banner.actions.accept_all')}
                  </Button>
                  <Button variant="quiet" onClick={handleAcceptNecessary}>
                    {t('cookie_banner.actions.necessary_only')}
                  </Button>
                  <Button
                    variant="spotlight"
                    onClick={() => {
                      setShowDetails((current) => !current);
                      onCustomize?.();
                    }}
                  >
                    <Info className="h-4 w-4" />
                    {t('cookie_banner.actions.customize')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-start justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] lg:hidden"
                title={t('cookie_banner.actions.minimize')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showDetails ? (
            <div className="mt-6 grid gap-6 border-t border-[var(--border-soft)] pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[var(--text-strong)]">
                  {t('cookie_banner.settings.title')}
                </h4>

                <div className="space-y-2.5">
                  <div className="app-surface flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border p-3">
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-[var(--accent)]" />
                      <div>
                        <div className="font-medium text-[var(--text-strong)]">
                          {t('cookie_banner.categories.necessary.title')}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {t('cookie_banner.categories.necessary.description')}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {t('cookie_banner.categories.necessary.always_on')}
                    </div>
                  </div>

                  <CookieCategory
                    title={t('cookie_banner.categories.analytics.title')}
                    description={t('cookie_banner.categories.analytics.description')}
                    icon="chart"
                    enabled={preferences.analytics}
                    onChange={(enabled) => setPreferences((current) => ({ ...current, analytics: enabled }))}
                  />
                  <CookieCategory
                    title={t('cookie_banner.categories.marketing.title')}
                    description={t('cookie_banner.categories.marketing.description')}
                    icon="target"
                    enabled={preferences.marketing}
                    onChange={(enabled) => setPreferences((current) => ({ ...current, marketing: enabled }))}
                  />
                  <CookieCategory
                    title={t('cookie_banner.categories.functional.title')}
                    description={t('cookie_banner.categories.functional.description')}
                    icon="settings"
                    enabled={preferences.functional}
                    onChange={(enabled) => setPreferences((current) => ({ ...current, functional: enabled }))}
                  />
                  <CookieCategory
                    title={t('cookie_banner.categories.preferences.title')}
                    description={t('cookie_banner.categories.preferences.description')}
                    icon="save"
                    enabled={preferences.preferences}
                    onChange={(enabled) => setPreferences((current) => ({ ...current, preferences: enabled }))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="app-surface rounded-[var(--radius-surface)] border p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    <Info className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
                    {t('cookie_banner.footer.privacy_notice')}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    {t('cookie_banner.links.manage_anytime')}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <a href="/privacy-policy" className="text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                    {t('cookie_banner.links.privacy_policy')}
                  </a>
                  <a href="/cookie-policy" className="text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                    {t('cookie_banner.links.cookie_policy')}
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-4 text-xs text-[var(--text-faint)]">
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3" />
                    <span>{t('cookie_banner.footer.last_update', { date: new Date().toLocaleDateString(i18n.language) })}</span>
                  </div>
                  <Button variant="hero" size="sm" onClick={handleSavePreferences}>
                    {t('cookie_banner.actions.save_preferences')}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

interface CookieCategoryProps {
  title: string;
  description: string;
  icon: 'chart' | 'target' | 'settings' | 'save';
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const iconLabelClass = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]';

const iconByType: Record<CookieCategoryProps['icon'], React.ReactNode> = {
  chart: <BarChart3 className="h-4 w-4" />,
  target: <Target className="h-4 w-4" />,
  settings: <Settings2 className="h-4 w-4" />,
  save: <SlidersHorizontal className="h-4 w-4" />,
};

const CookieCategory: React.FC<CookieCategoryProps> = ({
  title,
  description,
  icon,
  enabled,
  onChange,
}) => (
  <div className="app-surface flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border p-3">
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn(iconLabelClass, 'font-semibold')}>{iconByType[icon]}</span>
      <div className="min-w-0">
        <div className="font-medium text-[var(--text-strong)]">{title}</div>
        <div className="text-xs leading-5 text-[var(--text-muted)]">{description}</div>
      </div>
    </div>

    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
        enabled
          ? 'border-[rgba(var(--accent-rgb),0.34)] bg-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--surface-soft)]'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  </div>
);

export default CookieBanner;
