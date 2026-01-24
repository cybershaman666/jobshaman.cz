
import fs from 'fs';
const content = fs.readFileSync('components/CompanyDashboard.tsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    balance += opens - closes;
    console.log(`${i + 1}: [${balance}] ${line.trim()}`);
}
