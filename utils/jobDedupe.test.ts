import { dedupeJobsList } from './jobDedupe';

describe('dedupeJobsList', () => {
  test('dedupes identical roles even with different ids', () => {
    const jobs = [
      { id: '101', title: 'Backend Engineer', company: 'Acme', location: 'Prague', url: 'https://example.com/jobs/1' },
      { id: '202', title: 'Backend Engineer', company: 'Acme', location: 'Prague', url: 'https://example.com/jobs/2' },
    ];

    const deduped = dedupeJobsList(jobs);
    expect(deduped).toHaveLength(1);
  });

  test('dedupes by normalized url when company missing', () => {
    const jobs = [
      { id: '1', title: 'Remote role', company: '', url: 'https://weworkremotely.com/remote-jobs/foo#apply' },
      { id: '2', title: 'Remote role', company: '', url: 'https://weworkremotely.com/remote-jobs/foo' },
    ];

    const deduped = dedupeJobsList(jobs);
    expect(deduped).toHaveLength(1);
  });

  test('dedupes roles when title only differs by gender marker', () => {
    const jobs = [
      { id: '1', title: 'Backend Engineer (m/w/d)', company: 'Acme GmbH', location: 'Vienna' },
      { id: '2', title: 'Backend Engineer', company: 'Acme', location: 'Vienna' },
    ];

    const deduped = dedupeJobsList(jobs);
    expect(deduped).toHaveLength(1);
  });

  test('dedupes roles when company only differs by legal suffix', () => {
    const jobs = [
      { id: '1', title: 'QA Engineer', company: 'Foo Bar s.r.o.', location: 'Prague' },
      { id: '2', title: 'QA Engineer', company: 'Foo Bar', location: 'Prague' },
    ];

    const deduped = dedupeJobsList(jobs);
    expect(deduped).toHaveLength(1);
  });

  test('does not collapse same role at the same company across different locations', () => {
    const jobs = [
      { id: '1', title: 'Store Manager', company: 'Retail Co', location: 'Prague', url: 'https://example.com/jobs/prague' },
      { id: '2', title: 'Store Manager', company: 'Retail Co', location: 'Brno', url: 'https://example.com/jobs/brno' },
    ];

    const deduped = dedupeJobsList(jobs);
    expect(deduped).toHaveLength(2);
  });

  test('dedupes urls with only tracking params differing', () => {
    const jobs = [
      { id: '1', title: '', company: '', url: 'https://example.com/jobs/123?utm_source=a&gclid=x' },
      { id: '2', title: '', company: '', url: 'https://example.com/jobs/123?utm_source=b&gclid=y' },
    ];

    const deduped = dedupeJobsList(jobs);
    expect(deduped).toHaveLength(1);
  });

  test('does not collapse different identity query params', () => {
    const jobs = [
      { id: '1', title: '', company: '', url: 'https://example.com/job?job_id=111&utm_source=a' },
      { id: '2', title: '', company: '', url: 'https://example.com/job?job_id=222&utm_source=a' },
    ];

    const deduped = dedupeJobsList(jobs);
    expect(deduped).toHaveLength(2);
  });
});
