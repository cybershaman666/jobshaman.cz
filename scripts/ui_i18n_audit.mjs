import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'baselines', 'ui-i18n-audit-baseline.json');

const SCAN_ROOTS = ['App.tsx', 'components', 'src', 'pages'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const EXCLUDED_FILES = new Set([
  'components/ui/primitives.tsx',
  'src/design/jdl.ts',
]);

const CATEGORIES = {
  inline_locale_branches: {
    label: 'Inline locale branching',
    patterns: [
      /\bnormalizedLocale\b/,
      /\bisCsLike\b/,
      /\blocale\s*===\s*['"`]/,
      /\blanguage\s*===\s*['"`]/,
      /\blocale\.startsWith\(\s*['"`]/,
      /\blanguage\.startsWith\(\s*['"`]/,
    ],
  },
  default_value_fallbacks: {
    label: 'defaultValue fallbacks',
    patterns: [/defaultValue:\s*/],
  },
  raw_palette_utilities: {
    label: 'Raw palette utility classes',
    patterns: [
      /(bg|text|border|from|to|via|ring|stroke|fill)-(white|slate|gray|zinc|neutral|stone|amber|rose|red|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)(?:-[0-9]{2,3})?(?:\/[0-9]{1,3})?/,
    ],
  },
};

const shouldScanFile = (relativePath) => {
  if (EXCLUDED_FILES.has(relativePath)) return false;
  if (relativePath.startsWith('components/ui/')) return false;
  if (relativePath.startsWith('public/')) return false;
  if (relativePath.startsWith('docs/')) return false;
  if (relativePath.includes('/__pycache__/')) return false;
  return ALLOWED_EXTENSIONS.has(path.extname(relativePath));
};

const walk = (entryPath, relativePath = '') => {
  const fullPath = path.join(ROOT, entryPath);
  const stats = fs.statSync(fullPath);

  if (stats.isFile()) {
    return shouldScanFile(entryPath) ? [entryPath] : [];
  }

  const files = [];
  for (const child of fs.readdirSync(fullPath)) {
    const childRelative = path.join(entryPath, child);
    const childPath = path.join(ROOT, childRelative);
    const childStats = fs.statSync(childPath);
    if (childStats.isDirectory()) {
      files.push(...walk(childRelative, childRelative));
    } else if (shouldScanFile(childRelative)) {
      files.push(childRelative);
    }
  }
  return files;
};

const collectFiles = () => SCAN_ROOTS.flatMap((entry) => walk(entry));

const buildMatchId = (relativePath, text) => `${relativePath}::${text.trim()}`;

const scan = () => {
  const files = collectFiles();
  const result = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, []]));

  for (const relativePath of files) {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const text = line.trim();
      if (!text) return;

      for (const [categoryKey, config] of Object.entries(CATEGORIES)) {
        if (config.patterns.some((pattern) => pattern.test(line))) {
          result[categoryKey].push({
            id: buildMatchId(relativePath, text),
            path: relativePath,
            line: index + 1,
            text,
          });
        }
      }
    });
  }

  for (const key of Object.keys(result)) {
    const seen = new Set();
    result[key] = result[key].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  return result;
};

const loadBaseline = () => {
  if (!fs.existsSync(BASELINE_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
};

const writeBaseline = (current) => {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        categories: current,
      },
      null,
      2
    ) + '\n'
  );
};

const current = scan();
const writeMode = process.argv.includes('--write-baseline');

if (writeMode) {
  writeBaseline(current);
  console.log(`Wrote audit baseline to ${path.relative(ROOT, BASELINE_PATH)}`);
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline) {
  console.error('Missing audit baseline. Run `npm run audit:baseline` first.');
  process.exit(1);
}

let hasNewViolations = false;

for (const [categoryKey, config] of Object.entries(CATEGORIES)) {
  const baselineIds = new Set((baseline.categories?.[categoryKey] || []).map((item) => item.id));
  const currentItems = current[categoryKey] || [];
  const newItems = currentItems.filter((item) => !baselineIds.has(item.id));

  console.log(`${config.label}: ${currentItems.length} tracked`);

  if (newItems.length > 0) {
    hasNewViolations = true;
    console.error(`\nNew ${config.label.toLowerCase()}:`);
    for (const item of newItems) {
      console.error(`- ${item.path}:${item.line}`);
      console.error(`  ${item.text}`);
    }
    console.error('');
  }
}

if (hasNewViolations) {
  process.exit(1);
}
