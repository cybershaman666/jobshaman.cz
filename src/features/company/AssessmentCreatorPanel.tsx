import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Briefcase,
  FileText,
  CheckCircle,
  Loader2,
  BrainCircuit,
  Code,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Assessment, CompanyProfile, Job } from '../../../types';
import { generateAssessment, extractSkillsFromJob } from '../../../services/mistralService';
import { getRemainingAssessments } from '../../../services/billingService';

interface AssessmentCreatorPanelProps {
  companyProfile?: CompanyProfile | null;
  jobs?: Job[];
}

// Demo templates — same data as before
const DEMO_TEMPLATES = [
  { id: 'demo-backend-senior', role: 'Senior Backend Engineer', difficulty: 'Senior', skills: 'Python, FastAPI, PostgreSQL, API design, System design' },
  { id: 'demo-cnc-operator', role: 'CNC Operátor', difficulty: 'Medior', skills: 'CNC, Technická dokumentace, Měření, Bezpečnost práce' },
  { id: 'demo-nurse', role: 'Všeobecná sestra', difficulty: 'Medior', skills: 'Klinická péče, Komunikace s pacientem, Triáž, Dokumentace' },
  { id: 'demo-b2b-sales', role: 'B2B Obchodní zástupce', difficulty: 'Senior', skills: 'Prospecting, Vyjednávání, CRM, Obchodní strategie' },
  { id: 'demo-cs-support', role: 'Customer Support Specialist', difficulty: 'Junior', skills: 'Zákaznická komunikace, Empatie, Ticketing, Řešení incidentů' },
];

export const AssessmentCreatorPanel: React.FC<AssessmentCreatorPanelProps> = ({
  companyProfile,
  jobs = [],
}) => {
  const { t } = useTranslation();

  // State
  const [selectedJobId, setSelectedJobId] = useState('');
  const [role, setRole] = useState('');
  const [skills, setSkills] = useState('');
  const [difficulty, setDifficulty] = useState('Medior');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [showDemos, setShowDemos] = useState(false);
  const [remainingAssessments, setRemainingAssessments] = useState<number | null>(null);

  // Load remaining assessments on mount
  React.useEffect(() => {
    if (companyProfile?.id) {
      try {
        const remaining = getRemainingAssessments(companyProfile as any);
        setRemainingAssessments(typeof remaining === 'number' ? remaining : null);
      } catch {
        setRemainingAssessments(null);
      }
    }
  }, [companyProfile?.id]);

  // Auto-fill role and skills when job selected
  const handleJobSelect = async (jobId: string) => {
    setSelectedJobId(jobId);
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setRole(job.title || '');
    if (job.required_skills && job.required_skills.length > 0) {
      setSkills(job.required_skills.join(', '));
    } else {
      // Extract skills via AI
      setIsExtracting(true);
      try {
        const extracted = await extractSkillsFromJob(job.title || '', job.description || '');
        if (extracted.length > 0) {
          setSkills(extracted.join(', '));
        }
      } catch (err) {
        console.warn('Failed to extract skills:', err);
      } finally {
        setIsExtracting(false);
      }
    }
  };

  // Generate assessment
  const handleGenerate = async () => {
    if (!role.trim()) return;

    // Check limits
    if (remainingAssessments !== null && remainingAssessments <= 0) {
      alert(t('assessment_creator.limit_reached', { defaultValue: 'Dosáhli jste limitu assessmentů pro váš plán. Zvyšte plán pro další generování.' }));
      return;
    }

    setIsGenerating(true);
    try {
      const skillsList = skills.split(',').map(s => s.trim()).filter(Boolean);
      const result = await generateAssessment(role, skillsList, difficulty);
      setAssessment(result);

      // Save to Supabase if company profile exists
      if (companyProfile?.id) {
        // Save handled by parent or later step
        setRemainingAssessments(prev => prev !== null ? Math.max(0, prev - 1) : null);
      }
    } catch (err) {
      console.error('Failed to generate assessment:', err);
      alert(t('assessment_creator.generate_error', { defaultValue: 'Nepodařilo se vygenerovat assessment. Zkuste to znovu.' }));
    } finally {
      setIsGenerating(false);
    }
  };

  // Load demo template
  const loadDemo = (template: typeof DEMO_TEMPLATES[0]) => {
    setRole(template.role);
    setSkills(template.skills);
    setDifficulty(template.difficulty);
    setAssessment(null);
    setShowDemos(false);
  };

  const difficultyOptions = [
    { key: 'Junior', label: t('assessment_creator.difficulty_junior', { defaultValue: 'Junior' }) },
    { key: 'Medior', label: t('assessment_creator.difficulty_medior', { defaultValue: 'Medior' }) },
    { key: 'Senior', label: t('assessment_creator.difficulty_senior', { defaultValue: 'Senior' }) },
    { key: 'Expert', label: t('assessment_creator.difficulty_expert', { defaultValue: 'Expert' }) },
  ];

  return (
    <div className="space-y-5">
      {/* Usage Bar */}
      {companyProfile && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit size={16} className="text-[var(--accent)]" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t('assessment_creator.remaining', { defaultValue: 'Zbývající assessmenty' })}:
              </span>
            </div>
            <span className={`text-sm font-bold ${
              remainingAssessments === 0 ? 'text-rose-600' : remainingAssessments !== null && remainingAssessments < 10 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {remainingAssessments !== null ? remainingAssessments : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Demo Assessment Center — Toggleable */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowDemos(!showDemos)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('assessment_creator.demo_toggle', { defaultValue: 'Demo šablony — 5 ukázek napříč rolemi' })}
            </span>
          </div>
          {showDemos ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showDemos && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              {DEMO_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => loadDemo(template)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-left hover:border-[var(--accent)] transition-colors"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] mb-1">
                    {template.difficulty}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    {template.role}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {template.skills.split(', ').slice(0, 3).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('assessment_creator.demo_free', { defaultValue: 'Dostupné i pro Free tier — bez čerpání kreditů.' })}
            </p>
          </div>
        )}
      </div>

      {/* Input Panel */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
          {t('assessment_creator.input_title', { defaultValue: 'Nastavení assessmentu' })}
        </h3>

        <div className="space-y-4">
          {/* Job Selector */}
          {jobs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Briefcase size={14} className="inline mr-1 -mt-0.5" />
                {t('assessment_creator.select_job', { defaultValue: 'Vybrat výzvu' })}
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => handleJobSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">{t('assessment_creator.select_job_placeholder', { defaultValue: 'Nebo vyplňte ručně...' })}</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title || 'Untitled'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('assessment_creator.role', { defaultValue: 'Role / Pozice' })}
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="např. Frontend Developer, Zdravotní sestra..."
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('assessment_creator.skills', { defaultValue: 'Klíčové dovednosti' })}
              {isExtracting && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                  <Loader2 size={12} className="animate-spin" />
                  {t('assessment_creator.extracting', { defaultValue: 'Extrahuji z AI...' })}
                </span>
              )}
            </label>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Python, React, SQL, Projektové řízení..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('assessment_creator.difficulty', { defaultValue: 'Úroveň' })}
            </label>
            <div className="flex gap-2">
              {difficultyOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setDifficulty(opt.key)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    difficulty === opt.key
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !role.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('assessment_creator.generating', { defaultValue: 'Generuji assessment...' })}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {t('assessment_creator.generate', { defaultValue: 'Vygenerovat assessment' })}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Output Panel — Generated Assessment */}
      {assessment && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {assessment.title || assessment.role || t('assessment_creator.generated', { defaultValue: 'Vygenerovaný assessment' })}
                </h3>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {assessment.questions?.length || 0} {t('assessment_creator.questions_count', { defaultValue: 'otázek' })}
              </span>
            </div>
          </div>

          {/* Questions */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
            {(assessment.questions || []).map((q: any, i: number) => {
              const typeIcon = q.type === 'Code' ? Code : q.type === 'Open' ? Lightbulb : q.type === 'Scenario' ? BrainCircuit : FileText;
              const typeColor = q.type === 'Code' ? 'text-violet-500 bg-violet-100 dark:bg-violet-900/30' :
                                q.type === 'Open' ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' :
                                q.type === 'Scenario' ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' :
                                'text-slate-500 bg-slate-100 dark:bg-slate-800';
              return (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${typeColor}`}>
                      {React.createElement(typeIcon, { size: 14 })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {q.question_text || q.question}
                      </p>
                      {q.category && (
                        <span className="inline-block mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {q.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
