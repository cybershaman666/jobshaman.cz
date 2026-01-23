import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { User, FileText, Upload, Sparkles, BrainCircuit, Copy, Briefcase, FileOutput, Plus, Trash2, Edit, GraduationCap, Camera, X } from 'lucide-react';
import { generateStyledCV } from '../services/geminiService';
import { uploadCVFile, uploadProfilePhoto, deleteProfilePhoto, updateUserProfile } from '../services/supabaseService';
import { parseProfileFromCV } from '../services/geminiService';
import Markdown from 'markdown-to-jsx';

interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  onSave: () => void;
}

const CV_TEMPLATES = [
  { id: 'modern', name: 'Moderní', desc: 'Čisté a minimalistické' },
  { id: 'professional', name: 'Profesionální', desc: 'Konzervativní a elegantní' },
  { id: 'creative', name: 'Kreativní', desc: 'Barevné a výrazné' }
];

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onChange, onSave }) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'cv-gen'>('edit');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [isGeneratingCV, setIsGeneratingCV] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [generatedCV, setGeneratedCV] = useState('');
  const [copiedAts, setCopiedAts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Manual CV section handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    try {
      // Convert file to base64 for parsing
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data URL prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Parse CV content
      const parsedData = await parseProfileFromCV({
        base64: base64Data,
        mimeType: file.type
      });

      // Try to upload file to Supabase Storage
      let cvUrl = null;
      try {
        cvUrl = await uploadCVFile(profile.id || '', file);
      } catch (uploadError) {
        console.warn("CV upload failed, but continuing with parsed data:", uploadError);
      }

      // Create updated profile with parsed data
      const updatedProfile = {
        ...profile,
        cvText: parsedData.cvText || profile.cvText || `[Extrahováno z ${file.name}]`,
        cvUrl: cvUrl || undefined,
        name: parsedData.name || profile.name,
        email: parsedData.email || profile.email,
        phone: parsedData.phone || profile.phone,
        jobTitle: parsedData.jobTitle || profile.jobTitle,
        skills: parsedData.skills || profile.skills,
        workHistory: parsedData.workHistory || profile.workHistory,
        education: parsedData.education || profile.education
      };

      // Update local state
      onChange(updatedProfile);

      // Save to Supabase
      await updateUserProfile(profile.id || '', updatedProfile);

      const uploadStatus = cvUrl ? 'nahráno a zpracováno' : 'zpracováno';
      alert(`CV úspěšně ${uploadStatus}! Extrahováno ${parsedData.skills?.length || 0} dovedností.`);

    } catch (error) {
      console.error('CV processing failed:', error);
      alert("Nepodařilo se zpracovat CV. Zkuste to znovu nebo zvolte jiný soubor.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      alert('Prosím nahrávejte pouze obrázky.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('Obrázek je příliš velký. Maximální velikost je 5MB.');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      // Upload to Supabase Storage
      const photoUrl = await uploadProfilePhoto(profile.id || '', file);
      
      if (photoUrl) {
        onChange({ ...profile, photo: photoUrl });
        alert('Fotka úspěšně nahrána!');
      } else {
        throw new Error('Failed to upload photo');
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

  const removePhoto = async () => {
    if (profile.photo) {
      try {
        await deleteProfilePhoto(profile.id || '', profile.photo);
        onChange({ ...profile, photo: undefined });
        alert('Fotka úspěšně smazána!');
      } catch (error) {
        console.error('Failed to delete photo:', error);
        alert('Nepodařilo se smazat fotku. Zkuste to znovu.');
      }
    }
  };

  const addEducation = () => {
    const newEducation = {
      id: Date.now().toString(),
      school: '',
      degree: '',
      field: '',
      year: ''
    };
    const currentEducation = Array.isArray(profile.education) ? profile.education : [];
    onChange({ ...profile, education: [...currentEducation, newEducation] });
  };

  const updateEducation = (index: number, field: string, value: string) => {
    const currentEducation = Array.isArray(profile.education) ? profile.education : [];
    const updatedEducation = currentEducation.map((edu, i) => 
      i === index ? { ...edu, [field]: value } : edu
    );
    onChange({ ...profile, education: updatedEducation });
  };

  const removeEducation = (index: number) => {
    const currentEducation = Array.isArray(profile.education) ? profile.education : [];
    const updatedEducation = currentEducation.filter((_, i) => i !== index);
    onChange({ ...profile, education: updatedEducation });
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      const currentSkills = Array.isArray(profile.skills) ? profile.skills : [];
      if (!currentSkills.includes(newSkill.trim())) {
        onChange({ ...profile, skills: [...currentSkills, newSkill.trim()] });
        setNewSkill('');
      }
    }
  };

  const addWorkExperience = () => {
    const newExperience = {
      id: Date.now().toString(),
      company: '',
      role: '',
      duration: '',
      description: ''
    };
    const currentWorkHistory = Array.isArray(profile.workHistory) ? profile.workHistory : [];
    onChange({ ...profile, workHistory: [...currentWorkHistory, newExperience] });
  };

  const updateWorkExperience = (index: number, field: string, value: string) => {
    const currentWorkHistory = Array.isArray(profile.workHistory) ? profile.workHistory : [];
    const updatedHistory = currentWorkHistory.map((exp, i) => 
      i === index ? { ...exp, [field]: value } : exp
    );
    onChange({ ...profile, workHistory: updatedHistory });
  };

  const removeWorkExperience = (index: number) => {
    const currentWorkHistory = Array.isArray(profile.workHistory) ? profile.workHistory : [];
    const updatedHistory = currentWorkHistory.filter((_, i) => i !== index);
    onChange({ ...profile, workHistory: updatedHistory });
  };

  const handleGenerateCV = async () => {
    setIsGeneratingCV(true);
    try {
      const result = await generateStyledCV(profile, selectedTemplate);
      setGeneratedCV(result);
    } catch (error) {
      console.error('CV generation failed:', error);
      alert('Nepodařilo se vygenerovat CV. Zkuste to znovu.');
    } finally {
      setIsGeneratingCV(false);
    }
  };

  const copyAtsResult = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAts(true);
    setTimeout(() => setCopiedAts(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 transition-colors duration-300">
      
      {/* Header Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('edit')}
            className={`flex-1 p-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'edit' ? 'border-cyan-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <User size={18} /> Profil & Data
          </button>
          <button 
            onClick={() => setActiveTab('cv-gen')}
            className={`flex-1 p-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'cv-gen' ? 'border-cyan-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <FileOutput size={18} /> CV Generátor
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {(() => {
          switch (activeTab) {
            case 'edit': return (
              <div className="space-y-8 animate-in slide-in-from-right-4">
                 {/* Manual Entry Header */}
                 <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                   <div className="flex items-center gap-3 mb-4">
                      <Edit className="w-5 h-5 text-cyan-600" />
                     <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                       Manuální zadání údajů
                     </h3>
                   </div>
                    <p className="text-sm text-cyan-600 dark:text-cyan-400">
                     Vyplňte své údaje ručně. Můžete také nahrát CV soubor pro doplnění informací.
                   </p>
                 </div>

                 {/* Manual Entry Section */}
                 <div className="space-y-6 animate-in slide-in-from-top-2">
                   {/* Personal Photo and Information Section */}
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Personal Photo Section */}
                     <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                       <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                         <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Camera className="w-5 h-5 text-cyan-600" />
                           Profilová fotka
                         </h3>
                       </div>
                       <div className="p-6">
                         <div className="flex items-center gap-6">
                           {/* Photo Preview */}
                           <div className="relative">
                             {profile.photo ? (
                               <div className="relative group">
                                 <img
                                   src={profile.photo}
                                   alt="Profilová fotka"
                                   className="w-24 h-24 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700"
                                 />
                                 <button
                                   onClick={removePhoto}
                                   className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                                 >
                                   <X className="w-3 h-3" />
                                 </button>
                               </div>
                             ) : (
                               <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-4 border-slate-200 dark:border-slate-700">
                                 <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                               </div>
                             )}
                           </div>

                           {/* Upload Controls */}
                           <div className="flex-1">
                             <input
                               ref={photoInputRef}
                               type="file"
                               accept="image/*"
                               onChange={handlePhotoUpload}
                               className="hidden"
                             />
                             
                             <button
                               onClick={() => photoInputRef.current?.click()}
                               disabled={isUploadingPhoto}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                               {isUploadingPhoto ? 'Nahrávám...' : profile.photo ? 'Změnit fotku' : 'Nahrát fotku'}
                             </button>
                             
                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                               Formát: JPG, PNG. Maximální velikost: 5MB
                             </p>
                           </div>
                         </div>
                       </div>
                     </div>

                     {/* Personal Information */}
                     <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                       <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                         <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-cyan-600" />
                           Osobní údaje
                         </h3>
                       </div>
                       <div className="p-6 space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                               Jméno
                             </label>
                             <input
                               type="text"
                               value={profile.name || ''}
                               onChange={(e) => onChange({...profile, name: e.target.value})}
                                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                placeholder="Jméno Příjmení"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                E-mail
                              </label>
                              <input
                                type="email"
                                value={profile.email || ''}
                                onChange={(e) => onChange({...profile, email: e.target.value})}
                                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                               placeholder="email@priklad.cz"
                             />
                           </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                               Telefon
                             </label>
                             <input
                               type="tel"
                               value={profile.phone || ''}
                               onChange={(e) => onChange({...profile, phone: e.target.value})}
                                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                               placeholder="+420 123 456 789"
                             />
                           </div>
                           
                           <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                               Pracovní pozice
                             </label>
                             <input
                               type="text"
                               value={profile.jobTitle || ''}
                               onChange={(e) => onChange({...profile, jobTitle: e.target.value})}
                                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                               placeholder="Senior Developer"
                             />
                           </div>
                         </div>

                         <div>
                           <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                             Adresa
                           </label>
                           <input
                             type="text"
                             value={profile.address || ''}
                             onChange={(e) => onChange({...profile, address: e.target.value})}
                             className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                             placeholder="Ulice 123, 123 45 Město"
                           />
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* CV Upload Section */}
                   <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                     <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                       <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <Upload className="w-5 h-5 text-cyan-600" />
                         Nahrání CV (volitelné)
                       </h3>
                     </div>
                     <div className="p-6">
                       <input
                         ref={fileInputRef}
                         type="file"
                         accept=".pdf,.doc,.docx"
                         onChange={handleFileUpload}
                         className="hidden"
                       />
                       
                       <button
                         onClick={() => fileInputRef.current?.click()}
                         disabled={isUploading}
                         className={`w-full px-6 py-4 rounded-lg border-2 border-dashed transition-all ${
                            uploadedFile 
                              ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300' 
                              : 'border-slate-300 dark:border-slate-600 hover:border-cyan-400 text-slate-600 dark:text-slate-400'
                         } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                         <Upload className="w-5 h-5 mr-2 inline" />
                         {isUploading 
                           ? 'Nahrávám...' 
                           : uploadedFile 
                             ? `Nahráno: ${uploadedFile.name}` 
                             : 'Klikněte pro nahrání CV (PDF, DOC, DOCX)'
                         }
                       </button>
                     </div>
                   </div>

                  {/* Work Experience Section */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-cyan-600" />
                        Pracovní zkušenosti
                      </h3>
                       <button
                         onClick={addWorkExperience}
                         className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                       >
                        <Plus className="w-4 h-4" />
                        Přidat zkušenost
                      </button>
                    </div>
                    <div className="p-6 space-y-4">
                      {Array.isArray(profile.workHistory) && profile.workHistory.length > 0 ? (
                        profile.workHistory.map((exp, index) => (
                          <div key={exp.id || index} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Společnost
                                </label>
                                <input
                                  type="text"
                                  value={exp.company || ''}
                                  onChange={(e) => updateWorkExperience(index, 'company', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                  placeholder="Název společnosti"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Pozice
                                </label>
                                <input
                                  type="text"
                                  value={exp.role || ''}
                                  onChange={(e) => updateWorkExperience(index, 'role', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                  placeholder="Vaše pozice"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Doba trvání
                                </label>
                                <input
                                  type="text"
                                  value={exp.duration || ''}
                                  onChange={(e) => updateWorkExperience(index, 'duration', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                  placeholder="2020 - 2023"
                                />
                              </div>
                              
                              <div className="flex items-end">
                                <button
                                  onClick={() => removeWorkExperience(index)}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Odstranit
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Popis práce
                              </label>
                              <textarea
                                value={exp.description || ''}
                                onChange={(e) => updateWorkExperience(index, 'description', e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none h-20"
                                placeholder="Popis vašich hlavních povinností a úspěchů..."
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Zatím nemáte přidané žádné pracovní zkušenosti.</p>
                          <p className="text-sm">Klikněte na "Přidat zkušenost" pro začátek.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Education Section */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-cyan-600" />
                        Vzdělání
                      </h3>
                       <button
                         onClick={addEducation}
                         className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                       >
                        <Plus className="w-4 h-4" />
                        Přidat vzdělání
                      </button>
                    </div>
                    <div className="p-6 space-y-4">
                      {Array.isArray(profile.education) && profile.education.length > 0 ? (
                        profile.education.map((edu, index) => (
                          <div key={edu.id || index} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Škola
                                </label>
                                <input
                                  type="text"
                                  value={edu.school || ''}
                                  onChange={(e) => updateEducation(index, 'school', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                  placeholder="Název školy"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Stupeň vzdělání
                                </label>
                                <select
                                  value={edu.degree || ''}
                                  onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                >
                                  <option value="">Vyberte stupeň</option>
                                  <option value="Středoškolské">Středoškolské</option>
                                  <option value="Vyšší odborné">Vyšší odborné</option>
                                  <option value="Vysokoškolské bakalářské">Vysokoškolské bakalářské</option>
                                  <option value="Vysokoškolské magisterské">Vysokoškolské magisterské</option>
                                  <option value="Vysokoškolské doktorské">Vysokoškolské doktorské</option>
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Obor
                                </label>
                                <input
                                  type="text"
                                  value={edu.field || ''}
                                  onChange={(e) => updateEducation(index, 'field', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                  placeholder="Název oboru"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Rok ukončení
                                </label>
                                <input
                                  type="text"
                                  value={edu.year || ''}
                                  onChange={(e) => updateEducation(index, 'year', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                  placeholder="2023"
                                />
                              </div>
                              
                              <div className="flex items-end">
                                <button
                                  onClick={() => removeEducation(index)}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Odstranit
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Zatím nemáte přidané žádné vzdělání.</p>
                          <p className="text-sm">Klikněte na "Přidat vzdělání" pro začátek.</p>
                        </div>
                      )}
                    </div>
                   </div>

                   {/* Skills Section */}
                   <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                     <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                       <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <BrainCircuit className="w-5 h-5 text-cyan-600" />
                         Dovednosti
                       </h3>
                     </div>
                     <div className="p-6">
                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                         Vaše dovednosti
                       </label>
                       <div className="space-y-3">
                         <div className="flex flex-wrap gap-2 mb-3">
                           {Array.isArray(profile.skills) ? profile.skills.map((skill, index) => (
                             <span 
                               key={index}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full text-sm"
                             >
                               {skill}
                               <button
                                 onClick={() => {
                                   const newSkills = [...profile.skills!];
                                   newSkills.splice(index, 1);
                                   onChange({...profile, skills: newSkills});
                                 }}
                                  className="hover:text-cyan-900 dark:hover:text-cyan-100"
                               >
                                 ×
                               </button>
                             </span>
                           )) : null}
                         </div>
                         <div className="flex gap-2">
                           <input
                             type="text"
                             value={newSkill}
                             onChange={(e) => setNewSkill(e.target.value)}
                             onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                              className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                             placeholder="Přidejte dovednost (např. JavaScript)"
                           />
                           <button
                             onClick={addSkill}
                              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                           >
                             <Plus className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                     </div>
                   </div>

                     {/* CV Text Section */}
                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <FileText className="w-5 h-5 text-cyan-600" />
                          Text životopisu
                        </h3>
                      </div>
                      <div className="p-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Plný text vašeho životopisu (volitelné)
                        </label>
                        <textarea
                          value={profile.cvText || ''}
                          onChange={(e) => onChange({...profile, cvText: e.target.value})}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-40"
                          placeholder="Vložte sem plný text vašeho životopisu, nebo jej nahoře nahrajte jako soubor..."
                        />
                      </div>
                    </div>
                  </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button 
                    onClick={onSave}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                  >
                    Uložit změny
                  </button>
                </div>
              </div>
            );

            case 'cv-gen': return (
              <div className="animate-in slide-in-from-right-4 space-y-8">
                {/* CV Generator Content */}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Generátor Životopisu</h3>
                  <p className="text-slate-500 dark:text-slate-400">Vyberte šablonu a JobShaman vytvoří profesionální CV z vašeho profilu.</p>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {CV_TEMPLATES.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTemplate === t.id ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 ring-1 ring-cyan-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-cyan-300'}`}
                    >
                      <span className="font-bold text-slate-900 dark:text-white">{t.name}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.desc}</p>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleGenerateCV}
                  disabled={isGeneratingCV}
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingCV ? <Sparkles className="animate-spin" /> : <Sparkles />}
                  {isGeneratingCV ? 'Generuji...' : 'Vygenerovat CV'}
                </button>

                {/* Generated Result */}
                {generatedCV && (
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl animate-in zoom-in-95">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Náhled (Markdown)</span>
                      <button 
                        onClick={() => copyAtsResult(generatedCV)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Copy size={14} /> {copiedAts ? 'Zkopírováno!' : 'Zkopírovat Text'}
                      </button>
                    </div>
                    <div className="p-8 prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed overflow-auto max-h-[600px] custom-scrollbar bg-white dark:bg-slate-950">
                      <Markdown>{generatedCV}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            );

            default: return null;
          }
        })()}
      </div>
    </div>
  );
};

export default ProfileEditor;