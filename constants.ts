
import { Job, Candidate, BenefitInsight, CompanyProfile, UserProfile } from './types';

// Backend API Configuration
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://jobshaman-cz.onrender.com';
export const SEARCH_BACKEND_URL = import.meta.env.VITE_SEARCH_BACKEND_URL || BACKEND_URL;

// EMPTY - Using Live Supabase Data
export const MOCK_JOBS: Job[] = [];

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c1',
    name: 'Jana K.',
    role: 'Senior React Dev',
    experienceYears: 6,
    salaryExpectation: 130000,
    skills: ['React', 'TypeScript', 'Node.js', 'AWS'],
    bio: 'Zkušená vývojářka, která preferuje stabilitu a čistý kód před startupovým chaosem.',
    flightRisk: 'Low',
    values: ['Stabilita', 'Kvalita kódu', 'Work-Life Balance']
  },
  {
    id: 'c2',
    name: 'Petr S.',
    role: 'Fullstack Engineer',
    experienceYears: 2,
    salaryExpectation: 80000,
    skills: ['JavaScript', 'Vue.js', 'Firebase'],
    bio: 'Rychle se učím, hledám mentora. Ochotný pracovat přesčas za equity.',
    flightRisk: 'High', // Job hopper potential
    values: ['Rychlý růst', 'Peníze', 'Nové technologie']
  },
  {
    id: 'c3',
    name: 'Martin V.',
    role: 'Tech Lead',
    experienceYears: 12,
    salaryExpectation: 160000,
    skills: ['System Design', 'Team Leadership', 'Java', 'Kotlin'],
    bio: 'Bývalý CTO malého startupu. Hledám roli, kde mohu stavět tým od nuly.',
    flightRisk: 'Medium',
    values: ['Vliv', 'Autonomie', 'Vize']
  }
];

export const MOCK_COMPANY_PROFILE: CompanyProfile = {
  id: 'mock_company_id',
  name: "Naše Firma s.r.o.",
  industry: "Technology",
  tone: "Professional but friendly",
  values: ["Transparentnost", "Work-Life Balance", "Kvalita nad kvantitu"],
  philosophy: "Věříme, že spokojení zaměstnanci dělají nejlepší produkty. Neslibujeme nemožné, ale garantujeme férovost."
};

export const MOCK_BENEFIT_STATS: BenefitInsight[] = [
  {
    name: "Remote First / Full Remote",
    category: "Lifestyle",
    popularityScore: 98,
    marketAdoption: 15,
    impactOnRetention: "High"
  },
  {
    name: "4-denní pracovní týden",
    category: "Lifestyle",
    popularityScore: 95,
    marketAdoption: 2,
    impactOnRetention: "High"
  },
  {
    name: "Flexibilní začátek/konec doby",
    category: "Lifestyle",
    popularityScore: 90,
    marketAdoption: 60,
    impactOnRetention: "Medium"
  },
  {
    name: "Zaměstnanecké akcie",
    category: "Financial",
    popularityScore: 85,
    marketAdoption: 10,
    impactOnRetention: "High"
  },
  {
    name: "Placené volno nad rámec zákona (Sick days, 6. týden)",
    category: "Health",
    popularityScore: 80,
    marketAdoption: 40,
    impactOnRetention: "Medium"
  },
  {
    name: "Rozpočet na vzdělávání",
    category: "Growth",
    popularityScore: 75,
    marketAdoption: 30,
    impactOnRetention: "Medium"
  },
  {
    name: "MultiSport Karta",
    category: "Health",
    popularityScore: 60,
    marketAdoption: 70,
    impactOnRetention: "Low"
  },
  {
    name: "Pizza days / Ovoce v kanclu",
    category: "Lifestyle",
    popularityScore: 20,
    marketAdoption: 80,
    impactOnRetention: "Low"
  }
];

export const JHI_COLORS = {
  high: '#059669', // Emerald 600
  medium: '#d97706', // Amber 600
  low: '#dc2626' // Red 600
};

// Default user profile
export const DEFAULT_USER_PROFILE: UserProfile = {
  isLoggedIn: false,
  name: '',
  email: '',
  address: '',
  transportMode: 'public',
  preferences: {
    workLifeBalance: 50,
    financialGoals: 50,
    commuteTolerance: 45,
    priorities: []
  }
};
