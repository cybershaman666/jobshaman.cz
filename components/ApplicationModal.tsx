import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApplicationJcfpmShareLevel, Job, UserProfile, CVDocument } from '../types';
import { X, Upload, FileText, Wand2, CheckCircle, Send, Loader2, BrainCircuit, User, Mail, Phone, Linkedin, Link as LinkIcon, Crown, MessageSquare, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { generateCoverLetter } from '../services/geminiService';
import { sendEmail, EmailTemplates } from '../services/emailService';
import { supabase, trackAnalyticsEvent, getUserCVDocuments, updateUserCVSelection } from '../services/supabaseService';
import { openDialogue } from '../services/jobApplicationService';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import { buildEmployerVisibleJcfpmPayload } from '../services/jcfpmService';

interface ApplicationModalProps {
  job: Job;
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'form' | 'submitting' | 'success';

const extractMarkdownSection = (description: string, headings: string[]): string => {
  if (!description.trim() || headings.length === 0) return '';
  const normalizedHeadings = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `^#{2,3}\\s*(?:${normalizedHeadings.join('|')})\\s*$\\n([\\s\\S]*?)(?=\\n#{2,3}\\s+|$)`,
    'im'
  );
  const match = description.match(pattern);
  if (!match?.[1]) return '';
  return match[1]
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

const ApplicationModal: React.FC<ApplicationModalProps> = ({ job, user, isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language || 'cs').split('-')[0];
  const isCsLike = locale === 'cs' || locale === 'sk';
  const jcfpmUiCopy = {
    cs: {
      shareDesc: 'Pokud JCFPM nasdílíte, firma dostane jen kompaktní srovnávací profil pro hiring rozhodnutí. Osobní narativní rozbor zůstává jen vám.',
      premiumDesc: 'Ve free verzi zůstává JCFPM jen pro vaše soukromé doporučování v JobShamanu. Premium odemkne sdílení stručného profilu s firmou.',
      missingDesc: 'JCFPM ještě nemáte dokončený, takže se s přihláškou odešle jen životopis a základní shrnutí profilu.',
      noneDesc: 'JCFPM zůstane jen pro vaše interní doporučování v JobShamanu.',
      premiumLocked: 'Premium: sdílení s firmou',
    },
    en: {
      shareDesc: 'If you share JCFPM, the employer only receives a compact comparison profile for hiring decisions. Your personal narrative report stays private.',
      premiumDesc: 'In the free plan, JCFPM stays only in your private JobShaman recommendations. Premium unlocks sharing a concise employer profile.',
      missingDesc: 'You have not completed JCFPM yet, so only your CV and basic profile summary will be included with this application.',
      noneDesc: 'JCFPM stays only in your internal JobShaman recommendations.',
      premiumLocked: 'Premium: employer sharing',
    },
    de: {
      shareDesc: 'Wenn Sie JCFPM teilen, erhält der Arbeitgeber nur ein kompaktes Vergleichsprofil für Hiring-Entscheidungen. Ihr persönlicher Bericht bleibt privat.',
      premiumDesc: 'Im Free-Tarif bleibt JCFPM nur in Ihren privaten JobShaman-Empfehlungen. Premium schaltet das Teilen eines kompakten Arbeitgeber-Profils frei.',
      missingDesc: 'Sie haben JCFPM noch nicht abgeschlossen. Mit dieser Bewerbung werden daher nur Lebenslauf und eine kurze Profilzusammenfassung geteilt.',
      noneDesc: 'JCFPM bleibt nur in Ihren internen JobShaman-Empfehlungen.',
      premiumLocked: 'Premium: Teilen mit Arbeitgebern',
    },
    at: {
      shareDesc: 'Wenn Sie JCFPM teilen, erhält der Arbeitgeber nur ein kompaktes Vergleichsprofil für Hiring-Entscheidungen. Ihr persönlicher Bericht bleibt privat.',
      premiumDesc: 'Im Free-Tarif bleibt JCFPM nur in Ihren privaten JobShaman-Empfehlungen. Premium schaltet das Teilen eines kompakten Arbeitgeber-Profils frei.',
      missingDesc: 'Sie haben JCFPM noch nicht abgeschlossen. Mit dieser Bewerbung werden daher nur Lebenslauf und eine kurze Profilzusammenfassung geteilt.',
      noneDesc: 'JCFPM bleibt nur in Ihren internen JobShaman-Empfehlungen.',
      premiumLocked: 'Premium: Teilen mit Arbeitgebern',
    },
    pl: {
      shareDesc: 'Jeśli udostępnisz JCFPM, pracodawca otrzyma tylko zwięzły profil porównawczy do decyzji hiringowych. Twój pełny raport pozostaje prywatny.',
      premiumDesc: 'W wersji free JCFPM zostaje tylko w Twoich prywatnych rekomendacjach JobShaman. Premium odblokowuje udostępnianie zwięzłego profilu pracodawcy.',
      missingDesc: 'Nie ukończyłeś jeszcze JCFPM, więc z tym zgłoszeniem zostanie wysłane tylko CV i krótkie podsumowanie profilu.',
      noneDesc: 'JCFPM pozostaje tylko w Twoich wewnętrznych rekomendacjach JobShaman.',
      premiumLocked: 'Premium: udostępnianie pracodawcy',
    },
    sk: {
      shareDesc: 'Ak JCFPM zdieľate, firma dostane len kompaktný porovnávací profil pre hiring rozhodnutie. Váš osobný plný report zostáva súkromný.',
      premiumDesc: 'Vo free verzii zostáva JCFPM len vo vašich súkromných odporúčaniach v JobShamane. Premium odomkne zdieľanie stručného profilu s firmou.',
      missingDesc: 'JCFPM ešte nemáte dokončený, takže s touto žiadosťou odošleme len životopis a krátke zhrnutie profilu.',
      noneDesc: 'JCFPM zostane len vo vašich interných odporúčaniach v JobShamane.',
      premiumLocked: 'Premium: zdieľanie so zamestnávateľom',
    }
  }[locale] || {
    shareDesc: 'If you share JCFPM, the employer only receives a compact comparison profile for hiring decisions. Your personal narrative report stays private.',
    premiumDesc: 'In the free plan, JCFPM stays only in your private JobShaman recommendations. Premium unlocks sharing a concise employer profile.',
    missingDesc: 'You have not completed JCFPM yet, so only your CV and basic profile summary will be included with this application.',
    noneDesc: 'JCFPM stays only in your internal JobShaman recommendations.',
    premiumLocked: 'Premium: employer sharing',
  };
  const handshakeUiCopy = isCsLike ? {
    title: 'Otevri digitalni prvni kontakt',
    subtitle: 'Misto klasickeho CV funnelu odpovis na kratke situace, ktere ukazou jak premyslis. Video neni potreba.',
    truthTitle: 'Co firma slibuje predem',
    truthPoints: [
      `Role: ${job.title}`,
      `Firma: ${job.company}`,
      `Kontext: ${job.location || 'lokace bude upresnena v dialogu'}`,
      'Uzavreni dialogu ma vzdy jasny stav a duvod.'
    ],
    promptsTitle: 'Tvoje uvazovani v praxi',
    promptOne: `Kdybys mel(a) v prvnich 30 dnech posunout roli "${job.title}", na co by ses soustredil(a) jako prvni?`,
    promptTwo: 'Narazis na nejasnost nebo konflikt priorit. Jak si urcis dalsi krok a co bys komunikoval(a)?',
    promptHint: 'Odpovedi jsou soukrome, text-first a maji ukazat zpusob premysleni. Kratce a konkretne.',
    supportingTitle: 'Doplnujici kontext (volitelne)',
    supportingDesc: 'CV, kontaktni detaily a cover letter zustavaji k dispozici, ale uz nejsou jadrem prvniho kontaktu.',
    send: 'Otevrit handshake',
    sending: 'Oteviram handshake',
    successTitle: 'Handshake byl otevren',
    successDesc: `Firma ${job.company} dostala tvuj uvodní signal a muze navazat dalsim krokem bez zbytecneho tlaku.`,
    missingAnswers: 'Nejdřív prosím odpověz na oba mikro-scenáře.'
  } : {
    title: 'Open a digital first contact',
    subtitle: 'Instead of a classic CV funnel, respond to two short situations that reveal how you think. No video required.',
    truthTitle: 'What the company commits to upfront',
    truthPoints: [
      `Role: ${job.title}`,
      `Company: ${job.company}`,
      `Context: ${job.location || 'location will be clarified in the dialogue'}`,
      'Every closed dialogue must end with a clear status and reason.'
    ],
    promptsTitle: 'How you think in practice',
    promptOne: `If you had to move the "${job.title}" role forward in your first 30 days, what would you focus on first?`,
    promptTwo: 'You hit ambiguity or a priority conflict. How do you decide the next move and what do you communicate?',
    promptHint: 'Responses stay private, text-first, and should show how you think. Keep them concise and concrete.',
    supportingTitle: 'Supporting context (optional)',
    supportingDesc: 'CV, contact details, and a cover letter remain available, but they are no longer the core of first contact.',
    send: 'Open handshake',
    sending: 'Opening handshake',
    successTitle: 'Handshake opened',
    successDesc: `${job.company} received your initial signal and can continue from a calmer, structured first step.`,
    missingAnswers: 'Please answer both micro-scenarios first.'
  };
  const parsedFirstReply = extractMarkdownSection(job.description || '', ['First Reply']);
  const parsedTruthHard = extractMarkdownSection(job.description || '', ['Company Truth: What Is Actually Hard?']);
  const parsedTruthFail = extractMarkdownSection(job.description || '', ['Company Truth: Who Typically Struggles?']);
  const effectivePromptOne = parsedFirstReply || handshakeUiCopy.promptOne;
  const effectivePromptTwo = handshakeUiCopy.promptTwo;
  const effectiveTruthPoints = [
    `Role: ${job.title}`,
    `Firma: ${job.company}`,
    `Kontext: ${job.location || 'lokace bude upresnena v dialogu'}`
  ];
  if (!isCsLike) {
    effectiveTruthPoints[1] = `Company: ${job.company}`;
    effectiveTruthPoints[2] = `Context: ${job.location || 'location will be clarified in the dialogue'}`;
  }
  if (parsedTruthHard) {
    effectiveTruthPoints.push(parsedTruthHard);
  }
  if (parsedTruthFail) {
    effectiveTruthPoints.push(parsedTruthFail);
  }
  if (!parsedTruthHard && !parsedTruthFail) {
    effectiveTruthPoints.push(
      isCsLike
        ? 'Uzavreni dialogu ma vzdy jasny stav a duvod.'
        : 'Every closed dialogue must end with a clear status and reason.'
    );
  }
  const [step, setStep] = useState<Step>('form');

  // Form State
  const [formData, setFormData] = useState({
    firstName: user.name ? user.name.split(' ')[0] : '',
    lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
    email: user.email || '',
    phone: user.phone || '',
    linkedin: '' // LinkedIn not in profile yet
  });

  const [useSavedCv, setUseSavedCv] = useState(!!user.cvText || !!user.cvUrl);
  const [cvDocuments, setCvDocuments] = useState<CVDocument[]>([]);
  const [cvDocumentsLoading, setCvDocumentsLoading] = useState(false);
  const [selectedCvId, setSelectedCvId] = useState<string | null>(null);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [jcfpmShareLevel, setJcfpmShareLevel] = useState<ApplicationJcfpmShareLevel>('summary');
  const [handshakeAnswers, setHandshakeAnswers] = useState({
    scenarioOne: '',
    scenarioTwo: '',
    optionalNote: ''
  });
  const [showSupportingContext, setShowSupportingContext] = useState(false);

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [effectiveTier, setEffectiveTier] = useState<string>((user.subscription?.tier || 'free').toLowerCase());

  // Determine if role is suitable for AI Assessment (Knowledge worker vs Manual/Service)
  const isManualLabor = job.tags.some(t => ['Řidič', 'Prodej', 'Logistika', 'Manuální', 'Směnný provoz', 'Gig Economy'].includes(t)) ||
    job.title.toLowerCase().includes('kurýr') ||
    job.title.toLowerCase().includes('řidič') ||
    job.title.toLowerCase().includes('asistent');

  const showAiAssessment = !isManualLabor;
  const hasPremiumCoverLetter = effectiveTier === 'premium';
  const hasPremiumJcfpmSharing = effectiveTier === 'premium';
  const selectedCv = cvDocuments.find(doc => doc.id === selectedCvId) || cvDocuments.find(doc => doc.isActive) || null;
  const jcfpmSnapshot = user.preferences?.jcfpm_v1 || null;
  const jcfpmAdjustment = user.preferences?.jcfpm_jhi_adjustment_v1 || null;

  useEffect(() => {
    let isMounted = true;
    const refreshSubscriptionTier = async () => {
      if (!user.isLoggedIn || !user.id) {
        if (isMounted) setEffectiveTier((user.subscription?.tier || 'free').toLowerCase());
        return;
      }
      try {
        const status = await getSubscriptionStatus(user.id);
        if (isMounted) setEffectiveTier((status?.tier || user.subscription?.tier || 'free').toLowerCase());
      } catch {
        if (isMounted) setEffectiveTier((user.subscription?.tier || 'free').toLowerCase());
      }
    };
    refreshSubscriptionTier();
    return () => { isMounted = false; };
  }, [user.id, user.isLoggedIn, user.subscription?.tier]);

  useEffect(() => {
    let isMounted = true;
    const loadCVs = async () => {
      if (!user.id) return;
      setCvDocumentsLoading(true);
      try {
        const docs = await getUserCVDocuments(user.id);
        if (!isMounted) return;
        setCvDocuments(docs);
        const active = docs.find(doc => doc.isActive) || docs[0] || null;
        if (active) {
          setSelectedCvId(active.id);
          setUseSavedCv(true);
        }
      } catch (error) {
        console.error('Failed to load CV documents:', error);
      } finally {
        if (isMounted) setCvDocumentsLoading(false);
      }
    };
    loadCVs();
    return () => { isMounted = false; };
  }, [user.id, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCvFile(e.target.files[0]);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const draft = await generateCoverLetter(
        job.title,
        job.company,
        job.description,
        aiPrompt,
        user.cvText || ''
      );
      setCoverLetter(draft);
      setShowAiInput(false); // Close the input, show the result
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!handshakeAnswers.scenarioOne.trim() || !handshakeAnswers.scenarioTwo.trim()) {
      alert(handshakeUiCopy.missingAnswers);
      return;
    }
    setStep('submitting');

    try {
      const requestedShareLevel: ApplicationJcfpmShareLevel =
        jcfpmSnapshot && hasPremiumJcfpmSharing ? jcfpmShareLevel : 'do_not_share';
      const effectiveJcfpmShareLevel: ApplicationJcfpmShareLevel =
        requestedShareLevel === 'full_report' ? 'summary' : requestedShareLevel;
      const sharedJcfpmPayload = buildEmployerVisibleJcfpmPayload(
        jcfpmSnapshot,
        effectiveJcfpmShareLevel,
        jcfpmAdjustment
      );
      const selectedCvSnapshot = useSavedCv
        ? {
            id: selectedCv?.id || null,
            label: selectedCv?.label || selectedCv?.originalName || null,
            originalName: selectedCv?.originalName || null,
            fileUrl: selectedCv?.fileUrl || null
          }
        : (cvFile ? {
            label: cvFile.name,
            originalName: cvFile.name,
            fileUrl: null
          } : null);
      const candidateProfileSnapshot = {
        name: [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim() || user.name,
        email: formData.email || user.email || '',
        phone: formData.phone || user.phone || '',
        jobTitle: user.jobTitle || '',
        linkedin: formData.linkedin || user.preferences?.linkedIn || '',
        skills: Array.isArray(user.skills) ? user.skills.slice(0, 12) : [],
        values: Array.isArray(user.values) ? user.values.slice(0, 8) : [],
        preferredCountryCode: user.preferredCountryCode || ''
      };
      let recorded = false;
      let applicationStatus: 'created' | 'exists' | null = null;

      try {
        const backendResult = await openDialogue(
          job.id,
          'handshake_modal',
          {
            job_title: job.title,
            job_company: job.company,
            job_location: job.location,
            job_url: job.url || null,
            job_source: job.source || null,
            job_contact_email: job.contact_email || null,
            handshake_entrypoint: 'candidate_modal',
            handshake_mode: 'micro_dialogue_v1',
            handshake_prompts: [effectivePromptOne, effectivePromptTwo],
            handshake_responses: [
              handshakeAnswers.scenarioOne.trim(),
              handshakeAnswers.scenarioTwo.trim()
            ],
            handshake_optional_note: handshakeAnswers.optionalNote.trim() || null,
            role_truth: effectiveTruthPoints,
            cover_letter_present: Boolean(coverLetter?.trim()),
            has_saved_cv: Boolean(useSavedCv && selectedCvSnapshot),
            has_uploaded_cv: Boolean(!useSavedCv && cvFile),
            jcfpm_share_level: effectiveJcfpmShareLevel
          },
          {
            coverLetter: coverLetter ? coverLetter.slice(0, 2000) : null,
            cvDocumentId: useSavedCv ? selectedCvId : null,
            cvSnapshot: selectedCvSnapshot,
            candidateProfileSnapshot,
            jcfpmShareLevel: effectiveJcfpmShareLevel,
            sharedJcfpmPayload
          }
        );
        applicationStatus = backendResult?.status === 'exists' ? 'exists' : (backendResult?.status === 'created' ? 'created' : null);
        recorded = !!backendResult;
      } catch {
        recorded = false;
      }

      if (!recorded && supabase) {
        try {
          await supabase.from('job_applications').insert({
            job_id: job.id,
            candidate_id: user.id || null,
            company_id: job.company_id,
            applied_at: new Date().toISOString(),
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source: 'handshake_modal',
            cover_letter: coverLetter || null,
            cv_document_id: useSavedCv ? selectedCvId : null,
            cv_snapshot: selectedCvSnapshot,
            candidate_profile_snapshot: candidateProfileSnapshot,
            jcfpm_share_level: effectiveJcfpmShareLevel,
            shared_jcfpm_payload: sharedJcfpmPayload,
            application_payload: {
              job_title: job.title,
              job_company: job.company,
              job_location: job.location,
              job_url: job.url || null,
              job_source: job.source || null,
              job_contact_email: job.contact_email || null,
              handshake_entrypoint: 'candidate_modal',
              handshake_mode: 'micro_dialogue_v1',
              handshake_prompts: [effectivePromptOne, effectivePromptTwo],
              handshake_responses: [
                handshakeAnswers.scenarioOne.trim(),
                handshakeAnswers.scenarioTwo.trim()
              ],
              handshake_optional_note: handshakeAnswers.optionalNote.trim() || null,
              role_truth: effectiveTruthPoints,
              manual_contact_fields: {
                first_name: formData.firstName,
                last_name: formData.lastName,
                linkedin: formData.linkedin || null
              }
            },
            status: 'pending'
          });
          recorded = true;
        } catch (dbErr) {
          console.error('Failed to record enriched application in DB:', dbErr);
          try {
            await supabase.from('job_applications').insert({
              job_id: job.id,
              candidate_id: user.id || null,
              company_id: job.company_id,
              applied_at: new Date().toISOString(),
              cover_letter: coverLetter || null,
              status: 'pending'
            });
            recorded = true;
          } catch (legacyDbErr) {
            console.error('Failed to record legacy application in DB:', legacyDbErr);
          }
        }
      }

      if (!recorded) {
        alert(t('alerts.application_send_error'));
        setStep('form');
        return;
      }

      if (applicationStatus === 'exists') {
        setStep('success');
        return;
      }

      // Use environment variable for recipient email, with fallback
      const recipientEmail = import.meta.env.VITE_CONTACT_EMAIL || 'floki@jobshaman.cz';

      // Send email notification
      const applicationPayload = {
        ...formData,
        handshakePromptOne: effectivePromptOne,
        handshakePromptTwo: effectivePromptTwo,
        handshakeAnswerOne: handshakeAnswers.scenarioOne,
        handshakeAnswerTwo: handshakeAnswers.scenarioTwo,
        handshakeOptionalNote: handshakeAnswers.optionalNote,
        coverLetter,
        cvFile: cvFile ? cvFile.name : null,
        cvSelectedName: selectedCv?.originalName || selectedCv?.label || null,
        cvSelectedUrl: selectedCv?.fileUrl || null,
        jcfpmShareLevel: effectiveJcfpmShareLevel
      };

      const emailResult = await sendEmail({
        to: recipientEmail,
        ...EmailTemplates.jobApplication(applicationPayload, job)
      });

      if (!emailResult.success) {
        console.error('Failed to send application email:', emailResult.error);
      }

      await trackAnalyticsEvent({
        event_type: 'application_submitted',
        user_id: user.id,
        company_id: job.company_id,
        metadata: {
          job_id: job.id,
          job_title: job.title,
          jcfpm_share_level: effectiveJcfpmShareLevel,
          has_cover_letter: Boolean(coverLetter?.trim()),
          handshake_mode: 'micro_dialogue_v1',
          scenario_one_length: handshakeAnswers.scenarioOne.trim().length,
          scenario_two_length: handshakeAnswers.scenarioTwo.trim().length
        }
      });

      // Simulate API call delay for UI feedback
      setTimeout(() => {
        setStep('success');
      }, 1500);
    } catch (error) {
      console.error('Application error:', error);
      alert(t('alerts.application_send_error'));
      setStep('form');
    }
  };

  const renderContent = () => {
    if (step === 'success') {
      return (
        <div className="text-center py-12 px-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{handshakeUiCopy.successTitle}</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
            {handshakeUiCopy.successDesc}
          </p>

          {/* AI Feature Teaser */}
          {showAiAssessment && (
            <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-6 max-w-sm mx-auto text-left relative overflow-hidden backdrop-blur-sm">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500 rounded-full opacity-10 dark:opacity-20 blur-xl"></div>
              <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400">
                <BrainCircuit size={20} />
                <span className="font-bold text-xs uppercase tracking-wider">JobShaman AI Node</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium mb-2">
                {t('apply.ai_processing')}
              </p>
              <div className="w-full bg-indigo-100 dark:bg-indigo-900/50 h-1.5 rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-indigo-500 w-2/3 animate-pulse shadow-[0_0_10px_#6366f1]"></div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('apply.ai_evaluation_desc')}
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-8 px-6 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            {t('apply.back_to_jobs')}
          </button>
        </div>
      );
    }

    if (step === 'submitting') {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 animate-in fade-in">
          <Loader2 size={48} className="text-indigo-600 dark:text-indigo-500 animate-spin mb-6" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{handshakeUiCopy.sending}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{handshakeUiCopy.subtitle}</p>
        </div>
      );
    }

    return (
      <div className="p-6 sm:p-8 space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-100 dark:bg-cyan-900/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
            <MessageSquare size={12} />
            Digital first contact
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{handshakeUiCopy.title}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{handshakeUiCopy.subtitle}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Shield size={16} />
            {handshakeUiCopy.truthTitle}
          </div>
          <div className="mt-3 space-y-2">
            {effectiveTruthPoints.map((point) => (
              <div key={point} className="rounded-xl bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 border border-white/70 dark:border-slate-800">
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{handshakeUiCopy.promptsTitle}</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{handshakeUiCopy.promptHint}</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{effectivePromptOne}</p>
              <textarea
                value={handshakeAnswers.scenarioOne}
                onChange={(e) => setHandshakeAnswers((prev) => ({ ...prev, scenarioOne: e.target.value }))}
                className="mt-3 w-full h-28 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:[color-scheme:dark]"
                placeholder={isCsLike ? 'Krátce popiš první krok, trade-off a jak bys to komunikoval(a).' : 'Briefly describe the first move, the trade-off, and how you would communicate it.'}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{effectivePromptTwo}</p>
              <textarea
                value={handshakeAnswers.scenarioTwo}
                onChange={(e) => setHandshakeAnswers((prev) => ({ ...prev, scenarioTwo: e.target.value }))}
                className="mt-3 w-full h-28 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:[color-scheme:dark]"
                placeholder={isCsLike ? 'Zaměř se na způsob rozhodnutí, ne na perfektní sebeprezentaci.' : 'Focus on your decision process, not on polished self-presentation.'}
              />
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {isCsLike ? 'Volitelny kontext' : 'Optional context'}
              </p>
              <textarea
                value={handshakeAnswers.optionalNote}
                onChange={(e) => setHandshakeAnswers((prev) => ({ ...prev, optionalNote: e.target.value }))}
                className="mt-3 w-full h-20 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:[color-scheme:dark]"
                placeholder={isCsLike ? 'Můžeš doplnit krátkou poznámku nebo kontext. Krátké audio přijde v další verzi.' : 'You can add a short note or context. Short audio will come in a later version.'}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20">
          <button
            type="button"
            onClick={() => setShowSupportingContext((prev) => !prev)}
            className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{handshakeUiCopy.supportingTitle}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{handshakeUiCopy.supportingDesc}</div>
            </div>
            {showSupportingContext ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
          </button>
        </div>

        {showSupportingContext && (
        <>
        {/* 1. Contact Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{t('apply.contact_info')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder={t('apply.first_name')}
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:[color-scheme:dark]"
              />
            </div>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder={t('apply.last_name')}
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:[color-scheme:dark]"
              />
            </div>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder={t('apply.email')}
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:[color-scheme:dark]"
              />
            </div>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder={t('apply.phone')}
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:[color-scheme:dark]"
              />
            </div>
            <div className="relative sm:col-span-2">
              <Linkedin size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="url"
                name="linkedin"
                value={formData.linkedin}
                onChange={handleInputChange}
                placeholder={t('apply.linkedin')}
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* 2. Documents */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              {t('apply.supporting_context_section', { defaultValue: isCsLike ? 'Podpůrné podklady' : 'Supporting context' })}
            </h3>
            {(cvDocuments.length > 0 || user.cvText || user.cvUrl) && (
              <button
                onClick={() => setUseSavedCv(!useSavedCv)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                {useSavedCv
                  ? t('apply.upload_doc_instead', { defaultValue: isCsLike ? 'Nahrát jiný dokument' : 'Upload a different document' })
                  : t('apply.use_saved_doc', { defaultValue: isCsLike ? 'Použít uložený dokument' : 'Use saved document' })}
              </button>
            )}
          </div>

          {useSavedCv ? (
            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                <FileText size={20} />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('apply.saved_doc_ready', { defaultValue: isCsLike ? 'Uložený podklad je připravený' : 'A saved document is ready' })}
                </p>
                {cvDocumentsLoading ? (
                  <p className="text-xs text-slate-500">{t('app.loading')}</p>
                ) : cvDocuments.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={selectedCv?.id || ''}
                      onChange={async (e) => {
                        const nextId = e.target.value || null;
                        setSelectedCvId(nextId);
                        if (nextId && user.id) {
                          await updateUserCVSelection(user.id, nextId);
                        }
                      }}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/40 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 dark:[color-scheme:dark]"
                    >
                      {cvDocuments.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.originalName}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      {selectedCv?.originalName || t('apply.doc_from_profile', { defaultValue: isCsLike ? 'Dokument z profilu' : 'Document from profile' })}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {user.cvUrl ? 'supporting_document.pdf' : t('apply.doc_from_profile', { defaultValue: isCsLike ? 'Dokument z profilu' : 'Document from profile' })}
                  </p>
                )}
              </div>
              <CheckCircle className="text-emerald-500" size={20} />
            </div>
          ) : (
            <div className={`
              border-2 border-dashed rounded-xl p-6 text-center transition-colors
              ${cvFile ? 'border-cyan-500/50 bg-cyan-50 dark:bg-cyan-500/5' : 'border-slate-300 dark:border-slate-700 hover:border-slate-500'}
            `}>
              {cvFile ? (
                <div className="flex items-center justify-center gap-3 text-cyan-600 dark:text-cyan-400">
                  <FileText size={24} />
                  <span className="font-medium truncate max-w-[200px]">{cvFile.name}</span>
                  <button
                    onClick={() => setCvFile(null)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{t('apply.upload_prompt')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF, DOCX (Max 5MB)</p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Cover Letter */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{t('apply.cover_letter')}</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase rounded border border-amber-200 dark:border-amber-800/50">
                <Crown size={10} /> Premium
              </div>
              <button
                onClick={() => {
                  if (hasPremiumCoverLetter) {
                    setShowAiInput(!showAiInput);
                  } else {
                    alert(t('alerts.premium_only_feature'));
                  }
                }}
                className={`text-xs flex items-center gap-1 font-medium ${hasPremiumCoverLetter ? 'text-purple-600 dark:text-purple-400 hover:text-purple-50' : 'text-slate-400 cursor-not-allowed'}`}
              >
                <Wand2 size={12} />
                {showAiInput ? t('apply.ai_hide') : t('apply.ai_write')}
              </button>
            </div>
          </div>

          {/* AI Assistant Input */}
          {showAiInput && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-500/20 animate-in slide-in-from-top-2 mb-2">
              <p className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-semibold">{t('apply.ai_prompt_label')}:</p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t('apply.ai_prompt_placeholder')}
                className="w-full p-2 text-sm border border-purple-300 dark:border-purple-500/30 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 h-20 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder:text-slate-500 dark:[color-scheme:dark]"
              />
              <button
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiPrompt}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-md hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed ml-auto shadow-[0_0_10px_rgba(147,51,234,0.3)]"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {t('apply.ai_generate')}
              </button>
            </div>
          )}

          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            className="w-full h-40 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:[color-scheme:dark]"
            placeholder={t('apply.cover_letter_placeholder')}
          />
        </div>

        {/* 4. JCFPM Sharing */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">
              {t('apply.jcfpm_sharing', { defaultValue: 'JCFPM sharing' })}
            </h3>
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${
              jcfpmSnapshot
                ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
                : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
            }`}>
              {jcfpmSnapshot
                ? t('apply.jcfpm_available', { defaultValue: 'Result available' })
                : t('apply.jcfpm_missing', { defaultValue: 'No result available' })}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {jcfpmSnapshot
                ? hasPremiumJcfpmSharing
                  ? t('apply.jcfpm_sharing_desc', { defaultValue: jcfpmUiCopy.shareDesc })
                  : t('apply.jcfpm_sharing_premium_desc', { defaultValue: jcfpmUiCopy.premiumDesc })
                : t('apply.jcfpm_sharing_missing_desc', { defaultValue: jcfpmUiCopy.missingDesc })}
            </p>

            {jcfpmSnapshot && hasPremiumJcfpmSharing ? (
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 cursor-pointer">
                  <input
                    type="radio"
                    name="jcfpm-share-level"
                    value="summary"
                    checked={jcfpmShareLevel === 'summary' || jcfpmShareLevel === 'full_report'}
                    onChange={() => setJcfpmShareLevel('summary')}
                    className="mt-1 dark:[color-scheme:dark]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t('apply.jcfpm_share_summary', { defaultValue: 'Share hiring profile' })}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {t('apply.jcfpm_share_summary_desc', { defaultValue: 'Sends only a compact comparison signal: archetype, top dimensions, strengths, key work-style signals, and a concise JHI adjustment summary.' })}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 cursor-pointer">
                  <input
                    type="radio"
                    name="jcfpm-share-level"
                    value="do_not_share"
                    checked={jcfpmShareLevel === 'do_not_share'}
                    onChange={() => setJcfpmShareLevel('do_not_share')}
                    className="mt-1 dark:[color-scheme:dark]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t('apply.jcfpm_share_none', { defaultValue: 'Do not share' })}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {t('apply.jcfpm_share_none_desc', { defaultValue: jcfpmUiCopy.noneDesc })}
                    </span>
                  </span>
                </label>
              </div>
            ) : jcfpmSnapshot ? (
              <button
                type="button"
                onClick={() => alert(t('alerts.premium_only_feature'))}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300"
              >
                {t('apply.jcfpm_sharing_premium_locked', { defaultValue: jcfpmUiCopy.premiumLocked })}
              </button>
            ) : null}
          </div>
        </div>

        {/* 5. AI Assessment Link (Conditional) */}
        {showAiAssessment && (
          <div className="bg-indigo-50 dark:bg-indigo-500/5 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 flex flex-col sm:flex-row items-start gap-4">
            <div className="bg-indigo-100 dark:bg-indigo-500/10 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
              <BrainCircuit size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">{t('apply.ai_assessment_title')}</h4>
                <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] rounded font-bold uppercase border border-indigo-200 dark:border-indigo-500/30">Beta</span>
              </div>
              <p className="text-xs text-indigo-800 dark:text-indigo-200 mb-3 leading-relaxed opacity-80">
                {t('apply.ai_assessment_desc')}
              </p>
              <button className="flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/50">
                <LinkIcon size={12} />
                {t('apply.connect_profile')}
              </button>
            </div>
          </div>
        )}
        </>
        )}

        {/* Footer Actions */}
        <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {t('apply.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.email || !formData.firstName || !handshakeAnswers.scenarioOne.trim() || !handshakeAnswers.scenarioTwo.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(8,145,178,0.4)]"
          >
            <Send size={18} />
            {handshakeUiCopy.send}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      <div className="relative bg-white dark:bg-[#0b1121] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] overflow-y-auto ring-1 ring-black/5 dark:ring-white/10 transition-colors duration-300">
        {step !== 'success' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full z-10 transition-colors"
          >
            <X size={20} />
          </button>
        )}
        {renderContent()}
      </div>
    </div>
  );
};

export default ApplicationModal;
