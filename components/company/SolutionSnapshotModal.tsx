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
  locale,
  jobTitle,
  candidateName,
  initialValue,
  saving = false,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const uiLocale = (() => {
    const normalized = String(locale || 'en').split('-')[0].toLowerCase();
    return ['cs', 'sk', 'de', 'at', 'pl'].includes(normalized) ? (normalized === 'at' ? 'de' : normalized) : 'en';
  })() as 'cs' | 'sk' | 'de' | 'pl' | 'en';
  const copy = ({
    cs: {
      required: 'Vyplňte prosím problém, řešení i výsledek.',
      badge: 'Mini výzva dokončena',
      title: 'Solution snapshot',
      subtitle: 'Zachyťte problém, návrh kandidáta a výsledek v jednom krátkém artefaktu.',
      context: 'Dialog s {{candidate}} pro {{job}}',
      candidate: 'Kandidát',
      role: 'Role',
      problem: 'Problém',
      problemPlaceholder: 'Například: support tým nestíhal onboarding dotazy.',
      solution: 'Řešení',
      solutionPlaceholder: 'Například: kandidát navrhl přehlednější FAQ strukturu, flow a lehkou automatizaci.',
      result: 'Výsledek',
      resultPlaceholder: 'Například: počet onboarding ticketů klesl během dvou týdnů o 35 %.',
      problemTags: 'Tagy problému',
      problemTagsPlaceholder: 'například onboarding, support, workflow',
      solutionTags: 'Tagy řešení',
      solutionTagsPlaceholder: 'například faq, automatizace, analytika',
      cancel: 'Zrušit',
      saving: 'Ukládám...',
      save: 'Uložit snapshot'
    },
    sk: {
      required: 'Vyplňte prosím problém, riešenie aj výsledok.',
      badge: 'Mini výzva dokončená',
      title: 'Solution snapshot',
      subtitle: 'Zachyťte problém, návrh kandidáta a výsledok v jednom krátkom artefakte.',
      context: 'Dialóg s {{candidate}} pre {{job}}',
      candidate: 'Kandidát',
      role: 'Rola',
      problem: 'Problém',
      problemPlaceholder: 'Napríklad: support tím nestíhal onboarding otázky.',
      solution: 'Riešenie',
      solutionPlaceholder: 'Napríklad: kandidát navrhol prehľadnejšiu FAQ štruktúru, flow a ľahkú automatizáciu.',
      result: 'Výsledok',
      resultPlaceholder: 'Napríklad: počet onboarding ticketov klesol počas dvoch týždňov o 35 %.',
      problemTags: 'Tagy problému',
      problemTagsPlaceholder: 'napríklad onboarding, support, workflow',
      solutionTags: 'Tagy riešenia',
      solutionTagsPlaceholder: 'napríklad faq, automatizácia, analytika',
      cancel: 'Zrušiť',
      saving: 'Ukladám...',
      save: 'Uložiť snapshot'
    },
    de: {
      required: 'Bitte Problem, Lösung und Ergebnis ausfüllen.',
      badge: 'Mini-Job abgeschlossen',
      title: 'Solution Snapshot',
      subtitle: 'Halten Sie Problem, Vorschlag der Kandidatin oder des Kandidaten und Ergebnis in einem kurzen Artefakt fest.',
      context: 'Dialog mit {{candidate}} für {{job}}',
      candidate: 'Kandidat:in',
      role: 'Rolle',
      problem: 'Problem',
      problemPlaceholder: 'Zum Beispiel: Das Support-Team kam mit Onboarding-Fragen nicht hinterher.',
      solution: 'Lösung',
      solutionPlaceholder: 'Zum Beispiel: Die Person schlug eine klarere FAQ-Struktur, einen Flow und leichte Automatisierung vor.',
      result: 'Ergebnis',
      resultPlaceholder: 'Zum Beispiel: Die Zahl der Onboarding-Tickets sank innerhalb von zwei Wochen um 35 %.',
      problemTags: 'Problem-Tags',
      problemTagsPlaceholder: 'z. B. onboarding, support, workflow',
      solutionTags: 'Lösungs-Tags',
      solutionTagsPlaceholder: 'z. B. faq, automation, analytics',
      cancel: 'Abbrechen',
      saving: 'Speichert...',
      save: 'Snapshot speichern'
    },
    pl: {
      required: 'Uzupełnij problem, rozwiązanie i rezultat.',
      badge: 'Mini wyzwanie ukończone',
      title: 'Solution snapshot',
      subtitle: 'Zapisz problem, propozycję kandydata i rezultat w jednym krótkim artefakcie.',
      context: 'Dialog z {{candidate}} dla {{job}}',
      candidate: 'Kandydat',
      role: 'Rola',
      problem: 'Problem',
      problemPlaceholder: 'Na przykład: zespół supportu nie nadążał z pytaniami onboardingowymi.',
      solution: 'Rozwiązanie',
      solutionPlaceholder: 'Na przykład: kandydat zaproponował lepszą strukturę FAQ, flow i lekką automatyzację.',
      result: 'Rezultat',
      resultPlaceholder: 'Na przykład: liczba ticketów onboardingowych spadła o 35% w ciągu dwóch tygodni.',
      problemTags: 'Tagi problemu',
      problemTagsPlaceholder: 'np. onboarding, support, workflow',
      solutionTags: 'Tagi rozwiązania',
      solutionTagsPlaceholder: 'np. faq, automatyzacja, analityka',
      cancel: 'Anuluj',
      saving: 'Zapisywanie...',
      save: 'Zapisz snapshot'
    },
    en: {
      required: 'Please complete problem, solution, and result.',
      badge: 'Micro job complete',
      title: 'Solution snapshot',
      subtitle: 'Capture the problem, what the candidate proposed, and the result in one short artifact.',
      context: 'Dialogue with {{candidate}} for {{job}}',
      candidate: 'Candidate',
      role: 'Role',
      problem: 'Problem',
      problemPlaceholder: 'For example: the support team could not keep up with onboarding questions.',
      solution: 'Solution',
      solutionPlaceholder: 'For example: the candidate proposed a clearer FAQ map, flow, and light automation.',
      result: 'Result',
      resultPlaceholder: 'For example: onboarding tickets dropped by 35% within two weeks.',
      problemTags: 'Problem tags',
      problemTagsPlaceholder: 'for example onboarding, support, workflow',
      solutionTags: 'Solution tags',
      solutionTagsPlaceholder: 'for example faq, automation, analytics',
      cancel: 'Cancel',
      saving: 'Saving...',
      save: 'Save snapshot'
    }
  } as const)[uiLocale];
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
      setError(t('company.solution_snapshot.required', { defaultValue: copy.required }));
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
              {t('company.solution_snapshot.badge', { defaultValue: copy.badge })}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">
                {t('company.solution_snapshot.title', { defaultValue: copy.title })}
              </h3>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t('company.solution_snapshot.subtitle', { defaultValue: copy.subtitle })}
              </p>
              {(candidateName || jobTitle) ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('company.solution_snapshot.context', {
                    defaultValue: copy.context,
                    candidate: candidateName || t('company.applications.labels.candidate', { defaultValue: copy.candidate }),
                    job: jobTitle || t('company.dashboard.table.position', { defaultValue: copy.role }),
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('company.solution_snapshot.problem', { defaultValue: copy.problem })}
              </span>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={4}
                className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder={t('company.solution_snapshot.problem_placeholder', { defaultValue: copy.problemPlaceholder })}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('company.solution_snapshot.solution', { defaultValue: copy.solution })}
              </span>
              <textarea
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                rows={4}
                className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder={t('company.solution_snapshot.solution_placeholder', { defaultValue: copy.solutionPlaceholder })}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('company.solution_snapshot.result', { defaultValue: copy.result })}
              </span>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={4}
                className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder={t('company.solution_snapshot.result_placeholder', { defaultValue: copy.resultPlaceholder })}
              />
            </label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t('company.solution_snapshot.problem_tags', { defaultValue: copy.problemTags })}
                </span>
                <input
                  value={problemTags}
                  onChange={(e) => setProblemTags(e.target.value)}
                  className="w-full rounded-[0.95rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={t('company.solution_snapshot.problem_tags_placeholder', { defaultValue: copy.problemTagsPlaceholder })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t('company.solution_snapshot.solution_tags', { defaultValue: copy.solutionTags })}
                </span>
                <input
                  value={solutionTags}
                  onChange={(e) => setSolutionTags(e.target.value)}
                  className="w-full rounded-[0.95rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={t('company.solution_snapshot.solution_tags_placeholder', { defaultValue: copy.solutionTagsPlaceholder })}
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
              {t('common.cancel', { defaultValue: copy.cancel })}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="app-button-primary rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? t('company.solution_snapshot.saving', { defaultValue: copy.saving })
                : t('company.solution_snapshot.save', { defaultValue: copy.save })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolutionSnapshotModal;
