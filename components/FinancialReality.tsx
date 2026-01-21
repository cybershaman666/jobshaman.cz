import React from 'react';
import { Euro, Car, Home, TrendingUp, Calculator } from 'lucide-react';
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
    </div>
  );
};

export default FinancialRealityComponent;