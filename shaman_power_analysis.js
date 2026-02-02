
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
dotenv.config({ path: '.env.local' });
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY;

const JOB_TEXT = `
 HLEDÁME MIMOŘÁDNOU RECEPČNÍ

Hledáme OSOBU, KTERÁ RÁDA MLUVÍ. A může to být i muž.

Samozřejmě, nejdříve jsme sem napsali “ženu, která ráda mluví“, protože to v tom inzerátu znělo tak nějak lépe (pánové prominou). Ale pak jsme se sami genderově korektně opravili. Protože pohlaví, věk, orientace ani barva pleti nás opravdu nezajímají. A protože i muži umí dobře mluvit. My hledáme mimořádného člověka, který bude kopat za náš tým na vrcholné úrovni, vydrží opravdu vysoké pracovní tempo, a ještě u toho bude vypadat, že to všechno zvládá „levou zadní“.

Jenom mluvit nám ale nestačí. Samozřejmě to má ještě nějaká „ale“. Jen na začátek jsme chtěli napsat to nejdůležitější. Tak jako v životě muže je žena tou nejdůležitější osobou, tak v práci je pro nás nejdůležitější osobou recepční. A zatímco v životě si často (my muži) za partnerky hledáme ženy, které dokážou v pravý čas mlčet (dámy prominou), v práci naopak hledáme člověka, který dokáže v pravý čas říct ta správná slova. A také se usmát, přivítat hosta a vytvořit příjemnou atmosféru doslova lusknutím prstů.

Připadá Vám to jako málo? Pro nás to znamená hrozně moc. Vy všichni, kdo tež čtete tyto řádky, už jste někdy byli u zubaře. A asi ne všichni jste se na to těšili. A naši zákazníci to mají stejně. Čeká je něco, co už podvědomě není spojeno s úplně příjemnými zážitky. A je strašný rozdíl, když je přivítá někdo, kdo jim vykouzlí úsměv na rtech, anebo někdo, kdo po nich vyštěkne: „Kabáty do skříně, peníze na stůl a sednout do čekárny. A ČEKAT.“

To všechno samozřejmě potřebujeme – aby byly kabáty ve skříni, pacienti v čekárně a konec konců i peníze na stole. Proto to děláme, ale chceme to dělat tak, abychom si nemuseli připadat jako 40 loupežníků bez Alibaby. Vlastně s Alibabou, to je naše paní ředitelka (ale žádná baba to není, i když působí na první pohled trochu přísně:-).

Prostě hledáme někoho, na koho už dlouho čekáme a kdo už dlouho čeká na nás. Pojďme se zkusit najít a když to klapne, budeme rádi, když to bude navždy. Nebo aspoň, dokud bude stát naše zubní klinika. Jako v životě – milujeme dlouhodobé vztahy.

Myslíte si, že tohle je příběh pro Vás a o Vás? Nebo hledáte jen přestupní stanici, na které přesednete do další lanovky vzhůru, jakmile se někde něco uvolní? Na tom není nic špatného, ale takové místo my bohužel nejsme. Naučit se práci recepce, zvládnout bravurně orientaci v nepřeberném množství lékařských výkonů, správně je vyúčtovat a na konci vystavit účet pacientovi a vybrat peníze. A taky správně zapsat vše, co má být zapsáno a poslat vše, co má být odesláno. To všechno chvilku trvá. A ani pro Vás není zajímavé učit si něco, co bude složité, když to bude jen na chvíli.

Na začátku to bude hodně nekomfortní, protože budete dělat hodně chyb a budete často opravováni. Takže k pocitu, že jste úplně k ničemu, někdy nebývá až tak daleko. Ale když to vydržíte, pak to stojí za to. My už po těch letech docela dobře poznáme, kdo se ze svých chyb učí. A kdo se chce posouvat vpřed, a ne jenom surfovat na nějaké vlně a trávit příjemný čas v dobře placené práci s minimem obtěžování a minimálními nároky na výkon.

Ptáte se, proč tak dlouhý úvod? (Ano, pořád jsme u úvodu.) Na podobné inzeráty se nám většinou hlásí spousta kandidátů a kandidátek, které opravdu hledají jenom tu přestupní stanici. A to už rovnou můžeme napsat inzerát typu: „Hledáme nóbl recepční, luxusní prostředí, mzda astronomická, povinnosti žádné“. Ale to my právě nehledáme. A taky nic takového nenabízíme. A právě proto se snažíme „hromadné odepisovatele“ odradit hned teď a tady – šetří to čas a energii nám i jim. Ale pokud jste dočetli až sem (bravo), už teď nás začínáte zajímat, a pokud jsme Vás zatím neodradili, zkuste číst dál, třeba z toho nakonec něco bude.

Údajně by tu mělo být taky něco o nás (i když nás zajímáte hlavně Vy). Tak jen stručně. Jsme zavedená zubní klinika s dvacetiletou tradicí v centru Prahy (okupujeme polovinu Paláce ROKOKO na Václavském náměstí). Patříme mezi špičková pracoviště v oblasti zubních implantátů a vrátili jsme úsměv už tisícům našich klientů – to je naše práce. Na stránkách máme napsáno, že našim zákazníkům měníme život – a za tím si stojíme. Někdy ho ale dokážeme změnit i našim zaměstnancům, takže – pokud Vás to zajímá – možná ho změníme i Vám.

Takže – tohle je naše výzva. Myslíte si, že jste to právě vy, koho hledáme? Jste to vy, kdo si chce najít dobrou práci na mnoho let, kde si sice moc neodpočine, ale bude váženým a respektovaným členem týmu a také živoucím motorem prakticky všeho, co se u nás děje? Všechno, co potřebujete do začátku, je sebekontrola, pečlivost a také znalost angličtiny. I když se orientujeme hlavně na české zákazníky, občas se bez angličtiny neobejdeme. No a potom je u nás veledůležitá také brilantní čeština slovem i písmem a příjemný projev prostý jakéhokoliv přízvuku. Naši zákazníci nám totiž rozumí, jenom když nám rozumí.

Všechno ostatní je jen otázka píle a soustředění. Sebevědomí tady záměrně neuvádíme – to Vám při téhle práci bude spíš házet klacky pod nohy. Zatím ještě nikdy nepřišel nikdo, kdo by už všechno uměl, takže to, co potřebujeme, se naučíte u nás. A my umíme být trpěliví, když občas zahlédneme znamení, že by z Vás mohl být diamant, který se jednou stane středobodem našeho vesmíru. A potom si Vás budeme hýčkat – ale k tomu vede ještě docela dlouhá cesta.

Když hledáme někoho, koho přijmeme do rodiny (přesně takhle „mafiánsky“ to vnímáme), hrajeme podle pravidel, která jsou striktní a neměnná. Jestli si pořád ještě myslíte, že jsme tohle všechno napsali, abychom našli právě Vás, musíte teď udělat dvě věci. To první je, že odpovíte na tento inzerát a pošlete nám svůj životopis s fotografií a kontaktními údaji. Co všechno se rozhodnete napsat nebo připojit, to už necháme zcela na Vás (a nikdy nevíte, co může upoutat naši pozornost a přihrát Vám nějaké body navíc).

Ta druhá věc je možná trošku nekomfortní, ale taky není nikterak složitá. Vezměte do ruky mobilní telefon a natočte nám krátké video, kde se představíte a řeknete nám něco o sobě. A také, proč byste u nás chtěl/a pracovat, proč bychom Vás měli vybrat, jaké jsou Vaše silné a slabé stránky a vůbec všechno, co považujete za důležité (třeba jakou posloucháte hudbu). Celé by se Vám to mělo vejít do 3-5 minut a pošlete to na WhatsApp naší výkonné ředitelky Barbary Bäckové na číslo +420 735 126 035. A můžete to udělat rovnou hned teď a tam, kde právě jste, třeba v tramvaji – nás zajímáte Vy a ne to, co se děje kolem Vás. A taky se poťouchle těšíme, že se aspoň jednou zakoktáte – tak budeme vědět, že nejste robot (roboti prominou), ale normální živý člověk.

No a co bude dál? Pak začíná práce. Poctivě odpovíme všem, kdo se nám ozvou, a zodpovíme Vaše otázky. Nechceme vzbuzovat plané naděje, a určitě Vám také nebudeme slibovat „pečené holuby létající přímo do huby“. Jsme realisté a stojíme nohama pevně na zemi. Statistika je neúprosná a stojí proti nám (i proti Vám). Najít dobrou práci a dobrého zaměstnance je totiž ještě složitější, než najít dobrého životního partnera. Tam se totiž rozvede „jenom“ 40 % všech manželství, zatímco u pracovních vztahů jich vyjde méně než čtvrtina. I proto se snažíme od začátku nastavit pravidla tak, abychom tu šanci aspoň o pár procent zvýšili. Pro Vás i pro nás.

Ještě pořád Vám tady něco schází? Mzda, dovolená, pracovní doba, benefity a bůhví co ještě? Možná jste nečetli úplně pozorně, ale můžeme Vás uklidnit – opravdu tady nic takového není. Samozřejmě, že je to důležité (pro obě strany), ale jestli hledáte práci jen podle toho, vraťte se raději na pracovní portál – určitě tam najdete skvělé filtrování přesně podle toho, co Vás zajímá. My fungujeme jinak. Ještě jsme se ani nepozdravili, a slibovat Vám už teď „modré z nebe“ by bylo trošku nefér. Zatím ještě nevíme, co nám můžete nabídnout, a tím pádem ani to, co můžeme nabídnou my Vám. Jsme rádi, když máme spokojené zaměstnance – a v této fázi to považujeme za dostatečně relevantní odpověď.

A teď ještě odpověď pro ty, kteří pozorně četli. Nahlodali jsme Vás? Je to rébus, nebo nějaký vtip? A je to vůbec pracovní inzerát? Na to si musíte odpovědět sami. Ale jestli jste četli opravdu pozorně, tak teď už víte, co máte udělat. Začněte třeba tím, že zapnete kameru na telefonu a začnete mluvit. A jestli máte nějaká esa v rukávu, tak teď je ten pravý čas je vynést.

Nezapomeňte, že když neuděláte první krok, tak pak neuděláte ani ten druhý – a potom už žádný další.

Karty jsou na stole a hra začíná. A Vy jste teď na tahu.

Přejeme Vám hodně štěstí.

Odpovědí na tento inzerát či zasláním jakýchiv materiálů o Vaší osobě dáváte souhlas společnosti EsthetX Dental Clinic s.r.o. ke shromažďování, zpracování a uchování Vašich osobních údajů dle zákona č. 101/2000 Sb., o ochraně osobních údajů. Svůj souhlas můžete kdykoliv odvolat a my se zavazujeme, že po ukončení výběrového řízení veškeré materiály neúspěšných uchazečů neprodleně smažeme a kromě nás je nikdo jiný neuvidí. Mlčíme jako hrob - na nás je spoleh!
`;

/**
 * MOCK JHI CALCULATION (Simplified from utils/jhi.ts)
 */
const calculateJHI = (text) => {
    // Financial: -50 because no salary, benefits, etc.
    const financial = 10;
    // Time Cost: High (Václavské náměstí, 24/7 feel, high pressure)
    const timeCost = 30;
    // Mental Load: Very High (dental clinic, emotional labor, "ruby in the making", "not comfortable")
    const mentalLoad = 20;
    // Growth: 40 (mentorship promised, but "diamant" talk is risky)
    const growth = 40;
    // Values: 15 (family/mafia vibe, "at zero" feeling, "don't ask about salary")
    const values = 15;

    const avg = (financial + timeCost + mentalLoad + growth + values) / 5;
    const minFactor = Math.min(financial, timeCost, mentalLoad, growth, values) / 100;
    const penaltyMultiplier = 1 - 0.3 * (1 - minFactor);

    return {
        score: Math.round(avg * penaltyMultiplier),
        dimensions: { financial, timeCost, mentalLoad, growth, values }
    };
};

/**
 * NOISE DETECTION (From services/jobService.ts)
 */
const detectNoise = (text) => {
    const flags = [];
    const lower = text.toLowerCase();

    if (lower.includes('rodina')) flags.push('Jsme rodina');
    if (lower.includes('odolnost vůči stresu') || lower.includes('vysoké pracovní tempo')) flags.push('Odolnost vůči stresu');
    if (lower.includes('dynamické prostředí')) flags.push('Dynamické prostředí');
    if (lower.includes('ninja') || lower.includes('rockstar')) flags.push('Ninja/Rockstar');
    if (lower.includes('mimořádný')) flags.push('Mimořádné nároky');
    if (lower.includes('mafiánsky')) flags.push('Mafiánská kultura');
    if (lower.includes('zakoktáte')) flags.push('Test lability (video)');

    const score = Math.min(100, flags.length * 15 + 10);

    return {
        score,
        flags,
        tone: score > 70 ? 'Toxic/Hype' : score > 40 ? 'Hype-heavy' : 'Professional'
    };
};

async function runAnalysis() {
    console.log("🚀 Starting Job Shaman Analysis for Job 17080...");

    const jhi = calculateJHI(JOB_TEXT);
    const noise = detectNoise(JOB_TEXT);

    console.log("📊 Internal Metrics Calculated.");

    if (!apiKey) {
        console.warn("⚠️ GEMINI_API_KEY not found. Using Mock AI data.");
        printResults(jhi, noise, {
            summary: "Extrémně manipulativní inzerát maskovaný za 'upřímnost'. Slibuje rodinné prostředí a růst, ale ve skutečnosti hledá emočně stabilní pracovní sílu bez nároků na transparentnost odměňování.",
            hiddenRisks: [
                "Absence mzdy v inzerátu (Red Flag #1)",
                "Vysoká fluktuace maskovaná za 'přestupní stanici'",
                "Nutnost natáčet video na WhatsApp (narušení soukromí)",
                "Toxický 'mafiánský' mindset rodiny"
            ],
            culturalFit: "Vysoký tlak, nulová transparentnost, kult 'výjimečnosti'."
        });
        return;
    }

    try {
        const genAI = new GoogleGenAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
      Analyze the following job description for a candidate. 
      Be a cynical but helpful career coach. 
      OUTPUT IN CZECH LANGUAGE.
      
      Identify:
      1. A one-sentence summary of what the job *actually* is (stripping away fluff).
      2. Hidden risks or "red flags" implied by the text (e.g., "fast-paced" = burnout).
      3. A brief assessment of the cultural fit based on tone.
      
      Job Description:
      ${JOB_TEXT.substring(0, 5000)}
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("🤖 AI Analysis Received.");

        // Parse the simulated JSON or just print text
        printResults(jhi, noise, text);

    } catch (e) {
        console.error("AI Analysis failed:", e);
    }
}

function printResults(jhi, noise, ai) {
    const report = {
        id: 17080,
        jhi,
        noise,
        aiAnalysis: typeof ai === 'string' ? ai : JSON.stringify(ai, null, 2)
    };

    fs.writeFileSync('shaman_report_17080.json', JSON.stringify(report, null, 2));
    console.log("✅ Report saved to shaman_report_17080.json");
}

runAnalysis();
