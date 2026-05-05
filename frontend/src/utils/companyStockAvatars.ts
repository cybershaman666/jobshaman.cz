export type StockCompanyAvatar = {
  key: string;
  label: string;
  url: string;
  industries: string[];
};

export const STOCK_COMPANY_AVATARS: StockCompanyAvatar[] = [
  { key: 'tech', label: 'Tech / SaaS', url: '/company-stock/tech.svg', industries: ['tech', 'software', 'saas', 'it'] },
  { key: 'health', label: 'Healthcare', url: '/company-stock/health.svg', industries: ['health', 'medical', 'pharma'] },
  { key: 'finance', label: 'Finance', url: '/company-stock/finance.svg', industries: ['finance', 'banking', 'insurance'] },
  { key: 'manufacturing', label: 'Manufacturing', url: '/company-stock/manufacturing.svg', industries: ['manufacturing', 'industry', 'factory'] },
  { key: 'construction', label: 'Construction', url: '/company-stock/construction.svg', industries: ['construction', 'building', 'real-estate'] },
  { key: 'hospitality', label: 'Hospitality', url: '/company-stock/hospitality.svg', industries: ['hospitality', 'hotel', 'travel', 'restaurant'] },
  { key: 'logistics', label: 'Logistics', url: '/company-stock/logistics.svg', industries: ['logistics', 'transport', 'supply'] },
  { key: 'education', label: 'Education', url: '/company-stock/education.svg', industries: ['education', 'school', 'training'] },
  { key: 'energy', label: 'Energy', url: '/company-stock/energy.svg', industries: ['energy', 'utilities', 'climate'] },
  { key: 'creative', label: 'Creative', url: '/company-stock/creative.svg', industries: ['creative', 'design', 'marketing', 'media'] }
];

const clampIndex = (value: number, length: number): number => {
  if (!Number.isFinite(value) || length <= 0) return 0;
  const raw = Math.abs(Math.floor(value));
  return raw % length;
};

const hashString = (value: string): number => {
  const input = String(value || '').trim();
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const getFallbackCompanyAvatarUrl = (companyName: string): string => {
  const idx = clampIndex(hashString(companyName), STOCK_COMPANY_AVATARS.length);
  return STOCK_COMPANY_AVATARS[idx]?.url || '/company-stock/tech.svg';
};

export const isStockCompanyAvatarUrl = (url: string | null | undefined): boolean => {
  const raw = String(url || '').trim();
  if (!raw) return false;
  return raw.startsWith('/company-stock/');
};

