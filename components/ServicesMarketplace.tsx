
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
    provider_avatar_url?: string | null;
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
import { createServiceInquiry, getCurrentUser, getFreelancerProfile, getFreelancerReviewStats, getFreelancerReviews, createFreelancerReview, voteFreelancerReview, supabase } from '../services/supabaseService';

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
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileTarget, setProfileTarget] = useState<Service | null>(null);
    const [profileDetails, setProfileDetails] = useState<any | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileReviews, setProfileReviews] = useState<any[]>([]);
    const [profileReviewsLoading, setProfileReviewsLoading] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
                .select('id, title, description, company, company_id, recruiter_id, salary_from, salary_to, location, created_at, category, posted_by')
                .eq('contract_type', 'freelance_service')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading services:', error);
                setServices([]);
                return;
            }

            // Transform the data to match Service interface
            const providerIds = (data || []).map((job: any) => job.posted_by || job.recruiter_id).filter(Boolean);
            let reviewStatsMap: Record<string, { avg_rating?: number; reviews_count?: number }> = {};
            if (providerIds.length > 0) {
                const stats = await getFreelancerReviewStats(providerIds);
                reviewStatsMap = (stats || []).reduce((acc: any, s: any) => {
                    acc[s.freelancer_id] = { avg_rating: s.avg_rating, reviews_count: s.reviews_count };
                    return acc;
                }, {});
            }

            let profileMap: Record<string, { full_name?: string; avatar_url?: string }> = {};
            if (providerIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', providerIds);

                if (!profilesError && profilesData) {
                    profileMap = profilesData.reduce((acc: any, p: any) => {
                        acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
                        return acc;
                    }, {});
                } else if (profilesError) {
                    console.warn('Profiles enrichment failed (non-fatal):', profilesError);
                }
            }

            const transformedServices: Service[] = (data || []).map((job: any) => {
                const providerId = job.posted_by || job.recruiter_id;
                const profile = providerId ? profileMap[providerId] : undefined;
                const stats = reviewStatsMap[providerId] || {};
                return {
                id: job.id,
                title: job.title,
                description: job.description,
                provider: job.company || profile?.full_name || (t('freelancer_marketplace.unknown_name') || 'Freelancer'),
                provider_id: providerId,
                provider_avatar_url: profile?.avatar_url || null,
                price: job.salary_from || 0,
                currency: 'Kč',
                rating: stats.avg_rating || 0,
                reviews_count: stats.reviews_count || 0,
                category: job.category || 'crafts', // Default category
                location: job.location,
                created_at: job.created_at,
                is_verified: false
            }});

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

    const openProfile = async (service: Service) => {
        setProfileTarget(service);
        setShowProfileModal(true);
        setProfileLoading(true);
        setProfileError(null);
        setProfileDetails(null);
        setProfileReviews([]);
        setProfileReviewsLoading(true);
        setReviewRating(0);
        setReviewComment('');
        if (!service.provider_id) {
            setProfileError(t('freelancer_marketplace.profile_error') || 'Profil se nepodařilo načíst.');
            setProfileLoading(false);
            setProfileReviewsLoading(false);
            return;
        }
        try {
            const user = await getCurrentUser();
            setCurrentUserId(user?.id || null);
            const details = await getFreelancerProfile(service.provider_id);
            setProfileDetails(details);
            const reviews = await getFreelancerReviews(service.provider_id);
            setProfileReviews(reviews || []);
        } catch (err) {
            console.error('Failed to load freelancer profile details:', err);
            setProfileError(t('freelancer_marketplace.profile_error') || 'Profil se nepodařilo načíst.');
        } finally {
            setProfileLoading(false);
            setProfileReviewsLoading(false);
        }
    };

    const submitReview = async () => {
        if (!profileTarget || !currentUserId || reviewRating === 0) return;
        try {
            setReviewSubmitting(true);
            await createFreelancerReview({
                freelancer_id: profileTarget.provider_id,
                reviewer_id: currentUserId,
                rating: reviewRating,
                comment: reviewComment
            });
            const reviews = await getFreelancerReviews(profileTarget.provider_id);
            setProfileReviews(reviews || []);
            setReviewRating(0);
            setReviewComment('');
        } catch (err) {
            console.error('Failed to submit freelancer review:', err);
            alert(t('freelancer_marketplace.review_submit_error') || 'Recenzi se nepodařilo odeslat.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    const createFreelancerReviewVote = async (isHelpful: boolean, reviewId: string) => {
        if (!currentUserId) return;
        try {
            await voteFreelancerReview({
                review_id: reviewId,
                voter_id: currentUserId,
                is_helpful: isHelpful
            });
            if (profileTarget?.provider_id) {
                const reviews = await getFreelancerReviews(profileTarget.provider_id);
                setProfileReviews(reviews || []);
            }
        } catch (err) {
            console.error('Freelancer review vote error:', err);
        }
    };

    // (removed duplicate openProfile)

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
                                    <div
                                        key={service.id}
                                        onClick={() => openProfile(service)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openProfile(service);
                                            }
                                        }}
                                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all shadow-sm group flex flex-col h-full cursor-pointer"
                                    >
                                        <div className="p-6 flex-1">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg overflow-hidden">
                                                        {service.provider_avatar_url ? (
                                                            <img src={service.provider_avatar_url} alt={service.provider} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{service.provider.charAt(0)}</span>
                                                        )}
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setContactTarget(service);
                                                    setShowContactModal(true);
                                                }}
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

            {/* Profile Modal */}
            {showProfileModal && profileTarget && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowProfileModal(false)}></div>
                    <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 z-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden text-slate-500 font-bold text-xl">
                                    {profileTarget.provider_avatar_url ? (
                                        <img src={profileTarget.provider_avatar_url} alt={profileTarget.provider} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{profileTarget.provider.charAt(0)}</span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{profileTarget.provider}</h3>
                                    <p className="text-sm text-cyan-600 dark:text-cyan-400 font-semibold">{profileTarget.title}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowProfileModal(false)} className="text-slate-500 hover:text-slate-700">✕</button>
                        </div>

                        {profileLoading ? (
                            <div className="py-12 text-center text-slate-500">{t('app.loading')}</div>
                        ) : profileError ? (
                            <div className="py-12 text-center text-rose-500">{profileError}</div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <section>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                            {t('freelancer_marketplace.profile.about') || 'O mně'}
                                        </h4>
                                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                            {profileDetails?.presentation || profileDetails?.bio || profileTarget.description}
                                        </p>
                                    </section>

                                    {(profileDetails?.skills?.length || profileDetails?.tags?.length) ? (
                                        <section>
                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                                {t('freelancer_marketplace.profile.skills') || 'Dovednosti'}
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {(profileDetails?.skills || []).map((skill: string) => (
                                                    <span key={`skill-${skill}`} className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                                        {skill}
                                                    </span>
                                                ))}
                                                {(profileDetails?.tags || []).map((tag: string) => (
                                                    <span key={`tag-${tag}`} className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </section>
                                    ) : null}

                                    <section>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                            {t('freelancer_marketplace.profile.portfolio') || 'Portfolio'}
                                        </h4>
                                        {(profileDetails?.freelancer_portfolio_items || []).length === 0 ? (
                                            <div className="text-sm text-slate-500">{t('freelancer_marketplace.profile.no_portfolio') || 'Zatím bez položek.'}</div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {profileDetails?.freelancer_portfolio_items?.map((item: any) => {
                                                    const imageSrc = item.image_url || item.imageUrl || item.media_url || item.mediaUrl || item.metadata?.image_url;
                                                    return (
                                                        <div key={item.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                                            {imageSrc && (
                                                                <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                                                                    <img src={imageSrc} alt={item.title || 'Portfolio'} className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="p-3">
                                                                <div className="font-semibold text-slate-900 dark:text-white">{item.title || t('freelancer_marketplace.profile.portfolio_item') || 'Ukázka'}</div>
                                                                {item.description && (
                                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">{item.description}</p>
                                                                )}
                                                                {item.url && (
                                                                    <a
                                                                        href={item.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 mt-2 hover:underline"
                                                                    >
                                                                        {t('freelancer_marketplace.profile.view_link') || 'Otevřít'}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>

                                    <section>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                            {t('freelancer_marketplace.profile.reviews') || 'Recenze'}
                                        </h4>
                                        {profileReviewsLoading ? (
                                            <div className="text-sm text-slate-500">{t('app.loading')}</div>
                                        ) : profileReviews.length === 0 ? (
                                            <div className="text-sm text-slate-500">{t('freelancer_marketplace.profile.no_reviews') || 'Zatím žádné recenze.'}</div>
                                        ) : (
                                            <div className="space-y-3">
                                                {profileReviews.map((review) => (
                                                    <div key={review.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                                {review.candidate_name || t('freelancer_marketplace.profile.review_anon') || 'Anonym'}
                                                            </div>
                                                            <div className="text-xs font-bold text-amber-500">{review.rating}/5</div>
                                                        </div>
                                                        {review.is_verified_customer && (
                                                            <div className="text-[10px] font-semibold text-emerald-600 mb-1">
                                                                {t('freelancer_marketplace.profile.verified_customer') || 'Ověřený zákazník'}
                                                            </div>
                                                        )}
                                                        {review.comment && (
                                                            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                                                {review.comment}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                            <button
                                                                onClick={() => createFreelancerReviewVote(true, review.id)}
                                                                disabled={!currentUserId}
                                                                className="hover:text-slate-700 disabled:opacity-50"
                                                            >
                                                                {t('freelancer_marketplace.profile.helpful') || 'Užitečné'} ({review.helpful_count || 0})
                                                            </button>
                                                            <button
                                                                onClick={() => createFreelancerReviewVote(false, review.id)}
                                                                disabled={!currentUserId}
                                                                className="hover:text-slate-700 disabled:opacity-50"
                                                            >
                                                                {t('freelancer_marketplace.profile.not_helpful') || 'Není užitečné'} ({review.unhelpful_count || 0})
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {currentUserId ? (
                                            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                                                    {t('freelancer_marketplace.profile.add_review') || 'Přidat recenzi'}
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => setReviewRating(star)}
                                                            className={`text-sm font-bold px-2 py-1 rounded ${reviewRating >= star ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
                                                        >
                                                            {star}
                                                        </button>
                                                    ))}
                                                </div>
                                                <textarea
                                                    value={reviewComment}
                                                    onChange={(e) => setReviewComment(e.target.value)}
                                                    placeholder={t('freelancer_marketplace.profile.review_placeholder') || 'Napište krátké hodnocení...'}
                                                    className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                />
                                                <div className="flex justify-end mt-2">
                                                    <button
                                                        onClick={submitReview}
                                                        disabled={reviewSubmitting || reviewRating === 0}
                                                        className="px-3 py-2 bg-cyan-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                                                    >
                                                        {reviewSubmitting ? (t('freelancer_marketplace.profile.review_sending') || 'Odesílám...') : (t('freelancer_marketplace.profile.review_submit') || 'Odeslat recenzi')}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-4 text-xs text-slate-500">
                                                {t('freelancer_marketplace.profile.review_login') || 'Pro přidání recenze se prosím přihlaste.'}
                                            </div>
                                        )}
                                    </section>
                                </div>

                                <aside className="space-y-4">
                                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="text-sm text-slate-500">{t('freelancer_marketplace.profile.rate') || 'Sazba'}</div>
                                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                                            {profileDetails?.hourly_rate
                                                ? `${profileDetails?.hourly_rate} ${profileDetails?.currency || 'CZK'}`
                                                : (t('freelancer_marketplace.profile.rate_on_request') || 'Dohodou')}
                                            {profileDetails?.hourly_rate && (
                                                <span className="text-sm font-semibold text-slate-500">/hod</span>
                                            )}
                                        </div>
                                    </div>

                                    {profileDetails?.availability && (
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="text-sm text-slate-500">{t('freelancer_marketplace.profile.availability') || 'Dostupnost'}</div>
                                            <div className="font-semibold text-slate-900 dark:text-white">{profileDetails.availability}</div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            setShowProfileModal(false);
                                            setContactTarget(profileTarget);
                                            setShowContactModal(true);
                                        }}
                                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors"
                                    >
                                        {t('freelancer_marketplace.contact_btn') || 'Kontaktovat'}
                                    </button>
                                </aside>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
