
import React, { useState } from 'react';
import { Job, UserProfile } from '../types';
import { X, Upload, FileText, Wand2, CheckCircle, Send, Loader2, BrainCircuit, User, Mail, Phone, Linkedin, Link as LinkIcon } from 'lucide-react';
import { generateCoverLetter } from '../services/geminiService';

interface ApplicationModalProps {
  job: Job;
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'form' | 'submitting' | 'success';

const ApplicationModal: React.FC<ApplicationModalProps> = ({ job, user, isOpen, onClose }) => {
  const [step, setStep] = useState<Step>('form');
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: user.name ? user.name.split(' ')[0] : '',
    lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
    email: '',
    phone: '',
    linkedin: ''
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);

  // Determine if role is suitable for AI Assessment (Knowledge worker vs Manual/Service)
  const isManualLabor = job.tags.some(t => ['Řidič', 'Prodej', 'Logistika', 'Manuální', 'Směnný provoz', 'Gig Economy'].includes(t)) || 
                        job.title.toLowerCase().includes('kurýr') || 
                        job.title.toLowerCase().includes('řidič') || 
                        job.title.toLowerCase().includes('asistent');
  
  const showAiAssessment = !isManualLabor;

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
      const draft = await generateCoverLetter(job.title, job.company, job.description, aiPrompt);
      setCoverLetter(draft);
      setShowAiInput(false); // Close the input, show the result
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = () => {
    setStep('submitting');
    // Simulate API call
    setTimeout(() => {
      setStep('success');
    }, 2000);
  };

  const renderContent = () => {
    if (step === 'success') {
      return (
        <div className="text-center py-12 px-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Přihláška odeslána</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
            Váš profil byl bezpečně předán společnosti {job.company}.
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
                  Zpracovávám shodu kompetencí...
                </p>
                <div className="w-full bg-indigo-100 dark:bg-indigo-900/50 h-1.5 rounded-full mb-3 overflow-hidden">
                   <div className="h-full bg-indigo-500 w-2/3 animate-pulse shadow-[0_0_10px_#6366f1]"></div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Vyhodnocujeme vaši vhodnost na základě dovedností a hodnot, nejen klíčových slov. Pomáháme vám přeskočit první kolo pohovorů.
                </p>
             </div>
          )}

          <button 
            onClick={onClose}
            className="mt-8 px-6 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Zpět na nabídky
          </button>
        </div>
      );
    }

    if (step === 'submitting') {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 animate-in fade-in">
          <Loader2 size={48} className="text-indigo-600 dark:text-indigo-500 animate-spin mb-6" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Odesílám přihlášku...</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Šifruji osobní data a ověřuji přílohy.</p>
        </div>
      );
    }

    return (
      <div className="p-6 sm:p-8 space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Přihlásit se do {job.company}</h2>
          <p className="text-slate-500 dark:text-slate-300">{job.title}</p>
        </div>

        {/* 1. Contact Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Kontaktní údaje</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                <input 
                    type="text" 
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Jméno"
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
                    placeholder="Příjmení"
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
                    placeholder="Emailová adresa"
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
                    placeholder="Telefonní číslo"
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
                    placeholder="Odkaz na LinkedIn profil"
                    className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
                />
            </div>
          </div>
        </div>

        {/* 2. Documents */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Životopis / CV</h3>
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
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Klikněte pro nahrání nebo přetáhněte soubor</p>
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
        </div>

        {/* 3. Cover Letter */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Motivační dopis</h3>
            <button 
              onClick={() => setShowAiInput(!showAiInput)}
              className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium"
            >
              <Wand2 size={12} />
              {showAiInput ? 'Skrýt asistenta' : 'Napsat pomocí AI'}
            </button>
          </div>

          {/* AI Assistant Input */}
          {showAiInput && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-500/20 animate-in slide-in-from-top-2 mb-2">
              <p className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-semibold">Řekněte AI o svých zkušenostech:</p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="např. 5 let React, miluji migrace legacy systémů, zkušenost z medicínského SW..."
                className="w-full p-2 text-sm border border-purple-300 dark:border-purple-500/30 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 h-20 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder:text-slate-500"
              />
              <button
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiPrompt}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-md hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed ml-auto shadow-[0_0_10px_rgba(147,51,234,0.3)]"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                Vygenerovat návrh
              </button>
            </div>
          )}

          <textarea 
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            className="w-full h-40 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500"
            placeholder="Napište svůj motivační dopis sem..."
          />
        </div>

        {/* 4. AI Assessment Link (Conditional) */}
        {showAiAssessment && (
            <div className="bg-indigo-50 dark:bg-indigo-500/5 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 flex flex-col sm:flex-row items-start gap-4">
                <div className="bg-indigo-100 dark:bg-indigo-500/10 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                    <BrainCircuit size={24} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">JobShaman AI Ověření Kompetencí</h4>
                        <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] rounded font-bold uppercase border border-indigo-200 dark:border-indigo-500/30">Beta</span>
                    </div>
                    <p className="text-xs text-indigo-800 dark:text-indigo-200 mb-3 leading-relaxed opacity-80">
                        Tato společnost akceptuje ověřené hodnocení dovedností. Propojte svůj JobShaman profil a přeskočte úvodní technické kolo.
                    </p>
                    <button className="flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/50">
                        <LinkIcon size={12} />
                        Propojit profil hodnocení
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
            Zrušit
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!cvFile || !formData.email || !formData.firstName}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(8,145,178,0.4)]"
          >
            <Send size={18} />
            Odeslat
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
