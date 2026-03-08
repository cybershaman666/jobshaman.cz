import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CandidateDomainKey, CandidateSeniority, UserProfile } from '../types';
import { resolveAddressToCoordinates } from '../services/commuteService';
import { validateCvFile, uploadAndParseCv, mergeProfileWithParsedCv } from '../services/cvUploadService';
import { getCandidateIntentDomainOptions, resolveCandidateIntentProfile } from '../services/candidateIntentService';
import { createDefaultCandidateSearchProfile } from '../services/profileDefaults';
import AIGuidedProfileWizard from './AIGuidedProfileWizard';
import { CheckCircle, FileText, Loader2, MapPin, Sparkles, Upload, X } from 'lucide-react';

interface CandidateOnboardingModalProps {
    isOpen: boolean;
    profile: UserProfile;
    onClose: () => void;
    onComplete: () => void;
    onGoToProfile?: () => void;
    onUpdateProfile: (p: UserProfile, persist?: boolean) => void | Promise<void>;
    onOpenPremium: (featureLabel: string) => void;
    onRefreshProfile?: () => Promise<void>;
    initialStep?: 'location' | 'preferences' | 'cv' | 'done';
    onStepViewed?: (step: string) => void;
    onStepCompleted?: (step: string) => void;
}

type Step = 1 | 2 | 3 | 4;
type Status = 'idle' | 'verifying' | 'success' | 'error';
type EmploymentChoice = 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';
type VisibilityChoice = 'private' | 'recruiter' | 'public';

const CandidateOnboardingModal: React.FC<CandidateOnboardingModalProps> = ({
    isOpen,
    profile,
    onClose,
    onComplete,
    onGoToProfile,
    onUpdateProfile,
    onOpenPremium,
    onRefreshProfile,
    initialStep = 'location',
    onStepViewed,
    onStepCompleted
}) => {
    const { t, i18n } = useTranslation();
    const cvInputRef = useRef<HTMLInputElement>(null);
    const isCsLike = ['cs', 'sk'].includes((i18n.language || 'cs').split('-')[0].toLowerCase());

    const [step, setStep] = useState<Step>(1);
    const [address, setAddress] = useState(profile.address || '');
    const [coordinates, setCoordinates] = useState<UserProfile['coordinates']>(profile.coordinates);
    const [addressStatus, setAddressStatus] = useState<Status>('idle');
    const [isSavingLocation, setIsSavingLocation] = useState(false);

    const [isUploadingCv, setIsUploadingCv] = useState(false);
    const [cvStatus, setCvStatus] = useState<Status>('idle');
    const [localCvUrl, setLocalCvUrl] = useState(profile.cvUrl);
    const [localCvText, setLocalCvText] = useState(profile.cvText);
    const [showAIGuide, setShowAIGuide] = useState(false);
    const [desiredRole, setDesiredRole] = useState(profile.preferences?.desired_role || profile.jobTitle || '');
    const [desiredSalaryMin, setDesiredSalaryMin] = useState(
        profile.preferences?.desired_salary_min != null ? String(profile.preferences.desired_salary_min) : ''
    );
    const [desiredSalaryMax, setDesiredSalaryMax] = useState(
        profile.preferences?.desired_salary_max != null ? String(profile.preferences.desired_salary_max) : ''
    );
    const [desiredEmploymentType, setDesiredEmploymentType] = useState<EmploymentChoice>(
        profile.preferences?.desired_employment_type || 'full_time'
    );
    const [primaryDomain, setPrimaryDomain] = useState<CandidateDomainKey | ''>('');
    const [targetRole, setTargetRole] = useState('');
    const [seniority, setSeniority] = useState<CandidateSeniority | ''>('');
    const [includeAdjacentDomains, setIncludeAdjacentDomains] = useState(true);
    const [profileVisibility, setProfileVisibility] = useState<VisibilityChoice>(
        profile.preferences?.profile_visibility || 'recruiter'
    );
    const [skillsInput, setSkillsInput] = useState((profile.skills || []).join(', '));
    const [isSavingPreferences, setIsSavingPreferences] = useState(false);

    const aiCvParsingEnabled = String(import.meta.env.VITE_ENABLE_AI_CV_PARSER || 'true').toLowerCase() !== 'false';
    const isPremium = String(profile.subscription?.tier || 'free').toLowerCase() === 'premium';
    const domainOptions = useMemo(() => getCandidateIntentDomainOptions(i18n.language), [i18n.language]);
    const supportStepCopy = isCsLike ? {
        title: 'Doplňte podpůrný kontext',
        desc: 'CV nebo AI draft tu fungují jen jako volitelný podpůrný podklad. Přidejte dokument, pokud chcete mít po ruce další kontext pro firmy.',
        uploadBody: 'Nahrajte životopis nebo jiný podpůrný dokument. Použije se jen tehdy, když si tým vyžádá víc detailu.',
        uploadCta: 'Nahrát dokument',
        dictateCta: 'Vytvořit AI draft podkladů',
        success: 'Podpůrný dokument je připravený',
        premiumNote: 'Premium odemyká AI průvodce, detailní JCFPM report, personalizovaný JHI a více prostoru pro aktivní dialogy.'
    } : {
        title: 'Add supporting context',
        desc: 'A CV or AI draft works here as optional supporting context. Add a document only if you want extra material ready for teams that ask for more detail.',
        uploadBody: 'Upload a resume or another supporting document. It is used only when a team asks for extra context.',
        uploadCta: 'Upload document',
        dictateCta: 'Create an AI context draft',
        success: 'Supporting document is ready',
        premiumNote: 'Premium unlocks the AI guide, the detailed JCFPM report, personalized JHI, and more room for active dialogues.'
    };

    useEffect(() => {
        if (!isOpen) return;
        const resolvedIntent = resolveCandidateIntentProfile(profile);
        const stepFromKey: Record<'location' | 'preferences' | 'cv' | 'done', Step> = {
            location: 1,
            preferences: 2,
            cv: 3,
            done: 4,
        };
        const nextStep = stepFromKey[initialStep] || 1;

        setStep(nextStep);
        setAddress(profile.address || '');
        setCoordinates(profile.coordinates);
        setAddressStatus(profile.coordinates ? 'success' : 'idle');
        setLocalCvUrl(profile.cvUrl);
        setLocalCvText(profile.cvText);
        setCvStatus('idle');
        setDesiredRole(profile.preferences?.desired_role || profile.jobTitle || '');
        setDesiredSalaryMin(profile.preferences?.desired_salary_min != null ? String(profile.preferences.desired_salary_min) : '');
        setDesiredSalaryMax(profile.preferences?.desired_salary_max != null ? String(profile.preferences.desired_salary_max) : '');
        setDesiredEmploymentType((profile.preferences?.desired_employment_type || 'full_time') as EmploymentChoice);
        setPrimaryDomain((profile.preferences?.searchProfile?.primaryDomain || resolvedIntent.primaryDomain || '') as CandidateDomainKey | '');
        setTargetRole(profile.preferences?.searchProfile?.targetRole || resolvedIntent.targetRole || profile.preferences?.desired_role || profile.jobTitle || '');
        setSeniority((profile.preferences?.searchProfile?.seniority || resolvedIntent.seniority || '') as CandidateSeniority | '');
        setIncludeAdjacentDomains(profile.preferences?.searchProfile?.includeAdjacentDomains ?? true);
        setProfileVisibility((profile.preferences?.profile_visibility || 'recruiter') as VisibilityChoice);
        setSkillsInput((profile.skills || []).join(', '));
    }, [isOpen, initialStep, profile.address, profile.coordinates, profile.cvUrl, profile.cvText, profile.preferences, profile.jobTitle, profile.skills]);

    useEffect(() => {
        if (!isOpen) return;
        onStepViewed?.(step === 1 ? 'location' : step === 2 ? 'preferences' : step === 3 ? 'cv' : 'done');
    }, [isOpen, onStepViewed, step]);

    const hasLocation = useMemo(() => {
        return Boolean(address) || Boolean(coordinates);
    }, [address, coordinates]);

    const hasCv = useMemo(() => {
        return Boolean(localCvUrl) || Boolean(localCvText);
    }, [localCvUrl, localCvText]);
    const confirmedSkillsCount = useMemo(
        () => skillsInput.split(',').map((x) => x.trim()).filter(Boolean).length,
        [skillsInput]
    );
    const hasPreferencePack = useMemo(() => {
        const roleReady = (targetRole || desiredRole || '').trim().length > 0;
        const domainReady = String(primaryDomain || '').trim().length > 0;
        const salaryReady = (desiredSalaryMin || '').trim().length > 0 || (desiredSalaryMax || '').trim().length > 0;
        return roleReady && domainReady && salaryReady;
    }, [desiredRole, desiredSalaryMin, desiredSalaryMax, primaryDomain, targetRole]);

    if (!isOpen) return null;

    const baseProfile: UserProfile = {
        ...profile,
        address: address || profile.address,
        coordinates: coordinates || profile.coordinates
    };

    const moveToNextAfterLocation = () => {
        onStepCompleted?.('location');
        setStep(2);
    };

    const handleVerifyAddress = async () => {
        if (!address) return;
        setIsSavingLocation(true);
        setAddressStatus('verifying');

        try {
            const coords = await resolveAddressToCoordinates(address);
            if (coords) {
                setCoordinates(coords);
                setAddressStatus('success');
                await Promise.resolve(onUpdateProfile({ ...baseProfile, address, coordinates: coords }, true));
                if (onRefreshProfile) {
                    await onRefreshProfile();
                }
                moveToNextAfterLocation();
            } else {
                setAddressStatus('error');
            }
        } catch (error) {
            console.error('Address verification failed:', error);
            setAddressStatus('error');
        } finally {
            setIsSavingLocation(false);
        }
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert(t('onboarding.location.error'));
            return;
        }

        setIsSavingLocation(true);
        setAddressStatus('verifying');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                const label = address || profile.address || (t('financial.current_location_label', { defaultValue: 'Current location' }) as string);

                setCoordinates(coords);
                setAddress(label);
                setAddressStatus('success');
                try {
                    await Promise.resolve(onUpdateProfile({ ...baseProfile, address: label, coordinates: coords }, true));
                    if (onRefreshProfile) {
                        await onRefreshProfile();
                    }
                    moveToNextAfterLocation();
                } catch (error) {
                    console.error('Failed to save location:', error);
                } finally {
                    setIsSavingLocation(false);
                }
            },
            (error) => {
                console.warn('Geolocation failed:', error);
                setAddressStatus('error');
                setIsSavingLocation(false);
                alert(t('onboarding.location.error'));
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
        );
    };

    const handleCvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || isUploadingCv) return;

        const validationError = validateCvFile(file);
        if (validationError === 'type') {
            alert(t('onboarding.cv.type_error'));
            return;
        }
        if (validationError === 'size') {
            alert(t('onboarding.cv.size_error'));
            return;
        }

        setIsUploadingCv(true);
        setCvStatus('verifying');

        try {
            const { cvUrl, parsedData } = await uploadAndParseCv(baseProfile, file, {
                isPremium,
                aiCvParsingEnabled
            });

            const updatedProfile = mergeProfileWithParsedCv(baseProfile, cvUrl, parsedData);
            await Promise.resolve(onUpdateProfile(updatedProfile, true));
            if (onRefreshProfile) {
                await onRefreshProfile();
            }

            setLocalCvUrl(cvUrl);
            setLocalCvText(updatedProfile.cvText);
            setCvStatus('success');
            onStepCompleted?.('cv');
            alert(t('onboarding.cv.upload_success'));
            setStep(4);
        } catch (error) {
            console.error('CV upload failed:', error);
            setCvStatus('error');
            alert(t('onboarding.cv.upload_error'));
        } finally {
            setIsUploadingCv(false);
            if (cvInputRef.current) {
                cvInputRef.current.value = '';
            }
        }
    };

    const handleSavePreferences = async () => {
        const parsedSkills = skillsInput
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 12);
        if (parsedSkills.length < 3) {
            alert(t('onboarding.skills_minimum', { defaultValue: 'Vyberte alespoň 3 klíčové dovednosti.' }));
            return;
        }
        const salaryMin = desiredSalaryMin ? Number(desiredSalaryMin) : null;
        const salaryMax = desiredSalaryMax ? Number(desiredSalaryMax) : null;
        if ((salaryMin != null && Number.isNaN(salaryMin)) || (salaryMax != null && Number.isNaN(salaryMax))) {
            alert(t('onboarding.salary_invalid', { defaultValue: 'Zadejte plat jako číslo.' }));
            return;
        }

        setIsSavingPreferences(true);
        try {
            const nextSearchProfile = {
                ...createDefaultCandidateSearchProfile(),
                ...(baseProfile.preferences?.searchProfile || {}),
                primaryDomain: primaryDomain || null,
                targetRole: targetRole || desiredRole || '',
                seniority: seniority || null,
                includeAdjacentDomains,
            };
            await Promise.resolve(onUpdateProfile({
                ...baseProfile,
                jobTitle: targetRole || desiredRole || baseProfile.jobTitle,
                skills: parsedSkills,
                preferences: {
                    ...baseProfile.preferences,
                    desired_role: targetRole || desiredRole || '',
                    desired_salary_min: salaryMin,
                    desired_salary_max: salaryMax,
                    desired_employment_type: desiredEmploymentType,
                    profile_visibility: profileVisibility,
                    searchProfile: nextSearchProfile,
                }
            }, true));
            if (onRefreshProfile) {
                await onRefreshProfile();
            }
            onStepCompleted?.('preferences');
            setStep(3);
        } catch (error) {
            console.error('Failed to save candidate preferences:', error);
            alert(t('onboarding.save_error', { defaultValue: 'Nepodařilo se uložit preference.' }));
        } finally {
            setIsSavingPreferences(false);
        }
    };

    const renderStepIndicator = () => (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            <span className={step >= 1 ? 'text-[var(--accent)]' : ''}>1</span>
            <span>•</span>
            <span className={step >= 2 ? 'text-[var(--accent)]' : ''}>2</span>
            <span>•</span>
            <span className={step >= 3 ? 'text-[var(--accent)]' : ''}>3</span>
            <span>•</span>
            <span className={step >= 4 ? 'text-[var(--accent)]' : ''}>4</span>
        </div>
    );

    const renderLocationStep = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{t('onboarding.step_location.title')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{t('onboarding.step_location.desc')}</p>
            </div>

            <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('profile.address')}</label>
                <div className="relative">
                    <MapPin size={18} className="absolute left-3 top-3 text-slate-400" />
                    <input
                        value={address}
                        onChange={(e) => {
                            setAddress(e.target.value);
                            setAddressStatus('idle');
                        }}
                        placeholder={t('profile.address_placeholder')}
                        className="app-modal-input pl-10 dark:[color-scheme:dark]"
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleUseCurrentLocation}
                    disabled={isSavingLocation}
                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    {isSavingLocation ? <Loader2 className="inline-block animate-spin mr-2" size={16} /> : null}
                    {t('onboarding.location.use_current')}
                </button>
                <button
                    onClick={handleVerifyAddress}
                    disabled={isSavingLocation || !address}
                    className="app-button-primary flex-1 disabled:opacity-50"
                >
                    {isSavingLocation ? <Loader2 className="inline-block animate-spin mr-2" size={16} /> : null}
                    {t('onboarding.location.verify')}
                </button>
            </div>

            {addressStatus === 'success' && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={16} />
                    {t('onboarding.location.verified')}
                </div>
            )}
            {addressStatus === 'error' && (
                <div className="text-sm text-rose-600 dark:text-rose-400">
                    {t('onboarding.location.error')}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                    onClick={onClose}
                    className="app-button-secondary flex-1"
                >
                    {t('onboarding.cta_skip')}
                </button>
                <button
                    onClick={() => setStep(2)}
                    className="app-button-primary flex-1"
                >
                    {t('onboarding.cta_next')}
                </button>
            </div>
        </div>
    );

    const renderPreferencesStep = () => (
        <div className="space-y-5">
            <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {t('onboarding.step_preferences.title', { defaultValue: 'Co hledáte teď' })}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {t('onboarding.step_preferences.desc', { defaultValue: 'Nastavte obor, cílovou roli, senioritu a základní očekávání. Díky tomu bude feed už od začátku skutečně váš.' })}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {t('onboarding.pref_domain', { defaultValue: 'Hlavní obor' })}
                    <select
                        value={primaryDomain}
                        onChange={(e) => setPrimaryDomain((e.target.value || '') as CandidateDomainKey | '')}
                        className="app-modal-input mt-1 dark:[color-scheme:dark]"
                    >
                        <option value="">{t('onboarding.pref_domain_placeholder', { defaultValue: 'Vyberte obor' })}</option>
                        {domainOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {t('onboarding.pref_seniority', { defaultValue: 'Seniorita' })}
                    <select
                        value={seniority}
                        onChange={(e) => setSeniority((e.target.value || '') as CandidateSeniority | '')}
                        className="app-modal-input mt-1 dark:[color-scheme:dark]"
                    >
                        <option value="">{t('onboarding.pref_seniority_placeholder', { defaultValue: 'Nevybráno' })}</option>
                        <option value="entry">{t('onboarding.pref_seniority_entry', { defaultValue: 'Entry / trainee' })}</option>
                        <option value="junior">{t('onboarding.pref_seniority_junior', { defaultValue: 'Junior' })}</option>
                        <option value="medior">{t('onboarding.pref_seniority_medior', { defaultValue: 'Medior' })}</option>
                        <option value="senior">{t('onboarding.pref_seniority_senior', { defaultValue: 'Senior' })}</option>
                        <option value="lead">{t('onboarding.pref_seniority_lead', { defaultValue: 'Lead / Head' })}</option>
                    </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:col-span-2">
                    {t('onboarding.pref_role', { defaultValue: 'Cílová role' })}
                    <input
                        value={targetRole}
                        onChange={(e) => {
                            setTargetRole(e.target.value);
                            setDesiredRole(e.target.value);
                        }}
                        placeholder={t('onboarding.pref_role_placeholder', { defaultValue: 'Např. Product Manager, Recepční, Finanční účetní' })}
                        className="app-modal-input mt-1 dark:[color-scheme:dark]"
                    />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {t('onboarding.pref_salary_min', { defaultValue: 'Mzda od (CZK)' })}
                    <input
                        value={desiredSalaryMin}
                        onChange={(e) => setDesiredSalaryMin(e.target.value)}
                        inputMode="numeric"
                        placeholder="45000"
                        className="app-modal-input mt-1 dark:[color-scheme:dark]"
                    />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {t('onboarding.pref_salary_max', { defaultValue: 'Mzda do (CZK)' })}
                    <input
                        value={desiredSalaryMax}
                        onChange={(e) => setDesiredSalaryMax(e.target.value)}
                        inputMode="numeric"
                        placeholder="90000"
                        className="app-modal-input mt-1 dark:[color-scheme:dark]"
                    />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {t('onboarding.pref_type', { defaultValue: 'Typ úvazku' })}
                    <select
                        value={desiredEmploymentType}
                        onChange={(e) => setDesiredEmploymentType(e.target.value as EmploymentChoice)}
                        className="app-modal-input mt-1 dark:[color-scheme:dark]"
                    >
                        <option value="full_time">{t('onboarding.pref_type_full', { defaultValue: 'Full-time' })}</option>
                        <option value="part_time">{t('onboarding.pref_type_part', { defaultValue: 'Part-time' })}</option>
                        <option value="contract">{t('onboarding.pref_type_contract', { defaultValue: 'Contract' })}</option>
                        <option value="internship">{t('onboarding.pref_type_intern', { defaultValue: 'Internship' })}</option>
                        <option value="temporary">{t('onboarding.pref_type_temp', { defaultValue: 'Temporary' })}</option>
                    </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {t('onboarding.pref_visibility', { defaultValue: 'Viditelnost profilu' })}
                    <select
                        value={profileVisibility}
                        onChange={(e) => setProfileVisibility(e.target.value as VisibilityChoice)}
                        className="app-modal-input mt-1 dark:[color-scheme:dark]"
                    >
                        <option value="private">{t('onboarding.visibility_private', { defaultValue: 'Private' })}</option>
                        <option value="recruiter">{t('onboarding.visibility_recruiter', { defaultValue: 'Only recruiters' })}</option>
                        <option value="public">{t('onboarding.visibility_public', { defaultValue: 'Public' })}</option>
                    </select>
                </label>
                <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
                    <input
                        type="checkbox"
                        checked={includeAdjacentDomains}
                        onChange={(e) => setIncludeAdjacentDomains(e.target.checked)}
                        className="size-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[rgba(var(--accent-rgb),0.25)]"
                    />
                    <span>{t('onboarding.pref_adjacent', { defaultValue: 'Zobrazovat i příbuzné role, když sedí zbytek mé situace' })}</span>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:col-span-2">
                    {t('onboarding.pref_skills', { defaultValue: 'Top skills (min. 3)' })}
                    <textarea
                        value={skillsInput}
                        onChange={(e) => setSkillsInput(e.target.value)}
                        placeholder={t('onboarding.pref_skills_placeholder', { defaultValue: 'Např. SQL, komunikace se zákazníkem, Python, triáž' })}
                        className="app-modal-input mt-1 min-h-[90px] dark:[color-scheme:dark]"
                    />
                </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                    onClick={() => setStep(1)}
                    className="app-button-secondary flex-1"
                >
                    {t('onboarding.cta_back')}
                </button>
                <button
                    onClick={handleSavePreferences}
                    disabled={isSavingPreferences}
                    className="app-button-primary flex-1 disabled:opacity-60"
                >
                    {isSavingPreferences ? <Loader2 className="inline-block animate-spin mr-2" size={16} /> : null}
                    {t('onboarding.cta_continue', { defaultValue: 'Pokračovat' })}
                </button>
            </div>
        </div>
    );

    const renderCvStep = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {t('onboarding.step_cv.title', { defaultValue: supportStepCopy.title })}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {t('onboarding.step_cv.desc', { defaultValue: supportStepCopy.desc })}
                </p>
            </div>

            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
                <FileText size={32} className="mx-auto mb-3 text-[var(--accent)]" />
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {t('profile.upload_cv_desc', { defaultValue: supportStepCopy.uploadBody })}
                </p>
                <input
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleCvUpload}
                    disabled={isUploadingCv}
                />
                <button
                    onClick={() => cvInputRef.current?.click()}
                    disabled={isUploadingCv}
                    className="app-button-primary inline-flex disabled:opacity-50"
                >
                    {isUploadingCv ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    {t('onboarding.cta_upload', { defaultValue: supportStepCopy.uploadCta })}
                </button>
            </div>

            <div className="app-premium-note">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles size={16} />
                    {isCsLike ? 'Co odemyká premium' : 'What premium unlocks'}
                </div>
                <p className="mt-2 text-sm leading-6">
                    {supportStepCopy.premiumNote}
                </p>
            </div>

            <button
                onClick={() => {
                    if (isPremium) {
                        setShowAIGuide(true);
                    } else {
                        onOpenPremium(t('onboarding.feature_dictate', { defaultValue: isCsLike ? 'AI draft podkladů' : 'AI supporting draft' }));
                    }
                }}
                className="app-button-secondary w-full"
            >
                <Sparkles size={16} />
                {t('onboarding.cta_dictate', { defaultValue: supportStepCopy.dictateCta })}
            </button>

            {cvStatus === 'success' && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={16} />
                    {t('onboarding.cv.upload_success', { defaultValue: supportStepCopy.success })}
                </div>
            )}
            {cvStatus === 'error' && (
                <div className="text-sm text-rose-600 dark:text-rose-400">
                    {t('onboarding.cv.upload_error')}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                    onClick={() => setStep(2)}
                    className="app-button-secondary flex-1"
                >
                    {t('onboarding.cta_back')}
                </button>
                <button
                    onClick={onClose}
                    className="app-button-secondary flex-1"
                >
                    {t('onboarding.cta_skip')}
                </button>
                <button
                    onClick={() => {
                        onStepCompleted?.('cv');
                        setStep(4);
                    }}
                    className="app-button-primary flex-1"
                >
                    {t('onboarding.cta_next')}
                </button>
            </div>
        </div>
    );

    const renderDoneStep = () => (
        <div className="space-y-6 text-center">
            <div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">{t('onboarding.step_done.title')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{t('onboarding.step_done.desc')}</p>
            </div>

            <div className="grid gap-3 text-left">
                <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('onboarding.summary.location')}</span>
                    </div>
                    <span className={`text-xs font-bold ${hasLocation ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {hasLocation ? t('onboarding.summary.done') : t('onboarding.summary.missing')}
                    </span>
                </div>
                <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('onboarding.summary.cv')}</span>
                    </div>
                    <span className={`text-xs font-bold ${hasCv ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {hasCv ? t('onboarding.summary.done') : t('onboarding.summary.missing')}
                    </span>
                </div>
                <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {t('onboarding.summary.skills', { defaultValue: 'Top skills (3+)' })}
                        </span>
                    </div>
                    <span className={`text-xs font-bold ${confirmedSkillsCount >= 3 ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {confirmedSkillsCount >= 3 ? t('onboarding.summary.done') : t('onboarding.summary.missing')}
                    </span>
                </div>
                <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {t('onboarding.summary.preferences', { defaultValue: 'Role + salary preference' })}
                        </span>
                    </div>
                    <span className={`text-xs font-bold ${hasPreferencePack ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {hasPreferencePack ? t('onboarding.summary.done') : t('onboarding.summary.missing')}
                    </span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                    onClick={() => setStep(hasCv ? 2 : 3)}
                    className="app-button-secondary flex-1"
                >
                    {t('onboarding.cta_back')}
                </button>
                <button
                    onClick={() => {
                        if (onGoToProfile) {
                            onGoToProfile();
                        } else {
                            onComplete();
                        }
                    }}
                    className="app-button-secondary flex-1"
                >
                    {t('onboarding.cta_profile')}
                </button>
                <button
                    onClick={() => {
                        onStepCompleted?.('done');
                        onComplete();
                    }}
                    className="app-button-primary flex-1"
                >
                    {t('onboarding.cta_finish')}
                </button>
            </div>
        </div>
    );

    return (
        <div className="app-modal-backdrop z-[150]">
            <div
                className="absolute inset-0"
                onClick={onClose}
            ></div>

            <div className="app-modal-panel max-h-[90vh] max-w-3xl overflow-y-auto animate-in zoom-in-95 duration-300">
                <div className="app-modal-topline"></div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 rounded-full p-2 text-[var(--text-faint)] transition hover:bg-black/5 hover:text-[var(--text-strong)] dark:hover:bg-white/5"
                >
                    <X size={20} />
                </button>

                <div className="app-modal-surface m-4 p-8 sm:m-5 sm:p-10">
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <div className="app-modal-kicker w-fit">
                                <Sparkles size={12} />
                                {isCsLike ? 'Základ kandidátského profilu' : 'Candidate setup'}
                            </div>
                            <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{t('onboarding.title')}</h2>
                            <div className="mt-2">{renderStepIndicator()}</div>
                        </div>
                    </div>

                    {step === 1 && renderLocationStep()}
                    {step === 2 && renderPreferencesStep()}
                    {step === 3 && renderCvStep()}
                    {step === 4 && renderDoneStep()}
                </div>
            </div>

            {showAIGuide && (
                <AIGuidedProfileWizard
                    profile={baseProfile}
                    onClose={() => setShowAIGuide(false)}
                    onApply={async (updates) => {
                        const updated = { ...baseProfile, ...updates };
                        await Promise.resolve(onUpdateProfile(updated, true));
                        if (onRefreshProfile) {
                            await onRefreshProfile();
                        }
                        setLocalCvText(updated.cvText);
                        setShowAIGuide(false);
                        onStepCompleted?.('cv');
                        setStep(4);
                    }}
                />
            )}
        </div>
    );
};

export default CandidateOnboardingModal;
