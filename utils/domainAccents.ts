import type { CandidateDomainKey, Job } from '../types';

type DomainAccent = {
  key: CandidateDomainKey;
  rgb: string; // "r, g, b"
  hex: string;
  label: { cs: string; en: string };
};

const DOMAIN_ACCENTS: Record<CandidateDomainKey, DomainAccent> = {
  agriculture: { key: 'agriculture', rgb: '34, 197, 94', hex: '#22c55e', label: { cs: 'Zemědělství', en: 'Agriculture' } },
  ai_data: { key: 'ai_data', rgb: '139, 92, 246', hex: '#8b5cf6', label: { cs: 'AI & Data', en: 'AI & Data' } },
  aviation: { key: 'aviation', rgb: '14, 165, 233', hex: '#0ea5e9', label: { cs: 'Letectví', en: 'Aviation' } },
  automotive: { key: 'automotive', rgb: '239, 68, 68', hex: '#ef4444', label: { cs: 'Automotive', en: 'Automotive' } },
  construction: { key: 'construction', rgb: '180, 83, 9', hex: '#b45309', label: { cs: 'Stavebnictví', en: 'Construction' } },
  creative_media: { key: 'creative_media', rgb: '236, 72, 153', hex: '#ec4899', label: { cs: 'Média & Kreativa', en: 'Creative & Media' } },
  customer_support: { key: 'customer_support', rgb: '56, 189, 248', hex: '#38bdf8', label: { cs: 'Podpora', en: 'Support' } },
  ecommerce: { key: 'ecommerce', rgb: '16, 185, 129', hex: '#10b981', label: { cs: 'E-commerce', en: 'E-commerce' } },
  education: { key: 'education', rgb: '6, 182, 212', hex: '#06b6d4', label: { cs: 'Vzdělávání', en: 'Education' } },
  energy_utilities: { key: 'energy_utilities', rgb: '234, 179, 8', hex: '#eab308', label: { cs: 'Energetika', en: 'Energy' } },
  engineering: { key: 'engineering', rgb: '59, 130, 246', hex: '#3b82f6', label: { cs: 'Inženýring', en: 'Engineering' } },
  finance: { key: 'finance', rgb: '245, 158, 11', hex: '#f59e0b', label: { cs: 'Finance', en: 'Finance' } },
  government_defense: { key: 'government_defense', rgb: '71, 85, 105', hex: '#475569', label: { cs: 'Stát & Obrana', en: 'Gov & Defense' } },
  healthcare: { key: 'healthcare', rgb: '244, 63, 94', hex: '#f43f5e', label: { cs: 'Zdravotnictví', en: 'Healthcare' } },
  hospitality: { key: 'hospitality', rgb: '244, 114, 182', hex: '#f472b6', label: { cs: 'Pohostinství', en: 'Hospitality' } },
  insurance: { key: 'insurance', rgb: '79, 70, 229', hex: '#4f46e5', label: { cs: 'Pojišťovnictví', en: 'Insurance' } },
  it: { key: 'it', rgb: '34, 211, 238', hex: '#22d3ee', label: { cs: 'IT', en: 'IT' } },
  logistics: { key: 'logistics', rgb: '168, 85, 247', hex: '#a855f7', label: { cs: 'Logistika', en: 'Logistics' } },
  manufacturing: { key: 'manufacturing', rgb: '251, 146, 60', hex: '#fb923c', label: { cs: 'Výroba', en: 'Manufacturing' } },
  maritime: { key: 'maritime', rgb: '2, 132, 199', hex: '#0284c7', label: { cs: 'Námořní', en: 'Maritime' } },
  marketing: { key: 'marketing', rgb: '249, 115, 22', hex: '#f97316', label: { cs: 'Marketing', en: 'Marketing' } },
  media_design: { key: 'media_design', rgb: '219, 39, 119', hex: '#db2777', label: { cs: 'Design', en: 'Design' } },
  mining_heavy_industry: { key: 'mining_heavy_industry', rgb: '67, 56, 202', hex: '#4338ca', label: { cs: 'Těžký průmysl', en: 'Heavy Industry' } },
  operations: { key: 'operations', rgb: '6, 182, 212', hex: '#06b6d4', label: { cs: 'Operace', en: 'Operations' } },
  pharma_biotech: { key: 'pharma_biotech', rgb: '20, 184, 166', hex: '#14b8a6', label: { cs: 'Farma & Bio', en: 'Pharma' } },
  procurement: { key: 'procurement', rgb: '20, 184, 166', hex: '#14b8a6', label: { cs: 'Nákup', en: 'Procurement' } },
  product_management: { key: 'product_management', rgb: '99, 102, 241', hex: '#6366f1', label: { cs: 'Produkt', en: 'Product' } },
  public_services: { key: 'public_services', rgb: '14, 165, 233', hex: '#0ea5e9', label: { cs: 'Veřejné služby', en: 'Public Services' } },
  real_estate: { key: 'real_estate', rgb: '101, 163, 13', hex: '#65a30d', label: { cs: 'Reality', en: 'Real Estate' } },
  retail: { key: 'retail', rgb: '236, 72, 153', hex: '#ec4899', label: { cs: 'Retail', en: 'Retail' } },
  sales: { key: 'sales', rgb: '244, 63, 94', hex: '#f43f5e', label: { cs: 'Obchod', en: 'Sales' } },
  science_lab: { key: 'science_lab', rgb: '20, 184, 166', hex: '#14b8a6', label: { cs: 'Věda & Laboratoř', en: 'Science' } },
  security: { key: 'security', rgb: '220, 38, 38', hex: '#dc2626', label: { cs: 'Bezpečnost', en: 'Security' } },
  telecom_network: { key: 'telecom_network', rgb: '79, 70, 229', hex: '#4f46e5', label: { cs: 'Telekomunikace', en: 'Telecom' } },
};

export const getPrimaryJobDomain = (job: Job): CandidateDomainKey | null => {
  const inferred = (job.inferredDomain || null) as CandidateDomainKey | null;
  if (inferred) {
    if (job.inferredDomainSource === 'title_override') return inferred;
    if (job.inferredDomainConfidence == null && job.inferredDomainScoreGap == null && !job.inferredDomainSource) {
      return inferred;
    }
    const confidence = Number(job.inferredDomainConfidence ?? 0);
    const gap = Number(job.inferredDomainScoreGap ?? 0);
    if (confidence >= 0.55 && gap >= 6) return inferred;
    return null;
  }
  const matched = Array.isArray(job.matchedDomains) ? job.matchedDomains[0] : null;
  return (matched || null) as CandidateDomainKey | null;
};

export const resolveJobDomain = (job: Job): CandidateDomainKey | null => {
  const primary = getPrimaryJobDomain(job);
  if (primary) return primary;

  const title = String(job.title || '').toLowerCase();
  const company = String(job.company || '').toLowerCase();
  const combined = `${title} ${company}`;

  const hasAny = (...patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(combined));

  if (hasAny(/\bstaveb\w*/i, /\brozpo[cč]t[aá]ř\w*/i, /\bstavby?\b/i, /\bconstruction\b/i)) return 'construction';
  if (hasAny(/\bautomotive\b/i, /\bautomechanik\b/i, /\bauto mechanik\b/i, /\bautoservis\b/i, /\bservis vozidel\b/i, /\bmechanik vozidel\b/i, /\bautotechnik\b/i, /\bkfz\b/i, /\bcar service\b/i, /\bvehicle service\b/i, /\bdealership\b/i, /\bcar dealer\b/i)) return 'automotive';
  if (hasAny(/\bobchod\w*/i, /\bsales\b/i, /\bbroker\b/i, /\baccount manager\b/i)) return 'sales';
  if (hasAny(/\bit\b/i, /\bk[oó]d\w*/i, /\bv[yý]voj\w*/i, /\bsoftware\b/i, /\bdeveloper\b/i, /\bprogram[aá]tor\b/i, /\bengineer\b/i, /\bfrontend\b/i, /\bbackend\b/i, /\bfullstack\b/i)) return 'it';
  if (hasAny(/\bfinance\b/i, /\b[uú]čet\w*/i, /\baudit\b/i, /\bekonom\w*/i, /\bcontroller\b/i)) return 'finance';
  if (hasAny(/\bmarketing\b/i, /\breklam\w*/i, /\bmedia\b/i, /\bseo\b/i, /\bppc\b/i, /\bbrand\b/i)) return 'marketing';
  if (hasAny(/\b[řr]idi[čc]\b/i, /\bkur[ýy]r\b/i, /\bkurier\b/i, /\brozvoz\b/i, /\bdelivery\b/i, /\bsklad\w*/i, /\blogistik\w*/i, /\btruck\b/i, /\bdriver\b/i, /\bdispatch\b/i)) return 'logistics';
  if (hasAny(/\bv[ýy]rob\w*/i, /\bd[ěe]ln[ií]k\w*/i, /\bmistr\b/i, /\bmanufacturing\b/i, /\bmont[aá]ž\w*/i, /\boperator v[ýy]rob\w*/i)) return 'manufacturing';
  if (hasAny(/\bzdrav\w*/i, /\bsestra\b/i, /\bmedic\w*/i, /\bdoctor\b/i, /\bl[eé]ka[řr]\w*/i)) return 'healthcare';
  if (hasAny(/\bhotel\b/i, /\brecept\w*/i, /\bgastron\w*/i, /\brestaurant\b/i, /\bkucha[řr]\w*/i, /\b[čc]i[šs]n[ií]k\w*/i, /\bbarista\b/i)) return 'hospitality';
  if (hasAny(/\bzak[aá]z\w*/i, /\bsupport\b/i, /\bpodpora\b/i, /\bcustomer\b/i, /\bhelpdesk\b/i)) return 'customer_support';
  if (hasAny(/\bdata\b/i, /\bai\b/i, /\banalyt\w*/i, /\bmachine learning\b/i)) return 'ai_data';
  if (hasAny(/\bagric\w*/i, /\bzem[eě]d\w*/i, /\bfarma\b/i)) return 'agriculture';
  if (hasAny(/\benerget\w*/i, /\bsolar\b/i, /\bfve\b/i)) return 'energy_utilities';
  if (hasAny(/\breality\b/i, /\breal estate\b/i, /\bmakler\w*/i)) return 'real_estate';
  if (hasAny(/\bn[aá]kup\b/i, /\bprocurement\b/i, /\bbuyer\b/i, /\bsourcing\b/i)) return 'procurement';
  if (hasAny(/\boperativ\w*/i, /\boperations\b/i, /\bprovoz\b/i)) return 'operations';
  if (hasAny(/\bin[žz]en[ýy]r\w*/i, /\bengineering\b/i, /\bmechanik\b/i, /\btechnik\b/i)) return 'engineering';
  if (hasAny(/\bproduct\b/i, /\bprodukt\w*/i, /\bproduct owner\b/i, /\bproduct manager\b/i)) return 'product_management';
  if (hasAny(/\bretail\b/i, /\bprodejna\b/i, /\bshop\b/i)) return 'retail';
  return null;
};

export const getDomainAccent = (domain: CandidateDomainKey | null | undefined): DomainAccent | null => {
  if (!domain) return null;
  return DOMAIN_ACCENTS[domain] || null;
};
