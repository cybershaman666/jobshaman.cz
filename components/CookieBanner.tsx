import React, { useState, useEffect } from 'react';
import { X, Shield, Cookie, Info, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CookieBannerProps {
  theme?: 'light' | 'dark';
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
  theme = 'light', 
  onAccept, 
  onCustomize 
}) => {
  const { t, i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, cannot be disabled
    analytics: true,
    marketing: false,
    functional: false,
    preferences: false
  });

  // Check if user has already made a choice
  useEffect(() => {
    const hasConsent = localStorage.getItem('cookie-consent');
    const hasVisitedBefore = sessionStorage.getItem('cookie-banner-shown');
    
    if (!hasConsent && !hasVisitedBefore) {
      setIsVisible(true);
      sessionStorage.setItem('cookie-banner-shown', 'true');
    }
  }, []);

  const handleAcceptAll = () => {
    const allPreferences: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
      preferences: true
    };
    
    setPreferences(allPreferences);
    saveConsent(allPreferences);
    onAccept?.(allPreferences);
    setIsVisible(false);
  };

  const handleAcceptNecessary = () => {
    const necessaryOnly: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
      preferences: false
    };
    setPreferences(necessaryOnly);
    saveConsent(necessaryOnly);
    onAccept?.(necessaryOnly);
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
    onAccept?.(preferences);
    setIsVisible(false);
  };

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(prefs));
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    
    // Set consent for analytics if enabled (using gtag if available)
    if ((window as any).gtag && prefs.analytics) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'granted',
        security_storage: 'granted'
      });
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  const handleCustomize = () => {
    setShowDetails(!showDetails);
    onCustomize?.();
  };

  if (!isVisible) return null;

  const isDark = theme === 'dark';
  const bannerClass = isDark 
    ? 'bg-slate-900 border-slate-700 text-white' 
    : 'bg-white border-slate-200 text-slate-900';

  const buttonClass = isDark
    ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600';

  const secondaryButtonClass = isDark
    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300';

  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 p-3 rounded-lg border shadow-lg ${bannerClass} transition-all duration-300`}>
        <Cookie className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">{t('cookie_banner.minimized.title')}</span>
        <button
          onClick={handleExpand}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title={t('cookie_banner.minimized.expand_title')}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 border-t shadow-2xl ${bannerClass} transition-all duration-300`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
          {/* Left side - Icon and Description */}
          <div className="flex items-start gap-4 flex-1">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
              <Cookie className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                🍪 {t('cookie_banner.header.title')}
                <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100 text-amber-700'} font-normal`}>
                  {t('cookie_banner.header.gdpr_badge')}
                </span>
              </h3>
              <p className="text-sm leading-relaxed mb-3">
                {t('cookie_banner.header.description')}
              </p>
              
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleAcceptAll}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${buttonClass}`}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t('cookie_banner.actions.accept_all')}
                </button>
                <button
                  onClick={handleAcceptNecessary}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${secondaryButtonClass}`}
                >
                  {t('cookie_banner.actions.necessary_only')}
                </button>
                <button
                  onClick={handleCustomize}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${secondaryButtonClass}`}
                >
                  <Info className="w-4 h-4 mr-2" />
                  {t('cookie_banner.actions.customize')}
                </button>
              </div>
            </div>
          </div>

          {/* Right side - Detailed Preferences */}
          <div className="flex-1 lg:max-w-md">
            <button
              onClick={handleMinimize}
              className={`p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors self-start lg:hidden`}
              title={t('cookie_banner.actions.minimize')}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-3">
              <h4 className="font-semibold mb-3">{t('cookie_banner.settings.title')}</h4>
              
              {/* Cookie Categories */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-green-600" />
                    <div>
                      <div className="font-medium">{t('cookie_banner.categories.necessary.title')}</div>
                      <div className="text-xs opacity-75">{t('cookie_banner.categories.necessary.description')}</div>
                    </div>
                  </div>
                  <div className="text-sm text-green-600 font-medium">{t('cookie_banner.categories.necessary.always_on')}</div>
                </div>

                <CookieCategory
                  title={t('cookie_banner.categories.analytics.title')}
                  description={t('cookie_banner.categories.analytics.description')}
                  icon="📊"
                  enabled={preferences.analytics}
                  onChange={(enabled) => setPreferences(prev => ({ ...prev, analytics: enabled }))}
                  isDark={isDark}
                />

                <CookieCategory
                  title={t('cookie_banner.categories.marketing.title')}
                  description={t('cookie_banner.categories.marketing.description')}
                  icon="🎯"
                  enabled={preferences.marketing}
                  onChange={(enabled) => setPreferences(prev => ({ ...prev, marketing: enabled }))}
                  isDark={isDark}
                />

                <CookieCategory
                  title={t('cookie_banner.categories.functional.title')}
                  description={t('cookie_banner.categories.functional.description')}
                  icon="⚙️"
                  enabled={preferences.functional}
                  onChange={(enabled) => setPreferences(prev => ({ ...prev, functional: enabled }))}
                  isDark={isDark}
                />

                <CookieCategory
                  title={t('cookie_banner.categories.preferences.title')}
                  description={t('cookie_banner.categories.preferences.description')}
                  icon="💾"
                  enabled={preferences.preferences}
                  onChange={(enabled) => setPreferences(prev => ({ ...prev, preferences: enabled }))}
                  isDark={isDark}
                />
              </div>

              {/* Save Button for Custom Preferences */}
              <div className="pt-3 border-t">
                <button
                  onClick={handleSavePreferences}
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${buttonClass}`}
                >
                  {t('cookie_banner.actions.save_preferences')}
                </button>
              </div>

              {/* Links */}
              <div className="text-xs space-y-1 pt-2">
                <div className="flex flex-wrap gap-4">
                  <a 
                    href="/privacy-policy" 
                    className={`${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors`}
                  >
                    {t('cookie_banner.links.privacy_policy')}
                  </a>
                  <a 
                    href="/cookie-policy" 
                    className={`${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors`}
                  >
                    {t('cookie_banner.links.cookie_policy')}
                  </a>
                </div>
                <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2`}>
                  {t('cookie_banner.links.manage_anytime')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Info Bar */}
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <Info className="w-3 h-3" />
              <span>{t('cookie_banner.footer.privacy_notice')}</span>
            </div>
            <div className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('cookie_banner.footer.last_update', { date: new Date().toLocaleDateString(i18n.language) })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CookieCategoryProps {
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isDark: boolean;
}

const CookieCategory: React.FC<CookieCategoryProps> = ({
  title,
  description,
  icon,
  enabled,
  onChange,
  isDark
}) => {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
      isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <div>
          <div className="font-medium">{title}</div>
          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {description}
          </div>
        </div>
      </div>
      
      {/* Toggle Switch */}
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled 
            ? 'bg-indigo-600' 
            : isDark ? 'bg-slate-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

export default CookieBanner;
