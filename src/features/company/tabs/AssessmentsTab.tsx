import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Copy, Archive, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { CompanyProfile, Job } from '../../../../types';
import { AssessmentCreatorPanel } from '../AssessmentCreatorPanel';

interface AssessmentsTabProps {
  assessmentsData: any;
  companyProfile?: CompanyProfile | null;
  jobs?: Job[];
}

export const AssessmentsTab: React.FC<AssessmentsTabProps> = ({ assessmentsData, companyProfile, jobs }) => {
  const { t } = useTranslation();
  const [showCreator, setShowCreator] = useState(false);

  const library = assessmentsData?.assessmentLibrary || [];
  const loading = assessmentsData?.assessmentLibraryLoading;
  const refreshLibrary = assessmentsData?.refreshAssessmentLibrary || (() => {});
  const duplicateAssessment = assessmentsData?.duplicateAssessment || (() => {});
  const archiveAssessment = assessmentsData?.archiveAssessment || (() => {});

  if (loading && library.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
          {t('company.assessments.loading', { defaultValue: 'Načítání assessmentů...' })}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle Creator */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCreator(!showCreator)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('company.assessments.create_title', { defaultValue: 'Vytvořit assessment pomocí AI' })}
            </span>
          </div>
          {showCreator ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showCreator && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-5">
            <AssessmentCreatorPanel
              companyProfile={companyProfile}
              jobs={jobs}
            />
          </div>
        )}
      </div>

      {/* Library Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('company.assessments.library_title', { defaultValue: 'Knihovna assessmentů' })}
          <span className="ml-2 text-sm font-normal text-slate-400">({library.length})</span>
        </h2>
        <button
          onClick={refreshLibrary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={14} />
          {t('company.assessments.refresh', { defaultValue: 'Obnovit' })}
        </button>
      </div>

      {/* Library Grid */}
      {library.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/10 mb-4">
            <BookOpen size={32} className="text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('company.assessments.empty_title', { defaultValue: 'Zatím žádné assessmenty' })}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            {t('company.assessments.empty_desc', { defaultValue: 'Vytvořte assessment pomocí AI a otestujte kandidáty. Assessment ukazuje jak kandidát přemýšlí, ne co má v CV.' })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {library.map((assessment: any) => (
            <div
              key={assessment.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 hover:border-[var(--accent)] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {assessment.name || assessment.title || assessment.role || 'Untitled Assessment'}
                  </h3>
                  {assessment.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {assessment.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-400 dark:text-slate-500 mb-3">
                {assessment.role && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {assessment.role}
                  </span>
                )}
                {assessment.difficulty && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {assessment.difficulty}
                  </span>
                )}
                {assessment.questions?.length && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {assessment.questions.length} {t('company.assessments.questions', { defaultValue: 'otázek' })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => duplicateAssessment(assessment.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Copy size={12} />
                  {t('company.assessments.duplicate', { defaultValue: 'Duplikovat' })}
                </button>
                <button
                  onClick={() => archiveAssessment(assessment.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Archive size={12} />
                  {t('company.assessments.archive', { defaultValue: 'Archivovat' })}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
