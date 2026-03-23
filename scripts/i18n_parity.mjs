import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const CANONICAL_LOCALE = 'cs';
const strictMode = process.argv.includes('--strict');

const flattenTranslations = (value, prefix = '', target = {}) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenTranslations(item, `${prefix}[${index}]`, target);
    });
    return target;
  }

  if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenTranslations(nestedValue, nextPrefix, target);
    }
    return target;
  }

  target[prefix] = value;
  return target;
};

const localeDirectories = fs
  .readdirSync(LOCALES_DIR)
  .filter((entry) => fs.statSync(path.join(LOCALES_DIR, entry)).isDirectory())
  .sort();

const localeMaps = Object.fromEntries(
  localeDirectories.map((locale) => {
    const filePath = path.join(LOCALES_DIR, locale, 'translation.json');
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return [locale, flattenTranslations(raw)];
  })
);

const canonical = localeMaps[CANONICAL_LOCALE];
if (!canonical) {
  console.error(`Missing canonical locale ${CANONICAL_LOCALE}.`);
  process.exit(1);
}

const canonicalKeys = new Set(Object.keys(canonical));
let hasMissingKeys = false;

for (const locale of localeDirectories) {
  if (locale === CANONICAL_LOCALE) continue;

  const localeMap = localeMaps[locale];
  const localeKeys = new Set(Object.keys(localeMap));
  const missingKeys = [...canonicalKeys].filter((key) => !localeKeys.has(key));
  const extraKeys = [...localeKeys].filter((key) => !canonicalKeys.has(key));
  const suspiciousValues = [];

  for (const key of canonicalKeys) {
    if (!localeKeys.has(key)) continue;
    const localeValue = localeMap[key];
    const canonicalValue = canonical[key];

    if (typeof localeValue !== 'string' || typeof canonicalValue !== 'string') continue;

    const exactMatchToCs = localeValue === canonicalValue && localeValue.length >= 24;
    const containsCzechDiacritics = locale !== 'sk' && /[ěščřžýáíéůúťďň]/i.test(localeValue);

    if (exactMatchToCs || containsCzechDiacritics) {
      suspiciousValues.push({ key, value: localeValue });
    }
  }

  console.log(`\n${locale}`);
  console.log(`- Missing keys: ${missingKeys.length}`);
  console.log(`- Extra keys: ${extraKeys.length}`);
  console.log(`- Suspicious untranslated strings: ${suspiciousValues.length}`);

  if (missingKeys.length > 0) {
    hasMissingKeys = true;
    for (const key of missingKeys.slice(0, 20)) {
      console.error(`  missing: ${key}`);
    }
  }

  if (extraKeys.length > 0) {
    for (const key of extraKeys.slice(0, 10)) {
      console.warn(`  extra: ${key}`);
    }
  }

  if (suspiciousValues.length > 0) {
    for (const item of suspiciousValues.slice(0, 10)) {
      console.warn(`  suspicious: ${item.key}`);
    }
  }
}

if (hasMissingKeys && strictMode) {
  process.exit(1);
}
