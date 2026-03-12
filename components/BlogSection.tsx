import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Shield, BarChart3, Search, Plus, Edit2, X, Check, Calendar, Clock, ArrowRight, Copy, Save, Zap, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabaseService';
import { fetchJobsWithFilters } from '../services/jobService';
import { initialBlogPosts as blogPosts, BlogPost } from '../src/data/blogPosts';
import Markdown from 'markdown-to-jsx';
import { cn, MetricTile, PageHeader, SurfaceCard } from './ui/primitives';

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

const toIsoDate = (dateValue?: string): string | undefined => {
    const ts = parseBlogDateToTimestamp(dateValue);
    if (!ts) return undefined;
    return new Date(ts).toISOString().split('T')[0];
};

const BlogSection: React.FC<BlogSectionProps> = ({
    selectedBlogPostSlug,
    setSelectedBlogPostSlug,
    showOverview = true
}) => {
    const { t, i18n } = useTranslation();
    const locale = (i18n.language || 'cs').split('-')[0].toLowerCase();
    const isCsLike = locale === 'cs' || locale === 'sk';
    const [posts, setPosts] = useState<BlogPost[]>(blogPosts);
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const siteOrigin = useMemo(() => {
        if (typeof window !== 'undefined' && window.location?.origin) {
            return window.location.origin;
        }
        return 'https://jobshaman.com';
    }, []);
    const blogListUrl = `${siteOrigin}/blog`;
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

    useEffect(() => {
        const setMeta = (attr: 'name' | 'property', key: string, value: string) => {
            let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(attr, key);
                document.head.appendChild(el);
            }
            el.setAttribute('content', value);
        };
        const removeMeta = (attr: 'name' | 'property', key: string) => {
            document.querySelectorAll(`meta[${attr}="${key}"]`).forEach((node) => node.parentNode?.removeChild(node));
        };

        if (!selectedPost) return;

        const previousTitle = document.title;
        const previousDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const previousKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
        const title = `${selectedPost.title} | JobShaman`;
        const description = selectedPost.excerpt || 'JobShaman Blog';
        const articleUrl = `${siteOrigin}/blog/${selectedPost.slug}`;
        const keywords = Array.isArray(selectedPost.keywords) ? selectedPost.keywords.join(', ') : '';

        document.title = title;
        setMeta('name', 'description', description);
        if (keywords) {
            setMeta('name', 'keywords', keywords);
        }
        setMeta('property', 'og:title', title);
        setMeta('property', 'og:description', description);
        setMeta('property', 'og:type', 'article');
        setMeta('property', 'og:url', articleUrl);
        if (selectedPost.image) {
            setMeta('property', 'og:image', selectedPost.image);
        }
        removeMeta('property', 'article:tag');
        selectedPost.keywords.forEach((keyword) => {
            setMeta('property', 'article:tag', keyword);
        });
        setMeta('name', 'twitter:card', 'summary_large_image');
        setMeta('name', 'twitter:title', title);
        setMeta('name', 'twitter:description', description);

        return () => {
            document.title = previousTitle;
            setMeta('name', 'description', previousDescription);
            if (previousKeywords) {
                setMeta('name', 'keywords', previousKeywords);
            } else {
                removeMeta('name', 'keywords');
            }
            removeMeta('property', 'article:tag');
        };
    }, [selectedPost, siteOrigin]);

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
    const isAbortLikeError = (error: unknown): boolean => {
        const msg = String((error as any)?.message || error || '').toLowerCase();
        return (error as any)?.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout');
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
                if (!isLikelyNetworkError(err) && !isAbortLikeError(err)) {
                    console.error('Error computing average JHI from jobs:', err);
                }
            }
        };

        fetchStats();
        fetchAvgJhiFromJobs();
        return () => { isMounted = false; };
    }, [i18n.language]);
    const [copied, setCopied] = useState(false);
    const copy = {
        categoryLabel: t('blog.category_label', isCsLike ? 'Články a praktické poznámky' : 'Articles and practical notes'),
        title: t('blog.title', isCsLike ? 'Články, které pomáhají rozhodnout se líp.' : 'Articles that help you make better career decisions.'),
        subtitle: t('blog.subtitle', isCsLike ? 'Trendy, konkrétní signály z trhu práce a srozumitelný kontext k tomu, co v aplikaci vidíš u nabídek.' : 'Market signals, practical context, and clearer explanations for the data you see across the app.'),
        backToList: isCsLike ? 'Zpět na přehled článků' : 'Back to articles',
        latestArticles: isCsLike ? 'Nejnovější články' : 'Latest articles',
        moreArticles: isCsLike ? 'Další články' : 'More articles',
        compactTitle: isCsLike ? 'Vybrané články' : 'Selected articles',
        compactBody: isCsLike ? 'Krátké poznámky a tipy k práci, hledání a rozhodování.' : 'Short notes and practical tips about work, search, and decision-making.',
        readMore: t('blog.read_more', isCsLike ? 'Číst více' : 'Read more'),
        closeArticle: isCsLike ? 'Zavřít článek' : 'Close article',
        summaryLabel: isCsLike ? 'Stručné shrnutí' : 'Short summary',
        faqLabel: isCsLike ? 'Klíčové body a časté otázky' : 'Key takeaways and frequent questions',
        adminMode: isCsLike ? 'Admin režim' : 'Admin mode',
        addArticle: isCsLike ? 'Přidat článek' : 'Add article',
        copied: isCsLike ? 'Zkopírováno!' : 'Copied!',
        exportDb: isCsLike ? 'Exportovat data' : 'Export data',
        saveSession: isCsLike ? 'Uložit do relace' : 'Save to session',
        cancel: isCsLike ? 'Zrušit' : 'Cancel',
        sessionNote: isCsLike ? 'Změny se uloží jen do aktuální relace. Pro trvalou změnu je potřeba export.' : 'Changes stay only in the current session. Export them if you want to keep them.',
        newArticle: isCsLike ? 'Nový článek' : 'New article',
        editArticle: isCsLike ? 'Upravit článek' : 'Edit article'
    };

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
        "url": blogListUrl,
        "@id": blogListUrl,
        "inLanguage": (i18n.language || 'cs').split('-')[0],
        "publisher": {
            "@type": "Organization",
            "name": "JobShaman",
            "url": siteOrigin
        },
        "blogPost": sortedPosts.map(post => ({
            "@type": "BlogPosting",
            "headline": post.title,
            "description": post.excerpt,
            "datePublished": toIsoDate(post.date),
            "dateModified": toIsoDate(post.modifiedDate || post.date),
            "url": `${siteOrigin}/blog/${post.slug}`,
            "mainEntityOfPage": `${siteOrigin}/blog/${post.slug}`,
            "inLanguage": (i18n.language || 'cs').split('-')[0],
            "keywords": post.keywords,
            "articleSection": post.category,
            "author": {
                "@type": "Person",
                "name": post.author || "JobShaman"
            },
            "publisher": {
                "@type": "Organization",
                "name": "JobShaman",
                "url": siteOrigin
            },
            "image": post.image || undefined
        }))
    };

    return (
        <section className={cn('relative', showOverview ? 'space-y-6 px-1 pb-8' : 'space-y-4')}>
            <script type="application/ld+json">
                {JSON.stringify(structuredData)}
            </script>

            {import.meta.env.DEV && (
                <div className="absolute right-2 top-2 z-10 opacity-20 transition-opacity hover:opacity-100">
                    <button
                        onClick={() => setIsAdmin(!isAdmin)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-faint)] shadow-[var(--shadow-soft)]"
                    >
                        <Edit2 size={15} />
                    </button>
                </div>
            )}

            {isAdmin && (
                <SurfaceCard className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" tone="accent">
                    <div className="flex items-center gap-3">
                        <span className="app-eyebrow">{copy.adminMode}</span>
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
                            className="app-button-primary !px-3.5 !py-2.5"
                        >
                            <Plus size={16} />
                            {copy.addArticle}
                        </button>
                    </div>
                    <button onClick={handleExport} className="app-button-secondary !px-3.5 !py-2.5">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? copy.copied : copy.exportDb}
                    </button>
                </SurfaceCard>
            )}

            {showOverview ? (
                <>
                    <PageHeader
                        eyebrow={copy.categoryLabel}
                        title={copy.title}
                        body={copy.subtitle}
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                        {stats.map((stat, idx) => (
                            <MetricTile
                                key={idx}
                                label={stat.label}
                                value={stat.value}
                                tone={idx === 0 ? 'default' : idx === 1 ? 'success' : 'accent'}
                                className="shadow-[var(--shadow-soft)]"
                            />
                        ))}
                    </div>

                    {sortedPosts[0] ? (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_360px]">
                            <button
                                type="button"
                                onClick={() => handleSelectPost(sortedPosts[0])}
                                className="group overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-elevated)] text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[rgba(var(--accent-rgb),0.24)]"
                            >
                                <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(280px,0.78fr)]">
                                    <div className="flex flex-col justify-between p-6">
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="app-eyebrow">{sortedPosts[0].category}</span>
                                                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)]">
                                                    <Calendar size={13} />
                                                    {sortedPosts[0].date}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)]">
                                                    <Clock size={13} />
                                                    {sortedPosts[0].readTime}
                                                </span>
                                            </div>
                                            <div className="space-y-3">
                                                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] transition group-hover:text-[var(--accent)]">
                                                    {t(`blog.posts.post${sortedPosts[0].id}.title`, sortedPosts[0].title)}
                                                </h2>
                                                <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
                                                    {t(`blog.posts.post${sortedPosts[0].id}.excerpt`, sortedPosts[0].excerpt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                                            {copy.readMore}
                                            <ArrowRight size={16} className="text-[var(--accent)] transition group-hover:translate-x-0.5" />
                                        </div>
                                    </div>
                                    <div className="min-h-[260px] overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                                        {sortedPosts[0].image ? (
                                            <img
                                                src={sortedPosts[0].image}
                                                alt={sortedPosts[0].title}
                                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-[var(--text-faint)]">
                                                <BookOpen size={56} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>

                            <SurfaceCard className="space-y-3" tone="muted">
                                <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.latestArticles}</div>
                                {sortedPosts.slice(1, 5).map((post) => (
                                    <button
                                        key={post.id}
                                        type="button"
                                        onClick={() => handleSelectPost(post)}
                                        className="w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 text-left transition hover:border-[rgba(var(--accent-rgb),0.22)]"
                                    >
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                                            <span className="text-[var(--accent)]">{post.category}</span>
                                            <span>{post.date}</span>
                                        </div>
                                        <div className="mt-2 text-base font-semibold leading-6 text-[var(--text-strong)]">
                                            {t(`blog.posts.post${post.id}.title`, post.title)}
                                        </div>
                                        <div className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
                                            {t(`blog.posts.post${post.id}.excerpt`, post.excerpt)}
                                        </div>
                                    </button>
                                ))}
                            </SurfaceCard>
                        </div>
                    ) : null}

                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.moreArticles}</div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {sortedPosts.slice(sortedPosts[0] ? 1 : 0).map((post) => (
                                <article
                                    key={post.id}
                                    className="group overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[rgba(var(--accent-rgb),0.24)]"
                                >
                                    <button type="button" onClick={() => handleSelectPost(post)} className="block w-full text-left">
                                        <div className="h-48 overflow-hidden bg-[var(--surface-muted)]">
                                            {post.image ? (
                                                <img
                                                    src={post.image}
                                                    alt={post.title}
                                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-[var(--text-faint)]">
                                                    <BookOpen size={44} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-3 p-5">
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                                                <span className="text-[var(--accent)]">{post.category}</span>
                                                <span>{post.date}</span>
                                                <span className="inline-flex items-center gap-1"><Clock size={12} />{post.readTime}</span>
                                            </div>
                                            <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)] transition group-hover:text-[var(--accent)]">
                                                {t(`blog.posts.post${post.id}.title`, post.title)}
                                            </h3>
                                            <p className="line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
                                                {t(`blog.posts.post${post.id}.excerpt`, post.excerpt)}
                                            </p>
                                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                                                {copy.readMore}
                                                <ArrowRight size={15} className="text-[var(--accent)]" />
                                            </div>
                                        </div>
                                    </button>
                                </article>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-3">
                    <SurfaceCard className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-base font-semibold text-[var(--text-strong)]">{copy.compactTitle}</div>
                            <div className="text-sm leading-6 text-[var(--text-muted)]">{copy.compactBody}</div>
                        </div>
                    </SurfaceCard>
                    {sortedPosts[0] ? (
                        <button
                            type="button"
                            onClick={() => handleSelectPost(sortedPosts[0])}
                            className="group w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-elevated)] text-left shadow-[var(--shadow-soft)] transition hover:border-[rgba(var(--accent-rgb),0.24)]"
                        >
                            <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                                <div className="h-44 overflow-hidden bg-[var(--surface-muted)]">
                                    {sortedPosts[0].image ? (
                                        <img src={sortedPosts[0].image} alt={sortedPosts[0].title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-[var(--text-faint)]"><BookOpen size={38} /></div>
                                    )}
                                </div>
                                <div className="space-y-3 p-4">
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                                        <span className="text-[var(--accent)]">{sortedPosts[0].category}</span>
                                        <span>{sortedPosts[0].date}</span>
                                        <span className="inline-flex items-center gap-1"><Clock size={12} />{sortedPosts[0].readTime}</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-strong)] transition group-hover:text-[var(--accent)]">
                                        {t(`blog.posts.post${sortedPosts[0].id}.title`, sortedPosts[0].title)}
                                    </h3>
                                    <p className="line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
                                        {t(`blog.posts.post${sortedPosts[0].id}.excerpt`, sortedPosts[0].excerpt)}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                        {sortedPosts.slice(1, 5).map((post) => (
                            <button
                                key={post.id}
                                type="button"
                                onClick={() => handleSelectPost(post)}
                                className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-left shadow-[var(--shadow-soft)] transition hover:border-[rgba(var(--accent-rgb),0.24)]"
                            >
                                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                                    <span className="text-[var(--accent)]">{post.category}</span>
                                    <span>{post.date}</span>
                                </div>
                                <div className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--text-strong)] transition group-hover:text-[var(--accent)]">
                                    {t(`blog.posts.post${post.id}.title`, post.title)}
                                </div>
                                <div className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                                    {t(`blog.posts.post${post.id}.excerpt`, post.excerpt)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedPost && (
                <div className="fixed inset-0 z-[100] bg-[rgba(15,23,42,0.58)] p-4 backdrop-blur-md">
                    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-overlay)]">
                        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
                            <div className="flex min-w-0 flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleSelectPost(null)}
                                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition hover:border-[rgba(var(--accent-rgb),0.22)]"
                                >
                                    <ArrowLeft size={14} />
                                    {copy.backToList}
                                </button>
                                <span className="app-eyebrow">{selectedPost.category}</span>
                                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)]"><Calendar size={13} />{selectedPost.date}</span>
                                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)]"><Clock size={13} />{selectedPost.readTime}</span>
                            </div>
                            <button
                                onClick={() => handleSelectPost(null)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* AEO: Structured Data for the Article */}
                        <script type="application/ld+json">
                            {JSON.stringify({
                                "@context": "https://schema.org",
                                "@type": "BlogPosting",
                                "headline": selectedPost.title,
                                "description": selectedPost.excerpt,
                                "url": `${siteOrigin}/blog/${selectedPost.slug}`,
                                "mainEntityOfPage": `${siteOrigin}/blog/${selectedPost.slug}`,
                                "datePublished": toIsoDate(selectedPost.date),
                                "dateModified": toIsoDate(selectedPost.modifiedDate || selectedPost.date),
                                "inLanguage": (i18n.language || 'cs').split('-')[0],
                                "articleSection": selectedPost.category,
                                "author": {
                                    "@type": "Person",
                                    "name": selectedPost.author
                                },
                                "publisher": {
                                    "@type": "Organization",
                                    "name": "JobShaman",
                                    "url": siteOrigin
                                },
                                "image": selectedPost.image,
                                "keywords": selectedPost.keywords
                            })}
                        </script>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 sm:px-6 md:px-10 md:py-10">
                            {selectedPost.image && (
                                <img src={selectedPost.image} alt={selectedPost.title} className="mb-8 h-64 w-full rounded-[1.6rem] object-cover shadow-[var(--shadow-card)] md:h-96" />
                            )}
                            <div className="mx-auto max-w-3xl space-y-8">
                                <div className="space-y-4">
                                    <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--text-strong)] md:text-5xl md:leading-[1.02]">
                                        {selectedPost.title}
                                    </h1>
                                    <p className="text-lg leading-8 text-[var(--text-muted)]">
                                        {selectedPost.excerpt}
                                    </p>
                                </div>

                                <SurfaceCard tone="accent" className="border-l-4 border-l-[var(--accent)]">
                                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                                        <Zap size={16} />
                                        {copy.summaryLabel}
                                    </div>
                                    <p className="mt-3 text-base leading-7 text-[var(--text)]">
                                        {selectedPost.shamanSummary}
                                    </p>
                                </SurfaceCard>

                                <div className="prose max-w-none prose-headings:tracking-[-0.03em] prose-headings:text-[var(--text-strong)] prose-p:text-[var(--text)] prose-p:leading-8 prose-li:text-[var(--text)] prose-strong:text-[var(--text-strong)] prose-a:text-[var(--accent)] dark:prose-invert">
                                    <Markdown options={{ forceBlock: true }}>{selectedPost.content}</Markdown>
                                </div>

                                {selectedPost.qa && selectedPost.qa.length > 0 && (
                                    <SurfaceCard tone="muted">
                                        <h3 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                                            <Plus size={20} className="text-[var(--accent)]" />
                                            {copy.faqLabel}
                                        </h3>
                                        <div className="mt-6 space-y-5">
                                            {selectedPost.qa.map((item, idx) => (
                                                <div key={idx} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                                                    <h4 className="text-base font-semibold text-[var(--text-strong)]">{item.question}</h4>
                                                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.answer}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <script type="application/ld+json">
                                            {JSON.stringify({
                                                "@context": "https://schema.org",
                                                "@type": "FAQPage",
                                                "inLanguage": (i18n.language || 'cs').split('-')[0],
                                                "url": `${siteOrigin}/blog/${selectedPost.slug}`,
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
                                    </SurfaceCard>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-4 sm:px-6">
                            <button
                                onClick={() => handleSelectPost(null)}
                                className="app-button-secondary !px-4 !py-2.5"
                            >
                                {copy.closeArticle}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDITOR MODAL */}
            {editingPost && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-4 backdrop-blur-md">
                    <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-overlay)]">
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
                            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                                {editingPost.id === 0 ? copy.newArticle : copy.editArticle}
                            </h2>
                            <button onClick={() => setEditingPost(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition hover:text-[var(--text-strong)]">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePost} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--text-strong)]">Titulek</label>
                                    <input
                                        required
                                        value={editingPost.title}
                                        onChange={e => setEditingPost({ ...editingPost, title: e.target.value })}
                                        className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]"
                                        placeholder="Jak najít práci..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--text-strong)]">Kategorie</label>
                                    <select
                                        value={editingPost.category}
                                        onChange={e => setEditingPost({ ...editingPost, category: e.target.value })}
                                        className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]"
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
                                    <label className="text-sm font-semibold text-[var(--text-strong)]">URL obrázku</label>
                                    <input
                                        value={editingPost.image}
                                        onChange={e => setEditingPost({ ...editingPost, image: e.target.value })}
                                        className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]"
                                        placeholder="https://images.unsplash.com/..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[var(--text-strong)]">Čas čtení</label>
                                    <input
                                        value={editingPost.readTime}
                                        onChange={e => setEditingPost({ ...editingPost, readTime: e.target.value })}
                                        className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]"
                                        placeholder="5 min čtení"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[var(--text-strong)]">Perex</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={editingPost.excerpt}
                                    onChange={e => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                                    className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]"
                                    placeholder="Stručné shrnutí článku..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[var(--text-strong)]">Obsah (Markdown)</label>
                                <textarea
                                    required
                                    rows={12}
                                    value={editingPost.content}
                                    onChange={e => setEditingPost({ ...editingPost, content: e.target.value })}
                                    className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 font-mono text-sm outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]"
                                    placeholder="# Nadpis\n\nText článku s **tučným** písmem..."
                                />
                            </div>
                        </form>

                        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-6 py-5">
                            <p className="text-xs italic text-[var(--text-faint)]">{copy.sessionNote}</p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingPost(null)}
                                    className="app-button-secondary !px-4 !py-2.5"
                                >
                                    {copy.cancel}
                                </button>
                                <button
                                    onClick={handleSavePost}
                                    className="app-button-primary !px-4 !py-2.5"
                                >
                                    <Save size={18} /> {copy.saveSession}
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
