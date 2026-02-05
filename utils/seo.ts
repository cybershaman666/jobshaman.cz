// SEO and AEO utilities for JobShaman

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  structuredData?: Record<string, any>;
}

// Dynamic SEO metadata based on page content
export const generateSEOMetadata = (page: string, t: any, data?: any): SEOMetadata => {
  const baseTitle = t('seo.base_title');
  const baseUrl = "https://jobshaman.cz";

  switch (page) {
    case 'home':
      return {
        title: `${baseTitle} | ${t('welcome.title_accent')}`,
        description: t('welcome.subtitle'),
        keywords: ["nabídky práce", "jobs Česko", "AI analýza práce", "JHI skóre", "platy", "benefity", "práce Praha", "Brno", "Ostrava", "Plzeň", "transparentní mzda", "čistý příjem", "bullshit detektor", "gap analysis"],
        canonical: baseUrl,
        ogImage: `${baseUrl}/og-image.jpg`,
        structuredData: generateFAQStructuredData(t)
      };

    case 'job-detail':
      return {
        title: `${data?.title || t('marketplace.detail')} | ${data?.company || ''} - ${t('seo.job_detail_suffix')}`,
        description: t('seo.job_detail_description', {
          title: data?.title,
          company: data?.company,
          salary: data?.salary || (t('financial.gross_monthly') + ' ' + t('common.unknown')),
          location: data?.location || t('common.unknown'),
          benefits: data?.benefits?.join(', ') || t('common.none')
        }),
        keywords: [data?.title, data?.company, data?.location, 'práce', 'nabídka', 'volné místo'],
        canonical: `${baseUrl}/jobs/${data?.id}`,
        ogImage: data?.logo || `${baseUrl}/og-image.jpg`,
        structuredData: generateJobPostingStructuredData(data)
      };

    case 'company-dashboard':
      return {
        title: t('seo.company_dashboard_title'),
        description: t('seo.company_dashboard_description'),
        keywords: ["nabídka práce", "nábor zaměstnanců", "HR software", "AI nábor", "práce Česko", "rekrutace"],
        canonical: `${baseUrl}/pro-firmy`
      };

    case 'marketplace':
      return {
        title: t('seo.marketplace_title'),
        description: t('seo.marketplace_description'),
        keywords: ["kurzy", "rekvalifikace", "školení", "vzdělávání", "online kurzy", "certifikace", "kariérní růst"],
        canonical: `${baseUrl}/kurzy-a-rekvalifikace`
      };

    case 'services':
      return {
        title: t('seo.services_title'),
        description: t('seo.services_description'),
        keywords: ["zakázky", "freelance", "služby", "experti", "spolupráce", "projekty"],
        canonical: `${baseUrl}/sluzby`
      };

    case 'freelancer-dashboard':
      return {
        title: t('seo.freelancer_dashboard_title'),
        description: t('seo.freelancer_dashboard_description'),
        keywords: ["freelancer", "profil", "služby", "portfolio", "zakázky"],
        canonical: `${baseUrl}/freelancer`
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
        keywords: ["profil", "moje účet", "uložené pozice", "personalizace", "kariéra"],
        canonical: `${baseUrl}/profil`
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
        description: t('seo.home_description'),
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

  return {
    "@context": "https://schema.org",
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
    "employmentType": job.contract_type || job.contractType || job.employmentType,
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.company,
      "sameAs": job.website,
      "logo": job.logo
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": job.location,
        "addressCountry": country
      }
    },
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
        "name": t('welcome.faq.q1'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('welcome.faq.a1')
        }
      },
      {
        "@type": "Question",
        "name": t('welcome.faq.q2'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('welcome.faq.a2')
        }
      },
      {
        "@type": "Question",
        "name": t('welcome.faq.q3'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('welcome.faq.a3')
        }
      },
      {
        "@type": "Question",
        "name": t('welcome.faq.q4'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('welcome.faq.a4')
        }
      },
      {
        "@type": "Question",
        "name": t('welcome.faq.q5'),
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('welcome.faq.a5')
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
    case 'services':
      return t('seo.ai_summary_services');
    case 'freelancer-dashboard':
      return t('seo.ai_summary_freelancer');
    case 'saved':
      return t('seo.ai_summary_saved');
    default:
      return t('seo.ai_summary_default');
  }
};
