import { jest } from '@jest/globals';

jest.mock('../constants', () => ({
  BACKEND_URL: 'http://localhost:8000',
}));

jest.mock('./csrfService', () => ({
  authenticatedFetch: jest.fn(),
}));

import { authenticatedFetch } from './csrfService';
import { evaluateCandidateOnboardingAnswer } from './candidateOnboardingService';

describe('candidateOnboardingService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('maps structured backend evaluation payload', async () => {
    const mockedAuthenticatedFetch = authenticatedFetch as unknown as jest.MockedFunction<typeof authenticatedFetch>;
    mockedAuthenticatedFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          evaluation: {
            summary: 'You started with user behavior.',
            strengths: ['Strong first diagnostic move'],
            misses: ['Assumptions stayed implicit'],
            role_signals: ['Fits product and growth roles'],
            reality_check: 'You say strategy, but your answer reads execution-first.',
            intent_hints: ['try_real_work', 'compare_offers'],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await evaluateCandidateOnboardingAnswer({
      scenarioId: 'product_dropoff',
      answer: 'I would review signup behavior first.',
      locale: 'en',
    });

    expect(result).toEqual({
      summary: 'You started with user behavior.',
      strengths: ['Strong first diagnostic move'],
      misses: ['Assumptions stayed implicit'],
      role_signals: ['Fits product and growth roles'],
      reality_check: 'You say strategy, but your answer reads execution-first.',
      intent_hints: ['try_real_work', 'compare_offers'],
    });
  });

  it('falls back to ai/execute when the dedicated endpoint is unavailable', async () => {
    const mockedAuthenticatedFetch = authenticatedFetch as unknown as jest.MockedFunction<typeof authenticatedFetch>;
    mockedAuthenticatedFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            evaluation: {
              summary: 'Fallback worked',
              strengths: ['Clear first move'],
              misses: [],
              role_signals: ['Fits operations work'],
              reality_check: 'Execution came through strongly.',
              intent_hints: ['explore_options'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const result = await evaluateCandidateOnboardingAnswer({
      scenarioId: 'broken_process',
      answer: 'I would map where the handoff breaks first.',
      locale: 'en',
    });

    expect(mockedAuthenticatedFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/ai/execute'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.summary).toBe('Fallback worked');
  });
});
