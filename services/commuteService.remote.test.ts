import { isRemoteJob } from './commuteService';
import type { Job } from '../types';

const makeJob = (overrides: Partial<Job>): Job => ({
  id: overrides.id || 'job-1',
  title: overrides.title || 'Untitled role',
  company: overrides.company || 'Example',
  description: overrides.description || '',
  type: overrides.type || '',
  work_model: overrides.work_model || '',
  location: overrides.location || '',
  tags: overrides.tags || [],
  ...overrides,
} as Job);

describe('isRemoteJob', () => {
  test('does not mark construction site manager as remote just because of noisy metadata', () => {
    const job = makeJob({
      title: 'STAVBYVEDOUCÍ',
      type: 'Remote',
      location: 'Brno',
      description: 'Komunikace s investorem, projektantem a technickým dozorem. Koordinace subdodavatelů a dohled nad kvalitou na stavbě.',
    });

    expect(isRemoteJob(job)).toBe(false);
  });

  test('keeps genuinely remote knowledge roles marked as remote', () => {
    const job = makeJob({
      title: 'Senior Product Manager',
      work_model: 'Remote',
      description: 'Remote-first product role with work from home setup and distributed team collaboration.',
    });

    expect(isRemoteJob(job)).toBe(true);
  });

  test('does not mark hybrid roles as fully remote', () => {
    const job = makeJob({
      title: 'Account Manager',
      work_model: 'Hybrid',
      description: '3 dny home office, zbytek v kancelari v Praze.',
      tags: ['home office'],
    });

    expect(isRemoteJob(job)).toBe(false);
  });

  test('does not mark onsite jobs as remote from description only', () => {
    const job = makeJob({
      title: 'Operations Coordinator',
      location: 'Praha',
      description: 'Modern office, moznost home office po zapracovani, kazdodenni spoluprace na miste.',
    });

    expect(isRemoteJob(job)).toBe(false);
  });
});
