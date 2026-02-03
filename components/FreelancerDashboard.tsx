
import React, { useState, useEffect } from 'react';
import { supabase, incrementJobPosting, uploadPortfolioImage, getPortfolioItems, deletePortfolioItem } from '../services/supabaseService';
import { publishJob } from '../services/jobPublishService';
import { CompanyProfile, Job, UserProfile, PortfolioItem } from '../types';
import { useTranslation } from 'react-i18next';
import {
    Briefcase,
    Plus,
    Settings,
    LogOut,
    CheckCircle,
    Star,
    PenTool,
    Trash2,
    Zap,
    Crown,
    CreditCard,
    Image,
    Link as LinkIcon
} from 'lucide-react';
import { redirectToCheckout } from '../services/stripeService';

interface FreelancerDashboardProps {
    userProfile: UserProfile;
    companyProfile: CompanyProfile | null; // Acts as Freelancer Profile
    onLogout: () => void;
}

export default function FreelancerDashboard({ userProfile, companyProfile, onLogout }: FreelancerDashboardProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'services' | 'portfolio' | 'settings'>('services');
    const [services, setServices] = useState<Job[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(false);

    // Service Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: '',
        location: activeTab === 'services' ? (companyProfile?.address || '') : '',
        category: 'crafts'
    });

    // Portfolio Form State
    const [portfolioFormData, setPortfolioFormData] = useState({
        title: '',
        description: '',
        url: '',
        file: null as File | null
    });

    useEffect(() => {
        if (companyProfile?.id) {
            loadServices();
            loadPortfolio();
        }
    }, [companyProfile?.id]);

    const loadServices = async () => {
        if (!companyProfile?.id) return;
        const { data } = await supabase
            .from('jobs')
            .select('*')
            .eq('company_id', companyProfile.id)
            .order('created_at', { ascending: false });

        if (data) setServices(data as Job[]);
    };

    const handlePublishService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyProfile?.id) return;

        // Check plan limits
        const isPremium = companyProfile.subscription?.tier !== 'free' && companyProfile.subscription?.tier !== 'trial';
        if (services.length >= 3 && !isPremium) {
            alert(t('freelancer.dashboard.services.limit_alert'));
            return;
        }

        try {
            await publishJob({
                title: formData.title,
                company: companyProfile.name,
                description: formData.description,
                location: formData.location || 'Remote',
                salary_from: Number(formData.price), // Mapping Price to Salary From
                salary_to: Number(formData.price),
                benefits: [],
                contact_email: userProfile.email || '',
                workplace_address: formData.location,
                company_id: companyProfile.id,
                contract_type: 'freelance_service', // DISTINGUISHER
                work_type: 'Remote' // Default or Form Field
            });

            await incrementJobPosting(companyProfile.id);
            alert(t('freelancer.dashboard.services.success_alert'));
            setIsCreating(false);
            setFormData({ title: '', description: '', price: '', location: '', category: 'crafts' });
            loadServices();
        } catch (err) {
            console.error(err);
            alert(t('freelancer.dashboard.services.error_alert'));
        }
    };

    const handleDeleteService = async (id: string) => {
        if (confirm(t('freelancer.dashboard.services.delete_confirm'))) {
            await supabase.from('jobs').delete().eq('id', id);
            loadServices();
        }
    };

    const loadPortfolio = async () => {
        if (!companyProfile?.id) return;
        const items = await getPortfolioItems(companyProfile.id);
        setPortfolio(items as PortfolioItem[]);
    };

    const handleAddPortfolioItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyProfile?.id || !portfolioFormData.file) return;

        setUploadProgress(true);
        try {
            await uploadPortfolioImage(
                companyProfile.id,
                portfolioFormData.file,
                portfolioFormData.title,
                portfolioFormData.description,
                portfolioFormData.url || undefined
            );
            
            setPortfolioFormData({ title: '', description: '', url: '', file: null });
            setIsCreatingPortfolio(false);
            loadPortfolio();
            alert(t('freelancer.dashboard.portfolio.success'));
        } catch (err) {
            console.error(err);
            alert(t('freelancer.dashboard.portfolio.error'));
        } finally {
            setUploadProgress(false);
        }
    };

    const handleDeletePortfolioItem = async (itemId: string, fileName: string) => {
        if (confirm(t('freelancer.dashboard.portfolio.delete_confirm'))) {
            try {
                await deletePortfolioItem(itemId, fileName);
                loadPortfolio();
            } catch (err) {
                console.error(err);
                alert(t('freelancer.dashboard.portfolio.delete_error'));
            }
        }
    };

    if (!companyProfile) return <div className="p-8 text-center text-slate-500">{t('freelancer.dashboard.loading')}</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
            {/* Top Bar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-sky-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {companyProfile.name.charAt(0)}
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-900 dark:text-white leading-tight">{companyProfile.name}</h1>
                        <p className="text-xs text-slate-500 font-medium">{t('freelancer.dashboard.title')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors" title={t('freelancer.dashboard.logout')}>
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">{t('freelancer.dashboard.stats.services')}</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{services.length} / 3</h3>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 px-3 py-1.5 rounded-lg w-fit">
                            <CheckCircle size={14} />
                            {t('freelancer.dashboard.stats.free_this_month')}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">{t('freelancer.dashboard.stats.profile_views')}</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">0</h3>
                        <p className="text-xs text-slate-400 mt-2">{t('freelancer.dashboard.stats.last_30_days')}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">{t('freelancer.dashboard.stats.rating')}</p>
                        <h3 className="text-3xl font-black text-amber-500 flex items-center gap-2">
                            5.0 <Star fill="currentColor" size={24} />
                        </h3>
                        <p className="text-xs text-slate-400 mt-2">{t('freelancer.dashboard.services.no_reviews')}</p>
                    </div>
                </div>

                {/* Main Content Tabs */}
                <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6">
                    <button
                        onClick={() => setActiveTab('services')}
                        className={`pb-4 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'services' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                    >
                        {t('freelancer.dashboard.tabs.services')}
                    </button>
                    <button
                        onClick={() => setActiveTab('portfolio')}
                        className={`pb-4 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'portfolio' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                    >
                        {t('freelancer.dashboard.tabs.portfolio')}
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-4 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'settings' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                    >
                        {t('freelancer.dashboard.tabs.settings')}
                    </button>
                </div>

                {/* Tab: Services */}
                {activeTab === 'services' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('freelancer.dashboard.services.list_title')}</h2>
                            {!isCreating && (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    {t('freelancer.dashboard.services.add_btn')}
                                </button>
                            )}
                        </div>

                        {isCreating ? (
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg mb-8">
                                <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('freelancer.dashboard.services.create_title')}</h3>
                                <form onSubmit={handlePublishService} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('freelancer.dashboard.services.title_label')}</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500"
                                            placeholder={t('freelancer.dashboard.services.title_placeholder')}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('freelancer.dashboard.services.price_label')}</label>
                                            <input
                                                type="number"
                                                required
                                                value={formData.price}
                                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500"
                                                placeholder={t('freelancer.dashboard.services.price_placeholder')}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('freelancer.dashboard.services.location_label')}</label>
                                            <input
                                                type="text"
                                                value={formData.location}
                                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500"
                                                placeholder={t('freelancer.dashboard.services.location_placeholder')}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('freelancer.dashboard.services.desc_label')}</label>
                                        <textarea
                                            required
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500 h-32"
                                            placeholder={t('freelancer.dashboard.services.desc_placeholder')}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreating(false)}
                                            className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            {t('app.cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors shadow-lg"
                                        >
                                            {t('freelancer.dashboard.services.publish_btn')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {services.length === 0 ? (
                                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                        <Briefcase className="mx-auto text-slate-300 mb-4" size={40} />
                                        <p className="text-slate-500">{t('freelancer.dashboard.services.empty_desc')}</p>
                                    </div>
                                ) : (
                                    services.map(service => (
                                        <div key={service.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{service.title}</h3>
                                                <p className="text-slate-500 text-sm line-clamp-1">{service.description}</p>
                                                <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-400">
                                                    <span>{service.location}</span>
                                                    <span>•</span>
                                                    <span>{service.salary_from?.toLocaleString()} Kč</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors" title={t('freelancer.dashboard.services.edit')}>
                                                    <PenTool size={18} />
                                                </button>
                                                <button onClick={() => handleDeleteService(service.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title={t('freelancer.dashboard.services.delete')}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Portfolio */}
                {activeTab === 'portfolio' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('freelancer.dashboard.portfolio.title')}</h2>
                            {!isCreatingPortfolio && (
                                <button
                                    onClick={() => setIsCreatingPortfolio(true)}
                                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    {t('freelancer.dashboard.portfolio.add_btn')}
                                </button>
                            )}
                        </div>

                        {isCreatingPortfolio ? (
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg mb-8">
                                <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('freelancer.dashboard.portfolio.add_item_title')}</h3>
                                <form onSubmit={handleAddPortfolioItem} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('freelancer.dashboard.portfolio.title_label')}</label>
                                        <input
                                            type="text"
                                            required
                                            value={portfolioFormData.title}
                                            onChange={e => setPortfolioFormData({ ...portfolioFormData, title: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500"
                                            placeholder={t('freelancer.dashboard.portfolio.title_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('freelancer.dashboard.portfolio.desc_label')}</label>
                                        <textarea
                                            required
                                            value={portfolioFormData.description}
                                            onChange={e => setPortfolioFormData({ ...portfolioFormData, description: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500 h-24"
                                            placeholder={t('freelancer.dashboard.portfolio.desc_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('freelancer.dashboard.portfolio.url_label')}</label>
                                        <input
                                            type="url"
                                            value={portfolioFormData.url}
                                            onChange={e => setPortfolioFormData({ ...portfolioFormData, url: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500"
                                            placeholder={t('freelancer.dashboard.portfolio.url_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('freelancer.dashboard.portfolio.image_label')}</label>
                                        <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-cyan-400 transition-colors cursor-pointer bg-slate-50 dark:bg-slate-900">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                required
                                                onChange={e => {
                                                    if (e.target.files?.[0]) {
                                                        setPortfolioFormData({ ...portfolioFormData, file: e.target.files[0] });
                                                    }
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <Image className="mx-auto text-slate-400 mb-2" size={32} />
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                {portfolioFormData.file ? portfolioFormData.file.name : t('freelancer.dashboard.portfolio.image_placeholder')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCreatingPortfolio(false);
                                                setPortfolioFormData({ title: '', description: '', url: '', file: null });
                                            }}
                                            className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            {t('app.cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={uploadProgress}
                                            className="px-6 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors shadow-lg disabled:opacity-50"
                                        >
                                            {uploadProgress ? t('freelancer.dashboard.portfolio.uploading') : t('freelancer.dashboard.portfolio.add_btn')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {portfolio.length === 0 ? (
                                    <div className="col-span-full text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                        <Image className="mx-auto text-slate-300 mb-4" size={40} />
                                        <p className="text-slate-500">{t('freelancer.dashboard.portfolio.empty_desc')}</p>
                                    </div>
                                ) : (
                                    portfolio.map(item => (
                                        <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                                            {item.imageUrl && (
                                                <div className="aspect-square overflow-hidden bg-slate-100 dark:bg-slate-900">
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <h3 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{item.title}</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{item.description}</p>
                                                <div className="flex items-center gap-2">
                                                    {item.url && (
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                                                        >
                                                            <LinkIcon size={12} />
                                                            {t('freelancer.dashboard.portfolio.view_link')}
                                                        </a>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleDeletePortfolioItem(item.id, item.fileName || '')}
                                                    className="mt-3 w-full p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 size={16} />
                                                    {t('freelancer.dashboard.portfolio.delete_btn')}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Settings */}
                {activeTab === 'settings' && (
                    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="text-center mb-8">
                            <Settings className="mx-auto text-slate-300 mb-4" size={48} />
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('freelancer.dashboard.tabs.settings')}</h2>
                        </div>

                        {/* Subscription Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Crown className="text-amber-500" size={20} />
                                    {t('freelancer.dashboard.subscription.title')}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${companyProfile?.subscription?.tier === 'freelance_premium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {companyProfile?.subscription?.tier === 'freelance_premium' ? t('freelancer.dashboard.subscription.status_premium') : t('freelancer.dashboard.subscription.status_free')}
                                </span>
                            </div>

                            <div className="p-6">
                                {companyProfile?.subscription?.tier === 'freelance_premium' ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-xl">
                                                <Zap className="text-amber-500" size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-lg">{t('freelancer.dashboard.subscription.premium_active_title')}</h4>
                                                <p className="text-slate-500 dark:text-slate-400">{t('freelancer.dashboard.subscription.premium_active_desc')}</p>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                            <button
                                                onClick={() => alert(t('freelancer.dashboard.subscription.manage_alert'))}
                                                className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 underline"
                                            >
                                                {t('freelancer.dashboard.subscription.manage')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="flex flex-col md:flex-row gap-6 items-center">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-xl text-slate-900 dark:text-white mb-2">{t('freelancer.dashboard.subscription.upgrade_title')}</h4>
                                                <ul className="space-y-2 mb-4">
                                                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                        <CheckCircle size={16} className="text-cyan-500" />
                                                        <span>{t('freelancer.dashboard.subscription.benefit_1')}</span>
                                                    </li>
                                                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                        <CheckCircle size={16} className="text-cyan-500" />
                                                        <span>{t('freelancer.dashboard.subscription.benefit_2')}</span>
                                                    </li>
                                                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                        <CheckCircle size={16} className="text-cyan-500" />
                                                        <span>{t('freelancer.dashboard.subscription.benefit_3')}</span>
                                                    </li>
                                                </ul>
                                            </div>
                                            <div className="text-center md:text-right">
                                                <div className="text-3xl font-black text-slate-900 dark:text-white">{t('freelancer.dashboard.subscription.price')}</div>
                                                <div className="text-sm text-slate-500">{t('freelancer.dashboard.subscription.per_month')}</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => companyProfile?.id && redirectToCheckout('freelance_premium', companyProfile.id)}
                                            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                                        >
                                            <CreditCard size={20} />
                                            {t('freelancer.dashboard.subscription.upgrade_cta')}
                                        </button>
                                        <p className="text-xs text-center text-slate-400">{t('freelancer.dashboard.subscription.payment_note')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Other Settings (Simplified) */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 opacity-60 pointer-events-none grayscale">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t('freelancer.dashboard.settings.wip_title')}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input disabled value={companyProfile?.name} className="p-3 rounded-lg bg-slate-100 border-none" />
                                <input disabled value={userProfile.email} className="p-3 rounded-lg bg-slate-100 border-none" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
