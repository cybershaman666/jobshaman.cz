import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApplicationJcfpmShareLevel, Job, UserProfile, CVDocument } from '../types';
import { X, Upload, FileText, Wand2, CheckCircle, Send, Loader2, BrainCircuit, User, Mail, Phone, Linkedin, Link as LinkIcon, Crown } from 'lucide-react';
import { generateCoverLetter } from '../services/geminiService';
import { sendEmail, EmailTemplates } from '../services/emailService';
import { supabase, trackAnalyticsEvent, getUserCVDocuments, updateUserCVSelection } from '../services/supabaseService';
import { createJobApplication } from '../services/jobApplicationService';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import { buildEmployerVisibleJcfpmPayload } from '../services/jcfpmService';

interface ApplicationModalProps {
  job: Job;
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'form' | 'submitting' | 'success';

const ApplicationModal: React.FC<ApplicationModalProps> = ({ job, user, isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language || 'cs').split('-')[0];
  const jcfpmUiCopy = {
    cs: {
      shareDesc: 'Vyberte, kolik z výsledku JCFPM chcete sdílet s firmou. Vaše vlastní personalizace JHI zůstává aktivní tak jako tak.',
      premiumDesc: 'Ve free verzi zůstává JCFPM jen pro vaše soukromé doporučování v JobShamanu. Premium odemkne sdílení s firmou a plný rozbor.',
      missingDesc: 'JCFPM ještě nemáte dokončený, takže se s přihláškou odešle jen životopis a základní shrnutí profilu.',
      noneDesc: 'JCFPM zůstane jen pro vaše interní doporučování v JobShamanu.',
      premiumLocked: 'Premium: sdílení s firmou a plný rozbor',
    },
    en: {
      shareDesc: 'Choose how much of your JCFPM result you want to share with the employer. Your own JHI personalization stays active either way.',
      premiumDesc: 'In the free plan, JCFPM stays only in your private JobShaman recommendations. Premium unlocks employer sharing and the full analysis.',
      missingDesc: 'You have not completed JCFPM yet, so only your CV and basic profile summary will be included with this application.',
      noneDesc: 'JCFPM stays only in your internal JobShaman recommendations.',
      premiumLocked: 'Premium: employer sharing and full analysis',
    },
    de: {
      shareDesc: 'Wählen Sie, wie viel Ihres JCFPM-Ergebnisses Sie mit dem Arbeitgeber teilen möchten. Ihre eigene JHI-Personalisierung bleibt in jedem Fall aktiv.',
      premiumDesc: 'Im Free-Tarif bleibt JCFPM nur in Ihren privaten JobShaman-Empfehlungen. Premium schaltet das Teilen mit Arbeitgebern und die vollständige Analyse frei.',
      missingDesc: 'Sie haben JCFPM noch nicht abgeschlossen. Mit dieser Bewerbung werden daher nur Lebenslauf und eine kurze Profilzusammenfassung geteilt.',
      noneDesc: 'JCFPM bleibt nur in Ihren internen JobShaman-Empfehlungen.',
      premiumLocked: 'Premium: Teilen mit Arbeitgebern und volle Analyse',
    },
    at: {
      shareDesc: 'Wählen Sie, wie viel Ihres JCFPM-Ergebnisses Sie mit dem Arbeitgeber teilen möchten. Ihre eigene JHI-Personalisierung bleibt in jedem Fall aktiv.',
      premiumDesc: 'Im Free-Tarif bleibt JCFPM nur in Ihren privaten JobShaman-Empfehlungen. Premium schaltet das Teilen mit Arbeitgebern und die vollständige Analyse frei.',
      missingDesc: 'Sie haben JCFPM noch nicht abgeschlossen. Mit dieser Bewerbung werden daher nur Lebenslauf und eine kurze Profilzusammenfassung geteilt.',
      noneDesc: 'JCFPM bleibt nur in Ihren internen JobShaman-Empfehlungen.',
      premiumLocked: 'Premium: Teilen mit Arbeitgebern und volle Analyse',
    },
    pl: {
      shareDesc: 'Wybierz, ile wyniku JCFPM chcesz udostępnić pracodawcy. Twoja własna personalizacja JHI pozostanie aktywna niezależnie od wyboru.',
      premiumDesc: 'W wersji free JCFPM zostaje tylko w Twoich prywatnych rekomendacjach JobShaman. Premium odblokowuje udostępnianie pracodawcy i pełną analizę.',
      missingDesc: 'Nie ukończyłeś jeszcze JCFPM, więc z tym zgłoszeniem zostanie wysłane tylko CV i krótkie podsumowanie profilu.',
      noneDesc: 'JCFPM pozostaje tylko w Twoich wewnętrznych rekomendacjach JobShaman.',
      premiumLocked: 'Premium: udostępnianie pracodawcy i pełna analiza',
    },
    sk: {
      shareDesc: 'Vyberte si, koľko z výsledku JCFPM chcete zdieľať so zamestnávateľom. Vaša vlastná personalizácia JHI zostane aktívna bez ohľadu na výber.',
      premiumDesc: 'Vo free verzii zostáva JCFPM len vo vašich súkromných odporúčaniach v JobShamane. Premium odomkne zdieľanie so zamestnávateľom a plnú analýzu.',
      missingDesc: 'JCFPM ešte nemáte dokončený, takže s touto žiadosťou odošleme len životopis a krátke zhrnutie profilu.',
      noneDesc: 'JCFPM zostane len vo vašich interných odporúčaniach v JobShamane.',
      premiumLocked: 'Premium: zdieľanie so zamestnávateľom a plná analýza',
    }
  }[locale] || {
    shareDesc: 'Choose how much of your JCFPM result you want to share with the employer. Your own JHI personalization stays active either way.',
    premiumDesc: 'In the free plan, JCFPM stays only in your private JobShaman recommendations. Premium unlocks employer sharing and the full analysis.',
    missingDesc: 'You have not completed JCFPM yet, so only your CV and basic profile summary will be included with this application.',
    noneDesc: 'JCFPM stays only in your internal JobShaman recommendations.',
    premiumLocked: 'Premium: employer sharing and full analysis',
  };
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
    setStep('submitting');

    try {
      const effectiveJcfpmShareLevel: ApplicationJcfpmShareLevel =
        jcfpmSnapshot && hasPremiumJcfpmSharing ? jcfpmShareLevel : 'do_not_share';
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

      try {
        const backendResult = await createJobApplication(
          job.id,
          'application_modal',
          {
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
            source: 'application_modal',
            cover_letter: coverLetter || null,
            cv_document_id: useSavedCv ? selectedCvId : null,
            cv_snapshot: selectedCvSnapshot,
            candidate_profile_snapshot: candidateProfileSnapshot,
            jcfpm_share_level: effectiveJcfpmShareLevel,
            shared_jcfpm_payload: sharedJcfpmPayload,
            application_payload: {
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

      // Use environment variable for recipient email, with fallback
      const recipientEmail = import.meta.env.VITE_CONTACT_EMAIL || 'floki@jobshaman.cz';

      // Send email notification
      const applicationPayload = {
        ...formData,
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
          has_cover_letter: Boolean(coverLetter?.trim())
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('apply.success_title')}</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
            {t('apply.success_desc', { company: job.company })}
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('apply.submitting')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{t('apply.submitting_desc')}</p>
        </div>
      );
    }

    return (
      <div className="p-6 sm:p-8 space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('apply.title', { company: job.company })}</h2>
          <p className="text-slate-500 dark:text-slate-300">{job.title}</p>
        </div>

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
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
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
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
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
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
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
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
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
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Documents */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{t('apply.cv_section')}</h3>
            {(cvDocuments.length > 0 || user.cvText || user.cvUrl) && (
              <button
                onClick={() => setUseSavedCv(!useSavedCv)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                {useSavedCv ? t('apply.upload_instead') : t('apply.use_saved_cv')}
              </button>
            )}
          </div>

          {useSavedCv ? (
            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                <FileText size={20} />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t('apply.saved_cv_ready')}</p>
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
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/40 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200"
                    >
                      {cvDocuments.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.originalName}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      {selectedCv?.originalName || t('apply.cv_from_profile')}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{user.cvUrl ? 'CV_Document.pdf' : t('apply.cv_from_profile')}</p>
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
                className="w-full p-2 text-sm border border-purple-300 dark:border-purple-500/30 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 h-20 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder:text-slate-500"
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
            className="w-full h-40 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500"
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
                    checked={jcfpmShareLevel === 'summary'}
                    onChange={() => setJcfpmShareLevel('summary')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t('apply.jcfpm_share_summary', { defaultValue: 'Share summary' })}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {t('apply.jcfpm_share_summary_desc', { defaultValue: 'Sends archetype, top dimensions, strengths, environment fit, and a concise JHI adjustment summary.' })}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 cursor-pointer">
                  <input
                    type="radio"
                    name="jcfpm-share-level"
                    value="full_report"
                    checked={jcfpmShareLevel === 'full_report'}
                    onChange={() => setJcfpmShareLevel('full_report')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t('apply.jcfpm_share_full', { defaultValue: 'Share extended report' })}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {t('apply.jcfpm_share_full_desc', { defaultValue: 'Adds dimension scores and a richer narrative summary, without exposing raw test answers.' })}
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
                    className="mt-1"
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
            disabled={(!cvFile && !useSavedCv) || !formData.email || !formData.firstName}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(8,145,178,0.4)]"
          >
            <Send size={18} />
            {t('apply.send')}
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
