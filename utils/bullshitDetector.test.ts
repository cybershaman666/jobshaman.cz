import { analyzeJobBullshit } from './bullshitDetector';
import type { Job } from '../types';

const makeJob = (overrides: Partial<Job>): Job => ({
  id: overrides.id || 'job-1',
  title: overrides.title || 'Untitled role',
  company: overrides.company || 'Example',
  description: overrides.description || '',
  benefits: overrides.benefits || [],
  tags: overrides.tags || [],
  ...overrides,
} as Job);

describe('analyzeJobBullshit', () => {
  it('flags commission-only contractor language with pipeline euphemisms as strong bullshit risk', () => {
    const job = makeJob({
      title: 'Obchodní role',
      description: `
        Výdělek
        Odměna je provizní (IČO).
        Výsledky jsou podle výkonu a konzistence.
        Reálný růst přichází s návyky a pipeline, ne prvním týdnem.
      `,
    });

    const analysis = analyzeJobBullshit(job, 'cs');

    expect(analysis.tone).toBe('bullshit');
    expect(analysis.score).toBeGreaterThanOrEqual(5);
    expect(analysis.signals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Provizní IČO bez jasného fixu'),
        expect.stringContaining('„Výkon“, „konzistence“ a „pipeline“'),
      ])
    );
    expect(analysis.categories).toEqual(
      expect.arrayContaining(['Mlha kolem peněz', 'Tlak jako kultura'])
    );
    expect(analysis.summary).toContain('AI v textu vidí hlavně');
  });

  it('does not over-penalize a commission role when a clear fixed base is stated', () => {
    const job = makeJob({
      title: 'Sales Consultant',
      description: 'Fix 45 000 Kč + provize. Jasně popsané odpovědnosti a onboarding.',
    });

    const analysis = analyzeJobBullshit(job, 'cs');

    expect(analysis.signals).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Provizní IČO bez jasného fixu')])
    );
    expect(analysis.greenFlags).toEqual(
      expect.arrayContaining(['konkrétně popsané peníze'])
    );
  });

  it('flags family culture, performance pressure, and on-time salary as red-flag fluff', () => {
    const job = makeJob({
      title: 'Account Manager',
      description: `
        Jsme jako rodina a držíme při sobě.
        Máme silnou orientaci na výkon a tah na výsledek.
        Výplata vždy včas je u nás samozřejmost.
      `,
    });

    const analysis = analyzeJobBullshit(job, 'cs');

    expect(analysis.tone).toBe('bullshit');
    expect(analysis.score).toBeGreaterThanOrEqual(5);
    expect(analysis.signals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Jsme jako rodina'),
        expect.stringContaining('Orientace na výkon'),
        expect.stringContaining('Výplata vždy včas'),
      ])
    );
    expect(analysis.categories).toEqual(
      expect.arrayContaining(['Rozmazané hranice', 'Tlak jako kultura', 'Fake benefity'])
    );
  });

  it('flags vague growth, stress normalization, and fake flexibility language', () => {
    const job = makeJob({
      title: 'Koordinátor provozu',
      description: `
        Nabízíme možnost kariérního růstu.
        Očekáváme odolnost vůči stresu a schopnost pracovat pod tlakem.
        Samozřejmostí je časová flexibilita a organizace času podle potřeby.
      `,
    });

    const analysis = analyzeJobBullshit(job, 'cs');

    expect(analysis.tone).toBe('watch');
    expect(analysis.score).toBeGreaterThanOrEqual(4);
    expect(analysis.signals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('kariérního růstu'),
        expect.stringContaining('normalizuje stres a tlak'),
        expect.stringContaining('Časová flexibilita'),
      ])
    );
    expect(analysis.categories).toEqual(
      expect.arrayContaining(['Korporátní mlha', 'Tlak jako kultura', 'Rozmazané hranice'])
    );
  });

  it('recognizes concrete and fair listing signals', () => {
    const job = makeJob({
      title: 'Product Operations Manager',
      description: `
        Co budeš dělat: povedeš discovery, nastavíš procesy a budeš mít na starosti onboarding partnerů.
        Režim: hybrid, 3 dny kancelář Brno a 2 dny remote.
        Nabízíme mentoring, learning budget a jasný growth plan.
      `,
      salaryRange: '70 000 - 90 000 Kč',
    });

    const analysis = analyzeJobBullshit(job, 'cs');

    expect(analysis.greenFlags).toEqual(
      expect.arrayContaining([
        'konkrétně popsané peníze',
        'jasně popsaná náplň práce',
        'srozumitelně popsaný režim práce',
        'konkrétní rozvoj nebo mentoring',
      ])
    );
    expect(analysis.greenSummary).toContain('AI naopak oceňuje');
  });
});
