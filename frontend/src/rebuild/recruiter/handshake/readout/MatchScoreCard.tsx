import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../../cn';

export interface MatchScoreCardProps {
  score: number;
  fit: 'excellent' | 'good' | 'fair' | 'poor';
  benchmarks?: {
    label: string;
    value: string;
  }[];
  className?: string;
}

/**
 * Display overall match score and fit assessment
 * For recruiter readout view
 */
export const MatchScoreCard: React.FC<MatchScoreCardProps> = ({
  score,
  fit,
  benchmarks = [],
  className,
}) => {
  const { t } = useTranslation();

  const getFitColor = (fitType: string) => {
    switch (fitType) {
      case 'excellent':
        return { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', badge: 'bg-green-100 text-green-700' };
      case 'good':
        return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' };
      case 'fair':
        return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' };
      case 'poor':
      default:
        return { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', badge: 'bg-red-100 text-red-700' };
    }
  };

  const colors = getFitColor(fit);
  const Icon = fit === 'excellent' ? CheckCircle2 : fit === 'poor' ? XCircle : AlertCircle;

  const fitLabel = {
    excellent: t('rebuild.recruiter.fit_excellent', { defaultValue: 'Excellent Fit' }),
    good: t('rebuild.recruiter.fit_good', { defaultValue: 'Good Fit' }),
    fair: t('rebuild.recruiter.fit_fair', { defaultValue: 'Fair Fit' }),
    poor: t('rebuild.recruiter.fit_poor', { defaultValue: 'Poor Fit' }),
  };

  return (
    <div className={cn(`rounded-[12px] border-2 ${colors.border} ${colors.bg} p-6`, className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs font-bold uppercase text-slate-600 tracking-wide">
            {t('rebuild.recruiter.match_score', { defaultValue: 'Match Score' })}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className={cn('text-5xl font-bold', colors.icon)}>
              {score}
            </span>
            <span className="text-xl text-slate-500">/100</span>
          </div>

          <div className="mt-4">
            <span className={cn('inline-block rounded-full px-3 py-1 text-sm font-semibold', colors.badge)}>
              {fitLabel[fit]}
            </span>
          </div>
        </div>

        <div className={cn('h-20 w-20 flex items-center justify-center flex-shrink-0', colors.icon)}>
          <Icon size={64} />
        </div>
      </div>

      {benchmarks.length > 0 && (
        <div className="mt-6 border-t border-current opacity-20 pt-4 space-y-2">
          {benchmarks.map((bench, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-slate-700 font-medium">{bench.label}</span>
              <span className="font-semibold text-slate-900">{bench.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
