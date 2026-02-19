import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, WorkExperience, Education, TransportMode, Job } from '../types';
import {
  User,
  Upload,
  X,
  Camera,
  Briefcase,
  GraduationCap,
  Award,
  Plus,
  Trash2,
  Save,
  Link,
  ExternalLink,
  Edit,
  FileText,
  MapPin,
  CheckCircle,
  AlertCircle,
  Bookmark,
  Sparkles,
  Bell
} from 'lucide-react';
import { uploadProfilePhoto } from '../services/supabaseService';
import { validateCvFile, uploadAndParseCv, mergeProfileWithParsedCv } from '../services/cvUploadService';
import { resolveAddressToCoordinates } from '../services/commuteService';
import PremiumFeaturesPreview from './PremiumFeaturesPreview';
import MyInvitations from './MyInvitations';
import AIGuidedProfileWizard from './AIGuidedProfileWizard';
import { redirectToCheckout } from '../services/stripeService';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import { getCurrentSubscription, getPushPermission, isPushSupported, registerPushSubscription, subscribeToPush, unsubscribeFromPush } from '../services/pushNotificationsService';

import TransportModeSelector from './TransportModeSelector';
import SavedJobsPage from './SavedJobsPage';

import { useTranslation } from 'react-i18next';

interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (profile: UserProfile, persist?: boolean) => void | Promise<void>;
  onSave: () => void;
  onRefreshProfile?: () => void | Promise<void>;
  savedJobs?: Job[];
  savedJobIds?: string[];
  onToggleSave?: (jobId: string) => void;
  onJobSelect?: (jobId: string) => void;
  onApplyToJob?: (job: Job) => void;
  selectedJobId?: string | null;
  onDeleteAccount?: () => Promise<boolean>;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  onChange,
  onSave,
  onRefreshProfile,
  savedJobs = [],
  savedJobIds = [],
  onToggleSave,
  onJobSelect,
  onApplyToJob,
  selectedJobId,
  onDeleteAccount
}) => {
  const { t } = useTranslation();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'saved'>('profile');
  const [showAIGuide, setShowAIGuide] = useState(false);
  const [effectiveTier, setEffectiveTier] = useState<string | null>(profile.subscription?.tier || null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // Address Verification State
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [addressVerificationStatus, setAddressVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    let isMounted = true;

    const refreshSubscriptionTier = async () => {
      if (!profile.isLoggedIn || !profile.id) {
        if (isMounted) setEffectiveTier(profile.subscription?.tier || null);
        return;
      }

      try {
        const status = await getSubscriptionStatus(profile.id);
        if (isMounted) {
          setEffectiveTier(status?.tier || profile.subscription?.tier || 'free');
        }
      } catch {
        if (isMounted) setEffectiveTier(profile.subscription?.tier || 'free');
      }
    };

    refreshSubscriptionTier();
    return () => {
      isMounted = false;
    };
  }, [profile.id, profile.isLoggedIn, profile.subscription?.tier]);

  const resolvedTier = (effectiveTier || profile.subscription?.tier || 'free').toLowerCase();
  const normalizedCandidateTier: 'free' | 'premium' = resolvedTier === 'free' ? 'free' : 'premium';
  const isPremium = normalizedCandidateTier === 'premium';
  const aiCvParsingEnabled = String(import.meta.env.VITE_ENABLE_AI_CV_PARSER || 'true').toLowerCase() !== 'false';

  const profileWithResolvedSubscription: UserProfile = {
    ...profile,
    subscription: {
      ...(profile.subscription || {}),
      tier: normalizedCandidateTier
    }
  };



  // Form state for different sections
  const [formData, setFormData] = useState({
    personal: {
      name: profile.name || '',
      jobTitle: profile.jobTitle || '',
      email: profile.email || '',
      phone: profile.phone || '',
      address: profile.address || '',
      linkedIn: (profile as any).linkedIn || '',
      portfolio: (profile as any).portfolio || '',
      github: (profile as any).github || ''
    },
    notifications: {
      dailyDigestEnabled: profile.dailyDigestEnabled ?? true,
      dailyDigestPushEnabled: profile.dailyDigestPushEnabled ?? true,
      dailyDigestTime: profile.dailyDigestTime || '07:30',
      dailyDigestTimezone: profile.dailyDigestTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague'
    },
    experience: profile.workHistory || [],
    education: profile.education || [],
    skills: profile.skills || []
  });

  useEffect(() => {
    const checkPushState = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);
      if (!supported) return;
      setPushPermission(getPushPermission());
      const existing = await getCurrentSubscription();
      setPushSubscribed(Boolean(existing));
    };
    checkPushState();
  }, []);

  // Photo upload handler
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isUploadingPhoto) return;

    if (!file.type.startsWith('image/')) {
      alert(t('profile.photo_type_error'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('profile.photo_size_error'));
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const photoUrl = await uploadProfilePhoto(profile.id || '', file);

      if (photoUrl) {
        onChange({ ...profile, photo: photoUrl }, true);
        alert(t('profile.photo_upload_success'));
      }
    } catch (error) {
      console.error('Photo upload failed:', error);
      alert(t('profile.photo_upload_error'));
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  // CV upload handler
  const handleCVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isUploadingCV) return;

    const validationError = validateCvFile(file);
    if (validationError === 'type') {
      alert(t('profile.cv_type_error'));
      return;
    }
    if (validationError === 'size') {
      alert(t('profile.cv_size_error'));
      return;
    }

    setIsUploadingCV(true);

    try {
      const { cvUrl, parsedData } = await uploadAndParseCv(profile, file, {
        isPremium,
        aiCvParsingEnabled
      });

      // Merge parsed data into profile
      const updatedProfile = mergeProfileWithParsedCv(profile, cvUrl, parsedData);

      // Update local form data to sync UI immediately
      setFormData(prev => ({
        ...prev,
        personal: {
          ...prev.personal,
          name: parsedData.name || prev.personal.name,
          email: parsedData.email || prev.personal.email,
          phone: parsedData.phone || prev.personal.phone,
          jobTitle: parsedData.jobTitle || prev.personal.jobTitle,
        },
        experience: (parsedData.workHistory && parsedData.workHistory.length > 0) ? parsedData.workHistory : prev.experience,
        education: (parsedData.education && parsedData.education.length > 0) ? parsedData.education : prev.education,
        skills: (parsedData.skills && parsedData.skills.length > 0) ? parsedData.skills : prev.skills
      }));

      // Save the updated profile with parsed data
      onChange(updatedProfile, true);
      alert(t('profile.cv_upload_success'));

      // Trigger profile refresh after a short delay to allow UI to sync
      setTimeout(() => {
        if (onRefreshProfile) {
          onRefreshProfile();
        }
      }, 1000);
    } catch (error) {
      console.error('CV upload failed:', error);
      alert(t('profile.cv_upload_error'));
    } finally {
      setIsUploadingCV(false);
      if (cvInputRef.current) {
        cvInputRef.current.value = '';
      }
    }
  };

  // Personal info update handlers
  const handlePersonalInfoChange = (field: string, value: string) => {
    const newFormData = {
      ...formData,
      personal: { ...formData.personal, [field]: value }
    };
    setFormData(newFormData);
    onChange({ ...profile, ...formData.personal, [field]: value });

    // Reset verification if address changes
    if (field === 'address') {
      setAddressVerificationStatus('idle');
    }
  };

  const handleNotificationChange = (field: string, value: string | boolean) => {
    const newNotifications = { ...formData.notifications, [field]: value };
    const newFormData = { ...formData, notifications: newNotifications };
    setFormData(newFormData);
    onChange({
      ...profile,
      dailyDigestEnabled: newNotifications.dailyDigestEnabled,
      dailyDigestPushEnabled: newNotifications.dailyDigestPushEnabled,
      dailyDigestTime: newNotifications.dailyDigestTime,
      dailyDigestTimezone: newNotifications.dailyDigestTimezone
    });
  };

  const handleEnablePush = async () => {
    if (!pushSupported || pushBusy) return;
    setPushBusy(true);
    try {
      const subscription = await subscribeToPush();
      if (!subscription) {
        setPushPermission(getPushPermission());
        return;
      }
      await registerPushSubscription(subscription);
      setPushSubscribed(true);
      setPushPermission('granted');
      const updatedProfile = {
        ...profile,
        dailyDigestPushEnabled: true
      };
      setFormData(prev => ({
        ...prev,
        notifications: { ...prev.notifications, dailyDigestPushEnabled: true }
      }));
      onChange(updatedProfile, true);
    } catch (error) {
      console.error('Push subscription failed:', error);
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    if (!pushSupported || pushBusy) return;
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      setPushSubscribed(false);
      const updatedProfile = {
        ...profile,
        dailyDigestPushEnabled: false
      };
      setFormData(prev => ({
        ...prev,
        notifications: { ...prev.notifications, dailyDigestPushEnabled: false }
      }));
      onChange(updatedProfile, true);
    } catch (error) {
      console.error('Push unsubscribe failed:', error);
    } finally {
      setPushBusy(false);
    }
  };

  const handleVerifyAddress = async () => {
    if (!formData.personal.address) return;

    setIsVerifyingAddress(true);
    setAddressVerificationStatus('idle');

    try {
      const coords = await resolveAddressToCoordinates(formData.personal.address);
      if (coords) {
        setAddressVerificationStatus('success');
        // Update profile with new coordinates
        onChange({
          ...profile,
          ...formData.personal,
          coordinates: coords
        }, true);
      } else {
        setAddressVerificationStatus('error');
      }
    } catch (e) {
      console.error("Address verification failed", e);
      setAddressVerificationStatus('error');
    } finally {
      setIsVerifyingAddress(false);
    }
  };

  // Experience handlers
  const handleAddExperience = () => {
    const newExperience: WorkExperience = {
      id: Date.now().toString(),
      company: '',
      role: '',
      duration: '',
      description: ''
    };
    const newFormData = {
      ...formData,
      experience: [...formData.experience, newExperience]
    };
    setFormData(newFormData);
    onChange({ ...profile, workHistory: newFormData.experience });
  };

  const handleUpdateExperience = (id: string, field: keyof WorkExperience, value: string) => {
    const updatedExperience = formData.experience.map(exp =>
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    const newFormData = { ...formData, experience: updatedExperience };
    setFormData(newFormData);
    onChange({ ...profile, workHistory: updatedExperience });
  };

  const handleRemoveExperience = (id: string) => {
    const updatedExperience = formData.experience.filter(exp => exp.id !== id);
    const newFormData = { ...formData, experience: updatedExperience };
    setFormData(newFormData);
    onChange({ ...profile, workHistory: updatedExperience });
  };

  // Education handlers
  const handleAddEducation = () => {
    const newEducation: Education = {
      id: Date.now().toString(),
      school: '',
      degree: '',
      field: '',
      year: ''
    };
    const newFormData = {
      ...formData,
      education: [...formData.education, newEducation]
    };
    setFormData(newFormData);
    onChange({ ...profile, education: newFormData.education });
  };

  const handleUpdateEducation = (id: string, field: keyof Education, value: string) => {
    const updatedEducation = formData.education.map(edu =>
      edu.id === id ? { ...edu, [field]: value } : edu
    );
    const newFormData = { ...formData, education: updatedEducation };
    setFormData(newFormData);
    onChange({ ...profile, education: updatedEducation });
  };

  const handleRemoveEducation = (id: string) => {
    const updatedEducation = formData.education.filter(edu => edu.id !== id);
    const newFormData = { ...formData, education: updatedEducation };
    setFormData(newFormData);
    onChange({ ...profile, education: updatedEducation });
  };

  // Skills handlers
  const handleAddSkill = () => {
    const newSkill = prompt(t('profile.add_skill_prompt'));
    if (newSkill && newSkill.trim()) {
      const updatedSkills = [...formData.skills, newSkill.trim()];
      const newFormData = { ...formData, skills: updatedSkills };
      setFormData(newFormData);
      onChange({ ...profile, skills: updatedSkills });
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updatedSkills = formData.skills.filter(skill => skill !== skillToRemove);
    const newFormData = { ...formData, skills: updatedSkills };
    setFormData(newFormData);
    onChange({ ...profile, skills: updatedSkills });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-cyan-500"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
                    <Camera size={32} className="text-slate-400" />
                  </div>
                )}

                <label className="absolute bottom-0 right-0 bg-cyan-600 text-white rounded-full p-2 cursor-pointer hover:bg-cyan-700 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                  <Upload size={14} />
                </label>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {profile.name || t('profile.placeholder_name')}
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  {profile.jobTitle || t('profile.placeholder_job')}
                </p>
              </div>
            </div>

            <button
              onClick={onSave}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium flex items-center gap-2 shadow-lg"
            >
              <Save size={18} />
              {t('profile.save_profile')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-1">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${activeTab === 'profile'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
            >
              <User className="w-4 h-4" />
              <span>{t('profile.title')}</span>
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${activeTab === 'saved'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>{t('profile.saved_jobs', { count: savedJobs.length })}</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' ? (
          <>

            {/* Candidate Invitations (if logged in) */}
            {profile.isLoggedIn && (
              <div className="max-w-6xl mx-auto py-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
                  <MyInvitations />
                </div>
              </div>
            )}

            {/* Personal Information Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                      <User className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.personal_info')}</h2>
                  </div>
                  <button
                    onClick={() => setEditingSection(editingSection === 'personal' ? null : 'personal')}
                    className="text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 p-2 rounded-lg transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.full_name')}</label>
                    <input
                      type="text"
                      value={formData.personal.name}
                      onChange={(e) => handlePersonalInfoChange('name', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.job_title')}</label>
                    <input
                      type="text"
                      value={formData.personal.jobTitle}
                      onChange={(e) => handlePersonalInfoChange('jobTitle', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.email')}</label>
                    <input
                      type="email"
                      value={formData.personal.email}
                      onChange={(e) => handlePersonalInfoChange('email', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.phone')}</label>
                    <input
                      type="tel"
                      value={formData.personal.phone}
                      onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.address')}</label>
                  <input
                    type="text"
                    value={formData.personal.address}
                    onChange={(e) => handlePersonalInfoChange('address', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white ${addressVerificationStatus === 'success' ? 'border-emerald-500 pr-12' :
                      addressVerificationStatus === 'error' ? 'border-rose-500' :
                        'border-slate-300 dark:border-slate-600'
                      }`}
                    placeholder={t('profile.address_placeholder')}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleVerifyAddress}
                      disabled={isVerifyingAddress || !formData.personal.address}
                      className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${addressVerificationStatus === 'success'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      {isVerifyingAddress ? (
                        <>
                          <span className="animate-spin">⌛</span> {t('profile.verifying')}
                        </>
                      ) : addressVerificationStatus === 'success' ? (
                        <>
                          <CheckCircle size={14} /> {t('profile.address_verified')}
                        </>
                      ) : (
                        <>
                          <MapPin size={14} /> {t('profile.verify_address')}
                        </>
                      )}
                    </button>

                    {addressVerificationStatus === 'error' && (
                      <span className="text-xs text-rose-500 flex items-center gap-1">
                        <AlertCircle size={12} /> {t('profile.verification_failed')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.linkedin')}</label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="url"
                        value={formData.personal.linkedIn}
                        onChange={(e) => handlePersonalInfoChange('linkedIn', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder={t('profile.linkedin_placeholder')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.portfolio')}</label>
                    <div className="relative">
                      <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="url"
                        value={formData.personal.portfolio}
                        onChange={(e) => handlePersonalInfoChange('portfolio', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder={t('profile.portfolio_placeholder')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.github')}</label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="url"
                        value={formData.personal.github}
                        onChange={(e) => handlePersonalInfoChange('github', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder={t('profile.github_placeholder')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-6">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                      <Bell className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {t('profile.notifications', { defaultValue: 'Notifikace' })}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.notifications.dailyDigestEnabled)}
                      onChange={(e) => handleNotificationChange('dailyDigestEnabled', e.target.checked)}
                    />
                    {t('profile.digest_email', { defaultValue: 'Denní digest e‑mailem' })}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.notifications.dailyDigestPushEnabled)}
                      onChange={(e) => handleNotificationChange('dailyDigestPushEnabled', e.target.checked)}
                    />
                    {t('profile.digest_push', { defaultValue: 'Denní digest jako push' })}
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {t('profile.digest_time', { defaultValue: 'Čas doručení' })}
                    </label>
                    <input
                      type="time"
                      value={formData.notifications.dailyDigestTime}
                      onChange={(e) => handleNotificationChange('dailyDigestTime', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {t('profile.digest_timezone', { defaultValue: 'Časové pásmo' })}
                    </label>
                    <input
                      type="text"
                      value={formData.notifications.dailyDigestTimezone}
                      onChange={(e) => handleNotificationChange('dailyDigestTimezone', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                      placeholder="Europe/Prague"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs text-slate-500">
                    {pushSupported
                      ? `${t('profile.push_status', { defaultValue: 'Push status' })}: ${pushSubscribed ? 'aktivní' : 'neaktivní'} (${pushPermission})`
                      : t('profile.push_unsupported', { defaultValue: 'Push notifikace nejsou v tomto prohlížeči dostupné.' })}
                  </div>
                  {pushSupported && (
                    <>
                      <button
                        onClick={handleEnablePush}
                        disabled={pushBusy}
                        className="px-3 py-1.5 rounded-lg text-xs border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                      >
                        {t('profile.push_enable', { defaultValue: 'Povolit push notifikace' })}
                      </button>
                      <button
                        onClick={handleDisablePush}
                        disabled={pushBusy}
                        className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                      >
                        {t('profile.push_disable', { defaultValue: 'Vypnout push' })}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Transport Mode Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                      <MapPin className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.transport_pref')}</h2>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  {t('profile.transport_desc')}
                </p>

                <TransportModeSelector
                  selectedMode={profile.transportMode || 'public'}
                  onModeChange={(mode: TransportMode) => onChange({ ...profile, transportMode: mode })}
                  compact={true}
                />
              </div>
            </div>

            {/* AI Guided CV / Profile */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                    <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">AI Průvodce životopisem</h2>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Nadiktujte svůj příběh. AI odhalí skryté talenty, doplní profil a vytvoří CV na míru.
                </p>

                {isPremium ? (
                  <button
                    onClick={() => setShowAIGuide(true)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Spustit průvodce
                  </button>
                ) : (
                  <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Dostupné pouze v Premium
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Odemkněte AI průvodce a personalizované doporučení pozic.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (profile.id) {
                          redirectToCheckout('premium', profile.id);
                        }
                      }}
                      className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700"
                    >
                      Upgradovat
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showAIGuide && (
              <AIGuidedProfileWizard
                profile={profile}
                onClose={() => setShowAIGuide(false)}
                onApply={async (updates) => {
                  const updated = { ...profile, ...updates };
                  await Promise.resolve(onChange(updated, true));
                  if (onRefreshProfile) {
                    await onRefreshProfile();
                  }
                  setShowAIGuide(false);
                }}
              />
            )}

            {/* CV Upload Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                    <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.cv_section')}</h2>
                </div>
              </div>

              <div className="p-6">
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleCVUpload}
                  className="hidden"
                />

                <div className={`w-full p-8 border-2 border-dashed rounded-lg transition-colors ${profile.cvUrl ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' : 'border-slate-300 hover:border-cyan-400'
                  }`}>
                  <div className="text-center">
                    <FileText className={`w-12 h-12 mx-auto mb-4 ${profile.cvUrl ? 'text-cyan-600' : 'text-slate-400'}`} />

                    {profile.cvUrl ? (
                      <div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                          {t('profile.cv_uploaded')}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          {profile.cvText || t('profile.cv_analyze_ready')}
                        </p>
                        <button
                          onClick={() => cvInputRef.current?.click()}
                          disabled={isUploadingCV}
                          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                        >
                          {t('profile.replace_cv')}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                          {t('profile.upload_cv')}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          {t('profile.upload_cv_desc')}
                        </p>
                        <button
                          onClick={() => cvInputRef.current?.click()}
                          disabled={isUploadingCV}
                          className={`px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium ${isUploadingCV ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                          {isUploadingCV ? t('profile.uploading') : t('profile.select_cv_file')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {profile.cvUrl && (
                  <div className="mt-4 p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
                    <h4 className="font-medium text-cyan-900 dark:text-cyan-100 mb-2">{t('profile.cv_analysis_title')}</h4>
                    <p className="text-sm text-cyan-700 dark:text-cyan-300">
                      {t('profile.cv_analysis_desc')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Work Experience Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                      <Briefcase className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.experience')}</h2>
                  </div>
                  <button
                    onClick={handleAddExperience}
                    className="text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 p-2 rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {formData.experience.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('profile.no_experience')}</p>
                    <button
                      onClick={handleAddExperience}
                      className="mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      {t('profile.add_first_experience')}
                    </button>
                  </div>
                ) : (
                  formData.experience.map((experience) => (
                    <div key={experience.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {experience.role || t('profile.new_role')} {experience.company && `@ ${experience.company}`}
                        </h3>
                        <button
                          onClick={() => handleRemoveExperience(experience.id)}
                          className="text-red-500 hover:text-red-600 transition-colors"
                          title={t('app.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.company')}</label>
                          <input
                            type="text"
                            value={experience.company}
                            onChange={(e) => handleUpdateExperience(experience.id, 'company', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                            placeholder={t('profile.company_placeholder')}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.role')}</label>
                          <input
                            type="text"
                            value={experience.role}
                            onChange={(e) => handleUpdateExperience(experience.id, 'role', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                            placeholder={t('profile.role_placeholder')}
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.duration')}</label>
                        <input
                          type="text"
                          value={experience.duration}
                          onChange={(e) => handleUpdateExperience(experience.id, 'duration', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                          placeholder={t('profile.duration_placeholder')}
                        />
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.description')}</label>
                        <textarea
                          value={experience.description}
                          onChange={(e) => handleUpdateExperience(experience.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                          rows={3}
                          placeholder={t('profile.description_placeholder')}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Education Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                      <GraduationCap className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.education')}</h2>
                  </div>
                  <button
                    onClick={handleAddEducation}
                    className="text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 p-2 rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {formData.education.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('profile.no_education')}</p>
                    <button
                      onClick={handleAddEducation}
                      className="mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      {t('profile.add_first_education')}
                    </button>
                  </div>
                ) : (
                  formData.education.map((edu) => (
                    <div key={edu.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {edu.degree || t('profile.new_education')} {edu.school && `@ ${edu.school}`}
                        </h3>
                        <button
                          onClick={() => handleRemoveEducation(edu.id)}
                          className="text-red-500 hover:text-red-600 transition-colors"
                          title={t('app.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.school')}</label>
                          <input
                            type="text"
                            value={edu.school}
                            onChange={(e) => handleUpdateEducation(edu.id, 'school', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                            placeholder={t('profile.school_placeholder')}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.degree')}</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) => handleUpdateEducation(edu.id, 'degree', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                            placeholder={t('profile.degree_placeholder')}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.field')}</label>
                          <input
                            type="text"
                            value={edu.field}
                            onChange={(e) => handleUpdateEducation(edu.id, 'field', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                            placeholder={t('profile.field_placeholder')}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.year')}</label>
                          <input
                            type="text"
                            value={edu.year}
                            onChange={(e) => handleUpdateEducation(edu.id, 'year', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                            placeholder={t('profile.year_placeholder')}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Skills Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                      <Award className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.skills')}</h2>
                    <span className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-sm px-2 py-1 rounded-full">
                      {t('profile.skills_count', { count: formData.skills.length })}
                    </span>
                  </div>
                  <button
                    onClick={handleAddSkill}
                    className="text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 p-2 rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {formData.skills.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('profile.no_skills')}</p>
                    <p className="text-sm mt-2 mb-4">{t('profile.skills_key_desc')}</p>
                    <button
                      onClick={handleAddSkill}
                      className="text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      {t('profile.add_first_skill')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {formData.skills.map((skill, index) => (
                        <div key={index} className="group relative">
                          <span className="inline-flex items-center px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 text-sm rounded-full border border-cyan-200 dark:border-cyan-700">
                            {skill}
                            <button
                              onClick={() => handleRemoveSkill(skill)}
                              className="ml-2 text-cyan-600 hover:text-red-500 transition-colors"
                              title={t('app.delete')}
                            >
                              <X size={14} />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                      <h4 className="font-medium text-cyan-900 dark:text-cyan-100 mb-2">{t('profile.skills_importance_title')}</h4>
                      <ul className="text-sm text-cyan-700 dark:text-cyan-300 space-y-1">
                        <li>• {t('profile.skills_importance_1')}</li>
                        <li>• {t('profile.skills_importance_2')}</li>
                        <li>• {t('profile.skills_importance_3')}</li>
                        <li>• {t('profile.skills_importance_4')}</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-red-200 dark:border-red-900/30 overflow-hidden">
              <div className="border-b border-red-100 dark:border-red-900/20 p-4 bg-red-50/50 dark:bg-red-900/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-red-900 dark:text-red-100">{t('profile.danger_zone')}</h2>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  {t('profile.delete_account_warning_desc')}
                </p>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  {t('profile.delete_account')}
                </button>
              </div>
            </div>

            {/* Premium Features Preview */}
            <div className="mt-8">
              <PremiumFeaturesPreview userProfile={profileWithResolvedSubscription} />
            </div>
          </>
        ) : (
          <div className="col-span-1 lg:col-span-12 h-full overflow-hidden">
            <SavedJobsPage
              savedJobs={savedJobs}
              savedJobIds={savedJobIds}
              onToggleSave={onToggleSave || (() => { })}
              onJobSelect={onJobSelect || (() => { })}
              onApplyToJob={onApplyToJob || (() => { })}
              selectedJobId={selectedJobId || null}
              userProfile={profile}
              searchTerm=""
              onSearchChange={() => { }}
            />
          </div>
        )}
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">
                {t('profile.delete_account_warning_title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-center mb-8">
                {t('profile.delete_account_warning_desc')}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (onDeleteAccount) {
                      setIsDeleting(true);
                      try {
                        const success = await onDeleteAccount();
                        if (!success) {
                          setIsDeleting(false);
                          alert(t('profile.delete_account_error'));
                        }
                      } catch (err) {
                        setIsDeleting(false);
                        console.error("Deletion error:", err);
                        alert(t('profile.delete_account_error'));
                      }
                    }
                  }}
                  disabled={isDeleting}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-500/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('app.loading')}</span>
                    </div>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      {t('profile.delete_account_confirm')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                >
                  {t('profile.delete_account_cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;
