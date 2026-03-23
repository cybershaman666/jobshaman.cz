import { formatJobDescription } from './formatters';

describe('formatJobDescription', () => {
  it('keeps narrative text under list-like headings as paragraphs', () => {
    const input = [
      'Responsibilities:',
      'You will own onboarding flows and work with product and design to improve conversion across the funnel.',
      'You will run experiments, read user behaviour, and turn findings into clearer product decisions.',
    ].join('\n');

    const output = formatJobDescription(input);

    expect(output).toContain('### Responsibilities');
    expect(output).not.toContain('- You will own onboarding flows');
    expect(output).toContain('You will own onboarding flows and work with product and design to improve conversion across the funnel.');
  });

  it('preserves real bullet lists under requirement headings', () => {
    const input = [
      'Requirements:',
      '- 3+ years of product experience',
      '- Strong SQL or analytics background',
      '- Fluent English',
    ].join('\n');

    const output = formatJobDescription(input);

    expect(output).toContain('### Requirements');
    expect(output).toContain('- 3+ years of product experience');
    expect(output).toContain('- Strong SQL or analytics background');
    expect(output).toContain('- Fluent English');
  });

  it('does not turn dash-separated narrative into bullets by default', () => {
    const input = 'The role spans onboarding - activation - retention, but the work is still one connected product story shaped with design and data.';

    const output = formatJobDescription(input);

    expect(output).not.toContain('\n- onboarding');
    expect(output).toContain('The role spans onboarding - activation - retention');
  });

  it('cleans escaped markdown noise from imported listings', () => {
    const input = [
      '### **',
      'Job Description',
      '###',
      '',
      'Digital Marketer**',
      'Working on joined\\-up campaigns and content.',
      'Keywords:** Digital Marketing, Analytics, Content Strategy',
    ].join('\n');

    const output = formatJobDescription(input);

    expect(output).toContain('### Job Description');
    expect(output).toContain('Digital Marketer');
    expect(output).toContain('joined-up campaigns');
    expect(output).toContain('Keywords: Digital Marketing, Analytics, Content Strategy');
    expect(output).not.toContain('### **');
    expect(output).not.toContain('\\-');
  });
});
