
import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { Eye, EyeOff, Building2, Mail, Lock, CheckCircle, ArrowRight, Loader2, Info, X } from 'lucide-react';

interface CompanyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CompanyRegistrationModal({ isOpen, onClose, onSuccess }: CompanyRegistrationModalProps) {
  if (!isOpen) return null;

  const [step, setStep] = useState<number | 'success'>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    ico: '',
    website: '',
    agreedToTerms: false,
    agreedToPrivacy: false
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Sign up with Supabase Auth
      if (!supabase) throw new Error("Supabase not initialized");

      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'recruiter',
            company_name: formData.companyName
          }
        }
      });

      if (authError) throw authError;

      // 2. Create Company Profile in 'companies' table (if triggered via webhook or handled manually here)
      setStep('success');
    } catch (error: any) {
      console.error("Registration error:", error);
      alert(error.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* Progress Bar */}
        {typeof step === 'number' && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        )}

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {step === 1 && "Vytvořte si firemní účet"}
              {step === 2 && "Doplňte údaje o firmě"}
              {step === 3 && "Poslední krok"}
              {step === 'success' && "Vítejte v JobShaman! 🎉"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {step === 'success'
                ? "Váš účet byl úspěšně vytvořen. Zkontrolujte svůj email pro potvrzení."
                : "Přidejte se k firmám, které nabírají efektivně."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Firemní Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="hr@firma.cz"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Heslo
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Minimálně 8 znaků"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Název Společnosti
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="text"
                      name="companyName"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Acme Corp s.r.o."
                      value={formData.companyName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      IČO
                    </label>
                    <input
                      type="text"
                      name="ico"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="12345678"
                      value={formData.ico}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Web (volitelné)
                    </label>
                    <input
                      type="url"
                      name="website"
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="https://..."
                      value={formData.website}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex gap-3">
                  <Info className="shrink-0 text-indigo-600 dark:text-indigo-400" size={20} />
                  <p className="text-sm text-indigo-800 dark:text-indigo-300">
                    Vytvořením účtu získáte 14 dní Premium na vyzkoušení zdarma. Žádná kreditní karta není potřeba.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="agreedToTerms"
                      checked={formData.agreedToTerms}
                      onChange={handleChange}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Souhlasím s <a href="#" className="text-indigo-600 hover:underline">Obchodními podmínkami</a> a zpracováním firemních údajů.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="agreedToPrivacy"
                      checked={formData.agreedToPrivacy}
                      onChange={handleChange}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Souhlasím se zásadami <a href="#" className="text-indigo-600 hover:underline">Ochrany osobních údajů</a>.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-8 flex flex-col items-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-6">
                  <CheckCircle size={40} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onSuccess) onSuccess();
                    else window.location.reload();
                  }}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  Přejít do portálu
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex gap-4">
          {typeof step === 'number' && step > 1 && (

            <button
              onClick={() => setStep((typeof step === 'number' ? step : 1) - 1)}
              className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              Zpět
            </button>
          )}
          <button
            onClick={(e) => {
              if (step === 3) handleSubmit(e);
              else setStep((step as number) + 1);
            }}
            disabled={(step === 1 && (!formData.email || !formData.password)) || (step === 2 && (!formData.companyName || !formData.ico)) || (step === 3 && (!formData.agreedToTerms || !formData.agreedToPrivacy)) || isSubmitting}
            className={`flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${step === 'success' ? 'hidden' : ''}`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            {step === 3 ? "Dokončit registraci" : "Pokračovat"}
            {!isSubmitting && <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}