import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile } from '../types';
import { createCompany } from '../services/supabaseService';
import { Building, MapPin, FileText, CheckCircle, Loader2, X, Briefcase, Info, ArrowRight } from 'lucide-react';

interface CompanyOnboardingProps {
    userId: string;
    onComplete: (company: CompanyProfile) => void;
    onCancel: () => void;
}

const CompanyOnboarding: React.FC<CompanyOnboardingProps> = ({ userId, onComplete, onCancel }) => {
    const { t } = useTranslation();
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

    const isStep1Valid = !!(formData.name && formData.ico);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const company = await createCompany(formData, userId);
            if (company) {
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
            alert(t('company_onboarding.error_creating'));
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{t('company_onboarding.step1.title')}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.company_name')}</label>
                        <div className="relative group">
                            <Building size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                            <input
                                className="w-full pl-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                                placeholder={t('company_onboarding.step1.company_name_placeholder')}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.ico')}</label>
                        <input
                            className="w-full p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                            placeholder={t('company_onboarding.step1.ico_placeholder')}
                            value={formData.ico}
                            onChange={e => setFormData({ ...formData, ico: e.target.value })}
                        />
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.dic')}</label>
                        <input
                            className="w-full p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                            placeholder={t('company_onboarding.step1.dic_placeholder')}
                            value={formData.dic}
                            onChange={e => setFormData({ ...formData, dic: e.target.value })}
                        />
                    </div>

                    <div className="sm:col-span-2 relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.address')}</label>
                        <div className="relative group">
                            <MapPin size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                            <input
                                className="w-full pl-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                                placeholder={t('company_onboarding.step1.address_placeholder')}
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-100 dark:border-cyan-500/10 p-4 rounded-xl flex items-start gap-3">
                <Info size={18} className="text-cyan-600 dark:text-cyan-400 mt-0.5" />
                <p className="text-xs text-cyan-800 dark:text-cyan-200 leading-relaxed">
                    {t('company_onboarding.step1.info_box')}
                </p>
            </div>

            <div className="pt-2 flex gap-4">
                <button
                    onClick={onCancel}
                    className="flex-1 px-6 py-3.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    {t('company_onboarding.cancel')}
                </button>
                <button
                    onClick={() => setStep(2)}
                    disabled={!isStep1Valid}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-30 shadow-lg shadow-black/10 dark:shadow-white/5"
                >
                    {t('company_onboarding.continue')} <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{t('company_onboarding.step2.title')}</h3>

                <div className="space-y-4">
                    <div className="relative group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step2.industry')}</label>
                        <div className="relative">
                            <Briefcase size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                            <input
                                className="w-full pl-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                                placeholder={t('company_onboarding.step2.industry_placeholder')}
                                value={formData.industry}
                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="relative group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step2.philosophy')}</label>
                        <div className="relative">
                            <FileText size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                            <textarea
                                className="w-full pl-11 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all min-h-[120px] resize-none"
                                placeholder={t('company_onboarding.step2.philosophy_placeholder')}
                                value={formData.philosophy}
                                onChange={e => setFormData({ ...formData, philosophy: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-2 flex gap-4">
                <button
                    onClick={() => setStep(1)}
                    className="flex-1 px-6 py-3.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    {t('company_onboarding.back')}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                    {t('company_onboarding.finish')}
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with enhanced blur */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300"
                onClick={onCancel}
            ></div>

            {/* Modal Container */}
            <div className="relative bg-white dark:bg-[#0b1121] border border-slate-200 dark:border-slate-800/60 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 transition-all animate-in zoom-in-95 duration-300">

                {/* Visual Accent Gradient */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"></div>

                {/* Close Button */}
                <button
                    onClick={onCancel}
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-full transition-all z-10"
                >
                    <X size={20} />
                </button>

                <div className="p-8 sm:p-10">
                    {/* Header */}
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
                                <Building size={24} className="text-cyan-500" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('company_onboarding.title')}</h2>
                        </div>

                        {/* Progress Indicator */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 transition-all duration-700 ease-out"
                                    style={{ width: `${(step / 2) * 100}%` }}
                                ></div>
                            </div>
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                                {t('company_onboarding.step', { current: step, total: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    {step === 1 ? renderStep1() : renderStep2()}
                </div>

                {/* Subtle Decorative elements for Shamanic feel */}
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none"></div>
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>
            </div>
        </div>
    );
};

export default CompanyOnboarding;
