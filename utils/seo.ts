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
export const generateSEOMetadata = (page: string, data?: any): SEOMetadata => {
  const baseTitle = "JobShaman - Chytré nabídky práce v Česku";
  const baseUrl = "https://jobshaman.cz";

  switch (page) {
    case 'home':
      return {
        title: baseTitle,
        description: "Najděte si ideální práci s AI analýzou. JobShaman nabízí transparentní nabídky práce s reálnými platy, benefity a JHI skóre. Filtrujte podle lokalit, benefitů a firem.",
        keywords: ["nabídky práce", "jobs Česko", "AI analýza práce", "JHI skóre", "platy", "benefity", "práce Praha", "Brno", "Ostrava", "Plzeň"],
        canonical: baseUrl,
        ogImage: `${baseUrl}/og-image.jpg`
      };

    case 'job-detail':
      return {
        title: `${data?.title || 'Pracovní pozice'} | ${data?.company || ''} - JobShaman`,
        description: `Detail pracovní pozice ${data?.title} ve firmě ${data?.company}. Plat: ${data?.salary || 'Neuveden'}. Lokalita: ${data?.location || 'Neuvedena'}. Benefity: ${data?.benefits?.join(', ') || 'Neuvedeny'}.`,
        keywords: [data?.title, data?.company, data?.location, 'práce', 'nabídka', 'volné místo'],
        canonical: `${baseUrl}/job/${data?.id}`,
        ogImage: data?.logo || `${baseUrl}/og-image.jpg`,
        structuredData: generateJobPostingStructuredData(data)
      };

    case 'company-dashboard':
      return {
        title: "Pro Firmy - Publikujte nabídky | JobShaman",
        description: "Publikujte pracovní nabídky a analyzujte kandidáty s AI. JobShaman pro firmy - moderní nábor s transparentností a daty.",
        keywords: ["nabídka práce", "nábor zaměstnanců", "HR software", "AI nábor", "práce Česko", "rekrutace"],
        canonical: `${baseUrl}/pro-firmy`
      };

    case 'marketplace':
      return {
        title: "Kurzy & Rekvalifikace - JobShaman",
        description: "Objevte kurzy a rekvalifikace pro vaši kariéru. Online školení, certifikace a vzdělávací programy v Česku.",
        keywords: ["kurzy", "rekvalifikace", "školení", "vzdělávání", "online kurzy", "certifikace", "kariérní růst"],
        canonical: `${baseUrl}/kurzy-a-rekvalifikace`
      };

    case 'profile':
      return {
        title: "Můj Profil | JobShaman",
        description: "Spravujte svůj profil, uložené pozice a preferenční nastavení na JobShaman. Personalizované doporučení pracovních nabídek.",
        keywords: ["profil", "moje účet", "uložené pozice", "personalizace", "kariéra"],
        canonical: `${baseUrl}/profil`
      };

    default:
      return {
        title: baseTitle,
        description: "Najděte si ideální práci s AI analýzou v Česku. JobShaman nabízí transparentní nabídky práce s reálnými platy a benefity.",
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
export const generateAISummary = (page: string, data?: any): string => {
  switch (page) {
    case 'home':
      return "JobShaman je česká platforma pro hledání práce s AI analýzou. Nabízí transparentní pracovní nabídky s reálnými platy, benefity a unikátním JHI skóre. Umožňuje filtrování podle lokalit, benefitů a firemních hodnocení.";
    case 'job-detail':
      return `Detail pracovní pozice ${data?.title} ve firmě ${data?.company}. Nabídka ${data?.salary || 'plat neuveden'} v lokalitě ${data?.location || 'neuvedena'}. Benefity zahrnují: ${data?.benefits?.slice(0, 3).join(', ') || 'standardní balíček'}.`;
    case 'company-dashboard':
      return "JobShaman pro firmy umožňuje publikování pracovních nabídek, analýzu kandidátů pomocí AI a transparentní náborové procesy. Cílí na český trh práce.";
    default:
      return "JobShaman - moderní platforma pro hledání práce v Česku s AI analýzou a transparentností.";
  }
};