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
      <div className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
        {(['car', 'public', 'bike', 'walk'] as TransportMode[]).map((mode) => {
          const Icon = getIcon(mode);
          const isSelected = selectedMode === mode;

          return (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={[
                'relative rounded-[1rem] border p-3 text-center transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.22)]',
                compact ? 'min-h-[88px]' : 'min-h-[104px]',
                isSelected
                  ? 'border-[rgba(var(--accent-rgb),0.28)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[rgba(var(--accent-rgb),0.16)] hover:bg-[var(--surface)]'
              ].join(' ')}
            >
              <div className={`mx-auto mb-2 inline-flex rounded-full p-2 ${isSelected ? 'bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent)]' : 'bg-[var(--surface)] text-[var(--text-muted)]'}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-[var(--text-strong)]">
                {getLabel(mode)}
              </p>
              {isSelected && (
                <p className="mt-1 text-[11px] text-[var(--accent)]">{t('profile.transport_selected')}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TransportModeSelector;
