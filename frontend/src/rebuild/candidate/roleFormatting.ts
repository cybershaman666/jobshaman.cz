import type { Role } from '../models';

export const formatRoleCompensation = (role: Role, fallback: string, language?: string) => {
  if (role.salaryFrom <= 0 && role.salaryTo <= 0) return fallback;
  const locale = language === 'cs' ? 'cs-CZ' : 'en-GB';
  const from = role.salaryFrom > 0 ? role.salaryFrom.toLocaleString(locale) : role.salaryTo.toLocaleString(locale);
  const to = role.salaryTo > 0 && role.salaryTo !== role.salaryFrom ? ` - ${role.salaryTo.toLocaleString(locale)}` : '';
  return `${from}${to} ${role.currency}${role.salaryTimeframe ? ` / ${role.salaryTimeframe}` : ''}`;
};
