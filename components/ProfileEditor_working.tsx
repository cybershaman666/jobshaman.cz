import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, TransportMode } from '../types';
import { User, FileText, Upload, Sparkles, BrainCircuit, Copy, Check, Briefcase, Loader2, FileOutput, Plus, Trash2, Edit } from 'lucide-react';
import { analyzeUserCV, optimizeCvForAts, parseProfileFromCV, generateStyledCV } from '../services/geminiService';
import { resolveAddressToCoordinates } from '../services/commuteService';
import { updateUserProfile, uploadCVFile } from '../services/supabaseService';
import Markdown from 'markdown-to-jsx';

interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  onSave: () => void;
}

const PRIORITIES_LIST = [
  'Dog Friendly',
  'Child Friendly',
  'Bezbariérový přístup',
  'Flexibilní doba',
  'Remote First',
  '4-denní pracovní týden',
  'LGBTQ+ Friendly',
  'Neurodiversity Friendly'
];

const CV_TEMPLATES = [
    { id: 'ATS Minimal', name: 'ATS Stealth', desc: 'Minimalistický, stroje ho milují.' },
    { id: 'Modern Bold', name: 'Moderní', desc: 'Vizuálně čistý pro lidské oči.' },
    { id: 'Executive', name: 'Executive', desc: 'Formální, zaměřený na výsledky.' }
];

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onChange, onSave }) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'cv-gen'>('edit');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [copiedAts, setCopiedAts] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Address Verification Effect
  useEffect(() => {
      // Check if we already have coords matching the address
      if (profile.coordinates && profile.address) {
          setAddressVerified(true);
      }
  }, []);

  const triggerVerification = async () => {
      if (!profile.address || profile.address.length < 3) return;
      
      setIsVerifyingAddress(true);
      try {
          const coords = await resolveAddressToCoordinates(profile.address);
          if (coords) {
              onChange({ ...profile, coordinates: coords });
              setAddressVerified(true);
          } else {
              setAddressVerified(false);
              onChange({ ...profile, coordinates: undefined }); // Clear if invalid
              alert('Nepodařilo se najít tuto adresu. Zkuste zadat "Město, Ulice" nebo jen "Město".');
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsVerifyingAddress(false);
      }
  };

  const handleAddressBlur = () => {
      // Optional: Auto-verify on blur, but we also have a button now
      if (!addressVerified && profile.address) {
          triggerVerification();
      }
  };

  const updatePref = (key: keyof UserProfile['preferences'], value: any) => {
    onChange({
      ...profile,
      preferences: {
        ...profile.preferences,
        [key]: value
      }
    });
  };

  const handleTransportChange = (mode: TransportMode) => {
    onChange({ ...profile, transportMode: mode });
  };

  const togglePriority = (priority: string) => {
    const current = profile.preferences.priorities || [];
    if (current.includes(priority)) {
        updatePref('priorities', current.filter(p => p !== priority));
    } else {
        updatePref('priorities', [...current, priority]);
    }
  };

  // Image Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              onChange({ ...profile, photo: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

   // CV Upload & Smart Parse
   const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
       if (e.target.files && e.target.files[0]) {
           const file = e.target.files[0];
           
           // Validate file type
           const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
           if (!validTypes.includes(file.type)) {
               alert('Podporované formáty: PDF, JPG, PNG');
               return;
           }
           
           // Validate file size (max 10MB)
           if (file.size > 10 * 1024 * 1024) {
               alert('Maximální velikost souboru je 10 MB');
               return;
           }
           
           setCvFile(file);
           setIsParsing(true);
           
           try {
               // Convert file to Base64 to send to Gemini first
               const base64Data = await new Promise<string>((resolve, reject) => {
                   const reader = new FileReader();
                   reader.onload = () => {
                       const result = reader.result as string;
                       const base64 = result.split(',')[1];
                       resolve(base64);
                   };
                   reader.onerror = reject;
                   reader.readAsDataURL(file);
               }); 
               
               // Call the AI service with actual file data
               const parsedData = await parseProfileFromCV({ 
                   base64: base64Data, 
                   mimeType: file.type 
               });
               
               // Try to upload the file to Supabase Storage (non-blocking)
               let cvUrl = null;
               try {
                   cvUrl = await uploadCVFile(profile.id || 'temp', file);
               } catch (uploadError) {
                   console.warn("CV upload failed, but continuing with parsed data:", uploadError);
                   // Continue without CV URL - parsing still worked
               }
               
               // Create updated profile with parsed data AND CV URL (if available)
               const updatedProfile = {
                   ...profile,
                   cvText: parsedData.cvText || profile.cvText || `[Extrahováno z ${file.name}]`,
                   cvUrl: cvUrl, // Save the CV URL (might be null)
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
               
           } catch (err) {
               console.error('CV processing error:', err);
               alert("Nepodařilo se zpracovat CV. Zkuste to znovu nebo zvolte jiný soubor.");
           } finally {
               setIsParsing(false);
           }
       }
   };

  const handleAnalyzeCV = async () => {
      if (!profile.cvText) return;
      setIsAnalyzing(true);
      try {
          const analysis = await analyzeUserCV(profile.cvText);
          onChange({ ...profile, cvAnalysis: analysis });
      } catch (e) {
          console.error(e);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleAtsOptimize = async () => {
      if (!profile.cvText) return;
      setIsAtsOptimizing(true);
      try {
          const result = await optimizeCvForAts(profile.cvText);
          setAtsResult(result);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAtsOptimizing(false);
      }
  };

  const handleGenerateCV = async () => {
      setIsGeneratingCV(true);
      try {
          const cv = await generateStyledCV(profile, selectedTemplate);
          setGeneratedCV(cv);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingCV(false);
      }
  };

  const copyAtsResult = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedAts(true);
      setTimeout(() => setCopiedAts(false), 2000);
  };

  const removeItem = <T,>(list: T[] | undefined, index: number, field: keyof UserProfile) => {
      if (!list) return;
      const newList = [...list];
      newList.splice(index, 1);
      onChange({ ...profile, [field]: newList });
  };

  // Manual CV section handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    try {
      const cvUrl = await uploadCVFile(profile.id || '', file);
      if (cvUrl) {
        onChange({ ...profile, cvUrl, cvText: `[Uploaded: ${file.name}]` });
        alert('CV úspěšně nahráno!');
      }
    } catch (error) {
      console.error('CV upload failed:', error);
      alert('Nepodařilo se nahrát CV. Zkuste to znovu.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
             <button 
                 onClick={() => setActiveTab('manual-cv')}
                 className={`flex-1 p-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'manual-cv' ? 'border-cyan-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
             >
                  <Edit size={18} /> Manuální údaje
              </button>
                 </div>
             </div>
      <div className="p-8 space-y-8">
         
        { (() => { switch (activeTab) { case 'edit': return (
          <>
             {/* Manual vs Automatic Toggle */}
             <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                 <div className="flex items-center justify-between mb-4">
                     <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                         <FileText className="w-5 h-5 text-indigo-600" />
                         Způsob zadávání údajů
                     </h3>
                     <div className="flex items-center gap-4">
                         <button
                             onClick={() => setUseManualEntry(false)}
                             className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                 !useManualEntry 
                                     ? 'bg-indigo-600 text-white' 
                                     : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                             }`}
                         >
                             <FileOutput className="w-4 h-4 mr-2" />
                             Automatické z CV
                         </button>
                         <button
                             onClick={() => setUseManualEntry(true)}
                             className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                 useManualEntry 
                                     ? 'bg-indigo-600 text-white' 
                                     : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                             }`}
                         >
                             <Edit className="w-4 h-4 mr-2" />
                             Manuální zadání
                         </button>
                     </div>
                 </div>
                 <p className={`text-sm ${!useManualEntry ? 'text-slate-500 dark:text-slate-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                     {!useManualEntry 
                         ? 'JobShaman automaticky extrahuje údaje z vašeho nahratého CV. Můžete také nahrát nový soubor.'
                         : 'Ručně zadávejte všechny své údaje. Pokud máte CV, můžete ho nahrát pro automatické rozpoznání.'
}
                  </p>
               </div>

              {/* Manual CV Entry Section */}
              {useManualEntry && (
                <div className="space-y-6 animate-in slide-in-from-top-2">
                  {/* CV Upload Section */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Upload className="w-5 h-5 text-indigo-600" />
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
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 text-slate-600 dark:text-slate-400'
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
              </div>
                  </div>

                  {/* Manual Entry Forms */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Personal Information */}
                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <User className="w-5 h-5 text-indigo-600" />
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
                              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

                    {/* Skills Section */}
                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <BrainCircuit className="w-5 h-5 text-indigo-600" />
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
                                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                              >
                                {skill}
                                <button
                                  onClick={() => {
                                    const newSkills = [...profile.skills!];
                                    newSkills.splice(index, 1);
                                    onChange({...profile, skills: newSkills});
                                  }}
                                  className="hover:text-indigo-900 dark:hover:text-indigo-100"
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
                              className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="Přidejte dovednost (např. JavaScript)"
                            />
                            <button
                              onClick={addSkill}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Experience */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-indigo-600" />
                        Pracovní zkušenosti
                      </h3>
                      <button
                        onClick={addWorkExperience}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Přidat zkušenost
                      </button>
                    </div>
                    <div className="p-6 space-y-4">
                      {Array.isArray(profile.workHistory) && profile.workHistory.length > 0 ? (
                        profile.workHistory.map((exp, index) => (
                          <div key={index} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
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

                  {/* CV Text Section */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
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
              )}
            </>
); default: return (
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
                    {isGeneratingCV ? <Loader2 className="animate-spin" /> : <Sparkles />}
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
                                <Copy size={14} /> Zkopírovat Text
                            </button>
                        </div>
                        <div className="p-8 prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed overflow-auto max-h-[600px] custom-scrollbar bg-white dark:bg-slate-950">
                            <Markdown>{generatedCV}</Markdown>
                        </div>
                    </div>
                 )}
               </div>
                );
                }
            })()
         }

        <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-slate-800">
            <button 
                onClick={onSave}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-cyan-900/20"
            >
                Uložit Změny
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;
