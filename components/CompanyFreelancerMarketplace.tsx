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
    TrendingUp,
    Link as LinkIcon,
    Building2,
    Landmark,
    ShieldCheck,
    Gavel
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createServiceInquiry, getCurrentUser, getFreelancerProfile, getFreelancerReviewStats, getFreelancerReviews, createFreelancerReview, voteFreelancerReview, searchFreelancers, getRecruiterCompany, supabase } from '../services/supabaseService';

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
    isPremium?: boolean;
}

interface FreelancerProfileDetails {
    id: string;
    headline?: string | null;
    bio?: string | null;
    presentation?: string | null;
    hourly_rate?: number | null;
    currency?: string | null;
    skills?: string[] | null;
    tags?: string[] | null;
    work_type?: string | null;
    availability?: string | null;
    address?: string | null;
    website?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    freelancer_portfolio_items?: Array<Record<string, any>>;
    freelancer_services?: Array<Record<string, any>>;
}

const CompanyFreelancerMarketplace: React.FC = () => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showContactModal, setShowContactModal] = useState(false);
    const [contacting, setContacting] = useState(false);
    const [contactMessage, setContactMessage] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [requireContact, setRequireContact] = useState(true);
    const [contactTarget, setContactTarget] = useState<Freelancer | null>(null);
    const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileTarget, setProfileTarget] = useState<Freelancer | null>(null);
    const [profileDetails, setProfileDetails] = useState<FreelancerProfileDetails | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileReviews, setProfileReviews] = useState<any[]>([]);
    const [profileReviewsLoading, setProfileReviewsLoading] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [companyLocation, setCompanyLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Load freelancers from Supabase
    useEffect(() => {
        loadFreelancers();
    }, [companyLocation]);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const user = await getCurrentUser();
                if (!user?.id || !isMounted) return;
                const company = await getRecruiterCompany(user.id);
                if (!isMounted) return;
                if (company?.lat != null && company?.lng != null) {
                    setCompanyLocation({ lat: Number(company.lat), lng: Number(company.lng) });
                } else {
                    setCompanyLocation(null);
                }
            } catch {
                if (isMounted) setCompanyLocation(null);
            }
        })();
        return () => { isMounted = false; };
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

                if (user?.id && contactTarget?.id) {
                    const { data } = await supabase
                        .from('service_inquiries')
                        .select('id')
                        .eq('freelancer_id', contactTarget.id)
                        .eq('from_user_id', user.id)
                        .limit(1);
                    if (!isMounted) return;
                    if (data && data.length > 0) {
                        setRequireContact(false);
                    }
                } else if (contactTarget?.id) {
                    const cached = localStorage.getItem(`freelance_contact_${contactTarget.id}`);
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
    }, [showContactModal, contactTarget?.id]);

    const loadFreelancers = async () => {
        try {
            setLoading(true);
            let data: any[] | null = null;
            let error: any = null;

            if (companyLocation) {
                data = await searchFreelancers({
                    location: { ...companyLocation, radiusMeters: 50000 },
                    limit: 50,
                    offset: 0
                });
            } else {
                // Base query: freelancer_profiles only (public read via RLS)
                const resp = await supabase
                    .from('freelancer_profiles')
                    .select('id, headline, bio, hourly_rate, address, tags, contact_email, website')
                    .order('created_at', { ascending: false });
                data = resp.data;
                error = resp.error;
            }

            if (error) {
                console.error('Error loading freelancers:', error);
                setFreelancers([]);
                return;
            }

            const freelancerIds = (data || []).map((f: any) => f.id).filter(Boolean);

            let reviewStatsMap: Record<string, { avg_rating?: number; reviews_count?: number }> = {};
            if (freelancerIds.length > 0) {
                const stats = await getFreelancerReviewStats(freelancerIds);
                reviewStatsMap = (stats || []).reduce((acc: any, s: any) => {
                    acc[s.freelancer_id] = { avg_rating: s.avg_rating, reviews_count: s.reviews_count };
                    return acc;
                }, {});
            }

            // Try to enrich with profiles (optional; may be blocked by RLS)
            let profileMap: Record<string, { full_name?: string; avatar_url?: string; subscription_tier?: string }> = {};
            if (freelancerIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, subscription_tier')
                    .in('id', freelancerIds);

                if (!profilesError && profilesData) {
                    profileMap = profilesData.reduce((acc: any, p: any) => {
                        acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url, subscription_tier: p.subscription_tier };
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
                const stats = reviewStatsMap[freelancer.id] || {};
                const tier = (profile?.subscription_tier || '').toLowerCase();
                const isPremium = tier === 'premium' || tier === 'freelance_premium';
                return {
                    id: freelancer.id,
                    name: displayName,
                    title: freelancer.headline || displayName,
                    description: freelancer.bio || t('freelancer_marketplace.no_bio') || 'Kvalitní freelancer',
                    category: Array.isArray(freelancer.tags) && freelancer.tags.length > 0 ? freelancer.tags[0] : 'crafts',
                    location: freelancer.address,
                    rating: stats.avg_rating || 0,
                    reviews_count: stats.reviews_count || 0,
                    hourly_rate: freelancer.hourly_rate || 500, // Default rate
                    verified: false,
                    badge: undefined,
                    image: profile?.avatar_url || undefined,
                    isPremium
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
        { id: 'marketing', name: t('freelancer_marketplace.categories.marketing') || 'Marketing', icon: TrendingUp },
        { id: 'admin', name: t('freelancer_marketplace.categories.admin') || 'Administrativa', icon: Users },
        { id: 'real_estate', name: t('freelancer_marketplace.categories.real_estate') || 'Realitní služby', icon: Building2 },
        { id: 'finance', name: t('freelancer_marketplace.categories.finance') || 'Finanční služby', icon: Landmark },
        { id: 'security', name: t('freelancer_marketplace.categories.security') || 'Bezpečnost', icon: ShieldCheck },
        { id: 'legal', name: t('freelancer_marketplace.categories.legal') || 'Právo & legislativa', icon: Gavel }
    ];

    const filteredFreelancers = freelancers
        .filter(freelancer => {
            const matchesSearch = freelancer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                freelancer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                freelancer.description.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || freelancer.category === selectedCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            const aPremium = a.isPremium ? 1 : 0;
            const bPremium = b.isPremium ? 1 : 0;
            if (aPremium !== bPremium) return bPremium - aPremium;
            const ratingDiff = (b.rating || 0) - (a.rating || 0);
            if (ratingDiff !== 0) return ratingDiff;
            return (b.reviews_count || 0) - (a.reviews_count || 0);
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
                from_email: contactEmail || null,
                message: contactMessage || null,
                metadata: contactPhone ? { contact_phone: contactPhone } : null
            };
            await createServiceInquiry(payload);
            if (!user?.id && contactTarget?.id) {
                localStorage.setItem(`freelance_contact_${contactTarget.id}`, JSON.stringify({
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
    };

    const openProfile = async (freelancer: Freelancer) => {
        setProfileTarget(freelancer);
        setShowProfileModal(true);
        setProfileLoading(true);
        setProfileError(null);
        setProfileDetails(null);
        setProfileReviews([]);
        setProfileReviewsLoading(true);
        setReviewRating(0);
        setReviewComment('');
        try {
            const user = await getCurrentUser();
            setCurrentUserId(user?.id || null);
            const details = await getFreelancerProfile(freelancer.id);
            setProfileDetails(details as FreelancerProfileDetails | null);
            const reviews = await getFreelancerReviews(freelancer.id);
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
                freelancer_id: profileTarget.id,
                reviewer_id: currentUserId,
                rating: reviewRating,
                comment: reviewComment
            });
            const reviews = await getFreelancerReviews(profileTarget.id);
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
            if (profileTarget) {
                const reviews = await getFreelancerReviews(profileTarget.id);
                setProfileReviews(reviews || []);
            }
        } catch (err) {
            console.error('Freelancer review vote error:', err);
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
                                onClick={() => openProfile(freelancer)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openProfile(freelancer);
                                    }
                                }}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 group cursor-pointer"
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
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden text-slate-500 font-bold text-lg">
                                            {freelancer.image ? (
                                                <img src={freelancer.image} alt={freelancer.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{freelancer.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">{freelancer.name}</h3>
                                            <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">{freelancer.title}</p>
                                        </div>
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
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openProfile(freelancer);
                                            }}
                                            className="flex-1 py-2 mt-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            {t('freelancer_marketplace.profile_btn') || 'Zobrazit profil'}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setContactTarget(freelancer);
                                                setShowContactModal(true);
                                            }}
                                            className="flex-1 py-2 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors"
                                        >
                                            {t('freelancer_marketplace.contact_btn') || 'Kontaktovat'}
                                        </button>
                                    </div>
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

            {/* Profile Modal */}
            {showProfileModal && profileTarget && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowProfileModal(false)}></div>
                    <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 z-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                    {profileTarget.image ? (
                                        <img src={profileTarget.image} alt={profileTarget.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xl font-bold text-slate-500">{profileTarget.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{profileTarget.name}</h3>
                                    <p className="text-sm text-cyan-600 dark:text-cyan-400 font-semibold">{profileTarget.title}</p>
                                    {profileTarget.location && (
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                            <MapPin size={12} />
                                            {profileTarget.location}
                                        </div>
                                    )}
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
                                                {(profileDetails?.skills || []).map((skill) => (
                                                    <span key={`skill-${skill}`} className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                                        {skill}
                                                    </span>
                                                ))}
                                                {(profileDetails?.tags || []).map((tag) => (
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
                                                                        <LinkIcon size={12} />
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
                                            {profileDetails?.hourly_rate || profileTarget.hourly_rate
                                                ? `${profileDetails?.hourly_rate || profileTarget.hourly_rate} ${profileDetails?.currency || 'CZK'}`
                                                : (t('freelancer_marketplace.profile.rate_on_request') || 'Dohodou')}
                                            {(profileDetails?.hourly_rate || profileTarget.hourly_rate) && (
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
                            placeholder={t('freelancer_marketplace.contact_placeholder') || 'Napište zprávu freelancerovi...'}
                            className="w-full min-h-[120px] p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white mb-4"
                        />

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowContactModal(false)} className="px-4 py-2 rounded-lg border text-sm">{t('freelancer_marketplace.contact_cancel') || 'Zrušit'}</button>
                            <button
                                onClick={sendContact}
                                disabled={contacting || !contactMessage.trim() || (requireContact && !contactEmail.trim())}
                                className="px-4 py-2 rounded-lg bg-cyan-600 text-white disabled:opacity-50"
                            >
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
