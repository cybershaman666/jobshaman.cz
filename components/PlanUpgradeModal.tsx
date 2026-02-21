import React from 'react';
import { Briefcase, BrainCircuit, Sparkles, Crown, CheckCircle } from 'lucide-react';
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                onClick={onClose}
            ></div>
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row">
                {/* Left Side: Feature Context */}
                <div className="md:w-1/3 bg-slate-50 dark:bg-slate-950 p-8 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center md:overflow-y-auto">
                    <div className="w-16 h-16 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-6">
                        <Crown size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                        {t('plan_upgrade_modal.premium_features')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed text-sm">
                        {t('plan_upgrade_modal.feature_requires_plan_prefix')}{' '}
                        <span className="font-bold text-cyan-600 dark:text-cyan-400">"{feature}"</span>{' '}
                        {t('plan_upgrade_modal.feature_requires_plan_suffix')}
                    </p>
                    <div className="space-y-3">
                        {[
                            { icon: Briefcase, text: t('plan_upgrade_modal.highlights.unlimited_job_posts') },
                            { icon: BrainCircuit, text: t('plan_upgrade_modal.highlights.ai_assessments') },
                            { icon: Sparkles, text: t('plan_upgrade_modal.highlights.ai_job_optimization') },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
                                    <f.icon size={14} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Options */}
                <div className="flex-1 p-8 bg-white dark:bg-slate-900 overflow-y-auto max-h-[90vh] md:max-h-full">
                    <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">
                        {t('plan_upgrade_modal.select_solution')}
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Option 1: Basic Plan (Free) */}
                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{t('plan_upgrade_modal.basic.title')}</h4>
                                        <p className="text-xs text-slate-500">{t('plan_upgrade_modal.basic.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-green-600 dark:text-green-400 text-xl">{t('plan_upgrade_modal.basic.price')}</div>
                                    <div className="text-[10px] text-slate-400">{t('plan_upgrade_modal.basic.price_suffix')}</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-green-500" /> {t('plan_upgrade_modal.basic.feature_1')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-green-500" /> {t('plan_upgrade_modal.basic.feature_2')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 inline-block"></span> {t('plan_upgrade_modal.basic.feature_3')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 inline-block"></span> {t('plan_upgrade_modal.basic.feature_4')}</li>
                            </ul>
                            <button
                                onClick={onClose}
                                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-sm"
                            >
                                {t('plan_upgrade_modal.basic.cta')}
                            </button>
                        </div>

                        {/* Option 2: Business Plan */}
                        <div className="p-4 rounded-xl border-2 border-cyan-500 bg-cyan-50/10 relative">
                            <div className="absolute -top-3 right-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">{t('plan_upgrade_modal.business.recommended_badge')}</div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                        <Crown size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{t('plan_upgrade_modal.business.title')}</h4>
                                        <p className="text-xs text-slate-500">{t('plan_upgrade_modal.business.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-cyan-600 dark:text-cyan-400 text-xl">4 990 Kč</div>
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{t('plan_upgrade_modal.business.price_suffix')}</div>
                                    <div className="text-[9px] text-slate-400 line-through">{t('plan_upgrade_modal.business.price_regular')}</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> {t('plan_upgrade_modal.business.feature_1')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> {t('plan_upgrade_modal.business.feature_2')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> {t('plan_upgrade_modal.business.feature_3')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> {t('plan_upgrade_modal.business.feature_4')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> {t('plan_upgrade_modal.business.feature_5')}</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> {t('plan_upgrade_modal.business.feature_6')}</li>
                            </ul>
                            <button
                                onClick={() => {
                                    if (companyProfile?.id) {
                                        AnalyticsService.trackUpgradeTrigger({
                                            companyId: companyProfile.id,
                                            feature: 'BUSINESS_COMPANY_PLAN',
                                            currentTier: companyProfile.subscription?.tier || 'basic',
                                            reason: 'User clicked business company plan'
                                        });

                                        ABTestService.trackConversion('pricing_display_test', 'business_clicked', 4990);
                                        redirectToCheckout('business', companyProfile.id);
                                    } else {
                                        console.error('❌ Company ID missing in profile!');
                                        alert(t('alerts.company_id_load_failed'));
                                    }
                                }}
                                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                            >
                                {t('plan_upgrade_modal.business.cta')}
                            </button>
                        </div>

                        {/* Option 3: Assessment Add-ons */}
                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{t('plan_upgrade_modal.assessment_center.title')}</h4>
                                        <p className="text-xs text-slate-500">{t('plan_upgrade_modal.assessment_center.subtitle')}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Single Assessment */}
                                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div>
                                        <div className="font-bold text-sm text-slate-900 dark:text-white">{t('plan_upgrade_modal.assessment_center.single_title')}</div>
                                        <div className="text-xs text-slate-500">{t('plan_upgrade_modal.assessment_center.single_subtitle')}</div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!companyProfile?.id) {
                                                console.error('❌ Company ID missing!', companyProfile);
                                                alert(t('alerts.company_identify_failed'));
                                                return;
                                            }

                                            AnalyticsService.trackUpgradeTrigger({
                                                companyId: companyProfile.id,
                                                feature: 'SINGLE_ASSESSMENT',
                                                currentTier: companyProfile.subscription?.tier || 'basic',
                                                reason: 'User clicked single assessment'
                                            });

                                            ABTestService.trackConversion('pricing_display_test', 'single_assessment_clicked', 99);

                                            try {
                                                await redirectToCheckout('single_assessment', companyProfile.id);
                                            } catch (err) {
                                                console.error('❌ Error during checkout redirect:', err);
                                                alert(`${t('alerts.payment_start_failed')}: ${err instanceof Error ? err.message : String(err)}`);
                                            }
                                        }}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-sm transition-colors"
                                    >
                                        99 Kč
                                    </button>
                                </div>

                                {/* Assessment Bundle */}
                                <div className="flex justify-between items-center p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border-2 border-cyan-200 dark:border-cyan-800">
                                    <div>
                                        <div className="font-bold text-sm text-slate-900 dark:text-white">{t('plan_upgrade_modal.assessment_center.bundle_title')}</div>
                                        <div className="text-xs text-slate-500">{t('plan_upgrade_modal.assessment_center.bundle_subtitle')}</div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!companyProfile?.id) {
                                                console.error('❌ Company ID missing!', companyProfile);
                                                alert(t('alerts.company_identify_failed'));
                                                return;
                                            }

                                            try {
                                                AnalyticsService.trackUpgradeTrigger({
                                                    companyId: companyProfile.id,
                                                    feature: 'ASSESSMENT_BUNDLE_10',
                                                    currentTier: companyProfile.subscription?.tier || 'basic',
                                                    reason: 'User clicked 10 assessment bundle'
                                                });

                                                ABTestService.trackConversion('pricing_display_test', 'assessment_bundle_10_clicked', 990);

                                                await redirectToCheckout('assessment_bundle', companyProfile.id);
                                            } catch (err) {
                                                console.error('❌ Error during checkout redirect:', err);
                                                alert(`${t('alerts.payment_start_failed')}: ${err instanceof Error ? err.message : String(err)}`);
                                            }
                                        }}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
                                    >
                                        990 Kč
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Option 4: Enterprise Plan */}
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
                                        currentTier: companyProfile?.subscription?.tier || 'basic',
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

                    <button onClick={onClose} className="mt-6 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white underline w-full text-center">
                        {t('plan_upgrade_modal.close_continue')}
                    </button>
                </div>
            </div>
        </div >
    );
};

export default PlanUpgradeModal;
