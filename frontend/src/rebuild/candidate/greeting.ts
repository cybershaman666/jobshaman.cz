const normalizeName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const firstNameOf = (value?: string | null): string => String(value || '').trim().split(/\s+/)[0] || '';

const isCzechLanguage = (language?: string | null): boolean =>
  String(language || '').toLowerCase().startsWith('cs');

const isMisaName = (value: string): boolean => {
  const normalized = normalizeName(value);
  return normalized === 'misa' || normalized === 'misha';
};

export const getCandidateGreetingName = ({
  preferredAlias,
  preferenceName,
  profileName,
  language,
}: {
  preferredAlias?: string | null;
  preferenceName?: string | null;
  profileName?: string | null;
  language?: string | null;
}): string => {
  const rawName = [preferredAlias, preferenceName, profileName].find((value) => String(value || '').trim());
  const firstName = firstNameOf(rawName);
  if (firstName && isCzechLanguage(language) && isMisaName(firstName)) return 'Míšo';
  return firstName;
};
