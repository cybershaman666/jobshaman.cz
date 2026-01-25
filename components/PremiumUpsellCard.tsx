import React from 'react';
import { 
  FileText, 
  Wand2, 
  Mail, 
  ArrowRight,
  Star,
  Lock
} from 'lucide-react';
import { redirectToCheckout } from '../services/stripeService';

interface PremiumUpsellCardProps {
  userId: string;
  isCompact?: boolean;
}

const PremiumUpsellCard: React.FC<PremiumUpsellCardProps> = ({ userId, isCompact = false }) => {
  const handleUpgrade = () => {
    if (!userId) {
      alert('Prosím přihlaste se nejdříve');
      return;
    }
    redirectToCheckout('basic', userId);
  };

  if (isCompact) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3 mb-3">
          <Star className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
              Zkuste Premium funkcionalitu
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              CV šablony, AI přepsání a generování dopisů
            </p>
          </div>
        </div>
        
        <button
          onClick={handleUpgrade}
          className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all hover:shadow-lg text-sm"
        >
          Upgradovat za 199 Kč/měsíc
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 dark:from-blue-900/30 dark:via-cyan-900/30 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-8 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-300/20 to-cyan-300/20 rounded-full blur-3xl -z-0"></div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-6 h-6 text-amber-500" fill="currentColor" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-3 py-1 rounded-full">
            NOVÉ FUNKCIONALITA
          </span>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Odemkněte Premium funkce
        </h2>

        <p className="text-slate-600 dark:text-slate-300 mb-6 text-lg">
          Získejte přístup k AI nástrojům, které vám pomohou dostat se na vyšší pozici
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500 text-white p-2 rounded-lg flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white mb-1">CV Šablony</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Profesionální designy optimalizované pro recruitmenty
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-purple-500 text-white p-2 rounded-lg flex-shrink-0">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white mb-1">AI Přepsání CV</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Inteligentní optimalizace na míru pozice
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-green-500 text-white p-2 rounded-lg flex-shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white mb-1">AI Motivační Dopis</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Automatické vytváření personalizovaných dopisů
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 border border-slate-200 dark:border-slate-700">
          <p className="text-center">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">199 Kč</span>
            <span className="text-slate-600 dark:text-slate-400 ml-2">/měsíc</span>
          </p>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
            Zrušit kdykoli bez pokut
          </p>
        </div>

        <button
          onClick={handleUpgrade}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl transition-all hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2 mb-3"
        >
          <Lock className="w-5 h-5" />
          Upgradovat Teď
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Zabezpečená platba · Okamžitý přístup · Bez dlouhodobého závazku
        </p>
      </div>
    </div>
  );
};

export default PremiumUpsellCard;
