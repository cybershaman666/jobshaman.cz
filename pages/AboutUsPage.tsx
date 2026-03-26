import { Activity, ArrowRight, Brain, Gauge, Handshake, Sparkles, Target, Users2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import LegalPage from '../components/LegalPage';

type AboutFounder = {
  name: string;
  role: string;
  body: string;
  initials: string;
};

type AboutCopy = {
  pageTitle: string;
  backLabel: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroQuote: string;
  directionTitle: string;
  directionRows: Array<{ from: string; to: string }>;
  problemTitle: string;
  problemBody: string;
  oldFlowLabel: string;
  oldFlow: string[];
  newFlowLabel: string;
  newFlow: string[];
  signalsEyebrow: string;
  signalsTitle: string;
  signalsIntro: string;
  signals: Array<{ label: string; value: number; note: string }>;
  signalsFooter: string;
  fitTitle: string;
  fitFormula: string;
  fitBody: string;
  fitFactors: string[];
  twoSidedTitle: string;
  twoSidedBody: string;
  companySideTitle: string;
  companySideItems: string[];
  candidateSideTitle: string;
  candidateSideItems: string[];
  predictionTitle: string;
  predictionBody: string;
  predictionQuestions: string[];
  shiftTitle: string;
  shiftRows: Array<{ from: string; to: string }>;
  whatTitle: string;
  whatBody: string[];
  foundersTitle: string;
  founders: AboutFounder[];
  closingTitle: string;
  closingBody: string;
  footerPunchline: string;
};

const buildCopy = (normalizedLocale: string): AboutCopy => {
  if (normalizedLocale === 'cs') {
    return {
      pageTitle: 'O nás',
      backLabel: 'Zpět do aplikace',
      heroEyebrow: 'About JobShaman',
      heroTitle: 'Pomáháme lidem a firmám poznat, jak se jim bude opravdu spolupracovat.',
      heroSubtitle:
        'JobShaman staví hiring na reálné interakci, krátké pracovní zkušenosti a jasnějších signálech o tom, jak člověk přemýšlí, komunikuje a roste v konkrétním týmu.',
      heroQuote:
        'Nejlepší rozhodnutí nevzniká z papíru. Vzniká v prvních minutách společné práce.',
      directionTitle: 'Jak měníme začátek hiringu',
      directionRows: [
        { from: 'životopis jako vstup', to: 'spolupráce jako začátek' },
        { from: 'pohovor jako hlavní filtr', to: 'krátká simulace práce' },
        { from: 'dojem z kandidáta', to: 'pozorovatelný signál' },
        { from: 'výběr nejlepšího profilu', to: 'shoda s týmem a prostředím' },
      ],
      problemTitle: 'Práce se poznává ve spolupráci, ne v papírovém profilu.',
      problemBody:
        'Běžný hiring je silný v třídění profilů a sběru informací. Slabší je v tom nejdůležitějším: v odhadu budoucí spolupráce. Přitom právě ta rozhoduje o tom, jak člověk přemýšlí, komunikuje, reaguje na feedback a funguje v konkrétním prostředí.',
      oldFlowLabel: 'Tradiční pipeline',
      oldFlow: ['CV', 'Filtering', 'Interviews', 'Tests', 'Offer'],
      newFlowLabel: 'Jak začíná JobShaman',
      newFlow: ['Reálný problém', 'Krátká pracovní session', 'Signály z chování', 'Kompatibilita', 'Výhled spolupráce'],
      signalsEyebrow: 'Signály z reálné interakce',
      signalsTitle: 'Krátká pracovní session rychle ukáže styl myšlení i spolupráce.',
      signalsIntro:
        'Když firma ukáže reálný problém a člověk na něj začne reagovat, objeví se velmi konkrétní signály. Je vidět způsob uvažování, práce s prioritami i to, jak člověk komunikuje v pohybu.',
      signals: [
        { label: 'Jak člověk pracuje s nejasností', value: 86, note: 'Umí se zorientovat, nebo ztuhne bez perfektního briefu?' },
        { label: 'Jak strukturuje problém', value: 81, note: 'Rozpadne chaos na kroky, nebo zůstane na povrchu?' },
        { label: 'Jaké otázky pokládá', value: 74, note: 'Ptá se tak, aby pochopil kontext, priority a rizika?' },
        { label: 'Jak reaguje na feedback', value: 69, note: 'Brání se, nebo umí rychle upravit směr?' },
        { label: 'Co se rozhodne optimalizovat', value: 78, note: 'Tlačí rychlost, kvalitu, jistotu nebo vztahy?' },
      ],
      signalsFooter: 'Díky tomu se rozhodnutí opírá o konkrétní chování a silnější signály o budoucím výkonu.',
      fitTitle: 'Silný výkon vzniká tam, kde se potká schopnost se správným prostředím.',
      fitFormula: 'performance = capability × environment',
      fitBody:
        'Proto sledujeme kompatibilitu s konkrétním týmem a konkrétním kontextem. Nejde o abstraktní pořadí kandidátů. Jde o to, kde může člověk podat silný výkon, dobře růst a zapadnout do skutečného rytmu práce.',
      fitFactors: ['tempo práce', 'komunikační styl', 'míra autonomie', 'rozhodovací kultura', 'tolerance k riziku a nejasnosti'],
      twoSidedTitle: 'Když obě strany vidí totéž, vzniká lepší shoda.',
      twoSidedBody:
        'Stejné signály, které pomáhají firmě, mají být vidět i kandidátům. Díky tomu vzniká větší porozumění ještě před tím, než práce vůbec začne.',
      companySideTitle: 'Firma vidí',
      companySideItems: [
        'jak člověk přemýšlí pod tlakem a nejasností',
        'jak strukturuje práci a nastavuje priority',
        'jak komunikuje a reaguje na změnu směru',
      ],
      candidateSideTitle: 'Kandidát vidí',
      candidateSideItems: [
        'kde se mu bude dařit a kde bude potřebovat více podpory',
        'kde je pravděpodobný růst',
        'kde se může objevit tření ještě před nástupem',
      ],
      predictionTitle: 'Místo jedné odpovědi vzniká jasnější výhled.',
      predictionBody:
        'Díváme se na to, jak se může spolupráce vyvíjet v čase. Hiring pro nás není jen rozhodnutí pro dnešek. Je to výhled na to, co se může stát za několik měsíců v konkrétním prostředí.',
      predictionQuestions: [
        'Jaká je pravděpodobnost úspěšné spolupráce za 6 měsíců?',
        'Kde se může objevit tření?',
        'Jak rychle může tenhle člověk v tomhle prostředí růst?',
      ],
      shiftTitle: 'Posun, který dává hiringu nový základ',
      shiftRows: [
        { from: 'životopis', to: 'spolupráce' },
        { from: 'pohovor', to: 'simulace' },
        { from: 'dojem', to: 'signál' },
        { from: 'selekce', to: 'kompatibilita' },
      ],
      whatTitle: 'Co je JobShaman',
      whatBody: [
        'JobShaman je místo, kde si můžeš práci zažít ještě předtím, než začne. Firmy ukazují reálné problémy a kandidáti vstupují do krátké pracovní interakce.',
        'Během ní je vidět způsob myšlení, rozhodování i styl spolupráce. Díky tomu se hiring opírá o konkrétnější signály a větší porozumění mezi oběma stranami.',
        'Výsledkem je jasnější rozhodnutí o tom, jak by spolu mohli člověk, tým a konkrétní způsob práce fungovat.',
      ],
      foundersTitle: 'Founders',
      founders: [
        {
          name: 'Misha Hlaváčů',
          role: 'Systems thinker. Builder. Doesn’t trust black boxes.',
          body:
            'Misha navrhuje a staví systémy od základů — od AI-driven platforem po reálné operace. Věří, že většina softwaru problémy neřeší, jen je schovává. JobShaman je jeho pokus postavit něco, co opravdu odráží realitu.',
          initials: 'MH',
        },
        {
          name: 'Danijela Nandi',
          role: 'Product leader. Operator. Sees the whole system.',
          body:
            'Danijela má za sebou více než 15 let budování digitálních produktů, vedení týmů a transformace organizací napříč Evropou i USA. Rozumí tomu, jak se rozhodnutí dělají — a jak často jsou špatně. JobShaman je o tom dělat je jasnější, rychlejší a lidštější.',
          initials: 'DN',
        },
      ],
      closingTitle: 'JobShaman dává práci ochutnat ještě před rozhodnutím.',
      closingBody:
        'Měníme základní jednotku hiringu: z dokumentu na spolupráci, z dojmu na signál a ze selekce na porozumění tomu, co se může dít dál.',
      footerPunchline: 'Více porozumění. Silnější signály. Lepší spolupráce.',
    };
  }

  if (normalizedLocale === 'sk') {
    return {
      pageTitle: 'O nás',
      backLabel: 'Späť do aplikácie',
      heroEyebrow: 'About JobShaman',
      heroTitle: 'Pomáhame ľuďom a firmám pochopiť, ako sa im bude naozaj spolupracovať.',
      heroSubtitle:
        'JobShaman stavia hiring na reálnej interakcii, krátkej pracovnej skúsenosti a jasnejších signáloch o tom, ako človek premýšľa, komunikuje a rastie v konkrétnom tíme.',
      heroQuote:
        'Najlepšie rozhodnutie nevzniká na papieri. Vzniká v prvých minútach spoločnej práce.',
      directionTitle: 'Ako meníme začiatok hiringu',
      directionRows: [
        { from: 'životopis ako vstup', to: 'spolupráca ako začiatok' },
        { from: 'pohovor ako hlavný filter', to: 'krátka simulácia práce' },
        { from: 'dojem z kandidáta', to: 'pozorovateľný signál' },
        { from: 'výber najlepšieho profilu', to: 'zhoda s tímom a prostredím' },
      ],
      problemTitle: 'Prácu spoznáte v spolupráci, nie v papierovom profile.',
      problemBody:
        'Bežný hiring je silný v triedení profilov a zbieraní informácií. Slabší je v tom najdôležitejšom: v odhade budúcej spolupráce. Práve tá však rozhoduje o tom, ako človek premýšľa, komunikuje, reaguje na feedback a funguje v konkrétnom prostredí.',
      oldFlowLabel: 'Tradičný proces',
      oldFlow: ['CV', 'Filtering', 'Interviews', 'Tests', 'Offer'],
      newFlowLabel: 'Ako začína JobShaman',
      newFlow: ['Reálny problém', 'Krátka pracovná session', 'Signály zo správania', 'Kompatibilita', 'Výhľad spolupráce'],
      signalsEyebrow: 'Signály z reálnej interakcie',
      signalsTitle: 'Krátka pracovná session rýchlo ukáže štýl myslenia aj spolupráce.',
      signalsIntro:
        'Keď firma ukáže reálny problém a človek naň začne reagovať, objavia sa veľmi konkrétne signály. Vidno spôsob uvažovania, prácu s prioritami aj to, ako človek komunikuje v pohybe.',
      signals: [
        { label: 'Ako človek pracuje s nejasnosťou', value: 86, note: 'Vie sa zorientovať, alebo stuhne bez perfektného briefu?' },
        { label: 'Ako štruktúruje problém', value: 81, note: 'Rozloží chaos na kroky, alebo zostane na povrchu?' },
        { label: 'Aké otázky kladie', value: 74, note: 'Pýta sa tak, aby pochopil kontext, priority a riziká?' },
        { label: 'Ako reaguje na feedback', value: 69, note: 'Bráni sa, alebo vie rýchlo upraviť smer?' },
        { label: 'Čo sa rozhodne optimalizovať', value: 78, note: 'Tlačí rýchlosť, kvalitu, istotu alebo vzťahy?' },
      ],
      signalsFooter: 'Vďaka tomu sa rozhodnutie opiera o konkrétne správanie a silnejšie signály o budúcom výkone.',
      fitTitle: 'Silný výkon vzniká tam, kde sa stretne schopnosť so správnym prostredím.',
      fitFormula: 'performance = capability × environment',
      fitBody:
        'Preto sledujeme kompatibilitu s konkrétnym tímom a konkrétnym kontextom. Nejde o abstraktné poradie kandidátov. Ide o to, kde môže človek podať silný výkon, dobre rásť a zapadnúť do skutočného rytmu práce.',
      fitFactors: ['tempo práce', 'komunikačný štýl', 'miera autonómie', 'rozhodovacia kultúra', 'tolerancia k riziku a nejasnosti'],
      twoSidedTitle: 'Keď obe strany vidia to isté, vzniká lepšia zhoda.',
      twoSidedBody:
        'Rovnaké signály, ktoré pomáhajú firme, by mali vidieť aj kandidáti. Vďaka tomu vzniká väčšie porozumenie ešte pred tým, než sa práca vôbec začne.',
      companySideTitle: 'Firma vidí',
      companySideItems: [
        'ako človek premýšľa pod tlakom a nejasnosťou',
        'ako štruktúruje prácu a nastavuje priority',
        'ako komunikuje a reaguje na zmenu smeru',
      ],
      candidateSideTitle: 'Kandidát vidí',
      candidateSideItems: [
        'kde sa mu bude dariť a kde bude potrebovať viac podpory',
        'kde je pravdepodobný rast',
        'kde sa môže objaviť trenie ešte pred nástupom',
      ],
      predictionTitle: 'Namiesto jednej odpovede vzniká jasnejší výhľad.',
      predictionBody:
        'Pozeráme sa na to, ako sa môže spolupráca vyvíjať v čase. Hiring pre nás nie je len rozhodnutie pre dnešok. Je to výhľad na to, čo sa môže stať o niekoľko mesiacov v konkrétnom prostredí.',
      predictionQuestions: [
        'Aká je pravdepodobnosť úspešnej spolupráce o 6 mesiacov?',
        'Kde sa môže objaviť trenie?',
        'Ako rýchlo môže tento človek v tomto prostredí rásť?',
      ],
      shiftTitle: 'Posun, ktorý dáva hiringu nový základ',
      shiftRows: [
        { from: 'životopis', to: 'spolupráca' },
        { from: 'pohovor', to: 'simulácia' },
        { from: 'dojem', to: 'signál' },
        { from: 'selekcia', to: 'kompatibilita' },
      ],
      whatTitle: 'Čo je JobShaman',
      whatBody: [
        'JobShaman je miesto, kde si môžeš prácu zažiť ešte predtým, než sa začne. Firmy ukazujú reálne problémy a kandidáti vstupujú do krátkej pracovnej interakcie.',
        'Počas nej je vidieť spôsob myslenia, rozhodovania aj štýl spolupráce. Vďaka tomu sa hiring opiera o konkrétnejšie signály a väčšie porozumenie medzi oboma stranami.',
        'Výsledkom je jasnejšie rozhodnutie o tom, ako by spolu mohli človek, tím a konkrétny spôsob práce fungovať.',
      ],
      foundersTitle: 'Founders',
      founders: [
        {
          name: 'Misha Hlaváčů',
          role: 'Systems thinker. Builder. Doesn’t trust black boxes.',
          body:
            'Misha navrhuje a stavia systémy od základov — od AI-driven platforiem po reálne operácie. Verí, že väčšina softvéru problémy nerieši, len ich skrýva. JobShaman je jeho pokus postaviť niečo, čo naozaj odráža realitu.',
          initials: 'MH',
        },
        {
          name: 'Danijela Nandi',
          role: 'Product leader. Operator. Sees the whole system.',
          body:
            'Danijela má za sebou viac než 15 rokov budovania digitálnych produktov, vedenia tímov a transformácie organizácií naprieč Európou aj USA. Rozumie tomu, ako sa rozhodnutia robia — a ako často sú nesprávne. JobShaman je o tom robiť ich jasnejšími, rýchlejšími a ľudskejšími.',
          initials: 'DN',
        },
      ],
      closingTitle: 'JobShaman dáva prácu ochutnať ešte pred rozhodnutím.',
      closingBody:
        'Meníme základnú jednotku hiringu: z dokumentu na spoluprácu, z dojmu na signál a zo selekcie na porozumenie tomu, čo sa môže diať ďalej.',
      footerPunchline: 'Viac porozumenia. Silnejšie signály. Lepšia spolupráca.',
    };
  }

  if (normalizedLocale === 'de') {
    return {
      pageTitle: 'Über uns',
      backLabel: 'Zurück zur App',
      heroEyebrow: 'About JobShaman',
      heroTitle: 'Wir helfen Menschen und Unternehmen zu erkennen, wie Zusammenarbeit wirklich funktionieren wird.',
      heroSubtitle:
        'JobShaman baut Hiring auf echter Interaktion, einer kurzen Arbeitserfahrung und klareren Signalen darüber auf, wie jemand denkt, kommuniziert und in einem konkreten Team wächst.',
      heroQuote:
        'Die beste Entscheidung entsteht nicht auf Papier. Sie entsteht in den ersten Minuten gemeinsamer Arbeit.',
      directionTitle: 'Wie wir den Einstieg ins Hiring verändern',
      directionRows: [
        { from: 'Lebenslauf als Einstieg', to: 'Zusammenarbeit als Anfang' },
        { from: 'Interview als Hauptfilter', to: 'kurze Arbeitssimulation' },
        { from: 'Eindruck vom Kandidaten', to: 'beobachtbares Signal' },
        { from: 'Auswahl des besten Profils', to: 'Passung zu Team und Umfeld' },
      ],
      problemTitle: 'Arbeit zeigt sich in Zusammenarbeit, nicht in einem Profil auf Papier.',
      problemBody:
        'Klassisches Hiring ist stark im Sortieren von Profilen und Sammeln von Informationen. Schwächer ist es dort, wo es am wichtigsten ist: bei der Einschätzung zukünftiger Zusammenarbeit. Genau sie entscheidet aber darüber, wie jemand denkt, kommuniziert, auf Feedback reagiert und in einem konkreten Umfeld arbeitet.',
      oldFlowLabel: 'Traditioneller Ablauf',
      oldFlow: ['CV', 'Filtering', 'Interviews', 'Tests', 'Offer'],
      newFlowLabel: 'So beginnt JobShaman',
      newFlow: ['Reales Problem', 'Kurze Arbeitssession', 'Verhaltenssignale', 'Kompatibilität', 'Ausblick auf Zusammenarbeit'],
      signalsEyebrow: 'Signale aus echter Interaktion',
      signalsTitle: 'Eine kurze Arbeitssession zeigt schnell Denkstil und Zusammenarbeit.',
      signalsIntro:
        'Wenn ein Unternehmen ein reales Problem zeigt und eine Person darauf reagiert, entstehen sehr konkrete Signale. Sichtbar werden Denkweise, Umgang mit Prioritäten und die Art, in Bewegung zu kommunizieren.',
      signals: [
        { label: 'Wie jemand mit Unklarheit umgeht', value: 86, note: 'Findet die Person Orientierung oder blockiert sie ohne perfekten Brief?' },
        { label: 'Wie ein Problem strukturiert wird', value: 81, note: 'Wird Chaos in Schritte übersetzt oder bleibt alles an der Oberfläche?' },
        { label: 'Welche Fragen gestellt werden', value: 74, note: 'Fragt die Person so, dass Kontext, Prioritäten und Risiken klar werden?' },
        { label: 'Wie auf Feedback reagiert wird', value: 69, note: 'Verteidigt sie die erste Antwort oder passt sie den Kurs schnell an?' },
        { label: 'Was optimiert wird', value: 78, note: 'Geht es zuerst um Tempo, Qualität, Sicherheit oder Beziehungen?' },
      ],
      signalsFooter: 'So basiert die Entscheidung auf konkretem Verhalten und stärkeren Signalen über künftige Leistung.',
      fitTitle: 'Starke Leistung entsteht dort, wo Fähigkeit auf das richtige Umfeld trifft.',
      fitFormula: 'performance = capability × environment',
      fitBody:
        'Deshalb betrachten wir Kompatibilität mit einem konkreten Team und einem konkreten Kontext. Es geht nicht um eine abstrakte Rangliste von Kandidaten. Es geht darum, wo jemand stark leisten, gut wachsen und in den realen Arbeitsrhythmus passen kann.',
      fitFactors: ['Arbeitstempo', 'Kommunikationsstil', 'Grad an Autonomie', 'Entscheidungskultur', 'Umgang mit Risiko und Ambiguität'],
      twoSidedTitle: 'Wenn beide Seiten dasselbe sehen, entsteht bessere Passung.',
      twoSidedBody:
        'Die gleichen Signale, die Unternehmen helfen, sollten auch für Kandidaten sichtbar sein. So entsteht mehr Verständnis, noch bevor die Arbeit überhaupt beginnt.',
      companySideTitle: 'Das Unternehmen sieht',
      companySideItems: [
        'wie jemand unter Druck und Unsicherheit denkt',
        'wie Arbeit strukturiert und priorisiert wird',
        'wie kommuniziert und auf Richtungswechsel reagiert wird',
      ],
      candidateSideTitle: 'Der Kandidat sieht',
      candidateSideItems: [
        'wo er sich entfalten kann und wo mehr Unterstützung nötig wäre',
        'wo Wachstum wahrscheinlich ist',
        'wo Reibung schon vor dem Start entstehen könnte',
      ],
      predictionTitle: 'Statt nur einer Antwort entsteht ein klarerer Ausblick.',
      predictionBody:
        'Wir schauen darauf, wie sich Zusammenarbeit über Zeit entwickeln könnte. Hiring ist für uns nicht nur eine Entscheidung für heute. Es ist ein Ausblick darauf, was in einigen Monaten in einem konkreten Umfeld passieren kann.',
      predictionQuestions: [
        'Wie hoch ist die Wahrscheinlichkeit erfolgreicher Zusammenarbeit in 6 Monaten?',
        'Wo könnte Reibung entstehen?',
        'Wie schnell kann diese Person in diesem Umfeld wachsen?',
      ],
      shiftTitle: 'Der Wandel, der Hiring ein neues Fundament gibt',
      shiftRows: [
        { from: 'Lebenslauf', to: 'Zusammenarbeit' },
        { from: 'Interview', to: 'Simulation' },
        { from: 'Eindruck', to: 'Signal' },
        { from: 'Selektion', to: 'Kompatibilität' },
      ],
      whatTitle: 'Was JobShaman ist',
      whatBody: [
        'JobShaman ist ein Ort, an dem Arbeit erlebbar wird, bevor sie beginnt. Unternehmen zeigen reale Probleme und Kandidaten treten in eine kurze Arbeitsinteraktion ein.',
        'Dabei werden Denkweise, Entscheidungsstil und Zusammenarbeit sichtbar. So stützt sich Hiring auf konkretere Signale und mehr gegenseitiges Verständnis.',
        'Das Ergebnis ist eine klarere Entscheidung darüber, wie Person, Team und Arbeitsweise zusammen funktionieren können.',
      ],
      foundersTitle: 'Founders',
      founders: [
        {
          name: 'Misha Hlaváčů',
          role: 'Systems thinker. Builder. Doesn’t trust black boxes.',
          body:
            'Misha entwirft und baut Systeme von Grund auf — von AI-driven Plattformen bis zu realen Operations. Er glaubt, dass die meiste Software Probleme nicht löst, sondern nur verdeckt. JobShaman ist sein Versuch, etwas zu bauen, das die Realität wirklich abbildet.',
          initials: 'MH',
        },
        {
          name: 'Danijela Nandi',
          role: 'Product leader. Operator. Sees the whole system.',
          body:
            'Danijela hat mehr als 15 Jahre digitale Produkte aufgebaut, Teams geführt und Organisationen in Europa und den USA transformiert. Sie versteht, wie Entscheidungen getroffen werden — und wie oft sie falsch sind. JobShaman soll diese Entscheidungen klarer, schneller und menschlicher machen.',
          initials: 'DN',
        },
      ],
      closingTitle: 'JobShaman macht Arbeit vor der Entscheidung erlebbar.',
      closingBody:
        'Wir verändern die Grundeinheit des Hiring: vom Dokument zur Zusammenarbeit, vom Eindruck zum Signal und von der Selektion zum Verständnis dessen, was als Nächstes passieren kann.',
      footerPunchline: 'Mehr Verständnis. Stärkere Signale. Bessere Zusammenarbeit.',
    };
  }

  if (normalizedLocale === 'pl') {
    return {
      pageTitle: 'O nas',
      backLabel: 'Powrót do aplikacji',
      heroEyebrow: 'About JobShaman',
      heroTitle: 'Pomagamy ludziom i firmom zobaczyć, jak naprawdę będzie im się razem pracować.',
      heroSubtitle:
        'JobShaman opiera hiring na realnej interakcji, krótkim doświadczeniu pracy i wyraźniejszych sygnałach pokazujących, jak ktoś myśli, komunikuje się i rośnie w konkretnym zespole.',
      heroQuote:
        'Najlepsza decyzja nie powstaje na papierze. Powstaje w pierwszych minutach wspólnej pracy.',
      directionTitle: 'Jak zmieniamy początek hiringu',
      directionRows: [
        { from: 'CV jako punkt wejścia', to: 'współpraca jako początek' },
        { from: 'rozmowa jako główny filtr', to: 'krótka symulacja pracy' },
        { from: 'wrażenie z kandydata', to: 'obserwowalny sygnał' },
        { from: 'wybór najlepszego profilu', to: 'dopasowanie do zespołu i środowiska' },
      ],
      problemTitle: 'Pracę poznaje się we współpracy, a nie w papierowym profilu.',
      problemBody:
        'Klasyczny hiring dobrze radzi sobie z sortowaniem profili i zbieraniem informacji. Gorzej wypada tam, gdzie to najważniejsze: w ocenie przyszłej współpracy. A to właśnie ona decyduje o tym, jak ktoś myśli, komunikuje się, reaguje na feedback i działa w konkretnym środowisku.',
      oldFlowLabel: 'Tradycyjny proces',
      oldFlow: ['CV', 'Filtering', 'Interviews', 'Tests', 'Offer'],
      newFlowLabel: 'Tak zaczyna JobShaman',
      newFlow: ['Realny problem', 'Krótka sesja pracy', 'Sygnały z zachowania', 'Kompatybilność', 'Perspektywa współpracy'],
      signalsEyebrow: 'Sygnały z realnej interakcji',
      signalsTitle: 'Krótka sesja pracy szybko pokazuje styl myślenia i współpracy.',
      signalsIntro:
        'Gdy firma pokazuje realny problem, a kandydat zaczyna na niego reagować, pojawiają się bardzo konkretne sygnały. Widać sposób myślenia, pracę z priorytetami i to, jak ktoś komunikuje się w działaniu.',
      signals: [
        { label: 'Jak ktoś pracuje z niejednoznacznością', value: 86, note: 'Czy potrafi się odnaleźć, czy zatrzymuje się bez idealnego briefu?' },
        { label: 'Jak strukturyzuje problem', value: 81, note: 'Czy rozbija chaos na kroki, czy zostaje na powierzchni?' },
        { label: 'Jakie pytania zadaje', value: 74, note: 'Czy pyta tak, by zrozumieć kontekst, priorytety i ryzyka?' },
        { label: 'Jak reaguje na feedback', value: 69, note: 'Czy broni pierwszej odpowiedzi, czy potrafi szybko skorygować kierunek?' },
        { label: 'Co wybiera do optymalizacji', value: 78, note: 'Czy naciska na tempo, jakość, pewność czy relacje?' },
      ],
      signalsFooter: 'Dzięki temu decyzja opiera się na konkretnym zachowaniu i mocniejszych sygnałach o przyszłej skuteczności.',
      fitTitle: 'Silny wynik powstaje tam, gdzie zdolność spotyka odpowiednie środowisko.',
      fitFormula: 'performance = capability × environment',
      fitBody:
        'Dlatego patrzymy na kompatybilność z konkretnym zespołem i konkretnym kontekstem. Nie chodzi o abstrakcyjny ranking kandydatów. Chodzi o to, gdzie ktoś może osiągać dobre wyniki, rozwijać się i wejść w realny rytm pracy.',
      fitFactors: ['tempo pracy', 'styl komunikacji', 'poziom autonomii', 'kultura podejmowania decyzji', 'tolerancja na ryzyko i niejednoznaczność'],
      twoSidedTitle: 'Gdy obie strony widzą to samo, łatwiej o dobre dopasowanie.',
      twoSidedBody:
        'Te same sygnały, które pomagają firmie, powinny być widoczne także dla kandydata. Dzięki temu większe zrozumienie pojawia się jeszcze przed startem pracy.',
      companySideTitle: 'Firma widzi',
      companySideItems: [
        'jak ktoś myśli pod presją i w niejasności',
        'jak układa pracę i ustawia priorytety',
        'jak komunikuje się i reaguje na zmianę kierunku',
      ],
      candidateSideTitle: 'Kandydat widzi',
      candidateSideItems: [
        'gdzie będzie mu dobrze, a gdzie potrzebne będzie większe wsparcie',
        'gdzie wzrost jest najbardziej prawdopodobny',
        'gdzie jeszcze przed startem może pojawić się tarcie',
      ],
      predictionTitle: 'Zamiast jednej odpowiedzi powstaje wyraźniejsza perspektywa.',
      predictionBody:
        'Patrzymy na to, jak współpraca może rozwijać się w czasie. Hiring nie jest dla nas tylko decyzją na dziś. To spojrzenie na to, co może wydarzyć się za kilka miesięcy w konkretnym środowisku.',
      predictionQuestions: [
        'Jakie jest prawdopodobieństwo udanej współpracy za 6 miesięcy?',
        'Gdzie może pojawić się tarcie?',
        'Jak szybko ta osoba może rosnąć w tym środowisku?',
      ],
      shiftTitle: 'Zmiana, która daje hiringowi nowy fundament',
      shiftRows: [
        { from: 'CV', to: 'współpraca' },
        { from: 'rozmowa', to: 'symulacja' },
        { from: 'wrażenie', to: 'sygnał' },
        { from: 'selekcja', to: 'kompatybilność' },
      ],
      whatTitle: 'Czym jest JobShaman',
      whatBody: [
        'JobShaman to miejsce, w którym można doświadczyć pracy, zanim ona się zacznie. Firmy pokazują realne problemy, a kandydaci wchodzą w krótką interakcję roboczą.',
        'W jej trakcie widać sposób myślenia, podejmowania decyzji i styl współpracy. Dzięki temu hiring opiera się na konkretniejszych sygnałach i większym zrozumieniu po obu stronach.',
        'Efektem jest jaśniejsza decyzja o tym, jak człowiek, zespół i sposób pracy mogą razem funkcjonować.',
      ],
      foundersTitle: 'Founders',
      founders: [
        {
          name: 'Misha Hlaváčů',
          role: 'Systems thinker. Builder. Doesn’t trust black boxes.',
          body:
            'Misha projektuje i buduje systemy od podstaw — od AI-driven platform po realne operacje. Wierzy, że większość oprogramowania nie rozwiązuje problemów, tylko je ukrywa. JobShaman to jego próba zbudowania czegoś, co naprawdę odzwierciedla rzeczywistość.',
          initials: 'MH',
        },
        {
          name: 'Danijela Nandi',
          role: 'Product leader. Operator. Sees the whole system.',
          body:
            'Danijela ma ponad 15 lat doświadczenia w budowaniu produktów cyfrowych, prowadzeniu zespołów i transformacji organizacji w Europie i USA. Rozumie, jak podejmowane są decyzje — i jak często są błędne. JobShaman ma sprawiać, że te decyzje będą jaśniejsze, szybsze i bardziej ludzkie.',
          initials: 'DN',
        },
      ],
      closingTitle: 'JobShaman pozwala poczuć pracę jeszcze przed decyzją.',
      closingBody:
        'Zmieniamy podstawową jednostkę hiringu: z dokumentu na współpracę, z wrażenia na sygnał i z selekcji na zrozumienie tego, co może wydarzyć się dalej.',
      footerPunchline: 'Więcej zrozumienia. Mocniejsze sygnały. Lepsza współpraca.',
    };
  }

  return {
    pageTitle: 'About Us',
    backLabel: 'Back to app',
    heroEyebrow: 'About JobShaman',
    heroTitle: 'We help people and companies understand how they will actually work together.',
    heroSubtitle:
      'JobShaman builds hiring on real interaction, a short working experience, and clearer signals about how someone thinks, communicates, and grows inside a specific team.',
    heroQuote:
      'The best decision is not made on paper. It starts in the first minutes of working together.',
    directionTitle: 'How we change the start of hiring',
    directionRows: [
      { from: 'CV as the entry point', to: 'collaboration as the start' },
      { from: 'interview as the main filter', to: 'short work simulation' },
      { from: 'impression of the candidate', to: 'observable signal' },
      { from: 'selecting the best profile', to: 'fit with team and environment' },
    ],
    problemTitle: 'Work reveals itself in collaboration, not in a profile on paper.',
    problemBody:
      'Traditional hiring is strong at sorting profiles and collecting information. It is weaker where it matters most: estimating future collaboration. Yet that is exactly what determines how someone thinks, communicates, reacts to feedback, and operates inside a specific environment.',
    oldFlowLabel: 'Traditional pipeline',
    oldFlow: ['CV', 'Filtering', 'Interviews', 'Tests', 'Offer'],
    newFlowLabel: 'How JobShaman starts',
    newFlow: ['Real problem', 'Short working session', 'Behavioral signals', 'Compatibility', 'Collaboration outlook'],
    signalsEyebrow: 'Signals from real interaction',
    signalsTitle: 'A short working session quickly shows both thinking style and collaboration style.',
    signalsIntro:
      'When a company presents a real problem and a candidate begins responding to it, very concrete signals appear. You can see thinking style, priority handling, and how someone communicates in motion.',
    signals: [
      { label: 'How someone handles ambiguity', value: 86, note: 'Do they freeze without a perfect brief, or find their way through uncertainty?' },
      { label: 'How they structure a problem', value: 81, note: 'Can they turn noise into steps, tradeoffs, and direction?' },
      { label: 'What questions they ask', value: 74, note: 'Do they ask to understand context, priorities, and constraints?' },
      { label: 'How they react to feedback', value: 69, note: 'Do they defend the first answer, or adjust quickly and intelligently?' },
      { label: 'What they choose to optimize', value: 78, note: 'Do they optimize for speed, certainty, quality, trust, or learning?' },
    ],
    signalsFooter: 'That makes the decision more grounded in actual behavior and stronger signals about future performance.',
    fitTitle: 'Strong performance happens where capability meets the right environment.',
    fitFormula: 'performance = capability × environment',
    fitBody:
      'That is why we do not evaluate people in isolation. We evaluate compatibility with a specific team and a specific context. The goal is not to find the best person in abstract. The goal is to find the right match for the way the work actually happens.',
    fitFactors: ['pace of work', 'communication style', 'level of autonomy', 'decision-making culture', 'tolerance for risk and ambiguity'],
    twoSidedTitle: 'When both sides see the same thing, alignment gets stronger.',
    twoSidedBody:
      'The same signals that help the company should also be visible to the candidate. That creates more understanding before the work even begins.',
    companySideTitle: 'The company sees',
    companySideItems: [
      'how a person thinks under pressure and ambiguity',
      'how they structure work and set priorities',
      'how they communicate and respond to feedback',
    ],
    candidateSideTitle: 'The candidate sees',
    candidateSideItems: [
      'where they are likely to thrive and where they may need more support',
      'where growth is likely',
      'where friction may appear before day one',
    ],
    predictionTitle: 'Instead of one answer, you get a clearer outlook.',
    predictionBody:
      'We look at how collaboration may develop over time. Hiring is not just a decision for today. It is an outlook on what may happen in a few months inside a concrete environment.',
    predictionQuestions: [
      'What is the probability of successful collaboration in 6 months?',
      'Where might friction emerge?',
      'How fast can this person grow in this environment?',
    ],
    shiftTitle: 'The shift that gives hiring a new foundation',
    shiftRows: [
      { from: 'CV', to: 'collaboration' },
      { from: 'interview', to: 'simulation' },
      { from: 'impression', to: 'signal' },
      { from: 'selection', to: 'compatibility' },
    ],
    whatTitle: 'What JobShaman is',
    whatBody: [
      'JobShaman is a place where work can be experienced before it starts. Companies show real problems, and candidates step into a short working interaction.',
      'Inside that interaction, thinking style, decision-making, and collaboration become visible. That gives both sides more concrete signals and more shared understanding.',
      'The result is a clearer decision about how a person, a team, and a specific way of working may fit together.',
    ],
    foundersTitle: 'Founders',
    founders: [
      {
        name: 'Misha Hlaváčů',
        role: 'Systems thinker. Builder. Doesn’t trust black boxes.',
        body:
          'Misha designs and builds systems from the ground up — from AI-driven platforms to real-world operations. He believes most software does not solve problems; it just hides them. JobShaman is his attempt to build something that actually reflects reality.',
        initials: 'MH',
      },
      {
        name: 'Danijela Nandi',
        role: 'Product leader. Operator. Sees the whole system.',
        body:
          'Danijela has spent 15+ years building digital products, leading teams, and transforming organizations across Europe and the US. She understands how decisions are made — and how often they are wrong. JobShaman is about making those decisions clearer, faster, and more human.',
        initials: 'DN',
      },
    ],
    closingTitle: 'JobShaman lets work be experienced before the decision.',
    closingBody:
      'We are changing the unit of hiring itself: from document to collaboration, from impression to signal, and from selection to understanding what may happen next.',
    footerPunchline: 'More understanding. Stronger signals. Better collaboration.',
  };
};

const flowPillClass =
  'inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold';

const AboutUsPage = () => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const normalizedLocale = locale === 'at' ? 'de' : locale;
  const backLink = `/${locale}/`;
  const copy = buildCopy(normalizedLocale);
  const ui = normalizedLocale === 'cs'
    ? {
        heroCard: 'Spolupráce jako začátek',
        directionFrom: 'Běžně',
        directionTo: 'V JobShamanu',
        modelLabel: 'Model kompatibility',
        problemEyebrow: 'Jak vypadá posun',
        fitEyebrow: 'Kompatibilita',
        fitModel: 'Model',
        twoSidedEyebrow: 'Oboustranné rozhodnutí',
        predictionEyebrow: 'Výhled spolupráce',
      }
    : normalizedLocale === 'sk'
      ? {
          heroCard: 'Spolupráca ako začiatok',
          directionFrom: 'Bežne',
          directionTo: 'V JobShamane',
          modelLabel: 'Model kompatibility',
          problemEyebrow: 'Ako vyzerá posun',
          fitEyebrow: 'Kompatibilita',
          fitModel: 'Model',
          twoSidedEyebrow: 'Obojstranné rozhodnutie',
          predictionEyebrow: 'Výhľad spolupráce',
        }
      : normalizedLocale === 'de'
        ? {
            heroCard: 'Zusammenarbeit als Anfang',
            directionFrom: 'Üblich heute',
            directionTo: 'In JobShaman',
            modelLabel: 'Kompatibilitätsmodell',
            problemEyebrow: 'Wie der Wandel aussieht',
            fitEyebrow: 'Kompatibilität',
            fitModel: 'Modell',
            twoSidedEyebrow: 'Beidseitige Entscheidung',
            predictionEyebrow: 'Ausblick auf Zusammenarbeit',
          }
        : normalizedLocale === 'pl'
          ? {
              heroCard: 'Współpraca jako początek',
              directionFrom: 'Najczęściej dziś',
              directionTo: 'W JobShaman',
              modelLabel: 'Model kompatybilności',
              problemEyebrow: 'Jak wygląda ta zmiana',
              fitEyebrow: 'Kompatybilność',
              fitModel: 'Model',
              twoSidedEyebrow: 'Dwustronna decyzja',
              predictionEyebrow: 'Perspektywa współpracy',
            }
          : {
              heroCard: 'Collaboration as the start',
              directionFrom: 'Common today',
              directionTo: 'In JobShaman',
              modelLabel: 'Compatibility model',
              problemEyebrow: 'The shift in practice',
              fitEyebrow: 'Compatibility',
              fitModel: 'Model',
              twoSidedEyebrow: 'Two-sided decision',
              predictionEyebrow: 'Collaboration outlook',
            };

  return (
    <LegalPage
      title={copy.pageTitle}
      icon={Handshake}
      backLabel={copy.backLabel}
      backLink={backLink}
      widthClassName="max-w-7xl"
    >
      <div className="space-y-16 text-slate-700 dark:text-slate-200">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_48%,#fff7ed_100%)] p-8 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(8,47,73,0.9)_48%,rgba(67,20,7,0.86)_100%)] sm:p-10 lg:p-12">
          <div className="pointer-events-none absolute -right-12 top-8 h-40 w-40 rounded-full bg-cyan-200/50 blur-3xl dark:bg-cyan-500/20" />
          <div className="pointer-events-none absolute bottom-0 left-12 h-36 w-36 rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-500/10" />

          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.18fr)_360px] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.heroEyebrow}
              </div>
              <h2 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                {copy.heroTitle}
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                {copy.heroSubtitle}
              </p>
              <div className="mt-8 max-w-2xl rounded-[1.6rem] border border-white/70 bg-white/80 p-6 backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/70">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                  <Brain className="h-4 w-4" />
                  {ui.heroCard}
                </div>
                <p className="mt-3 text-base leading-8 text-slate-700 dark:text-slate-200">
                  {copy.heroQuote}
                </p>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/70 bg-white/82 p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/74">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {copy.directionTitle}
              </div>
              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-center gap-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                <div>{ui.directionFrom}</div>
                <div />
                <div className="text-right text-cyan-700 dark:text-cyan-300">{ui.directionTo}</div>
              </div>
              <div className="mt-5 space-y-3">
                {copy.directionRows.map((row) => (
                  <div key={`${row.from}-${row.to}`} className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-500 dark:text-slate-400">{row.from}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                    <span className="min-w-0 flex-1 text-right text-sm font-semibold text-slate-900 dark:text-white">{row.to}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[1.35rem] border border-cyan-200 bg-cyan-50/80 p-5 dark:border-cyan-500/30 dark:bg-cyan-950/20">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                  {ui.modelLabel}
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
                  {copy.fitFormula}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-cyan-100 dark:bg-slate-800">
                  <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-400" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Target className="h-4 w-4" />
              {ui.problemEyebrow}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {copy.problemTitle}
            </h3>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700 dark:text-slate-300">
              {copy.problemBody}
            </p>
          </article>

          <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {copy.oldFlowLabel}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {copy.oldFlow.map((step, index) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className={`${flowPillClass} border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300`}>
                        {step}
                      </span>
                      {index < copy.oldFlow.length - 1 ? <ArrowRight className="h-4 w-4 text-slate-400" /> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                  {copy.newFlowLabel}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {copy.newFlow.map((step, index) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className={`${flowPillClass} border-cyan-200 bg-cyan-50 text-slate-900 dark:border-cyan-500/30 dark:bg-cyan-950/20 dark:text-slate-100`}>
                        {step}
                      </span>
                      {index < copy.newFlow.length - 1 ? <ArrowRight className="h-4 w-4 text-cyan-500" /> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Activity className="h-4 w-4" />
              {copy.signalsEyebrow}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {copy.signalsTitle}
            </h3>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700 dark:text-slate-300">
              {copy.signalsIntro}
            </p>

            <div className="mt-8 space-y-5">
              {copy.signals.map((signal) => (
                <div key={signal.label} className="rounded-[1.3rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{signal.label}</div>
                    <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{signal.value}%</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-400" style={{ width: `${signal.value}%` }} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{signal.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {copy.signalsFooter}
            </p>
          </article>

          <article className="rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] p-8 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(8,47,73,0.8)_100%)]">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Gauge className="h-4 w-4" />
              {ui.fitEyebrow}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {copy.fitTitle}
            </h3>
            <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/75 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-950/70">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                {ui.fitModel}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
                {copy.fitFormula}
              </div>
              <p className="mt-4 text-base leading-8 text-slate-700 dark:text-slate-300">
                {copy.fitBody}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {copy.fitFactors.map((factor) => (
                <span key={factor} className="rounded-full border border-cyan-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 dark:border-cyan-500/30 dark:bg-slate-950/70 dark:text-slate-200">
                  {factor}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Users2 className="h-4 w-4" />
              {ui.twoSidedEyebrow}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {copy.twoSidedTitle}
            </h3>
            <p className="mt-4 text-base leading-8 text-slate-700 dark:text-slate-300">
              {copy.twoSidedBody}
            </p>
          </article>

          <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/80">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{copy.companySideTitle}</div>
                <div className="mt-4 space-y-3">
                  {copy.companySideItems.map((item) => (
                    <div key={item} className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                      → {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-cyan-200 bg-cyan-50/70 p-5 dark:border-cyan-500/30 dark:bg-cyan-950/20">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{copy.candidateSideTitle}</div>
                <div className="mt-4 space-y-3">
                  {copy.candidateSideItems.map((item) => (
                    <div key={item} className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                      → {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Brain className="h-4 w-4" />
              {ui.predictionEyebrow}
            </div>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {copy.predictionTitle}
            </h3>
            <p className="mt-4 text-base leading-8 text-slate-700 dark:text-slate-300">
              {copy.predictionBody}
            </p>
          </article>

          <article className="grid gap-4 sm:grid-cols-3">
            {copy.predictionQuestions.map((question, index) => (
              <div key={question} className="rounded-[1.6rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                  0{index + 1}
                </div>
                <p className="mt-4 text-base leading-8 text-slate-800 dark:text-slate-200">
                  {question}
                </p>
              </div>
            ))}
          </article>
        </section>

        <section className="rounded-[1.9rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <ArrowRight className="h-4 w-4" />
            {copy.shiftTitle}
          </div>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-center gap-4 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <div>{ui.directionFrom}</div>
            <div />
            <div className="text-right text-cyan-700 dark:text-cyan-300">{ui.directionTo}</div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {copy.shiftRows.map((row) => (
              <div key={`${row.from}-${row.to}`} className="flex items-center gap-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="flex-1 text-base font-medium text-slate-500 dark:text-slate-400">{row.from}</div>
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                <div className="flex-1 text-right text-base font-semibold text-slate-950 dark:text-white">{row.to}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Handshake className="h-4 w-4" />
              {copy.whatTitle}
            </div>
            <div className="mt-5 space-y-5">
              {copy.whatBody.map((paragraph) => (
                <p key={paragraph} className="max-w-3xl text-base leading-8 text-slate-700 dark:text-slate-300">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-cyan-200 bg-[linear-gradient(180deg,#ecfeff_0%,#ffffff_100%)] p-8 dark:border-cyan-500/30 dark:bg-[linear-gradient(180deg,rgba(8,47,73,0.45)_0%,rgba(15,23,42,0.9)_100%)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              JobShaman
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {copy.closingTitle}
            </div>
            <p className="mt-4 text-base leading-8 text-slate-700 dark:text-slate-300">
              {copy.closingBody}
            </p>
            <div className="mt-6 rounded-[1.35rem] border border-white/80 bg-white/80 p-5 dark:border-slate-700/70 dark:bg-slate-950/70">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                {copy.footerPunchline}
              </div>
            </div>
          </article>
        </section>

        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <Users2 className="h-4 w-4" />
            {copy.foundersTitle}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {copy.founders.map((founder) => (
              <article key={founder.name} className="rounded-[1.7rem] border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    {founder.initials}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{founder.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{founder.role}</p>
                  </div>
                </div>
                <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{founder.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </LegalPage>
  );
};

export default AboutUsPage;
