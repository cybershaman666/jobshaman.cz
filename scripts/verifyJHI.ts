import { calculateJHI } from '../utils/jhiCalculator.js';
import { Job } from '../types.js';

const mockJob = (overrides: Partial<Job>): Partial<Job> => ({
    salary_from: 50000,
    salary_to: 70000,
    type: 'Hybrid',
    benefits: ['Stravenky', 'Notebook'],
    description: 'Standardní popis pozice.',
    location: 'Praha',
    title: 'Software Developer',
    ...overrides
});

const testCases = [
    {
        name: '✅ Dream Job',
        job: mockJob({
            salary_from: 120000,
            salary_to: 140000,
            type: 'Remote',
            benefits: ['Plný Home Office', '5 týdnů dovolené', 'Sick Days', 'Vzdělávací budget', '13. plat'],
            description: 'Hledáme seniora, který chce růst. Nabízíme mentoring a skvělý tým.'
        })
    },
    {
        name: '⚠️ Toxic Synergy (3+ red flags)',
        job: mockJob({
            salary_from: undefined,
            salary_to: undefined,
            type: 'On-site',
            benefits: ['Ovoce v kanclu', 'Teambuilding', 'Mladý kolektiv'],
            description: 'Jsme jako mafiánská rodina s přátelskou atmosférou. Očekáváme proaktivní přístup, vysoké pracovní tempo a odolnost vůči stresu. Hledáme vysoce motivovaného člověka s tah na branku.',
            location: 'Praha'
        })
    },
    {
        name: '💰 Wide Salary Trap (40k-100k)',
        job: mockJob({
            title: 'Junior Developer',
            salary_from: 40000,
            salary_to: 100000, // >40% spread = trap
            type: 'On-site',
            benefits: ['Notebook', 'Mobil'],
            description: 'Plat dle dohody. Moderní kancelář v centru Prahy.'
        })
    },
    {
        name: '📞 Call Center (High Stress)',
        job: mockJob({
            title: 'Zákaznická podpora - Call Center',
            salary_from: 35000,
            type: 'On-site',
            benefits: ['Stravenky'],
            description: 'Hledáme loajálního a odolného člověka. Práce pod tlakem.'
        })
    },
    {
        name: '📈 Sales Manager (Pressure)',
        job: mockJob({
            title: 'Sales Manager',
            salary_from: 60000,
            salary_to: 80000,
            type: 'Hybrid',
            benefits: ['Služební auto', 'Provize'],
            description: 'Vysoce motivovaný obchodník s proaktivním přístupem.'
        })
    },
    {
        name: '🏆 Transparent & Fair',
        job: mockJob({
            title: 'Backend Developer',
            salary_from: 70000,
            salary_to: 85000, // <40% spread = realistic
            type: 'Remote',
            benefits: ['Plný Home Office', 'Sick Days', 'Vzdělávací budget'],
            description: 'Hledáme kolegu do týmu. Flexibilní pracovní doba.'
        })
    }
];

console.log('🚀 JHI v1.1 Verification (Anti-BS Edition)...\n');

testCases.forEach(({ name, job }) => {
    const result = calculateJHI(job);
    console.log(`${name}`);
    console.log(`   Title: ${job.title || 'N/A'}`);
    console.log(`   Salary: ${job.salary_from || '?'} - ${job.salary_to || '?'} CZK`);
    console.log(`   Score: ${result.score}/100`);
    console.log(`   Breakdown: F:${result.financial} T:${result.timeCost} W:${result.mentalLoad} G:${result.growth} V:${result.values}`);
    console.log('-----------------------------------');
});
