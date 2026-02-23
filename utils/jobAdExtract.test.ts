import { extractSalaryHint } from './jobAdExtract';

describe('extractSalaryHint', () => {
  it('extracts CZK monthly range', () => {
    const res = extractSalaryHint('Nabízíme 70 000 – 90 000 Kč měsíčně.');
    expect(res.currency).toBe('CZK');
    expect(res.timeframe).toBe('month');
    expect(res.salaryFrom).toBe(70000);
    expect(res.salaryTo).toBe(90000);
  });

  it('extracts k-suffix amounts', () => {
    const res = extractSalaryHint('Mzda 80k CZK.');
    expect(res.currency).toBe('CZK');
    expect(res.salaryFrom).toBe(80000);
  });

  it('normalizes yearly salary to monthly', () => {
    const res = extractSalaryHint('Salary: 120k EUR / year');
    expect(res.currency).toBe('EUR');
    expect(res.timeframe).toBe('month');
    expect(res.salaryFrom).toBe(10000);
  });
});

