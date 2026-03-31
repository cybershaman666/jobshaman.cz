import {
  buildCompanyProblemSummary,
  buildProblemDraftSeed,
  rankCandidatesForCompanyProblem,
} from './companyProblemMapService';
import type { Candidate, CompanyProfile } from '../types';

const makeCandidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: 'candidate-1',
  name: 'Matěj Hlaváč',
  role: 'Regional Operations Lead',
  experienceYears: 8,
  salaryExpectation: 0,
  skills: ['Operations', 'Process design', 'Multi-site coordination', 'Hospitality'],
  bio: 'Scaled field teams across multiple cities and stabilized operating rhythm.',
  flightRisk: 'Low',
  hasJcfpm: true,
  values: ['Ownership', 'Clarity'],
  ...overrides,
});

describe('companyProblemMapService', () => {
  it('builds a hospitality-oriented problem summary from free text', () => {
    const summary = buildCompanyProblemSummary('Rozjet hotelový provoz ve dvou městech bez chaosu', { language: 'cs' });
    expect(summary.category).toBe('hospitality');
    expect(summary.workModel).toBe('On-site');
    expect(summary.firstReplyPrompt).toContain('hotelový provoz');
    expect(summary.ambientNodes.length).toBeGreaterThan(0);
  });

  it('ranks operational candidates ahead of generic banking profiles for hospitality problems', () => {
    const summary = buildCompanyProblemSummary('Rozjet hotelový provoz ve dvou městech bez chaosu', { language: 'cs' });
    const matches = rankCandidatesForCompanyProblem(summary, [
      makeCandidate(),
      makeCandidate({
        id: 'candidate-2',
        name: 'David Weber',
        role: 'Business Architect Banking',
        experienceYears: 11,
        skills: ['Enterprise architecture', 'Governance'],
        bio: 'Strong in banking transformation and governance, far from ground operations.',
        values: ['Structure'],
      }),
    ]);

    expect(matches[0]?.candidate.name).toBe('Matěj Hlaváč');
    expect(matches[0]?.score).toBeGreaterThan(matches[1]?.score || 0);
  });

  it('builds a seeded draft role from the problem summary', () => {
    const companyProfile: Partial<CompanyProfile> = {
      id: 'company-1',
      address: 'Brno',
      description: 'We are rebuilding a calmer operating system for growth.',
    };
    const summary = buildCompanyProblemSummary('Stabilizovat onboarding a handoff mezi pobočkami', { language: 'cs' });
    const draft = buildProblemDraftSeed(summary, companyProfile, 'team@example.com');

    expect(draft.title).toBeTruthy();
    expect(draft.company_goal).toContain('Firma');
    expect(draft.first_reply_prompt).toContain('co vám dojde jako první');
    expect(String(draft.location_public || '')).toBe('Brno');
    expect((draft.editor_state as any)?.handshake?.company_truth_hard).toBeTruthy();
  });
});
