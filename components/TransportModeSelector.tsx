import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Car,
  Bus,
  Bike,
  Footprints
} from 'lucide-react';
import { TransportMode } from '../services/transportService';

interface TransportModeSelectorProps {
  selectedMode: TransportMode;
  onModeChange: (mode: TransportMode) => void;
  compact?: boolean;
}

const TransportModeSelector: React.FC<TransportModeSelectorProps> = ({
  selectedMode,
  onModeChange,
  compact = false
}) => {
  const { t } = useTranslation();

  const getIcon = (mode: TransportMode) => {
    const modes = {
      car: Car,
      public: Bus,
      bike: Bike,
      walk: Footprints
    };
    return modes[mode];
  };

  const getLabel = (mode: TransportMode) => {
    return t(`profile.transport_mode.${mode}`);
  };

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'}`}>
      {compact && (
        <p className="text-sm font-medium text-[var(--text-muted)]">
          {t('profile.transport_pref')}:
        </p>
      )}
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
        {(['car', 'public', 'bike', 'walk'] as TransportMode[]).map((mode) => {
          const Icon = getIcon(mode);
          const isSelected = selectedMode === mode;

          return (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={[
                'relative rounded-[1rem] border p-3 text-center transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 dark:focus-visible:ring-cyan-500/40',
                compact ? 'min-h-[88px]' : 'min-h-[104px]',
                isSelected
                  ? 'border-cyan-300/70 bg-cyan-50/90 shadow-[0_18px_34px_-24px_rgba(8,145,178,0.45)] dark:border-cyan-500/50 dark:bg-cyan-950/40 dark:shadow-[0_18px_34px_-24px_rgba(8,145,178,0.28)]'
                  : 'border-white/60 bg-white/60 backdrop-blur-xl hover:border-cyan-200/70 hover:bg-white/78 dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-cyan-500/50 dark:hover:bg-slate-900/80'
              ].join(' ')}
            >
              <div className={`mx-auto mb-2 inline-flex rounded-full p-2 ${isSelected ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/70 dark:text-cyan-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {getLabel(mode)}
              </p>
              {isSelected && (
                <p className="mt-1 text-[11px] text-cyan-600 dark:text-cyan-300">{t('profile.transport_selected')}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TransportModeSelector;
