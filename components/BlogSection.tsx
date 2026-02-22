import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Shield, BarChart3, Search, Plus, Edit2, X, Check, Calendar, Clock, ArrowRight, Copy, Save, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabaseService';
import { fetchJobsWithFilters } from '../services/jobService';
import { initialBlogPosts as blogPosts, BlogPost } from '../src/data/blogPosts';
import Markdown from 'markdown-to-jsx';
import { formatJobDescription } from '../utils/formatters';

interface BlogSectionProps {
    selectedBlogPostSlug?: string | null;
    setSelectedBlogPostSlug?: (slug: string | null) => void;
    showOverview?: boolean;
}

const BLOG_MONTHS: Record<string, number> = {
    ledna: 0,
    unora: 1,
    února: 1,
    brezna: 2,
    března: 2,
    dubna: 3,
    kvetna: 4,
    května: 4,
    cervna: 5,
    června: 5,
    cervence: 6,
    července: 6,
    srpna: 7,
    zari: 8,
    září: 8,
    rijna: 9,
    října: 9,
    listopadu: 10,
    prosince: 11
};

const normalizeDateToken = (value: string): string =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const parseBlogDateToTimestamp = (dateValue?: string): number => {
    if (!dateValue) return 0;
    const trimmed = dateValue.trim();
    if (!trimmed) return 0;

    const direct = Date.parse(trimmed);
    if (!Number.isNaN(direct)) return direct;

    const normalized = trimmed.replace(/,/g, '').replace(/\s+/g, ' ');
    const czMatch = normalized.match(/^(\d{1,2})\.\s*([^\s]+)\s*(\d{4})$/i);
    if (czMatch) {
        const day = Number(czMatch[1]);
        const monthToken = normalizeDateToken(czMatch[2]);
        const year = Number(czMatch[3]);
        const monthIndex = BLOG_MONTHS[monthToken];
        if (!Number.isNaN(day) && !Number.isNaN(year) && monthIndex !== undefined) {
            return new Date(year, monthIndex, day).getTime();
        }
    }

    const dmyMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dmyMatch) {
        const day = Number(dmyMatch[1]);
        const month = Number(dmyMatch[2]) - 1;
        const year = Number(dmyMatch[3]);
        if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
            return new Date(year, month, day).getTime();
        }
    }

    return 0;
};

const BlogSection: React.FC<BlogSectionProps> = ({
    selectedBlogPostSlug,
    setSelectedBlogPostSlug,
    showOverview = true
}) => {
    const { t, i18n } = useTranslation();
    const [posts, setPosts] = useState<BlogPost[]>(blogPosts);
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const sortedPosts = useMemo(
        () => [...posts].sort((a, b) => {
            const dateDiff = parseBlogDateToTimestamp(b.date) - parseBlogDateToTimestamp(a.date);
            if (dateDiff !== 0) return dateDiff;
            return b.id - a.id;
        }),
        [posts]
    );

    // Sync selectedPost with prop
    useEffect(() => {
        if (selectedBlogPostSlug) {
            const post = posts.find(p => p.slug === selectedBlogPostSlug);
            if (post) {
                setSelectedPost(post);
            }
        } else {
            setSelectedPost(null);
        }
    }, [selectedBlogPostSlug, posts]);

    const handleSelectPost = (post: BlogPost | null) => {
        if (setSelectedBlogPostSlug) {
            setSelectedBlogPostSlug(post ? post.slug : null);
        } else {
            setSelectedPost(post);
        }
    };
    const [isAdmin, setIsAdmin] = useState(() => {
        // Only allow admin mode in development
        if (import.meta.env.PROD) return false;

        // Check for URL parameter in development
        const params = new URLSearchParams(window.location.search);
        return params.get('admin') === 'true';
    });
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [globalStats, setGlobalStats] = useState({
        active_jobs: 0,
        transparency_rate: 0,
        avg_jhi: 78
    });
    const isLikelyNetworkError = (error: unknown): boolean => {
        const msg = String((error as any)?.message || error || '').toLowerCase();
        return msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('fetch resource');
    };

    useEffect(() => {
        let isMounted = true;
        const fetchStats = async () => {
            try {
                const { data, error } = await supabase.rpc('get_global_stats');
                if (error) throw error;
                if (data && isMounted) {
                    setGlobalStats(data);
                }
            } catch (err) {
                if (!isLikelyNetworkError(err)) {
                    console.error('Error fetching global stats:', err);
                }
                // Fallback to placeholders if RPC is not yet available in DB
                if (isMounted) {
                    setGlobalStats({
                        active_jobs: 4200,
                        transparency_rate: 94,
                        avg_jhi: 78
                    });
                }
            }
        };

        const fetchAvgJhiFromJobs = async () => {
            try {
                const lang = (i18n.language || 'cs').split('-')[0].toLowerCase();
                const countryMap: Record<string, string[] | undefined> = {
                    cs: ['cs'],
                    sk: ['sk'],
                    de: ['de'],
                    at: ['at'],
                    pl: ['pl'],
                    en: undefined
                };
                const countryCodes = countryMap[lang];
                const result = await fetchJobsWithFilters({
                    page: 0,
                    pageSize: 120,
                    countryCodes
                });
                const scores = result.jobs
                    .map(job => job.jhi?.score)
                    .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score));
                if (scores.length > 0 && isMounted) {
                    const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
                    setGlobalStats(prev => ({ ...prev, avg_jhi: avg }));
                }
            } catch (err) {
                if (!isLikelyNetworkError(err)) {
                    console.error('Error computing average JHI from jobs:', err);
                }
            }
        };

        fetchStats();
        fetchAvgJhiFromJobs();
        return () => { isMounted = false; };
    }, [i18n.language]);
    const [copied, setCopied] = useState(false);

    // Stats (can be derived or kept separate)
    const stats = [
        {
            label: t('blog.stats.active_jobs'),
            value: globalStats.active_jobs > 0 ? `${globalStats.active_jobs.toLocaleString()}+` : '4,200+',
            icon: Search,
            color: 'text-cyan-400'
        },
        {
            label: t('blog.stats.transparency_rate'),
            value: `${globalStats.transparency_rate}%`,
            icon: Shield,
            color: 'text-emerald-400'
        },
        {
            label: t('blog.stats.avg_jhi'),
            value: `${globalStats.avg_jhi}/100`,
            icon: BarChart3,
            color: 'text-purple-400'
        }
    ];

    const handleSavePost = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPost) return;

        const postToSave: BlogPost = editingPost;

        if (postToSave.id === 0) {
            // New post
            const newPost: BlogPost = { ...postToSave, id: Math.max(...posts.map(p => p.id), 0) + 1 };
            setPosts([newPost, ...posts]);
        } else {
            // Update existing
            setPosts(posts.map(p => p.id === postToSave.id ? postToSave : p));
        }
        setEditingPost(null);
    };

    const handleExport = () => {
        const dataStr = `export const initialBlogPosts: BlogPost[] = ${JSON.stringify(posts, null, 2)};`;
        navigator.clipboard.writeText(dataStr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "JobShaman Shamanic Insights",
        "description": "Insights and analysis from the world of AI-driven job searching in the Czech Republic.",
        "blogPost": sortedPosts.map(post => ({
            "@type": "BlogPosting",
            "headline": post.title,
            "description": post.excerpt,
            "datePublished": "2026-02-02",
            "author": {
                "@type": "Organization",
                "name": "JobShaman"
            }
        }))
    };

    return (
        <section className="py-16 bg-slate-50 dark:bg-slate-950/50 relative">
            <div className="max-w-7xl mx-auto px-4 lg:px-8">
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>

                {/* Admin Toggle (Only in Dev) */}
                {import.meta.env.DEV && (
                    <div className="absolute top-4 right-4 opacity-10 hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setIsAdmin(!isAdmin)}
                            className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500"
                        >
                            <Edit2 size={16} />
                        </button>
                    </div>
                )}

                {/* Admin Toolbar */}
                {isAdmin && (
                    <div className="mb-8 p-4 bg-cyan-100 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-cyan-800 dark:text-cyan-300">Admin Mode</span>
                            <button
                                onClick={() => setEditingPost({
                                    id: 0,
                                    slug: '',
                                    title: '',
                                    excerpt: '',
                                    content: '',
                                    date: new Date().toLocaleDateString('cs-CZ'),
                                    readTime: '5 min čtení',
                                    category: 'Novinky',
                                    image: '',
                                    author: '',
                                    keywords: [],
                                    shamanSummary: '',
                                    qa: []
                                })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-500 transition-colors"
                            >
                                <Plus size={16} /> Přidat článek
                            </button>
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Zkopírováno!' : 'Exportovat DB'}
                        </button>
                    </div>
                )}

                {showOverview && (
                    <>
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6"
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <BookOpen className="text-cyan-600 dark:text-cyan-400" size={24} />
                                    <span className="text-sm font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                                        {t('blog.category_label', 'Shamanic Insights')}
                                    </span>
                                </div>
                                <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
                                    {t('blog.title', 'Novinky ze světa práce')}
                                </h2>
                                <p className="text-lg text-slate-600 dark:text-slate-400 mt-4 max-w-2xl">
                                    {t('blog.subtitle', 'Sledujeme trendy, analyzujeme trh a pomáháme vám dělat informovaná kariérní rozhodnutí.')}
                                </p>
                            </div>
                            <button className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold hover:gap-3 transition-all">
                                {t('blog.view_all', 'Všechny články')} <ArrowRight size={20} />
                            </button>
                        </motion.div>

                        {/* Stats Grid */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
                        >
                            {stats.map((stat, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 group hover:border-cyan-300 dark:hover:border-cyan-700 transition-all">
                                    <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover:scale-110 transition-transform`}>
                                        <stat.icon size={26} className={stat.color} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    </>
                )}

                {/* Blog Posts Grid */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {sortedPosts.map((post) => (
                        <article
                            key={post.id}
                            onClick={() => handleSelectPost(post)}
                            className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                        >
                            <div className="relative h-48 overflow-hidden">
                                {post.image ? (
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                                        <BookOpen size={48} />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <span className="px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-[10px] font-bold rounded-full text-cyan-600 dark:text-cyan-400 shadow-sm uppercase tracking-wider">
                                        {post.category}
                                    </span>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditingPost(post); }}
                                        className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-slate-900/90 rounded-full text-slate-600 dark:text-slate-300 hover:text-cyan-600 shadow-sm"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                )}
                            </div>

                            <div className="p-6 flex flex-col flex-1">
                                <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 mb-3 uppercase font-bold tracking-tight">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={12} /> {post.date}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} /> {post.readTime}
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-2">
                                    {t(`blog.posts.post${post.id}.title`, post.title)}
                                </h3>

                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                                    {t(`blog.posts.post${post.id}.excerpt`, post.excerpt)}
                                </p>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors uppercase tracking-wider">
                                        {t('blog.read_more', 'Číst více')} <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </motion.div>
            </div>

            {/* DETAIL MODAL */}
            {selectedPost && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1 bg-cyan-100 dark:bg-cyan-950 text-[10px] font-bold rounded-full text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
                                    {selectedPost.category}
                                </span>
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                    <span className="flex items-center gap-1"><Calendar size={14} /> {selectedPost.date}</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> {selectedPost.readTime}</span>
                                </div>
                            </div>
                            <button onClick={() => handleSelectPost(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <X size={24} className="text-slate-500" />
                            </button>
                        </div>

                        {/* AEO: Structured Data for the Article */}
                        <script type="application/ld+json">
                            {JSON.stringify({
                                "@context": "https://schema.org",
                                "@type": "BlogPosting",
                                "headline": selectedPost.title,
                                "description": selectedPost.excerpt,
                                "author": {
                                    "@type": "Person",
                                    "name": selectedPost.author
                                },
                                "datePublished": selectedPost.date,
                                "image": selectedPost.image,
                                "keywords": selectedPost.keywords.join(', '),
                                "mainEntityOfPage": {
                                    "@type": "WebPage",
                                    "@id": `https://jobshaman.cz/blog/${selectedPost.slug}`
                                }
                            })}
                        </script>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
                            {selectedPost.image && (
                                <img src={selectedPost.image} alt={selectedPost.title} className="w-full h-64 md:h-96 object-cover rounded-xl mb-10 shadow-lg" />
                            )}
                            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-8 leading-tight">
                                {selectedPost.title}
                            </h1>

                            {/* AEO: Shaman's Summary (TL;DR) */}
                            <div className="mb-10 p-6 bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-500 rounded-r-xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <Zap className="text-cyan-600 dark:text-cyan-400" size={20} />
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">
                                        Shaman's Summary (TL;DR)
                                    </h3>
                                </div>
                                <p className="text-slate-700 dark:text-slate-200 font-medium italic">
                                    "{selectedPost.shamanSummary}"
                                </p>
                            </div>

                            <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-lg mb-12">
                                <Markdown options={{ forceBlock: true }}>{formatJobDescription(selectedPost.content)}</Markdown>
                            </div>

                            {/* AEO: Key Takeaways (FAQ) */}
                            {selectedPost.qa && selectedPost.qa.length > 0 && (
                                <div className="mt-12 bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-800">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                        <Plus className="text-cyan-600" size={24} /> Key Takeaways & FAQ
                                    </h3>
                                    <div className="space-y-6">
                                        {selectedPost.qa.map((item, idx) => (
                                            <div key={idx} className="space-y-2">
                                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                                                    {item.question}
                                                </h4>
                                                <p className="text-slate-600 dark:text-slate-400 pl-4 border-l border-slate-200 dark:border-slate-800 text-sm">
                                                    {item.answer}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* FAQPage Structured Data */}
                                    <script type="application/ld+json">
                                        {JSON.stringify({
                                            "@context": "https://schema.org",
                                            "@type": "FAQPage",
                                            "mainEntity": selectedPost.qa.map(q => ({
                                                "@type": "Question",
                                                "name": q.question,
                                                "acceptedAnswer": {
                                                    "@type": "Answer",
                                                    "text": q.answer
                                                }
                                            }))
                                        })}
                                    </script>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
                            <button
                                onClick={() => handleSelectPost(null)}
                                className="px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Zavřít článek
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDITOR MODAL */}
            {editingPost && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {editingPost.id === 0 ? 'Nový článek' : 'Upravit článek'}
                            </h2>
                            <button onClick={() => setEditingPost(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <X size={24} className="text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePost} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Titulek</label>
                                    <input
                                        required
                                        value={editingPost.title}
                                        onChange={e => setEditingPost({ ...editingPost, title: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                                        placeholder="Jak najít práci..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Kategorie</label>
                                    <select
                                        value={editingPost.category}
                                        onChange={e => setEditingPost({ ...editingPost, category: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                                    >
                                        <option value="Tipy & Triky">Tipy & Triky</option>
                                        <option value="Novinky">Novinky</option>
                                        <option value="Technologie">Technologie</option>
                                        <option value="Kariéra">Kariéra</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">URL Obrázku (Unsplash apod.)</label>
                                    <input
                                        value={editingPost.image}
                                        onChange={e => setEditingPost({ ...editingPost, image: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                                        placeholder="https://images.unsplash.com/..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Čas čtení</label>
                                    <input
                                        value={editingPost.readTime}
                                        onChange={e => setEditingPost({ ...editingPost, readTime: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                                        placeholder="5 min čtení"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Perex (krátký popis na kartě)</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={editingPost.excerpt}
                                    onChange={e => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
                                    placeholder="Stručné shrnutí článku..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Obsah (Markdown)</label>
                                <textarea
                                    required
                                    rows={12}
                                    value={editingPost.content}
                                    onChange={e => setEditingPost({ ...editingPost, content: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-sm"
                                    placeholder="# Nadpis\n\nText článku s **tučným** písmem..."
                                />
                            </div>
                        </form>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center">
                            <p className="text-xs text-slate-500 italic">Změny se uloží pouze do aktuální relace. Nezapomeňte exportovat!</p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingPost(null)}
                                    className="px-6 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                    Zrušit
                                </button>
                                <button
                                    onClick={handleSavePost}
                                    className="px-6 py-2.5 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-600/20 flex items-center gap-2"
                                >
                                    <Save size={18} /> Uložit do relace
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default BlogSection;
