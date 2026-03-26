// SEO and AEO utilities for JobShaman

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  structuredData?: Record<string, any>;
}

const resolveI18nValue = (
  t: any,
  keys: string[],
  options?: Record<string, any>,
  fallback = ''
) => {
  for (const key of keys) {
    const value = t(key, { ...(options || {}), defaultValue: '' });
    if (value) return value;
  }
  return fallback;
};

const generatePlatformStructuredData = (baseUrl: string, language = 'cs-CZ') => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${baseUrl}#organization`,
      "name": "JobShaman",
      "url": baseUrl,
      "logo": `${baseUrl}/logo.png`,
      "description": "Collaboration-first hiring platform that helps candidates and companies experience fit before the job starts.",
    },
    {
      "@type": "WebSite",
      "@id": `${baseUrl}#website`,
      "url": baseUrl,
      "name": "JobShaman",
      "inLanguage": language,
      "publisher": { "@id": `${baseUrl}#organization` },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${baseUrl}/jobs?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${baseUrl}#app`,
      "name": "JobShaman",
      "url": baseUrl,
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "featureList": [
        "career map",
        "goal navigation",
        "mini challenges",
        "handshake hiring",
        "company work simulations",
      ],
      "publisher": { "@id": `${baseUrl}#organization` },
    },
  ],
});

// Dynamic SEO metadata based on page content
export const generateSEOMetadata = (page: string, t: any, data?: any): SEOMetadata => {
  const baseTitle = resolveI18nValue(t, ['seo.base_title', 'footer.seo.base_title'], undefined, 'JobShaman');
  const homeDescription = resolveI18nValue(t, ['seo.home_description', 'footer.seo.home_description'], undefined, baseTitle);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : "https://jobshaman.cz";
  const language = typeof document !== 'undefined'
    ? (document.documentElement.lang || 'cs-CZ')
    : 'cs-CZ';

  switch (page) {
    case 'home':
      return {
        title: baseTitle,
        description: homeDescription,
        keywords: [
          "career map",
          "goal navigation",
          "handshake hiring",
          "collaboration-first hiring",
          "job matching",
          "mini challenges",
          "customer success jobs",
          "operations jobs",
          "remote jobs",
          "jobshaman",
        ],
        canonical: baseUrl,
        ogImage: `${baseUrl}/og-image.jpg`,
        structuredData: generatePlatformStructuredData(baseUrl, language)
      };

    case 'job-detail':
      return {
        title: `${data?.title || resolveI18nValue(t, ['job.details', 'admin_dashboard.table.detail'], undefined, 'Detail')} | ${data?.company || ''} - ${resolveI18nValue(t, ['seo.job_detail_suffix', 'footer.seo.job_detail_suffix'], undefined, 'JobShaman')}`,
        description: resolveI18nValue(t, ['seo.job_detail_description', 'footer.seo.job_detail_description'], {
          title: data?.title,
          company: data?.company,
          salary: data?.salary || (t('financial.gross_monthly') + ' ' + t('common.unknown')),
          location: data?.location || t('common.unknown'),
          benefits: data?.benefits?.join(', ') || t('common.none')
        }, homeDescription),
        keywords: [data?.title, data?.company, data?.location, 'job detail', 'job posting', 'career opportunity', 'jobshaman'],
        canonical: `${baseUrl}/jobs/${data?.id}`,
        ogImage: data?.logo || `${baseUrl}/og-image.jpg`,
        structuredData: generateJobPostingStructuredData(data)
      };

    case 'company-dashboard':
      return {
        title: t('seo.company_dashboard_title'),
        description: t('seo.company_dashboard_description'),
        keywords: ["hiring platform", "handshake hiring", "work simulation hiring", "candidate matching", "AI hiring assistant", "jobshaman for companies"],
        canonical: `${baseUrl}/pro-firmy`
      };

    case 'marketplace':
      return {
        title: `${resolveI18nValue(t, ['careeros.layers.marketplace'], undefined, 'List')} | JobShaman`,
        description: resolveI18nValue(
          t,
          ['seo.marketplace_description'],
          undefined,
          'Browse live job listings, compare roles quickly, and move between the classic list, Career Map, and goal navigation.',
        ),
        keywords: ["job list", "job listings", "career map", "goal navigation", "mini challenges", "jobshaman"],
        canonical: `${baseUrl}/jobs`
      };

    case 'services':
      return {
        title: t('seo.services_title'),
        description: t('seo.services_description'),
        keywords: ["kariéra", "služby", "poradenství", "profesní růst", "pracovní nabídky"],
        canonical: `${baseUrl}/sluzby`
      };

    case 'saved':
      return {
        title: t('seo.saved_title'),
        description: t('seo.saved_description'),
        keywords: ["uložené nabídky", "oblíbené pozice", "můj seznam", "práce"],
        canonical: `${baseUrl}/ulozene`
      };

    case 'assessment':
      return {
        title: t('seo.assessment_title'),
        description: t('seo.assessment_description'),
        keywords: ["assessment", "testy", "hodnocení kandidátů", "nábory", "psychometrie"],
        canonical: `${baseUrl}/assessment-centrum`
      };

    case 'profile':
      return {
        title: t('seo.profile_title'),
        description: t('seo.profile_description'),
        keywords: ["candidate profile", "career profile", "goal navigation", "career map", "hidden skills", "personalized job matching"],
        canonical: `${baseUrl}/profil`
      };

    case 'about':
      return {
        title: resolveI18nValue(t, ['seo.about_title'], undefined, 'About JobShaman'),
        description: resolveI18nValue(
          t,
          ['seo.about_description'],
          undefined,
          'JobShaman builds hiring on real interaction, compatibility, and stronger signals about how people actually work together.',
        ),
        keywords: ["about jobshaman", "collaboration-first hiring", "compatibility hiring", "career map", "handshake hiring"],
        canonical: `${baseUrl}/about`,
      };

    case 'blog-post':
      return {
        title: `${data?.title || ''} | ${t('blog.category_label')} - JobShaman`,
        description: data?.shamanSummary || data?.excerpt || '',
        keywords: data?.keywords || [],
        canonical: `${baseUrl}/blog/${data?.slug}`,
        ogImage: data?.image || `${baseUrl}/og-image.jpg`,
        structuredData: generateBlogStructuredData(data)
      };

    default:
      return {
        title: baseTitle,
        description: homeDescription,
        canonical: baseUrl
      };
  }
};

// Generate structured data for job posting
export const generateJobPostingStructuredData = (job: any) => {
  const minSalary = job?.salary?.min ?? job?.salary_from ?? null;
  const maxSalary = job?.salary?.max ?? job?.salary_to ?? null;
  const currency = job?.salary?.currency || job?.salary_currency || job?.currency || "CZK";
  const country = (job?.country_code || "CZ").toUpperCase();
  const datePosted = job?.scrapedAt || job?.scraped_at || job?.postedAt;
  const workModel = String(job?.work_model || job?.workModel || job?.work_type || '').toLowerCase();
  const isRemote = /remote/.test(workModel);
  const isHybrid = /hybrid/.test(workModel);
  const employmentType = String(job?.contract_type || job?.contractType || job?.employmentType || '').trim();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "JobPosting",
        "title": job.title,
        "description": job.description,
        "identifier": {
          "@type": "PropertyValue",
          "name": "Job ID",
          "value": job.id
        },
        "datePosted": datePosted,
        "validThrough": job.validUntil,
        "employmentType": employmentType || undefined,
        "hiringOrganization": {
          "@type": "Organization",
          "name": job.company,
          "sameAs": job.website,
          "logo": job.logo
        },
        "jobLocation": isRemote ? undefined : {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": job.location,
            "addressCountry": country
          }
        },
        "jobLocationType": isRemote ? "TELECOMMUTE" : (isHybrid ? "HYBRID" : undefined),
        "applicantLocationRequirements": {
          "@type": "Country",
          "name": country
        },
        "directApply": Boolean(job?.direct_apply || job?.external_apply_url || job?.url),
        "baseSalary": (minSalary || maxSalary) ? {
          "@type": "MonetaryAmount",
          "currency": currency,
          "value": {
            "@type": "QuantitativeValue",
            "minValue": minSalary || undefined,
            "maxValue": maxSalary || undefined,
            "unitText": "MONTH"
          }
        } : undefined,
        "jobBenefits": job.benefits?.map((benefit: string) => ({
          "@type": "DefinedTerm",
          "name": benefit
        })),
        "responsibilities": job.requirements,
        "qualifications": job.requirements,
        "skills": job.skills?.map((skill: string) => ({
          "@type": "DefinedTerm",
          "name": skill
        })),
        "workHours": job.workType,
        "industry": job.industry
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "JobShaman",
            "item": typeof window !== 'undefined' ? window.location.origin : "https://jobshaman.cz"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Jobs",
            "item": `${typeof window !== 'undefined' ? window.location.origin : "https://jobshaman.cz"}/jobs`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": job.title,
            "item": `${typeof window !== 'undefined' ? window.location.origin : "https://jobshaman.cz"}/jobs/${job.id}`
          }
        ]
      }
    ]
  };
};

// Generate structured data for blog posts (AEO)
export const generateBlogStructuredData = (post: any) => {
  if (!post) return undefined;

  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "author": {
      "@type": "Person",
      "name": post.author || "JobShaman"
    },
    "datePublished": post.date,
    "image": post.image,
    "keywords": post.keywords?.join(', '),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://jobshaman.cz/blog/${post.slug}`
    }
  };

  if (post.qa && post.qa.length > 0) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        blogPosting,
        {
          "@type": "FAQPage",
          "mainEntity": post.qa.map((q: any) => ({
            "@type": "Question",
            "name": q.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": q.answer
            }
          }))
        }
      ]
    };
  }

  return blogPosting;
};

// Generate FAQ structured data
export const generateFAQStructuredData = (t: any) => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": resolveI18nValue(t, ['company_landing.faq.q1'], undefined, ''),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": resolveI18nValue(t, ['company_landing.faq.a1'], undefined, '')
        }
      },
      {
        "@type": "Question",
        "name": resolveI18nValue(t, ['company_landing.faq.q2'], undefined, ''),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": resolveI18nValue(t, ['company_landing.faq.a2'], undefined, '')
        }
      },
      {
        "@type": "Question",
        "name": resolveI18nValue(t, ['company_landing.faq.q3'], undefined, ''),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": resolveI18nValue(t, ['company_landing.faq.a3'], undefined, '')
        }
      },
      {
        "@type": "Question",
        "name": resolveI18nValue(t, ['company_landing.faq.q4'], undefined, ''),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": resolveI18nValue(t, ['company_landing.faq.a4'], undefined, '')
        }
      },
      {
        "@type": "Question",
        "name": resolveI18nValue(t, ['company_landing.faq.q5'], undefined, ''),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": resolveI18nValue(t, ['company_landing.faq.a5'], undefined, '')
        }
      }
    ]
  };
};

// Update page meta tags dynamically
export const updatePageMeta = (metadata: SEOMetadata) => {
  // Update title
  document.title = metadata.title;

  // Update or create meta tags
  const updateMeta = (name: string, content: string) => {
    let meta = document.querySelector(`meta[name="${name}"]`) ||
      document.querySelector(`meta[property="${name}"]`);

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(name.startsWith('og:') ? 'property' : 'name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  // Basic meta tags
  updateMeta('description', metadata.description);
  if (metadata.keywords) {
    updateMeta('keywords', metadata.keywords.join(', '));
  }

  // hreflang alternate links
  const languages = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
  const url = new URL(window.location.href);
  const segments = url.pathname.split('/').filter(Boolean);
  const hasLangPrefix = segments.length > 0 && languages.includes(segments[0]);
  const pathWithoutLang = `/${(hasLangPrefix ? segments.slice(1) : segments).join('/')}`.replace(/\/+$/, '') || '/';

  languages.forEach(lang => {
    let link = document.querySelector(`link[hreflang="${lang}"]`) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang;
      document.head.appendChild(link);
    }
    link.href = `${url.origin}/${lang}${pathWithoutLang === '/' ? '' : pathWithoutLang}`;
  });

  // Canonical URL
  if (metadata.canonical) {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = metadata.canonical;
  }

  // Open Graph
  updateMeta('og:title', metadata.title);
  updateMeta('og:description', metadata.description);
  updateMeta('og:image', metadata.ogImage || '');
  updateMeta('og:url', metadata.canonical || window.location.href);

  // Twitter Card
  updateMeta('twitter:card', 'summary_large_image');
  updateMeta('twitter:title', metadata.title);
  updateMeta('twitter:description', metadata.description);
  updateMeta('twitter:image', metadata.ogImage || '');
  updateMeta('twitter:url', metadata.canonical || window.location.href);

  // Structured data
  if (metadata.structuredData) {
    let structuredDataScript = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement;
    if (!structuredDataScript) {
      structuredDataScript = document.createElement('script');
      structuredDataScript.type = 'application/ld+json';
      document.head.appendChild(structuredDataScript);
    }
    structuredDataScript.textContent = JSON.stringify(metadata.structuredData);
  }
};

// Generate search suggestions for AEO
export const generateSearchSuggestions = (query: string): string[] => {
  const suggestions = [
    'práce Praha',
    'práce Brno',
    'práce Ostrava',
    'práce na dálku',
    'home office',
    'flexibilní doba',
    'IT pozice',
    'marketing práce',
    'finance práce',
    'logistika práce'
  ];

  return suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(query.toLowerCase())
  );
};

// Generate AI-friendly page summary
export const generateAISummary = (page: string, t: any, data?: any): string => {
  switch (page) {
    case 'home':
      return t('seo.ai_summary_home');
    case 'job-detail':
      return t('seo.ai_summary_job', {
        title: data?.title,
        company: data?.company,
        salary: data?.salary || t('common.unknown'),
        location: data?.location || t('common.unknown'),
        benefits: data?.benefits?.slice(0, 3).join(', ') || t('common.standard_package')
      });
    case 'blog-post':
      return `${data?.title}: ${data?.shamanSummary || data?.excerpt}`;
    case 'company-dashboard':
      return t('seo.ai_summary_company');
    case 'about':
      return resolveI18nValue(
        t,
        ['seo.ai_summary_about'],
        undefined,
        'JobShaman focuses on what happens when people actually start working together, not just how they look on paper.',
      );
    case 'services':
      return t('seo.ai_summary_services');
    case 'saved':
      return t('seo.ai_summary_saved');
    default:
      return t('seo.ai_summary_default');
  }
};
