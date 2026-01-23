import React, { useState } from 'react';
import { X, Building, Mail, Phone, User, Globe, Send, CheckCircle, Loader2, FileText, Percent, MapPin, Users, TrendingUp, Calendar } from 'lucide-react';
import { sendEmail, EmailTemplates } from '../services/emailService';

interface PartnerOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'form' | 'submitting' | 'success';

const PartnerOfferModal: React.FC<PartnerOfferModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<Step>('form');
  
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    partnerType: 'education' as 'education' | 'company' | 'individual',
    commissionRate: '',
    description: '',
    address: '',
    courseCategories: [] as string[],
    offer: ''
  });

  const courseCategories = [
    'Řidičské průkazy',
    'Technické kurzy',
    'IT a programování',
    'Business a management',
    'Marketing a sales',
    'Jazyky',
    'Ostatní'
  ];

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({
      ...prev,
      courseCategories: prev.courseCategories.includes(category)
        ? prev.courseCategories.filter(c => c !== category)
        : [...prev.courseCategories, category]
    }));
  };

  const handleSubmit = async () => {
    setStep('submitting');
    
    try {
      // Send email notification
      const emailResult = await sendEmail({
        to: 'floki@jobshaman.cz',
        ...EmailTemplates.partnerOffer(formData)
      });

      if (emailResult.success) {
        setStep('success');
        console.log('Partner offer data:', formData);
        
        // Clear form after delay
        setTimeout(() => {
          onClose();
          // Reset form
          setFormData({
            companyName: '',
            contactName: '',
            email: '',
            phone: '',
            website: '',
            partnerType: 'education' as 'education' | 'company' | 'individual',
            commissionRate: '',
            description: '',
            address: '',
            courseCategories: [],
            offer: ''
          });
          setStep('form');
        }, 3000);
      } else {
        console.error('Failed to send partner offer email:', emailResult.error);
        setStep('form');
        alert('Nepodařilo se odeslat poptávku. Zkuste to prosím znovu.');
      }
    } catch (error) {
      console.error('Partner offer error:', error);
      setStep('form');
      alert('Došlo k chybě při odesílání poptávky. Zkuste to prosím znovu.');
    }
  };

  const isFormValid = formData.companyName && formData.contactName && formData.email && formData.phone;

  const renderContent = () => {
    if (step === 'success') {
      return (
        <div className="text-center py-12 px-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Registrace úspěšná</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
            Děkujeme za váš zájem o spolupráci! Brzy se vám ozveme s dalšími informacemi.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Vaše data byla uložena do databáze partnerů a budeme vás kontaktovat ohledně nabídky vašich kurzů.
          </p>
          <button 
            onClick={onClose}
            className="mt-8 px-6 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Zavřít
          </button>
        </div>
      );
    }

    if (step === 'submitting') {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 animate-in fade-in">
          <Loader2 size={48} className="text-cyan-600 dark:text-cyan-500 animate-spin mb-6" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Ukládám registraci...</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Zpracováváme vaši žádost o partnerství.</p>
        </div>
      );
    }

    return (
      <div className="p-6 sm:p-8 space-y-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nabídnout kurz</h2>
          <p className="text-slate-500 dark:text-slate-300">Staňte se partnerem a nabízejte své kurzy na našem marketplace</p>
        </div>

        {/* Company/Partner Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Informace o partnerovi</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Building size={16} className="absolute left-3 top-3 text-slate-500" />
              <input 
                type="text" 
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                placeholder="Název společnosti/školy"
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-slate-500" />
              <input 
                type="text" 
                name="contactName"
                value={formData.contactName}
                onChange={handleInputChange}
                placeholder="Kontaktní osoba"
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
                required
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
                required
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
                required
              />
            </div>
            <div className="relative">
              <Globe size={16} className="absolute left-3 top-3 text-slate-500" />
              <input 
                type="url" 
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="Webové stránky"
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
              />
            </div>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-slate-500" />
              <input 
                type="text" 
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Adresa sídla"
                className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Typ partnera</label>
            <select
              name="partnerType"
              value={formData.partnerType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white"
            >
              <option value="education">Vzdělávací instituce</option>
              <option value="company">Firma</option>
              <option value="individual">Osobní lektor</option>
            </select>
          </div>

          <div className="relative">
            <Percent size={16} className="absolute left-3 top-3 text-slate-500" />
            <input 
              type="text" 
              name="commissionRate"
              value={formData.commissionRate}
              onChange={handleInputChange}
              placeholder="Požadovaná provize (%)"
              className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Course Categories */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Kategorie kurzů</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {courseCategories.map(category => (
              <label key={category} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.courseCategories.includes(category)}
                  onChange={() => handleCategoryChange(category)}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Popis společnosti</h3>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Stručně popište vaši společnost a typy kurzů, které nabízíte..."
            className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500"
          />
        </div>

        {/* Info Box */}
        <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-xl border border-cyan-200 dark:border-cyan-500/20">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-cyan-900 dark:text-cyan-100 text-sm mb-1">Co se stane po registraci?</h4>
              <p className="text-xs text-cyan-800 dark:text-cyan-200 leading-relaxed">
                Vaše data budou uložena do naší databáze partnerů. Náš team se vám ozve do 48 hodin a domluvíme detaily spolupráce, 
                včetně integrace vašich kurzů do našeho marketplace a nastavení provizí.
              </p>
            </div>
          </div>
        </div>

        {/* Success Metrics Preview */}
        <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 p-6 border border-emerald-200 dark:border-emerald-800">
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-4">Vaše možnosti jako partner</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-emerald-950/50 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">Dosažitelnost</h4>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">Přístup k tisícům potenciálních uchazečů</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">50,000+</div>
            </div>
            
            <div className="bg-white dark:bg-emerald-950/50 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">Průměrná provize</h4>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">Standardní provize 10-20% z kurzovného</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">15%</div>
            </div>
            
            <div className="bg-white dark:bg-emerald-950/50 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">Pravidelné příjmy</h4>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">Měsí výplaty z provizí každý měsíc</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Měsí</div>
            </div>
          </div>
        </div>

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
            disabled={!isFormValid}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(8,145,178,0.4)]"
          >
            <Send size={18} />
            Odeslat registraci
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
      <div className="relative bg-white dark:bg-[#0b1121] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto ring-1 ring-black/5 dark:ring-white/10 transition-colors duration-300">
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

export default PartnerOfferModal;