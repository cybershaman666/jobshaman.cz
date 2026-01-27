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
      car: 'Autem',
      public: 'MHD',
      bike: 'Kolo',
      walk: 'Pěšky'
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
        <p className="text-sm">Vzdálenost není k dispozici</p>
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
              Vaše preferovaná doprava na {distance.toFixed(1)} km
            </p>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {userModeCost.monthlyCost.toLocaleString('cs-CZ')} Kč
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              měsíčně
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-current border-opacity-20">
          <div className="text-center">
            <div className="text-xs text-slate-600 dark:text-slate-400">Denně</div>
            <div className="font-bold text-slate-900 dark:text-white">
              {userModeCost.dailyCost.toFixed(0)} Kč
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Čas
            </div>
            <div className="font-bold text-slate-900 dark:text-white">
              {userModeCost.dailyTime} min
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-600 dark:text-slate-400">Cena/min</div>
            <div className="font-bold text-slate-900 dark:text-white">
              {userModeCost.costPerMinute.toFixed(2)} Kč
            </div>
          </div>
        </div>

        {/* City Pass Info */}
        {userModeCost.cityPass && (
          <div className="mt-3 pt-3 border-t border-current border-opacity-20">
            <p className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{userModeCost.cityPass.description}</span>
              {userModeCost.cityPass.monthlyPass && (
                <span> - {userModeCost.cityPass.monthlyPass} {userModeCost.cityPass.country === 'CZ' ? 'Kč' : 'EUR'}/měsíc</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Comparison with other modes */}
      <div>
        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase">
          Porovnání s ostatními způsoby
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
                      {mode.monthlyCost.toLocaleString('cs-CZ')} Kč
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {mode.dailyTime} min
                    </div>
                  </div>
                </div>

                {/* Difference */}
                {mode.monthlyCost !== userModeCost.monthlyCost && (
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    {mode.monthlyCost < userModeCost.monthlyCost ? (
                      <span className="text-green-600 dark:text-green-400">
                        ↓ O {(userModeCost.monthlyCost - mode.monthlyCost).toFixed(0)} Kč levnější
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        ↑ O {(mode.monthlyCost - userModeCost.monthlyCost).toFixed(0)} Kč dražší
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
            Roční náklady:
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {(userModeCost.monthlyCost * 12).toLocaleString('cs-CZ')} Kč/rok
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
          <span>Jak se počítají náklady?</span>
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
                4 Módů dopravy - Výpočetní metoda
              </h5>

              {/* Car */}
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <Car className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">Autem</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li><strong>Sazba:</strong> 5 Kč/km (palivo, údržba, pojištění)</li>
                      <li><strong>Doba:</strong> 1.5 - 2.5 min/km v závislosti na terénu</li>
                      <li><strong>Ideální pro:</strong> Dálkové cesty, venkov</li>
                      <li><strong>Vzorec:</strong> Vzdálenost × 5 Kč/km × 2 (tam i zpět)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Public Transport */}
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <Bus className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">Veřejná doprava (MHD)</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li><strong>Sazba:</strong> 2.5 Kč/km + měsíční lístek</li>
                      <li><strong>Lístek:</strong> Doplňuje se dle města</li>
                      <li><strong>Praha:</strong> ~1,500 Kč/měsíc (60 km/měsíc zdarma)</li>
                      <li><strong>Brno:</strong> ~1,300 Kč/měsíc</li>
                      <li><strong>Plzeň:</strong> ~1,000 Kč/měsíc</li>
                      <li><strong>Doba:</strong> 2.0 - 3.0 min/km (čekání + jízda)</li>
                      <li><strong>Ideální pro:</strong> Velká města s dobrou MHD, bez stresu</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bike */}
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <Bike className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">Kolo</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li><strong>Sazba:</strong> 0.05 Kč/km (pouze údržba, pneumatiky)</li>
                      <li><strong>Doba:</strong> 4.0 - 6.0 min/km v závislosti na terenu</li>
                      <li><strong>Ideální pro:</strong> Vzdálenosti do 15 km</li>
                      <li><strong>Výhody:</strong> Nejlevnější, zdraví, bez emisí</li>
                      <li><strong>Vzorec:</strong> Vzdálenost × 0.05 Kč/km × 2</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Walking */}
              <div className="mb-4">
                <div className="flex items-start gap-3">
                  <Footprints className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">Pěšky</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-400 mt-2 space-y-1">
                      <li><strong>Sazba:</strong> 0 Kč (zdarma!)</li>
                      <li><strong>Doba:</strong> 12.0 - 15.0 min/km</li>
                      <li><strong>Ideální pro:</strong> Do 5 km</li>
                      <li><strong>Výhody:</strong> Nejlevnější, nejzdravější, bez dopadu na životní prostředí</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Special Notes */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-700 dark:text-slate-400 mb-3 font-medium">
                  <Plane className="w-3.5 h-3.5 inline mr-1 text-blue-600 dark:text-blue-400" />
                  Poznámky pro velké metropole:
                </p>
                <ul className="text-xs text-slate-700 dark:text-slate-400 space-y-1 ml-5">
                  <li>• <strong>Letenky/Karty:</strong> MHD v hlavních městech (Praha, Brno) nabízejí speciální měsíční letenky s neomezeným počtem jízd</li>
                  <li>• <strong>Subvence:</strong> Některé firmy podporují dopravu zaměstnanců (DPP bonus) - snižuje náklady</li>
                  <li>• <strong>Kombinované jízdné:</strong> Možnost kombinovat MHD s jízdním kolem (bike-sharing)</li>
                  <li>• <strong>E-koloběžky:</strong> Ve městech dostupné, cena ~5-10 Kč/km</li>
                </ul>
              </div>

              {/* Calculation Info */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-200">
                <p>
                  <strong>Jak se počítá?</strong> Všechny náklady výše jsou <strong>jednosměrné</strong>. Systém automaticky počítá s cestou tam i zpět (×2), 
                  přepočítává na denní/měsíční/roční náklady a zohledňuje měsíční letenky pro MHD.
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
