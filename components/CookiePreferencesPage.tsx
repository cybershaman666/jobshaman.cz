import React, { useState } from 'react';
import { Shield, Lock, Eye, Trash2, RefreshCw } from 'lucide-react';

interface CookiePreferencesPageProps {
  theme?: 'light' | 'dark';
}

const CookiePreferencesPage: React.FC<CookiePreferencesPageProps> = ({ theme = 'light' }) => {
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
    if (confirm('Opravdu si přejete smazat všechny uložené údaje? Tato akce je nevratná.')) {
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
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!preferences) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-8 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`max-w-md w-full p-8 rounded-lg border shadow-lg ${bannerClass}`}>
          <div className="text-center mb-8">
            <Lock className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h1 className="text-2xl font-bold mb-2">Žádná data k správě</h1>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
              Ještě jste neudělili žádné nastavení cookies.
            </p>
            <button
              onClick={() => window.history.back()}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isDark 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              Zpět na hlavní stránku
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
            ← Zpět na JobShaman
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cookie Consent Status */}
          <div className={`p-6 rounded-lg border ${bannerClass}`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              Souhlas s Cookies
            </h2>
            
            <div className="space-y-3">
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-2">Stav souhlasu</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Poslední aktualizace:</span>
                    <span className="font-medium">
                      {new Date(localStorage.getItem('cookie-consent-date') || '').toLocaleDateString('cs-CZ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stav:</span>
                    <span className={`font-medium ${preferences.analytics ? 'text-green-600' : 'text-amber-600'}`}>
                      {preferences.analytics ? 'Aktivní' : 'Omezeno'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-2">Přehled oprávnění</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.necessary ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>Nezbytné cookies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.analytics ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>Analytické cookies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.marketing ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>Marketingové cookies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${preferences.functional ? 'bg-green-600' : 'bg-slate-300'}`} />
                    <span>Funkční cookies</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className={`p-6 rounded-lg border ${bannerClass}`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-indigo-600" />
              Správa dat
            </h2>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-3">Export vašich dat</h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Můžete si stáhnout všechny vaše uložené údaje ve formátu JSON pro zálohování nebo migraci.
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
                  Stáhnout data
                </button>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="font-semibold mb-3">Vymazání všech dat</h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Trvalé smazání všech lokálních dat v prohlížeči včetně cookies, profilu a uložených pozic.
                  Tato akce je nevratná.
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
                  Smazat všechna data
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Links */}
          <div className={`p-6 rounded-lg border ${bannerClass}`}>
            <h2 className="text-xl font-bold mb-4">Ochrana soukromí</h2>
            <div className="space-y-3">
              <a 
                href="/privacy-policy"
                className={`block p-3 rounded-lg border transition-all duration-200 ${
                  isDark 
                    ? 'border-slate-700 hover:bg-slate-800 hover:text-white' 
                    : 'border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <h3 className="font-semibold mb-1">Zásady ochrany osobních údajů</h3>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Přečtěte si, jak shromažďujeme, používáme a chráníme vaše osobní údaje.
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
                <h3 className="font-semibold mb-1">Politika cookies</h3>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Podrobné informace o všech používaných cookies a jejich účelu.
                </p>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-8 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="text-center text-sm">
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              JobShaman respektuje vaše soukromí v souladu s GDPR a ePrivacy Directive.
            </p>
            <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePreferencesPage;