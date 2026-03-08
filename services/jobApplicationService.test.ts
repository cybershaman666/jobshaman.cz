import { jest } from '@jest/globals';

jest.mock('../constants', () => ({
  BACKEND_URL: 'http://localhost:8000',
}));

jest.mock('./supabaseService', () => ({
  supabase: null,
}));

import { generateApplicationDraft } from './jobApplicationService';
import { authenticatedFetch } from './csrfService';

jest.mock('./csrfService', () => ({
  authenticatedFetch: jest.fn(),
}));

describe('generateApplicationDraft', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('maps backend payload into frontend draft suggestion', async () => {
    const mockedAuthenticatedFetch = authenticatedFetch as unknown as jest.MockedFunction<typeof authenticatedFetch>;
    mockedAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          draft_text: 'Draft body',
          fit_score: 91.2,
          fit_reasons: ['Strong Python fit'],
          fit_warnings: ['Salary not disclosed'],
          language: 'cs',
          tone: 'concise',
          used_fallback: false,
          model_meta: { model_used: 'gpt-test' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const result = await generateApplicationDraft(123, {
      cvDocumentId: 'cv_1',
      regenerate: true,
    });

    expect(authenticatedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/jobs/123/application-draft'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result).toEqual({
      draftText: 'Draft body',
      fitScore: 91.2,
      fitReasons: ['Strong Python fit'],
      fitWarnings: ['Salary not disclosed'],
      language: 'cs',
      tone: 'concise',
      usedFallback: false,
      modelMeta: { model_used: 'gpt-test' },
    });
  });

  it('throws backend detail on non-ok responses', async () => {
    const mockedAuthenticatedFetch = authenticatedFetch as unknown as jest.MockedFunction<typeof authenticatedFetch>;
    mockedAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Premium subscription required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    await expect(generateApplicationDraft(123)).rejects.toThrow('Premium subscription required');
  });
});
