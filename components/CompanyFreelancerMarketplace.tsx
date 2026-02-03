import React, { useState, useEffect } from 'react';
import {
    Search,
    MapPin,
    Star,
    Briefcase,
    CheckCircle,
    Hammer,
    Palette,
    Code2,
    Users,
    Award,
    TrendingUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createServiceInquiry, getCurrentUser, supabase } from '../services/supabaseService';

interface Freelancer {
    id: string;
    name: string;
    title: string;
    description: string;
    category: string;
    location?: string;
    rating: number;
    reviews_count: number;
    hourly_rate?: number;
    verified: boolean;
    image?: string;
    badge?: string;
}

const CompanyFreelancerMarketplace: React.FC = () => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showContactModal, setShowContactModal] = useState(false);
    const [contacting, setContacting] = useState(false);
    const [contactMessage, setContactMessage] = useState('');
    const [contactTarget, setContactTarget] = useState<Freelancer | null>(null);
    const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
    const [loading, setLoading] = useState(true);

    // Load freelancers from Supabase
    useEffect(() => {
        loadFreelancers();
    }, []);

    const loadFreelancers = async () => {
        try {
            setLoading(true);
            // Base query: freelancer_profiles only (public read via RLS)
            const { data, error } = await supabase
                .from('freelancer_profiles')
                .select('id, headline, bio, hourly_rate, address, tags, contact_email, website')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading freelancers:', error);
                setFreelancers([]);
                return;
            }

            const freelancerIds = (data || []).map((f: any) => f.id).filter(Boolean);

            // Try to enrich with profiles (optional; may be blocked by RLS)
            let profileMap: Record<string, { full_name?: string; avatar_url?: string }> = {};
            if (freelancerIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', freelancerIds);

                if (!profilesError && profilesData) {
                    profileMap = profilesData.reduce((acc: any, p: any) => {
                        acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
                        return acc;
                    }, {});
                } else if (profilesError) {
                    console.warn('Profiles enrichment failed (non-fatal):', profilesError);
                }
            }

            // Transform data to match Freelancer interface
            const transformedFreelancers: Freelancer[] = (data || []).map((freelancer: any) => {
                const profile = profileMap[freelancer.id];
                const emailName = freelancer.contact_email ? String(freelancer.contact_email).split('@')[0] : null;
                const displayName = profile?.full_name || freelancer.headline || emailName || t('freelancer_marketplace.unknown_name') || 'Freelancer';
                return {
                    id: freelancer.id,
                    name: displayName,
                    title: freelancer.headline || displayName,
                    description: freelancer.bio || t('freelancer_marketplace.no_bio') || 'Kvalitní freelancer',
                    category: Array.isArray(freelancer.tags) && freelancer.tags.length > 0 ? freelancer.tags[0] : 'crafts',
                    location: freelancer.address,
                    rating: 5.0, // Default rating
                    reviews_count: 0,
                    hourly_rate: freelancer.hourly_rate || 500, // Default rate
                    verified: false,
                    badge: undefined,
                    image: profile?.avatar_url || undefined
                };
            });

            setFreelancers(transformedFreelancers);
        } catch (err) {
            console.error('Error loading freelancers:', err);
            setFreelancers([]);
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { id: 'all', name: t('freelancer_marketplace.categories.all') || 'Všechny', icon: Briefcase },
        { id: 'it', name: t('freelancer_marketplace.categories.it') || 'IT & Vývoj', icon: Code2 },
        { id: 'design', name: t('freelancer_marketplace.categories.design') || 'Design', icon: Palette },
        { id: 'crafts', name: t('freelancer_marketplace.categories.crafts') || 'Řemesla', icon: Hammer },
        { id: 'marketing', name: t('freelancer_marketplace.categories.marketing') || 'Marketing', icon: TrendingUp }
    ];

    const filteredFreelancers = freelancers.filter(freelancer => {
        const matchesSearch = freelancer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            freelancer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            freelancer.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || freelancer.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getCategoryIcon = (categoryId: string) => {
        const cat = categories.find(c => c.id === categoryId);
        return cat?.icon || Briefcase;
    };

    const sendContact = async () => {
        if (!contactTarget) return;
        try {
            setContacting(true);
            const user = await getCurrentUser();
            const payload = {
                service_id: null,
                freelancer_id: contactTarget.id,
                from_user_id: user?.id || null,
                from_email: user?.email || null,
                message: contactMessage || null
            };
            await createServiceInquiry(payload);
            setContacting(false);
            setShowContactModal(false);
            setContactMessage('');
            setContactTarget(null);
            alert(t('freelancer_marketplace.contact_sent') || 'Zpráva byla odeslána. Freelancer bude kontaktován.');
        } catch (err) {
            console.error('Contact failed', err);
            setContacting(false);
            alert(t('freelancer_marketplace.contact_failed') || 'Odeslání se nezdařilo. Zkuste to prosím později.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {t('freelancer_marketplace.title') || 'Freelanceři a Živnostníci'}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                    {t('freelancer_marketplace.subtitle') || 'Najděte a najímejte kvalitní freelancery a řemeslníky z komunity JobShaman.'}
                </p>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-3 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder={t('freelancer_marketplace.search_placeholder') || 'Hledat freelancery, dovednosti...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                    />
                </div>

                {/* Category Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map(cat => {
                        const IconComponent = cat.icon;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                                    selectedCategory === cat.id
                                        ? 'bg-cyan-600 text-white shadow-lg'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                <IconComponent size={18} />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('freelancer_marketplace.results', { count: filteredFreelancers.length }) || `Nalezeno ${filteredFreelancers.length} freelancerů`}
                </p>
            </div>

            {/* Freelancers Grid */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="inline-block">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
                    </div>
                    <p className="text-slate-500 mt-4">{t('app.loading')}</p>
                </div>
            ) : filteredFreelancers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredFreelancers.map(freelancer => {
                        const IconComponent = getCategoryIcon(freelancer.category);
                        return (
                            <div
                                key={freelancer.id}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 group"
                            >
                                {/* Header with Category */}
                                <div className="h-20 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 flex items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                                            <IconComponent className="text-cyan-600 dark:text-cyan-400" size={24} />
                                        </div>
                                        {freelancer.badge && (
                                            <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full text-xs font-medium text-amber-700 dark:text-amber-400">
                                                <Award size={12} />
                                                {freelancer.badge}
                                            </div>
                                        )}
                                    </div>
                                    {freelancer.verified && (
                                        <CheckCircle className="text-emerald-500" size={20} />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-4 space-y-3">
                                    {/* Name & Title */}
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">{freelancer.name}</h3>
                                        <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">{freelancer.title}</p>
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                        {freelancer.description}
                                    </p>

                                    {/* Location */}
                                    {freelancer.location && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                            <MapPin size={16} className="shrink-0" />
                                            <span>{freelancer.location}</span>
                                        </div>
                                    )}

                                    {/* Rating */}
                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-1">
                                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                            <span className="font-bold text-slate-900 dark:text-white">{freelancer.rating.toFixed(1)}</span>
                                        </div>
                                        <span className="text-xs text-slate-500">({freelancer.reviews_count} {t('freelancer_marketplace.reviews') || 'recenzí'})</span>
                                    </div>

                                    {/* Hourly Rate */}
                                    {freelancer.hourly_rate && (
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <span className="text-sm text-slate-600 dark:text-slate-400">{t('freelancer_marketplace.hourly_rate') || 'Sazba:'}</span>
                                            <span className="font-bold text-cyan-600 dark:text-cyan-400">{freelancer.hourly_rate} Kč/hod</span>
                                        </div>
                                    )}

                                    {/* Contact Button */}
                                    <button onClick={() => { setContactTarget(freelancer); setShowContactModal(true); }} className="w-full py-2 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors">
                                        {t('freelancer_marketplace.contact_btn') || 'Kontaktovat'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Users className="text-slate-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                        Zatím nejsou žádní živnostníci
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                        Jakmile se někdo zaregistruje, uvidíte jej zde.
                    </p>
                </div>
            )}
            {/* Contact Modal */}
            {showContactModal && contactTarget && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowContactModal(false)}></div>
                    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 z-10">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold">{contactTarget.name}</h3>
                                <p className="text-sm text-slate-500">{contactTarget.title}</p>
                            </div>
                            <button onClick={() => setShowContactModal(false)} className="text-slate-500 hover:text-slate-700">✕</button>
                        </div>

                        <textarea
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            placeholder={t('freelancer_marketplace.contact_placeholder') || 'Napište zprávu freelancerovi...'}
                            className="w-full min-h-[120px] p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white mb-4"
                        />

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowContactModal(false)} className="px-4 py-2 rounded-lg border text-sm">{t('freelancer_marketplace.contact_cancel') || 'Zrušit'}</button>
                            <button onClick={sendContact} disabled={contacting || !contactMessage.trim()} className="px-4 py-2 rounded-lg bg-cyan-600 text-white disabled:opacity-50">
                                {contacting ? t('freelancer_marketplace.contact_sending') || 'Odesílám...' : t('freelancer_marketplace.contact_send') || 'Odeslat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CompanyFreelancerMarketplace;
