import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AssessmentExperienceRouter from '../components/AssessmentExperienceRouter';
import { readAssessmentPreviewMode, readAssessmentPreviewPayload, readAssessmentPreviewReturnTo } from '../services/assessmentPreviewNavigation';

const AssessmentPreviewPage: React.FC = () => {
  const { t } = useTranslation();
  const assessment = readAssessmentPreviewPayload();
  const returnTo = readAssessmentPreviewReturnTo();
  const forcedMode = readAssessmentPreviewMode();
  const goBack = () => {
    if (returnTo) {
      window.location.assign(returnTo);
      return;
    }
    window.history.back();
  };

  if (!assessment) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold mb-2">
            {t('assessment_preview_page.not_available_title', { defaultValue: 'Assessment preview not available' })}
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            {t('assessment_preview_page.not_available_desc', { defaultValue: 'Preview data was not found. Open preview again from the company dashboard.' })}
          </p>
          <button
            onClick={goBack}
            className="px-4 py-2 rounded bg-cyan-600 text-white font-semibold inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            {t('assessment_preview_page.back', { defaultValue: 'Back' })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-[100dvh] app-grid-bg app-grid-bg--soft relative overflow-hidden">
      <div className="absolute top-4 left-4 z-[90]">
        <button
          onClick={goBack}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/85 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 backdrop-blur-md shadow-sm"
        >
          <ArrowLeft size={15} />
          {t('assessment_preview_page.back_to_dashboard', { defaultValue: 'Back to dashboard' })}
        </button>
      </div>
      <div className="absolute top-4 right-4 z-[90]">
        <div className="px-3 py-2 rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-200 text-xs font-semibold shadow-sm">
          {t('assessment_preview_page.recruiter_preview', { defaultValue: 'Recruiter Preview' })}
        </div>
      </div>
      <AssessmentExperienceRouter
        assessment={assessment}
        invitationId="preview"
        mode="preview"
        embedded
        forceAssessmentMode={forcedMode || undefined}
        onComplete={goBack}
      />
    </div>
  );
};

export default AssessmentPreviewPage;
