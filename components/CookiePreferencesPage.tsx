import React, { useState } from 'react';
import { Shield, Lock, Eye, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CookiePreferencesPageProps {
  theme?: 'light' | 'dark';
}

const CookiePreferencesPage: React.FC<CookiePreferencesPageProps> = ({ theme = 'light' }) => {
  const { t, i18n } = useTranslation();
  const [preferences] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cookie-consent');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  const isDark = theme === 'dark';
  const bannerClass = isDark 
    ? 'bg-slate-900 text-white border-slate-700' 
    : 'bg-white text-slate-900 border-slate-200';

  const handleClearAllData = () => {
    if (confirm(t('alerts.confirm_delete_all_data'))) {
      localStorage.clear();
      sessionStorage.clear();
      
      // Reload page to reset everything
      window.location.reload();
    }
  };

  const handleExportData = () => {
    const data = {
      cookieConsent: JSON.parse(localStorage.getItem('cookie-consent') || '{}'),
      userProfile: JSON.parse(localStorage.getItem('userProfile') || '{}'),
      savedJobs: JSON.parse(localStorage.getItem('savedJobs') || '[]'),
      savedCompanies: JSON.parse(localStorage.getItem('savedCompanies') || '[]'),
      applicationHistory: JSON.parse(localStorage.getItem('applicationHistory') || '[]'),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobshaman-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode === document.body) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  };

  if (!preferences) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-8 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`max-w-md w-full p-8 rounded-lg border shadow-lg ${bannerClass}`}>
          <div className="text-center mb-8">
            <Lock className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h1 className="text-2xl font-bold mb-2">{t('cookie_preferences.no_data_title')}</h1>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
              {t('cookie_preferences.no_data_desc')}
            </p>
            <button
              onClick={() => window.history.back()}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isDark 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {t('cookie_preferences.back_main')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className={`flex items-center gap-2 text-sm font-medium mb-6 transition-colors ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ← {t('cookie_preferences.back_to_jobshaman')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cookie Consent Status */}
          <div className={`p-6 rounded-lg border ${bannerClass}`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              {t('cookie_preferences.cookie_consent')}
            </h2>
            
            <div className="space-y-3">
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-2">{t('cookie_preferences.consent_status_title')}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>{t('cookie_preferences.last_update')}:</span>
                    <span className="font-medium">
                      {new Date(localStorage.getItem('cookie-consent-date') || '').toLocaleDateString(i18n.language)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('cookie_preferences.status')}:</span>
                    <span className={`font-medium ${preferences.analytics ? 'text-green-600' : 'text-amber-600'}`}>
                      {preferences.analytics ? t('cookie_preferences.status_active') : t('cookie_preferences.status_limited')}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-2">{t('cookie_preferences.permissions_overview')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.necessary ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>{t('cookie_preferences.necessary_cookies')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.analytics ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>{t('cookie_preferences.analytics_cookies')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.marketing ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>{t('cookie_preferences.marketing_cookies')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.functional ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>{t('cookie_preferences.functional_cookies')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className={`p-6 rounded-lg border ${bannerClass}`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-indigo-600" />
              {t('cookie_preferences.data_management')}
            </h2>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-3">{t('cookie_preferences.export_data_title')}</h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('cookie_preferences.export_data_desc')}
                </p>
                <button
                  onClick={handleExportData}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isDark 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('cookie_preferences.download_data')}
                </button>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-3">{t('cookie_preferences.delete_all_title')}</h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('cookie_preferences.delete_all_desc')}
                </p>
                <button
                  onClick={handleClearAllData}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isDark 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('cookie_preferences.delete_all_button')}
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Links */}
          <div className={`p-6 rounded-lg border ${bannerClass}`}>
            <h2 className="text-xl font-bold mb-4">{t('cookie_preferences.privacy_title')}</h2>
            <div className="space-y-3">
              <a 
                href="/privacy-policy"
                className={`block p-3 rounded-lg border transition-all duration-200 ${
                  isDark 
                    ? 'border-slate-700 hover:bg-slate-800 hover:text-white' 
                    : 'border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <h3 className="font-semibold mb-1">{t('cookie_preferences.privacy_policy_title')}</h3>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('cookie_preferences.privacy_policy_desc')}
                </p>
              </a>
              
              <a 
                href="/cookie-policy"
                className={`block p-3 rounded-lg border transition-all duration-200 ${
                  isDark 
                    ? 'border-slate-700 hover:bg-slate-800 hover:text-white' 
                    : 'border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <h3 className="font-semibold mb-1">{t('cookie_preferences.cookie_policy_title')}</h3>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('cookie_preferences.cookie_policy_desc')}
                </p>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-8 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="text-center text-sm">
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('cookie_preferences.footer_privacy_notice')}
            </p>
            <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('cookie_preferences.last_update')}: {new Date().toLocaleDateString(i18n.language)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePreferencesPage;
