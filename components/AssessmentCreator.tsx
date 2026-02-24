
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Assessment, CompanyProfile, Job } from '../types';
import { generateAssessment, extractSkillsFromJob } from '../services/geminiService';
import { FEATURE_ASSESSMENT_THREE } from '../constants';
import { useSceneCapability } from '../hooks/useSceneCapability';
import SceneShell from './three/SceneShell';
import NebulaOfPotential from './three/NebulaOfPotential';
import ValueResonance from './three/ValueResonance';

import { incrementAssessmentUsage } from '../services/supabaseService';
import { getRemainingAssessments } from '../services/billingService';
import AnalyticsService from '../services/analyticsService';
import PlanUpgradeModal from './PlanUpgradeModal';
import { openAssessmentPreviewPage } from '../services/assessmentPreviewNavigation';
import { BrainCircuit, Loader2, Code, FileText, CheckCircle, Copy, BarChart3, Eye, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AssessmentCreatorProps {
    companyProfile?: CompanyProfile | null;
    jobs?: Job[];
    initialJobId?: string;
}

interface DemoAssessmentTemplate {
    id: string;
    role: string;
    difficulty: string;
    skills: string[];
    assessment: Assessment;
}

const AssessmentCreator: React.FC<AssessmentCreatorProps> = ({ companyProfile, jobs = [], initialJobId }) => {
    const { t, i18n } = useTranslation();
    const [role, setRole] = useState('');
    const [skills, setSkills] = useState('');
    const [difficulty, setDifficulty] = useState('Senior');
    const [isGenerating, setIsGenerating] = useState(false);
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState(initialJobId || '');
    const [isExtracting, setIsExtracting] = useState(false);
    const [selectedDemoOutputId, setSelectedDemoOutputId] = useState<string>('demo-backend-senior');
    const [showDemoCenter, setShowDemoCenter] = useState(false);
    const [showThreePreview, setShowThreePreview] = useState<boolean>(FEATURE_ASSESSMENT_THREE);
    const demoOutputRef = useRef<HTMLDivElement>(null);
    const sceneCapability = useSceneCapability();

    const getStringList = (key: string, fallback: string[] = []): string[] => {
        const list = t(key, { returnObjects: true, defaultValue: fallback }) as unknown;
        return Array.isArray(list) ? list.map((item) => String(item)) : fallback;
    };

    const demoAssessments = useMemo<DemoAssessmentTemplate[]>(() => {
        const withMinQuestions = (
            base: Assessment['questions'],
            extra: Assessment['questions'],
            minCount: number = 15
        ): Assessment['questions'] => [...base, ...extra].slice(0, Math.max(minCount, base.length));

        const backendExtraQuestions: Assessment['questions'] = [
            { id: 'be4', text: 'Jak byste navrhl/a versioning API bez rozbití klientů?', type: 'Open', category: 'Technical' },
            { id: 'be5', text: 'Napište SQL dotaz pro výpočet mediánu mzdy v segmentu role+region.', type: 'Code', category: 'Practical' },
            { id: 'be6', text: 'Který přístup je nejlepší pro audit trail?', type: 'MultipleChoice', category: 'Logic', options: ['Immutable append-only log', 'Přepis původních záznamů', 'Mazání historických dat', 'Náhodný sampling logů'], correctAnswer: 'Immutable append-only log' },
            { id: 'be7', text: 'Jak byste řešil/a idempotenci při opakovaném submitu benchmark refresh jobu?', type: 'Scenario', category: 'Situational' },
            { id: 'be8', text: 'Popište strategii cache invalidace pro data s denním refreshem.', type: 'Open', category: 'Technical' },
            { id: 'be9', text: 'Napište pseudokód pro fallback: region -> stát -> veřejný zdroj.', type: 'Code', category: 'Practical' },
            { id: 'be10', text: 'Co je správný způsob práce s PII v logování?', type: 'MultipleChoice', category: 'Logic', options: ['Maskovat/scrubovat citlivá data', 'Logovat vše pro debugging', 'PII ignorovat až v BI vrstvě', 'Posílat PII do client logu'], correctAnswer: 'Maskovat/scrubovat citlivá data' },
            { id: 'be11', text: 'Jak byste monitoroval/a kvalitu benchmark endpointu v produkci?', type: 'Open', category: 'Practical' },
            { id: 'be12', text: 'Incident: endpoint vrací stale data 3 dny. Jaký je váš postup?', type: 'Scenario', category: 'Situational' },
            { id: 'be13', text: 'Napište strukturu response DTO pro transparentní benchmark metadata.', type: 'Code', category: 'Technical' },
            { id: 'be14', text: 'Který signál nejlépe určuje nízkou confidence segmentu?', type: 'MultipleChoice', category: 'Logic', options: ['Nízké N + vysoký IQR + stará data', 'Pouze vysoké N', 'Pouze malý IQR', 'Pouze poslední refresh'], correctAnswer: 'Nízké N + vysoký IQR + stará data' },
            { id: 'be15', text: 'Jak byste komunikoval/a fallback na národní benchmark uživateli v UI?', type: 'Open', category: 'Situational' },
        ];

        const cncExtraQuestions: Assessment['questions'] = [
            { id: 'cnc4', text: 'Jak ověříte správné upnutí polotovaru před sérií?', type: 'Open', category: 'Practical' },
            { id: 'cnc5', text: 'Který dokument použijete pro kontrolu tolerancí?', type: 'MultipleChoice', category: 'Logic', options: ['Technický výkres a kontrolní plán', 'Pouze ústní instrukce', 'Starý výrobní list', 'Bez dokumentace'], correctAnswer: 'Technický výkres a kontrolní plán' },
            { id: 'cnc6', text: 'Stroj začne vibrovat po výměně nástroje. Jak postupujete?', type: 'Scenario', category: 'Situational' },
            { id: 'cnc7', text: 'Popište postup první kusové kontroly.', type: 'Open', category: 'Practical' },
            { id: 'cnc8', text: 'Jaký je správný krok při zjištění opotřebení nástroje?', type: 'MultipleChoice', category: 'Logic', options: ['Zastavit, přeměřit, vyměnit/korigovat', 'Ignorovat a dojet sérii', 'Zvýšit rychlost', 'Snížit kvalitu kontroly'], correctAnswer: 'Zastavit, přeměřit, vyměnit/korigovat' },
            { id: 'cnc9', text: 'Jak zapisujete odchylky do výrobní dokumentace?', type: 'Open', category: 'Technical' },
            { id: 'cnc10', text: 'Požárně-bezpečnostní incident u chlazení: co je priorita?', type: 'Scenario', category: 'Situational' },
            { id: 'cnc11', text: 'Kdy je vhodné použít korekci v programu místo ručního zásahu?', type: 'Open', category: 'Technical' },
            { id: 'cnc12', text: 'Který indikátor nejlépe signalizuje ztrátu stability procesu?', type: 'MultipleChoice', category: 'Logic', options: ['Rostoucí rozptyl měření', 'Stejné časy cyklu', 'Stálá kvalita kusů', 'Nulové alarmy'], correctAnswer: 'Rostoucí rozptyl měření' },
            { id: 'cnc13', text: 'Jak byste řešil/a konflikt mezi rychlostí výroby a kvalitou?', type: 'Scenario', category: 'Situational' },
            { id: 'cnc14', text: 'Popište bezpečný restart stroje po nouzovém zastavení.', type: 'Open', category: 'Practical' },
            { id: 'cnc15', text: 'Jak byste zaškolil/a nového kolegu na kritické kontrolní body?', type: 'Open', category: 'Situational' },
        ];

        const nurseExtraQuestions: Assessment['questions'] = [
            { id: 'nur4', text: 'Jak ověřujete identitu pacienta před podáním léků?', type: 'Open', category: 'Practical' },
            { id: 'nur5', text: 'Který krok je klíčový při handoveru na směně?', type: 'MultipleChoice', category: 'Logic', options: ['SBAR/strukturované předání', 'Krátká poznámka bez detailu', 'Pouze verbální briefing', 'Žádné předání'], correctAnswer: 'SBAR/strukturované předání' },
            { id: 'nur6', text: 'Náhlé zhoršení stavu pacienta: jaké jsou první 3 kroky?', type: 'Scenario', category: 'Situational' },
            { id: 'nur7', text: 'Jak dokumentujete nežádoucí reakci na léčbu?', type: 'Open', category: 'Technical' },
            { id: 'nur8', text: 'Pacient odmítá léčbu. Jak postupujete?', type: 'Scenario', category: 'Situational' },
            { id: 'nur9', text: 'Jak udržujete komunikaci s rodinou pacienta při vysoké zátěži?', type: 'Open', category: 'Practical' },
            { id: 'nur10', text: 'Který ukazatel pomáhá prioritizovat péči na oddělení?', type: 'MultipleChoice', category: 'Logic', options: ['Klinická závažnost + riziko', 'Pořadí přijetí', 'Délka pobytu', 'Sympatie personálu'], correctAnswer: 'Klinická závažnost + riziko' },
            { id: 'nur11', text: 'Jak byste řešil/a chybu v dokumentaci z předchozí směny?', type: 'Scenario', category: 'Situational' },
            { id: 'nur12', text: 'Popište prevenci medikačních chyb ve vašem pracovním rytmu.', type: 'Open', category: 'Practical' },
            { id: 'nur13', text: 'Kdy eskalujete stav přímo lékaři bez odkladu?', type: 'Open', category: 'Technical' },
            { id: 'nur14', text: 'Konflikt v týmu během urgentní situace: jak postupujete?', type: 'Scenario', category: 'Situational' },
            { id: 'nur15', text: 'Jak pečujete o vlastní psychickou hygienu při směnném provozu?', type: 'Open', category: 'Practical' },
        ];

        const salesExtraQuestions: Assessment['questions'] = [
            { id: 'sal4', text: 'Jak kvalifikujete lead před prvním callem?', type: 'Open', category: 'Practical' },
            { id: 'sal5', text: 'Který signál nejvíce ukazuje reálný buying intent?', type: 'MultipleChoice', category: 'Logic', options: ['Zapojení decision makerů', 'Počet likes na LinkedIn', 'Rychlá odpověď bez detailu', 'Počet stažení PDF'], correctAnswer: 'Zapojení decision makerů' },
            { id: 'sal6', text: 'Klient má dlouhý procurement proces. Jak držíte momentum?', type: 'Scenario', category: 'Situational' },
            { id: 'sal7', text: 'Popište, jak vedete discovery interview.', type: 'Open', category: 'Practical' },
            { id: 'sal8', text: 'Jak pracujete s námitkou „je to drahé“?', type: 'Scenario', category: 'Situational' },
            { id: 'sal9', text: 'Která metrika je nejlepší leading indicator forecast accuracy?', type: 'MultipleChoice', category: 'Logic', options: ['Stage-to-stage conversion quality', 'Počet odeslaných zpráv', 'Počet callů', 'Počet otevřených leadů'], correctAnswer: 'Stage-to-stage conversion quality' },
            { id: 'sal10', text: 'Jak v CRM zapisujete next step tak, aby byl auditovatelný?', type: 'Open', category: 'Technical' },
            { id: 'sal11', text: 'Deal stagnuje 45 dní. Jaký je váš recovery plán?', type: 'Scenario', category: 'Situational' },
            { id: 'sal12', text: 'Jak vyvažujete short-term target a long-term relationship?', type: 'Open', category: 'Practical' },
            { id: 'sal13', text: 'Kdy je správné disqualify příležitost?', type: 'MultipleChoice', category: 'Logic', options: ['Bez budgetu, authority i timeline', 'Když klient chce slevu', 'Po prvním no', 'Nikdy'], correctAnswer: 'Bez budgetu, authority i timeline' },
            { id: 'sal14', text: 'Jak připravíte interní handover po uzavření dealu?', type: 'Open', category: 'Technical' },
            { id: 'sal15', text: 'Jak byste vedl/a retrospektivu z prohraného obchodu?', type: 'Scenario', category: 'Situational' },
            { id: 'sal16', text: 'EN mini-test: Rewrite this sentence to be more consultative: "Our tool has many features."', type: 'Open', category: 'Practical' },
            { id: 'sal17', text: 'EN mini-test: Which sentence is strongest for value selling?', type: 'MultipleChoice', category: 'Logic', options: ['Our product has 20 modules.', 'We reduce onboarding time by 35% in 60 days.', 'We are innovative and dynamic.', 'Our UI is modern.'], correctAnswer: 'We reduce onboarding time by 35% in 60 days.' },
            { id: 'sal18', text: 'EN mini-test: Respond to objection in one short message: "Your price is too high."', type: 'Open', category: 'Situational' },
        ];

        const supportExtraQuestions: Assessment['questions'] = [
            { id: 'cs4', text: 'Jak stanovíte prioritu incidentu při více paralelních tiketech?', type: 'Open', category: 'Practical' },
            { id: 'cs5', text: 'Který faktor je nejdůležitější pro správnou eskalaci?', type: 'MultipleChoice', category: 'Logic', options: ['Business impact + SLA risk', 'Délka textu ticketu', 'Počet emoji', 'Nálada zákazníka'], correctAnswer: 'Business impact + SLA risk' },
            { id: 'cs6', text: 'Zákazník píše agresivně. Jak udržíte profesionální tón?', type: 'Scenario', category: 'Situational' },
            { id: 'cs7', text: 'Popište, co má obsahovat kvalitní interní poznámka k ticketu.', type: 'Open', category: 'Technical' },
            { id: 'cs8', text: 'Jak validujete, že workaround skutečně řeší root issue?', type: 'Open', category: 'Practical' },
            { id: 'cs9', text: 'Kdy eskalujete incident na L2/L3 bez čekání?', type: 'MultipleChoice', category: 'Logic', options: ['Riziko výpadku služby / SLA breach', 'Když je hodně ticketů', 'Když zákazník spěchá', 'Po 24 hodinách vždy'], correctAnswer: 'Riziko výpadku služby / SLA breach' },
            { id: 'cs10', text: 'Jak postupujete při opakovaném incidentu se stejnou příčinou?', type: 'Scenario', category: 'Situational' },
            { id: 'cs11', text: 'Jak měříte kvalitu své komunikace se zákazníkem?', type: 'Open', category: 'Practical' },
            { id: 'cs12', text: 'Která metrika nejlépe vystihuje zdraví support procesu?', type: 'MultipleChoice', category: 'Logic', options: ['First response + resolution quality', 'Počet uzavřených ticketů', 'Délka interních meetingů', 'Počet CC v e-mailu'], correctAnswer: 'First response + resolution quality' },
            { id: 'cs13', text: 'Jak byste připravil/a post-incident summary pro zákazníka?', type: 'Open', category: 'Technical' },
            { id: 'cs14', text: 'Produktový bug bez ETA. Jak transparentně komunikujete zákazníkovi?', type: 'Scenario', category: 'Situational' },
            { id: 'cs15', text: 'Jaké kroky uděláte, aby se incident neopakoval?', type: 'Open', category: 'Practical' },
        ];

        return [
        {
            id: 'demo-backend-senior',
            role: t('assessment_creator.demo_center.templates.backend.role', { defaultValue: 'Senior Backend Engineer' }),
            difficulty: t('assessment_creator.demo_center.templates.backend.difficulty', { defaultValue: 'Senior' }),
            skills: getStringList('assessment_creator.demo_center.templates.backend.skills', ['Python', 'FastAPI', 'PostgreSQL', 'API design', 'System design']),
            assessment: {
                id: 'demo-backend-senior',
                title: t('assessment_creator.demo_center.templates.backend.title', { defaultValue: 'Demo: Senior Backend Engineer' }),
                role: t('assessment_creator.demo_center.templates.backend.role', { defaultValue: 'Senior Backend Engineer' }),
                description: t('assessment_creator.demo_center.templates.backend.description', { defaultValue: 'Ukázka assessmentu pro seniorní backend pozici.' }),
                timeLimitSeconds: 3600,
                createdAt: new Date().toISOString(),
                questions: withMinQuestions([
                    { id: 'be1', text: t('assessment_creator.demo_center.templates.backend.questions.q1', { defaultValue: 'Navrhněte API pro auditovatelný salary benchmark s fallback logikou.' }), type: 'Open', category: 'Technical' },
                    { id: 'be2', text: t('assessment_creator.demo_center.templates.backend.questions.q2', { defaultValue: 'Napište pseudokód pro confidence score založené na sample_size, variance, recency.' }), type: 'Code', category: 'Practical' },
                    { id: 'be3', text: t('assessment_creator.demo_center.templates.backend.questions.q3', { defaultValue: 'Jak byste řešil/a regresi výkonu endpointu při 10x vyšší zátěži?' }), type: 'Scenario', category: 'Situational' }
                ], backendExtraQuestions)
            }
        },
        {
            id: 'demo-cnc-operator',
            role: t('assessment_creator.demo_center.templates.cnc.role', { defaultValue: 'CNC Operátor' }),
            difficulty: t('assessment_creator.demo_center.templates.cnc.difficulty', { defaultValue: 'Medior' }),
            skills: getStringList('assessment_creator.demo_center.templates.cnc.skills', ['CNC', 'Technická dokumentace', 'Měření', 'Bezpečnost práce']),
            assessment: {
                id: 'demo-cnc-operator',
                title: t('assessment_creator.demo_center.templates.cnc.title', { defaultValue: 'Demo: CNC Operátor' }),
                role: t('assessment_creator.demo_center.templates.cnc.role', { defaultValue: 'CNC Operátor' }),
                description: t('assessment_creator.demo_center.templates.cnc.description', { defaultValue: 'Ukázka assessmentu pro výrobu a strojírenství.' }),
                timeLimitSeconds: 3000,
                createdAt: new Date().toISOString(),
                questions: withMinQuestions([
                    { id: 'cnc1', text: t('assessment_creator.demo_center.templates.cnc.questions.q1', { defaultValue: 'Jak postupujete při nastavení nového programu na CNC stroji?' }), type: 'Open', category: 'Practical' },
                    { id: 'cnc2', text: t('assessment_creator.demo_center.templates.cnc.questions.q2', { defaultValue: 'Co uděláte, když měření ukáže odchylku mimo toleranci?' }), type: 'Scenario', category: 'Situational' },
                    {
                        id: 'cnc3',
                        text: t('assessment_creator.demo_center.templates.cnc.questions.q3', { defaultValue: 'Který krok je nejdůležitější před spuštěním série?' }),
                        type: 'MultipleChoice',
                        category: 'Logic',
                        options: getStringList('assessment_creator.demo_center.templates.cnc.questions.q3_options', ['Kontrola nástroje a nulových bodů', 'Zrychlení posuvu', 'Přeskočení zkušebního kusu', 'Vypnutí chlazení'])
                    }
                ], cncExtraQuestions)
            }
        },
        {
            id: 'demo-nurse',
            role: t('assessment_creator.demo_center.templates.nurse.role', { defaultValue: 'Všeobecná sestra' }),
            difficulty: t('assessment_creator.demo_center.templates.nurse.difficulty', { defaultValue: 'Medior' }),
            skills: getStringList('assessment_creator.demo_center.templates.nurse.skills', ['Klinická péče', 'Komunikace s pacientem', 'Triáž', 'Dokumentace']),
            assessment: {
                id: 'demo-nurse',
                title: t('assessment_creator.demo_center.templates.nurse.title', { defaultValue: 'Demo: Všeobecná sestra' }),
                role: t('assessment_creator.demo_center.templates.nurse.role', { defaultValue: 'Všeobecná sestra' }),
                description: t('assessment_creator.demo_center.templates.nurse.description', { defaultValue: 'Ukázka assessmentu pro zdravotnickou roli.' }),
                timeLimitSeconds: 3000,
                createdAt: new Date().toISOString(),
                questions: withMinQuestions([
                    { id: 'nur1', text: t('assessment_creator.demo_center.templates.nurse.questions.q1', { defaultValue: 'Jak prioritizujete pacienty při náhlém zvýšení příjmu na oddělení?' }), type: 'Scenario', category: 'Situational' },
                    { id: 'nur2', text: t('assessment_creator.demo_center.templates.nurse.questions.q2', { defaultValue: 'Popište, jak předáváte kritickou informaci lékaři a týmu.' }), type: 'Open', category: 'Practical' },
                    {
                        id: 'nur3',
                        text: t('assessment_creator.demo_center.templates.nurse.questions.q3', { defaultValue: 'Který princip je klíčový pro bezpečné podání medikace?' }),
                        type: 'MultipleChoice',
                        category: 'Logic',
                        options: getStringList('assessment_creator.demo_center.templates.nurse.questions.q3_options', ['5P pravidlo', 'Rychlost podání za každou cenu', 'Bez dokumentace', 'Pouze verbální potvrzení'])
                    }
                ], nurseExtraQuestions)
            }
        },
        {
            id: 'demo-b2b-sales',
            role: t('assessment_creator.demo_center.templates.sales.role', { defaultValue: 'B2B Obchodní zástupce' }),
            difficulty: t('assessment_creator.demo_center.templates.sales.difficulty', { defaultValue: 'Senior' }),
            skills: getStringList('assessment_creator.demo_center.templates.sales.skills', ['Prospecting', 'Vyjednávání', 'CRM', 'Obchodní strategie']),
            assessment: {
                id: 'demo-b2b-sales',
                title: t('assessment_creator.demo_center.templates.sales.title', { defaultValue: 'Demo: B2B Obchodní zástupce' }),
                role: t('assessment_creator.demo_center.templates.sales.role', { defaultValue: 'B2B Obchodní zástupce' }),
                description: t('assessment_creator.demo_center.templates.sales.description', { defaultValue: 'Ukázka assessmentu pro obchodní pozici.' }),
                timeLimitSeconds: 3000,
                createdAt: new Date().toISOString(),
                questions: withMinQuestions([
                    { id: 'sal1', text: t('assessment_creator.demo_center.templates.sales.questions.q1', { defaultValue: 'Jak byste otevřel/a první schůzku s novým enterprise klientem?' }), type: 'Open', category: 'Practical' },
                    { id: 'sal2', text: t('assessment_creator.demo_center.templates.sales.questions.q2', { defaultValue: 'Klient tlačí na cenu a hrozí odchodem. Jak reagujete?' }), type: 'Scenario', category: 'Situational' },
                    {
                        id: 'sal3',
                        text: t('assessment_creator.demo_center.templates.sales.questions.q3', { defaultValue: 'Který metriku sledujete jako leading indicator pipeline quality?' }),
                        type: 'MultipleChoice',
                        category: 'Logic',
                        options: getStringList('assessment_creator.demo_center.templates.sales.questions.q3_options', ['Qualified meeting rate', 'Počet poslaných e-mailů', 'Počet callů bez kontextu', 'Počet otevřených tabů'])
                    }
                ], salesExtraQuestions, 18)
            }
        },
        {
            id: 'demo-cs-support',
            role: t('assessment_creator.demo_center.templates.support.role', { defaultValue: 'Customer Support Specialist' }),
            difficulty: t('assessment_creator.demo_center.templates.support.difficulty', { defaultValue: 'Junior' }),
            skills: getStringList('assessment_creator.demo_center.templates.support.skills', ['Zákaznická komunikace', 'Empatie', 'Ticketing', 'Řešení incidentů']),
            assessment: {
                id: 'demo-cs-support',
                title: t('assessment_creator.demo_center.templates.support.title', { defaultValue: 'Demo: Customer Support Specialist' }),
                role: t('assessment_creator.demo_center.templates.support.role', { defaultValue: 'Customer Support Specialist' }),
                description: t('assessment_creator.demo_center.templates.support.description', { defaultValue: 'Ukázka assessmentu pro support roli.' }),
                timeLimitSeconds: 2400,
                createdAt: new Date().toISOString(),
                questions: withMinQuestions([
                    { id: 'cs1', text: t('assessment_creator.demo_center.templates.support.questions.q1', { defaultValue: 'Jak byste odpověděl/a zákazníkovi, který je frustrovaný po výpadku?' }), type: 'Open', category: 'Situational' },
                    {
                        id: 'cs2',
                        text: t('assessment_creator.demo_center.templates.support.questions.q2', { defaultValue: 'Jak rozlišíte urgentní ticket od běžného?' }),
                        type: 'MultipleChoice',
                        category: 'Logic',
                        options: getStringList('assessment_creator.demo_center.templates.support.questions.q2_options', ['Dopad + priorita + SLA', 'Počet vykřičníků', 'Délka textu', 'Náhodně'])
                    },
                    { id: 'cs3', text: t('assessment_creator.demo_center.templates.support.questions.q3', { defaultValue: 'Popište postup před eskalací problému na technický tým.' }), type: 'Open', category: 'Practical' }
                ], supportExtraQuestions)
            }
        }
    ];
    }, [t, i18n.language]);

    // React to initialJobId prop changes
    useEffect(() => {
        if (initialJobId) {
            handleJobSelect(initialJobId);
        }
    }, [initialJobId]);

    // Auto-fill when job is selected
    const handleJobSelect = async (jobId: string) => {
        setSelectedJobId(jobId);
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            setRole(job.title);
            if (job.required_skills && job.required_skills.length > 0) {
                setSkills(job.required_skills.join(', '));
            } else {
                // Try to extract skills from description
                setIsExtracting(true);
                try {
                    const extracted = await extractSkillsFromJob(job.title, job.description);
                    if (extracted.length > 0) {
                        setSkills(extracted.join(', '));
                    } else {
                        setSkills('');
                    }
                } catch (e) {
                    setSkills('');
                } finally {
                    setIsExtracting(false);
                }
            }
        }
    };

    const handleGenerate = async () => {
        if (!role || !skills) return;

        // Check assessment limits for companies
        if (companyProfile) {
            const tier = companyProfile.subscription?.tier || 'starter';
            const used = companyProfile.subscription?.usage?.aiAssessmentsUsed || 0;
            const limit =
                tier === 'enterprise' ? 999999 :
                tier === 'professional' ? 150 :
                tier === 'growth' ? 60 :
                tier === 'starter' ? 15 :
                0;

            if (used >= limit) {
                alert(t('assessment_creator.limit_reached', { limit }));
                return;
            }
        }

        setIsGenerating(true);
        try {
            const result = await generateAssessment(role, skills.split(','), difficulty);
            setAssessment(result);

            // Track usage for companies
            if (companyProfile?.id) {
                await incrementAssessmentUsage(companyProfile.id);

                // Track feature usage analytics
                AnalyticsService.trackFeatureUsage({
                    companyId: companyProfile.id,
                    feature: 'ASSESSMENT_GENERATION',
                    tier: companyProfile.subscription?.tier || 'starter'
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    // Calculate remaining assessments
    const remainingAssessments = companyProfile ? getRemainingAssessments(companyProfile) : 0;
    const tier = companyProfile?.subscription?.tier || 'starter';
    const loadDemoTemplate = (template: DemoAssessmentTemplate) => {
        setRole(template.role);
        setDifficulty(template.difficulty);
        setSkills(template.skills.join(', '));
        setAssessment(template.assessment);
    };
    const previewDemoTemplate = (template: DemoAssessmentTemplate) => {
        setAssessment(template.assessment);
        openAssessmentPreviewPage(template.assessment);
    };
    const demoOutputMap: Record<string, {
        finalScore: number;
        recommendation: 'recommend' | 'conditional' | 'not_recommend';
        technical: { label: string; value: number }[];
        psychProfile: { label: string; value: number }[];
        dimensionEvidence: {
            dimension: string;
            score: number;
            weight: number;
            confidence: 'low' | 'medium' | 'high';
            evidence: string[];
            source: string;
        }[];
        strengths: string[];
        risks: string[];
        methodology: string[];
        aiNarrative: string[];
        interviewFocus: string[];
        confidence: 'low' | 'medium' | 'high';
        cultureFitMatch: number;
        cultureFitNotes: string[];
    }> = {
        'demo-backend-senior': {
            finalScore: 78,
            recommendation: 'recommend',
            technical: [
                { label: t('assessment_creator.demo_center.outputs.backend.technical.0', { defaultValue: 'API design' }), value: 82 },
                { label: t('assessment_creator.demo_center.outputs.backend.technical.1', { defaultValue: 'System thinking' }), value: 76 },
                { label: t('assessment_creator.demo_center.outputs.backend.technical.2', { defaultValue: 'Data quality mindset' }), value: 79 }
            ],
            psychProfile: [
                { label: t('assessment_creator.demo_center.outputs.backend.psych.0', { defaultValue: 'Ownership' }), value: 84 },
                { label: t('assessment_creator.demo_center.outputs.backend.psych.1', { defaultValue: 'Adaptability' }), value: 73 },
                { label: t('assessment_creator.demo_center.outputs.backend.psych.2', { defaultValue: 'Collaboration' }), value: 69 }
            ],
            dimensionEvidence: [
                {
                    dimension: 'Problem Structuring',
                    score: 82,
                    weight: 0.3,
                    confidence: 'high',
                    evidence: ['Jasná sekvence kroků', 'Explicitní priority', 'Práce s riziky'],
                    source: 'Open + scenario answers',
                },
                {
                    dimension: 'Trade-off Communication',
                    score: 68,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Méně business framingu', 'Silný technický detail', 'Slabší stakeholder language'],
                    source: 'Scenario + truth mirror',
                },
                {
                    dimension: 'Execution Reliability',
                    score: 80,
                    weight: 0.3,
                    confidence: 'high',
                    evidence: ['Konzistentní struktura napříč odpověďmi', 'Nízká míra neurčitosti', 'Dobrá incident priorita'],
                    source: 'All technical responses',
                },
                {
                    dimension: 'Behavioral Profile',
                    score: 74,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Vysoký ownership', 'Střední adaptabilita', 'Nižší collaboration signal'],
                    source: 'Psych + language signals',
                },
            ],
            strengths: getStringList('assessment_creator.demo_center.outputs.backend.strengths', ['Silné strukturování problému', 'Dobrá práce s fallback scénáři', 'Vysoká míra ownershipu']),
            risks: getStringList('assessment_creator.demo_center.outputs.backend.risks', ['Mírně slabší komunikace trade-offů směrem k ne-tech stakeholderům']),
            methodology: ['Technické odpovědi 55%', 'Situační rozhodování 25%', 'Psychometrický screening 20%', '18 signálů z odpovědí'],
            aiNarrative: ['Kandidát odpovídá strukturovaně a drží konzistentní logiku postupu.', 'V psaném projevu je patrný ownership a orientace na auditovatelnost.', 'Komunikačně je spíše věcný, méně storytellu vůči ne-tech publiku.'],
            interviewFocus: ['Trade-off komunikace pro business stakeholdery', 'Incident leadership pod tlakem', 'Prioritizace mezi rychlostí a kvalitou'],
            confidence: 'high',
            cultureFitMatch: 83,
            cultureFitNotes: ['Silný fit na ownership kulturu', 'Střední fit na cross-team storytelling', 'Vysoký fit na data-driven rozhodování']
        },
        'demo-cnc-operator': {
            finalScore: 74,
            recommendation: 'recommend',
            technical: [
                { label: t('assessment_creator.demo_center.outputs.cnc.technical.0', { defaultValue: 'Technological discipline' }), value: 80 },
                { label: t('assessment_creator.demo_center.outputs.cnc.technical.1', { defaultValue: 'Tolerance control' }), value: 77 },
                { label: t('assessment_creator.demo_center.outputs.cnc.technical.2', { defaultValue: 'Safety procedures' }), value: 85 }
            ],
            psychProfile: [
                { label: t('assessment_creator.demo_center.outputs.cnc.psych.0', { defaultValue: 'Conscientiousness' }), value: 88 },
                { label: t('assessment_creator.demo_center.outputs.cnc.psych.1', { defaultValue: 'Stress tolerance' }), value: 71 },
                { label: t('assessment_creator.demo_center.outputs.cnc.psych.2', { defaultValue: 'Adaptability' }), value: 64 }
            ],
            dimensionEvidence: [
                {
                    dimension: 'Process Discipline',
                    score: 84,
                    weight: 0.35,
                    confidence: 'high',
                    evidence: ['Silná kontrola tolerance', 'Důraz na bezpečnost', 'Správná sekvence kroků'],
                    source: 'Practical + logic tasks',
                },
                {
                    dimension: 'Quality Under Pressure',
                    score: 70,
                    weight: 0.25,
                    confidence: 'medium',
                    evidence: ['Dobré krizové kroky', 'Menší nejistota při změně priorit'],
                    source: 'Scenario answers',
                },
                {
                    dimension: 'Team Coordination',
                    score: 69,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Spíše individuální fokus', 'Méně explicitní handover komunikace'],
                    source: 'Open answers',
                },
                {
                    dimension: 'Behavioral Reliability',
                    score: 76,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Vysoká svědomitost', 'Střední adaptabilita'],
                    source: 'Psych signals',
                },
            ],
            strengths: getStringList('assessment_creator.demo_center.outputs.cnc.strengths', ['Stabilní procesní přístup', 'Vysoký důraz na bezpečnost']),
            risks: getStringList('assessment_creator.demo_center.outputs.cnc.risks', ['Potřeba podpory při rychlé změně priorit']),
            methodology: ['Praktické úkoly 60%', 'Situační reakce 25%', 'Psychometrický screening 15%', '15 signálů z odpovědí'],
            aiNarrative: ['Odpovědi jsou přesné, disciplinované a zaměřené na bezpečnost práce.', 'Kandidát působí stabilně v rutinním provozu.', 'Při náhlé změně priorit může být potřeba jasnějšího vedení.'],
            interviewFocus: ['Řešení neplánovaných odchylek', 'Tempo práce při zachování kvality', 'Spolupráce s údržbou a kvalitou'],
            confidence: 'medium',
            cultureFitMatch: 79,
            cultureFitNotes: ['Silný fit na procesní kulturu', 'Vysoký fit na bezpečnostní standardy', 'Střední fit na rychlé změny priorit']
        },
        'demo-nurse': {
            finalScore: 81,
            recommendation: 'recommend',
            technical: [
                { label: t('assessment_creator.demo_center.outputs.nurse.technical.0', { defaultValue: 'Triage and prioritization' }), value: 84 },
                { label: t('assessment_creator.demo_center.outputs.nurse.technical.1', { defaultValue: 'Clinical communication' }), value: 79 },
                { label: t('assessment_creator.demo_center.outputs.nurse.technical.2', { defaultValue: 'Documentation quality' }), value: 76 }
            ],
            psychProfile: [
                { label: t('assessment_creator.demo_center.outputs.nurse.psych.0', { defaultValue: 'Collaboration' }), value: 87 },
                { label: t('assessment_creator.demo_center.outputs.nurse.psych.1', { defaultValue: 'Stress tolerance' }), value: 82 },
                { label: t('assessment_creator.demo_center.outputs.nurse.psych.2', { defaultValue: 'Ownership' }), value: 75 }
            ],
            dimensionEvidence: [
                {
                    dimension: 'Clinical Prioritization',
                    score: 85,
                    weight: 0.35,
                    confidence: 'high',
                    evidence: ['Správná triáž logika', 'Jasné pořadí kroků', 'Bezpečnostní orientace'],
                    source: 'Scenario + practical tasks',
                },
                {
                    dimension: 'Patient Communication',
                    score: 79,
                    weight: 0.25,
                    confidence: 'high',
                    evidence: ['Empatický styl', 'Konkrétní instrukce', 'Nízká míra neurčitosti'],
                    source: 'Open answers',
                },
                {
                    dimension: 'Team Handover Quality',
                    score: 76,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Strukturované předání', 'Možnost více explicitní eskalace'],
                    source: 'Situational responses',
                },
                {
                    dimension: 'Behavioral Resilience',
                    score: 78,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Vysoká odolnost', 'Silná spolupráce', 'Střední dlouhodobá zátěžová tolerance'],
                    source: 'Psych signals',
                },
            ],
            strengths: getStringList('assessment_creator.demo_center.outputs.nurse.strengths', ['Silná práce pod tlakem', 'Výborná týmová komunikace']),
            risks: getStringList('assessment_creator.demo_center.outputs.nurse.risks', ['Doporučeno ověřit dlouhodobou zátěžovou toleranci na směnách']),
            methodology: ['Klinické scénáře 50%', 'Komunikační úkoly 30%', 'Psychometrický screening 20%', '15 signálů z odpovědí'],
            aiNarrative: ['Silná orientace na triáž a týmovou koordinaci.', 'Psaný projev je empatický a konkrétní.', 'Rizikem je dlouhodobá kumulace zátěže v náročných směnách.'],
            interviewFocus: ['Reálné kazuistiky z urgentu', 'Spolupráce při konfliktních směnách', 'Prevence vyhoření'],
            confidence: 'high',
            cultureFitMatch: 87,
            cultureFitNotes: ['Vysoký fit na pacientsky orientovanou kulturu', 'Silný fit na týmovou spolupráci', 'Střední fit na dlouhodobé tempo směn']
        },
        'demo-b2b-sales': {
            finalScore: 69,
            recommendation: 'conditional',
            technical: [
                { label: t('assessment_creator.demo_center.outputs.sales.technical.0', { defaultValue: 'Discovery and qualification' }), value: 72 },
                { label: t('assessment_creator.demo_center.outputs.sales.technical.1', { defaultValue: 'Negotiation' }), value: 74 },
                { label: t('assessment_creator.demo_center.outputs.sales.technical.2', { defaultValue: 'Pipeline management' }), value: 66 }
            ],
            psychProfile: [
                { label: t('assessment_creator.demo_center.outputs.sales.psych.0', { defaultValue: 'Ownership' }), value: 79 },
                { label: t('assessment_creator.demo_center.outputs.sales.psych.1', { defaultValue: 'Learning drive' }), value: 68 },
                { label: t('assessment_creator.demo_center.outputs.sales.psych.2', { defaultValue: 'Collaboration' }), value: 61 }
            ],
            dimensionEvidence: [
                {
                    dimension: 'Discovery Quality',
                    score: 71,
                    weight: 0.3,
                    confidence: 'medium',
                    evidence: ['Relevantní discovery otázky', 'Méně silný business framing'],
                    source: 'Open + scenario answers',
                },
                {
                    dimension: 'Value Communication (EN/CZ)',
                    score: 65,
                    weight: 0.25,
                    confidence: 'medium',
                    evidence: ['Feature-heavy wording', 'Slabší pain/value mapping', 'EN response použitelná, ne silná'],
                    source: 'Language mini-test',
                },
                {
                    dimension: 'Commercial Discipline',
                    score: 67,
                    weight: 0.25,
                    confidence: 'medium',
                    evidence: ['Střední CRM consistency signal', 'Ne vždy jasný next step'],
                    source: 'Process questions',
                },
                {
                    dimension: 'Behavioral Readiness',
                    score: 72,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Vysoký ownership', 'Střední collaboration', 'Kolísající jistota ve formulaci'],
                    source: 'Psych + language signals',
                },
            ],
            strengths: getStringList('assessment_creator.demo_center.outputs.sales.strengths', ['Dobrá argumentace hodnoty', 'Aktivní ownership příležitostí']),
            risks: getStringList('assessment_creator.demo_center.outputs.sales.risks', ['Kolísání disciplíny v CRM a follow-up procesech']),
            methodology: ['Obchodní scénáře 45%', 'Jazykový mini-test 20%', 'Procesní disciplína 15%', 'Psychometrický screening 20%', '18 signálů z odpovědí'],
            aiNarrative: ['Kandidát popisuje produkt široce, ale ne vždy převádí vlastnosti na business value.', 'V odpovědích je místy patrná nejistota a delší, méně konkrétní formulace.', 'Anglická část je použitelná, ale potřebuje větší důraz na value messaging.'],
            interviewFocus: ['Value-based selling v angličtině', 'Práce s námitkou ceny', 'CRM hygiene a follow-up disciplína'],
            confidence: 'medium',
            cultureFitMatch: 74,
            cultureFitNotes: ['Silný fit na aktivní prospecting', 'Střední fit na consultative sales', 'Nižší fit na disciplinované CRM prostředí']
        },
        'demo-cs-support': {
            finalScore: 72,
            recommendation: 'conditional',
            technical: [
                { label: t('assessment_creator.demo_center.outputs.support.technical.0', { defaultValue: 'Ticket triage' }), value: 75 },
                { label: t('assessment_creator.demo_center.outputs.support.technical.1', { defaultValue: 'Empathetic communication' }), value: 81 },
                { label: t('assessment_creator.demo_center.outputs.support.technical.2', { defaultValue: 'Escalation readiness' }), value: 65 }
            ],
            psychProfile: [
                { label: t('assessment_creator.demo_center.outputs.support.psych.0', { defaultValue: 'Collaboration' }), value: 78 },
                { label: t('assessment_creator.demo_center.outputs.support.psych.1', { defaultValue: 'Conscientiousness' }), value: 70 },
                { label: t('assessment_creator.demo_center.outputs.support.psych.2', { defaultValue: 'Stress tolerance' }), value: 62 }
            ],
            dimensionEvidence: [
                {
                    dimension: 'Customer Communication',
                    score: 80,
                    weight: 0.3,
                    confidence: 'high',
                    evidence: ['Empatický tón', 'Srozumitelné odpovědi', 'Dobrá deeskalace'],
                    source: 'Open + scenario answers',
                },
                {
                    dimension: 'Escalation Judgement',
                    score: 66,
                    weight: 0.3,
                    confidence: 'medium',
                    evidence: ['Správná intuice', 'Nižší konzistence v trigger pravidlech'],
                    source: 'Logic + scenario tasks',
                },
                {
                    dimension: 'Process Hygiene',
                    score: 68,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Střední kvalita interních poznámek', 'Méně explicitní follow-up'],
                    source: 'Practical tasks',
                },
                {
                    dimension: 'Behavioral Stability',
                    score: 71,
                    weight: 0.2,
                    confidence: 'medium',
                    evidence: ['Solid collaboration', 'Střední stress tolerance'],
                    source: 'Psych signals',
                },
            ],
            strengths: getStringList('assessment_creator.demo_center.outputs.support.strengths', ['Silná empatie v komunikaci', 'Dobrá orientace na zákazníka']),
            risks: getStringList('assessment_creator.demo_center.outputs.support.risks', ['Potřeba zlepšit konzistenci eskalačních kroků']),
            methodology: ['Ticket scénáře 50%', 'Komunikační úkoly 30%', 'Psychometrický screening 20%', '15 signálů z odpovědí'],
            aiNarrative: ['Kandidát komunikuje empaticky a drží profesionální tón.', 'V odpovědích je dobrá orientace na zákazníka, slabší na interní standardizaci.', 'Potřebuje posílit konzistentní eskalační framework.'],
            interviewFocus: ['Eskalace v high-severity incidentech', 'Přesnost interních poznámek', 'Balanc mezi empatií a SLA'],
            confidence: 'medium',
            cultureFitMatch: 81,
            cultureFitNotes: ['Vysoký fit na customer-first kulturu', 'Střední fit na procesní disciplínu', 'Silný fit na empatickou komunikaci']
        }
    };
    const selectedDemoOutput = demoOutputMap[selectedDemoOutputId] || demoOutputMap['demo-backend-senior'];
    const selectedDemoTemplate = demoAssessments.find((item) => item.id === selectedDemoOutputId) || demoAssessments[0];
    const demoSignalFrame = {
        timestamp: new Date().toISOString(),
        unlocked_skills: selectedDemoOutput.strengths.slice(0, 5),
        narrative_integrity: Math.round((selectedDemoOutput.finalScore + selectedDemoOutput.cultureFitMatch) / 2),
        confidence: selectedDemoOutput.confidence === 'high' ? 86 : selectedDemoOutput.confidence === 'medium' ? 67 : 45,
        evidence: selectedDemoOutput.methodology.slice(0, 4),
    };
    const demoResonanceFrame = {
        candidate_vector: [selectedDemoOutput.cultureFitMatch / 100, selectedDemoOutput.finalScore / 100, 0.72, 0.64],
        company_vector: [1, 1, 1, 1],
        match: selectedDemoOutput.cultureFitMatch,
        tension_points: selectedDemoOutput.risks.slice(0, 3),
    };

    const getRecommendationLabel = (value: 'recommend' | 'conditional' | 'not_recommend') => {
        return t(`assessment_creator.demo_center.recommendation_advisory.${value}`, {
            defaultValue: value === 'recommend' ? 'AI doporučuje pozvat k rozhovoru' : value === 'conditional' ? 'AI doporučuje rozhovor s fokus tématy' : 'AI doporučuje nejdříve doplnit ověření'
        });
    };

    const sanitizeFileName = (value: string): string =>
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'assessment-demo';

    const handleExportPng = () => {
        if (!selectedDemoTemplate) return;
        const canvas = document.createElement('canvas');
        canvas.width = 1400;
        canvas.height = 1900;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const padX = 80;
        let y = 90;
        ctx.fillStyle = '#0f172a';
        ctx.font = '700 48px sans-serif';
        ctx.fillText(t('assessment_creator.demo_center.onepager_title', { defaultValue: 'Assessment Center - Demo Output' }), padX, y);
        y += 56;

        ctx.fillStyle = '#334155';
        ctx.font = '600 28px sans-serif';
        ctx.fillText(selectedDemoTemplate.role, padX, y);
        y += 52;

        const writeRow = (label: string, value: string, color: string = '#0f172a') => {
            ctx.fillStyle = '#64748b';
            ctx.font = '600 24px sans-serif';
            ctx.fillText(label, padX, y);
            ctx.fillStyle = color;
            ctx.font = '700 30px sans-serif';
            ctx.fillText(value, padX + 380, y);
            y += 46;
        };

        writeRow(t('assessment_creator.demo_center.final_score', { defaultValue: 'Final score' }), `${selectedDemoOutput.finalScore}/100`, '#0891b2');
        writeRow(t('assessment_creator.demo_center.recommendation_label', { defaultValue: 'Recommendation' }), getRecommendationLabel(selectedDemoOutput.recommendation), '#16a34a');
        y += 12;

        ctx.fillStyle = '#0f172a';
        ctx.font = '700 28px sans-serif';
        ctx.fillText(t('assessment_creator.demo_center.technical_breakdown', { defaultValue: 'Technical breakdown' }), padX, y);
        y += 40;
        selectedDemoOutput.technical.forEach((item) => writeRow(item.label, `${item.value}/100`));
        y += 8;

        ctx.fillStyle = '#0f172a';
        ctx.font = '700 28px sans-serif';
        ctx.fillText(t('assessment_creator.demo_center.psych_profile', { defaultValue: 'Psychological profile (basic)' }), padX, y);
        y += 40;
        selectedDemoOutput.psychProfile.forEach((item) => writeRow(item.label, `${item.value}/100`));
        y += 8;

        const writeList = (title: string, items: string[], color: string) => {
            ctx.fillStyle = '#0f172a';
            ctx.font = '700 28px sans-serif';
            ctx.fillText(title, padX, y);
            y += 36;
            ctx.font = '500 22px sans-serif';
            items.forEach((item) => {
                ctx.fillStyle = color;
                ctx.fillText(`- ${item}`, padX + 8, y);
                y += 32;
            });
            y += 8;
        };

        writeList(t('assessment_creator.demo_center.strengths', { defaultValue: 'Strengths' }), selectedDemoOutput.strengths, '#166534');
        writeList(t('assessment_creator.demo_center.risks', { defaultValue: 'Risks / development areas' }), selectedDemoOutput.risks, '#b45309');

        ctx.fillStyle = '#64748b';
        ctx.font = '500 18px sans-serif';
        ctx.fillText(
            t('assessment_creator.demo_center.export_note', { defaultValue: 'Demo output. Psychological part is self-report screening, not clinical diagnosis.' }),
            padX,
            canvas.height - 60
        );

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizeFileName(selectedDemoTemplate.role)}-assessment-demo.png`;
        link.click();
    };

    const handleExportPdf = () => {
        if (!demoOutputRef.current || !selectedDemoTemplate) return;
        const popup = window.open('', '_blank', 'width=1200,height=900');
        if (!popup) return;
        popup.document.write(`
          <html>
            <head>
              <title>${selectedDemoTemplate.role} - Assessment Demo</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
                .note { margin-top: 12px; color: #64748b; font-size: 12px; }
              </style>
            </head>
            <body>
              <h1>${t('assessment_creator.demo_center.onepager_title', { defaultValue: 'Assessment Center - Demo Output' })}</h1>
              ${demoOutputRef.current.innerHTML}
              <div class="note">${t('assessment_creator.demo_center.export_note', { defaultValue: 'Demo output. Psychological part is self-report screening, not clinical diagnosis.' })}</div>
            </body>
          </html>
        `);
        popup.document.close();
        popup.focus();
        popup.print();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            {/* Usage Display */}
            {companyProfile && (
                <div className="lg:col-span-2 mb-4">
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                <BarChart3 size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                    {t('assessment_creator.remaining_assessments')}: <span className="text-cyan-600 dark:text-cyan-400">{remainingAssessments}</span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('assessment_creator.plan')}: <span className="font-medium">
                                        {tier === 'enterprise' ? t('assessment_creator.tiers.enterprise') :
                                            tier === 'professional' ? t('assessment_creator.tiers.professional', { defaultValue: 'Professional' }) :
                                                tier === 'growth' ? t('assessment_creator.tiers.growth', { defaultValue: 'Growth' }) :
                                                tier === 'trial' ? t('assessment_creator.tiers.trial') :
                                                    t('assessment_creator.tiers.starter', { defaultValue: 'Starter' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap"
                        >
                            {t('assessment_creator.more_credits')}
                        </button>
                    </div>
                </div>
            )}

            <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('assessment_creator.demo_center.title', { defaultValue: 'Demo Assessment Center' })}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('assessment_creator.demo_center.subtitle', { defaultValue: '5 ukázek napříč různými typy rolí. Klikněte na Preview nebo použijte šablonu.' })}
                            </p>
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                                {t('assessment_creator.demo_center.free_tier', { defaultValue: 'Dostupné i pro Free tier (bez čerpání kreditů).' })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowDemoCenter((prev) => !prev)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                {showDemoCenter
                                    ? t('assessment_creator.demo_center.hide', { defaultValue: 'Hide demo assessments' })
                                    : t('assessment_creator.demo_center.show', { defaultValue: 'Show demo assessments' })}
                            </button>
                            {FEATURE_ASSESSMENT_THREE && showDemoCenter && (
                                <button
                                    onClick={() => setShowThreePreview((prev) => !prev)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        showThreePreview
                                            ? 'bg-cyan-600 text-white border-cyan-500'
                                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                    }`}
                                >
                                    {showThreePreview
                                        ? t('assessment_3d.preview_on', { defaultValue: '3D Preview: ON' })
                                        : t('assessment_3d.preview_off', { defaultValue: '3D Preview: OFF' })}
                                </button>
                            )}
                        </div>
                    </div>
                    {showDemoCenter && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                                {demoAssessments.map((template) => (
                                    <div key={template.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/30">
                                        <div className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1">
                                            {template.difficulty}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2 min-h-[40px]">
                                            {template.role}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 min-h-[48px]">
                                            {template.skills.slice(0, 3).join(' · ')}
                                        </div>
                                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mb-2">
                                            {template.assessment.questions.length} {t('assessment_creator.demo_center.questions_label', { defaultValue: 'otázek / úkolů' })}
                                        </div>
                                        <button
                                            onClick={() => setSelectedDemoOutputId(template.id)}
                                            className={`w-full mb-2 px-2 py-1.5 text-xs font-bold rounded transition-colors border ${
                                                selectedDemoOutputId === template.id
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                                                    : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                                            }`}
                                        >
                                            {t('assessment_creator.demo_center.show_output', { defaultValue: 'Show output' })}
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => previewDemoTemplate(template)}
                                                className="flex-1 px-2 py-1.5 text-xs font-bold rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                            >
                                                {t('assessment_creator.demo_center.preview', { defaultValue: 'Preview' })}
                                            </button>
                                            <button
                                                onClick={() => loadDemoTemplate(template)}
                                                className="flex-1 px-2 py-1.5 text-xs font-bold rounded bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                                            >
                                                {t('assessment_creator.demo_center.use', { defaultValue: 'Use template' })}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {FEATURE_ASSESSMENT_THREE && showThreePreview && (
                                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                        <div className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-2">
                                            The Nebula of Potential
                                        </div>
                                        <SceneShell
                                            capability={sceneCapability}
                                            enableControls
                                            fallback={
                                                <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs text-slate-600 dark:text-slate-300">
                                                    Non-WebGL fallback. Signal timeline preview active.
                                                </div>
                                            }
                                        >
                                            <NebulaOfPotential frame={demoSignalFrame} />
                                        </SceneShell>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                        <div className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                                            Value Resonance
                                        </div>
                                        <SceneShell
                                            capability={sceneCapability}
                                            fallback={
                                                <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs text-slate-600 dark:text-slate-300">
                                                    Fit pulse: {demoResonanceFrame.match}%
                                                </div>
                                            }
                                        >
                                            <ValueResonance frame={demoResonanceFrame} />
                                        </SceneShell>
                                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                            {t('ai_advisory.default', { defaultValue: 'AI recommendation only. Final decision remains with recruiter.' })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={demoOutputRef} className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {t('assessment_creator.demo_center.output_title', { defaultValue: 'Ukázka výstupu pro firmu' })}
                            </h4>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportPng}
                                    className="px-2 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    {t('assessment_creator.demo_center.export_png', { defaultValue: 'Export PNG' })}
                                </button>
                                <button
                                    onClick={handleExportPdf}
                                    className="px-2 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    {t('assessment_creator.demo_center.export_pdf', { defaultValue: 'Export PDF' })}
                                </button>
                                <div className={`px-2 py-1 text-xs font-bold rounded ${
                                selectedDemoOutput.recommendation === 'recommend'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                    : selectedDemoOutput.recommendation === 'conditional'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                            }`}>
                                {getRecommendationLabel(selectedDemoOutput.recommendation)}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                    {t('assessment_creator.demo_center.final_score', { defaultValue: 'Final score' })}
                                </div>
                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{selectedDemoOutput.finalScore}/100</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 md:col-span-2">
                                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                    {t('assessment_creator.demo_center.psych_profile', { defaultValue: 'Psychologický profil (základ)' })}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {selectedDemoOutput.psychProfile.map((item) => (
                                        <div key={item.label} className="text-xs">
                                            <div className="text-slate-500 dark:text-slate-400">{item.label}</div>
                                            <div className="font-bold text-slate-900 dark:text-white">{item.value}/100</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 mb-4">
                            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                {t('assessment_creator.demo_center.technical_breakdown', { defaultValue: 'Technical breakdown' })}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {selectedDemoOutput.technical.map((item) => (
                                    <div key={item.label} className="text-xs">
                                        <div className="text-slate-500 dark:text-slate-400">{item.label}</div>
                                        <div className="font-bold text-slate-900 dark:text-white">{item.value}/100</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                    {t('assessment_creator.demo_center.strengths', { defaultValue: 'Silné stránky' })}
                                </div>
                                <ul className="space-y-1">
                                    {selectedDemoOutput.strengths.map((item) => (
                                        <li key={item} className="text-sm text-emerald-700 dark:text-emerald-300">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                    {t('assessment_creator.demo_center.risks', { defaultValue: 'Rizika / rozvoj' })}
                                </div>
                                <ul className="space-y-1">
                                    {selectedDemoOutput.risks.map((item) => (
                                        <li key={item} className="text-sm text-amber-700 dark:text-amber-300">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                {t('assessment_creator.demo_center.methodology_title', { defaultValue: 'Jak AI dopočítala skóre' })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedDemoOutput.methodology.map((item) => (
                                    <span key={item} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        {item}
                                    </span>
                                ))}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                {t('assessment_creator.demo_center.confidence', { defaultValue: 'Confidence' })}: <span className="font-semibold">{selectedDemoOutput.confidence.toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                            <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                                {t('assessment_creator.demo_center.dimension_evidence', { defaultValue: 'Dimension Evidence (How scores were derived)' })}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedDemoOutput.dimensionEvidence.map((item) => (
                                    <div key={item.dimension} className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.dimension}</div>
                                            <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{item.score}/100</div>
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                                            weight: {Math.round(item.weight * 100)}% • confidence: {item.confidence.toUpperCase()}
                                        </div>
                                        <ul className="space-y-0.5 mb-2">
                                            {item.evidence.map((evi) => (
                                                <li key={evi} className="text-[11px] text-slate-700 dark:text-slate-300">• {evi}</li>
                                            ))}
                                        </ul>
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                            source: {item.source}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs uppercase tracking-wider text-slate-500">
                                    {t('assessment_creator.demo_center.culture_fit', { defaultValue: 'Culture Fit Radar' })}
                                </div>
                                <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                                    {selectedDemoOutput.cultureFitMatch}%
                                </div>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mb-2">
                                <div
                                    className="h-2 rounded-full bg-cyan-500"
                                    style={{ width: `${Math.max(5, Math.min(100, selectedDemoOutput.cultureFitMatch))}%` }}
                                />
                            </div>
                            <ul className="space-y-1">
                                {selectedDemoOutput.cultureFitNotes.map((item) => (
                                    <li key={item} className="text-[11px] text-slate-600 dark:text-slate-300">• {item}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                    {t('assessment_creator.demo_center.ai_interpretation', { defaultValue: 'AI interpretační komentář' })}
                                </div>
                                <ul className="space-y-1">
                                    {selectedDemoOutput.aiNarrative.map((item) => (
                                        <li key={item} className="text-sm text-slate-700 dark:text-slate-300">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                    {t('assessment_creator.demo_center.interview_focus', { defaultValue: 'Doporučená témata pro osobní pohovor' })}
                                </div>
                                <ul className="space-y-1">
                                    {selectedDemoOutput.interviewFocus.map((item) => (
                                        <li key={item} className="text-sm text-cyan-700 dark:text-cyan-300">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                            {t('assessment_creator.demo_center.ai_notice', { defaultValue: 'AI doporučení je podpůrné rozhodnutí, ne automatické schválení nebo zamítnutí kandidáta.' })}
                        </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Input Side */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 transition-colors duration-300">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-500/20">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('assessment_creator.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('assessment_creator.subtitle')}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {jobs.length > 0 && (
                        <div className="p-3 bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800 rounded-xl mb-2">
                            <label className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Sparkles size={12} /> {t('assessment_creator.auto_from_job')}
                            </label>
                            <select
                                value={selectedJobId}
                                onChange={(e) => handleJobSelect(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800 rounded-lg p-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="">{t('assessment_creator.select_job_placeholder')}</option>
                                {jobs.map(job => (
                                    <option key={job.id} value={job.id}>{job.title}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-500 mt-2">
                                {t('assessment_creator.auto_fill_hint')}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('assessment_creator.role_label')}</label>
                        <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder={t('assessment_creator.role_placeholder')}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('assessment_creator.skills_label')}</label>
                        <textarea
                            value={skills}
                            onChange={(e) => setSkills(e.target.value)}
                            placeholder={t('assessment_creator.skills_placeholder')}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none h-24 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                        />
                        {isExtracting && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-cyan-500 italic">
                                <Loader2 size={12} className="animate-spin" />
                                {t('assessment_creator.extracting_skills')}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('assessment_creator.difficulty_label')}</label>
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white transition-colors"
                        >
                            <option value="Junior">{t('assessment_creator.difficulty.junior')}</option>
                            <option value="Medior">{t('assessment_creator.difficulty.medior')}</option>
                            <option value="Senior">{t('assessment_creator.difficulty.senior')}</option>
                            <option value="Expert">{t('assessment_creator.difficulty.expert')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{t('assessment_creator.structure_title')}</label>
                        <div className="p-4 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/50 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 font-bold text-sm">
                                <Sparkles size={16} className="text-amber-500" />
                                {t('assessment_creator.structure_heading')}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-cyan-500 border border-cyan-100 dark:border-cyan-800">1</div>
                                    <span>{t('assessment_creator.structure_items.1')}</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-cyan-500 border border-cyan-100 dark:border-cyan-800">2</div>
                                    <span>{t('assessment_creator.structure_items.2')}</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-cyan-500 border border-cyan-100 dark:border-cyan-800">3</div>
                                    <span>{t('assessment_creator.structure_items.3')}</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-cyan-500 border border-cyan-100 dark:border-cyan-800">4</div>
                                    <span>{t('assessment_creator.structure_items.4')}</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-cyan-500 border border-cyan-100 dark:border-cyan-800">5</div>
                                    <span>{t('assessment_creator.structure_items.5', { defaultValue: 'Krátký psychologický screening (self-report): stres, spolupráce, ownership, adaptabilita.' })}</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 italic px-1">
                            {t('assessment_creator.structure_note')}
                        </p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !role}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(8,145,178,0.3)]"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                        {isGenerating ? t('assessment_creator.generating') : t('assessment_creator.create_button')}
                    </button>
                </div>
            </div>

            {/* Output Side */}
            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col h-full min-h-[500px] transition-colors duration-300">
                {assessment ? (
                    <div className="animate-in zoom-in-95 space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{assessment.title}</h3>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 rounded font-medium border border-cyan-500/30">{assessment.role}</span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-medium border border-slate-300 dark:border-slate-700">{t('assessment_creator.ai_generated')}</span>
                                </div>
                            </div>
                            <button className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400" title={t('assessment_creator.copy')}>
                                <Copy size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {assessment.questions.map((q, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">{t('assessment_creator.question')} {idx + 1}</span>
                                        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${q.type === 'Code' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>
                                            {q.type === 'Code' ? <Code size={12} /> : <FileText size={12} />}
                                            {q.type}
                                        </div>
                                    </div>
                                    <p className="text-slate-800 dark:text-slate-300 font-medium leading-relaxed">{q.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => assessment && openAssessmentPreviewPage(assessment)}
                                className="flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                            >
                                <Eye size={16} />
                                <span>{t('assessment_creator.preview')}</span>
                            </button>
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                <CheckCircle size={16} className="text-emerald-500" />
                                <span>{t('assessment_creator.send_hint')}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                        <BrainCircuit size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-center max-w-xs text-slate-500">
                            {t('assessment_creator.empty_state')}
                        </p>
                    </div>
                )}
            </div>

            <PlanUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                feature="AI Assessment"
                companyProfile={companyProfile || { id: 'guest', name: 'Guest' } as any}
            />
        </div>
    );
};

export default AssessmentCreator;
