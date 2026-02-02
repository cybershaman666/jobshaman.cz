export interface BlogPost {
    id: number;
    title: string;
    excerpt: string;
    content: string; // Markdown content
    date: string;
    readTime: string;
    category: string;
    image: string;
}

export const initialBlogPosts: BlogPost[] = [
    {
        id: 1,
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
        image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800'
    },
    {
        id: 2,
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
        image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800'
    },
    {
        id: 3,
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
        image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800'
    }
];
