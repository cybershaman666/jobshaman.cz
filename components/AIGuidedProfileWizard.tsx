import React, { useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../types';
import { generateProfileFromStory } from '../services/aiProfileService';

interface AIGuidedProfileWizardProps {
  profile: UserProfile;
  onApply: (updates: Partial<UserProfile>) => void | Promise<void>;
  onClose: () => void;
}

type WizardStep = {
  id: string;
  title: string;
  hint: string;
};

const SPEECH_LANG_BY_LOCALE: Record<string, string> = {
  cs: 'cs-CZ',
  sk: 'sk-SK',
  en: 'en-US',
  de: 'de-DE',
  pl: 'pl-PL',
  at: 'de-AT'
};

const AI_LANG_BY_LOCALE: Record<string, string> = {
  cs: 'cs',
  sk: 'sk',
  en: 'en',
  de: 'de',
  pl: 'pl',
  at: 'de'
};

const listToText = (items?: string[] | string) => {
  if (!items) return '';
  if (Array.isArray(items)) return items.join('\n');
  return String(items);
};
const textToList = (text: string) =>
  text
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

const hasItems = (arr?: any[]) => Array.isArray(arr) && arr.length > 0;

const pickNonEmptyList = (candidate: string[], fallback?: string[]) => {
  return candidate.length > 0 ? candidate : (fallback || []);
};

const buildWhySummary = (t: (key: string, options?: any) => string, result: any, inputSteps: string[]): string[] => {
  const profile = result?.ai_profile || {};
  const updates = result?.profile_updates || {};
  const reasons: string[] = [];

  const inferredSkills = Array.isArray(profile.inferred_skills) ? profile.inferred_skills : [];
  if (inferredSkills.length > 0) {
    reasons.push(t('profile.ai_guide.why.inferred_skills', { count: Math.min(inferredSkills.length, 5) }));
  }
  if (Array.isArray(updates.skills) && updates.skills.length > 0) {
    reasons.push(t('profile.ai_guide.why.skills_normalized'));
  }
  if (Array.isArray(updates.workHistory) && updates.workHistory.length > 0) {
    reasons.push(t('profile.ai_guide.why.work_structured'));
  }
  if (Array.isArray(updates.education) && updates.education.length > 0) {
    reasons.push(t('profile.ai_guide.why.education_normalized'));
  }
  if ((result?.cv_summary || '').trim()) {
    reasons.push(t('profile.ai_guide.why.summary_condensed'));
  }
  if ((result?.cv_ai_text || '').trim()) {
    reasons.push(t('profile.ai_guide.why.cv_fulltext'));
  }
  if (inputSteps.filter(Boolean).length >= 4) {
    reasons.push(t('profile.ai_guide.why.better_with_context'));
  }

  return reasons.slice(0, 6);
};

const AIGuidedProfileWizard: React.FC<AIGuidedProfileWizardProps> = ({
  profile,
  onApply,
  onClose
}) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || i18n.language || 'cs').toLowerCase();
  const localeBase = locale.split('-')[0];
  const localeKey = localeBase === 'de' && locale.includes('at') ? 'at' : localeBase;

  const steps: WizardStep[] = [
    {
      id: 'early_story',
      title: t('profile.ai_guide.steps.early_story.title'),
      hint: t('profile.ai_guide.steps.early_story.hint')
    },
    {
      id: 'activities',
      title: t('profile.ai_guide.steps.activities.title'),
      hint: t('profile.ai_guide.steps.activities.hint')
    },
    {
      id: 'first_work',
      title: t('profile.ai_guide.steps.first_work.title'),
      hint: t('profile.ai_guide.steps.first_work.hint')
    },
    {
      id: 'career_shifts',
      title: t('profile.ai_guide.steps.career_shifts.title'),
      hint: t('profile.ai_guide.steps.career_shifts.hint')
    },
    {
      id: 'projects_impact',
      title: t('profile.ai_guide.steps.projects_impact.title'),
      hint: t('profile.ai_guide.steps.projects_impact.hint')
    },
    {
      id: 'personality_preferences',
      title: t('profile.ai_guide.steps.personality_preferences.title'),
      hint: t('profile.ai_guide.steps.personality_preferences.hint')
    }
  ];

  const reminderItems = t('profile.ai_guide.reminder_items', { returnObjects: true }) as string[];
  const speechLanguage = SPEECH_LANG_BY_LOCALE[localeKey] || 'en-US';
  const aiLanguage = AI_LANG_BY_LOCALE[localeKey] || 'en';

  const [stepIndex, setStepIndex] = useState(0);
  const [stepTexts, setStepTexts] = useState<string[]>(() => steps.map(() => ''));
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any | null>(null);

  const [cvAiText, setCvAiText] = useState('');
  const [cvSummary, setCvSummary] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [storyText, setStoryText] = useState('');
  const [hobbiesText, setHobbiesText] = useState('');
  const [volunteeringText, setVolunteeringText] = useState('');
  const [leadershipText, setLeadershipText] = useState('');
  const [strengthsText, setStrengthsText] = useState('');
  const [valuesText, setValuesText] = useState('');
  const [inferredSkillsText, setInferredSkillsText] = useState('');
  const [awardsText, setAwardsText] = useState('');
  const [certificationsText, setCertificationsText] = useState('');
  const [sideProjectsText, setSideProjectsText] = useState('');
  const [motivationsText, setMotivationsText] = useState('');
  const [workPreferencesText, setWorkPreferencesText] = useState('');

  const recognitionRef = useRef<any>(null);
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const speechAvailable = !!SpeechRecognition;

  const currentStep = steps[stepIndex];
  const hasCurrentInput = stepTexts[stepIndex]?.trim().length > 0;
  const whySummary = aiResult ? buildWhySummary(t, aiResult, stepTexts.map((text) => text.trim()).filter(Boolean)) : [];

  const updateStepText = (value: string) => {
    setStepTexts((prev) => {
      const next = [...prev];
      next[stepIndex] = value;
      return next;
    });
  };

  const startListening = () => {
    if (!speechAvailable || isListening) return;
    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
        }
      }
      if (finalText) {
        setStepTexts((prev) => {
          const next = [...prev];
          const current = next[stepIndex] || '';
          next[stepIndex] = `${current} ${finalText.trim()}`.trim();
          return next;
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleClose = () => {
    stopListening();
    onClose();
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const stepsPayload = steps.map((s, index) => ({
        id: s.id,
        text: stepTexts[index] || ''
      })).filter(step => step.text.trim().length > 0);

      if (stepsPayload.length === 0) {
        throw new Error(t('profile.ai_guide.errors.fill_one_step'));
      }

      const data = await generateProfileFromStory(stepsPayload, aiLanguage, profile);
      setAiResult(data);

      const aiProfile = data.ai_profile || {};
      setCvAiText(data.cv_ai_text || '');
      setCvSummary(data.cv_summary || '');
      setJobTitle(data.profile_updates?.jobTitle || profile.jobTitle || '');
      setSkillsText(listToText(data.profile_updates?.skills || profile.skills || []));
      setStoryText(aiProfile.story || '');
      setHobbiesText(listToText(aiProfile.hobbies || []));
      setVolunteeringText(listToText(aiProfile.volunteering || []));
      setLeadershipText(listToText(aiProfile.leadership || []));
      setStrengthsText(listToText(aiProfile.strengths || []));
      setValuesText(listToText(aiProfile.values || []));
      setInferredSkillsText(listToText(aiProfile.inferred_skills || []));
      setAwardsText(listToText(aiProfile.awards || []));
      setCertificationsText(listToText(aiProfile.certifications || []));
      setSideProjectsText(listToText(aiProfile.side_projects || []));
      setMotivationsText(listToText(aiProfile.motivations || []));
      setWorkPreferencesText(listToText(aiProfile.work_preferences || []));
    } catch (e: any) {
      setError(e?.message || t('profile.ai_guide.errors.generate_failed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (isApplying) return;
    const parsedSkills = textToList(skillsText);
    const updates: Partial<UserProfile> = {
      name: aiResult?.profile_updates?.name || profile.name,
      email: aiResult?.profile_updates?.email || profile.email,
      phone: aiResult?.profile_updates?.phone || profile.phone,
      jobTitle,
      skills: pickNonEmptyList(parsedSkills, profile.skills),
      cvText: cvSummary,
      cvAiText,
      story: storyText,
      hobbies: textToList(hobbiesText),
      volunteering: textToList(volunteeringText),
      leadership: textToList(leadershipText),
      strengths: textToList(strengthsText),
      values: textToList(valuesText),
      inferredSkills: textToList(inferredSkillsText),
      awards: textToList(awardsText),
      certifications: textToList(certificationsText),
      sideProjects: textToList(sideProjectsText),
      motivations: textToList(motivationsText),
      workPreferences: textToList(workPreferencesText),
      workHistory: hasItems(aiResult?.profile_updates?.workHistory) ? aiResult.profile_updates.workHistory : (profile.workHistory || []),
      education: hasItems(aiResult?.profile_updates?.education) ? aiResult.profile_updates.education : (profile.education || [])
    };

    try {
      setError(null);
      setIsApplying(true);
      await Promise.resolve(onApply(updates));
    } catch (e: any) {
      setError(e?.message || t('profile.ai_guide.errors.save_failed'));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('profile.ai_guide.title')}</h3>
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!aiResult ? (
          <div className="p-6">
            <div className="mb-4">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                {t('profile.ai_guide.step_progress', { current: stepIndex + 1, total: steps.length })}
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{currentStep.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{currentStep.hint}</p>
              <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-2">
                {t('profile.ai_guide.helper')}
              </p>
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {t('profile.ai_guide.reminder_title')}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {(Array.isArray(reminderItems) ? reminderItems : []).join(' • ')}
              </div>
            </div>

            <textarea
              value={stepTexts[stepIndex]}
              onChange={(e) => updateStepText(e.target.value)}
              rows={6}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t('profile.ai_guide.input_placeholder')}
            />

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                {speechAvailable ? (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${isListening ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isListening ? t('profile.ai_guide.stop') : t('profile.ai_guide.dictate')}
                  </button>
                ) : (
                  <div className="text-xs text-slate-500">{t('profile.ai_guide.speech_unavailable')}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={stepIndex === 0}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                >
                  {t('profile.ai_guide.back')}
                </button>
                {stepIndex < steps.length - 1 ? (
                  <button
                    onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))}
                    className="px-3 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white"
                  >
                    {t('profile.ai_guide.next')}
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white flex items-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {t('profile.ai_guide.generate')}
                  </button>
                )}
              </div>
            </div>

            {!hasCurrentInput && (
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {t('profile.ai_guide.empty_step')}
              </div>
            )}

            {error && <div className="mt-4 text-sm text-rose-600">{error}</div>}
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {whySummary.length > 0 && (
              <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 p-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  {t('profile.ai_guide.why_title')}
                </div>
                <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc pl-5 space-y-1">
                  {whySummary.map((line, idx) => (
                    <li key={`${idx}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.job_title')}</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.skills')}</label>
              <textarea
                rows={3}
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.summary')}</label>
              <textarea
                rows={3}
                value={cvSummary}
                onChange={(e) => setCvSummary(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.cv_ai_text')}</label>
              <textarea
                rows={8}
                value={cvAiText}
                onChange={(e) => setCvAiText(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.story')}</label>
                <textarea
                  rows={4}
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.hobbies')}</label>
                <textarea
                  rows={4}
                  value={hobbiesText}
                  onChange={(e) => setHobbiesText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.volunteering')}</label>
                <textarea
                  rows={3}
                  value={volunteeringText}
                  onChange={(e) => setVolunteeringText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.leadership')}</label>
                <textarea
                  rows={3}
                  value={leadershipText}
                  onChange={(e) => setLeadershipText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.strengths')}</label>
                <textarea
                  rows={3}
                  value={strengthsText}
                  onChange={(e) => setStrengthsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.values')}</label>
                <textarea
                  rows={3}
                  value={valuesText}
                  onChange={(e) => setValuesText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.inferred_skills')}</label>
                <textarea
                  rows={3}
                  value={inferredSkillsText}
                  onChange={(e) => setInferredSkillsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.awards')}</label>
                <textarea
                  rows={3}
                  value={awardsText}
                  onChange={(e) => setAwardsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.certifications')}</label>
                <textarea
                  rows={3}
                  value={certificationsText}
                  onChange={(e) => setCertificationsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.side_projects')}</label>
                <textarea
                  rows={3}
                  value={sideProjectsText}
                  onChange={(e) => setSideProjectsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.motivations')}</label>
                <textarea
                  rows={3}
                  value={motivationsText}
                  onChange={(e) => setMotivationsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.ai_guide.fields.work_preferences')}</label>
                <textarea
                  rows={3}
                  value={workPreferencesText}
                  onChange={(e) => setWorkPreferencesText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setAiResult(null)}
                className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                {t('profile.ai_guide.back_to_edits')}
              </button>
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white disabled:opacity-60"
              >
                {isApplying ? t('profile.ai_guide.saving') : t('profile.ai_guide.save_to_profile')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIGuidedProfileWizard;
