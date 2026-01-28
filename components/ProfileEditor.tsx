import React, { useState, useRef } from 'react';
import { UserProfile, WorkExperience, Education, TransportMode } from '../types';
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
  AlertCircle
} from 'lucide-react';
import { uploadProfilePhoto, uploadCVFile } from '../services/supabaseService';
import { resolveAddressToCoordinates } from '../services/commuteService';
import PremiumFeaturesPreview from './PremiumFeaturesPreview';
import MyInvitations from './MyInvitations';

import TransportModeSelector from './TransportModeSelector';


interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  onSave: () => void;
  onRefreshProfile?: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onChange, onSave, onRefreshProfile }) => {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Address Verification State
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [addressVerificationStatus, setAddressVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);



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
    experience: profile.workHistory || [],
    education: profile.education || [],
    skills: profile.skills || []
  });

  // Photo upload handler
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isUploadingPhoto) return;

    if (!file.type.startsWith('image/')) {
      alert('Prosím nahrávejte pouze obrázky.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Obrázek je příliš velký. Maximální velikost je 5MB.');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const photoUrl = await uploadProfilePhoto(profile.id || '', file);

      if (photoUrl) {
        onChange({ ...profile, photo: photoUrl });
        alert('Fotka úspěšně nahrána!');
      }
    } catch (error) {
      console.error('Photo upload failed:', error);
      alert('Nepodařilo se nahrát fotku. Zkuste to znovu.');
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

    if (!file.type.match(/(pdf|doc|docx)/)) {
      alert('Prosím nahrávejte pouze PDF, DOC nebo DOCX soubory.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Soubor je příliš velký. Maximální velikost je 10MB.');
      return;
    }

    setIsUploadingCV(true);

    try {
      const cvUrl = await uploadCVFile(profile.id || '', file);
      if (cvUrl) {
        // Just set the CV URL - the parsing will update the profile separately
        onChange({ ...profile, cvUrl });

        // Trigger profile refresh after a short delay to allow parsing to complete
        setTimeout(() => {
          if (onRefreshProfile) {
            onRefreshProfile();
          }
        }, 2000);

        alert('CV úspěšně nahráno a zpracováno!');
      }
    } catch (error) {
      console.error('CV upload failed:', error);
      alert('Nepodařilo se nahrát CV. Zkuste to znovu.');
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
        });
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
    const newSkill = prompt('Přidejte novou dovednost:');
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
                  {profile.name || 'Vaše jméno'}
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  {profile.jobTitle || 'Vaše pracovní pozice'}
                </p>
              </div>
            </div>

            <button
              onClick={onSave}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium flex items-center gap-2 shadow-lg"
            >
              <Save size={18} />
              Uložit profil
            </button>
          </div>
        </div>



        {/* Premium Features Preview */}
        <PremiumFeaturesPreview userProfile={profile} />

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
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Osobní údaje</h2>
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Celé jméno</label>
                <input
                  type="text"
                  value={formData.personal.name}
                  onChange={(e) => handlePersonalInfoChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pracovní pozice</label>
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.personal.email}
                  onChange={(e) => handlePersonalInfoChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Telefon</label>
                <input
                  type="tel"
                  value={formData.personal.phone}
                  onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Adresa</label>
              <input
                type="text"
                value={formData.personal.address}
                onChange={(e) => handlePersonalInfoChange('address', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white ${addressVerificationStatus === 'success' ? 'border-emerald-500 pr-12' :
                  addressVerificationStatus === 'error' ? 'border-rose-500' :
                    'border-slate-300 dark:border-slate-600'
                  }`}
                placeholder="Ulice, město, PSČ"
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
                      <span className="animate-spin">⌛</span> Ověřuji...
                    </>
                  ) : addressVerificationStatus === 'success' ? (
                    <>
                      <CheckCircle size={14} /> Adresa ověřena
                    </>
                  ) : (
                    <>
                      <MapPin size={14} /> Ověřit adresu
                    </>
                  )}
                </button>

                {addressVerificationStatus === 'error' && (
                  <span className="text-xs text-rose-500 flex items-center gap-1">
                    <AlertCircle size={12} /> Nepodařilo se najít souřadnice
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">LinkedIn</label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="url"
                    value={formData.personal.linkedIn}
                    onChange={(e) => handlePersonalInfoChange('linkedIn', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    placeholder="linkedin.com/in/jmeno-prijmeni"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Portfolio</label>
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="url"
                    value={formData.personal.portfolio}
                    onChange={(e) => handlePersonalInfoChange('portfolio', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    placeholder="vasewebova.cz"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">GitHub</label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="url"
                    value={formData.personal.github}
                    onChange={(e) => handlePersonalInfoChange('github', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                    placeholder="github.com/jmeno"
                  />
                </div>
              </div>
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
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Preferovaná doprava</h2>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Jak se radši dopravujete do práce? Tuto informaci budeme používat v "Finanční a dojezdové realitě" u každé pozice.
            </p>

            <TransportModeSelector
              selectedMode={profile.transportMode || 'public'}
              onModeChange={(mode: TransportMode) => onChange({ ...profile, transportMode: mode })}
              compact={true}
            />
          </div>
        </div>

        {/* CV Upload Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Životopis (CV)</h2>
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
                      CV nahráno
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      {profile.cvText || 'CV soubor je k dispozici pro analýzu'}
                    </p>
                    <button
                      onClick={() => cvInputRef.current?.click()}
                      disabled={isUploadingCV}
                      className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                    >
                      Nahradit CV
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      Nahrajte své CV
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      Nahrajte PDF, DOC nebo DOCX soubor (max. 10MB) pro automatickou analýzu dovedností a zkušeností
                    </p>
                    <button
                      onClick={() => cvInputRef.current?.click()}
                      disabled={isUploadingCV}
                      className={`px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium ${isUploadingCV ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                      {isUploadingCV ? 'Nahrávám...' : 'Vybrat soubor CV'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {profile.cvUrl && (
              <div className="mt-4 p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
                <h4 className="font-medium text-cyan-900 dark:text-cyan-100 mb-2">Automatická analýza CV</h4>
                <p className="text-sm text-cyan-700 dark:text-cyan-300">
                  Vaše CV bude automaticky zpracováno pro extrakci dovedností, zkušeností a vzdělání. Tato data nám pomohou lépe porovnat váš profil s požadavky pracovních pozic.
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
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Pracovní zkušenosti</h2>
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
                <p>Zatím nemáte žádné pracovní zkušenosti</p>
                <button
                  onClick={handleAddExperience}
                  className="mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Přidat první zkušenost
                </button>
              </div>
            ) : (
              formData.experience.map((experience) => (
                <div key={experience.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {experience.role || 'Nová pozice'} {experience.company && `@ ${experience.company}`}
                    </h3>
                    <button
                      onClick={() => handleRemoveExperience(experience.id)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Společnost</label>
                      <input
                        type="text"
                        value={experience.company}
                        onChange={(e) => handleUpdateExperience(experience.id, 'company', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder="Název společnosti"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pozice</label>
                      <input
                        type="text"
                        value={experience.role}
                        onChange={(e) => handleUpdateExperience(experience.id, 'role', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder="Název pozice"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Doba působení</label>
                    <input
                      type="text"
                      value={experience.duration}
                      onChange={(e) => handleUpdateExperience(experience.id, 'duration', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                      placeholder="např. 2020 - 2022 (2 roky)"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Popis práce a úspěchy</label>
                    <textarea
                      value={experience.description}
                      onChange={(e) => handleUpdateExperience(experience.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                      rows={3}
                      placeholder="Popište své hlavní odpovědnosti a úspěchy..."
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
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Vzdělání</h2>
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
                <p>Zatím nemáte žádné vzdělání</p>
                <button
                  onClick={handleAddEducation}
                  className="mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Přidat první vzdělání
                </button>
              </div>
            ) : (
              formData.education.map((edu) => (
                <div key={edu.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {edu.degree || 'Nové vzdělání'} {edu.school && `@ ${edu.school}`}
                    </h3>
                    <button
                      onClick={() => handleRemoveEducation(edu.id)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Škola / Univerzita</label>
                      <input
                        type="text"
                        value={edu.school}
                        onChange={(e) => handleUpdateEducation(edu.id, 'school', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder="Název instituce"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stupeň / Titul</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => handleUpdateEducation(edu.id, 'degree', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder="např. Ing., Bc., Mgr."
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Obor</label>
                      <input
                        type="text"
                        value={edu.field}
                        onChange={(e) => handleUpdateEducation(edu.id, 'field', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder="např. Informační technologie"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rok ukončení</label>
                      <input
                        type="text"
                        value={edu.year}
                        onChange={(e) => handleUpdateEducation(edu.id, 'year', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-700 dark:text-white"
                        placeholder="např. 2020"
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
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Dovednosti</h2>
                <span className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-sm px-2 py-1 rounded-full">
                  {formData.skills.length} dovedností
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
                <p>Zatím nemáte žádné dovednosti</p>
                <p className="text-sm mt-2 mb-4">Dovednosti jsou klíčové pro porovnání s požadavky pracovních pozic</p>
                <button
                  onClick={handleAddSkill}
                  className="text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Přidat první dovednost
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
                          title="Smazat"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                  <h4 className="font-medium text-cyan-900 dark:text-cyan-100 mb-2">Proč jsou dovednosti důležité?</h4>
                  <ul className="text-sm text-cyan-700 dark:text-cyan-300 space-y-1">
                    <li>• Umožňují automatické porovnání s požadavky pracovních pozic</li>
                    <li>• Pomáhají doporučit relevantní kurzy pro váš rozvoj</li>
                    <li>• Zvyšují vaši viditelnost pro personalisty</li>
                    <li>• Umožňují personalizovaná doporučení</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;