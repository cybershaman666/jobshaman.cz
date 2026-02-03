
import React, { useState, useEffect } from 'react';
import {
    ShoppingBag,
    Users,
    Star,
    Clock,
    Target,
    Plus,
    Search,
    MapPin,
    Briefcase,
    CheckCircle,
    Hammer,
    Palette,
    Code2
} from 'lucide-react';
import { UserProfile } from '../types';
import FreelancerRegistrationModal from './FreelancerRegistrationModal';

interface Service {
    id: string;
    title: string;
    description: string;
    provider: string; // Freelancer Name
    provider_id: string;
    price: number;
    currency: string;
    rating: number;
    reviews_count: number;
    category: string;
    location?: string;
    created_at: string;
    is_verified?: boolean;
}

interface ServicesMarketplaceProps {
    theme?: 'light' | 'dark';
    userProfile: UserProfile;
}

import { useTranslation } from 'react-i18next';
import { createServiceInquiry, getCurrentUser, supabase } from '../services/supabaseService';

const ServicesMarketplace: React.FC<ServicesMarketplaceProps> = () => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showFreelancerModal, setShowFreelancerModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactTarget, setContactTarget] = useState<Service | null>(null);
    const [contactMessage, setContactMessage] = useState('');
    const [contacting, setContacting] = useState(false);
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [requireContact, setRequireContact] = useState(true);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);

    // Load services from Supabase
    useEffect(() => {
        loadServices();
    }, []);

    useEffect(() => {
        if (!showContactModal) return;
        let isMounted = true;
        (async () => {
            try {
                const user = await getCurrentUser();
                if (!isMounted) return;
                setContactEmail(user?.email || '');
                setContactPhone('');
                setRequireContact(true);

                if (user?.id && contactTarget?.provider_id) {
                    const { data } = await supabase
                        .from('service_inquiries')
                        .select('id')
                        .eq('freelancer_id', contactTarget.provider_id)
                        .eq('from_user_id', user.id)
                        .limit(1);
                    if (!isMounted) return;
                    if (data && data.length > 0) {
                        setRequireContact(false);
                    }
                } else if (contactTarget?.provider_id) {
                    const cached = localStorage.getItem(`freelance_contact_${contactTarget.provider_id}`);
                    if (!isMounted) return;
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        setContactEmail(parsed.email || '');
                        setContactPhone(parsed.phone || '');
                        setRequireContact(false);
                    }
                }
            } catch {
                if (!isMounted) return;
                setContactEmail('');
                setContactPhone('');
                setRequireContact(true);
            }
        })();
        return () => { isMounted = false; };
    }, [showContactModal, contactTarget?.provider_id]);

    const loadServices = async () => {
        try {
            setLoading(true);
            // Fetch all jobs with contract_type = 'freelance_service' that are published by freelancers
            const { data, error } = await supabase
                .from('jobs')
                .select('id, title, description, company, company_id, salary_from, salary_to, location, created_at')
                .eq('contract_type', 'freelance_service')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading services:', error);
                setServices([]);
                return;
            }

            // Transform the data to match Service interface
            const transformedServices: Service[] = (data || []).map((job: any) => ({
                id: job.id,
                title: job.title,
                description: job.description,
                provider: job.company,
                provider_id: job.user_id,
                price: job.salary_from || 0,
                currency: 'Kč',
                rating: 5.0, // Default rating for now
                reviews_count: 0, // Default
                category: 'crafts', // Default category
                location: job.location,
                created_at: job.created_at,
                is_verified: false
            }));

            setServices(transformedServices);
        } catch (err) {
            console.error('Error loading services:', err);
            setServices([]);
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { id: 'all', name: t('freelancer.marketplace.categories.all'), icon: Briefcase },
        { id: 'crafts', name: t('freelancer.marketplace.categories.crafts'), icon: Hammer },
        { id: 'it', name: t('freelancer.marketplace.categories.it'), icon: Code2 },
        { id: 'design', name: t('freelancer.marketplace.categories.design'), icon: Palette },
        { id: 'marketing', name: t('freelancer.marketplace.categories.marketing'), icon: Target },
        { id: 'admin', name: t('freelancer.marketplace.categories.admin'), icon: Users }
    ];

    const filteredServices = services.filter(service => {
        const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            service.provider.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                {t('freelancer.marketplace.title')}
                            </h1>
                            <p className="text-slate-600 dark:text-slate-300 text-lg mt-2 font-medium">
                                {t('freelancer.marketplace.subtitle')}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowFreelancerModal(true)}
                                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                {t('freelancer.marketplace.offer_service')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Pills */}
            <div className="max-w-7xl mx-auto px-4 py-6 overflow-x-auto">
                <div className="flex gap-2 pb-2">
                    {categories.map(cat => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all font-medium border ${isSelected
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                                    }`}
                            >
                                <Icon size={16} />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Filters */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Search */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t('freelancer.marketplace.filters.search_title')}</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={t('freelancer.marketplace.search_placeholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                            <h3 className="font-bold text-lg mb-2">{t('freelancer.marketplace.promo.title')}</h3>
                            <p className="text-indigo-100 text-sm mb-4">
                                {t('freelancer.marketplace.promo.desc')}
                                <strong> {t('freelancer.marketplace.promo.highlight')}</strong>
                            </p>
                            <button
                                onClick={() => setShowFreelancerModal(true)}
                                className="w-full py-2 bg-white text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors text-sm"
                            >
                                {t('freelancer.marketplace.promo.cta')}
                            </button>
                        </div>
                    </div>

                    {/* Services Grid */}
                    <div className="lg:col-span-3">
                        {loading ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="inline-block">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
                                </div>
                                <p className="text-slate-500 mt-4">{t('app.loading')}</p>
                            </div>
                        ) : filteredServices.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all shadow-sm group flex flex-col h-full">
                                        <div className="p-6 flex-1">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg">
                                                        {service.provider.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{service.provider}</h4>
                                                        <div className="flex items-center gap-1 text-xs text-amber-500">
                                                            <Star size={12} fill="currentColor" />
                                                            <span className="font-medium">{service.rating}</span>
                                                            <span className="text-slate-400 dark:text-slate-500">({service.reviews_count} {t('freelancer.marketplace.card.reviews')})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {service.is_verified && (
                                                    <span className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                                        <CheckCircle size={12} />
                                                        {t('freelancer.marketplace.card.verified')}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                                {service.title}
                                            </h3>

                                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">
                                                {service.description}
                                            </p>

                                            <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mb-4">
                                                {service.location && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={14} />
                                                        {service.location}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} />
                                                    {t('freelancer.marketplace.card.response_time')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between rounded-b-xl">
                                            <div className="font-bold text-lg text-slate-900 dark:text-white">
                                                {service.price.toLocaleString()} {service.currency}
                                            </div>
                                            <button
                                                onClick={() => { setContactTarget(service); setShowContactModal(true); }}
                                                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
                                            >
                                                {t('freelancer_marketplace_extra.inquire_btn')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('freelancer_marketplace_extra.empty_state_title')}</h3>
                                <p className="text-slate-500 mb-6">{t('freelancer_marketplace_extra.empty_state_desc')}</p>
                                <button
                                    onClick={() => setShowFreelancerModal(true)}
                                    className="px-6 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors"
                                >
                                    {t('freelancer_marketplace_extra.create_offer_btn')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FreelancerRegistrationModal
                isOpen={showFreelancerModal}
                onClose={() => setShowFreelancerModal(false)}
            />

            {/* Contact Modal for Services */}
            {showContactModal && contactTarget && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowContactModal(false)}></div>
                    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 z-10">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold">{contactTarget.title}</h3>
                                <p className="text-sm text-slate-500">{contactTarget.provider}</p>
                            </div>
                            <button onClick={() => setShowContactModal(false)} className="text-slate-500 hover:text-slate-700">✕</button>
                        </div>

                        <input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder={t('freelancer_marketplace.contact_email_placeholder') || 'Váš e-mail (povinný)'}
                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white mb-3"
                            required={requireContact}
                        />

                        <input
                            type="tel"
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            placeholder={t('freelancer_marketplace.contact_phone_placeholder') || 'Telefon (nepovinný)'}
                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white mb-3"
                        />

                        <textarea
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            placeholder={t('freelancer_marketplace.contact_placeholder')}
                            className="w-full min-h-[120px] p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white mb-4"
                        />

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowContactModal(false)} className="px-4 py-2 rounded-lg border text-sm">{t('freelancer_marketplace.contact_cancel') || 'Zrušit'}</button>
                            <button onClick={async () => {
                                try {
                                    setContacting(true);
                                    const user = await getCurrentUser();
                                    const payload = {
                                        service_id: contactTarget.id,
                                        freelancer_id: contactTarget.provider_id,
                                        from_user_id: user?.id || null,
                                        from_email: contactEmail || null,
                                        message: contactMessage || null,
                                        metadata: contactPhone ? { contact_phone: contactPhone } : null
                                    };
                                    await createServiceInquiry(payload);
                                    if (!user?.id && contactTarget?.provider_id) {
                                        localStorage.setItem(`freelance_contact_${contactTarget.provider_id}`, JSON.stringify({
                                            email: contactEmail,
                                            phone: contactPhone
                                        }));
                                    }
                                    setContacting(false);
                                    setShowContactModal(false);
                                    setContactMessage('');
                                    setContactEmail('');
                                    setContactPhone('');
                                    setContactTarget(null);
                                    alert(t('freelancer_marketplace.contact_sent') || 'Zpráva byla odeslána. Freelancer bude kontaktován.');
                                } catch (err) {
                                    console.error('Contact failed', err);
                                    setContacting(false);
                                    alert(t('freelancer_marketplace.contact_failed') || 'Odeslání se nezdařilo. Zkuste to prosím později.');
                                }
                            }} disabled={contacting || !contactMessage.trim() || (requireContact && !contactEmail.trim())} className="px-4 py-2 rounded-lg bg-cyan-600 text-white disabled:opacity-50">{contacting ? (t('freelancer_marketplace.contact_sending') || 'Odesílám...') : (t('freelancer_marketplace.contact_send') || 'Odeslat')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesMarketplace;
