import React from 'react';
import { ArrowRight, CheckCircle2, FileText, Loader2, Sparkles, Upload, UserRound } from 'lucide-react';

import type { CVDocument, UserProfile } from '../../types';
import ApiService from '../../services/apiService';
import { cn } from '../cn';
import { primaryButtonClass, secondaryButtonClass, shellPageClass } from '../ui/shellStyles';

type WizardStep = 'story' | 'cv' | 'review';
type ReviewSection = 'identity' | 'headline' | 'skills' | 'workHistory' | 'education' | 'languages' | 'summary';

const questions = [
  {
    id: 'work_direction',
    label: 'Jaký typ práce teď hledáš?',
    placeholder: 'Např. produktová práce, operations, technická role, práce s lidmi...',
  },
  {
    id: 'energy',
    label: 'Co ti v práci dodává energii a co tě naopak brzdí?',
    placeholder: 'Popiš prostředí, tempo, odpovědnost, tým nebo typ úkolů.',
  },
  {
    id: 'proof',
    label: 'Na jakou zkušenost nebo výsledek jsi pyšný/á?',
    placeholder: 'Stačí konkrétní situace, projekt nebo problém, který jsi vyřešil/a.',
  },
] as const;

const listText = (items?: string[]) => (items || []).filter(Boolean).join(', ');

const defaultSelectedSections: Record<ReviewSection, boolean> = {
  identity: true,
  headline: true,
  skills: true,
  workHistory: true,
  education: true,
  languages: true,
  summary: true,
};

export const CandidateOnboardingWizard: React.FC<{
  userProfile: UserProfile;
  activeCvDocument: CVDocument | null;
  cvDocuments: CVDocument[];
  cvBusy: boolean;
  onOpenAuth: () => void;
  onUploadCv: (file: File) => Promise<void>;
  onSaveProfile: (updates?: Partial<UserProfile>) => void | Promise<void>;
  setUserProfile: (updates: Partial<UserProfile>) => void;
  navigate: (path: string) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({
  userProfile,
  activeCvDocument,
  cvDocuments,
  cvBusy,
  onOpenAuth,
  onUploadCv,
  onSaveProfile,
  setUserProfile,
  navigate,
  t,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const onboarding = (userProfile.preferences?.candidate_onboarding_v2 || {}) as Record<string, any>;
  const initialStep: WizardStep =
    onboarding.profile_review_completed_at
      ? 'review'
      : onboarding.cv_step_skipped_at || cvDocuments.length
        ? 'review'
        : onboarding.completed_at
          ? 'cv'
          : 'story';
  const [step, setStep] = React.useState<WizardStep>(initialStep);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [selectedSections, setSelectedSections] = React.useState<Record<ReviewSection, boolean>>(defaultSelectedSections);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const getBasePreferences = React.useCallback((): UserProfile['preferences'] => ({
    workLifeBalance: userProfile.preferences?.workLifeBalance ?? 50,
    financialGoals: userProfile.preferences?.financialGoals ?? 50,
    commuteTolerance: userProfile.preferences?.commuteTolerance ?? 45,
    priorities: userProfile.preferences?.priorities ?? [],
    ...(userProfile.preferences || {}),
  }), [userProfile.preferences]);

  const parsed = activeCvDocument?.parsedData || {};
  const hasParsedCv = Boolean(parsed.name || parsed.jobTitle || parsed.skills?.length || parsed.cvAiText);

  const persistFlowStep = async (flowStep: string, extra: Record<string, unknown> = {}) => {
    const preferences: UserProfile['preferences'] = {
      ...getBasePreferences(),
      candidate_onboarding_v2: {
        ...(userProfile.preferences?.candidate_onboarding_v2 || {}),
        flow_step: flowStep,
        ...extra,
      },
    };
    setUserProfile({ preferences });
    await onSaveProfile({ preferences });
  };

  const completeStory = async () => {
    setBusy(true);
    setError('');
    try {
      const steps = questions.map((question) => ({
        id: question.id,
        text: answers[question.id]?.trim() || '',
      })).filter((item) => item.text.length >= 8);
      if (steps.length < 2) {
        setError(t('rebuild.onboarding.answer_more', { defaultValue: 'Vyplň prosím alespoň dvě odpovědi, ať má profil z čeho vycházet.' }));
        return;
      }
      const response = await ApiService.post<any>('/candidate/ritual/complete', {
        steps,
        language: userProfile.preferredLocale || 'cs',
      });
      const profileUpdates = response?.profile_updates || {};
      const basePreferences = getBasePreferences();
      setUserProfile({
        ...(profileUpdates || {}),
        preferences: {
          ...basePreferences,
          ...(profileUpdates.preferences || {}),
          candidate_onboarding_v2: {
            ...(userProfile.preferences?.candidate_onboarding_v2 || {}),
            ...(profileUpdates.preferences?.candidate_onboarding_v2 || {}),
            completed_at: new Date().toISOString(),
            flow_step: 'cv',
          },
        },
      });
      setStep('cv');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rebuild.onboarding.failed', { defaultValue: 'Onboarding se nepodařilo dokončit.' }));
    } finally {
      setBusy(false);
    }
  };

  const skipCv = async () => {
    setBusy(true);
    try {
      await persistFlowStep('review', { cv_step_skipped_at: new Date().toISOString() });
      setStep('review');
    } finally {
      setBusy(false);
    }
  };

  const uploadCv = async (file: File | null) => {
    if (!file) return;
    setError('');
    await onUploadCv(file);
    await persistFlowStep('review');
    setStep('review');
  };

  const finishProfile = async () => {
    setBusy(true);
    setError('');
    try {
      const basePreferences = getBasePreferences();
      const completedAt = userProfile.preferences?.candidate_onboarding_v2?.completed_at || new Date().toISOString();
      const updates: Partial<UserProfile> = {
        preferences: {
          ...basePreferences,
          candidate_onboarding_v2: {
            ...(userProfile.preferences?.candidate_onboarding_v2 || {}),
            completed_at: completedAt,
            flow_step: 'complete',
            profile_review_completed_at: new Date().toISOString(),
          },
        },
      };
      if (selectedSections.identity) {
        updates.name = parsed.name || userProfile.name;
        updates.phone = parsed.phone || userProfile.phone;
      }
      if (selectedSections.headline) updates.jobTitle = parsed.jobTitle || userProfile.jobTitle;
      if (selectedSections.skills) updates.skills = parsed.skills?.length ? parsed.skills : userProfile.skills;
      if (selectedSections.workHistory) updates.workHistory = parsed.workHistory?.length ? parsed.workHistory : userProfile.workHistory;
      if (selectedSections.education) updates.education = parsed.education?.length ? parsed.education : userProfile.education;
      if (selectedSections.languages) updates.languages = parsed.languages?.length ? parsed.languages : userProfile.languages;
      if (selectedSections.summary) {
        updates.cvText = parsed.cvText || userProfile.cvText;
        updates.cvAiText = parsed.cvAiText || userProfile.cvAiText;
      }
      await onSaveProfile(updates);
      setUserProfile(updates);
      navigate('/candidate/insights');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rebuild.onboarding.profile_save_failed', { defaultValue: 'Profil se nepodařilo uložit.' }));
    } finally {
      setBusy(false);
    }
  };

  if (!userProfile.isLoggedIn) {
    return (
      <div className={shellPageClass}>
        <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-5">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f95ac] text-white"><UserRound size={21} /></div>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal text-slate-950">{t('rebuild.onboarding.signin_title', { defaultValue: 'Nejdřív vytvoříme účet.' })}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{t('rebuild.onboarding.signin_copy', { defaultValue: 'Pak tě provedeme onboardingem, volitelným CV a kontrolou profilu.' })}</p>
            <button type="button" onClick={onOpenAuth} className={cn(primaryButtonClass, 'mt-6')}>{t('rebuild.onboarding.signin_cta', { defaultValue: 'Pokračovat registrací' })}</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={shellPageClass}>
      <section className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f95ac]">{t('rebuild.onboarding.eyebrow', { defaultValue: 'Kandidátský onboarding' })}</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{t('rebuild.onboarding.title', { defaultValue: 'Postavíme profil bez ručního vyplňování.' })}</h1>
          </div>
          <div className="flex gap-2 text-xs font-semibold text-slate-500">
            {['story', 'cv', 'review'].map((item, index) => (
              <span key={item} className={cn('rounded-full border px-3 py-1', item === step ? 'border-[#0f95ac] bg-[#0f95ac]/10 text-[#0f7283]' : 'border-slate-200 bg-white')}>
                {index + 1}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          {step === 'story' ? (
            <div>
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-[#0f95ac]" />
                <h2 className="text-xl font-semibold text-slate-950">{t('rebuild.onboarding.story_title', { defaultValue: 'Nejdřív pracovní směr.' })}</h2>
              </div>
              <div className="mt-5 grid gap-4">
                {questions.map((question) => (
                  <label key={question.id} className="block">
                    <span className="text-sm font-semibold text-slate-800">{question.label}</span>
                    <textarea
                      value={answers[question.id] || ''}
                      onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                      placeholder={question.placeholder}
                      className="mt-2 min-h-[6.5rem] w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-[#0f95ac] focus:bg-white"
                    />
                  </label>
                ))}
              </div>
              <button type="button" disabled={busy} onClick={() => void completeStory()} className={cn(primaryButtonClass, 'mt-6')}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {t('rebuild.onboarding.story_cta', { defaultValue: 'Vyhodnotit onboarding' })}
              </button>
            </div>
          ) : null}

          {step === 'cv' ? (
            <div>
              <div className="flex items-center gap-3">
                <Upload size={20} className="text-[#0f95ac]" />
                <h2 className="text-xl font-semibold text-slate-950">{t('rebuild.onboarding.cv_title', { defaultValue: 'Volitelně nahraj CV.' })}</h2>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{t('rebuild.onboarding.cv_copy', { defaultValue: 'AI z něj vytáhne zkušenosti, dovednosti, vzdělání a kontaktní údaje. Před uložením vše zkontroluješ.' })}</p>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => void uploadCv(event.target.files?.[0] || null)} />
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" disabled={cvBusy || busy} onClick={() => fileInputRef.current?.click()} className={primaryButtonClass}>
                  {cvBusy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  {t('rebuild.onboarding.cv_upload', { defaultValue: 'Nahrát CV' })}
                </button>
                <button type="button" disabled={busy} onClick={() => void skipCv()} className={secondaryButtonClass}>
                  {t('rebuild.onboarding.cv_skip', { defaultValue: 'Přeskočit a pokračovat' })}
                </button>
              </div>
            </div>
          ) : null}

          {step === 'review' ? (
            <div>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-[#0f95ac]" />
                <h2 className="text-xl font-semibold text-slate-950">{t('rebuild.onboarding.review_title', { defaultValue: 'Zkontroluj profil.' })}</h2>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <ReviewSectionToggle
                  checked={selectedSections.identity}
                  label={t('rebuild.onboarding.review_identity', { defaultValue: 'Jméno a kontakt' })}
                  value={[parsed.name || userProfile.name, parsed.phone || userProfile.phone].filter(Boolean).join(' · ')}
                  onChange={(checked) => setSelectedSections((current) => ({ ...current, identity: checked }))}
                />
                <ReviewSectionToggle
                  checked={selectedSections.headline}
                  label={t('rebuild.profile.job_title', { defaultValue: 'Role' })}
                  value={parsed.jobTitle || userProfile.jobTitle}
                  onChange={(checked) => setSelectedSections((current) => ({ ...current, headline: checked }))}
                />
                <ReviewSectionToggle
                  checked={selectedSections.skills}
                  label={t('rebuild.profile.skills', { defaultValue: 'Dovednosti' })}
                  value={listText(parsed.skills || userProfile.skills)}
                  onChange={(checked) => setSelectedSections((current) => ({ ...current, skills: checked }))}
                />
                <ReviewSectionToggle
                  checked={selectedSections.workHistory}
                  label={t('rebuild.profile.experience', { defaultValue: 'Zkušenosti' })}
                  value={(parsed.workHistory || userProfile.workHistory || []).map((item: any) => [item.role, item.company].filter(Boolean).join(' @ ')).filter(Boolean).slice(0, 3).join(', ')}
                  onChange={(checked) => setSelectedSections((current) => ({ ...current, workHistory: checked }))}
                />
                <ReviewSectionToggle
                  checked={selectedSections.education}
                  label={t('rebuild.profile.education', { defaultValue: 'Vzdělání' })}
                  value={(parsed.education || userProfile.education || []).map((item: any) => [item.degree, item.school].filter(Boolean).join(' · ')).filter(Boolean).slice(0, 3).join(', ')}
                  onChange={(checked) => setSelectedSections((current) => ({ ...current, education: checked }))}
                />
                <ReviewSectionToggle
                  checked={selectedSections.languages}
                  label={t('rebuild.profile.languages', { defaultValue: 'Jazyky' })}
                  value={(parsed.languages || userProfile.languages || []).map((item: any) => item.label || item.name).filter(Boolean).slice(0, 5).join(', ')}
                  onChange={(checked) => setSelectedSections((current) => ({ ...current, languages: checked }))}
                />
              </div>
              <label className="mt-4 block rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.summary}
                    onChange={(event) => setSelectedSections((current) => ({ ...current, summary: event.target.checked }))}
                    className="h-4 w-4 accent-[#0f95ac]"
                  />
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{hasParsedCv ? t('rebuild.onboarding.ai_summary', { defaultValue: 'AI shrnutí z CV' }) : t('rebuild.onboarding.no_cv_summary', { defaultValue: 'Profil bez CV' })}</div>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-700">{parsed.cvAiText || userProfile.cvAiText || userProfile.story || t('rebuild.onboarding.no_cv_summary_copy', { defaultValue: 'CV můžeš doplnit později v profilu. Zatím použijeme odpovědi z onboardingu.' })}</p>
              </label>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={() => void finishProfile()} className={primaryButtonClass}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {t('rebuild.onboarding.finish', { defaultValue: 'Dokončit profil' })}
                </button>
                <button type="button" onClick={() => setStep('cv')} className={secondaryButtonClass}>{t('rebuild.onboarding.back_to_cv', { defaultValue: 'Nahrát jiné CV' })}</button>
              </div>
            </div>
          ) : null}

          {error ? <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
        </div>
      </section>
    </div>
  );
};

const ReviewSectionToggle: React.FC<{ label: string; value?: string | null; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, value, checked, onChange }) => (
  <label className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#0f95ac]" />
    <span>
      <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="mt-1 block min-h-5 break-words text-sm font-semibold text-slate-900">{value || 'Doplnit později'}</span>
    </span>
  </label>
);
