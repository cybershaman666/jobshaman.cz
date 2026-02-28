import { JcfpmDimensionId } from '../../types';

type DimensionMeta = { title: string; definition: string; subdims: string };

type BandCopy = { high: string; mid: string; low: string };

type ReportCopy = {
  dimensionMeta: Record<JcfpmDimensionId, DimensionMeta>;
  bridgePairs: { self: JcfpmDimensionId; perf: JcfpmDimensionId; label: string }[];
  describeScore: Record<JcfpmDimensionId, BandCopy>;
  longNarrative: Record<JcfpmDimensionId, BandCopy>;
};

const REPORT_COPY: Record<string, ReportCopy> = {
  cs: {
    dimensionMeta: {
      d1_cognitive: {
        title: 'Kognitivní styl',
        definition: 'Způsob zpracování informací a řešení problémů.',
        subdims: 'Analytické vs. intuitivní • Struktura vs. improvizace • Detail vs. celek',
      },
      d2_social: {
        title: 'Sociální orientace',
        definition: 'Preferovaný způsob interakce s lidmi a týmové dynamiky.',
        subdims: 'Samostatnost vs. tým • Chuť vést lidi • Vnější vs. interní komunikace',
      },
      d3_motivational: {
        title: 'Motivační profil',
        definition: 'Co tě pohání a co považuješ za odměnu.',
        subdims: 'Autonomie vs. struktura • Rozvoj vs. výkon • Vnitřní vs. vnější motivace',
      },
      d4_energy: {
        title: 'Energetický styl',
        definition: 'Tempo, intenzita a styl práce.',
        subdims: 'Sprint vs. stabilní tempo • Přepínání úkolů vs. hluboká práce • Naléhavost vs. stabilita',
      },
      d5_values: {
        title: 'Hodnotová kotvení',
        definition: 'Co musí práce přinášet, aby dávala smysl.',
        subdims: 'Dopad vs. osobní růst • Inovace vs. stabilita • Vztahy vs. výkon',
      },
      d6_ai_readiness: {
        title: 'Připravenost na práci s AI',
        definition: 'Jak dobře prosperuješ v rychle se měnícím technologickém prostředí.',
        subdims: 'Učení nového • Tolerance nejistoty • Aktivní práce s AI',
      },
      d7_cognitive_reflection: {
        title: 'Kognitivní reflexe a logika',
        definition: 'Schopnost zastavit první intuici a ověřit ji logikou.',
        subdims: 'Intuice vs. ověření • Logické pasti • Odhalování nesmyslů',
      },
      d8_digital_eq: {
        title: 'Digitální EQ',
        definition: 'Citlivost na emoce, tón a důvěru v textové komunikaci.',
        subdims: 'Empatie v textu • Konflikt v chatu • Důvěryhodnost',
      },
      d9_systems_thinking: {
        title: 'Systémové myšlení',
        definition: 'Jak dobře čteš vztahy, zpětné vazby a vedlejší efekty.',
        subdims: 'Příčina a následek • Zpětné vazby • Zpožděné dopady',
      },
      d10_ambiguity_interpretation: {
        title: 'Interpretace nejasností',
        definition: 'Jak čteš nejasné situace – rizika vs. příležitosti.',
        subdims: 'Opatrnost vs. průzkum • Hrozby vs. růst',
      },
      d11_problem_decomposition: {
        title: 'Rozklad problémů',
        definition: 'Schopnost rozsekat velký problém na jasné kroky.',
        subdims: 'Struktura • Prioritizace • Architektura řešení',
      },
      d12_moral_compass: {
        title: 'Morální & etický kompas',
        definition: 'Stabilita hodnot v dilematech a tlakových situacích.',
        subdims: 'Integrita • Důvěra • Dlouhodobé dopady',
      },
    },
    bridgePairs: [
      { self: 'd1_cognitive', perf: 'd7_cognitive_reflection', label: 'Analytika vs. logika' },
      { self: 'd2_social', perf: 'd8_digital_eq', label: 'Sociální styl vs. digitální EQ' },
      { self: 'd3_motivational', perf: 'd11_problem_decomposition', label: 'Motivace vs. rozklad problémů' },
      { self: 'd4_energy', perf: 'd9_systems_thinking', label: 'Tempo vs. systémové myšlení' },
      { self: 'd5_values', perf: 'd12_moral_compass', label: 'Hodnoty vs. etika v praxi' },
      { self: 'd6_ai_readiness', perf: 'd10_ambiguity_interpretation', label: 'Připravenost na AI vs. práce s nejistotou' },
    ],
    describeScore: {
      d1_cognitive: {
        high: 'Analytické myšlení je u tebe výrazně silné. Skvěle rozkládáš problémy, hledáš vzorce a děláš rozhodnutí na základě logiky.',
        mid: 'Kognitivní styl je vyvážený. Umíš kombinovat analytiku i intuici podle situace.',
        low: 'Více se opíráš o intuici a celkový dojem. Daří se ti v situacích, kde není dost dat a je potřeba cit.',
      },
      d2_social: {
        high: 'Silná sociální orientace. Přirozeně tě baví spolupráce, vedení a práce s lidmi.',
        mid: 'Sociální orientace je vyvážená. Dokážeš fungovat v týmu i samostatně.',
        low: 'Preferuješ samostatnost. Nejvíc ti vyhovuje klid a soustředění bez častých interakcí.',
      },
      d3_motivational: {
        high: 'Vysoká vnitřní motivace. Tlačí tě smysl, autonomie a osobní růst.',
        mid: 'Motivace je vyvážená. Umíš fungovat v různých stylech odměn a vedení.',
        low: 'Silněji reaguješ na vnější motivátory. Jasná pravidla, cíle a odměny tě drží v tempu.',
      },
      d4_energy: {
        high: 'Zvládáš vysoké tempo. Umíš fungovat v intenzivních a dynamických situacích.',
        mid: 'Energetický styl je stabilní. Umíš si tempo přizpůsobit, když je potřeba.',
        low: 'Preferuješ klidnější tempo. Dlouhodobě ti sedí stabilní rytmus bez neustálých změn.',
      },
      d5_values: {
        high: 'Silné hodnotové ukotvení v impactu a inovacích. Potřebuješ smysl a přesah.',
        mid: 'Hodnoty máš vyvážené. Dokážeš fungovat v různých typech kultur.',
        low: 'Spíše tě drží stabilita a praktické jistoty. V prostředí chaosu bys mohl/a trpět.',
      },
      d6_ai_readiness: {
        high: 'Vysoká připravenost na AI. Rychle se učíš nové nástroje a změny tě spíš posilují.',
        mid: 'Připravenost na AI je vyvážená. Nové technologie zvládáš, když je dobré vedení.',
        low: 'AI změny pro tebe nejsou přirozené. Potřebuješ stabilitu a jasný rámec.',
      },
      d7_cognitive_reflection: {
        high: 'Silná kognitivní reflexe. Dokážeš zastavit intuitivní odpověď a ověřit ji logikou.',
        mid: 'Vyvážená kognitivní reflexe. Často ověřuješ intuici, ale umíš se rozhodnout i rychle.',
        low: 'Rychlá intuice dominuje. V nejasných situacích můžeš potřebovat vědomé ověření.',
      },
      d8_digital_eq: {
        high: 'Vysoká digitální empatie. Umíš číst tón, emoce i podtext v textové komunikaci.',
        mid: 'Vyvážené digitální EQ. Většinu nuancí zachytíš, občas pomůže explicitní ověření.',
        low: 'Nižší citlivost na tón v textu. Pomůže jasná struktura komunikace.',
      },
      d9_systems_thinking: {
        high: 'Silné systémové myšlení. Vnímáš zpětné vazby a vedlejší efekty.',
        mid: 'Vyvážený systémový pohled. Umíš kombinovat lineární a síťové uvažování.',
        low: 'Spíše lineární uvažování. Pomůže mapování širších dopadů.',
      },
      d10_ambiguity_interpretation: {
        high: 'Silná orientace na příležitosti. V nejasnosti vidíš potenciál růstu.',
        mid: 'Vyvážené vnímání rizik a příležitostí. Umíš držet opatrnost i odvahu.',
        low: 'Spíše orientace na rizika. V nejistotě preferuješ bezpečný rámec.',
      },
      d11_problem_decomposition: {
        high: 'Silný rozklad problémů. Umíš rychle vytvořit jasnou strukturu kroků.',
        mid: 'Vyvážený rozklad problémů. Struktura ti jde, ale pomáhá rámec.',
        low: 'Rozklad velkých úkolů je náročnější. Pomohou kontrolní seznamy a šablony.',
      },
      d12_moral_compass: {
        high: 'Silný morální kompas. Integrita a dlouhodobá důvěra jsou pro tebe klíčové.',
        mid: 'Vyvážený etický kompas. Umíš kombinovat výkon a principy.',
        low: 'Pragmatická orientace na výkon. Dlouhodě pomáhá jasné hodnotové ukotvení.',
      },
    },
    longNarrative: {
      d1_cognitive: {
        high: 'Tvůj kognitivní styl je výrazně analytický. Přirozeně rozkládáš složité situace, hledáš vzorce a opíráš se o logiku. Pozor na zbytečné prodlužování rozhodnutí – pomůže time‑boxing nebo malé experimenty.',
        mid: 'Kognitivní styl je vyvážený. Kombinuješ analýzu i intuici podle situace, což je silná výhoda v proměnlivém prostředí. Pomáhá mít jednoduché rozhodovací pravidlo, aby se neztrácely priority.',
        low: 'Spíše se opíráš o intuici a celkový dojem. Daří se ti v situacích bez dostatku dat a tam, kde rozhoduje cit. U důležitých rozhodnutí přidej krátké ověření klíčových faktů.',
      },
      d2_social: {
        high: 'Sociální orientace je u tebe velmi silná. Energie ti dává spolupráce, práce s lidmi a často i leadership. Nastav si hranice, aby tě intenzivní sociální kontakt nevyčerpával.',
        mid: 'Sociální orientace je vyvážená. Umíš fungovat v týmu i samostatně a přepínat podle potřeby. Pomáhá vědomě si říct, kdy vedeš a kdy podporuješ.',
        low: 'Preferuješ samostatnost a klid. Nejlépe funguješ v prostředí s hlubokým soustředěním. V meeting‑heavy kulturách si pomůžeš jasnou strukturou a omezenou synchronizací.',
      },
      d3_motivational: {
        high: 'Silná vnitřní motivace ti dává tah na smysl a autonomii. Nejlépe funguješ tam, kde můžeš rozhodovat a růst. V rigidních prostředích můžeš rychle ztratit energii.',
        mid: 'Motivace je vyvážená. Zvládáš jak vnitřní smysl, tak jasné cíle a odměny. Pomáhá ujasnit si, co je v dané fázi nejdůležitější.',
        low: 'Více reaguješ na vnější motivátory a jasné cíle. Když jsou pravidla a měřitelné výsledky, výkon roste. Dbej na transparentní očekávání a férové odměny.',
      },
      d4_energy: {
        high: 'Zvládáš vysoké tempo a dynamiku. Umíš se rozjet v krizových i náročných situacích. Plánuj regeneraci, aby se energie dlouhodobě držela.',
        mid: 'Energetický styl je stabilní a adaptivní. Umíš přepnout mezi klidem i zrychlením podle potřeby. Hlídáš si rytmus dne, aby nevznikalo přetížení.',
        low: 'Sedí ti klidnější tempo a stabilní rytmus. Vynikáš v rolích s dlouhým soustředěním a menšími výkyvy. Chraň si focus bloky a minimalizuj chaos.',
      },
      d5_values: {
        high: 'Silné hodnotové ukotvení v impactu a inovacích. Potřebuješ smysl a přesah, aby práce „seděla“. V čistě procesních prostředích může motivace klesat.',
        mid: 'Hodnoty máš vyvážené a umíš se přizpůsobit různým kulturám. Pomáhá vědomě si vybrat, co je pro tebe právě teď nejdůležitější.',
        low: 'Více tě drží stabilita a praktické jistoty. Vynikáš v prostředí s jasnými pravidly a předvídatelným rytmem. V experimentech a chaosu ti může být méně pohodlně.',
      },
      d6_ai_readiness: {
        high: 'AI readiness máš vysokou. Rychle se učíš a změny tě spíš posilují. Vynikneš v rolích, kde se testují nové nástroje a přístupy.',
        mid: 'Připravenost na AI je vyvážená. Nové technologie zvládáš, když je dobré vedení a jasný smysl. Průběžné vzdělávání ti pomůže držet tempo.',
        low: 'Změny tě více zatěžují a potřebuješ stabilitu. AI se můžeš naučit, ale chce to čas a podporu. Vhodné jsou role, kde je technologie spíš nástroj než hlavní obsah práce.',
      },
      d7_cognitive_reflection: {
        high: 'Silná kognitivní reflexe znamená, že umíš zastavit intuici a ověřit ji logikou. To chrání tým před unáhlenými chybami. Dávej si pozor, aby ověřování nebylo zbytečně dlouhé.',
        mid: 'Kognitivní reflexe je vyvážená. Umíš rychle rozhodovat a zároveň ověřit klíčové předpoklady. Pomáhá jednoduchý checklist pro náročná rozhodnutí.',
        low: 'Rychlá intuice u tebe dominuje. To je výhoda v dynamických situacích, ale hrozí logické zkratky. Přidej krátký ověřovací krok u důležitých rozhodnutí.',
      },
      d8_digital_eq: {
        high: 'Digitální EQ je velmi vysoké. V textu čteš tón, emoce i podtext a umíš uklidňovat situace. Hlídaj, aby tě vztahová stránka neodváděla od výkonu.',
        mid: 'Digitální EQ je vyvážené. Většinu nuancí zachytíš, občas pomůže explicitní ověření. To ti dá stabilitu v náročnějších vláknech.',
        low: 'Citlivost na tón v textu je nižší. Můžeš působit přímočařeji, než zamýšlíš. Pomáhá krátké uznání a ověření porozumění.',
      },
      d9_systems_thinking: {
        high: 'Systémové myšlení je silné. Vidíš vztahy, zpětné vazby i vedlejší efekty. Hlídaj, aby modelování nebylo příliš složité – stanov si hranice systému.',
        mid: 'Systémové myšlení je vyvážené. Umíš spojovat souvislosti bez ztráty rychlosti. Pomáhá krátké mapování dopadů u větších změn.',
        low: 'Spíše uvažuješ lineárně. To je efektivní v jasných úlohách, ale u komplexity hrozí vedlejší dopady. Pomůže jednoduchá mapa vztahů.',
      },
      d10_ambiguity_interpretation: {
        high: 'V nejasnostech vidíš příležitosti a směr. Jsi rychlý/á v hledání potenciálu růstu. Dbej na základní kontrolu rizik, aby se nic nepřehlédlo.',
        mid: 'Vnímání rizik a příležitostí je vyvážené. Umíš držet opatrnost i odvahu podle situace. To je silná kombinace v nejistém prostředí.',
        low: 'Spíše se orientuješ na rizika a bezpečný rámec. To chrání před chybami, ale může brzdit tempo. Pomáhá strukturovaný experiment s jasnými limity.',
      },
      d11_problem_decomposition: {
        high: 'Rozklad problémů je silná stránka. Rychle vytváříš strukturu kroků a doručíš postup. Dávej pozor, aby struktura zůstala flexibilní.',
        mid: 'Rozklad problémů je vyvážený. Struktura ti jde, ale občas pomůže rámec. Kontrolní seznamy a šablony ti dodají jistotu.',
        low: 'Rozklad velkých úkolů je náročnější. Pomůže rozdělit vše do 3–5 kroků a dát jim jednoduchý termín.',
      },
      d12_moral_compass: {
        high: 'Morální kompas je silný. Integrita a důvěra jsou pro tebe klíčové. V tlaku se vyplatí jasně komunikovat principy a dopady.',
        mid: 'Etický kompas je vyvážený. Umíš kombinovat výkon s principy. Pomáhá si vyjasnit hranice už na začátku projektu.',
        low: 'Orientace je spíše pragmatická. V náročných situacích může hrozit eroze důvěry. Pomůže explicitní hodnotový rámec a dohody.',
      },
    },
  },
  en: {
    dimensionMeta: {
      d1_cognitive: {
        title: 'Cognitive Style',
        definition: 'How you process information and solve problems.',
        subdims: 'Analytical vs. intuitive • Structure vs. improvisation • Detail vs. big picture',
      },
      d2_social: {
        title: 'Social Orientation',
        definition: 'Preferred way of interacting with people and team dynamics.',
        subdims: 'Autonomy vs. team • Drive to lead • External vs. internal communication',
      },
      d3_motivational: {
        title: 'Motivational Profile',
        definition: 'What drives you and what feels rewarding.',
        subdims: 'Autonomy vs. structure • Growth vs. performance • Intrinsic vs. extrinsic motivation',
      },
      d4_energy: {
        title: 'Energy Style',
        definition: 'Pace, intensity, and work rhythm.',
        subdims: 'Sprint vs. steady pace • Task switching vs. deep work • Urgency vs. stability',
      },
      d5_values: {
        title: 'Value Anchors',
        definition: 'What work must deliver to feel meaningful.',
        subdims: 'Impact vs. personal growth • Innovation vs. stability • Relationships vs. performance',
      },
      d6_ai_readiness: {
        title: 'AI Readiness',
        definition: 'How you thrive in fast-changing tech environments.',
        subdims: 'Learning new things • Tolerance of uncertainty • Active use of AI',
      },
      d7_cognitive_reflection: {
        title: 'Cognitive Reflection & Logic',
        definition: 'Ability to stop first intuition and verify with logic.',
        subdims: 'Intuition vs. verification • Logical traps • Detecting nonsense',
      },
      d8_digital_eq: {
        title: 'Digital EQ',
        definition: 'Sensitivity to emotions, tone, and trust in text communication.',
        subdims: 'Empathy in text • Conflict in chat • Trustworthiness',
      },
      d9_systems_thinking: {
        title: 'Systems Thinking',
        definition: 'How well you read relationships, feedback loops, and side effects.',
        subdims: 'Cause and effect • Feedback loops • Delayed impacts',
      },
      d10_ambiguity_interpretation: {
        title: 'Ambiguity Interpretation',
        definition: 'How you read unclear situations—risk vs. opportunity.',
        subdims: 'Caution vs. exploration • Threats vs. growth',
      },
      d11_problem_decomposition: {
        title: 'Problem Decomposition',
        definition: 'Ability to break a big problem into clear steps.',
        subdims: 'Structure • Prioritization • Solution architecture',
      },
      d12_moral_compass: {
        title: 'Moral & Ethical Compass',
        definition: 'Stability of values in dilemmas and pressure.',
        subdims: 'Integrity • Trust • Long-term impact',
      },
    },
    bridgePairs: [
      { self: 'd1_cognitive', perf: 'd7_cognitive_reflection', label: 'Analytics vs. logic' },
      { self: 'd2_social', perf: 'd8_digital_eq', label: 'Social style vs. digital EQ' },
      { self: 'd3_motivational', perf: 'd11_problem_decomposition', label: 'Motivation vs. decomposition' },
      { self: 'd4_energy', perf: 'd9_systems_thinking', label: 'Pace vs. systems thinking' },
      { self: 'd5_values', perf: 'd12_moral_compass', label: 'Values vs. ethics in practice' },
      { self: 'd6_ai_readiness', perf: 'd10_ambiguity_interpretation', label: 'AI readiness vs. ambiguity handling' },
    ],
    describeScore: {
      d1_cognitive: {
        high: 'Your analytical thinking is strong. You break problems down, spot patterns, and make logic-driven decisions.',
        mid: 'Your cognitive style is balanced. You blend analysis and intuition depending on the situation.',
        low: 'You lean more on intuition and overall feel. You do well when data is limited and judgment is needed.',
      },
      d2_social: {
        high: 'Strong social orientation. Collaboration, leadership, and working with people energize you.',
        mid: 'Social orientation is balanced. You can work in a team or independently.',
        low: 'You prefer autonomy. Calm focus without frequent interactions suits you best.',
      },
      d3_motivational: {
        high: 'High intrinsic motivation. Meaning, autonomy, and growth drive you.',
        mid: 'Motivation is balanced. You can operate with different reward and leadership styles.',
        low: 'You respond more to external motivators. Clear goals, rules, and rewards keep you on pace.',
      },
      d4_energy: {
        high: 'You handle a fast pace well. Intense and dynamic situations suit you.',
        mid: 'Your energy style is stable. You adapt pace when needed.',
        low: 'You prefer a calmer pace. A steady rhythm without constant change fits you long-term.',
      },
      d5_values: {
        high: 'Strong value anchor in impact and innovation. You need meaning and reach.',
        mid: 'Values are balanced. You can function in different types of cultures.',
        low: 'Stability and practical certainty matter more. Highly chaotic settings can be draining.',
      },
      d6_ai_readiness: {
        high: 'High AI readiness. You learn tools quickly and change tends to energize you.',
        mid: 'AI readiness is balanced. New tech works when there is good guidance.',
        low: 'AI change is not natural for you. You need stability and a clear frame.',
      },
      d7_cognitive_reflection: {
        high: 'Strong cognitive reflection. You can pause intuition and verify with logic.',
        mid: 'Balanced cognitive reflection. You verify intuition often, but can also decide quickly.',
        low: 'Fast intuition dominates. In unclear situations, deliberate verification helps.',
      },
      d8_digital_eq: {
        high: 'High digital empathy. You read tone, emotions, and subtext in text communication.',
        mid: 'Balanced digital EQ. Most nuances are captured; explicit checks help sometimes.',
        low: 'Lower sensitivity to tone in text. Clear structure improves communication.',
      },
      d9_systems_thinking: {
        high: 'Strong systems thinking. You see feedback loops and side effects.',
        mid: 'Balanced systems view. You combine linear and network thinking.',
        low: 'More linear thinking. Mapping broader impacts helps.',
      },
      d10_ambiguity_interpretation: {
        high: 'Opportunity‑oriented. You see growth potential in uncertainty.',
        mid: 'Balanced view of risk and opportunity. You hold caution and courage together.',
        low: 'Risk‑oriented. In uncertainty you prefer a safe frame.',
      },
      d11_problem_decomposition: {
        high: 'Strong problem decomposition. You quickly build a clear structure of steps.',
        mid: 'Balanced decomposition. Structure works, but a frame helps.',
        low: 'Breaking down big tasks is harder. Checklists and templates help.',
      },
      d12_moral_compass: {
        high: 'Strong moral compass. Integrity and long‑term trust are key for you.',
        mid: 'Balanced ethical compass. You combine performance with principles.',
        low: 'Pragmatic performance focus. Clear value anchors help in the long run.',
      },
    },
    longNarrative: {
      d1_cognitive: {
        high: 'Your cognitive style is strongly analytical. You naturally decompose complex situations, look for patterns, and rely on logic. Watch for analysis paralysis—time‑box decisions or run small experiments.',
        mid: 'Your cognitive style is balanced. You mix analysis and intuition as the context requires. Simple decision rules help keep priorities clear.',
        low: 'You lean toward intuition and overall feel. That works well when data is scarce, but add a quick fact check for high‑stakes choices.',
      },
      d2_social: {
        high: 'Social orientation is very strong. Collaboration, people work, and often leadership give you energy. Set boundaries so social load does not exhaust you.',
        mid: 'Social orientation is balanced. You can work independently or in a team as needed. Be explicit about when you lead versus support.',
        low: 'You prefer autonomy and calm focus. Meeting‑heavy cultures can be draining—use structured syncs and deep‑work blocks.',
      },
      d3_motivational: {
        high: 'Strong intrinsic drive pushes you toward meaning and autonomy. You perform best where you can decide and grow. Rigid environments can drain you fast.',
        mid: 'Motivation is balanced. You can operate on both meaning and clear external goals. Clarify what matters most in the current phase.',
        low: 'External motivators and clear goals work best for you. When expectations and rewards are transparent, your performance rises.',
      },
      d4_energy: {
        high: 'You handle high pace and intensity well. You can accelerate under pressure. Plan recovery to keep energy sustainable.',
        mid: 'Energy style is stable and adaptable. You can speed up or settle down as needed. Protect your daily rhythm to avoid drift.',
        low: 'A steady, calmer pace fits you best. You excel with long focus blocks and fewer surprises. Guard your deep‑work time.',
      },
      d5_values: {
        high: 'You are strongly anchored in impact and innovation. Work feels meaningful when it changes something. Purely procedural settings may demotivate you.',
        mid: 'Your values are balanced and adaptable. You can function across cultures, but benefit from choosing a clear priority.',
        low: 'Stability and practical certainty matter most. You thrive in structured environments; chaotic experiments can be draining.',
      },
      d6_ai_readiness: {
        high: 'AI readiness is high. You learn fast and change energizes you. Roles with experimentation and new tools will suit you.',
        mid: 'AI readiness is balanced. You adapt when there is guidance and clear purpose. Ongoing learning helps you keep pace.',
        low: 'Change is more stressful and you need stability. You can learn AI, but with time and support. Tech‑as‑tool roles fit well.',
      },
      d7_cognitive_reflection: {
        high: 'Cognitive reflection is strong. You pause intuition and verify with logic, preventing costly errors. Keep checks efficient so they do not slow you down.',
        mid: 'Reflection is balanced. You verify key assumptions yet can decide quickly. A short checklist helps on complex decisions.',
        low: 'Fast intuition dominates. This is great for speed, but risky for logic traps. Add a short verification step for big calls.',
      },
      d8_digital_eq: {
        high: 'Digital EQ is very high. You read tone and emotions in text and can calm tense threads. Ensure relationship work does not override delivery.',
        mid: 'Digital EQ is balanced. You catch most nuances, and a quick clarification resolves conflicts. This supports smooth async work.',
        low: 'Text tone sensitivity is lower. You may sound sharper than intended. Add brief acknowledgments and confirm understanding.',
      },
      d9_systems_thinking: {
        high: 'Systems thinking is strong. You see feedback loops and side effects and can design stable solutions. Set system boundaries to avoid over‑modeling.',
        mid: 'Systems thinking is balanced. You see connections without getting lost. A quick impact map helps on larger changes.',
        low: 'You think more linearly. That is efficient for clear tasks but can miss side effects. Use a simple relationship map.',
      },
      d10_ambiguity_interpretation: {
        high: 'You are opportunity‑oriented in ambiguity and find direction quickly. Add a basic risk scan so nothing critical is missed.',
        mid: 'Risk and opportunity are balanced. You can hold caution and exploration together, which is strong in uncertain contexts.',
        low: 'You lean toward risk and safe frames. This prevents mistakes but can slow progress. Try structured experiments with clear limits.',
      },
      d11_problem_decomposition: {
        high: 'Problem decomposition is a strength. You create clear steps quickly and drive delivery. Keep structure flexible as reality changes.',
        mid: 'Decomposition is balanced. Structure helps, but a frame is useful. Templates and checklists give extra clarity.',
        low: 'Breaking down big tasks is harder. Split work into 3–5 steps with simple deadlines to regain control.',
      },
      d12_moral_compass: {
        high: 'Moral compass is strong. Integrity and trust guide your decisions. Communicate principles clearly under pressure.',
        mid: 'Ethical compass is balanced. You can combine performance and principles. Clarify boundaries early in projects.',
        low: 'Orientation is more pragmatic. In pressure, trust can erode. Use explicit values and safeguards.',
      },
    },
  },
};

const resolveLocale = (locale?: string) => (locale && REPORT_COPY[locale] ? locale : 'cs');

export const DIMENSIONS: { id: JcfpmDimensionId }[] = [
  { id: 'd1_cognitive' },
  { id: 'd2_social' },
  { id: 'd3_motivational' },
  { id: 'd4_energy' },
  { id: 'd5_values' },
  { id: 'd6_ai_readiness' },
  { id: 'd7_cognitive_reflection' },
  { id: 'd8_digital_eq' },
  { id: 'd9_systems_thinking' },
  { id: 'd10_ambiguity_interpretation' },
  { id: 'd11_problem_decomposition' },
  { id: 'd12_moral_compass' },
];

export const scoreMax = (dim: JcfpmDimensionId, extendedDims: Set<JcfpmDimensionId>) => (extendedDims.has(dim) ? 100 : 7);

export const normalizeTo100 = (dim: JcfpmDimensionId, raw: number, extendedDims: Set<JcfpmDimensionId>) => (extendedDims.has(dim) ? raw : (raw / 7) * 100);

export const getDimensionMeta = (locale: string) => REPORT_COPY[resolveLocale(locale)].dimensionMeta;

export const getBridgePairs = (locale: string) => REPORT_COPY[resolveLocale(locale)].bridgePairs;

export const describeScore = (locale: string, dim: JcfpmDimensionId, raw: number, percentile: number, extendedDims: Set<JcfpmDimensionId>) => {
  const rounded = Math.round(raw * 10) / 10;
  const maxScore = scoreMax(dim, extendedDims);
  const isExtended = extendedDims.has(dim);
  const band = isExtended ? (raw >= 80 ? 'high' : raw >= 40 ? 'mid' : 'low') : percentile >= 85 ? 'high' : percentile >= 50 ? 'mid' : 'low';
  const lookup = REPORT_COPY[resolveLocale(locale)].describeScore;
  const base = lookup[dim]?.[band as keyof BandCopy] || `Skóre ${rounded}/${maxScore}.`;
  return base.replace('{rounded}', String(rounded)).replace('{max}', String(maxScore));
};

export const longNarrative = (locale: string, dim: JcfpmDimensionId, raw: number, percentile: number, extendedDims: Set<JcfpmDimensionId>) => {
  const rounded = Math.round(raw * 10) / 10;
  const maxScore = scoreMax(dim, extendedDims);
  const isExtended = extendedDims.has(dim);
  const band = isExtended ? (raw >= 80 ? 'high' : raw >= 40 ? 'mid' : 'low') : percentile >= 85 ? 'high' : percentile >= 50 ? 'mid' : 'low';
  const lookup = REPORT_COPY[resolveLocale(locale)].longNarrative;
  const base = lookup[dim]?.[band as keyof BandCopy] || `Skóre ${rounded}/${maxScore}.`;
  return base.replace('{rounded}', String(rounded)).replace('{max}', String(maxScore));
};

