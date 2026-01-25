import React, { useState } from 'react';
import { Mail, Phone, Building, Users, CheckCircle, ArrowRight } from 'lucide-react';
import AnalyticsService from '../services/analyticsService';

const EnterpriseSignup: React.FC = () => {
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
            alert('Došlo k chybě. Zkuste to prosím později nebo kontaktujte nás přímo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const companySizeOptions = [
        '1-10 zaměstnanců',
        '11-50 zaměstnanců',
        '51-200 zaměstnanců',
        '201-1000 zaměstnanců',
        '1000+ zaměstnanců'
    ];

    const industryOptions = [
        'Technologie a IT',
        'Finance a bankovnictví',
        'E-commerce a retail',
        'Výroba a průmysl',
        'Zdravotnictví a farmacie',
        'Vzdělávání',
        'Konzultace a profesionální služby',
        'Ostatní'
    ];

    const timelineOptions = [
        'Okamžitě',
        'Do 1 měsíce',
        'Do 3 měsíce',
        'Do 6 měsíců',
        'Plánujeme na příští rok'
    ];

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-8">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                        Děkujeme za Váš zájem!
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                        Náš obchodní tým vás bude kontaktovat do 24 hodin, aby probral vaše potřeby a připravil nabídku na míru.
                    </p>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Co se stane dál?</h3>
                        <div className="space-y-4 text-left">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-sm font-bold">1</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Kontakt do 24 hodin</h4>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">Náš specializovaný tým vás bude kontaktovat</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-sm font-bold">2</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Analýza potřeb</h4>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">Připravíme personalizovanou nabídku</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-sm font-bold">3</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Custom nasazení</h4>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">Technické nastavení a integrace</p>
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
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">JobShaman Enterprise</h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Pro firmy s pokročilými náborovými potřebami</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            Zpět na JobShaman
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
                            Říkejte svůj nábor na novou úroveň
                        </h2>
                        
                        <div className="space-y-6 mb-8">
                            {[
                                {
                                    icon: Users,
                                    title: 'Neomezené množství inzerátů',
                                    description: 'Publikujte tolik pozic, kolik potřebujete, bez jakýchkoliv limitů.'
                                },
                                {
                                    icon: CheckCircle,
                                    title: 'Pokročilé AI Assessmenty',
                                    description: 'Neomezené používání AI testování s pokročilou analýzou kandidátů.'
                                },
                                {
                                    icon: ArrowRight,
                                    title: 'ATS Integrace',
                                    description: 'Spojte se s Greenhouse, Lever, Workday a dalšími systémy.'
                                },
                                {
                                    icon: Building,
                                    title: 'Prioritní podpora',
                                    description: 'Vyhrazený account manager a technická podpora 24/7.'
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
                            <h3 className="font-bold text-emerald-900 dark:text-emerald-100 mb-4">Proč Enterprise?</h3>
                            <ul className="space-y-3 text-sm text-emerald-800 dark:text-emerald-200">
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>Vlastní ATS integrace na míru</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>Advanced AI funkce a reporting</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>SLA garance a emergency podpora</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <span>Custom reporting a analytics</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Kontaktujte nás</h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-8">
                                Vyplňte formulář a my vám připravíme personalizovanou nabídku do 24 hodin.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Název firmy*</label>
                                        <input
                                            type="text"
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            placeholder="Název vaší firmy"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Jméno kontaktu*</label>
                                        <input
                                            type="text"
                                            name="contactName"
                                            value={formData.contactName}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            placeholder="Jméno a příjmení"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">E-mail*</label>
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                            <input
                                                type="email"
                                                name="contactEmail"
                                                value={formData.contactEmail}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                                placeholder="kontakt@firma.cz"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Telefon</label>
                                        <div className="relative">
                                            <Phone size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                            <input
                                                type="tel"
                                                name="contactPhone"
                                                value={formData.contactPhone}
                                                onChange={handleInputChange}
                                                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                                placeholder="+420 123 456 789"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Velikost firmy*</label>
                                        <select
                                            name="companySize"
                                            value={formData.companySize}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        >
                                            <option value="">Vyberte velikost</option>
                                            {companySizeOptions.map(size => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Průmysl*</label>
                                        <select
                                            name="industry"
                                            value={formData.industry}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        >
                                            <option value="">Vyberte průmysl</option>
                                            {industryOptions.map(industry => (
                                                <option key={industry} value={industry}>{industry}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Aktuální výzvy v náboru*</label>
                                    <textarea
                                        name="currentChallenges"
                                        value={formData.currentChallenges}
                                        onChange={handleInputChange}
                                        required
                                        rows={4}
                                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                                        placeholder="Popište hlavní problémy, kterým čelíte..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Plánovaný počet náborů*</label>
                                        <input
                                            type="text"
                                            name="expectedHires"
                                            value={formData.expectedHires}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            placeholder="např. 10-50 pozic za rok"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Časový horizont*</label>
                                        <select
                                            name="timeline"
                                            value={formData.timeline}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        >
                                            <option value="">Vyberte časový horizont</option>
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
                                            Odesílám...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowRight size={20} />
                                            Požádat o nabídku
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Máte otázky?</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    Zavolejte nám přímo na <a href="tel:+420123456789" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">+420 123 456 789</a> nebo pište na <a href="mailto:enterprise@jobshaman.cz" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">enterprise@jobshaman.cz</a>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Pracovní dny: Po-Pá, 9:00-17:00
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