import React, { useState } from 'react';
import { Euro, Car, Home, TrendingUp, Calculator, Info, ChevronDown, ChevronUp, Bus, Bike, Footprints, Zap, TrendingDown } from 'lucide-react';
import { FinancialReality } from '../types';

interface FinancialRealityComponentProps {
  financialReality: FinancialReality & { 
    commuteDetails: { distance: number; monthlyCost: number } 
  } | null;
  isLoading?: boolean;
  error?: string | null;
  theme?: 'light' | 'dark';
}

const FinancialRealityComponent: React.FC<FinancialRealityComponentProps> = ({
  financialReality,
  isLoading = false,
  error = null
}) => {
  const [showMethodology, setShowMethodology] = useState(false);


  if (isLoading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    );
  }

  if (error || !financialReality) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Calculator className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {error || 'Finanční data nejsou k dispozici'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString('cs-CZ');
    return `${formatted} ${currency}`;
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-6 border border-emerald-200 dark:border-emerald-700">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500 rounded-lg">
          <Euro className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
            Čistá Realita
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Reálná finanční hodnota po zohlednění všech faktorů
          </p>
        </div>
      </div>

      {/* Main Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Base Salary */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Základní mzda
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(financialReality.grossMonthlySalary, financialReality.currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">hrubého měsíčně</p>
        </div>

        {/* Benefits Value */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-700">
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Benefity
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            +{formatCurrency(Math.round(financialReality.benefitsValue / 12), financialReality.currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">měsíčně</p>
        </div>

        {/* Commute Cost */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-700">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
              Doprava
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            -{formatCurrency(financialReality.commuteCost, financialReality.currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {financialReality.commuteDetails?.distance || 0} km od domova
          </p>
        </div>

        {/* Final Real Value */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-white" />
            <span className="text-xs font-medium text-white uppercase tracking-wider">
              Čistá realita
            </span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(financialReality.finalRealMonthlyValue, financialReality.currency)}
          </div>
          <p className="text-xs text-emerald-100 mt-1">reálně měsíčně</p>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-700">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Detailní rozpis</h4>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm text-slate-600 dark:text-slate-300">Hrubá měsíční mzda</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {formatCurrency(financialReality.grossMonthlySalary, financialReality.currency)}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm text-slate-600 dark:text-slate-300">Hodnota benefitů (měsíčně)</span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              +{formatCurrency(Math.round(financialReality.benefitsValue / 12), financialReality.currency)}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm text-slate-600 dark:text-slate-300">Odhady daní a pojištění</span>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              -{formatCurrency(financialReality.estimatedTaxAndInsurance, financialReality.currency)}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm text-slate-600 dark:text-slate-300">Náklady na dopravu</span>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              -{formatCurrency(financialReality.commuteCost, financialReality.currency)}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-3 font-bold">
            <span className="text-slate-900 dark:text-white">Čistá měsíční hodnota</span>
            <span className="text-lg text-emerald-600 dark:text-emerald-400">
              {formatCurrency(financialReality.finalRealMonthlyValue, financialReality.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* JHI Score Impact */}
      {financialReality.scoreAdjustment !== 0 && (
        <div className="mt-4 p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Vliv na JHI skóre
            </span>
            <span className={`text-lg font-bold ${
              financialReality.scoreAdjustment > 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {financialReality.scoreAdjustment > 0 ? '+' : ''}{financialReality.scoreAdjustment} bodů
            </span>
          </div>
        </div>
      )}

      {/* Methodology Explanation Box */}
      <div className="mt-6 border-t border-emerald-200 dark:border-emerald-700 pt-6">
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('financial.methodology.title') || 'Jak se počítají JHI a doprava?'}
          </span>
          {showMethodology ? (
            <ChevronUp className="w-4 h-4 ml-auto text-slate-600 dark:text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-auto text-slate-600 dark:text-slate-400 flex-shrink-0" />
          )}
        </button>

        {showMethodology && (
          <div className="mt-4 space-y-6 px-4 py-4 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            
            {/* JHI Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <h5 className="font-bold text-slate-900 dark:text-white">{t('financial.methodology.jhi_title') || 'JHI Score - Job Health Index'}</h5>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                {t('financial.methodology.jhi_desc') || 'Číselný index který měří \"zdraví\" konkrétní pracovní nabídky. Počítá se z mnoha faktorů:'}
              </p>
              <div className="space-y-2 ml-4">
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>{t('financial.methodology.pillar_financial_title') || 'Finanční dopad (Financial):'}</strong> {t('financial.methodology.pillar_financial_desc') || 'Jak mzda + benefity - doprava ovlivní vaše celkové příjmy'}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>{t('financial.methodology.pillar_time_title') || 'Čas:'}</strong> {t('financial.methodology.pillar_time_desc') || 'Jak se změny v dojížďce a typu práce (remote/hybrid/on-site) odrazí na vašem volném čase'}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>{t('financial.methodology.pillar_mental_title') || 'Psychická zátěž:'}</strong> {t('financial.methodology.pillar_mental_desc') || 'Slova jako \"dynamické prostředí\", \"na sobě závislý\", \"stres\" snižují skóre'}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>{t('financial.methodology.pillar_growth_title') || 'Růst a rozvoj:'}</strong> {t('financial.methodology.pillar_growth_desc') || 'Školení, kurzy a vzdělávání zvyšují skóre'}
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-900 dark:text-yellow-200">
                  <strong>{t('financial.methodology.jhi_formula_title') || 'Vzorec dopadu dopravy:'}</strong> {t('financial.methodology.jhi_formula') || 'Procent změny příjmu z dopravy × 1.5 = JHI body'}
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-2">
                  {t('financial.methodology.jhi_example_long') || 'Příklad: Pokud doprava sníží čistý příjem o 1%, JHI klesne o ~1.5 bodů. Kappován na -20 až +15 bodů.'}
                </p>
              </div>
            </div>

            {/* Transport Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h5 className="font-bold text-slate-900 dark:text-white">{t('financial.methodology.transport_title') || 'Výpočet Ceny Dopravy'}</h5>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                {t('financial.methodology.transport_desc') || 'Systém počítá s vašou preferovanou dopravou a bezvýsledně sníží náklady:'}
              </p>

              <div className="space-y-3">
                {/* Car */}
                <div className="border-l-4 border-red-600 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Car className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{t('financial.methodology.transport_car_title') || 'Autem'}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    5 CZK/km × vzdálenost × 2 (tam+zpět) × 22 pracovních dnů
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Př: 10 km = 10 × 5 × 2 × 22 = 2200 Kč/měsíc
                  </p>
                </div>

                {/* Public Transport */}
                <div className="border-l-4 border-blue-600 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bus className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{t('financial.methodology.transport_public_title') || 'Veřejná doprava (MHD)'}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mb-1">
                  <strong>{t('financial.methodology.transport_public_example_title') || 'Město-specifická letenka (preferováno):'}</strong> {t('financial.methodology.transport_public_example') || 'Praha 1500 Kč, Brno 1300 Kč, Plzeň 1000 Kč...'}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    <strong>Nebo lineární:</strong> 2.5 CZK/km × vzdálenost × 2 × 22 dnů
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    ✓ Systém automaticky vybere levnější variantu
                  </p>
                </div>

                {/* Bike */}
                <div className="border-l-4 border-green-600 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bike className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">Kolo</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    0.05 CZK/km × vzdálenost × 2 × 22 dnů (jen údržba, pneumatiky)
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Př: 10 km = 10 × 0.05 × 2 × 22 = 22 Kč/měsíc
                  </p>
                </div>

                {/* Walk */}
                <div className="border-l-4 border-yellow-600 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Footprints className="w-4 h-4 text-yellow-600" />
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">Pěšky</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    0 Kč (zdarma, ideálně do 5 km)
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Inteligentní výpočet:</strong> Systém znám vaši preferenci (MHD) a město (Praha) a počítá s nejlevnější opcí - měsíční letenkou.
                  </span>
                </p>
              </div>
            </div>

            {/* Impact Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h5 className="font-bold text-slate-900 dark:text-white">Vliv na Vaši Nabídku</h5>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                Finální hodnota: <strong>Čistá mzda + Benefity - Doprava = Reálný Příjem</strong>
              </p>
              <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded text-slate-700 dark:text-slate-300 space-y-1 font-mono text-xs">
                <p>Příklad: 30 000 Kč netto</p>
                <p>+ 392 Kč benefity (4700 Kč/rok)</p>
                <p>- 1500 Kč doprava (MHD Praha)</p>
                <p className="font-bold border-t border-slate-300 dark:border-slate-600 pt-1">
                  = 28 892 Kč reálně měsíčně
                </p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Tento rozdíl (cca -3.6%) se přepočítá na JHI dopad: -3.6% × 1.5 = <strong>-5 bodů</strong>
              </p>
            </div>

            {/* Note */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                <strong>💡 Tip:</strong> Všechny výpočty jsou automatické a zohledňují vaše konkrétní preference, město a aktuální ceny MHD. Nic se nemusíte počítat ručně!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialRealityComponent;
