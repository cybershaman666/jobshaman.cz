import React, { useState } from 'react';
import { X, Building, Mail, Phone, User, Lock, Eye, EyeOff, Briefcase, Globe, MapPin, Users, CheckCircle, Loader2, ShieldCheck, ArrowRight, Info } from 'lucide-react';
import { sendEmail, EmailTemplates } from '../services/emailService';
import { createCompany } from '../services/supabaseService';

interface CompanyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CompanyRegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  industry: string;
  website: string;
  address: string;
  phone: string;
  contactPerson: string;
  employees: string;
  ico: string;
  dic: string;
  description: string;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
}

const CompanyRegistrationModal: React.FC<CompanyRegistrationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<number | 'success' | 'submitting'>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<CompanyRegistrationFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    industry: '',
    website: '',
    address: '',
    phone: '',
    contactPerson: '',
    employees: '',
    ico: '',
    dic: '',
    description: '',
    agreedToTerms: false,
    agreedToPrivacy: false
  });

  const industries = [
    'Technologie a IT',
    'Finance a Bankovnictví',
    'Výroba a Průmysl',
    'Obchod a Retail',
    'Služby',
    'Zdravotnictví',
    'Vzdělávání',
    'Marketing a Reklama',
    'Stavebnictví',
    'Logistika a Doprava',
    'Jiné'
  ];

  const employeeRanges = [
    '1-10 zaměstnanců',
    '11-50 zaměstnanců',
    '51-200 zaměstnanců',
    '201-500 zaměstnanců',
    '500+ zaměstnanců'
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStep('submitting');

    try {
      // 1. Get current user ID if logged in
      let userId = 'new-recruiter-id'; // Fallback for demo
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user) userId = data.user.id;
      }

      // 2. Create Company in Database
      await createCompany(formData as any, userId);

      // 3. Send email notification
      const emailResult = await sendEmail({
        to: 'floki@jobshaman.cz',
        ...EmailTemplates.companyRegistration(formData)
      });

      if (emailResult.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess();
          onClose();
          // Reset
          setStep(1);
          setIsSubmitting(false);
        }, 3000);
      } else {
        throw new Error('Email failed');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setStep(2); // Go back if error
      setIsSubmitting(false);
      alert('Došlo k chybě při registraci. Zkuste to prosím znovu.');
    }
  };

  if (!isOpen) return null;

  const totalSteps = 3;

  const renderContent = () => {
    if (step === 'success') {
      return (
        <div className="text-center py-16 px-6 animate-in fade-in zoom-in-95">
          <div className="w-24 h-24 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Vítejte na palubě!</h2>
          <p className="text-slate-600 dark:text-slate-300 text-lg mb-8 max-w-md mx-auto">
            Registrace vaší společnosti proběhla úspěšně. Za malý okamžik vás přesměrujeme do vašeho nového dashboardu.
          </p>
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          </div>
        </div>
      );
    }

    if (step === 'submitting') {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 animate-in fade-in">
          <Loader2 size={64} className="text-cyan-500 animate-spin mb-8" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Probouzím Šamana...</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Vytváříme váš firemní profil a připravujeme prostředí.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header Section */}
        <div className="p-8 pb-4">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <ShieldCheck size={20} className="text-cyan-500" />
                </div>
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-mono">
                  Partner Registration
                </span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {step === 1 && 'Váš Účet'}
                {step === 2 && 'Profil Firmy'}
                {step === 3 && 'Finální Kontrola'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-3 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex flex-col gap-2">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${typeof step === 'number' && step >= i ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-slate-100 dark:bg-slate-800'}`}></div>
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${typeof step === 'number' && step === i ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                  {i === 1 ? 'Účet' : i === 2 ? 'Detaily' : 'Souhlas'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
                    <div className="relative group">
                      <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full pl-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                        placeholder="hr@spolecnost.cz"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Heslo</label>
                    <div className="relative group">
                      <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full pl-11 pr-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Potvrďte Heslo</label>
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex gap-3 items-start">
                  <Info size={16} className="text-cyan-500 mt-0.5" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Bezpečnost je pro nás prioritou. Vaše heslo je šifrováno a nikdy jej nesdílíme.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Název Firmy</label>
                    <div className="relative group">
                      <Building size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                      <input
                        type="text"
                        required
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className="w-full pl-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                        placeholder="Moje Firma s.r.o."
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">IČO</label>
                    <input
                      type="text"
                      required
                      value={formData.ico}
                      onChange={(e) => handleInputChange('ico', e.target.value)}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                      placeholder="12345678"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">DIČ</label>
                    <input
                      type="text"
                      value={formData.dic}
                      onChange={(e) => handleInputChange('dic', e.target.value)}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                      placeholder="CZ12345678"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Sídlo Firmy (Adresa)</label>
                    <div className="relative group">
                      <MapPin size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                      <input
                        type="text"
                        required
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className="w-full pl-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                        placeholder="Václavské náměstí 1, Praha"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Obor Podnikání</label>
                    <select
                      required
                      value={formData.industry}
                      onChange={(e) => handleInputChange('industry', e.target.value)}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Vyberte obor</option>
                      {industries.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Velikost Firmy</label>
                    <select
                      required
                      value={formData.employees}
                      onChange={(e) => handleInputChange('employees', e.target.value)}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Vyberte rozsah</option>
                      {employeeRanges.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-500">
                      <Building size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{formData.companyName || 'Název firmy'}</h4>
                      <p className="text-xs text-slate-500">{formData.industry || 'Obor nebyl vybrán'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">E-mail:</span>
                      <div className="text-slate-700 dark:text-slate-200 font-medium">{formData.email}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">IČO:</span>
                      <div className="text-slate-700 dark:text-slate-200 font-medium">{formData.ico}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sídlo:</span>
                      <div className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[150px]">{formData.address}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Velikost:</span>
                      <div className="text-slate-700 dark:text-slate-200 font-medium">{formData.employees}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="group flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        required
                        checked={formData.agreedToTerms}
                        onChange={(e) => handleInputChange('agreedToTerms', e.target.checked)}
                        className="peer h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 transition-all cursor-pointer opacity-0 absolute z-10"
                      />
                      <div className="h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 flex items-center justify-center text-white transition-all">
                        <CheckCircle size={14} className="scale-0 peer-checked:scale-100 transition-transform" />
                      </div>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Souhlasím s <a href="#" className="font-bold text-cyan-600 hover:text-cyan-500 underline">obchodními podmínkami</a> a využíváním shamanic cloud služeb.
                    </span>
                  </label>

                  <label className="group flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        required
                        checked={formData.agreedToPrivacy}
                        onChange={(e) => handleInputChange('agreedToPrivacy', e.target.checked)}
                        className="peer h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 transition-all cursor-pointer opacity-0 absolute z-10"
                      />
                      <div className="h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 flex items-center justify-center text-white transition-all">
                        <CheckCircle size={14} className="scale-0 peer-checked:scale-100 transition-transform" />
                      </div>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Potvrzuji seznámení se se <a href="#" className="font-bold text-cyan-600 hover:text-cyan-500 underline">zásadami zpracování</a> v Shamanic AI Ekosystému.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex gap-4">
          {step > 1 && (
            <button
              onClick={() => setStep(step === 'success' ? 1 : step - 1)}
              className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              Zpět
            </button>
          )}
          <button
            onClick={(e) => {
              if (step === 3) handleSubmit(e as any);
              else setStep(step + 1);
            }}
            disabled={(step === 1 && (!formData.email || !formData.password)) || (step === 2 && (!formData.companyName || !formData.ico)) || (step === 3 && (!formData.agreedToTerms || !formData.agreedToPrivacy))}
            className="flex-1 flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-black/10 dark:shadow-white/5"
          >
            {step === 3 ? 'Aktivovat Firemní Profil' : 'Pokračovat'}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      ></div>
      <div className="relative bg-white dark:bg-[#0b1121] border border-slate-200 dark:border-slate-800/60 rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.4)] w-full max-w-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 transition-all animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-500"></div>
        {renderContent()}
        {/* Shamanic background glow */}
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      </div>
    </div>
  );
};

export default CompanyRegistrationModal;