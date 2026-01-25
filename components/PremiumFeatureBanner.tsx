import React from 'react';
import { Lock, ArrowRight, X } from 'lucide-react';

interface PremiumFeatureBannerProps {
  featureName: string;
  userId: string;
  onUpgradeClick: (userId: string) => void;
  onDismiss?: () => void;
}

const PremiumFeatureBanner: React.FC<PremiumFeatureBannerProps> = ({
  featureName,
  userId,
  onUpgradeClick,
  onDismiss
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/40 dark:to-cyan-900/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-3 flex-1">
        <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg flex-shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">
            {featureName} je exkluzivní pro premium členy
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Upgradujte na Premium a získejte přístup ke všem AI nástrojům
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onUpgradeClick(userId)}
          className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          Upgradovat
          <ArrowRight className="w-4 h-4" />
        </button>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PremiumFeatureBanner;
