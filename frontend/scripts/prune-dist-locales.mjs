import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const distLocalesDir = path.join(frontendRoot, 'dist', 'locales');
const productionLocales = new Set(['cs', 'en', 'sk', 'pl', 'de', 'at', 'da', 'sv', 'no', 'fi']);

if (!fs.existsSync(distLocalesDir)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(distLocalesDir)) {
  const entryPath = path.join(distLocalesDir, entry);
  if (!fs.statSync(entryPath).isDirectory()) {
    fs.rmSync(entryPath, { force: true });
    continue;
  }
  if (productionLocales.has(entry)) continue;
  fs.rmSync(entryPath, { recursive: true, force: true });
}
