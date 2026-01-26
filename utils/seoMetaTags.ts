/**
 * SEO Meta Tags Utility
 * Dynamically update page meta tags for SEO and AEO optimization
 */

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonical?: string;
  robots?: string;
  author?: string;
}

/**
 * Update page meta tags for SEO/AEO
 */
export function updatePageMetaTags(metadata: PageMetadata): void {
  // Title tag
  if (metadata.title) {
    document.title = metadata.title;
    updateOrCreateMetaTag('name', 'og:title', metadata.ogTitle || metadata.title);
    updateOrCreateMetaTag('name', 'twitter:title', metadata.twitterTitle || metadata.title);
  }

  // Description
  if (metadata.description) {
    updateOrCreateMetaTag('name', 'description', metadata.description);
    updateOrCreateMetaTag('property', 'og:description', metadata.ogDescription || metadata.description);
    updateOrCreateMetaTag('name', 'twitter:description', metadata.twitterDescription || metadata.description);
  }

  // Keywords
  if (metadata.keywords) {
    updateOrCreateMetaTag('name', 'keywords', metadata.keywords);
  }

  // Open Graph
  if (metadata.ogImage) {
    updateOrCreateMetaTag('property', 'og:image', metadata.ogImage);
  }

  if (metadata.ogUrl) {
    updateOrCreateMetaTag('property', 'og:url', metadata.ogUrl);
  }

  // Twitter Card
  if (metadata.twitterImage) {
    updateOrCreateMetaTag('name', 'twitter:image', metadata.twitterImage);
  }

  // Canonical URL
  if (metadata.canonical) {
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = metadata.canonical;
  }

  // Robots
  if (metadata.robots) {
    updateOrCreateMetaTag('name', 'robots', metadata.robots);
  }

  // Author
  if (metadata.author) {
    updateOrCreateMetaTag('name', 'author', metadata.author);
  }
}

/**
 * Helper function to update or create a meta tag
 */
function updateOrCreateMetaTag(
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string
): void {
  const selector = `meta[${attributeName}="${attributeValue}"]`;
  let tag = document.querySelector(selector) as HTMLMetaElement;

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(tag);
  }

  tag.content = content;
}

/**
 * Page metadata templates for JobShaman
 */
export const pageMetadataTemplates = {
  home: {
    title: 'JobShaman - Chytré nabídky práce v Česku | AI analýza & JHI skóre',
    description: 'Najděte si ideální práci s AI analýzou. JobShaman nabízí transparentní nabídky práce s reálnými platy, benefity a JHI skóre. Filtrujte podle lokalit, benefitů a firem.',
    keywords: 'nabídky práce, jobs Česko, AI analýza práce, JHI skóre, platy, benefity, práce Praha, Brno, Ostrava, práce na dálku, home office',
    ogTitle: 'JobShaman - Chytré nabídky práce v Česku',
    ogDescription: 'Najděte si ideální práci s AI analýzou. Transparentní nabídky s reálnými platy, benefity a unikátním JHI skóre.',
    ogImage: 'https://jobshaman.cz/og-image.jpg',
    twitterTitle: 'JobShaman - Chytré nabídky práce v Česku',
    twitterDescription: 'Najděte si ideální práci s AI analýzou a transparentností.',
  },
  jobs: {
    title: 'Nabídky práce - JobShaman | AI analýza pracovních pozic',
    description: 'Procházejte tisíce pracovních nabídek s AI analýzou. Každá pozice má JHI skóre (0-100), které ukazuje ideálnost pro vás. Filtrujte podle lokality, benefitů, sektoru a platu.',
    keywords: 'volná místa, pracovní nabídky, vyhledávání práce, AI analýza práce, pracovní pozice, kariérní možnosti, benefity zaměstnance',
    ogTitle: 'Nabídky práce s AI analýzou - JobShaman',
    ogDescription: 'Vyhledávejte pracovní nabídky s AI analýzou. Transparentní informace o platech, benefitech a podmínkách práce.',
    twitterTitle: 'Pracovní nabídky s AI - JobShaman',
  },
  companies: {
    title: 'Pro firmy - JobShaman | Publikujte nabídky a vybírejte kandidáty',
    description: 'JobShaman pomáhá firmám publikovat pracovní nabídky a vybírat kandidáty. Využijte AI analýzu, assessment centrum a transparentní komunikaci s uchazeči.',
    keywords: 'recruiting, nábor zaměstnanců, publikování nabídek, vyhledávání kandidátů, assessment centrum, HR technologie',
    ogTitle: 'Platforma pro nábor a recruiting - JobShaman',
    ogDescription: 'Publikujte pracovní nabídky a vybírejte kandidáty s AI technologií. Assessment centrum pro hodnocení uchazečů.',
    twitterTitle: 'Recruiting platforma - JobShaman',
  },
  pricing: {
    title: 'Ceny a tarify - JobShaman | Volné a placené plány',
    description: 'JobShaman je zdarma pro uchazeče. Firmy si mohou vybrat z několika tarifů: Premium (99 CZK/měsíc) pro základní nábor nebo Business (4,990 CZK/měsíc) pro pokročilé funkce.',
    keywords: 'ceny, tarify, billing, subscription, freemium, pricing plans, AI assessment',
    ogTitle: 'Ceny JobShaman - Pro všechny dostupné',
    ogDescription: 'Zdarma pro uchazeče. Pro firmy Premium a Business tarify. Průhledné ceny bez skrytých poplatků.',
    twitterTitle: 'Ceny a tarify - JobShaman',
  },
  assessmentCenter: {
    title: 'Assessment Centrum - JobShaman | Psychometrické testy a evaluace',
    description: 'Assessment centrum JobShaman nabízí psychometrické testy a evaluační nástroje pro firmy. Vybírejte nejlepší kandidáty pomocí vědeckých metod a AI analýzy.',
    keywords: 'assessment center, psychometrické testy, evaluace kandidátů, osobnostní profil, hodnocení dovedností, HR assessment',
    ogTitle: 'Assessment Centrum - Profesionální hodnocení kandidátů',
    ogDescription: 'Psychometrické testy a evaluace pro nábor. Vědecky podložené metody pro výběr nejlepších kandidátů.',
    twitterTitle: 'Assessment centrum s AI - JobShaman',
  },
  jhiScore: {
    title: 'JHI Skóre - JobShaman | Job Happiness Index',
    description: 'JHI (Job Happiness Index) je unikátní skóre od 0 do 100, které hodnotí pracovní nabídky na základě finanční ziskovosti, časových nákladů, duševní zátěže, možností růstu a hodnotové souladu.',
    keywords: 'JHI, Job Happiness Index, pracovní spokojenost, hodnocení nabídek, analýza práce, pracovní index',
    ogTitle: 'JHI - Job Happiness Index pro vaši kariéru',
    ogDescription: 'Unikátní skóre, které měří váš potenciální štěstí v dané pracovní pozici.',
    twitterTitle: 'JHI - Job Happiness Index',
  },
  courses: {
    title: 'Kurzy a rekvalifikace - JobShaman | Celoživotní vzdělání',
    description: 'Zvyšte si kvalifikaci s kurzy a programy rekvalifikace na JobShaman Marketplace. Přístup k profesionálnímu vzdělání a rozvoji kariéry.',
    keywords: 'kurzy, školení, rekvalifikace, vzdělání, profesionální rozvoj, online learning, cerifikáty',
    ogTitle: 'Kurzy a vzdělání - JobShaman Marketplace',
    ogDescription: 'Kurzy, školení a programy rekvalifikace pro profesionální rozvoj.',
    twitterTitle: 'Kurzy a rekvalifikace - JobShaman',
  },
  about: {
    title: 'O nás - JobShaman | O naší misi a vidění',
    description: 'JobShaman je inovativní platforma pro inteligentní vyhledávání práce. Naší misí je přinést transparentnost na trh práce v Česku pomocí umělé inteligence.',
    keywords: 'o nás, JobShaman, mapa webu, naše mise, vize, tým, kontakt',
    ogTitle: 'O JobShaman - Transparentnost v trhu práce',
    ogDescription: 'Poznamenejte si naši misi: inteligentní a transparentní vyhledávání práce pro všechny.',
    twitterTitle: 'O nás - JobShaman',
  },
  faq: {
    title: 'Často kladené otázky - JobShaman | FAQ',
    description: 'Odpovědi na nejčastější otázky o JobShaman. Jak funguje JHI skóre, jak se přihlásit, jak funguje assessment centrum, jak se registrovat jako firma.',
    keywords: 'FAQ, otázky a odpovědi, help, podpora, jak na to, průvodce',
    ogTitle: 'Často kladené otázky - JobShaman',
    ogDescription: 'Najděte si odpověď na svou otázku. Kompletní FAQ pro uchazeče i firmy.',
    twitterTitle: 'FAQ - JobShaman',
  },
};

/**
 * Get metadata for a specific page
 */
export function getPageMetadata(pageName: keyof typeof pageMetadataTemplates): PageMetadata {
  const template = pageMetadataTemplates[pageName];
  return {
    ...template,
    canonical: `https://jobshaman.cz/${pageName === 'home' ? '' : pageName}`,
    robots: 'index, follow',
    author: 'JobShaman',
    ogUrl: `https://jobshaman.cz/${pageName === 'home' ? '' : pageName}`,
    ogImage: 'https://jobshaman.cz/og-image.jpg',
    twitterImage: 'https://jobshaman.cz/og-image.jpg',
  };
}
