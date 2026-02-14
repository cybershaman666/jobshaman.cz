import React, { useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, Loader2, X } from 'lucide-react';
import { UserProfile } from '../types';
import { generateProfileFromStory } from '../services/aiProfileService';

interface AIGuidedProfileWizardProps {
  profile: UserProfile;
  onApply: (updates: Partial<UserProfile>) => void;
  onClose: () => void;
}

type WizardStep = {
  id: string;
  title: string;
  hint: string;
};

const STEPS: WizardStep[] = [
  {
    id: 'story',
    title: 'Kariérní příběh',
    hint: 'Začněte od začátku. Co vás přivedlo k oboru a jak se vyvíjela vaše kariéra?'
  },
  {
    id: 'projects',
    title: 'Projekty a úspěchy',
    hint: 'Popište projekty, na které jste pyšní, a konkrétní výsledky.'
  },
  {
    id: 'hobbies',
    title: 'Koníčky a leadership',
    hint: 'Co děláte ve volném čase? Vedete tým, organizujete akce, trénujete?'
  },
  {
    id: 'volunteering',
    title: 'Dobrovolnictví a ocenění',
    hint: 'Zmiňte dobrovolnické aktivity, ocenění, certifikace.'
  },
  {
    id: 'values',
    title: 'Hodnoty a motivace',
    hint: 'Jaké hodnoty jsou pro vás důležité? Co vás motivuje?'
  },
  {
    id: 'preferences',
    title: 'Preference práce',
    hint: 'Jaké prostředí a typ práce vám sedí? Remote, hybrid, stabilita, růst?'
  }
];

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

const AIGuidedProfileWizard: React.FC<AIGuidedProfileWizardProps> = ({
  profile,
  onApply,
  onClose
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepTexts, setStepTexts] = useState<string[]>(() => STEPS.map(() => ''));
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const currentStep = STEPS[stepIndex];
  const canProceed = stepTexts[stepIndex]?.trim().length > 0;

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
    recognition.lang = 'cs-CZ';
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
      const stepsPayload = STEPS.map((s, index) => ({
        id: s.id,
        text: stepTexts[index] || ''
      }));
      const data = await generateProfileFromStory(stepsPayload, 'cs', profile);
      setAiResult(data);

      const aiProfile = data.aiProfile || {};
      setCvAiText(data.cv_ai_text || '');
      setCvSummary(data.cv_summary || '');
      setJobTitle(data.profileUpdates?.jobTitle || profile.jobTitle || '');
      setSkillsText(listToText(data.profileUpdates?.skills || profile.skills || []));
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
      setError(e?.message || 'AI průvodce selhal. Zkuste to prosím znovu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    const updates: Partial<UserProfile> = {
      name: aiResult?.profileUpdates?.name || profile.name,
      email: aiResult?.profileUpdates?.email || profile.email,
      phone: aiResult?.profileUpdates?.phone || profile.phone,
      jobTitle,
      skills: textToList(skillsText),
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
      workHistory: aiResult?.profileUpdates?.workHistory || profile.workHistory,
      education: aiResult?.profileUpdates?.education || profile.education
    };

    onApply(updates);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">AI Průvodce životopisem</h3>
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!aiResult ? (
          <div className="p-6">
            <div className="mb-4">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Krok {stepIndex + 1} z {STEPS.length}
              </div>
              <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{currentStep.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{currentStep.hint}</p>
            </div>

            <textarea
              value={stepTexts[stepIndex]}
              onChange={(e) => updateStepText(e.target.value)}
              rows={6}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Nadiktujte nebo napište svůj příběh..."
            />

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                {speechAvailable ? (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${isListening ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isListening ? 'Stop' : 'Diktovat'}
                  </button>
                ) : (
                  <div className="text-xs text-slate-500">Diktování není dostupné v tomto prohlížeči.</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={stepIndex === 0}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                >
                  Zpět
                </button>
                {stepIndex < STEPS.length - 1 ? (
                  <button
                    onClick={() => setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1))}
                    disabled={!canProceed}
                    className="px-3 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white disabled:opacity-50"
                  >
                    Další
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white flex items-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Vygenerovat profil a CV
                  </button>
                )}
              </div>
            </div>

            {error && <div className="mt-4 text-sm text-rose-600">{error}</div>}
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Profese / Název pozice</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dovednosti (1 na řádek)</label>
              <textarea
                rows={3}
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Shrnutí (krátké)</label>
              <textarea
                rows={3}
                value={cvSummary}
                onChange={(e) => setCvSummary(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI CV (plný text)</label>
              <textarea
                rows={8}
                value={cvAiText}
                onChange={(e) => setCvAiText(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Příběh</label>
                <textarea
                  rows={4}
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Koníčky</label>
                <textarea
                  rows={4}
                  value={hobbiesText}
                  onChange={(e) => setHobbiesText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dobrovolnictví</label>
                <textarea
                  rows={3}
                  value={volunteeringText}
                  onChange={(e) => setVolunteeringText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Leadership</label>
                <textarea
                  rows={3}
                  value={leadershipText}
                  onChange={(e) => setLeadershipText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Silné stránky</label>
                <textarea
                  rows={3}
                  value={strengthsText}
                  onChange={(e) => setStrengthsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hodnoty</label>
                <textarea
                  rows={3}
                  value={valuesText}
                  onChange={(e) => setValuesText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Skryté dovednosti</label>
                <textarea
                  rows={3}
                  value={inferredSkillsText}
                  onChange={(e) => setInferredSkillsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ocenění</label>
                <textarea
                  rows={3}
                  value={awardsText}
                  onChange={(e) => setAwardsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Certifikace</label>
                <textarea
                  rows={3}
                  value={certificationsText}
                  onChange={(e) => setCertificationsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Side projekty</label>
                <textarea
                  rows={3}
                  value={sideProjectsText}
                  onChange={(e) => setSideProjectsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivace</label>
                <textarea
                  rows={3}
                  value={motivationsText}
                  onChange={(e) => setMotivationsText(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Preference práce</label>
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
                Zpět na úpravy
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white"
              >
                Uložit do profilu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIGuidedProfileWizard;
