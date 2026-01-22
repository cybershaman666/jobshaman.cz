import React, { useState } from 'react';
import { ContextualRelevanceScore, FlaggedBenefit } from '../types';
import { CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface ContextualRelevanceProps {
  contextualRelevance: ContextualRelevanceScore;
  compact?: boolean;
}

const ContextualRelevance: React.FC<ContextualRelevanceProps> = ({ 
  contextualRelevance, 
  compact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700';
  };

  const getRelevanceIcon = (relevance: string) => {
    switch (relevance) {
      case 'relevant':
        return <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" />;
      case 'weakly_relevant':
        return <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />;
      case 'context_mismatch':
        return <XCircle size={14} className="text-rose-600 dark:text-rose-400" />;
      default:
        return <Info size={14} className="text-slate-400" />;
    }
  };



  const groupBenefitsByRelevance = (benefits: FlaggedBenefit[]) => {
    const grouped = {
      relevant: benefits.filter(b => b.relevance === 'relevant'),
      weakly_relevant: benefits.filter(b => b.relevance === 'weakly_relevant'),
      context_mismatch: benefits.filter(b => b.relevance === 'context_mismatch')
    };
    return grouped;
  };

  const groupedBenefits = groupBenefitsByRelevance(contextualRelevance.flagged_benefits);

  if (compact) {
    return (
      <div className={`px-2 py-1 rounded text-xs font-bold border ${getScoreColor(contextualRelevance.contextual_relevance_score)}`}>
        Relevance {contextualRelevance.contextual_relevance_score}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200">Kontextová relevance benefitů</h4>
          <div className={`px-2 py-1 rounded text-xs font-bold border ${getScoreColor(contextualRelevance.contextual_relevance_score)}`}>
            {contextualRelevance.contextual_relevance_score}/100
          </div>
        </div>
        {contextualRelevance.flagged_benefits.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
        {contextualRelevance.summary_text}
      </p>

      {/* Detailed breakdown */}
      {isExpanded && contextualRelevance.flagged_benefits.length > 0 && (
        <div className="space-y-3 mt-4 border-t border-slate-200 dark:border-slate-800 pt-4">
          {/* Relevant benefits */}
          {groupedBenefits.relevant.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <CheckCircle size={16} />
                Plně relevantní ({groupedBenefits.relevant.length})
              </h5>
              <div className="space-y-2">
                {groupedBenefits.relevant.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">•</span>
                    <div className="flex-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {benefit.benefit}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {benefit.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weakly relevant benefits */}
          {groupedBenefits.weakly_relevant.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                <AlertCircle size={16} />
                Částečně relevantní ({groupedBenefits.weakly_relevant.length})
              </h5>
              <div className="space-y-2">
                {groupedBenefits.weakly_relevant.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                    <div className="flex-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {benefit.benefit}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {benefit.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Context mismatch benefits */}
          {groupedBenefits.context_mismatch.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-rose-700 dark:text-rose-400 mb-2 flex items-center gap-2">
                <XCircle size={16} />
                Neaplikovatelné ({groupedBenefits.context_mismatch.length})
              </h5>
              <div className="space-y-2">
                {groupedBenefits.context_mismatch.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-rose-600 dark:text-rose-400 mt-0.5">•</span>
                    <div className="flex-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {benefit.benefit}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {benefit.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compact view when not expanded */}
      {!isExpanded && contextualRelevance.flagged_benefits.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {contextualRelevance.flagged_benefits.slice(0, 3).map((benefit, index) => (
            <div 
              key={index}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-slate-200 dark:border-slate-700"
            >
              {getRelevanceIcon(benefit.relevance)}
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {benefit.benefit}
              </span>
            </div>
          ))}
          {contextualRelevance.flagged_benefits.length > 3 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 px-2 py-1">
              +{contextualRelevance.flagged_benefits.length - 3} více
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextualRelevance;