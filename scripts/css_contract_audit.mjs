import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SCAN_ROOTS = ['components', 'src', 'pages', 'index.css'];
const ALLOWED_EXTENSIONS = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs']);

const LEGACY_CLASS_PATTERN = /\b(?:game-menu-[A-Za-z0-9_-]+|solarpunk-[A-Za-z0-9_-]+|glass-panel|(?<!app-)input-field)\b/;
const LEGACY_PALETTE_PATTERN = /\b(?:bg|text|border|from|to|via|ring|stroke|fill|animate|hover:text|group-hover:text)-solarpunk-(?:gold|green|sky|white(?:-warm)?)\b/;
const CLASS_CONTEXT_PATTERN = /\bclassName\b|\bcn\(|\bclsx\(|\bclassNames\(/;
const CSS_SELECTOR_PATTERN = /^\s*\./;

const shouldScanFile = (relativePath) => ALLOWED_EXTENSIONS.has(path.extname(relativePath));

const walk = (entryPath) => {
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
      files.push(...walk(childRelative));
    } else if (shouldScanFile(childRelative)) {
      files.push(childRelative);
    }
  }
  return files;
};

const collectFiles = () => SCAN_ROOTS.flatMap((entry) => walk(entry));

const violations = [];

for (const relativePath of collectFiles()) {
  const ext = path.extname(relativePath);
  const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const inCodeClassContext = ext !== '.css' && CLASS_CONTEXT_PATTERN.test(line);
    const inCssSelectorContext = ext === '.css' && CSS_SELECTOR_PATTERN.test(line);

    if ((inCodeClassContext || inCssSelectorContext) && LEGACY_CLASS_PATTERN.test(line)) {
      violations.push({
        category: 'Legacy class family',
        path: relativePath,
        line: index + 1,
        text: line.trim(),
      });
    }

    if (inCodeClassContext && LEGACY_PALETTE_PATTERN.test(line)) {
      violations.push({
        category: 'Legacy solarpunk palette utility',
        path: relativePath,
        line: index + 1,
        text: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  const grouped = new Map();
  for (const violation of violations) {
    if (!grouped.has(violation.category)) grouped.set(violation.category, []);
    grouped.get(violation.category).push(violation);
  }

  for (const [category, items] of grouped.entries()) {
    console.error(`\n${category}:`);
    for (const item of items) {
      console.error(`- ${item.path}:${item.line}`);
      console.error(`  ${item.text}`);
    }
  }

  process.exit(1);
}

console.log('CSS contract audit passed.');
