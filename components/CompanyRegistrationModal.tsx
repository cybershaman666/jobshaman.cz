import React, { useState } from 'react';
import { X, Building, Mail, Phone, User, Lock, Eye, EyeOff, Briefcase, Globe, MapPin, Check, Star, TrendingUp, Shield, Users, Zap } from 'lucide-react';

interface CompanyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CompanyRegistrationModal: React.FC<CompanyRegistrationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual registration logic
    console.log('Company registration:', formData);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  const totalSteps = 3;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-6 pb-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {step === 1 && 'Firemní Registrace'}
                {step === 2 && 'Informace o Společnosti'}
                {step === 3 && 'Potvrzení'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                {step === 1 && 'Vytvořte si účet pro přístup do portálu'}
                {step === 2 && 'Přidejte detaily o vaší společnosti'}
                {step === 3 && 'Zkontrolujte a potvrďte údaje'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2 mt-4">
            {[...Array(totalSteps)].map((_, i) => (
              <React.Fragment key={i}>
                <div className={`flex-1 h-1 rounded-full ${i < step ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                {i < totalSteps - 1 && <div className="w-2 h-1 bg-transparent" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 pt-4">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Account */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Mail size={16} className="inline mr-2" />
                      E-mail (Přihlašovací)
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="info@spolecnost.cz"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Lock size={16} className="inline mr-2" />
                      Heslo
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <Lock size={16} className="inline mr-2" />
                    Potvrďte heslo
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Company Info */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Building size={16} className="inline mr-2" />
                      Název společnosti
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="Moje Firma s.r.o."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Briefcase size={16} className="inline mr-2" />
                      Obor
                    </label>
                    <select
                      required
                      value={formData.industry}
                      onChange={(e) => handleInputChange('industry', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="">Vyberte obor</option>
                      {industries.map(industry => (
                        <option key={industry} value={industry}>{industry}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Globe size={16} className="inline mr-2" />
                      Webové stránky
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="https://www.mojespolecnost.cz"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Users size={16} className="inline mr-2" />
                      Počet zaměstnanců
                    </label>
                    <select
                      required
                      value={formData.employees}
                      onChange={(e) => handleInputChange('employees', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="">Vyberte rozsah</option>
                      {employeeRanges.map(range => (
                        <option key={range} value={range}>{range}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <MapPin size={16} className="inline mr-2" />
                    Sídlo společnosti
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="Hlavní 123, 110 00 Praha 1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <User size={16} className="inline mr-2" />
                      Kontaktní osoba
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contactPerson}
                      onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="Jan Novák"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Phone size={16} className="inline mr-2" />
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="+420 123 456 789"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Shrnutí údajů</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">E-mail:</span>
                      <div className="font-medium text-slate-900 dark:text-white">{formData.email}</div>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Společnost:</span>
                      <div className="font-medium text-slate-900 dark:text-white">{formData.companyName}</div>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Obor:</span>
                      <div className="font-medium text-slate-900 dark:text-white">{formData.industry}</div>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Počet zaměstnanců:</span>
                      <div className="font-medium text-slate-900 dark:text-white">{formData.employees}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={formData.agreedToTerms}
                      onChange={(e) => handleInputChange('agreedToTerms', e.target.checked)}
                      className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Souhlasím s <a href="#" className="text-indigo-600 hover:text-indigo-500 underline">obchodními podmínkami</a> a <a href="#" className="text-indigo-600 hover:text-indigo-500 underline">podmínkami používání služby</a>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={formData.agreedToPrivacy}
                      onChange={(e) => handleInputChange('agreedToPrivacy', e.target.checked)}
                      className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Souhlasím se <a href="#" className="text-indigo-600 hover:text-indigo-500 underline">zpracováním osobních údajů</a> v souladu s GDPR
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setStep(Math.max(1, step - 1))}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  step === 1 
                    ? 'invisible' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Zpět
              </button>
              <button
                type={step === totalSteps ? 'submit' : 'button'}
                onClick={() => step < totalSteps && setStep(step + 1)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
              >
                {step === totalSteps ? 'Dokončit registraci' : 'Pokračovat'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompanyRegistrationModal;