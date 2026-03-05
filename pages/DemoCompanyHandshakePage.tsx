import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Briefcase, CheckCircle2, Clock3, Sparkles, UserRound } from 'lucide-react';

import ApplicationMessageCenter from '../components/ApplicationMessageCenter';
import { trackAnalyticsEvent } from '../services/supabaseService';
import { type DialogueMessage } from '../types';
import { type DialogueMessageCreatePayload } from '../services/jobApplicationService';

interface DemoCompanyHandshakePageProps {
  onRegister?: () => void;
  onBackToCompanyLanding?: () => void;
}

type DemoCompanyStep = 'role_canvas' | 'incoming_candidate' | 'company_reply' | 'completed';

const createDemoThreadId = (): string => `THR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const createMessageId = (): string => `dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createDeadlineAt = (hours: number): string => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const getElapsedBucket = (durationMs: number): string => {
  if (durationMs < 60_000) return 'under_1m';
  if (durationMs < 120_000) return '1_2m';
  if (durationMs < 300_000) return '2_5m';
  return 'over_5m';
};

interface DemoCandidateProfile {
  name: string;
  title: string;
  yearsExperience: number;
  experiences: string[];
  workHistory: Array<{
    role: string;
    company: string;
    period: string;
    highlights: string[];
  }>;
  transferableLeadership: string[];
  topSkills: Array<{ label: string; score: number }>;
  aiSummary: string;
  aiRecommendation: string;
  cvFilename: string;
  jcfpmFilename: string;
  pilotPlanFilename: string;
  jcfpmSummary: string;
  jcfpmTraits: Array<{ label: string; score: number }>;
  jcfpmRisk: string;
}

interface DemoAttachmentDoc {
  name: string;
  url: string;
  kind: 'document';
}

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const pickMany = <T,>(items: T[], count: number): T[] => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(1, Math.min(count, items.length)));
};

const toFileSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createHtmlAttachmentUrl = (title: string, body: string): string => {
  return createStyledAttachmentUrl(
    title,
    `<h1>${escapeHtml(title)}</h1><pre>${escapeHtml(body)}</pre>`,
    false,
  );
};

const createStyledAttachmentUrl = (title: string, contentHtml: string, narrow = true): string => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: #e2e8f0; color: #0f172a; }
    .wrap { max-width: ${narrow ? '940px' : '1120px'}; margin: 24px auto; padding: 0 16px; }
    .card { background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; box-shadow: 0 10px 28px rgba(15,23,42,0.10); }
    h1 { margin: 0 0 14px; font-size: 21px; }
    pre { margin: 0; white-space: pre-wrap; font-size: 13px; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .hero { background: linear-gradient(135deg, #0f172a 0%, #155e75 100%); color: #f8fafc; border-radius: 16px; padding: 20px; margin-bottom: 18px; }
    .hero h1 { margin: 0; font-size: 30px; line-height: 1.1; letter-spacing: -0.02em; }
    .hero p { margin: 8px 0 0; font-size: 15px; color: #bae6fd; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .chip { border: 1px solid rgba(255,255,255,.35); border-radius: 999px; padding: 6px 10px; font-size: 12px; background: rgba(255,255,255,.08); }
    .grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 14px; }
    .panel { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; background: #f8fafc; }
    .panel h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #0e7490; }
    .panel p { margin: 0; font-size: 13px; line-height: 1.55; color: #334155; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 0 0 8px; font-size: 13px; line-height: 1.45; color: #334155; }
    .timeline { display: grid; gap: 10px; }
    .job { border: 1px solid #cbd5e1; background: #fff; border-radius: 10px; padding: 10px; }
    .job-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .job-role { font-size: 13px; font-weight: 700; color: #0f172a; }
    .job-meta { font-size: 12px; color: #0e7490; font-weight: 600; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-top: 14px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; background: #fff; }
    .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #0e7490; font-weight: 700; }
    .kpi-value { margin-top: 4px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; }
    .kpi-sub { margin-top: 4px; font-size: 12px; color: #64748b; line-height: 1.45; }
    .skills { display: grid; gap: 10px; }
    .skill-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; font-size: 12px; color: #0f172a; font-weight: 600; }
    .bar { grid-column: 1 / span 2; height: 7px; border-radius: 999px; background: #cbd5e1; overflow: hidden; }
    .fill { height: 100%; background: linear-gradient(90deg, #0ea5e9, #0f766e); }
    .muted { color: #64748b; font-size: 12px; margin-top: 6px; }
    .footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .kpi-grid { grid-template-columns: 1fr; } .hero h1 { font-size: 24px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${contentHtml}
    </div>
  </div>
</body>
</html>`;
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  } catch (_error) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }
};


const createDemoCandidateProfile = (isCsLike: boolean): DemoCandidateProfile => {
  const firstNames = isCsLike
    ? ['Jakub', 'Tereza', 'Ondrej', 'Veronika', 'Adam', 'Ema', 'Patrik', 'Nikola', 'David', 'Lucie']
    : ['Alex', 'Mia', 'Liam', 'Nora', 'Ethan', 'Sofia', 'Ryan', 'Emma', 'Noah', 'Ella'];
  const lastNames = isCsLike
    ? ['Kolar', 'Novotny', 'Svoboda', 'Dvorak', 'Kratochvil', 'Urban', 'Prochazka', 'Barta', 'Sedlak', 'Marek']
    : ['Carter', 'Hayes', 'Miller', 'Novak', 'Brooks', 'Ward', 'Parker', 'Hunter', 'Reed', 'Stone'];
  const titles = isCsLike
    ? [
        'Směnový supervizor recepce',
        'Koordinátor front office provozu',
        'Provozní lead hospitality týmu',
        'Supervisor služeb hostům',
      ]
    : [
        'Front Office Shift Supervisor',
        'Hospitality Operations Coordinator',
        'Guest Services Team Lead',
        'Shift Operations Supervisor',
      ];
  const experiencePool = isCsLike
    ? [
        '3 roky vedl ranní a odpolední směnu na recepci 120+ pokojového hotelu.',
        'Zavedl jednotný handoff checklist a snížil počet eskalací o 28 %.',
        'Koordinoval spolupráci recepce a housekeepingu při špičkách obsazenosti.',
        'Nastavil denní report pro incidenty, SLA a prioritu úkolů mezi směnami.',
        'Školil nové směnové kolegy na krizovou komunikaci s hosty.',
      ]
    : [
        'Led morning and evening front-desk shifts in a 120+ room hotel.',
        'Rolled out one handoff checklist and reduced escalations by 28%.',
        'Coordinated front desk and housekeeping during peak occupancy windows.',
        'Built daily incident + SLA reporting across shift transitions.',
        'Onboarded new shift agents for guest-facing de-escalation routines.',
      ];
  const workHistoryPool = isCsLike
    ? [
        {
          role: 'Senior směnový supervizor',
          company: 'Hotel Riverside Praha',
          period: '2023-2026',
          highlights: [
            'Vedl 14členný tým recepce a koordinoval handoff mezi směnami.',
            'Snížil počet hostovských eskalací o 31 % během 6 měsíců.',
            'Zavedl jednotný provozní checklist a reportovací rytmus.',
          ],
        },
        {
          role: 'Směnový koordinátor',
          company: 'CityStay Apartments',
          period: '2021-2023',
          highlights: [
            'Řídil denní operativu pro 3 objekty a návaznost housekeepingu.',
            'Zkrátil průměrný čas řešení incidentu z 52 na 34 minut.',
            'Nastavil onboarding playbook pro nové členy směny.',
          ],
        },
        {
          role: 'Front desk lead',
          company: 'Business Hotel Central',
          period: '2019-2021',
          highlights: [
            'Organizoval špičkové příjezdy/odjezdy při vysoké obsazenosti.',
            'Mentoroval juniorní recepční a sjednotil standard komunikace s hosty.',
            'Zlepšil přesnost předávání směn díky strukturovanému logbooku.',
          ],
        },
      ]
    : [
        {
          role: 'Senior Shift Supervisor',
          company: 'Riverside Hotel Prague',
          period: '2023-2026',
          highlights: [
            'Led a 14-person front-office team and shift-handoff execution.',
            'Reduced guest escalations by 31% over six months.',
            'Implemented one operations checklist and reporting cadence.',
          ],
        },
        {
          role: 'Shift Operations Coordinator',
          company: 'CityStay Apartments',
          period: '2021-2023',
          highlights: [
            'Owned daily operations across three properties and housekeeping handoffs.',
            'Reduced average incident resolution time from 52 to 34 minutes.',
            'Built onboarding playbook for new shift staff.',
          ],
        },
        {
          role: 'Front Desk Lead',
          company: 'Business Hotel Central',
          period: '2019-2021',
          highlights: [
            'Coordinated peak check-in/check-out windows at high occupancy.',
            'Mentored junior agents and aligned guest communication standards.',
            'Improved handoff accuracy with structured shift logbook.',
          ],
        },
      ];
  const transferablePool = isCsLike
    ? [
        'Vedení skautského oddílu (18 členů, věk 12-16): plánování týdenního režimu, řešení konfliktů a rozdělení odpovědností.',
        'Asistent trenéra fotbalového týmu U15: organizace tréninků, docházka, komunikace s rodiči a vedení pod tlakem během zápasů.',
        'Koordinace dobrovolnické akce pro 120 účastníků: logistika směn, briefingy a krizové scénáře.',
        'Mentor juniorních brigádníků v hotelovém provozu: onboarding checklist, zpětná vazba a kontrola kvality.',
      ]
    : [
        'Scout group lead (18 members, age 12-16): weekly planning, conflict handling, and ownership assignment.',
        'Assistant coach for U15 football team: training coordination, attendance discipline, and communication under pressure.',
        'Volunteer event coordinator for 120 attendees: shift logistics, briefings, and incident handling.',
        'Mentor for junior staff in hospitality operations: onboarding checklist, coaching loops, and quality control.',
      ];
  const skillPool = isCsLike
    ? [
        'Řízení směnového provozu',
        'Handoff checklisty',
        'Prioritizace incidentů',
        'Komunikace s hostem',
        'Koordinace recepce + housekeepingu',
        'Vedení malého týmu',
        'Operativní reporting',
        'Zpětná vazba a mentoring',
      ]
    : [
        'Shift operations leadership',
        'Handoff checklist discipline',
        'Incident prioritization',
        'Guest communication',
        'Front desk + housekeeping coordination',
        'Small team leadership',
        'Operational reporting',
        'Mentoring and coaching',
      ];
  const riskPool = isCsLike
    ? [
        'Silná orientace na detail může zpomalit rozhodnutí v akutních situacích.',
        'Při vysokém tlaku má tendenci řešit operativu osobně místo delegování.',
        'Potřebuje jasně hlídat prioritu mezi kvalitou procesu a rychlostí reakce.',
      ]
    : [
        'Strong detail focus may slow decisions in urgent moments.',
        'Under pressure, can over-own operations instead of delegating early.',
        'Needs explicit priority framing between process quality and response speed.',
      ];
  const traitLabels = isCsLike
    ? ['Procesní disciplína', 'Koordinace směn', 'Komunikace pod tlakem']
    : ['Process discipline', 'Shift coordination', 'Communication under pressure'];

  const name = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
  const yearsExperience = Math.floor(Math.random() * 6) + 3;
  const selectedExperiences = pickMany(experiencePool, 3);
  const selectedHistory = pickMany(workHistoryPool, 3);
  const selectedTransferable = pickMany(transferablePool, 2);
  const selectedSkills = pickMany(skillPool, 6).map((label) => ({
    label,
    score: Math.floor(Math.random() * 24) + 72,
  }));
  const traitScores = traitLabels.map((label) => ({
    label,
    score: Math.floor(Math.random() * 22) + 72,
  }));
  const avgScore = Math.round(traitScores.reduce((sum, item) => sum + item.score, 0) / traitScores.length);
  const jcfpmSummary = isCsLike
    ? `Profil ukazuje stabilní výkon v provozu (${avgScore}/100) a vhodnost pro řízení handoffu mezi směnami.`
    : `Profile shows stable operations performance (${avgScore}/100) and fit for shift-handoff ownership.`;
  const aiSummary = isCsLike
    ? 'Kandidát kombinuje provozní disciplínu s přirozeným leadershipem. Umí držet klid v špičce, rychle prioritizovat a převést tým na jednotný způsob předávání směn.'
    : 'Candidate combines operations discipline with practical leadership. Keeps composure during peaks, prioritizes quickly, and aligns teams on one handoff standard.';
  const aiRecommendation = isCsLike
    ? 'Silný fit pro roli: doporučeno otevřít navazující kolo zaměřené na onboarding prvních 30 dnů a ownership KPI.'
    : 'Strong fit for this role: recommended to open next round focused on first-30-day onboarding and KPI ownership.';
  const slug = toFileSlug(name);

  return {
    name,
    title: pickRandom(titles),
    yearsExperience,
    experiences: selectedExperiences,
    workHistory: selectedHistory,
    transferableLeadership: selectedTransferable,
    topSkills: selectedSkills,
    aiSummary,
    aiRecommendation,
    cvFilename: `CV_${slug}_ShiftOps.pdf`,
    jcfpmFilename: `JCFPM_${slug}_summary.pdf`,
    pilotPlanFilename: isCsLike ? `Pilot_plan_14_dni_${slug}.pdf` : `14_day_pilot_plan_${slug}.pdf`,
    jcfpmSummary,
    jcfpmTraits: traitScores,
    jcfpmRisk: pickRandom(riskPool),
  };
};

const DemoCompanyHandshakePage: React.FC<DemoCompanyHandshakePageProps> = ({
  onRegister,
  onBackToCompanyLanding,
}) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';
  const [candidateProfile, setCandidateProfile] = useState<DemoCandidateProfile>(() => createDemoCandidateProfile(isCsLike));

  useEffect(() => {
    setCandidateProfile(createDemoCandidateProfile(isCsLike));
  }, [isCsLike]);

  const candidateAttachments = useMemo(() => {
    const profileSlug = toFileSlug(candidateProfile.name).toLowerCase();
    const email = `${profileSlug}@demo-jobshaman.local`;
    const localeCode = isCsLike ? 'cs-CZ' : 'en-US';
    const today = new Date().toLocaleDateString(localeCode);
    const sortedTraits = [...candidateProfile.jcfpmTraits].sort((a, b) => b.score - a.score);
    const strongestTraits = sortedTraits.slice(0, 2);
    const watchTrait = sortedTraits[sortedTraits.length - 1];
    const jcfpmOverall = Math.round(candidateProfile.jcfpmTraits.reduce((sum, item) => sum + item.score, 0) / candidateProfile.jcfpmTraits.length);
    const reliabilityScore = Math.max(70, Math.min(97, jcfpmOverall + 6));
    const readinessScore = Math.max(68, Math.min(96, jcfpmOverall + 2));
    const overallLevel = jcfpmOverall >= 86
      ? (isCsLike ? 'Vysoký fit' : 'High fit')
      : jcfpmOverall >= 78
        ? (isCsLike ? 'Střední fit' : 'Medium fit')
        : (isCsLike ? 'Nutná validace' : 'Needs validation');

    const cvRoleFitList = isCsLike
      ? [
          'Dokáže sjednotit handoff mezi směnami bez ztráty kvality.',
          'Má zkušenost s vedením menšího týmu v provozu s proměnlivým tlakem.',
          'Umí převést měkké leadership dovednosti do měřitelných provozních KPI.',
        ]
      : [
          'Can align shift handoffs without quality loss.',
          'Has proven leadership in small teams under changing pressure.',
          'Converts soft leadership capability into measurable operations KPIs.',
        ];

    const cvHtml = `
      <section class="hero">
        <h1>${escapeHtml(candidateProfile.name)}</h1>
        <p>${escapeHtml(candidateProfile.title)}</p>
        <div class="chips">
          <span class="chip">${escapeHtml(isCsLike ? `Praxe ${candidateProfile.yearsExperience} let` : `${candidateProfile.yearsExperience} years experience`)}</span>
          <span class="chip">${escapeHtml(isCsLike ? 'Demo kandidát - AI průvodce životopisem' : 'Demo candidate - AI CV guide output')}</span>
          <span class="chip">${escapeHtml(email)}</span>
        </div>
      </section>

      <div class="grid">
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'AI shrnutí kandidáta' : 'AI candidate summary')}</h3>
          <p>${escapeHtml(candidateProfile.aiSummary)}</p>
          <p class="muted">${escapeHtml(candidateProfile.aiRecommendation)}</p>
        </section>
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'Role fit - směnový koordinátor' : 'Role fit - Shift coordinator')}</h3>
          <ul>${cvRoleFitList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <h3>${escapeHtml(isCsLike ? 'Pracovní historie' : 'Employment history')}</h3>
        <div class="timeline">
          ${candidateProfile.workHistory
            .map(
              (job) => `
                <article class="job">
                  <div class="job-head">
                    <div class="job-role">${escapeHtml(job.role)}</div>
                    <div class="job-meta">${escapeHtml(job.company)} · ${escapeHtml(job.period)}</div>
                  </div>
                  <ul style="margin-top:8px;">
                    ${job.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                  </ul>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <div class="grid" style="margin-top:14px;">
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'Relevantní provozní zkušenosti' : 'Relevant operations experience')}</h3>
          <ul>${candidateProfile.experiences.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'Přenositelné leadership zkušenosti' : 'Transferable leadership experience')}</h3>
          <ul>${candidateProfile.transferableLeadership.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
      </div>

      <div class="grid" style="margin-top:14px;">
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'Klíčové dovednosti' : 'Key skills')}</h3>
          <div class="skills">
            ${candidateProfile.topSkills
              .map(
                (skill) => `
                  <div class="skill-row">
                    <span>${escapeHtml(skill.label)}</span>
                    <span>${skill.score}/100</span>
                    <div class="bar"><div class="fill" style="width:${Math.max(55, Math.min(100, skill.score))}%"></div></div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </section>
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'JCFPM snapshot' : 'JCFPM snapshot')}</h3>
          <p>${escapeHtml(candidateProfile.jcfpmSummary)}</p>
          <ul>${candidateProfile.jcfpmTraits.map((item) => `<li>${escapeHtml(`${item.label}: ${item.score}/100`)}</li>`).join('')}</ul>
          <p class="muted">${escapeHtml(isCsLike ? `Rizikové místo: ${candidateProfile.jcfpmRisk}` : `Risk area: ${candidateProfile.jcfpmRisk}`)}</p>
        </section>
      </div>

      <div class="footer">
        <span>${escapeHtml(isCsLike ? `Vygenerováno: ${today}` : `Generated: ${today}`)}</span>
        <span>${escapeHtml(isCsLike ? 'Zdroj: Demo AI průvodce životopisem (JobShaman)' : 'Source: Demo AI CV guide output (JobShaman)')}</span>
      </div>
    `;

    const nextSteps = isCsLike
      ? [
          'V navazujícím kole ověřit, jak kandidát deleguje při špičce obsazenosti.',
          'Dát případovou situaci na handoff mezi směnami a vyhodnotit strukturu řešení.',
          'V prvních 30 dnech nastavit KPI: eskalace, SLA incidentů, kvalita předání směn.',
        ]
      : [
          'Validate delegation style during peak occupancy pressure in the next round.',
          'Use a shift-handoff case scenario and evaluate solution structure.',
          'Set first-30-day KPIs: escalations, incident SLA, handoff quality.',
        ];

    const jcfpmHtml = `
      <section class="hero">
        <h1>${escapeHtml(isCsLike ? 'JCFPM report kandidáta' : 'Candidate JCFPM report')}</h1>
        <p>${escapeHtml(candidateProfile.name)} · ${escapeHtml(candidateProfile.title)}</p>
        <div class="chips">
          <span class="chip">${escapeHtml(isCsLike ? `Celkový fit ${jcfpmOverall}/100` : `Overall fit ${jcfpmOverall}/100`)}</span>
          <span class="chip">${escapeHtml(overallLevel)}</span>
          <span class="chip">${escapeHtml(isCsLike ? `Generováno ${today}` : `Generated ${today}`)}</span>
        </div>
      </section>

      <div class="kpi-grid">
        <section class="kpi">
          <div class="kpi-label">${escapeHtml(isCsLike ? 'Role fit' : 'Role fit')}</div>
          <div class="kpi-value">${jcfpmOverall}<span style="font-size:13px;font-weight:700;color:#64748b;">/100</span></div>
          <div class="kpi-sub">${escapeHtml(isCsLike ? 'Shoda s rolí směnového koordinátora.' : 'Alignment with shift coordinator role.')}</div>
        </section>
        <section class="kpi">
          <div class="kpi-label">${escapeHtml(isCsLike ? 'Stabilita signálu' : 'Signal reliability')}</div>
          <div class="kpi-value">${reliabilityScore}<span style="font-size:13px;font-weight:700;color:#64748b;">%</span></div>
          <div class="kpi-sub">${escapeHtml(isCsLike ? 'Konzistentní vzorec napříč profilem a zkušeností.' : 'Consistent pattern across profile and experience.')}</div>
        </section>
        <section class="kpi">
          <div class="kpi-label">${escapeHtml(isCsLike ? 'Readiness' : 'Readiness')}</div>
          <div class="kpi-value">${readinessScore}<span style="font-size:13px;font-weight:700;color:#64748b;">%</span></div>
          <div class="kpi-sub">${escapeHtml(isCsLike ? 'Odhad připravenosti převzít odpovědnost v prvních týdnech.' : 'Estimated readiness to own operations in the first weeks.')}</div>
        </section>
      </div>

      <div class="grid" style="margin-top:14px;">
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'Signal matrix' : 'Signal matrix')}</h3>
          <div class="skills">
            ${candidateProfile.jcfpmTraits
              .map(
                (trait) => `
                  <div class="skill-row">
                    <span>${escapeHtml(trait.label)}</span>
                    <span>${trait.score}/100</span>
                    <div class="bar"><div class="fill" style="width:${Math.max(50, Math.min(100, trait.score))}%"></div></div>
                  </div>
                `,
              )
              .join('')}
          </div>
          <p class="muted">${escapeHtml(candidateProfile.jcfpmSummary)}</p>
        </section>
        <section class="panel">
          <h3>${escapeHtml(isCsLike ? 'Interpretace pro roli' : 'Role interpretation')}</h3>
          <ul>
            ${strongestTraits
              .map(
                (item) =>
                  `<li>${escapeHtml(
                    isCsLike
                      ? `Silná stránka: ${item.label} (${item.score}/100) - nadprůměrný předpoklad pro řízení směnového provozu.`
                      : `Strength: ${item.label} (${item.score}/100) - above-average potential for shift operations ownership.`,
                  )}</li>`,
              )
              .join('')}
            <li>${escapeHtml(isCsLike ? `Rizikové místo: ${candidateProfile.jcfpmRisk}` : `Risk area: ${candidateProfile.jcfpmRisk}`)}</li>
            <li>${escapeHtml(
              isCsLike
                ? `Doporučení validace: zaměřit další kolo na trait "${watchTrait?.label || 'N/A'}".`
                : `Validation recommendation: focus next round on "${watchTrait?.label || 'N/A'}".`,
            )}</li>
          </ul>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <h3>${escapeHtml(isCsLike ? 'Doporučené další kroky' : 'Recommended next steps')}</h3>
        <ul>${nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>

      <section class="panel" style="margin-top:14px;">
        <h3>${escapeHtml(isCsLike ? 'Evidence z pracovních zkušeností' : 'Evidence from work history')}</h3>
        <ul>
          ${candidateProfile.workHistory
            .slice(0, 2)
            .map((job) => `<li>${escapeHtml(`${job.role} (${job.company}, ${job.period}) - ${job.highlights[0]}`)}</li>`)
            .join('')}
        </ul>
      </section>

      <div class="footer">
        <span>${escapeHtml(isCsLike ? `Model výstupu: Demo JCFPM v1` : `Output model: Demo JCFPM v1`)}</span>
        <span>${escapeHtml(isCsLike ? 'Zdroj: JobShaman psychometrický náhled (demo)' : 'Source: JobShaman psychometric preview (demo)')}</span>
      </div>
    `;

    const pilotPlanBody = isCsLike
      ? [
          `Pilot plan (14 dni) - ${candidateProfile.name}`,
          '',
          'Tyden 1:',
          '- Audit predavani smen na 2 pilotnich smenach',
          '- Zavedeny jednotny checklist a logbook',
          '- Denni standup 15 minut pred startem smeny',
          '',
          'Tyden 2:',
          '- Vyhodnoceni eskalaci, SLA a kvality predavani',
          '- Retrospektiva s recepci i housekeepingem',
          '- Finalni navrh standardu pro vsechny smeny',
        ].join('\n')
      : [
          `Pilot plan (14 days) - ${candidateProfile.name}`,
          '',
          'Week 1:',
          '- Audit handoffs across two pilot shifts',
          '- Launch one checklist and shared logbook',
          '- 15-minute pre-shift standup cadence',
          '',
          'Week 2:',
          '- Review escalations, SLA, and handoff quality',
          '- Joint retrospective with front desk + housekeeping',
          '- Rollout proposal for all shifts',
        ].join('\n');

    return {
      cv: {
        name: candidateProfile.cvFilename,
        kind: 'document' as const,
        url: createStyledAttachmentUrl(candidateProfile.cvFilename, cvHtml, false),
      } as DemoAttachmentDoc,
      jcfpm: {
        name: candidateProfile.jcfpmFilename,
        kind: 'document' as const,
        url: createStyledAttachmentUrl(candidateProfile.jcfpmFilename, jcfpmHtml, false),
      } as DemoAttachmentDoc,
      pilot: {
        name: candidateProfile.pilotPlanFilename,
        kind: 'document' as const,
        url: createHtmlAttachmentUrl(candidateProfile.pilotPlanFilename, pilotPlanBody),
      } as DemoAttachmentDoc,
    };
  }, [candidateProfile, isCsLike]);

  useEffect(() => {
    return () => {
      [candidateAttachments.cv.url, candidateAttachments.jcfpm.url, candidateAttachments.pilot.url]
        .forEach((url) => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
    };
  }, [candidateAttachments]);

  const copy = useMemo(
    () =>
      isCsLike
        ? {
            badge: 'Demo workflow pro firmu',
            title: 'Vyzkoušejte firemní handshake stejně jako v ostré aplikaci.',
            subtitle:
              'Uvidíte celý průchod: Role Canvas, příchod kandidáta, první odpověď firmy, navazující reakce kandidáta a jasný stav bez ghostingu.',
            stepRole: '1 Role Canvas',
            stepCandidate: '2 Kandidát přichází',
            stepCompany: '3 První odpověď firmy',
            stepDone: '4 Dokončeno',
            roleLabel: 'Demo inzerát',
            roleTitle: 'Směnový koordinátor provozu (recepce + housekeeping)',
            roleCompany: 'Hotel Aurora Prague',
            roleLocation: 'Praha 1 · onsite',
            roleSalary: '38 000 - 48 000 Kč / měsíc',
            roleSummary:
              'Hledáme člověka, který stabilizuje předávání směn mezi recepcí a housekeepingem a zavede jasný provozní rytmus.',
            roleTruthTitle: 'Role truth',
            roleTruthItems: [
              'Nejtěžší je handoff mezi ranní a odpolední směnou.',
              'Bez důsledné práce s checklisty se kvalita rychle rozpadne.',
              'Po 6 týdnech potřebujeme měřitelně nižší počet eskalací hostů.',
            ],
            roleContinue: 'Pokračovat na reakce kandidáta',
            incomingBadge: 'Příchozí kandidát',
            incomingTitle: 'Kandidát reagoval na výzvu a otevřel soukromé vlákno.',
            candidateSignalOne:
              'Nejdřív bych auditoval handoff mezi směnami, vytáhl opakující se chyby a sjednotil checklist pro recepci i housekeeping.',
            candidateSignalTwo:
              'V prvním týdnu bych vedl krátké 15min standupy před každou směnou a zavedl sdílený logbook s jasnou odpovědností.',
            candidatePacket: 'Sdílené podklady kandidáta',
            candidatePacketHint: 'Kliknutím na přílohu otevřete plné znění v nové kartě.',
            candidateNameLabel: 'Kandidát',
            candidateExperienceLabel: 'Relevantní zkušenosti',
            candidateCvPreviewTitle: 'Náhled CV',
            candidateJcfpmPreviewTitle: 'Náhled JCFPM',
            candidateTraitsLabel: 'JCFPM signály',
            candidateRiskLabel: 'Rizikové místo',
            candidateCvOpen: 'Otevřít celý CV dokument',
            candidateJcfpmOpen: 'Otevřít celý JCFPM report',
            yearUnit: 'let praxe',
            incomingContinue: 'Otevřít thread firmy',
            companyReplyBadge: 'Firemní režim',
            companyReplyTitle: 'První odpověď firmy a navázání kandidáta',
            statusLabel: 'Stav',
            statusCompanyTurn: 'Čeká na vaši první odpověď firmou.',
            statusCandidateTurn: 'První odpověď odeslána. Teď je na tahu kandidát.',
            statusReady: 'Kandidát navázal. Vlákno je připravené na další krok.',
            progressTitle: 'Průchod dialogem',
            progressOne: 'Kandidát otevře thread',
            progressTwo: 'Firma odešle první odpověď',
            progressThree: 'Kandidát naváže a odemkne pokračování',
            progressDone: 'Hotovo',
            progressPending: 'Čeká',
            threadLabel: 'ID vlákna',
            threadHint: 'Stejný komponent threadu jako v production flow.',
            threadLoading: 'Přichází první zpráva kandidáta…',
            prefilledNotice: 'Odpověď firmy je předvyplněná. Stačí kliknout na Odeslat.',
            waitingCandidateNotice: 'Systém čeká na reakci kandidáta…',
            candidateReturnedNotice: 'Kandidát odpověděl. Můžete pokračovat na další krok.',
            threadHeading: 'Dialogové vlákno',
            threadSubtitle: 'Reálný asynchronní thread používaný i ve firemním dashboardu.',
            threadEmpty: 'Zatím bez zpráv.',
            composerPlaceholder:
              'Napište první odpověď firmy… (v ostrém flow lze přiložit dokument, obrázek nebo návrh smlouvy)',
            sendButton: 'Odeslat',
            prefilledCompanyReply:
              'Děkujeme za konkrétní postup. Přesně handoff mezi směnami je náš hlavní problém. Chceme pokračovat v dialogu.',
            candidateFollowup:
              'Děkuji. Připravil jsem krátký pilotní plán na 14 dní. Pokud dává smysl, pošlu ho jako další podklad.',
            nextStepButton: 'Dokončit demo',
            completedTitle: 'Demo firemního workflow je hotové.',
            completedBody:
              'Firma i kandidát reagovali, thread má jasný stav a další krok je odemčený bez nejistoty.',
            completedPrimary: 'Založit firemní účet',
            completedSecondary: 'Zpět na landing pro firmy',
            completedRestart: 'Spustit demo znovu',
          }
        : {
            badge: 'Company workflow demo',
            title: 'Try the company-side handshake flow with real UI components.',
            subtitle:
              'You get the full path: Role Canvas, candidate arrival, first company reply, candidate follow-up, and a clear no-ghosting status.',
            stepRole: '1 Role Canvas',
            stepCandidate: '2 Candidate arrives',
            stepCompany: '3 First company reply',
            stepDone: '4 Completed',
            roleLabel: 'Demo listing',
            roleTitle: 'Shift Operations Coordinator (front desk + housekeeping)',
            roleCompany: 'Hotel Aurora Prague',
            roleLocation: 'Prague 1 · onsite',
            roleSalary: 'EUR 1,550 - 1,950 / month',
            roleSummary:
              'We are hiring someone to stabilize shift handoffs between front desk and housekeeping and set a clear operating rhythm.',
            roleTruthTitle: 'Role truth',
            roleTruthItems: [
              'The hard part is handoff quality between morning and afternoon shifts.',
              'Without strict checklist ownership, quality drops quickly.',
              'Within six weeks we need measurable reduction in guest escalations.',
            ],
            roleContinue: 'Continue to candidate signal',
            incomingBadge: 'Incoming candidate',
            incomingTitle: 'A candidate replied and opened a private thread.',
            candidateSignalOne:
              'I would audit shift handoffs first, extract recurring failure points, and align one checklist for front desk and housekeeping.',
            candidateSignalTwo:
              'In week one I would run 15-minute pre-shift standups and launch a shared logbook with clear ownership.',
            candidatePacket: 'Shared candidate materials',
            candidatePacketHint: 'Click any attachment to open the full version in a new tab.',
            candidateNameLabel: 'Candidate',
            candidateExperienceLabel: 'Relevant experience',
            candidateCvPreviewTitle: 'CV preview',
            candidateJcfpmPreviewTitle: 'JCFPM preview',
            candidateTraitsLabel: 'JCFPM signals',
            candidateRiskLabel: 'Risk area',
            candidateCvOpen: 'Open full CV document',
            candidateJcfpmOpen: 'Open full JCFPM report',
            yearUnit: 'years experience',
            incomingContinue: 'Open company thread',
            companyReplyBadge: 'Company mode',
            companyReplyTitle: 'First company reply and candidate follow-up',
            statusLabel: 'Status',
            statusCompanyTurn: 'Waiting for your first company reply.',
            statusCandidateTurn: 'First reply sent. Candidate turn is active.',
            statusReady: 'Candidate replied. Thread is ready for the next step.',
            progressTitle: 'Dialogue progress',
            progressOne: 'Candidate opens the thread',
            progressTwo: 'Company sends first reply',
            progressThree: 'Candidate follows up and unlocks continuation',
            progressDone: 'Done',
            progressPending: 'Pending',
            threadLabel: 'Thread ID',
            threadHint: 'Same thread component as in production flow.',
            threadLoading: 'First candidate message is coming in…',
            prefilledNotice: 'The company reply is prefilled. Just click Send.',
            waitingCandidateNotice: 'Waiting for candidate follow-up…',
            candidateReturnedNotice: 'Candidate replied. You can move to the next step.',
            threadHeading: 'Dialogue thread',
            threadSubtitle: 'Real async thread component used in the company dashboard.',
            threadEmpty: 'No messages yet.',
            composerPlaceholder:
              'Write the first company reply… (in production you can attach a document, image, or contract draft)',
            sendButton: 'Send',
            prefilledCompanyReply:
              'Thanks for the structured approach. Shift handoff is exactly our core issue. We want to continue.',
            candidateFollowup:
              'Thank you. I prepared a short 14-day pilot plan. If useful, I can share it as the next supporting document.',
            nextStepButton: 'Complete demo',
            completedTitle: 'Company-side demo workflow completed.',
            completedBody:
              'Both sides replied, the thread has a clear state, and the next step unlocked without uncertainty.',
            completedPrimary: 'Create company account',
            completedSecondary: 'Back to company landing',
            completedRestart: 'Run demo again',
          },
    [isCsLike],
  );

  const [step, setStep] = useState<DemoCompanyStep>('role_canvas');
  const [threadOpened, setThreadOpened] = useState(false);
  const [companyReplySent, setCompanyReplySent] = useState(false);
  const [candidateFollowupArrived, setCandidateFollowupArrived] = useState(false);
  const [threadMessages, setThreadMessages] = useState<DialogueMessage[]>([]);
  const [threadStatus, setThreadStatus] = useState<'pending' | 'reviewed' | 'shortlisted'>('pending');
  const [threadCurrentTurn, setThreadCurrentTurn] = useState<'candidate' | 'company'>('company');
  const [threadDeadlineAt, setThreadDeadlineAt] = useState<string | null>(createDeadlineAt(24));
  const threadIdRef = useRef<string>(createDemoThreadId());
  const startedAtRef = useRef<number>(Date.now());
  const completedTrackedRef = useRef<boolean>(false);
  const firstCandidateTimerRef = useRef<number | null>(null);
  const candidateFollowupTimerRef = useRef<number | null>(null);

  const clearActiveTimers = useCallback(() => {
    if (firstCandidateTimerRef.current) {
      window.clearTimeout(firstCandidateTimerRef.current);
      firstCandidateTimerRef.current = null;
    }
    if (candidateFollowupTimerRef.current) {
      window.clearTimeout(candidateFollowupTimerRef.current);
      candidateFollowupTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearActiveTimers(), [clearActiveTimers]);

  const safeTrack = useCallback(
    (eventType: string, metadata: Record<string, unknown> = {}) => {
      void trackAnalyticsEvent({
        event_type: eventType,
        feature: 'demo_company_handshake',
        metadata: {
          locale,
          ...metadata,
        },
      }).catch(() => undefined);
    },
    [locale],
  );

  useEffect(() => {
    safeTrack('demo_company_handshake_opened', {
      path: typeof window !== 'undefined' ? window.location.pathname : '/demo-company-handshake',
    });
  }, [safeTrack]);

  useEffect(() => {
    if (step !== 'completed' || completedTrackedRef.current) return;
    completedTrackedRef.current = true;
    safeTrack('demo_company_handshake_completed', {
      elapsed_bucket: getElapsedBucket(Date.now() - startedAtRef.current),
    });
  }, [safeTrack, step]);

  const createMessage = useCallback(
    (
      senderRole: 'candidate' | 'recruiter',
      body: string,
      attachments: DialogueMessage['attachments'] = [],
    ): DialogueMessage => {
      const createdAt = new Date().toISOString();
      return {
        id: createMessageId(),
        application_id: threadIdRef.current,
        company_id: null,
        candidate_id: null,
        sender_user_id: null,
        sender_role: senderRole,
        body,
        attachments,
        created_at: createdAt,
        read_by_candidate_at: senderRole === 'recruiter' ? createdAt : null,
        read_by_company_at: senderRole === 'candidate' ? createdAt : null,
      };
    },
    [],
  );

  useEffect(() => {
    if (step !== 'company_reply') return;

    clearActiveTimers();
    setThreadOpened(false);
    setCompanyReplySent(false);
    setCandidateFollowupArrived(false);
    setThreadMessages([]);
    setThreadStatus('pending');
    setThreadCurrentTurn('company');
    setThreadDeadlineAt(createDeadlineAt(24));

    firstCandidateTimerRef.current = window.setTimeout(() => {
      const baseMessage = createMessage('candidate', copy.candidateSignalOne, [
        candidateAttachments.cv,
        candidateAttachments.jcfpm,
      ]);
      setThreadMessages([baseMessage]);
      setThreadOpened(true);
    }, 650);

    return () => clearActiveTimers();
  }, [candidateAttachments, clearActiveTimers, copy.candidateSignalOne, createMessage, step]);

  const fetchDemoMessages = useCallback(async () => threadMessages, [threadMessages]);

  const sendDemoMessage = useCallback(
    async (_dialogueId: string, payload: DialogueMessageCreatePayload) => {
      const body = String(payload.body || '').trim();
      const outgoingAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
      if (!body && outgoingAttachments.length === 0) return null;

      const companyMessage = createMessage('recruiter', body, outgoingAttachments);
      setThreadMessages((current) => [...current, companyMessage]);
      setCompanyReplySent(true);
      setThreadStatus('reviewed');
      setThreadCurrentTurn('candidate');
      setThreadDeadlineAt(createDeadlineAt(24));
      safeTrack('demo_company_handshake_first_reply_sent', {
        message_length: body.length,
        thread_id: threadIdRef.current,
      });

      if (candidateFollowupTimerRef.current) {
        window.clearTimeout(candidateFollowupTimerRef.current);
        candidateFollowupTimerRef.current = null;
      }

      candidateFollowupTimerRef.current = window.setTimeout(() => {
        setThreadMessages((current) => [
          ...current,
          createMessage('candidate', copy.candidateFollowup, [
            candidateAttachments.pilot,
          ]),
        ]);
        setCandidateFollowupArrived(true);
        setThreadStatus('shortlisted');
        setThreadCurrentTurn('company');
        setThreadDeadlineAt(createDeadlineAt(48));
      }, 1100);

      return companyMessage;
    },
    [candidateAttachments.pilot, copy.candidateFollowup, createMessage, safeTrack],
  );

  const handleRestart = () => {
    safeTrack('demo_company_handshake_cta_clicked', { cta_type: 'restart_demo' });
    clearActiveTimers();
    startedAtRef.current = Date.now();
    completedTrackedRef.current = false;
    threadIdRef.current = createDemoThreadId();
    setCandidateProfile(createDemoCandidateProfile(isCsLike));
    setStep('role_canvas');
    setThreadOpened(false);
    setCompanyReplySent(false);
    setCandidateFollowupArrived(false);
    setThreadMessages([]);
    setThreadStatus('pending');
    setThreadCurrentTurn('company');
    setThreadDeadlineAt(createDeadlineAt(24));
  };

  const openRegister = () => {
    safeTrack('demo_company_handshake_cta_clicked', { cta_type: 'register' });
    onRegister?.();
  };

  const backToLanding = () => {
    safeTrack('demo_company_handshake_cta_clicked', { cta_type: 'back_to_company_landing' });
    onBackToCompanyLanding?.();
  };

  const stepIndex = useMemo(() => {
    const order: DemoCompanyStep[] = ['role_canvas', 'incoming_candidate', 'company_reply', 'completed'];
    return order.indexOf(step) + 1;
  }, [step]);

  const statusText = candidateFollowupArrived
    ? copy.statusReady
    : companyReplySent
      ? copy.statusCandidateTurn
      : copy.statusCompanyTurn;

  const progress = [
    { key: 'p1', label: copy.progressOne, done: threadOpened },
    { key: 'p2', label: copy.progressTwo, done: companyReplySent },
    { key: 'p3', label: copy.progressThree, done: candidateFollowupArrived },
  ];

  return (
    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar px-1">
      <section className="mx-auto w-full max-w-6xl rounded-[1.4rem] border border-slate-200/80 dark:border-slate-800 bg-white/86 dark:bg-slate-900/70 p-5 lg:p-7 shadow-[0_22px_50px_-40px_rgba(15,23,42,0.38)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/70 dark:border-cyan-800 bg-cyan-50/80 dark:bg-cyan-900/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
            <Sparkles size={12} />
            {copy.badge}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <Clock3 size={12} />
            2-3 min
          </div>
        </div>

        <h1 className="mt-4 text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          {copy.subtitle}
        </p>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            ['role_canvas', copy.stepRole],
            ['incoming_candidate', copy.stepCandidate],
            ['company_reply', copy.stepCompany],
            ['completed', copy.stepDone],
          ].map(([key, label], index) => {
            const reached = index < stepIndex;
            return (
              <div
                key={key}
                className={`rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                  reached
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/30 text-slate-500 dark:text-slate-400'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>
      </section>

      {step === 'role_canvas' && (
        <section className="mx-auto mt-4 w-full max-w-6xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-white/88 dark:bg-slate-900/66 p-5 lg:p-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/80 dark:bg-cyan-950/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
              <Briefcase size={12} />
              {copy.roleLabel}
            </div>
            <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{copy.roleTitle}</h3>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{copy.roleCompany}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                {copy.roleLocation}
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                {copy.roleSalary}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{copy.roleSummary}</p>
            <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
                {copy.roleTruthTitle}
              </div>
              <ul className="mt-1.5 space-y-1.5 text-sm text-amber-950 dark:text-amber-100">
                {copy.roleTruthItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('incoming_candidate')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-400 transition-colors"
          >
            {copy.roleContinue}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'incoming_candidate' && (
        <section className="mx-auto mt-4 w-full max-w-6xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-white/88 dark:bg-slate-900/66 p-5 lg:p-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            <UserRound size={14} />
            {copy.incomingBadge}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{copy.incomingTitle}</h2>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/35 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {copy.candidateSignalOne}
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/35 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {copy.candidateSignalTwo}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/70 dark:bg-cyan-950/20 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">{copy.candidatePacket}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[candidateAttachments.cv, candidateAttachments.jcfpm].map((item) => (
                <a
                  key={item.name}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-cyan-200/80 dark:border-cyan-900/50 bg-white/90 dark:bg-slate-900/55 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {item.name}
                </a>
              ))}
            </div>
            <div className="mt-2 text-xs text-cyan-800/90 dark:text-cyan-200/90">{copy.candidatePacketHint}</div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-cyan-200/70 dark:border-cyan-900/40 bg-white/80 dark:bg-slate-900/45 p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                  {copy.candidateCvPreviewTitle}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {copy.candidateNameLabel}: {candidateProfile.name}
                </div>
                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {candidateProfile.title} · {candidateProfile.yearsExperience} {copy.yearUnit}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {copy.candidateExperienceLabel}
                </div>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {candidateProfile.experiences.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a
                  href={candidateAttachments.cv.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  {copy.candidateCvOpen}
                </a>
              </div>

              <div className="rounded-lg border border-cyan-200/70 dark:border-cyan-900/40 bg-white/80 dark:bg-slate-900/45 p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                  {copy.candidateJcfpmPreviewTitle}
                </div>
                <div className="mt-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {candidateProfile.jcfpmSummary}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {copy.candidateTraitsLabel}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidateProfile.jcfpmTraits.map((trait) => (
                    <span
                      key={trait.label}
                      className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/60 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200"
                    >
                      {trait.label}: {trait.score}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {copy.candidateRiskLabel}
                </div>
                <div className="mt-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {candidateProfile.jcfpmRisk}
                </div>
                <a
                  href={candidateAttachments.jcfpm.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  {copy.candidateJcfpmOpen}
                </a>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('company_reply')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-400 transition-colors"
          >
            {copy.incomingContinue}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'company_reply' && (
        <section className="mx-auto mt-4 w-full max-w-6xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.08),_transparent_36%),linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(248,250,252,0.84))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_36%),linear-gradient(180deg,_rgba(15,23,42,0.82),_rgba(2,6,23,0.74))] p-5 lg:p-6">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {copy.companyReplyBadge}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{copy.companyReplyTitle}</h2>

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-3">
            <aside className="space-y-3">
              <div className="rounded-[1rem] border border-sky-200/80 dark:border-sky-900/40 bg-sky-50/75 dark:bg-sky-950/20 px-4 py-3.5">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                  {copy.statusLabel}
                </div>
                <div className="mt-1.5 text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">
                  {statusText}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {threadCurrentTurn === 'candidate' ? '24 h' : '48 h'}
                </div>
              </div>

              <div className="rounded-[1rem] border border-slate-200/80 dark:border-slate-700 bg-white/85 dark:bg-slate-950/30 px-4 py-3.5">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {copy.progressTitle}
                </div>
                <div className="mt-2 space-y-2">
                  {progress.map((item) => (
                    <div key={item.key} className="flex items-start gap-2">
                      <CheckCircle2
                        size={15}
                        className={item.done ? 'mt-0.5 text-emerald-600 dark:text-emerald-300' : 'mt-0.5 text-slate-400 dark:text-slate-500'}
                      />
                      <div>
                        <div className={`text-sm ${item.done ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          {item.label}
                        </div>
                        <div className={`text-[11px] ${item.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.done ? copy.progressDone : copy.progressPending}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1rem] border border-amber-200/70 bg-[linear-gradient(160deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.86))] px-3.5 py-3.5 shadow-[0_18px_34px_-30px_rgba(120,53,15,0.35)] dark:border-amber-900/40 dark:bg-[linear-gradient(160deg,_rgba(69,26,3,0.35),_rgba(15,23,42,0.72))]">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">{copy.threadLabel}</div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {threadIdRef.current}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {copy.threadHint}
                </div>
              </div>
            </aside>

            <div className="space-y-3">
              {!threadOpened && (
                <div className="rounded-[0.95rem] border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500 animate-pulse mr-2" />
                  {copy.threadLoading}
                </div>
              )}
              {threadOpened && !companyReplySent && (
                <div className="rounded-[0.95rem] border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
                  {copy.prefilledNotice}
                </div>
              )}
              {companyReplySent && !candidateFollowupArrived && (
                <div className="rounded-[0.95rem] border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                  {copy.waitingCandidateNotice}
                </div>
              )}
              {candidateFollowupArrived && (
                <div className="rounded-[0.95rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                  {copy.candidateReturnedNotice}
                </div>
              )}

              <ApplicationMessageCenter
                dialogueId={threadIdRef.current}
                applicationId={threadIdRef.current}
                viewerRole="recruiter"
                visualVariant="immersive"
                dialogueStatus={threadStatus}
                dialogueDeadlineAt={threadDeadlineAt}
                dialogueTimeoutHours={48}
                dialogueCurrentTurn={threadCurrentTurn}
                dialogueClosedReason={null}
                dialogueIsOverdue={false}
                heading={copy.threadHeading}
                subtitle={copy.threadSubtitle}
                emptyText={copy.threadEmpty}
                initialDraft={copy.prefilledCompanyReply}
                composerPlaceholder={copy.composerPlaceholder}
                sendButtonLabel={copy.sendButton}
                allowAttachments={false}
                showAttachmentPlaceholderWhenDisabled
                fetchMessages={fetchDemoMessages}
                sendMessage={sendDemoMessage}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('completed')}
            disabled={!candidateFollowupArrived}
            className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              candidateFollowupArrived
                ? 'bg-orange-500 text-white hover:bg-orange-400'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 cursor-not-allowed'
            }`}
          >
            {copy.nextStepButton}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'completed' && (
        <section className="mx-auto mt-4 mb-2 w-full max-w-6xl rounded-[1.2rem] border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 lg:p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/35 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={20} />
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{copy.completedTitle}</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{copy.completedBody}</p>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={openRegister}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 dark:bg-white px-4 py-2.5 text-sm font-bold text-white dark:text-slate-950"
            >
              {copy.completedPrimary}
            </button>
            <button
              type="button"
              onClick={backToLanding}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-950/35 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              {copy.completedSecondary}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {copy.completedRestart}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default DemoCompanyHandshakePage;
