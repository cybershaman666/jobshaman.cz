
import React, { useState } from 'react';
import { CompanyProfile } from '../types';
import { createCompany } from '../services/supabaseService';
import { Building, MapPin, FileText, CheckCircle, Loader2 } from 'lucide-react';

interface CompanyOnboardingProps {
  userId: string;
  onComplete: (company: CompanyProfile) => void;
  onCancel: () => void;
}

const CompanyOnboarding: React.FC<CompanyOnboardingProps> = ({ userId, onComplete, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState<CompanyProfile>({
    name: '',
    industry: 'Technology',
    tone: 'Professional but friendly',
    values: [],
    philosophy: '',
    ico: '',
    dic: '',
    address: '',
    description: ''
  });

  const handleSubmit = async () => {
      setLoading(true);
      try {
          // In a real app, we might validate IČO via ARES (Czech registry) here
          const company = await createCompany(formData, userId);
          if (company) {
             // Adapt DB response to CompanyProfile type
             const profile: CompanyProfile = {
                 id: company.id,
                 name: company.name,
                 industry: company.industry,
                 tone: company.tone,
                 values: company.values || [],
                 philosophy: company.philosophy,
                 ico: company.ico,
                 dic: company.dic,
                 address: company.address,
                 description: company.description
             };
             onComplete(profile);
          }
      } catch (e) {
          console.error(e);
          alert("Chyba při zakládání firmy.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-950 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building size={20} className="text-cyan-600" /> Registrace Společnosti
                    </h2>
                    <p className="text-sm text-slate-500">Krok {step} z 2</p>
                </div>
                <div className="flex gap-1">
                    <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-cyan-500' : 'bg-slate-300'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-cyan-500' : 'bg-slate-300'}`}></div>
                </div>
            </div>

            <div className="p-8">
                {step === 1 ? (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Fakturační & Právní Údaje</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Název Firmy</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                    placeholder="Acme s.r.o."
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">IČO</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                    placeholder="12345678"
                                    value={formData.ico}
                                    onChange={e => setFormData({...formData, ico: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DIČ (VAT)</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                    placeholder="CZ12345678"
                                    value={formData.dic}
                                    onChange={e => setFormData({...formData, dic: e.target.value})}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sídlo (Adresa)</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input 
                                        className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                        placeholder="Václavské náměstí 1, Praha"
                                        value={formData.address}
                                        onChange={e => setFormData({...formData, address: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button onClick={onCancel} className="px-4 py-2 text-slate-500 hover:text-slate-800 font-medium">Zrušit</button>
                            <button 
                                onClick={() => setStep(2)}
                                disabled={!formData.name || !formData.ico}
                                className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold disabled:opacity-50"
                            >
                                Pokračovat
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Profil & Kultura</h3>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Odvětví</label>
                            <input 
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                placeholder="IT / Software Development"
                                value={formData.industry}
                                onChange={e => setFormData({...formData, industry: e.target.value})}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filosofie (Krátce)</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                                <textarea 
                                    className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white h-24"
                                    placeholder="Naše mise je..."
                                    value={formData.philosophy}
                                    onChange={e => setFormData({...formData, philosophy: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-between items-center">
                            <button onClick={() => setStep(1)} className="px-4 py-2 text-slate-500 font-medium">Zpět</button>
                            <button 
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/20"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                Dokončit registraci
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default CompanyOnboarding;
