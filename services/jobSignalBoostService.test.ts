import { jest } from '@jest/globals';

const authenticatedFetch = jest.fn() as jest.MockedFunction<
  (input: string, init?: RequestInit) => Promise<Response>
>;

jest.mock('./csrfService', () => ({
  authenticatedFetch,
}));

jest.mock('../constants', () => ({
  BACKEND_URL: 'https://api.jobshaman.test',
}));

import { fetchMySignalBoostOutputs } from './jobSignalBoostService';

describe('fetchMySignalBoostOutputs', () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it('returns an empty list when the optional Signal Boost feed endpoint is unavailable', async () => {
    authenticatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(fetchMySignalBoostOutputs(12)).resolves.toEqual([]);
  });

  it('maps outputs when the endpoint responds successfully', async () => {
    authenticatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        items: [
          {
            id: 'out-1',
            share_slug: 'share-1',
            share_url: 'https://jobshaman.com/en/signal/share-1',
            locale: 'en',
            status: 'published',
            job_snapshot: { id: 'job-1', title: 'Product Owner', company: 'Acme' },
            candidate_snapshot: { name: 'Alex' },
            response_payload: { first_step: 'Start with the biggest blocker.' },
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const outputs = await fetchMySignalBoostOutputs(12);

    expect(outputs).toHaveLength(1);
    expect(outputs[0].id).toBe('out-1');
    expect(outputs[0].job_snapshot?.title).toBe('Product Owner');
  });
});
