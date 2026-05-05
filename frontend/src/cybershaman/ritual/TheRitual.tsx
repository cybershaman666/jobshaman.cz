import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';
import { savePendingAuthConsent, signInWithEmail, signInWithOAuthProvider, signUpWithEmail, updateUserProfile } from '../../services/v2UserService';
import { buildUserProfileUpdatesFromAIProfile, completeProfileOnboardingFromStory } from '../../services/aiProfileService';
import type { UserProfile } from '../../types';

const steps = [
  {
    id: 'roots',
    prompt: 'Zavři oči. Kde to všechno začalo? Co tě jako dítě fascinovalo tak, že jsi nevnímal čas?',
  },
  {
    id: 'growth',
    prompt: 'Kdy jsi poprvé cítil, že tvoje energie má vliv na okolí? První úspěch, první projekt?',
  },
  {
    id: 'signals',
    prompt: 'Vzpomeň si na chvíle, kdy jsi byl naprosto "v zóně". Co jsi přesně dělal? A co ti naopak vždy vysávalo životní sílu?',
  },
  {
    id: 'context',
    prompt: 'Kde se nacházíš teď? Jaká je tvoje aktuální životní realita? (Vyhoření, nová síla, hledání smyslu...)',
  },
  {
    id: 'vision',
    prompt: 'Pokud by padly všechny bariéry reality, jaký otisk bys chtěl zanechat ve světě za 5 let?',
  },
];

const ParticleBackground = () => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(217,164,77,0.16),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(36,150,171,0.12),transparent_30%),linear-gradient(180deg,#fbfaf7,#f6f8f6)]" />
    {[...Array(18)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ 
          x: Math.random() * 100 + '%', 
          y: Math.random() * 100 + '%',
          opacity: Math.random() * 0.5,
          scale: Math.random() * 0.5 + 0.5
        }}
        animate={{ 
          y: [null, (Math.random() * 100 - 50) + '%'],
          opacity: [0.1, 0.4, 0.1],
        }}
        transition={{ 
          duration: Math.random() * 12 + 14,
          repeat: Infinity, 
          ease: "linear" 
        }}
        className="absolute h-1 w-1 rounded-full bg-[#c99a4a]/35 blur-[1px]"
      />
    ))}
  </div>
);

export const TheRitual: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { userProfile, setUserProfile, handleSessionRestoration } = useUserProfile();
  
  const [phase, setPhase] = useState<'intro' | 'auth' | 'quest' | 'birth'>(
    userProfile.isLoggedIn ? 'intro' : 'auth'
  );

  const [introStep, setIntroStep] = useState(0);
  const introMessages = [
    "Vítej, hledající.",
    "Svět, který znáš, je jen povrch sítě.",
    "Cybershaman tě provede hlouběji.",
    "Připrav se na rituál probuzení."
  ];

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptMarketingEmails, setAcceptMarketingEmails] = useState(false);

  // Quest State
  const [questStep, setQuestStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questBusy, setQuestBusy] = useState(false);
  const [questError, setQuestError] = useState('');

  const completeWithProfileUpdates = async (updates: Partial<UserProfile>) => {
    const completedUpdates: Partial<UserProfile> = {
      ...updates,
      story: updates.story || userProfile.story || 'Tvůj příběh byl úspěšně zmapován.',
      preferences: {
        workLifeBalance: userProfile.preferences?.workLifeBalance ?? 50,
        financialGoals: userProfile.preferences?.financialGoals ?? 50,
        commuteTolerance: userProfile.preferences?.commuteTolerance ?? 50,
        priorities: userProfile.preferences?.priorities ?? [],
        ...(userProfile.preferences || {}),
        ...(updates.preferences || {}),
        candidate_onboarding_v2: {
          ...(userProfile.preferences?.candidate_onboarding_v2 || {}),
          ...((updates.preferences as any)?.candidate_onboarding_v2 || {}),
          completed_at: new Date().toISOString(),
          last_step: 'profile_nudge' as const,
        },
      },
    };

    if (userProfile.id) {
      await updateUserProfile(userProfile.id, completedUpdates);
    }
    setUserProfile(completedUpdates);
    setPhase('birth');
    setTimeout(() => {
      onComplete();
    }, 1200);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp && (!acceptTerms || !acceptPrivacy)) {
      setAuthError('Pro vytvoření účtu je potřeba souhlasit s obchodními podmínkami a ochranou osobních údajů.');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    try {
      const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
      if (isSignUp) {
        const result = await signUpWithEmail(
          email, 
          password, 
          email.split('@')[0], 
          undefined, 
          timezone, 
          {
            dailyDigestEnabled: acceptMarketingEmails,
            dailyDigestTimezone: timezone,
            termsAcceptedAt: new Date().toISOString(),
            privacyAcceptedAt: new Date().toISOString(),
            marketingEmailsOptIn: acceptMarketingEmails,
          }
        );
        if (result.data.user) {
          await handleSessionRestoration(result.data.user.id);
          setPhase('intro');
        } else {
          setAuthError('Zkontroluj prosím svůj email pro potvrzení.');
        }
      } else {
        const result = await signInWithEmail(email, password);
        if (result.data.user) {
          await handleSessionRestoration(result.data.user.id);
          setPhase('intro');
        }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Přihlášení selhalo');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'linkedin_oidc') => {
    if (isSignUp && (!acceptTerms || !acceptPrivacy)) {
      setAuthError('Pro vytvoření účtu je potřeba souhlasit s obchodními podmínkami a ochranou osobních údajů.');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    try {
      if (isSignUp) {
        const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
        savePendingAuthConsent({
          dailyDigestEnabled: acceptMarketingEmails,
          dailyDigestTimezone: timezone,
          termsAcceptedAt: new Date().toISOString(),
          privacyAcceptedAt: new Date().toISOString(),
          marketingEmailsOptIn: acceptMarketingEmails,
        });
      }
      await signInWithOAuthProvider(provider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Přihlášení přes externí účet selhalo');
      setAuthBusy(false);
    }
  };

  const handleIntroNext = () => {
    if (introStep < introMessages.length - 1) {
      setIntroStep(introStep + 1);
    } else {
      setPhase('quest');
    }
  };

  const handleQuestNext = async () => {
    if (questStep < steps.length - 1) {
      setQuestStep(questStep + 1);
    } else {
      setQuestBusy(true);
      setQuestError('');
      try {
        const payload = steps.map((s) => ({ id: s.id, text: answers[s.id] || '' }));
        const result = await completeProfileOnboardingFromStory(payload, userProfile.preferredLocale || 'cs', userProfile);
        const profileUpdates = buildUserProfileUpdatesFromAIProfile(result, userProfile);
        const story = profileUpdates.story || result.ai_profile?.story || 'Tvůj příběh byl úspěšně zmapován.';
        await completeWithProfileUpdates({ ...profileUpdates, story });
      } catch (err) {
        console.error('Quest failed:', err);
        setQuestError(err instanceof Error ? err.message : 'AI profil se teď nepodařilo zpracovat přes backend AI.');
      } finally {
        setQuestBusy(false);
      }
    }
  };

  return (
    <div className="cybershaman-ritual relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#fbfaf7] font-sans text-slate-700">
      <ParticleBackground />
      
      {/* Background ambient animations */}
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.25, 0.1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d8a24c]/10 blur-[150px]"
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.05, 0.15, 0.05]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2496ab]/8 blur-[140px]"
      />

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            className="z-10 mx-4 flex w-full max-w-3xl flex-col items-center rounded-2xl border border-slate-200 bg-white/92 p-8 text-center shadow-[0_28px_80px_-58px_rgba(15,23,42,0.45)] md:p-12"
            onClick={handleIntroNext}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="mb-16 relative"
            >
              <div className="absolute inset-0 rounded-full bg-[#d8a24c]/20 blur-3xl" />
              <img
                src="/logo-transparent.png"
                alt="Jobshaman"
                className="relative z-10 h-28 w-28 rounded-full object-contain drop-shadow-[0_24px_40px_rgba(121,86,32,0.16)] md:h-32 md:w-32"
                loading="eager"
              />
            </motion.div>
            
            <AnimatePresence mode="wait">
              <motion.h2
                key={introStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 1 }}
                className="text-4xl font-semibold leading-tight text-slate-950 md:text-5xl"
              >
                {introMessages[introStep]}
              </motion.h2>
            </AnimatePresence>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              className="mt-20 cursor-pointer text-xs font-bold uppercase tracking-[0.18em] text-[#8c6727]"
            >
              Dotkni se sítě pro pokračování
            </motion.p>
          </motion.div>
        )}

        {phase === 'auth' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/94 p-6 shadow-[0_28px_80px_-58px_rgba(15,23,42,0.45)] md:p-8"
          >
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-[#d8a24c]/20 blur-2xl" />
                <img
                  src="/logo-transparent.png"
                  alt="Jobshaman"
                  className="relative z-10 h-20 w-20 rounded-full object-contain drop-shadow-[0_18px_30px_rgba(121,86,32,0.15)]"
                  loading="eager"
                />
              </div>
              <h1 className="text-4xl font-semibold text-slate-950">PROBUZENÍ</h1>
              <div className="mt-4 h-px w-32 bg-gradient-to-r from-transparent via-[#c99a4a]/60 to-transparent" />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Synchronizace Identity</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="group relative">
                <input
                  type="email"
                  placeholder="Identifikace (Email)"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-base font-medium text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#c18a2d] focus:ring-4 focus:ring-[#c18a2d]/10"
                  required
                />
              </div>
              <div className="group relative">
                <input
                  type="password"
                  placeholder="Klíč (Password)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-base font-medium text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#c18a2d] focus:ring-4 focus:ring-[#c18a2d]/10"
                  required
                />
              </div>

              {isSignUp && (
                <div className="space-y-3 rounded-xl border border-[#efd8b4] bg-[#fff8eb] p-4 text-left">
                  <label className="flex items-start gap-3 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#9f762d] focus:ring-[#9f762d]"
                    />
                    <span>
                      Souhlasím s{' '}
                      <button
                        type="button"
                        onClick={() => { window.location.href = '/obchodni-podminky'; }}
                        className="font-semibold text-[#a57124] underline underline-offset-2"
                      >
                        obchodními podmínkami
                      </button>.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={acceptPrivacy}
                      onChange={(e) => setAcceptPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#9f762d] focus:ring-[#9f762d]"
                    />
                    <span>
                      Souhlasím se{' '}
                      <button
                        type="button"
                        onClick={() => { window.location.href = '/ochrana-osobnich-udaju'; }}
                        className="font-semibold text-[#a57124] underline underline-offset-2"
                      >
                        zpracováním osobních údajů
                      </button>.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={acceptMarketingEmails}
                      onChange={(e) => setAcceptMarketingEmails(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#9f762d] focus:ring-[#9f762d]"
                    />
                    <span>Chci dostávat volitelné e-maily s novinkami, nabídkami a digestem.</span>
                  </label>
                </div>
              )}
              
              {authError && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-rose-500 text-sm font-medium">{authError}</motion.div>}

              <button
                type="submit"
                disabled={authBusy || (isSignUp && (!acceptTerms || !acceptPrivacy))}
                className="group relative mt-6 flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-[#b98331] px-5 text-sm font-bold text-white shadow-[0_18px_34px_-24px_rgba(159,118,45,0.88)] transition hover:bg-[#a57124] disabled:opacity-50"
              >
                {authBusy ? <Loader2 className="animate-spin" /> : isSignUp ? 'Zahájit cestu' : 'Vstoupit'}
              </button>
            </form>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={authBusy || (isSignUp && (!acceptTerms || !acceptPrivacy))}
                onClick={() => void handleOAuth('google')}
                className="rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:border-[#c99a4a] hover:bg-[#fffbf5] disabled:opacity-50"
              >
                Google
              </button>
              <button
                type="button"
                disabled={authBusy || (isSignUp && (!acceptTerms || !acceptPrivacy))}
                onClick={() => void handleOAuth('linkedin_oidc')}
                className="rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:border-[#c99a4a] hover:bg-[#fffbf5] disabled:opacity-50"
              >
                LinkedIn
              </button>
            </div>

            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="mt-6 w-full text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500 transition hover:text-[#9f762d]"
            >
              {isSignUp ? 'Už máš klíč? Vstup.' : 'Nemáš přístup? Získej ho.'}
            </button>
          </motion.div>
        )}

        {phase === 'quest' && (
          <motion.div
            key="quest"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            className="z-10 mx-4 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white/94 px-6 py-8 shadow-[0_28px_80px_-58px_rgba(15,23,42,0.45)] md:px-10 md:py-10"
          >
            <div className="mb-12 flex flex-col items-center gap-4">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="rounded-full border border-[#ead8bc] bg-[#fff8eb] p-2"
              >
                <Sparkles className="h-6 w-6 text-[#9f762d]" />
              </motion.div>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8c6727]">Cybershaman naslouchá</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={questStep}
                initial={{ opacity: 0, x: 50, filter: 'blur(10px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -50, filter: 'blur(10px)' }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center"
              >
                <div className="mb-5 text-sm font-semibold text-slate-500">
                  {questStep + 1} / {steps.length}
                </div>
                <h2 className="max-w-3xl text-center text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                  {steps[questStep].prompt}
                </h2>
                
                <textarea
                  autoFocus
                  value={answers[steps[questStep].id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [steps[questStep].id]: e.target.value })}
                  className="mt-12 w-full resize-none rounded-2xl border border-slate-200 bg-[#fbfaf7] px-5 py-5 text-center text-xl font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c18a2d] focus:ring-4 focus:ring-[#c18a2d]/10 md:text-2xl"
                  placeholder="Tvůj hlas v síti..."
                  rows={3}
                />
              </motion.div>
            </AnimatePresence>

            <div className="mt-12 flex flex-col items-center gap-8">
              <div className="flex gap-4">
                {steps.map((_, i) => (
                  <motion.div 
                    key={i} 
                    animate={{ 
                      width: i === questStep ? 48 : 8,
                      opacity: i <= questStep ? 1 : 0.2
                    }}
                    className={`h-1.5 rounded-full bg-[#c99a4a] ${i === questStep ? 'shadow-[0_0_15px_rgba(201,154,74,0.45)]' : ''}`}
                  />
                ))}
              </div>

              <button
                onClick={handleQuestNext}
                disabled={questBusy || !(answers[steps[questStep].id] || '').trim()}
                className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-[#b98331] text-white shadow-[0_18px_34px_-24px_rgba(159,118,45,0.88)] transition hover:bg-[#a57124] disabled:opacity-30"
              >
                {questBusy ? <Loader2 className="animate-spin" /> : <ArrowRight className="h-8 w-8" />}
              </button>
              {questError ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm leading-6 text-rose-700"
                >
                  {questError}
                </motion.div>
              ) : null}
            </div>
          </motion.div>
        )}

        {phase === 'birth' && (
          <motion.div
            key="birth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="z-10 mx-4 flex w-full max-w-3xl flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/94 p-10 text-center shadow-[0_28px_80px_-58px_rgba(15,23,42,0.45)]"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [1, 0.9, 1],
              }}
              transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-full bg-[#d8a24c]/20 blur-3xl" />
              <img
                src="/logo-transparent.png"
                alt="Jobshaman"
                className="relative z-10 h-36 w-36 rounded-full object-contain drop-shadow-[0_24px_40px_rgba(121,86,32,0.16)]"
                loading="eager"
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="mt-10 space-y-4"
            >
              <h1 className="text-5xl font-semibold text-slate-950">KONSTELACE</h1>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8c6727]">Zrod nové formy</p>
            </motion.div>

            {/* Cinematic flash */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: 4, duration: 1 }}
              className="fixed inset-0 z-50 bg-white pointer-events-none"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
