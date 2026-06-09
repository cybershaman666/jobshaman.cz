import ApiService from './apiService';

export type KarmaRewardType =
  | 'candidate_slot'
  | 'profile_boost'
  | 'profile_highlight'
  | 'premium_insight'
  | 'early_feature_access';

export interface KarmaCatalogItem {
  rewardType: KarmaRewardType;
  cost: number;
  label: string;
}

export interface CompanyReferral {
  id: string;
  companyName: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  note?: string | null;
  status: 'submitted' | 'verified' | 'rejected' | 'converted';
  createdAt?: string | null;
}

export interface KarmaAccountSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  nextSlotCost: number;
  bonusSlotsAvailable: number;
  catalog: KarmaCatalogItem[];
  referrals: CompanyReferral[];
  transactions: Array<{
    id: string;
    direction: 'earn' | 'spend' | 'adjust';
    amount: number;
    reason: string;
    createdAt?: string | null;
  }>;
}

const fallbackSummary: KarmaAccountSummary = {
  balance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  nextSlotCost: 250,
  bonusSlotsAvailable: 0,
  catalog: [
    { rewardType: 'candidate_slot', cost: 250, label: 'Candidate slot' },
    { rewardType: 'profile_boost', cost: 150, label: 'Profile boost' },
    { rewardType: 'profile_highlight', cost: 200, label: 'Profile highlight' },
    { rewardType: 'premium_insight', cost: 120, label: 'Premium insight' },
    { rewardType: 'early_feature_access', cost: 300, label: 'Early feature access' },
  ],
  referrals: [],
  transactions: [],
};

const normalizeSummary = (raw: any): KarmaAccountSummary => ({
  ...fallbackSummary,
  ...(raw && typeof raw === 'object' ? raw : {}),
  balance: Number(raw?.balance || 0),
  lifetimeEarned: Number(raw?.lifetimeEarned || 0),
  lifetimeSpent: Number(raw?.lifetimeSpent || 0),
  nextSlotCost: Number(raw?.nextSlotCost || 250),
  bonusSlotsAvailable: Number(raw?.bonusSlotsAvailable || 0),
  catalog: Array.isArray(raw?.catalog) && raw.catalog.length ? raw.catalog : fallbackSummary.catalog,
  referrals: Array.isArray(raw?.referrals) ? raw.referrals : [],
  transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
});

export const fetchKarmaSummary = async (): Promise<KarmaAccountSummary> => {
  const response = await ApiService.get<{ status: string; data: any }>('/candidate/karma/me');
  return normalizeSummary(response?.data);
};

export const submitCompanyReferral = async (payload: {
  companyName: string;
  websiteUrl?: string;
  contactEmail?: string;
  note?: string;
}): Promise<CompanyReferral> => {
  const response = await ApiService.post<{ status: string; data: CompanyReferral }>('/candidate/referrals/company', payload);
  return response.data;
};

export const redeemKarmaReward = async (rewardType: KarmaRewardType): Promise<void> => {
  await ApiService.post('/candidate/karma/redeem', { rewardType });
};
