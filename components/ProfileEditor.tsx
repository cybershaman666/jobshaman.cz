import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, TransportMode, WorkExperience, Education } from '../types';
import CVProfileEditor from './CVProfileEditor';
import { User, MapPin, Car, Bus, Bike, Footprints, FileText, Upload, Sparkles, AlertCircle, TrendingUp, CheckCircle, BrainCircuit, ShieldCheck, Copy, Check, Mail, Phone, Briefcase, Camera, Loader2, Layout, FileOutput, GraduationCap, Plus, Trash2, Map, Search } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'edit' | 'cv-gen' | 'manual-cv'>('manual-cv');
  const [isSaving, setIsSaving] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [copiedAts, setCopiedAts] = useState(false);
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
         
        {activeTab === 'edit' ? (
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
            <>
            {/* Identity Section */}
            <section className="space-y-6">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Photo Upload */}
                    <div className="flex-shrink-0 relative group mx-auto md:mx-0">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 flex items-center justify-center shadow-lg relative">
                            {profile.photo ? (
                                <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User size={48} className="text-slate-400" />
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <Camera className="text-white" size={24} />
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handlePhotoUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <p className="text-xs text-center mt-2 text-slate-500 dark:text-slate-400">Klikněte pro změnu</p>
                    </div>

                    {/* Basic Info Fields */}
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Vaše Jméno</label>
                            <input 
                                type="text" 
                                value={profile.name}
                                onChange={(e) => onChange({...profile, name: e.target.value})}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Pozice / Titul</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-3 text-slate-400 dark:text-slate-500" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="např. Senior Frontend Developer"
                                    value={profile.jobTitle || ''}
                                    onChange={(e) => onChange({...profile, jobTitle: e.target.value})}
                                    className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400 dark:text-slate-500" size={18} />
                                <input 
                                    type="email" 
                                    value={profile.email || ''}
                                    onChange={(e) => onChange({...profile, email: e.target.value})}
                                    className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Telefon</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 text-slate-400 dark:text-slate-500" size={18} />
                                <input 
                                    type="tel" 
                                    value={profile.phone || ''}
                                    onChange={(e) => onChange({...profile, phone: e.target.value})}
                                    className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 flex justify-between">
                                Domácí Adresa
                                {addressVerified && <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle size={12} /> Geocoding OK</span>}
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <MapPin className={`absolute left-3 top-3 ${addressVerified ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} size={18} />
                                    <input 
                                        type="text" 
                                        value={profile.address}
                                        onChange={(e) => {
                                            onChange({...profile, address: e.target.value, coordinates: undefined}); // Reset coords on change
                                            setAddressVerified(false);
                                        }}
                                        onBlur={handleAddressBlur}
                                        onKeyDown={(e) => e.key === 'Enter' && triggerVerification()}
                                        placeholder="např. Václavské náměstí 1, Praha"
                                        className={`w-full pl-10 pr-10 p-3 bg-slate-50 dark:bg-slate-950 border rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:outline-none transition-colors ${addressVerified ? 'border-emerald-500 focus:ring-emerald-500' : 'border-slate-200 dark:border-slate-700 focus:ring-cyan-500'}`}
                                    />
                                </div>
                                <button 
                                    onClick={triggerVerification}
                                    disabled={isVerifyingAddress || !profile.address}
                                    className="px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                                >
                                    {isVerifyingAddress ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                                    Ověřit
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Po zadání adresy klikněte na Ověřit pro výpočet vzdálenosti.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Smart Import Section (Compact Bar) */}
            <section className="bg-indigo-600/5 border border-indigo-500/20 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-500 text-white rounded-md shadow-sm">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">Rychlé vyplnění profilu pomocí AI</h4>
                    </div>
                </div>
                
                <div className="flex-shrink-0 w-full sm:w-auto">
                    <input type="file" onChange={handleCVUpload} accept=".pdf,image/*" className="hidden" id="cv-upload-smart" />
                    <label htmlFor="cv-upload-smart" className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-colors w-full sm:w-auto shadow-sm ${isParsing ? 'bg-slate-100 text-slate-500 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                        {isParsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {isParsing ? 'Analyzuji CV...' : 'Nahrát CV (PDF)'}
                    </label>
                </div>
            </section>

            {/* Work History */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Briefcase size={16} /> Pracovní Zkušenosti
                     </h3>
                     <span className="text-xs text-slate-400">{profile.workHistory?.length || 0} záznamů</span>
                </div>
                
                <div className="space-y-3">
                    {profile.workHistory?.map((job, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4 relative group">
                            <button 
                                onClick={() => removeItem(profile.workHistory, idx, 'workHistory')}
                                className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={16} />
                            </button>
                            <h4 className="font-bold text-slate-900 dark:text-white">{job.role}</h4>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">{job.company} • {job.duration}</div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{job.description}</p>
                        </div>
                    ))}
                    {(!profile.workHistory || profile.workHistory.length === 0) && (
                        <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-sm">
                            Zatím žádné zkušenosti. Nahrajte CV pro automatické vyplnění.
                        </div>
                    )}
                </div>
            </section>

             {/* Education */}
             <section className="space-y-4">
                <div className="flex items-center justify-between">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <GraduationCap size={16} /> Vzdělání
                     </h3>
                     <span className="text-xs text-slate-400">{profile.education?.length || 0} záznamů</span>
                </div>
                
                <div className="space-y-3">
                    {profile.education?.map((edu, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4 relative group">
                            <button 
                                onClick={() => removeItem(profile.education, idx, 'education')}
                                className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={16} />
                            </button>
                            <h4 className="font-bold text-slate-900 dark:text-white">{edu.school}</h4>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{edu.degree} • {edu.year}</div>
                        </div>
                    ))}
                    {(!profile.education || profile.education.length === 0) && (
                        <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-sm">
                            Zatím žádné vzdělání.
                        </div>
                    )}
                </div>
            </section>

            {/* Transport Preferences */}
            <section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Car size={16} /> Styl dojíždění
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { mode: 'car', icon: Car, label: 'Auto' },
                        { mode: 'public', icon: Bus, label: 'MHD / Vlak' },
                        { mode: 'bike', icon: Bike, label: 'Kolo' },
                        { mode: 'walk', icon: Footprints, label: 'Pěšky' }
                    ].map((t) => (
                        <button
                            key={t.mode}
                            onClick={() => handleTransportChange(t.mode as TransportMode)}
                            className={`
                                flex flex-col items-center justify-center p-4 rounded-xl border transition-all
                                ${profile.transportMode === t.mode 
                                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/50' 
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-300'}
                            `}
                        >
                            <t.icon size={24} className="mb-2" />
                            <span className="text-sm font-medium">{t.label}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Deep Preferences (Sliders) */}
            <section className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <TrendingUp size={16} /> Kalibrace "Pravdy"
                </h3>
                
                <div>
                    <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Tolerance dojíždění (jedna cesta)</label>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{profile.preferences.commuteTolerance} min</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="120" step="5"
                        value={profile.preferences.commuteTolerance}
                        onChange={(e) => updatePref('commuteTolerance', parseInt(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full appearance-none"
                    />
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>0 min</span>
                        <span>1 hodina</span>
                        <span>2 hodiny</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Priorita: Práce vs. Život</label>
                            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{profile.preferences.workLifeBalance}/100</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="100"
                            value={profile.preferences.workLifeBalance}
                            onChange={(e) => updatePref('workLifeBalance', parseInt(e.target.value))}
                            className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full appearance-none"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Priorita: Maximalizace příjmu</label>
                            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{profile.preferences.financialGoals}/100</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="100"
                            value={profile.preferences.financialGoals}
                            onChange={(e) => updatePref('financialGoals', parseInt(e.target.value))}
                            className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full appearance-none"
                        />
                    </div>
                </div>
            </section>

            {/* Priorities */}
            <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <AlertCircle size={16} /> Must-Haves (Priority)
                </h3>
                <div className="flex flex-wrap gap-3">
                    {PRIORITIES_LIST.map(p => {
                        const isActive = profile.preferences.priorities?.includes(p);
                        return (
                            <button
                                key={p}
                                onClick={() => togglePriority(p)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${isActive ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* CV Text Area (Master Data) */}
            <section className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
                 <div className="flex justify-between items-center">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <FileText size={16} /> Textová Data Životopisu (Bio)
                     </h3>
                 </div>
                 
                 <textarea 
                    className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Sem vložte text životopisu, pokud import selže..."
                    value={profile.cvText || ''}
                    onChange={(e) => onChange({...profile, cvText: e.target.value})}
                 />

                 <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleAnalyzeCV}
                        disabled={isAnalyzing || !profile.cvText}
                        className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-all flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
                        {isAnalyzing ? 'Analyzuji...' : 'Kariérní Audit'}
                    </button>
                    <button 
                        onClick={handleAtsOptimize}
                        disabled={isAtsOptimizing || !profile.cvText}
                        className="w-full py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isAtsOptimizing ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                        {isAtsOptimizing ? 'Hackuji...' : 'Hacknout ATS (Text)'}
                    </button>
                 </div>
            </section>

            {/* ATS Result Popup (Within Edit Tab) */}
            {atsResult && (
                 <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 animate-in fade-in">
                     <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                            <CheckCircle size={16} /> ATS Optimalizovaný Text
                        </h4>
                        <button 
                            onClick={() => copyAtsResult(atsResult.optimizedText)}
                            className="text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                            {copiedAts ? <Check size={14} /> : <Copy size={14} />} Kopírovat
                        </button>
                     </div>
                     <textarea 
                        readOnly 
                        value={atsResult.optimizedText} 
                        className="w-full h-32 p-3 bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 focus:outline-none"
                     />
                 </div>
            )}
            </>
         ) : activeTab === 'manual-cv' ? (
             <CVProfileEditor 
               profile={profile}
               onSave={onSave}
               onClose={() => setActiveTab('edit')}
               theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
             />
         ) : (
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
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-900 dark:text-white">{t.name}</span>
                                {selectedTemplate === t.id && <CheckCircle size={16} className="text-cyan-500" />}
                            </div>
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
        )}

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
    </div>
  );
};

export default ProfileEditor;
