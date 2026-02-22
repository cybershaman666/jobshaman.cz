export interface BlogPost {
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    content: string; // Markdown content
    date: string;
    modifiedDate?: string;
    readTime: string;
    category: string;
    image: string;
    author: string;
    keywords: string[];
    shamanSummary: string; // TL;DR for AEO
    qa: { question: string; answer: string }[]; // For FAQ schema
}

export const initialBlogPosts: BlogPost[] = [
    {
        id: 1,
        slug: 'jak-poznat-toxickou-firmu',
        title: 'Jak poznat toxickou firmu?',
        excerpt: 'Analýza 500+ inzerátů ukazuje jasné vzorce. Na čo si dát pozor, než pošlete své CV.',
        content: `
# Jak najít práci s vysokým JHI?

Job Happiness Index (JHI) není jen náhodné číslo. Je to výsledek komplexní analýzy, která bere v úvahu pět klíčových pilířů vaší pracovní spokojenosti:

## 1. Finanční Realita
Nejde o to, co je napsáno v inzerátu, ale o to, co vám zbude v kapse. Odečítáme daně, pojištění a náklady na dojíždění.

## 2. Časová Dotace
Čas strávený v práci a na cestě je čas, který nepatří vám. JHI penalizuje dlouhé dojezdy a přesčasy.

## 3. Duševní Pohoda
Analyzujeme "šum" v inzerátech a firemní kulturu. Málo transparentní firmy dostávají nižší skóre.

## 4. Možnost Růstu
Důležitá je nejen současná pozice, ale i to, kam vás může posunout.

## 5. Soulad s Hodnotami
Najdeme shodu mezi tím, co je důležité pro vás a co nabízí firma.

### Jak využít JHI při hledání?
Sledujte pozice s JHI nad 75 bodů. Tyto nabídky obvykle nabízejí nejlepší poměr mezi výkonem, odměnou a osobním životem.
    `,
        date: '2. února 2026',
        readTime: '5 min čtení',
        category: 'Tipy & Triky',
        image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800',
        author: 'Šaman Michal',
        keywords: ['toxická firma', 'JHI skóre', 'spokojenost v práci', 'analýza inzerátů', 'bullshit detektor'],
        shamanSummary: 'Toxické firmy se často schovávají za vágní fráze. Náš JHI skóre vám pomůže odhalit realitu dříve, než ztratíte čas na pohovoru. Klíčem je sledovat transparentnost a reálné dopady na váš čas a psychiku.',
        qa: [
            { question: 'Co je to JHI?', answer: 'Job Happiness Index je komplexní skóre od 0 do 100, které hodnotí kvalitu pracovní nabídky na základě financí, času, psychiky, růstu a hodnot.' },
            { question: 'Jak poznám málo transparentní firmu?', answer: 'Typickým znakem je absence mzdového rozmezí, vágní popis benefitů a nadužívání klišé jako "dynamické prostředí" bez konkrétních detailů.' }
        ]
    },
    {
        id: 2,
        slug: 'transparentnost-v-naboru-2026',
        title: 'Transparentnost v náboru 2026',
        excerpt: 'Nová směrnice EU o transparentnosti odměňování mění pravidla hry. Podívejte se, které firmy jsou nejdále.',
        content: `
# Transparentnost v náboru 2026

Evropská unie přichází s revoluční změnou v tom, jak firmy musí komunikovat odměňování. Už žádné "plat adekvátní zkušenostem".

## Co se mění?
Firmy budou povinny uvádět nástupní mzdu nebo alespoň rozmezí přímo v inzerátu. Kandidáti mají také právo vědět, jak jsou nastaveny platové hladiny pro stejnou pozici ve firmě.

## JobShaman a EU Transparent Badge
Naše platforma vyvinula systém "EU Transparent Badge", který automaticky přidělujeme firmám, které tyto standardy splňují již dnes.

### Proč na tom záleží?
Transparentní nábor šetří čas oběma stranám. Pokud firma tají plat, často to znamená, že není konkurenceschopná nebo nemá jasno v rozpočtu.
    `,
        date: '28. ledna 2026',
        readTime: '8 min čtení',
        category: 'Novinky',
        image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800',
        author: 'Tým JobShaman',
        keywords: ['transparentnost', 'EU směrnice', 'platové rozmezí', 'férový nábor', 'transparentní mzda'],
        shamanSummary: 'Rok 2026 je rokem konce mzdového tajemství v inzerátech. EU směrnice nutí firmy k otevřenosti, což radikálně zlepší pozici kandidátů na trhu práce. Firmy s naším Transparent Badge jsou v tomto o krok napřed.',
        qa: [
            { question: 'Musí firmy uvádět plat v inzerátu?', answer: 'Podle nové směrnice EU musí firmy poskytnout informace o nástupním platu nebo jeho rozmezí buď v inzerátu, nebo před pohovorem.' },
            { question: 'Co je EU Transparent Badge?', answer: 'Je to naše certifikace pro firmy, které dobrovolně splňují nejpřísnější kritéria transparentnosti v odměňování a popisu pozic.' }
        ]
    },
    {
        id: 3,
        slug: 'ai-jako-vas-karierni-kouc',
        title: 'AI jako váš kariérní kouč',
        excerpt: 'Jak efektivně využít Career Pathfinder a AI analýzu k posunu ve vaší profesní dráze.',
        content: `
# AI jako váš kariérní kouč

Žijeme v době, kdy umělá inteligence dokáže víc než jen psát texty. V JobShaman ji používáme jako váš osobní kompas na trhu práce.

## Career Pathfinder
Náš systém analyzuje váš profesní profil a porovnává ho s tisíci nabídkami. Neřeší jen klíčová slova, ale chápe kontext vašich zkušeností.

## Jak AI pomáhá s CV?
Místo obecných šablon vám AI navrhne, které vaše konkrétní úspěchy zdůraznit pro danou pozici, aby se zvýšila vaše "Match Rate".

## Budoucnost je v personalizaci
AI není náhrada za vaši osobnost, je to nástroj, který vám umožní vyniknout tam, kde na tom skutečně záleží.
    `,
        date: '15. ledna 2026',
        readTime: '6 min čtení',
        category: 'Technologie',
        image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
        author: 'AI Shaman',
        keywords: ['AI kariéra', 'Career Pathfinder', 'optimalizace CV', 'umělá inteligence', 'budoucnost práce'],
        shamanSummary: 'AI transformuje hledání práce z hádanky na vědu. Náš Career Pathfinder identifikuje vaše silné stránky a propojuje je s nejvhodnějšími příležitostmi, čímž maximalizuje vaše šance na úspěch bez nutnosti stovek pokusů.',
        qa: [
            { question: 'Jak funguje Career Pathfinder?', answer: 'Pathfinder využívá velké jazykové modely k analýze vašeho CV a požadavků trhu, čímž identifikuje "skryté" shody, které tradiční vyhledávání přehlédne.' },
            { question: 'Může AI napsat můj motivační dopis?', answer: 'Ano, ale v JobShaman doporučujeme AI používat jako asistenta pro strukturu a argumentaci, zatímco finální tón by měl zůstat váš vlastní.' }
        ]
    },
    {
        id: 4,
        slug: 'financni-svoboda-nebo-past-na-naivitu',
        title: 'Finanční svoboda, nebo past na naivitu? Jak číst mezi řádky inzerátů',
        excerpt: '„Neomezený výdělek“ zní skvěle, ale často znamená nulový fix a vysoké riziko. Naučte se číst varovné signály.',
        content: `
# Finanční svoboda, nebo past na naivitu? Jak číst mezi řádky inzerátů

Vítejte u dalšího dílu našeho blogu, kde si posvítíme na to, co se nám trh práce snaží prodat. Dnes jsme v síti JobShamana ulovili „exemplární kousek“ – nabídku pro obchodní zástupce, která slibuje hory doly, ale zapomíná na to nejdůležitější: realitu.

## „Neomezený výdělek“ jako první varovné znamení

Inzerát láká na finanční nezávislost a tvrdí, že „neexistuje strop“. Zní to skvěle, že? V řeči dat a transparentnosti, kterou prosazujeme v JobShamanovi, to ale často znamená: „Nemáme pro vás žádný fixní plat.“ Pokud nic neprodáte, nedostanete ani korunu. Žádný strop sice neexistuje, ale podlaha může být proklatě nízko.

## Emoce místo faktů

- „Pozitivně ovlivníme váš život“ – To je věta, kterou čekáte od motivačního kouče, ne od seriózního zaměstnavatele.
- „Obchodník tělem i duší“ – Fráze, která má zakrýt fakt, že v inzerátu chybí jakákoliv zmínka o produktu nebo oboru, ve kterém budete působit.

## Co v inzerátu chybí? (A JobShaman to ví)

Když náš algoritmus analyzuje takovou nabídku, okamžitě mu naskočí nízké JHI skóre. Proč?

- Chybí mzdové rozmezí: „Provize“ nejsou mzda. Transparentní trh vyžaduje jasná čísla.
- Chybí specifikace: Co se vlastně prodává? Je to pojištění, hrnce, nebo software?
- Vysoké riziko: „Nulový vstupní kapitál“ není benefit, ale standardní vlastnost jakéhokoliv legálního zaměstnání.

## Jak z toho ven? Hledejte kvalitu, ne slogany

V sekci Služby a Spolupráce na JobShamanovi razíme jinou cestu. Například odborníci na BOZP a legislativu (jako jsou moji rodiče) nenabízejí „změnu života“, ale jasně definované služby: audity, školení a zákonnou ochranu firem. Tam není potřeba swipovat mezi řádky, abyste našli pravdu.

## Závěr

Nenechte se opít „motivačními bonusy“ u firem, které vám neřeknou ani to, co budete dělat. V JobShamanovi věříme, že nejkratší cesta k úspěchu vede přes data a upřímnost.
    `,
        date: '5. února 2026',
        readTime: '6 min čtení',
        category: 'Analýzy',
        image: 'https://assets-global.website-files.com/619c916dd7a3fa284adc0b27/65fab957bd9f6fc7035b5198_6413b2e3-0a75-423d-944a-79f426f72cef.jpeg',
        author: 'Šaman Michal',
        keywords: ['finanční svoboda', 'provize', 'obchodní pozice', 'JHI skóre', 'transparentnost'],
        shamanSummary: '„Neomezený výdělek“ často znamená nulový fix a vysoké riziko. Naučte se rozpoznat varovné signály v inzerátech a hledejte nabídky s jasnými čísly a popisem práce.',
        qa: [
            { question: 'Proč je „neomezený výdělek“ varovný signál?', answer: 'Často jde o provizní model bez fixu. Bez prodeje není výdělek a riziko nese výhradně kandidát.' },
            { question: 'Co by měl férový inzerát uvádět?', answer: 'Jasné mzdové rozmezí, popis produktu/služby a realistické očekávání výkonu.' }
        ]
    },
    {
        id: 5,
        slug: 'product-update-unor-2026-ai-metriky-jhi-mzdy',
        title: 'Product Update: AI optimalizace, metriky interakcí, přesná kalkulačka mezd a JHI preference',
        excerpt: 'Shrnutí největších změn posledního týdne: rychlejší AI analýzy, lepší měření user behavior, stabilnější backend flow a nový finanční engine s personalizací JHI.',
        content: `
# Product Update: co se změnilo za poslední týden v JobShamanu

Poslední týden byl v JobShamanu čistě produktový sprint. Cíl byl jasný: zvýšit kvalitu rozhodování kandidáta i firmy pomocí přesnějších dat, rychlejší AI a stabilnější infrastruktury.

## 1) AI optimalizace: méně šumu, více použitelného signálu

Vyladili jsme AI vrstvu tak, aby:

- lépe oddělovala marketingové klišé od reálně užitečných informací v inzerátu,
- konzistentněji vracela výstupy pro porovnání více nabídek vedle sebe,
- byla připravená na personalizaci podle preferencí kandidáta (ne jen podle textu nabídky).

Praktický dopad: kandidát rychleji vidí, *proč* je nabídka kvalitní nebo riziková, místo generických AI komentářů.

## 2) Metriky a sledování uživatelské interakce

Zapracovali jsme na telemetry vrstvě a sledování interakcí v jobfeedu i detailu pozice:

- přesnější eventy pro impresi, otevření detailu a engagement,
- robustnější chování při výpadku backendu (graceful fallback místo tvrdého failu),
- lepší podklady pro měření relevance feedu a kvality doporučení.

Praktický dopad: máme přesnější data o tom, co lidé opravdu používají, a podle toho lze cíleně ladit ranking i UX.

## 3) Stabilita backendu a platebních toků

V průběhu týdne proběhly úpravy směrování kritických endpointů, hlavně pro billing/checkout:

- oddělení citlivých platebních flow od endpointů, kde hrozil cooldown,
- lepší chování CSRF/token toku při komunikaci mezi různými backend originy,
- méně timeoutů v momentech, kdy uživatel přechází do platby nebo ověřuje předplatné.

Praktický dopad: menší riziko, že upgrade nebo ověření předplatného spadne na síťové timeouty.

## 4) Včerejší release: přesná kalkulačka mezd + personalizace JHI

Největší změna včera: finanční vrstva už nefunguje jen jako hrubý odhad.

### Co je nové ve finanční kalkulaci

- přesnější výpočet čistého příjmu podle daňového profilu,
- započtení nákladů na dojíždění do finanční reality nabídky,
- lepší základ pro porovnání „vysoká hrubá mzda vs. reálné čisté peníze“.

### Co je nové v JHI preferencích

- uživatel může víc personalizovat váhy pilířů (finance, čas, mentální zátěž, růst, hodnoty),
- přibyly tvrdé limity (např. minimální čistý příjem, commute omezení),
- výsledek JHI je bližší tomu, co kandidát skutečně hledá.

Praktický dopad: JHI už není jen obecné skóre nabídky. Je to personalizovaný decision tool.

## 5) Co to znamená pro kandidáty a firmy

Pro kandidáty:

- rychlejší orientace v tom, která nabídka dává smysl *reálně* (ne marketingově),
- méně času ztraceného na inzerátech, které neodpovídají preferencím,
- lepší rozhodování díky propojení AI analýzy a finanční reality.

Pro firmy:

- transparentnější prezentace nabídky zvyšuje důvěru i konverzi,
- jasnější signály, proč kandidáti nabídku otevírají nebo ignorují,
- lepší podklady pro úpravu inzerátu a hiring funnelu.

## 6) Co bude následovat

V dalších iteracích navážeme na:

- hlubší personalizaci feedu podle JHI preferencí,
- další zpřesnění finančního modelu pro více zemí a typů úvazků,
- lepší viditelnost AI doporučení přímo v klíčových rozhodovacích momentech (job detail, apply flow, profil).

---

Pokud chcete tyto novinky využít naplno, aktualizujte si profil, nastavte JHI preference a porovnávejte nabídky přes finanční realitu, ne jen přes hrubou mzdu.
    `,
        date: '21. února 2026',
        modifiedDate: '21. února 2026',
        readTime: '7 min čtení',
        category: 'Product Update',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1200',
        author: 'Tým JobShaman',
        keywords: [
            'product update',
            'JobShaman',
            'AI optimalizace',
            'metriky interakcí',
            'tracking uživatelského chování',
            'kalkulačka čisté mzdy',
            'výpočet čisté mzdy',
            'dojíždění a náklady',
            'JHI preference',
            'Job Happiness Index',
            'personalizace hledání práce',
            'transparentní nábor'
        ],
        shamanSummary: 'Za poslední týden jsme v JobShamanu vyladili AI analýzy, zpřesnili metriky uživatelských interakcí, stabilizovali kritické backend flow a nasadili přesnou kalkulačku čisté mzdy s náklady na dojíždění. Včerejší release zároveň přinesl personalizované JHI preference a hard constraints, takže skóre nabídky je teď výrazně blíž reálnému rozhodování kandidáta.',
        qa: [
            {
                question: 'Co je hlavní přínos nové kalkulačky mezd v JobShamanu?',
                answer: 'Kalkulačka nově pracuje s daňovým profilem a náklady na dojíždění, takže ukazuje reálnější čistý příjem místo orientačního odhadu z hrubé mzdy.'
            },
            {
                question: 'Jak JHI preference mění výsledné skóre pracovních nabídek?',
                answer: 'Uživatel si nastaví váhy pilířů a hard constraints, proto je JHI personalizované. Dvě nabídky se stejnou mzdou tak mohou mít odlišné skóre podle vašich priorit.'
            },
            {
                question: 'Jaké backend změny zlepšily stabilitu upgradu a plateb?',
                answer: 'Oddělili jsme klíčové billing/checkout flow od endpointů náchylných na cooldown a upravili CSRF/token tok, aby při platbách docházelo k méně timeoutům.'
            },
            {
                question: 'Proč jsou metriky interakcí důležité pro kandidáty i firmy?',
                answer: 'Přesnější telemetry ukazuje, které nabídky mají skutečný engagement. Kandidát vidí relevantnější feed a firmy získají lepší podklady pro optimalizaci inzerce.'
            }
        ]
    },
    {
        id: 6,
        slug: 'jak-funguje-ai-shoda-a-ai-doporucene-razeni',
        title: 'Jak funguje AI shoda a proč může být pořadí v AI doporučeném feedu jiné',
        excerpt: 'Vysvětlujeme rozdíl mezi AI shodou na kartě a celkovým AI doporučeným řazením, aby feed dával jasný smysl.',
        content: `
# Jak funguje AI shoda v JobShamanu

V JobShamanu teď vidíte u nabídky procento **AI shody**. Často padá otázka: proč může být v režimu *AI doporučené* výše nabídka s nižším procentem než jiná níže?

Krátká odpověď: protože se v doporučeném feedu používá **celková relevance**, ne jen jeden jediný signál.

## 1) Co znamená AI shoda na kartě

AI shoda je rychlý indikátor, jak dobře nabídka sedí vašemu profilu a aktivním filtrům. Hodnota je normalizovaná na 0–100 %.

## 2) Co rozhoduje o pořadí v „AI doporučené“

Řazení v doporučeném feedu kombinuje více signálů:

- textová relevance dotazu a nabídky,
- profilový fit,
- čerstvost inzerátu,
- behaviorální prior (historická pravděpodobnost interakce),
- guardrails pro diverzitu výsledků.

Právě proto nemusí být pořadí vždy „striktně od nejvyššího procenta po nejnižší“.

## 3) Proč dává diverzita smysl

Kdyby feed řadil jen podle jednoho čísla, často by vracel velmi podobné nabídky od stejných firem. Diverzita zvyšuje šanci, že uvidíte širší výběr skutečně použitelných pozic.

## 4) Jak s tím pracovat prakticky

- Pokud chcete co nejčerstvější nabídky, použijte řazení **Nejnovější**.
- Pokud chcete co nejvyšší personalizaci, držte **AI doporučené**.
- AI shodu používejte jako orientační signál kvality konkrétní nabídky.

## Závěr

AI shoda a AI doporučené řazení spolu souvisí, ale nejsou to identické metriky. Cílem není jen „nejvyšší číslo nahoře“, ale **nejlepší celkový shortlist** pro reálné rozhodnutí.
    `,
        date: '22. února 2026',
        modifiedDate: '22. února 2026',
        readTime: '4 min čtení',
        category: 'AI Matching',
        image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=80&w=1200',
        author: 'Tým JobShaman',
        keywords: [
            'AI shoda',
            'AI doporučené',
            'job feed',
            'ranking',
            'relevance',
            'JobShaman'
        ],
        shamanSummary: 'AI shoda na kartě ukazuje fit konkrétní nabídky. AI doporučené řazení používá širší model relevance včetně čerstvosti a diverzity, proto nemusí být pořadí striktně podle procent.',
        qa: [
            {
                question: 'Proč není AI doporučené řazení vždy podle nejvyššího % shody?',
                answer: 'Protože feed optimalizuje celkovou relevanci a diverzitu, ne pouze jeden ukazatel. Do pořadí vstupuje více signálů zároveň.'
            },
            {
                question: 'Je AI shoda na kartě pořád důležitá?',
                answer: 'Ano. Je to rychlý indikátor fitu konkrétní nabídky. Pro finální pořadí ale model bere i další faktory, například čerstvost.'
            }
        ]
    }
];
