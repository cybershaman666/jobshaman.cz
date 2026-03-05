import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['cs', 'en', 'de', 'pl', 'sk', 'at'] as const;
const REQUIRED_KEYS = [
  'badge',
  'title',
  'subtitle',
  'step_company_truth',
  'step_candidate_reply',
  'step_first_reply',
  'step_complete',
  'demo_listing_badge',
  'demo_listing_title',
  'demo_listing_company_label',
  'demo_listing_truth_title',
  'challenge_title',
  'prompt_one',
  'prompt_two',
  'prefilled_answer_one',
  'prefilled_answer_two',
  'prefilled_notice',
  'min_chars_error',
  'submit_reply',
  'supporting_context_title',
  'include_documents_label',
  'include_jcfpm_label',
  'jcfpm_share_state',
  'state_read',
  'state_continue',
  'state_no_ghosting',
  'thread_opened_title',
  'thread_status_value',
  'completed_context_docs_jcfpm',
  'completed_context_none',
  'primary_cta',
  'secondary_cta',
] as const;

describe('demo_handshake locale coverage', () => {
  it.each(LOCALES)('contains demo_handshake keys for %s', (locale) => {
    const localePath = path.resolve(process.cwd(), `public/locales/${locale}/translation.json`);
    const parsed = JSON.parse(fs.readFileSync(localePath, 'utf8')) as Record<string, any>;

    expect(parsed).toHaveProperty('demo_handshake');
    for (const key of REQUIRED_KEYS) {
      expect(parsed.demo_handshake).toHaveProperty(key);
      expect(typeof parsed.demo_handshake[key]).toBe('string');
      expect(parsed.demo_handshake[key].trim().length).toBeGreaterThan(0);
    }
  });
});
