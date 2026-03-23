import { jest } from '@jest/globals';

jest.mock('../shared/candidate_intent_taxonomy.json', () => ({
  default: {
    version: 'candidate-intent-v1',
    domains: {
      product_management: {
        labels: { cs: 'Product management', sk: 'Product management', en: 'Product management', de: 'Produktmanagement', pl: 'Product management' },
        keywords: ['product manager', 'product owner', 'prototype', 'systems design'],
        related: ['operations', 'marketing', 'customer_support', 'sales'],
      },
      hospitality: {
        labels: { cs: 'Gastro a hospitality', sk: 'Gastro a hospitality', en: 'Hospitality', de: 'Hotellerie & Gastro', pl: 'Hospitality i gastro' },
        keywords: ['hotel', 'reception', 'housekeeping', 'guest', 'hospitality', 'recepcni', 'waiter', 'cisnik'],
        related: ['operations', 'customer_support', 'retail'],
      },
      customer_support: {
        labels: { cs: 'Zákaznická péče', sk: 'Zákaznícka podpora', en: 'Customer support', de: 'Kundenservice', pl: 'Obsługa klienta' },
        keywords: ['customer support', 'support specialist', 'helpdesk', 'customer success'],
        related: ['sales', 'operations', 'hospitality', 'retail'],
      },
      operations: {
        labels: { cs: 'Provoz a operations', sk: 'Prevádzka a operations', en: 'Operations', de: 'Operations', pl: 'Operacje' },
        keywords: ['operations', 'project manager', 'provoz', 'process manager', 'delivery lead', 'office manager'],
        related: ['product_management', 'logistics', 'customer_support', 'sales'],
      },
      sales: {
        labels: { cs: 'Obchod', sk: 'Obchod', en: 'Sales', de: 'Vertrieb', pl: 'Sprzedaż' },
        keywords: ['sales', 'account executive', 'business development'],
        related: ['marketing', 'customer_support', 'operations', 'retail'],
      },
      marketing: {
        labels: { cs: 'Marketing', sk: 'Marketing', en: 'Marketing', de: 'Marketing', pl: 'Marketing' },
        keywords: ['marketing', 'content', 'seo', 'campaign'],
        related: ['sales', 'product_management', 'customer_support'],
      },
      finance: {
        labels: { cs: 'Finance a účetnictví', sk: 'Financie a účtovníctvo', en: 'Finance & accounting', de: 'Finanzen & Buchhaltung', pl: 'Finanse i księgowość' },
        keywords: ['finance', 'accountant', 'controller'],
        related: ['operations', 'sales'],
      },
      it: {
        labels: { cs: 'IT a software', sk: 'IT a software', en: 'IT & software', de: 'IT & Software', pl: 'IT i software' },
        keywords: ['developer', 'engineer', 'software', 'backend', 'frontend', 'react', 'python', 'prototype', 'electronics', 'hardware'],
        related: ['engineering', 'product_management', 'customer_support'],
      },
      engineering: {
        labels: { cs: 'Technika a inženýring', sk: 'Technika a inžiniering', en: 'Engineering', de: 'Ingenieurwesen', pl: 'Inżynieria' },
        keywords: ['engineer', 'mechanical', 'electrical', 'technik', 'automechanik', 'prototype', 'electronics', 'hardware', 'maker'],
        related: ['manufacturing', 'it', 'operations'],
      },
      healthcare: {
        labels: { cs: 'Zdravotnictví a péče', sk: 'Zdravotníctvo a starostlivosť', en: 'Healthcare & care', de: 'Gesundheit & Pflege', pl: 'Zdrowie i opieka' },
        keywords: ['nurse', 'medical', 'healthcare', 'sestra', 'ambulance'],
        related: ['education', 'hospitality'],
      },
      education: {
        labels: { cs: 'Vzdělávání', sk: 'Vzdelávanie', en: 'Education', de: 'Bildung', pl: 'Edukacja' },
        keywords: ['teacher', 'trainer', 'education', 'ucitel'],
        related: ['healthcare', 'operations', 'customer_support'],
      },
      logistics: {
        labels: { cs: 'Logistika a doprava', sk: 'Logistika a doprava', en: 'Logistics', de: 'Logistik', pl: 'Logistyka' },
        keywords: ['logistics', 'warehouse', 'driver', 'ridic', 'sklad'],
        related: ['operations', 'manufacturing', 'retail'],
      },
      manufacturing: {
        labels: { cs: 'Výroba', sk: 'Výroba', en: 'Manufacturing', de: 'Produktion', pl: 'Produkcja' },
        keywords: ['production', 'operator', 'assembly', 'manufacturing', 'vyroba'],
        related: ['engineering', 'logistics', 'operations'],
      },
      retail: {
        labels: { cs: 'Retail a provoz prodeje', sk: 'Retail a prevádzka predaja', en: 'Retail', de: 'Einzelhandel', pl: 'Retail' },
        keywords: ['retail', 'store', 'cashier', 'shop assistant', 'prodejna', 'pokladni'],
        related: ['sales', 'hospitality', 'customer_support', 'logistics'],
      },
    },
  },
}));

import { annotateJobsForCandidate, computeCandidateAnnotations, sortJobsForDiscovery } from './candidateIntentService';
import type { Job, UserProfile } from '../types';

const baseJob = (overrides: Partial<Job>): Job => ({
  id: 'job-1',
  title: 'Generic Role',
  company: 'Acme',
  location: 'Prague',
  type: 'Hybrid',
  description: 'General job description',
  postedAt: '2026-03-01T00:00:00.000Z',
  scrapedAt: '2026-03-01T00:00:00.000Z',
  source: 'native',
  jhi: {
    score: 40,
    baseScore: 40,
    personalizedScore: 40,
    financial: 0,
    timeCost: 0,
    mentalLoad: 0,
    growth: 0,
    values: 0,
    explanations: [],
  },
  noiseMetrics: {} as Job['noiseMetrics'],
  transparency: {} as Job['transparency'],
  market: {} as Job['market'],
  tags: [],
  benefits: [],
  required_skills: [],
  ...overrides,
});

const candidateProfile = {
  isLoggedIn: true,
  preferences: {
    searchProfile: {
      primaryDomain: 'it',
      targetRole: 'Backend Engineer',
      includeAdjacentDomains: true,
    },
  },
  jhiPreferences: {},
  taxProfile: { countryCode: 'CZ' },
} as unknown as UserProfile;

describe('candidate intent discovery helpers', () => {
  test('computeCandidateAnnotations preserves incoming order for manual modes', () => {
    const jobs = [
      baseJob({ id: 'sales', title: 'Sales Manager', description: 'Account growth and pipeline ownership.' }),
      baseJob({ id: 'backend', title: 'Backend Engineer', description: 'Backend engineer building APIs in Node.js.' }),
    ];

    const annotated = computeCandidateAnnotations(jobs, candidateProfile, 'en');

    expect(annotated.map((job) => job.id)).toEqual(['sales', 'backend']);
    expect(annotated[1].searchDiagnostics?.profileBoost).toBeGreaterThan(
      annotated[0].searchDiagnostics?.profileBoost || 0
    );
  });

  test('sortJobsForDiscovery reorders annotated jobs by discovery priority', () => {
    const annotated = computeCandidateAnnotations([
      baseJob({ id: 'sales', title: 'Sales Manager', description: 'Account growth and pipeline ownership.' }),
      baseJob({ id: 'backend', title: 'Backend Engineer', description: 'Backend engineer building APIs in Node.js.' }),
    ], candidateProfile, 'en');

    const sorted = sortJobsForDiscovery(annotated);

    expect(sorted[0].id).toBe('backend');
    expect(sorted[1].id).toBe('sales');
  });

  test('annotateJobsForCandidate remains the discovery-mode composition helper', () => {
    const jobs = [
      baseJob({ id: 'sales', title: 'Sales Manager', description: 'Account growth and pipeline ownership.' }),
      baseJob({ id: 'backend', title: 'Backend Engineer', description: 'Backend engineer building APIs in Node.js.' }),
    ];

    const annotated = annotateJobsForCandidate(jobs, candidateProfile, 'en');
    const recomposed = sortJobsForDiscovery(computeCandidateAnnotations(jobs, candidateProfile, 'en'));

    expect(annotated.map((job) => job.id)).toEqual(recomposed.map((job) => job.id));
  });

  test('domain inference prefers strong title signals (CZ)', () => {
    const jobs = [
      baseJob({ id: 'mechanic', title: 'Automechanik', description: 'Servis a údržba vozidel.' }),
      baseJob({ id: 'nurse', title: 'Zdravotní sestra', description: 'Ambulance, péče o pacienty.' }),
      baseJob({ id: 'pm', title: 'Manažer developerských projektů', description: 'Project manager pro výstavbu.' }),
    ];

    const annotated = computeCandidateAnnotations(jobs, candidateProfile, 'cs');
    const byId = new Map(annotated.map((job) => [job.id, job]));

    expect(byId.get('mechanic')?.inferredDomain).toBe('engineering');
    expect(byId.get('nurse')?.inferredDomain).toBe('healthcare');
    expect(byId.get('pm')?.inferredDomain).toBe('operations');
  });

  test('explicit senior product role outranks frontline hospitality mismatch even when profile domain is hospitality', () => {
    const profile = {
      ...candidateProfile,
      address: 'Brno',
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          primaryDomain: 'hospitality',
          targetRole: 'Product Manager | AI Systems Architect | Operations Specialist',
          seniority: 'senior',
          includeAdjacentDomains: true,
        },
      },
    } as unknown as UserProfile;

    const jobs = [
      baseJob({
        id: 'waiter-prague',
        title: 'Číšník / servírka v hotelu',
        location: 'Praha',
        description: 'Obsluha hostů v hotelové restauraci.',
        jhi: { ...baseJob({}).jhi!, score: 82 },
      }),
      baseJob({
        id: 'pm-brno',
        title: 'Senior Product Manager pro AI platformu',
        location: 'Brno',
        description: 'Vedení produktu, AI systems, operations orchestration.',
        jhi: { ...baseJob({}).jhi!, score: 71 },
      }),
    ];

    const sorted = annotateJobsForCandidate(jobs, profile, 'cs');

    expect(sorted[0].id).toBe('pm-brno');
    expect(sorted[1].id).toBe('waiter-prague');
    expect((sorted[0].priorityScore || 0)).toBeGreaterThan(sorted[1].priorityScore || 0);
  });

  test('fallback city distance penalizes far-off non-remote jobs when distanceKm is missing', () => {
    const profile = {
      ...candidateProfile,
      address: 'Brno',
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          primaryDomain: 'operations',
          targetRole: 'Operations Specialist',
          seniority: 'senior',
          includeAdjacentDomains: true,
        },
      },
    } as unknown as UserProfile;

    const annotated = computeCandidateAnnotations([
      baseJob({ id: 'near', title: 'Operations Specialist', location: 'Brno', description: 'Operations specialist role.' }),
      baseJob({ id: 'far', title: 'Operations Specialist', location: 'Praha', description: 'Operations specialist role.' }),
    ], profile, 'cs');

    const byId = new Map(annotated.map((job) => [job.id, job]));
    expect((byId.get('near')?.priorityScore || 0)).toBeGreaterThan(byId.get('far')?.priorityScore || 0);
  });

  test('explicit knowledge-role target strongly downranks manual manufacturing roles and removes misleading match reasons', () => {
    const profile = {
      ...candidateProfile,
      address: 'Břeclav',
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          primaryDomain: 'hospitality',
          targetRole: 'Product Manager | AI Systems Architect | Operations Specialist',
          seniority: 'senior',
          includeAdjacentDomains: true,
        },
      },
    } as unknown as UserProfile;

    const annotated = annotateJobsForCandidate([
      baseJob({
        id: 'manual',
        title: 'Montážní dělník/ce',
        location: 'Břeclav',
        description: 'Výroba kabelových svazků a obsluha výrobních pracovišť.',
        distanceKm: 14,
        jhi: { ...baseJob({}).jhi!, score: 84 },
      }),
      baseJob({
        id: 'pm',
        title: 'Senior Product Manager pro AI orchestration',
        location: 'Brno',
        description: 'Product leadership, AI systems architecture, operations design.',
        distanceKm: 48,
        jhi: { ...baseJob({}).jhi!, score: 68 },
      }),
    ], profile, 'cs');

    const manual = annotated.find((job) => job.id === 'manual');
    const pm = annotated.find((job) => job.id === 'pm');

    expect(annotated[0].id).toBe('pm');
    expect((pm?.priorityScore || 0)).toBeGreaterThan(manual?.priorityScore || 0);
    expect(manual?.matchReasons || []).not.toContain('Výroba');
    expect(manual?.matchBucket).toBe('broader');
  });

  test('avoid domains in search profile hard-penalize unwanted directions', () => {
    const profile = {
      ...candidateProfile,
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          primaryDomain: 'product_management',
          targetRole: 'Product Manager',
          seniority: 'senior',
          includeAdjacentDomains: true,
          avoidDomains: ['manufacturing', 'hospitality'],
        },
      },
    } as unknown as UserProfile;

    const annotated = annotateJobsForCandidate([
      baseJob({
        id: 'manufacturing',
        title: 'Montážní dělník/ce',
        description: 'Výroba kabelových svazků a obsluha linky.',
        location: 'Brno',
      }),
      baseJob({
        id: 'product',
        title: 'Senior Product Manager',
        description: 'Discovery, roadmap, product operations, AI platform.',
        location: 'Brno',
      }),
    ], profile, 'cs');

    expect(annotated[0].id).toBe('product');
    expect(annotated[1].id).toBe('manufacturing');
    expect(annotated[1].matchBucket).toBe('broader');
  });

  test('missing heavy-driver qualification prevents unrelated driver jobs from surfacing as strong matches', () => {
    const profile = {
      ...candidateProfile,
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          primaryDomain: 'product_management',
          targetRole: 'Product Manager | AI Systems Architect | Operations Specialist',
          seniority: 'senior',
          includeAdjacentDomains: true,
        },
      },
      skills: ['product discovery', 'operations design', 'AI systems'],
      cvText: 'Senior product and operations background. No driving license details.',
    } as unknown as UserProfile;

    const annotated = annotateJobsForCandidate([
      baseJob({
        id: 'driver-c',
        title: 'Řidič sk. C',
        description: 'Řidičský průkaz skupiny C, profesní průkaz a rozvoz.',
        location: 'Brno',
      }),
      baseJob({
        id: 'ops',
        title: 'Operations Specialist',
        description: 'Operations design, process orchestration, stakeholder management.',
        location: 'Brno',
      }),
    ], profile, 'cs');

    expect(annotated[0].id).toBe('ops');
    expect(annotated[1].id).toBe('driver-c');
    expect(annotated[1].matchBucket).toBe('broader');
  });

  test('frontline hospitality roles do not surface as top matches for explicit knowledge-role targets without hospitality background', () => {
    const profile = {
      ...candidateProfile,
      address: 'Brno',
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          primaryDomain: 'hospitality',
          targetRole: 'Product Manager | AI Systems Architect | Operations Specialist',
          seniority: 'senior',
          includeAdjacentDomains: true,
        },
      },
      cvText: 'Senior product operations, AI systems architecture, roadmap ownership.',
      skills: ['product strategy', 'AI systems', 'operations design'],
    } as unknown as UserProfile;

    const annotated = annotateJobsForCandidate([
      baseJob({
        id: 'waiter',
        title: 'Číšník / Servírka',
        location: 'Brno',
        distanceKm: 27,
        description: 'Obsluha hostů, směny, práce v restauraci a gastro provozu.',
        jhi: { ...baseJob({}).jhi!, score: 82 },
      }),
      baseJob({
        id: 'ops',
        title: 'Operations Specialist pro AI delivery',
        location: 'Brno',
        distanceKm: 31,
        description: 'Operations design, process orchestration and product delivery.',
        jhi: { ...baseJob({}).jhi!, score: 69 },
      }),
    ], profile, 'cs');

    const waiter = annotated.find((job) => job.id === 'waiter');

    expect(annotated[0].id).toBe('ops');
    expect(waiter?.matchBucket).toBe('broader');
    expect(waiter?.matchReasons || []).not.toContain('Gastro a hospitality');
  });

  test('role-directed intent explanations prefer target-role domain over stale primary domain labels', () => {
    const profile = {
      ...candidateProfile,
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          primaryDomain: 'hospitality',
          targetRole: 'Operations Specialist',
          seniority: 'senior',
          includeAdjacentDomains: true,
        },
      },
      cvText: 'Operations specialist with process orchestration and systems delivery background.',
    } as unknown as UserProfile;

    const annotated = computeCandidateAnnotations([
      baseJob({
        id: 'installer',
        title: 'Montér - montáže po celé Evropě',
        description: 'Montáže, servis stávajících systémů a technické výjezdy.',
        location: 'Brno',
        distanceKm: 30,
      }),
    ], profile, 'cs');

    expect(annotated[0].matchReasons || []).not.toContain('Gastro a hospitality');
  });

  test('onboarding interest reveal can override stale history-first direction in discovery ranking', () => {
    const profile = {
      ...candidateProfile,
      jobTitle: 'Hotel Receptionist',
      preferences: {
        ...candidateProfile.preferences,
        searchProfile: {
          includeAdjacentDomains: true,
        },
        candidate_onboarding_v2: {
          completed_at: '2026-03-21T12:00:00.000Z',
          interest_reveal: 'Technology, electronics, building prototypes, invention, systems design.',
        },
      },
      story: '',
      motivations: ['building prototypes', 'understanding systems'],
      sideProjects: ['electronics prototype'],
      skills: [],
      workHistory: [
        {
          id: 'w1',
          role: 'Receptionist',
          company: 'Hotel',
          duration: '2 years',
          description: 'Front desk and guest support.',
        },
      ],
    } as unknown as UserProfile;

    const annotated = annotateJobsForCandidate([
      baseJob({
        id: 'hotel',
        title: 'Recepční',
        description: 'Front office, guest care, check-in and reservations.',
        location: 'Brno',
      }),
      baseJob({
        id: 'prototype',
        title: 'Prototype Technician',
        description: 'Prototype builds, electronics, hardware testing and systems iteration.',
        location: 'Brno',
      }),
    ], profile, 'en');

    expect(annotated[0].id).toBe('prototype');
    expect((annotated[0].priorityScore || 0)).toBeGreaterThan(annotated[1].priorityScore || 0);
  });
});
