import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const targets = [
  'src/rebuild',
  'src/cybershaman',
  'src/hooks/useUserProfile.ts',
  'src/hooks/useCompanyJobsData.ts',
  'src/hooks/useCompanyCandidatesData.ts',
  'src/hooks/useCompanyApplicationsData.ts',
  'src/hooks/useAllRegisteredCandidates.ts',
];

const forbidden = [
  /from ['"].*services\/supabaseService['"]/,
  /from ['"].*services\/jobApplicationService['"]/,
  /from ['"].*services\/handshakeService['"]/,
  /from ['"].*services\/jobService['"]/,
  /from ['"].*services\/cvUploadService['"]/,
  /from ['"].*services\/jcfpmService['"]/,
  /supabase\s*\.\s*from\s*\(/,
  /\.\s*rpc\s*\(/,
  /\.\s*storage\b/,
];

const files = [];

const collect = (path) => {
  const fullPath = join(root, path);
  const stat = statSync(fullPath);
  if (stat.isFile()) {
    if (/\.(ts|tsx)$/.test(fullPath)) files.push(fullPath);
    return;
  }
  for (const entry of readdirSync(fullPath)) {
    collect(join(path, entry));
  }
};

targets.forEach(collect);

const violations = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.test(source)) {
      violations.push(`${relative(root, file)} violates ${rule}`);
    }
  }
}

if (violations.length > 0) {
  console.error('V2 boundary check failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log(`V2 boundary check passed (${files.length} files).`);
