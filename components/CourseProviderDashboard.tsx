import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen,
    Plus,
    Settings,
    LogOut,
    CheckCircle,
    Star,
    PenTool,
    Trash2,
    MapPin,
    Clock,
    CreditCard
} from 'lucide-react';
import { CompanyProfile, UserProfile } from '../types';
import {
    getMarketplacePartnerByOwner,
    updateMarketplacePartner,
    fetchLearningResourcesByPartner,
    createLearningResource,
    updateLearningResource,
    deleteLearningResource,
    getCourseReviewsForCourses,
    getCourseReviewStats
} from '../services/supabaseService';

interface CourseProviderDashboardProps {
    userProfile: UserProfile;
    companyProfile: CompanyProfile | null;
    onLogout: () => void;
}

export default function CourseProviderDashboard({ userProfile, companyProfile, onLogout }: CourseProviderDashboardProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'courses' | 'reviews' | 'settings'>('courses');
    const [partnerProfile, setPartnerProfile] = useState<any | null>(null);
    const [loadingPartner, setLoadingPartner] = useState(true);
    const [courses, setCourses] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewStats, setReviewStats] = useState<Record<string, { avg_rating?: number; reviews_count?: number }>>({});
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState<string | null>(null);

    const [courseForm, setCourseForm] = useState({
        title: '',
        description: '',
        durationHours: '',
        price: '',
        currency: 'CZK',
        difficulty: 'Beginner',
        location: '',
        tagsInput: '',
        isGovernmentFunded: false,
        fundingAmount: ''
    });

    const [profileForm, setProfileForm] = useState({
        name: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        website: '',
        address: '',
        description: ''
    });

    useEffect(() => {
        let isMounted = true;
        (async () => {
            if (!userProfile?.id) return;
            setLoadingPartner(true);
            const partner = await getMarketplacePartnerByOwner(userProfile.id);
            if (!isMounted) return;
            setPartnerProfile(partner);
            setLoadingPartner(false);

            if (partner) {
                setProfileForm({
                    name: partner.name || '',
                    contactName: partner.contact_name || '',
                    contactEmail: partner.contact_email || userProfile.email || '',
                    contactPhone: partner.contact_phone || '',
                    website: partner.website || '',
                    address: partner.address || '',
                    description: partner.description || ''
                });
            } else {
                setProfileForm({
                    name: companyProfile?.name || '',
                    contactName: '',
                    contactEmail: userProfile.email || '',
                    contactPhone: '',
                    website: companyProfile?.website || '',
                    address: companyProfile?.address || '',
                    description: companyProfile?.description || ''
                });
            }
        })();
        return () => { isMounted = false; };
    }, [userProfile?.id, userProfile?.email, companyProfile?.name, companyProfile?.website, companyProfile?.address, companyProfile?.description]);

    useEffect(() => {
        if (!partnerProfile?.id) return;
        loadCourses();
    }, [partnerProfile?.id]);

    const loadCourses = async () => {
        if (!partnerProfile?.id) return;
        const data = await fetchLearningResourcesByPartner(partnerProfile.id);
        setCourses(data);
    };

    const courseIds = useMemo(() => courses.map(c => c.id), [courses]);
    const courseIdKey = useMemo(() => courseIds.join('|'), [courseIds]);

    useEffect(() => {
        if (courseIds.length === 0) return;
        let isMounted = true;
        (async () => {
            const stats = await getCourseReviewStats(courseIds);
            if (!isMounted) return;
            const statsMap = (stats || []).reduce((acc: any, s: any) => {
                acc[s.course_id] = { avg_rating: s.avg_rating, reviews_count: s.reviews_count };
                return acc;
            }, {});
            setReviewStats(statsMap);
        })();
        return () => { isMounted = false; };
    }, [courseIdKey]);

    useEffect(() => {
        if (activeTab !== 'reviews' || courseIds.length === 0) return;
        let isMounted = true;
        (async () => {
            setLoadingReviews(true);
            const [stats, reviewsData] = await Promise.all([
                getCourseReviewStats(courseIds),
                getCourseReviewsForCourses(courseIds)
            ]);
            if (!isMounted) return;
            const statsMap = (stats || []).reduce((acc: any, s: any) => {
                acc[s.course_id] = { avg_rating: s.avg_rating, reviews_count: s.reviews_count };
                return acc;
            }, {});
            setReviewStats(statsMap);
            setReviews(reviewsData || []);
            setLoadingReviews(false);
        })();
        return () => { isMounted = false; };
    }, [activeTab, courseIdKey]);

    const resetCourseForm = () => {
        setCourseForm({
            title: '',
            description: '',
            durationHours: '',
            price: '',
            currency: 'CZK',
            difficulty: 'Beginner',
            location: '',
            tagsInput: '',
            isGovernmentFunded: false,
            fundingAmount: ''
        });
        setEditingCourseId(null);
        setIsCreating(false);
    };

    const parseTags = (value: string) =>
        value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

    const handleSaveCourse = async () => {
        if (!partnerProfile?.id) return;
        const payload = {
            title: courseForm.title.trim(),
            description: courseForm.description.trim(),
            skill_tags: parseTags(courseForm.tagsInput),
            duration_hours: courseForm.durationHours ? Number(courseForm.durationHours) : 0,
            difficulty: courseForm.difficulty,
            price: courseForm.price ? Number(courseForm.price) : 0,
            currency: courseForm.currency || 'CZK',
            location: courseForm.location.trim() || null,
            is_government_funded: courseForm.isGovernmentFunded,
            funding_amount_czk: courseForm.isGovernmentFunded && courseForm.fundingAmount ? Number(courseForm.fundingAmount) : null,
            provider: partnerProfile.name || companyProfile?.name || '',
            partner_id: partnerProfile.id,
            status: 'active'
        };

        try {
            if (editingCourseId) {
                await updateLearningResource(editingCourseId, payload);
            } else {
                await createLearningResource(payload);
            }
            await loadCourses();
            resetCourseForm();
        } catch (err) {
            console.error('Failed to save course', err);
            alert(t('course_provider.dashboard.course_save_error', { defaultValue: 'Nepodařilo se uložit kurz.' }));
        }
    };

    const handleEditCourse = (course: any) => {
        setIsCreating(true);
        setEditingCourseId(course.id);
        setCourseForm({
            title: course.title || '',
            description: course.description || '',
            durationHours: course.duration_hours ? String(course.duration_hours) : '',
            price: course.price ? String(course.price) : '',
            currency: course.currency || 'CZK',
            difficulty: course.difficulty || 'Beginner',
            location: course.location || '',
            tagsInput: Array.isArray(course.skill_tags) ? course.skill_tags.join(', ') : '',
            isGovernmentFunded: !!course.is_government_funded,
            fundingAmount: course.funding_amount_czk ? String(course.funding_amount_czk) : ''
        });
    };

    const handleDeleteCourse = async (courseId: string) => {
        if (!confirm(t('course_provider.dashboard.course_delete_confirm', { defaultValue: 'Opravdu chcete kurz smazat?' }))) return;
        try {
            await deleteLearningResource(courseId);
            await loadCourses();
        } catch (err) {
            console.error('Failed to delete course', err);
            alert(t('course_provider.dashboard.course_delete_error', { defaultValue: 'Smazání kurzu se nezdařilo.' }));
        }
    };

    const handleSaveProfile = async () => {
        if (!partnerProfile?.id) return;
        setProfileSaving(true);
        setProfileMessage(null);
        try {
            const updated = await updateMarketplacePartner(partnerProfile.id, {
                name: profileForm.name?.trim() || null,
                contact_name: profileForm.contactName?.trim() || null,
                contact_email: profileForm.contactEmail?.trim() || null,
                contact_phone: profileForm.contactPhone?.trim() || null,
                website: profileForm.website?.trim() || null,
                address: profileForm.address?.trim() || null,
                description: profileForm.description?.trim() || null
            });
            setPartnerProfile(updated);
            setProfileMessage(t('course_provider.dashboard.profile_saved', { defaultValue: 'Profil byl uložen.' }));
        } catch (err) {
            console.error('Failed to save partner profile', err);
            setProfileMessage(t('course_provider.dashboard.profile_save_error', { defaultValue: 'Nepodařilo se uložit profil.' }));
        } finally {
            setProfileSaving(false);
        }
    };

    if (loadingPartner) {
        return <div className="p-8 text-center text-slate-500">{t('course_provider.dashboard.loading', { defaultValue: 'Načítání...' })}</div>;
    }

    if (!partnerProfile) {
        return (
            <div className="p-8 text-center text-slate-500">
                {t('course_provider.dashboard.no_partner', { defaultValue: 'Profil poskytovatele kurzů nebyl nalezen. Kontaktujte podporu.' })}
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                        {t('course_provider.dashboard.title', { defaultValue: 'Dashboard poskytovatele kurzů' })}
                    </p>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{partnerProfile.name}</h1>
                </div>
                <button onClick={onLogout} className="px-4 py-2 text-slate-500 hover:text-rose-500 transition-colors flex items-center gap-2">
                    <LogOut size={16} />
                    {t('course_provider.dashboard.logout', { defaultValue: 'Odhlásit' })}
                </button>
            </div>

            <div className="flex flex-wrap bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('courses')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'courses' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <BookOpen size={16} />
                    {t('course_provider.dashboard.tabs.courses', { defaultValue: 'Kurzy' })}
                </button>
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'reviews' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Star size={16} />
                    {t('course_provider.dashboard.tabs.reviews', { defaultValue: 'Recenze' })}
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Settings size={16} />
                    {t('course_provider.dashboard.tabs.settings', { defaultValue: 'Nastavení' })}
                </button>
            </div>

            {activeTab === 'courses' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {t('course_provider.dashboard.courses.title', { defaultValue: 'Vaše kurzy' })}
                        </h2>
                        <button
                            onClick={() => setIsCreating((prev) => !prev)}
                            className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-cyan-500 transition-colors"
                        >
                            <Plus size={16} />
                            {t('course_provider.dashboard.courses.add', { defaultValue: 'Přidat kurz' })}
                        </button>
                    </div>

                    {isCreating && (
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        {t('course_provider.dashboard.courses.form.title', { defaultValue: 'Název kurzu' })}
                                    </label>
                                    <input
                                        value={courseForm.title}
                                        onChange={(e) => setCourseForm(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        {t('course_provider.dashboard.courses.form.location', { defaultValue: 'Lokalita' })}
                                    </label>
                                    <div className="relative">
                                        <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                        <input
                                            value={courseForm.location}
                                            onChange={(e) => setCourseForm(prev => ({ ...prev, location: e.target.value }))}
                                            className="w-full pl-8 p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                            placeholder="Praha, Brno, online..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                    {t('course_provider.dashboard.courses.form.description', { defaultValue: 'Popis' })}
                                </label>
                                <textarea
                                    value={courseForm.description}
                                    onChange={(e) => setCourseForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 min-h-[120px]"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        {t('course_provider.dashboard.courses.form.duration', { defaultValue: 'Délka (hod)' })}
                                    </label>
                                    <div className="relative">
                                        <Clock size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                        <input
                                            value={courseForm.durationHours}
                                            onChange={(e) => setCourseForm(prev => ({ ...prev, durationHours: e.target.value }))}
                                            className="w-full pl-8 p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        {t('course_provider.dashboard.courses.form.price', { defaultValue: 'Cena' })}
                                    </label>
                                    <div className="relative">
                                        <CreditCard size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                        <input
                                            value={courseForm.price}
                                            onChange={(e) => setCourseForm(prev => ({ ...prev, price: e.target.value }))}
                                            className="w-full pl-8 p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        {t('course_provider.dashboard.courses.form.difficulty', { defaultValue: 'Obtížnost' })}
                                    </label>
                                    <select
                                        value={courseForm.difficulty}
                                        onChange={(e) => setCourseForm(prev => ({ ...prev, difficulty: e.target.value }))}
                                        className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                    >
                                        <option value="Beginner">Beginner</option>
                                        <option value="Intermediate">Intermediate</option>
                                        <option value="Advanced">Advanced</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                    {t('course_provider.dashboard.courses.form.tags', { defaultValue: 'Tagy / dovednosti (oddělené čárkou)' })}
                                </label>
                                <input
                                    value={courseForm.tagsInput}
                                    onChange={(e) => setCourseForm(prev => ({ ...prev, tagsInput: e.target.value }))}
                                    className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                    placeholder="např. elektro, revize, bezpečnost"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={courseForm.isGovernmentFunded}
                                        onChange={(e) => setCourseForm(prev => ({ ...prev, isGovernmentFunded: e.target.checked }))}
                                    />
                                    {t('course_provider.dashboard.courses.form.gov_funded', { defaultValue: 'Rekvalifikace / dotace' })}
                                </label>
                                {courseForm.isGovernmentFunded && (
                                    <input
                                        value={courseForm.fundingAmount}
                                        onChange={(e) => setCourseForm(prev => ({ ...prev, fundingAmount: e.target.value }))}
                                        className="p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                        placeholder="Výše příspěvku (Kč)"
                                    />
                                )}
                            </div>

                            <div className="flex justify-end gap-3">
                                <button onClick={resetCourseForm} className="px-4 py-2 text-sm border rounded-lg">
                                    {t('course_provider.dashboard.courses.form.cancel', { defaultValue: 'Zrušit' })}
                                </button>
                                <button onClick={handleSaveCourse} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg font-semibold">
                                    {editingCourseId ? t('course_provider.dashboard.courses.form.update', { defaultValue: 'Uložit změny' }) : t('course_provider.dashboard.courses.form.create', { defaultValue: 'Vytvořit kurz' })}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {courses.length === 0 && (
                            <div className="col-span-full text-center text-slate-500 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                {t('course_provider.dashboard.courses.empty', { defaultValue: 'Zatím nemáte žádné kurzy.' })}
                            </div>
                        )}
                        {courses.map((course) => (
                            <div key={course.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{course.title}</h3>
                                        <p className="text-sm text-slate-500">{course.location || '—'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleEditCourse(course)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <PenTool size={14} />
                                        </button>
                                        <button onClick={() => handleDeleteCourse(course.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-500">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{course.description}</p>
                                <div className="text-xs text-slate-500 flex items-center gap-3">
                                    <span>{course.duration_hours} h</span>
                                    <span>{course.price} {course.currency}</span>
                                    <span>{course.difficulty}</span>
                                </div>
                                {reviewStats[course.id] && (
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Star size={12} className="text-amber-500" />
                                        {reviewStats[course.id].avg_rating?.toFixed(1) || '0.0'} ({reviewStats[course.id].reviews_count || 0})
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'reviews' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                        {t('course_provider.dashboard.reviews.title', { defaultValue: 'Recenze kurzů' })}
                    </h2>
                    {loadingReviews ? (
                        <div className="text-slate-500">{t('app.loading', { defaultValue: 'Načítání...' })}</div>
                    ) : reviews.length === 0 ? (
                        <div className="text-slate-500">{t('course_provider.dashboard.reviews.empty', { defaultValue: 'Zatím žádné recenze.' })}</div>
                    ) : (
                        <div className="space-y-4">
                            {reviews.map((review) => (
                                <div key={review.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <Star size={14} className="text-amber-500" />
                                        {review.rating}/5
                                        {review.is_verified_graduate && (
                                            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                                                {t('course_provider.dashboard.reviews.verified', { defaultValue: 'Ověřený absolvent' })}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{review.comment}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {t('course_provider.dashboard.settings.title', { defaultValue: 'Profil poskytovatele' })}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {t('course_provider.dashboard.settings.name', { defaultValue: 'Název' })}
                            </label>
                            <input
                                value={profileForm.name}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {t('course_provider.dashboard.settings.contact_name', { defaultValue: 'Kontaktní osoba' })}
                            </label>
                            <input
                                value={profileForm.contactName}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, contactName: e.target.value }))}
                                className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {t('course_provider.dashboard.settings.email', { defaultValue: 'E‑mail' })}
                            </label>
                            <input
                                value={profileForm.contactEmail}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                                className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {t('course_provider.dashboard.settings.phone', { defaultValue: 'Telefon' })}
                            </label>
                            <input
                                value={profileForm.contactPhone}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                                className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {t('course_provider.dashboard.settings.website', { defaultValue: 'Web' })}
                            </label>
                            <input
                                value={profileForm.website}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, website: e.target.value }))}
                                className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {t('course_provider.dashboard.settings.address', { defaultValue: 'Adresa' })}
                            </label>
                            <input
                                value={profileForm.address}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
                                className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                            {t('course_provider.dashboard.settings.description', { defaultValue: 'Popis' })}
                        </label>
                        <textarea
                            value={profileForm.description}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 min-h-[120px]"
                        />
                    </div>

                    {profileMessage && (
                        <div className="text-sm text-emerald-600 flex items-center gap-2">
                            <CheckCircle size={16} />
                            {profileMessage}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveProfile}
                            className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-500 transition-colors disabled:opacity-50"
                            disabled={profileSaving}
                        >
                            {profileSaving ? t('course_provider.dashboard.settings.saving', { defaultValue: 'Ukládám...' }) : t('course_provider.dashboard.settings.save', { defaultValue: 'Uložit profil' })}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
