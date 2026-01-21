interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  preferences: boolean;
}

export class CookieConsentManager {
  private static instance: CookieConsentManager;
  private readonly STORAGE_KEY = 'cookie-consent';
  private readonly DATE_KEY = 'cookie-consent-date';

  static getInstance(): CookieConsentManager {
    if (!CookieConsentManager.instance) {
      CookieConsentManager.instance = new CookieConsentManager();
    }
    return CookieConsentManager.instance;
  }

  // Check if user has given consent
  hasConsent(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  // Get current consent preferences
  getPreferences(): CookiePreferences | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;
    
    try {
      return JSON.parse(stored) as CookiePreferences;
    } catch {
      return null;
    }
  }

  // Save consent preferences
  savePreferences(preferences: CookiePreferences): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
    localStorage.setItem(this.DATE_KEY, new Date().toISOString());
    
    // Update analytics consent if available
    this.updateAnalyticsConsent(preferences);
    
    // Fire custom event for other components
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', {
      detail: preferences
    }));
  }

  // Remove consent (user withdrawal)
  withdrawConsent(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.DATE_KEY);
    
    // Update analytics consent to denied
    this.updateAnalyticsConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
      preferences: false
    });
    
    // Fire custom event
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', {
      detail: null
    }));
  }

  // Check if consent needs to be refreshed (older than 1 year)
  needsRefresh(): boolean {
    const consentDate = localStorage.getItem(this.DATE_KEY);
    if (!consentDate) return false;
    
    const date = new Date(consentDate);
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    
    return date < yearAgo;
  }

  // Get consent date
  getConsentDate(): Date | null {
    const dateStr = localStorage.getItem(this.DATE_KEY);
    return dateStr ? new Date(dateStr) : null;
  }

  // Update Google Analytics consent
  private updateAnalyticsConsent(preferences: CookiePreferences): void {
    try {
      const gtag = (window as any).gtag;
      if (!gtag) return;

      gtag('consent', 'update', {
        analytics_storage: preferences.analytics ? 'granted' : 'denied',
        ad_storage: preferences.marketing ? 'granted' : 'denied',
        ad_user_data: preferences.marketing ? 'granted' : 'denied',
        functionality_storage: preferences.functional ? 'granted' : 'denied',
        personalization_storage: preferences.preferences ? 'granted' : 'denied',
        security_storage: 'granted' // Always granted for security
      });
    } catch (error) {
      console.error('Failed to update analytics consent:', error);
    }
  }

  // Check if specific category is consented
  hasConsentFor(category: keyof CookiePreferences): boolean {
    const preferences = this.getPreferences();
    return preferences ? preferences[category] : false;
  }

  // Get default preferences (strict privacy by default)
  private getDefaultPreferences(): CookiePreferences {
    return {
      necessary: true, // Cannot be disabled
      analytics: false,
      marketing: false,
      functional: false,
      preferences: false
    };
  }

  // Initialize analytics with default denied consent
  initializeAnalytics(): void {
    const preferences = this.getPreferences() || this.getDefaultPreferences();
    this.updateAnalyticsConsent(preferences);
  }

  // Accept all cookies (convenience method)
  acceptAll(): void {
    this.savePreferences({
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
      preferences: true
    });
  }

  // Accept only necessary cookies (privacy-first method)
  acceptNecessary(): void {
    this.savePreferences({
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
      preferences: false
    });
  }

  // Get user-friendly explanation of what each category does
  getCategoryExplanation(category: keyof CookiePreferences): {
    title: string;
    description: string;
    examples: string[];
    required: boolean;
  } {
    const explanations = {
      necessary: {
        title: 'Nezbytné cookies',
        description: 'Zajišťují základní funkce webu jako přihlášení, ochrana CSRF, správa košíku a session.',
        examples: ['Přihlášení', 'Session management', 'Ochrana proti CSRF'],
        required: true
      },
      analytics: {
        title: 'Analytické cookies',
        description: 'Pomáhají nám pochopit, jak web používáte, kolik návštěvníků máme a jaké stránky jsou populární.',
        examples: ['Google Analytics', 'Hotjar', 'Microsoft Clarity'],
        required: false
      },
      marketing: {
        title: 'Marketingové cookies',
        description: 'Používají se k personalizaci reklam, sledování konverzí a cílenému marketingu.',
        examples: ['Facebook Pixel', 'Google Ads', 'LinkedIn Insight Tag'],
        required: false
      },
      functional: {
        title: 'Funkční cookies',
        description: 'Umožňují vylepšené funkce jako chat, sociální sítě integrace a personalizace obsahu.',
        examples: ['Live chat', 'Sociální sítě', 'Připomenutí na akce'],
        required: false
      },
      preferences: {
        title: 'Preferenční cookies',
        description: 'Ukládají vaše volby a nastavení pro personalizovaný zážitek při příštích návštěvách.',
        examples: ['Jazykové nastavení', 'Motiv webu', 'Rozložení stránky'],
        required: false
      }
    };

    return explanations[category];
  }
}

// Export convenience functions for common usage
export const checkCookieConsent = (): boolean => {
  return CookieConsentManager.getInstance().hasConsent();
};

export const getCookiePreferences = (): CookiePreferences | null => {
  return CookieConsentManager.getInstance().getPreferences();
};

export const saveCookiePreferences = (preferences: CookiePreferences): void => {
  CookieConsentManager.getInstance().savePreferences(preferences);
};

export const withdrawCookieConsent = (): void => {
  CookieConsentManager.getInstance().withdrawConsent();
};

export const initializeAnalytics = (): void => {
  CookieConsentManager.getInstance().initializeAnalytics();
};