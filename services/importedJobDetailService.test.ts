import { buildImportedJobInsideStory } from './importedJobDetailService';
import type { Job } from '../types';

const baseJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  title: 'Imported Role',
  company: 'Acme',
  location: 'Brno',
  type: 'On-site',
  work_model: 'On-site',
  description: 'Obecný popis role.',
  postedAt: '2026-03-01T00:00:00.000Z',
  scrapedAt: '2026-03-01T00:00:00.000Z',
  source: 'external',
  jhi: {
    score: 50,
    baseScore: 50,
    personalizedScore: 50,
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
  listingKind: 'imported',
  ...overrides,
});

describe('buildImportedJobInsideStory', () => {
  test('separates company pitch from role snapshot and prefers explicit hidden risk over cultural fit text', () => {
    const story = buildImportedJobInsideStory(baseJob({
      title: 'Manažerka rekonstrukcí',
      description: 'Majitelům zajišťujeme kompletní proces pronájmu a správy a podnájemníkům jsme nablízku 24/7. V roli budete koordinovat rekonstrukce bytů v nových lokalitách, hlídat termíny dodavatelů a připravenost bytů před předáním. Pokud se více lokalit rozjede bez jasné návaznosti, začne vznikat chaos a zpoždění.',
      challenge: 'Majitelům zajišťujeme kompletní proces pronájmu a správy a podnájemníkům jsme nablízku 24/7.',
      firstStepPrompt: 'Jak bys v prvních dnech zjistil(a), kde má role největší dopad?',
      aiAnalysis: {
        summary: 'Role řídí rozjezd rekonstrukcí v nových lokalitách a hlídá připravenost bytů, dodavatelů a termínů.',
        hiddenRisks: ['Rizikem je neověřená připravenost dodavatelů a nejasná návaznost prací mezi lokalitami.'],
        culturalFit: 'Věříme, že data a technologie mění svět bydlení.',
      },
      benefits: ['Mobilní telefon', 'Notebook'],
    }));

    expect(story.companyContext).toContain('Majitelům zajišťujeme');
    expect(story.roleSnapshot).toContain('rekonstrukcí');
    expect(story.roleSnapshot).not.toContain('Majitelům zajišťujeme');
    expect(story.risk).toContain('neověřená připravenost dodavatelů');
    expect(story.risk).not.toContain('data a technologie');
    expect(story.toneSignal).toContain('data a technologie');
    expect(story.benefits).toEqual(['Mobilní telefon', 'Notebook']);
  });

  test('drops duplicate company context when the same text already explains the role', () => {
    const story = buildImportedJobInsideStory(baseJob({
      description: 'We manage support tickets for SME clients and keep escalations under control. We manage support tickets for SME clients and keep escalations under control.',
      challenge: 'We manage support tickets for SME clients and keep escalations under control.',
      aiAnalysis: {
        summary: 'We manage support tickets for SME clients and keep escalations under control.',
        hiddenRisks: [],
        culturalFit: 'Fast-moving and direct.',
      },
    }));

    expect(story.companyContext).toBe('');
    expect(story.roleSnapshot).toContain('support tickets');
  });
});
