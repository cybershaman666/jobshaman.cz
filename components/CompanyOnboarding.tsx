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
        <div className="app-modal-surface space-y-6 animate-in fade-in slide-in-from-right-4 p-5 duration-500">
            <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{t('company_onboarding.step1.title')}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.company_name')}</label>
                        <div className="relative group">
                            <Building size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                            <input
                                className="app-modal-input pl-11"
                                placeholder={t('company_onboarding.step1.company_name_placeholder')}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.ico')}</label>
                        <input
                            className="app-modal-input"
                            placeholder={t('company_onboarding.step1.ico_placeholder')}
                            value={formData.ico}
                            onChange={e => setFormData({ ...formData, ico: e.target.value })}
                        />
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.dic')}</label>
                        <input
                            className="app-modal-input"
                            placeholder={t('company_onboarding.step1.dic_placeholder')}
                            value={formData.dic}
                            onChange={e => setFormData({ ...formData, dic: e.target.value })}
                        />
                    </div>

                    <div className="sm:col-span-2 relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step1.address')}</label>
                        <div className="relative group">
                            <MapPin size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                            <input
                                className="app-modal-input pl-11"
                                placeholder={t('company_onboarding.step1.address_placeholder')}
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="app-premium-note flex items-start gap-3">
                <Info size={18} className="mt-0.5 text-[var(--accent-strong)]" />
                <p className="text-xs leading-relaxed text-slate-700">
                    {t('company_onboarding.step1.info_box')}
                </p>
            </div>

            <div className="pt-2 flex gap-4">
                <button
                    onClick={onCancel}
                    className="app-button-secondary flex-1 justify-center"
                >
                    {t('company_onboarding.cancel')}
                </button>
                <button
                    onClick={() => setStep(2)}
                    disabled={!isStep1Valid}
                    className="app-button-primary flex-1 justify-center disabled:opacity-30"
                >
                    {t('company_onboarding.continue')} <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="app-modal-surface space-y-6 animate-in fade-in slide-in-from-right-4 p-5 duration-500">
            <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">{t('company_onboarding.step2.title')}</h3>

                <div className="space-y-4">
                    <div className="relative group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step2.industry')}</label>
                        <div className="relative">
                            <Briefcase size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                            <input
                                className="app-modal-input pl-11"
                                placeholder={t('company_onboarding.step2.industry_placeholder')}
                                value={formData.industry}
                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="relative group">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{t('company_onboarding.step2.philosophy')}</label>
                        <div className="relative">
                            <FileText size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors" />
                            <textarea
                                className="app-modal-input min-h-[120px] resize-none pl-11"
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
                    className="app-button-secondary flex-1 justify-center"
                >
                    {t('company_onboarding.back')}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="app-button-primary flex-1 justify-center disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                    {t('company_onboarding.finish')}
                </button>
            </div>
        </div>
    );

    return (
        <div className="app-modal-backdrop z-[100]">
            <div className="absolute inset-0" onClick={onCancel}></div>

            <div className="app-modal-panel max-w-2xl overflow-hidden">

                {/* Close Button */}
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 z-10 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-strong)]"
                >
                    <X size={20} />
                </button>

                <div className="p-6 sm:p-8">
                    <div className="app-modal-topline absolute inset-x-0 top-0" />
                    {/* Header */}
                    <div className="mb-8">
                        <div className="space-y-4">
                            <span className="app-modal-kicker">
                                <Building size={12} />
                                {t('company_onboarding.title')}
                            </span>
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-[var(--accent-soft)] p-2.5">
                                    <Building size={22} className="text-[var(--accent-strong)]" />
                                </div>
                                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{t('company_onboarding.title')}</h2>
                            </div>
                        </div>

                        {/* Progress Indicator */}
                        <div className="flex items-center gap-4">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                                <div
                                    className="h-full bg-[var(--accent)] transition-all duration-700 ease-out"
                                    style={{ width: `${(step / 2) * 100}%` }}
                                ></div>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-faint)] font-mono">
                                {t('company_onboarding.step', { current: step, total: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    {step === 1 ? renderStep1() : renderStep2()}
                </div>

            </div>
        </div>
    );
};

export default CompanyOnboarding;
