import React from 'react';
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
    const labels = {
      car: 'Autem',
      public: 'MHD',
      bike: 'Kolo',
      walk: 'Pěšky'
    };
    return labels[mode];
  };

  const getBgColor = (mode: TransportMode, isSelected: boolean) => {
    const colors = {
      car: isSelected ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-50 dark:bg-slate-800',
      public: isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-50 dark:bg-slate-800',
      bike: isSelected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-50 dark:bg-slate-800',
      walk: isSelected ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-slate-50 dark:bg-slate-800'
    };
    return colors[mode];
  };

  const getBorderColor = (mode: TransportMode, isSelected: boolean) => {
    if (!isSelected) return 'border-slate-200 dark:border-slate-700';
    const colors = {
      car: 'border-red-400 dark:border-red-600 ring-2 ring-red-200 dark:ring-red-800',
      public: 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-800',
      bike: 'border-green-400 dark:border-green-600 ring-2 ring-green-200 dark:ring-green-800',
      walk: 'border-yellow-400 dark:border-yellow-600 ring-2 ring-yellow-200 dark:ring-yellow-800'
    };
    return colors[mode];
  };

  const getIconColor = (mode: TransportMode) => {
    const colors = {
      car: 'text-red-600 dark:text-red-400',
      public: 'text-blue-600 dark:text-blue-400',
      bike: 'text-green-600 dark:text-green-400',
      walk: 'text-yellow-600 dark:text-yellow-400'
    };
    return colors[mode];
  };

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'}`}>
      {compact && (
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          Preferovaná doprava:
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
              className={`
                relative border rounded-lg p-3 transition-all text-center
                ${getBgColor(mode, isSelected)}
                border-2 ${getBorderColor(mode, isSelected)}
                hover:shadow-md
              `}
            >
              <Icon className={`w-5 h-5 mx-auto mb-2 ${getIconColor(mode)}`} />
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {getLabel(mode)}
              </p>
              {isSelected && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Vybrané</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TransportModeSelector;
