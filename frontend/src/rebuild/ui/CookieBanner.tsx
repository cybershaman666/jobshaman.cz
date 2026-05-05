import React from 'react';
import { ShieldCheck, X, Settings2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../cn';
import { panelClass, primaryButtonClass, secondaryButtonClass, pillEyebrowClass } from './shellStyles';
import { CookieConsentManager } from '../../services/cookieConsentService';

export const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const { t } = useTranslation();
  const manager = CookieConsentManager.getInstance();

  React.useEffect(() => {
    // Check if consent is already given
    if (!manager.hasConsent() || manager.needsRefresh()) {
      // Delay slightly for better UX (let the page load first)
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [manager]);

  if (!isVisible) return null;

  const handleAcceptAll = () => {
    manager.acceptAll();
    setIsVisible(false);
  };

  const handleAcceptNecessary = () => {
    manager.acceptNecessary();
    setIsVisible(false);
  };

  const categories = ['necessary', 'analytics', 'marketing', 'functional', 'preferences'] as const;

  return (
    <div className="fixed bottom-6 left-6 right-6 z-[100] flex justify-center pointer-events-none">
      <div className={cn(
        panelClass,
        'pointer-events-auto w-full max-w-2xl transform transition-all duration-500 ease-out translate-y-0 opacity-100',
        'border-[#c99a4a]/30 shadow-[0_32px_80px_-24px_rgba(159,118,45,0.4)] bg-[color-mix(in_srgb,var(--shell-panel-solid)_94%,transparent)]',
        !isVisible && 'translate-y-12 opacity-0'
      )}>
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="hidden md:flex shrink-0 h-12 w-12 items-center justify-center rounded-2xl bg-[#f3eadb] text-[#8c6727] shadow-inner">
              <ShieldCheck size={28} className="drop-shadow-sm" />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className={pillEyebrowClass}>{t('rebuild.ui.cookie_banner.title', { defaultValue: 'Privacy' })}</div>
                <button 
                  onClick={() => setIsVisible(false)}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={18} />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('rebuild.ui.cookie_banner.heading', { defaultValue: 'We respect your data' })}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {t('rebuild.ui.cookie_banner.description', { defaultValue: 'We use cookies to improve your experience, analyze traffic and personalize content. By clicking "Accept all", you agree to our use of cookies.' })}
              </p>

              {showSettings && (
                <div className="mt-6 space-y-4 border-t border-slate-100 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  {categories.map((cat) => {
                    const info = manager.getCategoryExplanation(cat);
                    return (
                      <div key={cat} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition">
                        <div className={cn(
                          "mt-1 shrink-0 h-5 w-5 rounded border flex items-center justify-center transition",
                          info.required ? "bg-slate-100 border-slate-200 text-slate-400" : "border-slate-300"
                        )}>
                          {info.required && <CheckCircle2 size={12} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            {t(info.title, { 
                              defaultValue: cat === 'necessary' ? 'Necessary cookies' :
                                            cat === 'analytics' ? 'Analytical cookies' :
                                            cat === 'marketing' ? 'Marketing cookies' :
                                            cat === 'functional' ? 'Functional cookies' :
                                            cat === 'preferences' ? 'Preference cookies' : 'Cookies'
                            })}
                            {info.required && <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{t('rebuild.ui.cookie_banner.required', { defaultValue: 'Required' })}</span>}
                          </div>
                          <p className="text-xs text-slate-500 leading-5 mt-1">
                            {t(info.description, { 
                              defaultValue: cat === 'necessary' ? 'Essential for the website to function.' :
                                            cat === 'analytics' ? 'Help us understand how the website is being used.' :
                                            cat === 'marketing' ? 'Used for personalized advertising and marketing.' :
                                            cat === 'functional' ? 'Enable enhanced features like chat and social media integration.' :
                                            cat === 'preferences' ? 'Store your choices and settings for a personalized experience.' : 'Basic site functionality.'
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button 
                  onClick={handleAcceptAll}
                  className={cn(primaryButtonClass, "px-8")}
                >
                  {t('rebuild.ui.cookie_banner.accept_all', { defaultValue: 'Accept all' })}
                </button>
                <button 
                  onClick={handleAcceptNecessary}
                  className={secondaryButtonClass}
                >
                  {t('rebuild.ui.cookie_banner.accept_necessary', { defaultValue: 'Necessary only' })}
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(secondaryButtonClass, "border-transparent bg-transparent hover:bg-slate-50")}
                >
                  <Settings2 size={16} />
                  {t('rebuild.ui.cookie_banner.settings', { defaultValue: 'Settings' })}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Shamanic accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_top_right,#f3eadb_0%,transparent_70%)] opacity-40 pointer-events-none" />
      </div>
    </div>
  );
};
