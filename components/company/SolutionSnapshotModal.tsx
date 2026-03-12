import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SolutionSnapshot, SolutionSnapshotUpsertPayload } from '../../types';

interface SolutionSnapshotModalProps {
  open: boolean;
  locale?: string;
  jobTitle?: string | null;
  candidateName?: string | null;
  initialValue?: SolutionSnapshot | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: SolutionSnapshotUpsertPayload) => Promise<void> | void;
}

const splitTags = (value: string): string[] => (
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
);

const SolutionSnapshotModal: React.FC<SolutionSnapshotModalProps> = ({
  open,
  jobTitle,
  candidateName,
  initialValue,
  saving = false,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [result, setResult] = useState('');
  const [problemTags, setProblemTags] = useState('');
  const [solutionTags, setSolutionTags] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProblem(initialValue?.problem || '');
    setSolution(initialValue?.solution || '');
    setResult(initialValue?.result || '');
    setProblemTags((initialValue?.problem_tags || []).join(', '));
    setSolutionTags((initialValue?.solution_tags || []).join(', '));
    setError(null);
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!problem.trim() || !solution.trim() || !result.trim()) {
      setError(t('company.solution_snapshot.required', { defaultValue: 'Please complete problem, solution, and result.' }));
      return;
    }
    setError(null);
    await onSave({
      problem: problem.trim(),
      solution: solution.trim(),
      result: result.trim(),
      problem_tags: splitTags(problemTags),
      solution_tags: splitTags(solutionTags),
      is_public: false,
    });
  };

  return (
    <div className="app-modal-backdrop z-[220] p-3 sm:p-4">
      <div className="app-modal-panel max-w-3xl overflow-hidden">
        <div className="app-modal-surface space-y-5 p-5 sm:p-6">
          <div className="space-y-3">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
              {t('company.solution_snapshot.badge', { defaultValue: 'Micro job complete' })}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">
                {t('company.solution_snapshot.title', { defaultValue: 'Solution snapshot' })}
              </h3>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t('company.solution_snapshot.subtitle', { defaultValue: 'Capture the problem, what the candidate proposed, and the result in one short artifact.' })}
              </p>
              {(candidateName || jobTitle) ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('company.solution_snapshot.context', {
                    defaultValue: 'Dialogue with {{candidate}} for {{job}}',
                    candidate: candidateName || t('company.applications.labels.candidate', { defaultValue: 'Candidate' }),
                    job: jobTitle || t('company.dashboard.table.position', { defaultValue: 'Role' }),
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('company.solution_snapshot.problem', { defaultValue: 'Problem' })}
              </span>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={4}
                className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder={t('company.solution_snapshot.problem_placeholder', { defaultValue: 'For example: the support team could not keep up with onboarding questions.' })}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('company.solution_snapshot.solution', { defaultValue: 'Solution' })}
              </span>
              <textarea
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                rows={4}
                className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder={t('company.solution_snapshot.solution_placeholder', { defaultValue: 'For example: the candidate proposed a clearer FAQ map, flow, and light automation.' })}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('company.solution_snapshot.result', { defaultValue: 'Result' })}
              </span>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={4}
                className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder={t('company.solution_snapshot.result_placeholder', { defaultValue: 'For example: onboarding tickets dropped by 35% within two weeks.' })}
              />
            </label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t('company.solution_snapshot.problem_tags', { defaultValue: 'Problem tags' })}
                </span>
                <input
                  value={problemTags}
                  onChange={(e) => setProblemTags(e.target.value)}
                  className="w-full rounded-[0.95rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={t('company.solution_snapshot.problem_tags_placeholder', { defaultValue: 'for example onboarding, support, workflow' })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t('company.solution_snapshot.solution_tags', { defaultValue: 'Solution tags' })}
                </span>
                <input
                  value={solutionTags}
                  onChange={(e) => setSolutionTags(e.target.value)}
                  className="w-full rounded-[0.95rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={t('company.solution_snapshot.solution_tags_placeholder', { defaultValue: 'for example faq, automation, analytics' })}
                />
              </label>
            </div>
          </div>

          {error ? (
            <div className="rounded-[0.95rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="app-button-primary rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? t('company.solution_snapshot.saving', { defaultValue: 'Saving...' })
                : t('company.solution_snapshot.save', { defaultValue: 'Save snapshot' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolutionSnapshotModal;
