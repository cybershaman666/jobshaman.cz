import React, { useState } from 'react';
import { Mail, Phone, Building, Users, CheckCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AnalyticsService from '../services/analyticsService';

const EnterpriseSignup: React.FC = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        companyName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        companySize: '',
        industry: '',
        currentChallenges: '',
        expectedHires: '',
        timeline: ''
    });
    
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e: any) => {
        const target = e.target;
        const { name, value } = target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Track enterprise signup request
            AnalyticsService.trackUpgradeTrigger({
                feature: 'ENTERPRISE_REQUEST',
                currentTier: 'enterprise_inquiry',
                reason: 'User submitted enterprise signup form',
                metadata: {
                    companySize: formData.companySize,
                    industry: formData.industry,
                    expectedHires: formData.expectedHires,
                    timeline: formData.timeline
                }
            });

            // In a real implementation, this would send to sales/CRM
            // For now, we'll send to a webhook or email
            const response = await fetch('/api/enterprise-inquiry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    submittedAt: new Date().toISOString(),
                    source: 'self_service_signup'
                })
            });

            if (response.ok) {
                setIsSubmitted(true);
            } else {
                throw new Error('Failed to submit inquiry');
            }
        } catch (error) {
            console.error('Enterprise signup error:', error);
            alert(t('alerts.generic_try_later'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const companySizeOptions = [
        t('enterprise_signup.options.company_size.1_10'),
        t('enterprise_signup.options.company_size.11_50'),
        t('enterprise_signup.options.company_size.51_200'),
        t('enterprise_signup.options.company_size.201_1000'),
        t('enterprise_signup.options.company_size.1000_plus')
    ];

    const industryOptions = [
        t('enterprise_signup.options.industry.tech_it'),
        t('enterprise_signup.options.industry.finance'),
        t('enterprise_signup.options.industry.ecommerce'),
        t('enterprise_signup.options.industry.manufacturing'),
        t('enterprise_signup.options.industry.healthcare'),
        t('enterprise_signup.options.industry.education'),
        t('enterprise_signup.options.industry.consulting'),
        t('enterprise_signup.options.industry.other')
    ];

    const timelineOptions = [
        t('enterprise_signup.options.timeline.immediately'),
        t('enterprise_signup.options.timeline.1_month'),
        t('enterprise_signup.options.timeline.3_months'),
        t('enterprise_signup.options.timeline.6_months'),
        t('enterprise_signup.options.timeline.next_year')
    ];

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-8">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                        {t('enterprise_signup.success.title')}
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                        {t('enterprise_signup.success.subtitle')}
                    </p>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('enterprise_signup.success.next_title')}</h3>
                        <div className="space-y-4 text-left">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-sm font-bold">1</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{t('enterprise_signup.success.step1_title')}</h4>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t('enterprise_signup.success.step1_desc')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-sm font-bold">2</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{t('enterprise_signup.success.step2_title')}</h4>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t('enterprise_signup.success.step2_desc')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-sm font-bold">3</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{t('enterprise_signup.success.step3_title')}</h4>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t('enterprise_signup.success.step3_desc')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl flex items-center justify-center">
                                <Building size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('enterprise_signup.title')}</h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('enterprise_signup.subtitle')}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            {t('enterprise_signup.back')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left: Benefits */}
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                            {t('enterprise_signup.hero_title')}
                        </h2>
                        
                        <div className="space-y-6 mb-8">
                            {[
                                {
                                    icon: Users,
                                    title: t('enterprise_signup.benefits.unlimited_jobs_title'),
                                    description: t('enterprise_signup.benefits.unlimited_jobs_desc')
                                },
                                {
                                    icon: CheckCircle,
                                    title: t('enterprise_signup.benefits.ai_assessment_title'),
                                    description: t('enterprise_signup.benefits.ai_assessment_desc')
                                },
                                {
                                    icon: ArrowRight,
                                    title: t('enterprise_signup.benefits.ats_title'),
                                    description: t('enterprise_signup.benefits.ats_desc')
                                },
                                {
                                    icon: Building,
                                    title: t('enterprise_signup.benefits.support_title'),
                                    description: t('enterprise_signup.benefits.support_desc')
                                }
                            ].map((benefit, index) => (
                                <div key={index} className="flex gap-4">
                                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <benefit.icon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-1">{benefit.title}</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{benefit.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-700">
                            <h3 className="font-bold text-emerald-900 dark:text-emerald-100 mb-4">{t('enterprise_signup.why_title')}</h3>
                            <ul className="space-y-3 text-sm text-emerald-800 dark:text-emerald-200">
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>{t('enterprise_signup.why_items.1')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>{t('enterprise_signup.why_items.2')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>{t('enterprise_signup.why_items.3')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>{t('enterprise_signup.why_items.4')}</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('enterprise_signup.contact_title')}</h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-8">
                                {t('enterprise_signup.contact_subtitle')}
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.company_name')}*</label>
                                        <input
                                            type="text"
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            placeholder={t('enterprise_signup.form.company_name_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.contact_name')}*</label>
                                        <input
                                            type="text"
                                            name="contactName"
                                            value={formData.contactName}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            placeholder={t('enterprise_signup.form.contact_name_placeholder')}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.email')}*</label>
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                            <input
                                                type="email"
                                                name="contactEmail"
                                                value={formData.contactEmail}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                                placeholder={t('enterprise_signup.form.email_placeholder')}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.phone')}</label>
                                        <div className="relative">
                                            <Phone size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                            <input
                                                type="tel"
                                                name="contactPhone"
                                                value={formData.contactPhone}
                                                onChange={handleInputChange}
                                                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                                placeholder={t('enterprise_signup.form.phone_placeholder')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.company_size')}*</label>
                                        <select
                                            name="companySize"
                                            value={formData.companySize}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        >
                                            <option value="">{t('enterprise_signup.form.company_size_placeholder')}</option>
                                            {companySizeOptions.map(size => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.industry')}*</label>
                                        <select
                                            name="industry"
                                            value={formData.industry}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        >
                                            <option value="">{t('enterprise_signup.form.industry_placeholder')}</option>
                                            {industryOptions.map(industry => (
                                                <option key={industry} value={industry}>{industry}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.challenges')}*</label>
                                    <textarea
                                        name="currentChallenges"
                                        value={formData.currentChallenges}
                                        onChange={handleInputChange}
                                        required
                                        rows={4}
                                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                                        placeholder={t('enterprise_signup.form.challenges_placeholder')}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.expected_hires')}*</label>
                                        <input
                                            type="text"
                                            name="expectedHires"
                                            value={formData.expectedHires}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            placeholder={t('enterprise_signup.form.expected_hires_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('enterprise_signup.form.timeline')}*</label>
                                        <select
                                            name="timeline"
                                            value={formData.timeline}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        >
                                            <option value="">{t('enterprise_signup.form.timeline_placeholder')}</option>
                                            {timelineOptions.map(timeline => (
                                                <option key={timeline} value={timeline}>{timeline}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            {t('enterprise_signup.form.submitting')}
                                        </>
                                    ) : (
                                        <>
                                            <ArrowRight size={20} />
                                            {t('enterprise_signup.form.submit')}
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">{t('enterprise_signup.questions_title')}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    {t('enterprise_signup.questions_desc_prefix')} <a href="tel:+420123456789" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">+420 123 456 789</a> {t('enterprise_signup.questions_desc_middle')} <a href="mailto:enterprise@jobshaman.cz" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">enterprise@jobshaman.cz</a>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('enterprise_signup.questions_hours')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnterpriseSignup;
