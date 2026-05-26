import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import { cn } from '../../../cn';

export interface MetricDatum {
  label: string;
  value: number;
  max?: number;
}

export interface AssessmentMetricsPanelProps {
  metrics: MetricDatum[];
  summary?: string;
  className?: string;
}

/**
 * Display assessment metrics and scores for candidate
 * For recruiter readout view
 */
export const AssessmentMetricsPanel: React.FC<AssessmentMetricsPanelProps> = ({
  metrics,
  summary,
  className,
}) => {
  const { t } = useTranslation();

  const maxScore = Math.max(...metrics.map(m => m.max || 100));
  const avgScore = Math.round(
    metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall Score */}
      <div className="rounded-[12px] border border-slate-200 bg-gradient-to-br from-blue-50 to-slate-50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-slate-500 tracking-wide">
              {t('rebuild.recruiter.average_assessment', { defaultValue: 'Average Score' })}
            </div>
            <div className="mt-2 text-4xl font-bold text-[#1f5fbf]">
              {avgScore}
              <span className="text-lg text-slate-500">/100</span>
            </div>
          </div>
          <div className="h-16 w-16 rounded-full bg-[#dbeafe] flex items-center justify-center">
            <TrendingUp size={32} className="text-[#1f5fbf]" />
          </div>
        </div>
      </div>

      {/* Individual Metrics */}
      <div className="grid gap-3">
        {metrics.map((metric) => {
          const percentage = (metric.value / (metric.max || 100)) * 100;
          return (
            <div key={metric.label} className="rounded-[12px] border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">{metric.label}</span>
                <span className="text-lg font-bold text-[#1f5fbf]">{metric.value}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1f5fbf] transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {summary && (
        <div className="rounded-[12px] border border-slate-200 bg-white p-4">
          <div className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-2">
            {t('rebuild.recruiter.assessment_summary', { defaultValue: 'Summary' })}
          </div>
          <p className="text-sm leading-6 text-slate-700">{summary}</p>
        </div>
      )}
    </div>
  );
};
