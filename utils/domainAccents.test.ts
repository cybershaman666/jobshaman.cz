import { resolveJobDomain } from './domainAccents';
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

describe('resolveJobDomain', () => {
  it('maps courier delivery roles to logistics instead of IT', () => {
    const job = makeJob({
      title: 'Kuryr pro rozvoz nakupu - odmena az 4.000 Kc/den vcetne spropitneho + auto',
      company: 'Quixy s.r.o.',
    });

    expect(resolveJobDomain(job)).toBe('logistics');
  });

  it('does not infer IT from incidental substring matches', () => {
    const job = makeJob({
      title: 'Rozvoz nakupu vcetne spropitneho a auta',
      company: 'Fresh delivery',
    });

    expect(resolveJobDomain(job)).not.toBe('it');
  });
});
