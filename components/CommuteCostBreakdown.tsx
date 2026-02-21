import React, { useMemo, useState } from 'react';
import { 
  Car, 
  Bus, 
  Bike, 
  Footprints,
  Clock,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  Plane
} from 'lucide-react';
import { TransportMode, calculateTransportCost } from '../services/transportService';
import { useTranslation } from 'react-i18next';

interface CommuteCostBreakdownProps {
  distance: number; // in km
  userTransportMode?: TransportMode;
  jobCity?: string;
  jobCountry?: string;
}

/**
 * Shows detailed commute cost breakdown for a specific job
 * Used in "Finanční a dojezdová realita" section
 */
const CommuteCostBreakdown: React.FC<CommuteCostBreakdownProps> = ({
  distance,
  userTransportMode = 'public',
  jobCity,
  jobCountry = 'CZ'
}) => {
  const { t, i18n } = useTranslation();
  const [showMethodology, setShowMethodology] = useState(false);
  const getIcon = (mode: TransportMode) => {
    const icons = {
      car: Car,
      public: Bus,
      bike: Bike,
      walk: Footprints
    };
    return icons[mode];
  };

  const getLabel = (mode: TransportMode) => {
    const labels = {
      car: t('commute_breakdown.transport_labels.car'),
      public: t('commute_breakdown.transport_labels.public'),
      bike: t('commute_breakdown.transport_labels.bike'),
      walk: t('commute_breakdown.transport_labels.walk')
    };
    return labels[mode];
  };

  const getColor = (mode: TransportMode) => {
    const colors = {
      car: 'text-red-600 dark:text-red-400',
      public: 'text-blue-600 dark:text-blue-400',
      bike: 'text-green-600 dark:text-green-400',
      walk: 'text-yellow-600 dark:text-yellow-400'
    };
    return colors[mode];
  };

  const getBgColor = (mode: TransportMode) => {
    const colors = {
      car: 'bg-red-50 dark:bg-red-900/10',
      public: 'bg-blue-50 dark:bg-blue-900/10',
      bike: 'bg-green-50 dark:bg-green-900/10',
      walk: 'bg-yellow-50 dark:bg-yellow-900/10'
    };
    return colors[mode];
  };

  const getBorderColor = (mode: TransportMode) => {
    const colors = {
      car: 'border-red-200 dark:border-red-800',
      public: 'border-blue-200 dark:border-blue-800',
      bike: 'border-green-200 dark:border-green-800',
      walk: 'border-yellow-200 dark:border-yellow-800'
    };
    return colors[mode];
  };

  // Calculate cost for user's preferred mode
  const userModeCost = useMemo(
    () => calculateTransportCost(distance, userTransportMode, jobCity, jobCountry),
    [distance, userTransportMode, jobCity, jobCountry]
  );

  // Calculate costs for all modes for comparison
  const allModes = useMemo(() => {
    const modes: TransportMode[] = ['car', 'public', 'bike', 'walk'];
    return modes.map(mode => 
      calculateTransportCost(distance, mode, jobCity, jobCountry)
    );
  }, [distance, jobCity, jobCountry]);

  if (distance <= 0) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-400 py-4">
        <p className="text-sm">{t('commute_breakdown.distance_unavailable')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main - User's Preferred Mode */}
      <div className={`p-4 rounded-lg border-2 ${getBgColor(userTransportMode)} ${getBorderColor(userTransportMode)}`}>
        <div className="flex items-start gap-3">
          {React.createElement(getIcon(userTransportMode), {
            className: `w-6 h-6 ${getColor(userTransportMode)} flex-shrink-0 mt-1`
          })}
          
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              {getLabel(userTransportMode)}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {t('commute_breakdown.preferred_transport_distance', { distance: distance.toFixed(1) })}
            </p>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {userModeCost.monthlyCost.toLocaleString(i18n.language)} {t('commute_breakdown.currency_czk')}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {t('commute_breakdown.monthly')}
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-current border-opacity-20">
          <div className="text-center">
            <div className="text-xs text-slate-600 dark:text-slate-400">{t('commute_breakdown.daily')}</div>
            <div className="font-bold text-slate-900 dark:text-white">
              {userModeCost.dailyCost.toFixed(0)} {t('commute_breakdown.currency_czk')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              {t('commute_breakdown.time')}
            </div>
            <div className="font-bold text-slate-900 dark:text-white">
              {t('commute_breakdown.minutes_value', { value: userModeCost.dailyTime })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-600 dark:text-slate-400">{t('commute_breakdown.cost_per_min')}</div>
            <div className="font-bold text-slate-900 dark:text-white">
              {userModeCost.costPerMinute.toFixed(2)} {t('commute_breakdown.currency_czk')}
            </div>
          </div>
        </div>

        {/* City Pass Info */}
        {userModeCost.cityPass && (
          <div className="mt-3 pt-3 border-t border-current border-opacity-20">
            <p className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{userModeCost.cityPass.description}</span>
              {userModeCost.cityPass.monthlyPass && (
                <span> - {userModeCost.cityPass.monthlyPass} {userModeCost.cityPass.country === 'CZ' ? t('commute_breakdown.currency_czk') : t('commute_breakdown.currency_eur')}/{t('commute_breakdown.month')}</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Comparison with other modes */}
      <div>
        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase">
          {t('commute_breakdown.comparison_title')}
        </h5>
        
        <div className="space-y-2">
          {allModes
            .filter(mode => mode.mode !== userTransportMode)
            .sort((a, b) => a.monthlyCost - b.monthlyCost)
            .slice(0, 2) // Show only top 2 alternatives
            .map(mode => (
              <div
                key={mode.mode}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {React.createElement(getIcon(mode.mode), {
                      className: `w-4 h-4 ${getColor(mode.mode)}`
                    })}
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {getLabel(mode.mode)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">
                      {mode.monthlyCost.toLocaleString(i18n.language)} {t('commute_breakdown.currency_czk')}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {t('commute_breakdown.minutes_value', { value: mode.dailyTime })}
                    </div>
                  </div>
                </div>

                {/* Difference */}
                {mode.monthlyCost !== userModeCost.monthlyCost && (
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    {mode.monthlyCost < userModeCost.monthlyCost ? (
                      <span className="text-green-600 dark:text-green-400">
                        {t('commute_breakdown.cheaper_by', { amount: (userModeCost.monthlyCost - mode.monthlyCost).toFixed(0) })}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        {t('commute_breakdown.more_expensive_by', { amount: (mode.monthlyCost - userModeCost.monthlyCost).toFixed(0) })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Annual summary */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {t('commute_breakdown.annual_costs')}
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {(userModeCost.monthlyCost * 12).toLocaleString(i18n.language)} {t('commute_breakdown.czk_per_year')}
          </span>
        </div>
      </div>

      {/* Expandable Methodology Box */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300 text-sm font-medium"
        >
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>{t('commute_breakdown.methodology_toggle')}</span>
          {showMethodology ? (
            <ChevronUp className="w-4 h-4 ml-auto flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-auto flex-shrink-0" />
          )}
        </button>

        {showMethodology && (
          <div className="mt-3 p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-4">
            <div>
              <h5 className="font-semibold text-slate-900 dark:text-white text-sm mb-3">
                {t('commute_breakdown.methodology_title')}
              </h5>

              {/* Car */}
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <Car className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{t('commute_breakdown.transport_labels.car')}</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li>{t('commute_breakdown.methodology.car.1')}</li>
                      <li>{t('commute_breakdown.methodology.car.2')}</li>
                      <li>{t('commute_breakdown.methodology.car.3')}</li>
                      <li>{t('commute_breakdown.methodology.car.4')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Public Transport */}
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <Bus className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{t('commute_breakdown.methodology.public.title')}</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li>{t('commute_breakdown.methodology.public.1')}</li>
                      <li>{t('commute_breakdown.methodology.public.2')}</li>
                      <li>{t('commute_breakdown.methodology.public.3')}</li>
                      <li>{t('commute_breakdown.methodology.public.4')}</li>
                      <li>{t('commute_breakdown.methodology.public.5')}</li>
                      <li>{t('commute_breakdown.methodology.public.6')}</li>
                      <li>{t('commute_breakdown.methodology.public.7')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bike */}
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <Bike className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{t('commute_breakdown.transport_labels.bike')}</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li>{t('commute_breakdown.methodology.bike.1')}</li>
                      <li>{t('commute_breakdown.methodology.bike.2')}</li>
                      <li>{t('commute_breakdown.methodology.bike.3')}</li>
                      <li>{t('commute_breakdown.methodology.bike.4')}</li>
                      <li>{t('commute_breakdown.methodology.bike.5')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Walking */}
              <div className="mb-4">
                <div className="flex items-start gap-3">
                  <Footprints className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{t('commute_breakdown.transport_labels.walk')}</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li>{t('commute_breakdown.methodology.walk.1')}</li>
                      <li>{t('commute_breakdown.methodology.walk.2')}</li>
                      <li>{t('commute_breakdown.methodology.walk.3')}</li>
                      <li>{t('commute_breakdown.methodology.walk.4')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Special Notes */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-700 dark:text-slate-400 mb-3 font-medium">
                  <Plane className="w-3.5 h-3.5 inline mr-1 text-blue-600 dark:text-blue-400" />
                  {t('commute_breakdown.metro_notes_title')}
                </p>
                <ul className="text-xs text-slate-700 dark:text-slate-400 space-y-1 ml-5">
                  <li>{t('commute_breakdown.metro_notes.1')}</li>
                  <li>{t('commute_breakdown.metro_notes.2')}</li>
                  <li>{t('commute_breakdown.metro_notes.3')}</li>
                  <li>{t('commute_breakdown.metro_notes.4')}</li>
                </ul>
              </div>

              {/* Calculation Info */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-200">
                <p>
                  {t('commute_breakdown.calculation_info')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommuteCostBreakdown;
