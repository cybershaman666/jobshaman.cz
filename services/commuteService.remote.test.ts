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
});
