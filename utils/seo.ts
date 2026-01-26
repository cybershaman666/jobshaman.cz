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
        title: baseTitle,
        description: t('seo.home_description'),
        keywords: ["nabídky práce", "jobs Česko", "AI analýza práce", "JHI skóre", "platy", "benefity", "práce Praha", "Brno", "Ostrava", "Plzeň"],
        canonical: baseUrl,
        ogImage: `${baseUrl}/og-image.jpg`
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
        canonical: `${baseUrl}/job/${data?.id}`,
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

    case 'profile':
      return {
        title: t('seo.profile_title'),
        description: t('seo.profile_description'),
        keywords: ["profil", "moje účet", "uložené pozice", "personalizace", "kariéra"],
        canonical: `${baseUrl}/profil`
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
    "datePosted": job.postedAt,
    "validThrough": job.validUntil,
    "employmentType": job.contractType,
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
        "addressCountry": "CZ"
      }
    },
    "baseSalary": job.salary ? {
      "@type": "MonetaryAmount",
      "currency": job.salary.currency || "CZK",
      "value": {
        "@type": "QuantitativeValue",
        "minValue": job.salary.min,
        "maxValue": job.salary.max,
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

// Generate FAQ structured data
export const generateFAQStructuredData = () => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Jak funguje JHI skóre?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "JHI (Job Happiness Index) je unikátní skóre 0-100, které hodnotí pracovní nabídky z pohledu finanční ziskovosti, časových nákladů, duševní zátěže, možností růstu a hodnotových hodnocení."
        }
      },
      {
        "@type": "Question",
        "name": "Je JobShaman zdarma?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Ano, JobShaman je zcela zdarma pro uchazeče. Firmy mohou využít placené služby pro publikování pracovních nabídek a analýzu."
        }
      },
      {
        "@type": "Question",
        "name": "Jaké benefity analyzujete?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Analyzujeme přes 40 typů benefitů včetně zaměstnaneckých akcií, firemních aut, příspěvků na stravu, multisport karet, kurzů a dalšího. Vše převedeme na peněžní hodnotu."
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
  const languages = ['cs', 'en', 'de', 'pl', 'sk'];
  const currentUrl = window.location.href.split('?')[0];

  languages.forEach(lang => {
    let link = document.querySelector(`link[hreflang="${lang}"]`) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang;
      document.head.appendChild(link);
    }
    // Simple implementation: append lang as param
    link.href = `${currentUrl}?lng=${lang}`;
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

  // Twitter Card
  updateMeta('twitter:card', 'summary_large_image');
  updateMeta('twitter:title', metadata.title);
  updateMeta('twitter:description', metadata.description);
  updateMeta('twitter:image', metadata.ogImage || '');

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
    case 'company-dashboard':
      return t('seo.ai_summary_company');
    default:
      return t('seo.ai_summary_default');
  }
};