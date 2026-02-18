import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../types';
import { resolveAddressToCoordinates } from '../services/commuteService';
import { validateCvFile, uploadAndParseCv, mergeProfileWithParsedCv } from '../services/cvUploadService';
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
}

type Step = 1 | 2 | 3;
type Status = 'idle' | 'verifying' | 'success' | 'error';

const CandidateOnboardingModal: React.FC<CandidateOnboardingModalProps> = ({
    isOpen,
    profile,
    onClose,
    onComplete,
    onGoToProfile,
    onUpdateProfile,
    onOpenPremium,
    onRefreshProfile
}) => {
    const { t } = useTranslation();
    const cvInputRef = useRef<HTMLInputElement>(null);

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

    const aiCvParsingEnabled = String(import.meta.env.VITE_ENABLE_AI_CV_PARSER || 'true').toLowerCase() !== 'false';
    const isPremium = (profile.subscription?.tier || 'free').toLowerCase() !== 'free';

    useEffect(() => {
        if (!isOpen) return;
        const missingLocation = !profile.address && !profile.coordinates;
        const missingCv = !profile.cvUrl && !profile.cvText;
        const initialStep: Step = missingLocation ? 1 : (missingCv ? 2 : 3);

        setStep(initialStep);
        setAddress(profile.address || '');
        setCoordinates(profile.coordinates);
        setAddressStatus(profile.coordinates ? 'success' : 'idle');
        setLocalCvUrl(profile.cvUrl);
        setLocalCvText(profile.cvText);
        setCvStatus('idle');
    }, [isOpen, profile.address, profile.coordinates, profile.cvUrl, profile.cvText]);

    const hasLocation = useMemo(() => {
        return Boolean(address) || Boolean(coordinates);
    }, [address, coordinates]);

    const hasCv = useMemo(() => {
        return Boolean(localCvUrl) || Boolean(localCvText);
    }, [localCvUrl, localCvText]);

    if (!isOpen) return null;

    const baseProfile: UserProfile = {
        ...profile,
        address: address || profile.address,
        coordinates: coordinates || profile.coordinates
    };

    const moveToNextAfterLocation = () => {
        if (hasCv) {
            setStep(3);
        } else {
            setStep(2);
        }
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
            alert(t('onboarding.cv.upload_success'));
            setStep(3);
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

    const renderStepIndicator = () => (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className={step >= 1 ? 'text-cyan-500' : ''}>1</span>
            <span>•</span>
            <span className={step >= 2 ? 'text-cyan-500' : ''}>2</span>
            <span>•</span>
            <span className={step >= 3 ? 'text-cyan-500' : ''}>3</span>
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
                        className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
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
                    className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50"
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
                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    {t('onboarding.cta_skip')}
                </button>
                <button
                    onClick={() => setStep(2)}
                    className="flex-1 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90"
                >
                    {t('onboarding.cta_next')}
                </button>
            </div>
        </div>
    );

    const renderCvStep = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{t('onboarding.step_cv.title')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{t('onboarding.step_cv.desc')}</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center">
                <FileText size={32} className="mx-auto text-cyan-600 dark:text-cyan-400 mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {t('profile.upload_cv_desc')}
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
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50"
                >
                    {isUploadingCv ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    {t('onboarding.cta_upload')}
                </button>
            </div>

            <button
                onClick={() => {
                    if (isPremium) {
                        setShowAIGuide(true);
                    } else {
                        onOpenPremium(t('onboarding.feature_dictate', { defaultValue: 'Nadiktování CV' }));
                    }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 rounded-xl text-sm font-semibold hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
            >
                <Sparkles size={16} />
                {t('onboarding.cta_dictate')}
            </button>

            {cvStatus === 'success' && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={16} />
                    {t('onboarding.cv.upload_success')}
                </div>
            )}
            {cvStatus === 'error' && (
                <div className="text-sm text-rose-600 dark:text-rose-400">
                    {t('onboarding.cv.upload_error')}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                    onClick={() => setStep(1)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    {t('onboarding.cta_back')}
                </button>
                <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    {t('onboarding.cta_skip')}
                </button>
                <button
                    onClick={() => setStep(3)}
                    className="flex-1 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90"
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
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                    onClick={() => setStep(hasLocation ? 2 : 1)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
                    className="flex-1 px-4 py-2.5 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 rounded-xl text-sm font-semibold hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                >
                    {t('onboarding.cta_profile')}
                </button>
                <button
                    onClick={onComplete}
                    className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700"
                >
                    {t('onboarding.cta_finish')}
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                onClick={onClose}
            ></div>

            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-full transition-all"
                >
                    <X size={20} />
                </button>

                <div className="p-8 sm:p-10">
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('onboarding.title')}</h2>
                            <div className="mt-2">{renderStepIndicator()}</div>
                        </div>
                    </div>

                    {step === 1 && renderLocationStep()}
                    {step === 2 && renderCvStep()}
                    {step === 3 && renderDoneStep()}
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
                        setStep(3);
                    }}
                />
            )}
        </div>
    );
};

export default CandidateOnboardingModal;
