import React from 'react';
import { Briefcase, BrainCircuit, Sparkles, Crown, CheckCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile } from '../types';
import { redirectToCheckout } from '../services/stripeService';
import AnalyticsService from '../services/analyticsService';
import ABTestService from '../services/abTestService';

interface PlanUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature?: string;
    companyProfile: CompanyProfile;
}

const PlanUpgradeModal: React.FC<PlanUpgradeModalProps> = ({ isOpen, onClose, feature, companyProfile }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="app-modal-backdrop z-[200]">
            <div
                className="absolute inset-0"
                onClick={onClose}
            ></div>
            <div className="app-modal-panel max-w-4xl max-h-[90vh] animate-in zoom-in-95 duration-300 flex flex-col md:flex-row">
                <div className="app-modal-topline" />
                <button
                    type="button"
                    onClick={onClose}
                    className="app-modal-close"
                    aria-label={t('common.close', { defaultValue: 'Zavřít' })}
                >
                    <X size={18} />
                </button>
                {/* Left Side: Feature Context */}
                <div className="app-modal-header-safe md:w-1/3 bg-[var(--surface-subtle)] p-8 pt-14 border-r border-[var(--border-subtle)] flex flex-col justify-center md:overflow-y-auto md:pt-8">
                    <div className="w-16 h-16 bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <Crown size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-[var(--text-strong)] mb-3 tracking-tight leading-tight">
                        {t('plan_upgrade_modal.premium_features')}
                    </h2>
                    <p className="text-[var(--text-muted)] mb-8 leading-relaxed text-sm">
                        {t('plan_upgrade_modal.feature_requires_plan_prefix')}{' '}
                        <span className="font-bold text-[var(--accent)]">"{feature}"</span>{' '}
                        {t('plan_upgrade_modal.feature_requires_plan_suffix')}
                    </p>
                    <div className="space-y-4">
                        {[
                            { icon: Briefcase, text: t('plan_upgrade_modal.highlights.unlimited_job_posts') },
                            { icon: BrainCircuit, text: t('plan_upgrade_modal.highlights.ai_assessments') },
                            { icon: Sparkles, text: t('plan_upgrade_modal.highlights.ai_job_optimization') },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="p-2 bg-[rgba(var(--accent-green-rgb),0.1)] text-[var(--accent-green)] rounded-lg">
                                    <f.icon size={16} />
                                </div>
                                <span className="text-xs font-bold text-[var(--text-strong)]">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Options */}
                <div className="flex-1 p-8 pt-14 bg-[var(--surface-elevated)] overflow-y-auto max-h-[90vh] md:max-h-full md:pt-8">
                    <h3 className="font-black text-xl mb-8 text-[var(--text-strong)] tracking-tight">
                        {t('plan_upgrade_modal.select_solution')}
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Option 1: Free Trial */}
                        <div className="p-5 rounded-2xl border-2 border-[var(--border-subtle)] hover:border-[var(--accent-green)] transition-all cursor-pointer group bg-[var(--surface)]">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
                                        <Briefcase size={22} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[var(--text-strong)]">{t('plan_upgrade_modal.trial.title', { defaultValue: 'Free (Trial)' })}</h4>
                                        <p className="text-xs text-[var(--text-muted)]">{t('plan_upgrade_modal.trial.subtitle', { defaultValue: 'For small local companies to try' })}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-green-600 dark:text-green-400 text-2xl">0 €</div>
                                    <div className="text-[10px] text-[var(--text-faint)] font-bold uppercase tracking-wider">{t('plan_upgrade_modal.trial.price_suffix', { defaultValue: '/ month' })}</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-3 mb-6">
                                <li className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium"><CheckCircle size={14} className="text-green-500" /> {t('plan_upgrade_modal.trial.feature_1', { defaultValue: '1 active job posting' })}</li>
                                <li className="flex items-center gap-2 text-xs text-[var(--text-faint)] font-medium"><span className="w-3.5 h-3.5 inline-block"></span> {t('plan_upgrade_modal.trial.feature_2', { defaultValue: 'No AI assessments' })}</li>
                            </ul>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/10 active:scale-[0.98]"
                            >
                                {t('plan_upgrade_modal.trial.cta', { defaultValue: 'Continue with trial' })}
                            </button>
                        </div>

                        {/* Option 2: Starter Plan */}
                        <div className="p-5 rounded-2xl border-2 border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.02)] relative shadow-xl shadow-[rgba(var(--accent-rgb),0.05)]">
                            <div className="absolute -top-3 right-6 bg-[var(--accent)] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg">{t('plan_upgrade_modal.basic.recommended_badge', { defaultValue: 'Popular' })}</div>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)] rounded-xl">
                                        <Crown size={22} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[var(--text-strong)]">{t('plan_upgrade_modal.basic_plus.title', { defaultValue: 'Starter plan' })}</h4>
                                        <p className="text-xs text-[var(--text-muted)]">{t('plan_upgrade_modal.basic_plus.subtitle', { defaultValue: 'For small local teams and startups' })}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-[var(--accent)] text-2xl">249 €</div>
                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">{t('plan_upgrade_modal.basic_plus.price_suffix', { defaultValue: '/ month' })}</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-3 mb-6">
                                <li className="flex items-center gap-2 text-xs text-[var(--text-strong)] font-semibold"><CheckCircle size={14} className="text-[var(--accent)]" /> {t('plan_upgrade_modal.basic_plus.feature_1', { defaultValue: '3 active job postings' })}</li>
                                <li className="flex items-center gap-2 text-xs text-[var(--text-strong)] font-semibold"><CheckCircle size={14} className="text-[var(--accent)]" /> {t('plan_upgrade_modal.basic_plus.feature_2', { defaultValue: '15 AI screenings / month' })}</li>
                                <li className="flex items-center gap-2 text-xs text-[var(--text-strong)] font-semibold"><CheckCircle size={14} className="text-[var(--accent)]" /> {t('plan_upgrade_modal.basic_plus.feature_3', { defaultValue: 'Basic decision overview' })}</li>
                            </ul>
                            <button
                                onClick={() => {
                                    if (companyProfile?.id) {
                                        AnalyticsService.trackUpgradeTrigger({
                                            companyId: companyProfile.id,
                                            feature: 'STARTER_COMPANY_PLAN',
                                            currentTier: companyProfile.subscription?.tier || 'starter',
                                            reason: 'User clicked starter company plan'
                                        });

                                        ABTestService.trackConversion('pricing_display_test', 'starter_clicked', 249);
                                        redirectToCheckout('starter', companyProfile.id);
                                    } else {
                                        console.error('❌ Company ID missing in profile!');
                                        alert(t('alerts.company_id_load_failed'));
                                    }
                                }}
                                className="app-button-primary w-full justify-center py-3 shadow-lg shadow-[rgba(var(--accent-rgb),0.2)] active:scale-[0.98]"
                            >
                                {t('plan_upgrade_modal.basic_plus.cta', { defaultValue: 'Activate Starter' })}
                            </button>
                        </div>

                        {/* Option 3: Growth Plan */}
                        <div className="p-5 rounded-2xl border-2 border-purple-500 bg-purple-50/5 relative group hover:bg-purple-50/10 transition-all">
                            <div className="absolute -top-3 right-6 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg">{t('plan_upgrade_modal.professional.recommended_badge', { defaultValue: 'Best value' })}</div>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                                        <Crown size={22} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[var(--text-strong)]">{t('plan_upgrade_modal.professional.title', { defaultValue: 'Growth plan' })}</h4>
                                        <p className="text-xs text-[var(--text-muted)]">{t('plan_upgrade_modal.professional.subtitle', { defaultValue: 'For growing SMEs and active recruiters' })}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-purple-600 dark:text-purple-400 text-2xl">599 €</div>
                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">{t('plan_upgrade_modal.professional.price_suffix', { defaultValue: '/ month' })}</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-3 mb-6">
                                <li className="flex items-center gap-2 text-xs text-[var(--text-strong)] font-semibold"><CheckCircle size={14} className="text-purple-500" /> {t('plan_upgrade_modal.professional.feature_1', { defaultValue: '10 active job postings' })}</li>
                                <li className="flex items-center gap-2 text-xs text-[var(--text-strong)] font-semibold"><CheckCircle size={14} className="text-purple-500" /> {t('plan_upgrade_modal.professional.feature_2', { defaultValue: '60 AI screenings / month' })}</li>
                                <li className="flex items-center gap-2 text-xs text-[var(--text-strong)] font-semibold"><CheckCircle size={14} className="text-purple-500" /> {t('plan_upgrade_modal.professional.feature_3', { defaultValue: 'JHI insights and reporting' })}</li>
                            </ul>
                            <button
                                onClick={() => {
                                    if (companyProfile?.id) {
                                        AnalyticsService.trackUpgradeTrigger({
                                            companyId: companyProfile.id,
                                            feature: 'GROWTH_COMPANY_PLAN',
                                            currentTier: companyProfile.subscription?.tier || 'starter',
                                            reason: 'User clicked growth company plan'
                                        });

                                        ABTestService.trackConversion('pricing_display_test', 'growth_clicked', 599);
                                        redirectToCheckout('growth', companyProfile.id);
                                    } else {
                                        console.error('❌ Company ID missing in profile!');
                                        alert(t('alerts.company_id_load_failed'));
                                    }
                                }}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-900/10 active:scale-[0.98]"
                            >
                                {t('plan_upgrade_modal.professional.cta', { defaultValue: 'Activate Growth' })}
                            </button>
                        </div>

                        {/* Option 4: Professional Plan */}
                        <div className="p-4 rounded-xl border-2 border-fuchsia-500 bg-fuchsia-50/10 relative">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 rounded-lg">
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{t('plan_upgrade_modal.enterprise.pro_title', { defaultValue: 'Professional plan' })}</h4>
                                        <p className="text-xs text-slate-500">{t('plan_upgrade_modal.enterprise.pro_subtitle', { defaultValue: 'For larger teams needing advanced analytics' })}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-fuchsia-600 dark:text-fuchsia-400 text-xl">899 €</div>
                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{t('plan_upgrade_modal.professional.price_suffix', { defaultValue: '/ month' })}</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-fuchsia-500" /> {t('plan_upgrade_modal.enterprise.pro_feature_1', { defaultValue: '20 active job postings' })}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-fuchsia-500" /> {t('plan_upgrade_modal.enterprise.pro_feature_2', { defaultValue: '150 AI screenings / month' })}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-fuchsia-500" /> {t('plan_upgrade_modal.enterprise.pro_feature_3', { defaultValue: 'Decision analytics dashboard' })}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-fuchsia-500" /> {t('plan_upgrade_modal.enterprise.pro_feature_4', { defaultValue: 'API access & priority support' })}</li>
                            </ul>
                            <button
                                onClick={() => {
                                    if (companyProfile?.id) {
                                        AnalyticsService.trackUpgradeTrigger({
                                            companyId: companyProfile.id,
                                            feature: 'PROFESSIONAL_COMPANY_PLAN',
                                            currentTier: companyProfile.subscription?.tier || 'starter',
                                            reason: 'User clicked professional company plan'
                                        });

                                        ABTestService.trackConversion('pricing_display_test', 'professional_clicked', 899);
                                        redirectToCheckout('professional', companyProfile.id);
                                    } else {
                                        console.error('❌ Company ID missing in profile!');
                                        alert(t('alerts.company_id_load_failed'));
                                    }
                                }}
                                className="w-full py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-fuchsia-900/20"
                            >
                                {t('plan_upgrade_modal.professional.cta', { defaultValue: 'Activate Professional' })}
                            </button>
                        </div>

                        {/* Option 5: Enterprise Plan */}
                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                        <Crown size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{t('plan_upgrade_modal.enterprise.title')}</h4>
                                        <p className="text-xs text-slate-500">{t('plan_upgrade_modal.enterprise.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-amber-600 dark:text-amber-400 text-xl">{t('plan_upgrade_modal.enterprise.price')}</div>
                                    <div className="text-[10px] text-slate-400">{t('plan_upgrade_modal.enterprise.price_suffix')}</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> {t('plan_upgrade_modal.enterprise.feature_1')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> {t('plan_upgrade_modal.enterprise.feature_2')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> {t('plan_upgrade_modal.enterprise.feature_3')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> {t('plan_upgrade_modal.enterprise.feature_4')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> {t('plan_upgrade_modal.enterprise.feature_5')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> {t('plan_upgrade_modal.enterprise.feature_6')}</li>
                            </ul>
                            <button
                                onClick={() => {
                                    AnalyticsService.trackUpgradeTrigger({
                                        companyId: companyProfile?.id || 'unknown',
                                        feature: 'ENTERPRISE_PLAN',
                                        currentTier: companyProfile?.subscription?.tier || 'starter',
                                        reason: 'User clicked enterprise plan'
                                    });
                                    window.open('mailto:obchod@jobshaman.cz?subject=' + encodeURIComponent(t('plan_upgrade_modal.enterprise.email_subject')) + '&body=' + encodeURIComponent(t('plan_upgrade_modal.enterprise.email_body')), '_blank');
                                }}
                                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors shadow-sm"
                            >
                                {t('plan_upgrade_modal.enterprise.cta')}
                            </button>
                        </div>
                    </div>

                    <button onClick={onClose} className="mt-8 text-xs text-[var(--text-faint)] hover:text-[var(--text-strong)] font-bold transition-colors underline underline-offset-4 w-full text-center uppercase tracking-widest">
                        {t('plan_upgrade_modal.close_continue')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlanUpgradeModal;
