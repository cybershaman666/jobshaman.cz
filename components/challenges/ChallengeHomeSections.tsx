import React, { useMemo } from 'react';
import { ArrowRight, BrainCircuit, MessageSquareText, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Job } from '../../types';
import { cn } from '../ui/primitives';

interface ChallengeHomeSectionsProps {
  hasNativeChallenges: boolean;
  featuredChallenges: Job[];
  importedJobs: Job[];
  onOpenChallenge: (jobId: string) => void;
  onSearchFocus: () => void;
  onOpenAuth: () => void;
}

const ChallengeHomeSections: React.FC<ChallengeHomeSectionsProps> = ({
  onSearchFocus,
  onOpenAuth
}) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = ['cs', 'sk', 'de', 'at', 'pl'].includes(locale) ? locale : 'en';

  const copyMap = {
    cs: {
      badge: 'Odpovědi vedou k lidskému dialogu, ne k algoritmu.',
      title: 'Řeš skutečné pracovní výzvy.',
      body: 'Firmy nejdřív ukazují problém. Ty ukážeš, jak bys ho řešil(a).',
      primaryCta: 'Začít odpověď',
      secondaryCta: 'Přejít do hledání',
      promisePills: ['Firma otevře problém', 'Ty pošleš první přístup', 'Pak se otevře soukromý dialog'],
      heroDemoEyebrow: 'Ukázka první výzvy',
      heroDemoLead: 'Takto vypadá první kontakt místo slepého posílání životopisu.',
      heroTeamLabel: 'Výzva týmu',
      heroRiskLabel: 'Riziko',
      heroEditorLabel: 'Jak bys začal(a) problém řešit?',
      heroEditorPlaceholder: 'Můj první krok by byl…',
      heroEditorHint: 'Kliknutí otevře registraci a naváže na tuto první odpověď.',
      heroTimelineTitle: 'Jak začíná první kontakt',
      heroTimelineSteps: [
        'Firma otevře konkrétní problém v týmu.',
        'Ty pošleš první přístup, ne přílohu bez kontextu.',
        'Teprve potom vznikne soukromý dialog.'
      ],
      valueCards: [
        {
          title: 'První kontakt místo slepého CV',
          body: 'První krok není nahrání dokumentu, ale krátká odpověď na situaci, kterou tým skutečně řeší.'
        },
        {
          title: 'Omezený počet aktivních dialogů',
          body: 'Neotevíráš nekonečný počet vláken. Sloty drží tempo, pozornost a zvyšují šanci na skutečnou reakci od obou stran.'
        },
        {
          title: 'Filtry podle reálného života',
          body: 'Příhraničí, IČO, jazyky pro práci na dálku, dojíždění nebo kancelář vstřícná ke psům. Hledání se přizpůsobuje realitě.'
        }
      ],
      handshakeEyebrow: 'Jak funguje první kontakt',
      handshakeLaneCompany: 'Firma jde první',
      handshakeLaneResponse: 'Tvoje odpověď',
      handshakeLaneOpen: 'Dialog je otevřený',
      handshakeLaneOpenBody: 'Teprve teď vzniká soukromý prostor pro další otázky, životopis a další podklady.',
      previewChallengeLabel: 'Co bude potřeba zvládnout',
      previewRiskLabel: 'Na co si dát pozor',
      previewQuestionLabel: 'První otázka',
      previewReplyLabel: 'Tvoje první odpověď',
      previewCta: 'Otevřít detail výzvy',
      previewChallengeFallback: 'Tým potřebuje člověka, který zvládne převzít nejasnou situaci a rychle v ní udělat pořádek.',
      previewRiskFallback: 'Bez dobré koordinace se problém rozpadne do improvizace, zdržení a ztracené důvěry.',
      previewQuestionFallback: 'Jak bys během prvního týdne ověřil(a), kde je skutečné úzké místo, a co by byl tvůj první krok?',
      previewReplyFallback: 'Začal(a) bych rychlým rozdělením problému na dva až tři rozhodující body, ověřil(a) je s týmem a navrhl(a) první konkrétní zásah místo obecného slibu.',
      engineEyebrow: 'Potom přichází chytřejší hledání',
      engineTitle: 'Hledání, filtry a předvýběr na jednom místě.',
      enginePoints: [
        'Najdeš role podle toho, co budeš opravdu řešit, ne jen podle názvu pozice.',
        'Použiješ filtry podle životní reality a osobní nastavení z profilu.',
        'Systém zvýrazní nabídky, kde má smysl ozvat se jako první.'
      ],
      sampleTitle: 'Jak vypadá kvalitní výzva',
      sampleBody: 'Krátká ukázka toho, co bude potřeba zvládnout, na co si dát pozor a jak může vypadat první odpověď.',
      challenge: 'Co bude potřeba zvládnout',
      risk: 'Na co si dát pozor',
      response: 'První odpověď',
      responseHint: 'Právě tvoje první reakce otevírá dialog. Životopis a další materiály jsou až doplněk.',
      openChallenge: 'Otevřít detail',
      secondaryLaneTitle: 'Práce na dálku',
      secondaryLaneBody: 'Importované role pro práci na dálku z nových zdrojů zůstávají po ruce jako rychlý vedlejší pruh.',
      remoteLaneAction: 'Otevřít práci na dálku',
      remoteLaneEmpty: 'Jakmile se načtou role pro práci na dálku, objeví se tady jako rychlý vedlejší pruh.',
      supportNote: 'Životopis a další materiály jsou až podpůrná vrstva.',
      autoPreview: 'Automatická ukázka'
    },
    sk: {
      badge: 'Odpovede vedú k ľudskému dialógu, nie k algoritmu.',
      title: 'Rieš skutočné pracovné výzvy.',
      body: 'Firmy najprv ukazujú problém. Ty ukážeš, ako by si ho riešil(a).',
      primaryCta: 'Začať odpoveď',
      secondaryCta: 'Prejsť do hľadania',
      promisePills: ['Firma otvorí problém', 'Ty pošleš prvý prístup', 'Potom sa otvorí súkromný dialóg'],
      heroDemoEyebrow: 'Ukážka prvej výzvy',
      heroDemoLead: 'Takto vyzerá prvý kontakt namiesto slepého posielania životopisu.',
      heroTeamLabel: 'Výzva tímu',
      heroRiskLabel: 'Riziko',
      heroEditorLabel: 'Ako by si začal(a) riešiť problém?',
      heroEditorPlaceholder: 'Môj prvý krok by bol…',
      heroEditorHint: 'Kliknutie otvorí registráciu a nadviaže na túto prvú odpoveď.',
      heroTimelineTitle: 'Ako začína prvý kontakt',
      heroTimelineSteps: [
        'Firma otvorí konkrétny problém v tíme.',
        'Ty pošleš prvý prístup, nie prílohu bez kontextu.',
        'Až potom vznikne súkromný dialóg.'
      ],
      valueCards: [
        {
          title: 'Prvý kontakt namiesto slepého CV',
          body: 'Prvý krok nie je nahratie dokumentu, ale krátka odpoveď na situáciu, ktorú tím skutočne rieši.'
        },
        {
          title: 'Obmedzený počet aktívnych dialógov',
          body: 'Neotváraš nekonečný počet vlákien. Sloty držia tempo, pozornosť a zvyšujú šancu na skutočnú reakciu na oboch stranách.'
        },
        {
          title: 'Filtre podľa reálneho života',
          body: 'Pohraničie, živnosť, jazyky pre prácu na diaľku, dochádzanie alebo kancelária priateľská ku psom. Hľadanie sa prispôsobuje realite.'
        }
      ],
      handshakeEyebrow: 'Ako funguje prvý kontakt',
      handshakeLaneCompany: 'Firma ide prvá',
      handshakeLaneResponse: 'Tvoja odpoveď',
      handshakeLaneOpen: 'Dialóg je otvorený',
      handshakeLaneOpenBody: 'Až teraz vzniká súkromný priestor pre ďalšie otázky, životopis a ďalšie podklady.',
      previewChallengeLabel: 'Čo bude treba zvládnuť',
      previewRiskLabel: 'Na čo si dať pozor',
      previewQuestionLabel: 'Prvá otázka',
      previewReplyLabel: 'Tvoja prvá odpoveď',
      previewCta: 'Otvoriť detail výzvy',
      previewChallengeFallback: 'Tím potrebuje človeka, ktorý zvládne prevziať nejasnú situáciu a rýchlo v nej urobiť poriadok.',
      previewRiskFallback: 'Bez dobrej koordinácie sa problém rozpadne na improvizáciu, zdržanie a stratu dôvery.',
      previewQuestionFallback: 'Ako by si počas prvého týždňa overil(a), kde je skutočné úzke miesto, a čo by bol tvoj prvý krok?',
      previewReplyFallback: 'Začal(a) by som rýchlym rozdelením problému na dva až tri rozhodujúce body, overil(a) ich s tímom a navrhol(a) prvý konkrétny zásah namiesto všeobecného sľubu.',
      engineEyebrow: 'Potom prichádza múdrejšie hľadanie',
      engineTitle: 'Hľadanie, filtre a predvýber na jednom mieste.',
      enginePoints: [
        'Nájdeš roly podľa toho, čo budeš naozaj riešiť, nielen podľa názvu pozície.',
        'Použiješ filtre podľa životnej reality a osobné nastavenie z profilu.',
        'Systém zvýrazní ponuky, kde má zmysel ozvať sa ako prvý.'
      ],
      sampleTitle: 'Ako vyzerá kvalitná výzva',
      sampleBody: 'Krátka ukážka toho, čo bude treba zvládnuť, na čo si dať pozor a ako môže vyzerať prvá odpoveď.',
      challenge: 'Čo bude treba zvládnuť',
      risk: 'Na čo si dať pozor',
      response: 'Prvá odpoveď',
      responseHint: 'Práve tvoja prvá reakcia otvára dialóg. Životopis a ďalšie materiály sú až doplnok.',
      openChallenge: 'Otvoriť detail',
      secondaryLaneTitle: 'Práca na diaľku',
      secondaryLaneBody: 'Importované roly pre prácu na diaľku zostávajú poruke ako rýchly vedľajší pruh.',
      remoteLaneAction: 'Otvoriť prácu na diaľku',
      remoteLaneEmpty: 'Keď sa načítajú roly pre prácu na diaľku, objavia sa tu ako rýchly vedľajší pruh.',
      supportNote: 'Životopis a ďalšie materiály sú až podporná vrstva.',
      autoPreview: 'Automatická ukážka'
    },
    de: {
      badge: 'Antworten führen zu einem echten Gespräch, nicht zu einem Algorithmus.',
      title: 'Löse echte Aufgaben.',
      body: 'Unternehmen zeigen zuerst das Problem. Du zeigst, wie du es angehen würdest.',
      primaryCta: 'Antwort starten',
      secondaryCta: 'Zur Suche',
      promisePills: ['Das Unternehmen öffnet das Problem', 'Du sendest den ersten Ansatz', 'Dann öffnet sich der private Dialog'],
      heroDemoEyebrow: 'Vorschau der ersten Aufgabe',
      heroDemoLead: 'So sieht der erste Kontakt aus, statt blind Unterlagen zu schicken.',
      heroTeamLabel: 'Aufgabe des Teams',
      heroRiskLabel: 'Risiko',
      heroEditorLabel: 'Wie würdest du das Problem angehen?',
      heroEditorPlaceholder: 'Mein erster Schritt wäre…',
      heroEditorHint: 'Ein Klick öffnet die Registrierung und führt mit dieser ersten Antwort weiter.',
      heroTimelineTitle: 'So beginnt der erste Kontakt',
      heroTimelineSteps: [
        'Das Unternehmen zeigt ein konkretes Problem im Team.',
        'Du sendest deinen ersten Ansatz statt eines kontextlosen Anhangs.',
        'Erst danach beginnt der private Dialog.'
      ],
      valueCards: [
        { title: 'Erster Kontakt statt blindem CV-Versand', body: 'Der erste Schritt ist keine Datei, sondern eine kurze Antwort auf eine reale Teamsituation.' },
        { title: 'Begrenzte Zahl aktiver Dialoge', body: 'Du öffnest nicht endlos viele Threads. Slots schützen Tempo, Aufmerksamkeit und die Chance auf echte Reaktion auf beiden Seiten.' },
        { title: 'Filter nach Lebensrealität', body: 'Grenzregion, freier Vertrag, Sprachen für Remote-Arbeit, Pendeln oder hundefreundliches Büro. Die Suche passt sich dem Alltag an.' }
      ],
      handshakeEyebrow: 'So funktioniert der erste Kontakt',
      handshakeLaneCompany: 'Das Unternehmen beginnt',
      handshakeLaneResponse: 'Deine Antwort',
      handshakeLaneOpen: 'Gespräch geöffnet',
      handshakeLaneOpenBody: 'Erst jetzt entsteht ein geschützter Raum für Rückfragen, Lebenslauf und weitere Unterlagen.',
      previewChallengeLabel: 'Was zu lösen ist',
      previewRiskLabel: 'Worauf man achten sollte',
      previewQuestionLabel: 'Erste Frage',
      previewReplyLabel: 'Deine erste Antwort',
      previewCta: 'Detail öffnen',
      previewChallengeFallback: 'Das Team braucht jemanden, der eine unklare Situation übernimmt und schnell ordnet.',
      previewRiskFallback: 'Ohne gute Koordination drohen Improvisation, Verzögerungen und Vertrauensverlust.',
      previewQuestionFallback: 'Wie würdest du in der ersten Woche prüfen, wo das eigentliche Nadelöhr liegt, und was wäre dein erster Schritt?',
      previewReplyFallback: 'Ich würde die Lage zuerst auf zwei oder drei entscheidende Punkte herunterbrechen, sie mit dem Team prüfen und dann einen ersten konkreten Schritt vorschlagen.',
      engineEyebrow: 'Danach kommt die klügere Suche',
      engineTitle: 'Suche, Filter und Vorauswahl an einem Ort.',
      enginePoints: [
        'Du findest Rollen nach realen Aufgaben statt nur nach Stellentiteln.',
        'Du nutzt Filter nach Lebenssituation und persönliche Voreinstellungen.',
        'Das System hebt Stellen hervor, bei denen sich eine Antwort wirklich lohnt.'
      ],
      sampleTitle: 'So sieht eine gute Aufgabe aus',
      sampleBody: 'Eine kurze Vorschau darauf, was zu lösen ist, worauf man achten sollte und wie eine erste Antwort aussehen kann.',
      challenge: 'Was zu lösen ist',
      risk: 'Worauf man achten sollte',
      response: 'Erste Antwort',
      responseHint: 'Deine erste Reaktion öffnet das Gespräch. Lebenslauf und Unterlagen sind nur Ergänzung.',
      openChallenge: 'Detail öffnen',
      secondaryLaneTitle: 'Remote-Möglichkeiten',
      secondaryLaneBody: 'Importierte Remote-Rollen aus neuen Quellen bleiben als schneller Nebenkanal griffbereit.',
      remoteLaneAction: 'Remote-Suche öffnen',
      remoteLaneEmpty: 'Sobald Remote-Rollen geladen sind, erscheinen sie hier als schneller Nebenkanal.',
      supportNote: 'Lebenslauf und weitere Unterlagen sind erst die unterstützende Ebene.',
      autoPreview: 'Automatische Vorschau'
    },
    at: {} as any,
    pl: {
      badge: 'Odpowiedzi prowadzą do rozmowy z człowiekiem, a nie do algorytmu.',
      title: 'Rozwiązuj prawdziwe wyzwania w pracy.',
      body: 'Firmy najpierw pokazują problem. Ty pokazujesz, jak go rozwiążesz.',
      primaryCta: 'Zacznij odpowiedź',
      secondaryCta: 'Przejdź do wyszukiwania',
      promisePills: ['Firma otwiera problem', 'Ty wysyłasz pierwsze podejście', 'Potem otwiera się prywatna rozmowa'],
      heroDemoEyebrow: 'Podgląd pierwszego wyzwania',
      heroDemoLead: 'Tak wygląda pierwszy kontakt zamiast ślepego wysyłania CV.',
      heroTeamLabel: 'Wyzwanie zespołu',
      heroRiskLabel: 'Ryzyko',
      heroEditorLabel: 'Jak zaczął(a)byś rozwiązywać problem?',
      heroEditorPlaceholder: 'Mój pierwszy krok to…',
      heroEditorHint: 'Kliknięcie otworzy rejestrację i oprze dalszy krok na tej odpowiedzi.',
      heroTimelineTitle: 'Jak zaczyna się pierwszy kontakt',
      heroTimelineSteps: [
        'Firma pokazuje konkretny problem w zespole.',
        'Ty wysyłasz pierwsze podejście, a nie załącznik bez kontekstu.',
        'Dopiero potem otwiera się prywatna rozmowa.'
      ],
      valueCards: [
        { title: 'Pierwszy kontakt zamiast ślepego CV', body: 'Pierwszy krok to nie plik, ale krótka odpowiedź na realną sytuację w zespole.' },
        { title: 'Ograniczona liczba aktywnych rozmów', body: 'Nie otwierasz nieskończonej liczby wątków. Sloty pilnują tempa, uwagi i zwiększają szansę na realną odpowiedź po obu stronach.' },
        { title: 'Filtry dopasowane do życia', body: 'Pogranicze, działalność, języki do pracy zdalnej, dojazd albo biuro przyjazne psom. Wyszukiwanie dopasowuje się do realiów.' }
      ],
      handshakeEyebrow: 'Jak działa pierwszy kontakt',
      handshakeLaneCompany: 'Firma zaczyna',
      handshakeLaneResponse: 'Twoja odpowiedź',
      handshakeLaneOpen: 'Rozmowa otwarta',
      handshakeLaneOpenBody: 'Dopiero teraz otwiera się prywatna przestrzeń na dalsze pytania, CV i dodatkowe materiały.',
      previewChallengeLabel: 'Co trzeba ogarnąć',
      previewRiskLabel: 'Na co uważać',
      previewQuestionLabel: 'Pierwsze pytanie',
      previewReplyLabel: 'Twoja pierwsza odpowiedź',
      previewCta: 'Otwórz szczegóły',
      previewChallengeFallback: 'Zespół potrzebuje osoby, która przejmie niejasną sytuację i szybko ją uporządkuje.',
      previewRiskFallback: 'Bez dobrej koordynacji pojawi się improwizacja, opóźnienia i utrata zaufania.',
      previewQuestionFallback: 'Jak w pierwszym tygodniu sprawdził(a)byś, gdzie jest prawdziwe wąskie gardło, i jaki byłby twój pierwszy krok?',
      previewReplyFallback: 'Najpierw rozbił(a)bym sytuację na dwa lub trzy kluczowe punkty, sprawdził(a) je z zespołem i zaproponował(a) pierwszy konkretny ruch.',
      engineEyebrow: 'Potem wchodzi mądrzejsze wyszukiwanie',
      engineTitle: 'Wyszukiwanie, filtry i wstępny wybór w jednym miejscu.',
      enginePoints: [
        'Znajdziesz role po realnych zadaniach, a nie tylko po nazwie stanowiska.',
        'Użyjesz filtrów dopasowanych do życia i własnych ustawień z profilu.',
        'System podkreśli oferty, przy których naprawdę warto się odezwać.'
      ],
      sampleTitle: 'Jak wygląda dobra oferta z wyzwaniem',
      sampleBody: 'Krótki podgląd tego, co trzeba ogarnąć, na co uważać i jak może wyglądać pierwsza odpowiedź.',
      challenge: 'Co trzeba ogarnąć',
      risk: 'Na co uważać',
      response: 'Pierwsza odpowiedź',
      responseHint: 'To właśnie pierwsza reakcja otwiera rozmowę. CV i inne materiały są tylko dodatkiem.',
      openChallenge: 'Otwórz szczegóły',
      secondaryLaneTitle: 'Praca zdalna',
      secondaryLaneBody: 'Importowane role zdalne z nowych źródeł zostają pod ręką jako szybki boczny pas.',
      remoteLaneAction: 'Otwórz pracę zdalną',
      remoteLaneEmpty: 'Gdy załadują się role zdalne, pojawią się tutaj jako szybki boczny pas.',
      supportNote: 'CV i inne materiały są dopiero warstwą wspierającą.',
      autoPreview: 'Automatyczny podgląd'
    },
    en: {
      badge: 'Replies lead to human dialogue, not an algorithm.',
      title: 'Solve real work challenges.',
      body: 'Companies show the problem first. You show how you would solve it.',
      primaryCta: 'Start your reply',
      secondaryCta: 'Go to search',
      promisePills: ['The company opens the problem', 'You send your first approach', 'Then the private dialogue opens'],
      heroDemoEyebrow: 'Preview of the first challenge',
      heroDemoLead: 'This is what the first contact looks like instead of blindly sending a CV.',
      heroTeamLabel: 'Team challenge',
      heroRiskLabel: 'Risk',
      heroEditorLabel: 'How would you start solving the problem?',
      heroEditorPlaceholder: 'My first step would be…',
      heroEditorHint: 'Clicking continues into registration and keeps this first answer as the starting point.',
      heroTimelineTitle: 'How the first contact starts',
      heroTimelineSteps: [
        'The company opens a concrete team problem.',
        'You send your first approach instead of a contextless attachment.',
        'Only then does the private dialogue begin.'
      ],
      valueCards: [
        { title: 'First contact instead of blind CV drops', body: 'The first step is not a document upload but a short response to a real team situation.' },
        { title: 'A limited number of active dialogues', body: 'You do not open endless threads. Slots protect pace, attention, and the chance of a real reply on both sides.' },
        { title: 'Filters built around real life', body: 'Cross-border, contractor setup, remote languages, commute, or dog-friendly offices. Search adapts to reality.' }
      ],
      handshakeEyebrow: 'How the first contact works',
      handshakeLaneCompany: 'The company starts',
      handshakeLaneResponse: 'Your reply',
      handshakeLaneOpen: 'Dialogue opened',
      handshakeLaneOpenBody: 'Only now does the private conversation begin, with CVs and additional material as context.',
      previewChallengeLabel: 'What needs to be solved',
      previewRiskLabel: 'What to watch out for',
      previewQuestionLabel: 'First question',
      previewReplyLabel: 'Your first reply',
      previewCta: 'Open role detail',
      previewChallengeFallback: 'The team needs someone who can take an ambiguous situation and bring structure to it quickly.',
      previewRiskFallback: 'Without strong coordination, the problem turns into improvisation, delay, and lost trust.',
      previewQuestionFallback: 'How would you check the real bottleneck in the first week, and what would your first move be?',
      previewReplyFallback: 'I would break the situation into two or three decisive points, verify them with the team, and propose one concrete first move instead of a vague promise.',
      engineEyebrow: 'Then the smarter search layer takes over',
      engineTitle: 'Search, filters, and preselection in one place.',
      enginePoints: [
        'Find roles by the real work you would handle, not only by job title.',
        'Use life-context filters and personal defaults from your profile.',
        'The system highlights roles where reaching out is actually worth it.'
      ],
      sampleTitle: 'What a good role preview looks like',
      sampleBody: 'A compact preview of what needs to be solved, what to watch out for, and how a first reply can look.',
      challenge: 'What needs to be solved',
      risk: 'What to watch out for',
      response: 'First reply',
      responseHint: 'Your first reply opens the conversation. CVs and documents are only supporting context.',
      openChallenge: 'Open detail',
      secondaryLaneTitle: 'Remote opportunities',
      secondaryLaneBody: 'Imported remote roles from the new sources stay close as a quick secondary lane.',
      remoteLaneAction: 'Open remote search',
      remoteLaneEmpty: 'As soon as remote roles load, they will appear here as a quick secondary lane.',
      supportNote: 'CVs and other materials are only the supporting layer.',
      autoPreview: 'Auto preview'
    }
  } as const;

  const copy = copyMap[(language === 'at' ? 'de' : language) as keyof typeof copyMap];
  const demoCardsByLanguage = {
    cs: [
      {
        eyebrow: 'Ukázka první výzvy',
        company: 'Hotel Vltava Residence',
        title: 'Zástupce vedoucího recepce',
        challenge: 'Recepce a housekeeping si často předávají nepřesné informace o připravenosti pokojů.',
        risk: 'Hosté čekají déle na check-in, tým improvizuje a zbytečně roste napětí v provozu.',
        question: 'Jak bys během prvních dnů zjistil(a), kde se informace ztrácí, a jaký by byl tvůj první zásah?'
      },
      {
        eyebrow: 'Ukázka první výzvy',
        company: 'Beskyd Cargo',
        title: 'Koordinátor expedice',
        challenge: 'Sklad, doprava a zákaznická linka pracují s různými časy odjezdu a vznikají chybné sliby směrem ke klientům.',
        risk: 'Zákazníci dostávají nepřesné termíny, tým hasí reklamace a expedice ztrácí rytmus.',
        question: 'Čím bys začal(a), aby všichni pracovali se stejnou pravdou o odjezdech a zpožděních?'
      },
      {
        eyebrow: 'Ukázka první výzvy',
        company: 'Morava Medica',
        title: 'Specialista zákaznické podpory',
        challenge: 'Objednávky z ordinací chodí několika kanály najednou a tým pak řeší stejné požadavky duplicitně.',
        risk: 'Přibývá zmatků v prioritách, zákazníci čekají na potvrzení a interně roste únava.',
        question: 'Jak bys ověřil(a), kde vznikají duplicity, a jaký jednoduchý krok bys zavedl(a) hned na začátku?'
      }
    ],
    sk: [
      {
        eyebrow: 'Ukážka prvej výzvy',
        company: 'Hotel Vltava Residence',
        title: 'Zástupca vedúceho recepcie',
        challenge: 'Recepcia a housekeeping si často odovzdávajú nepresné informácie o pripravenosti izieb.',
        risk: 'Hostia čakajú dlhšie na check-in, tím improvizuje a v prevádzke rastie napätie.',
        question: 'Ako by si počas prvých dní zistil(a), kde sa informácie strácajú, a aký by bol tvoj prvý zásah?'
      },
      {
        eyebrow: 'Ukážka prvej výzvy',
        company: 'Beskyd Cargo',
        title: 'Koordinátor expedície',
        challenge: 'Sklad, doprava a zákaznícka linka pracujú s rôznymi časmi odchodu a vznikajú chybné sľuby smerom ku klientom.',
        risk: 'Zákazníci dostávajú nepresné termíny, tím hasí reklamácie a expedícia stráca rytmus.',
        question: 'Čím by si začal(a), aby všetci pracovali s rovnakou pravdou o odchodoch a meškaniach?'
      },
      {
        eyebrow: 'Ukážka prvej výzvy',
        company: 'Morava Medica',
        title: 'Špecialista zákazníckej podpory',
        challenge: 'Objednávky z ambulancií prichádzajú viacerými kanálmi naraz a tím potom rieši tie isté požiadavky duplicitne.',
        risk: 'Pribúda zmätok v prioritách, zákazníci čakajú na potvrdenie a interne rastie únava.',
        question: 'Ako by si overil(a), kde vznikajú duplicity, a aký jednoduchý krok by si zaviedol(a) hneď na začiatku?'
      }
    ],
    de: [
      {
        eyebrow: 'Vorschau der ersten Aufgabe',
        company: 'Nordbahn Pflegezentrum',
        title: 'Schichtkoordinator Pflegeaufnahme',
        challenge: 'Empfang und Station übergeben Informationen zu Neuaufnahmen uneinheitlich, wodurch wichtige Details verloren gehen.',
        risk: 'Patienten warten länger, das Team improvisiert und die Übergaben werden hektisch.',
        question: 'Wie würdest du in den ersten Tagen herausfinden, wo Informationen verloren gehen, und was wäre dein erster Schritt?'
      },
      {
        eyebrow: 'Vorschau der ersten Aufgabe',
        company: 'RheinWerk Logistik',
        title: 'Koordinator Warenausgang',
        challenge: 'Lager, Disposition und Kundenservice arbeiten mit unterschiedlichen Versandständen und geben deshalb widersprüchliche Zusagen heraus.',
        risk: 'Kunden erhalten falsche Termine, Reklamationen steigen und der operative Druck wächst.',
        question: 'Womit würdest du starten, damit alle mit demselben Stand zu Versand und Verzögerungen arbeiten?'
      },
      {
        eyebrow: 'Vorschau der ersten Aufgabe',
        company: 'ElbCampus Service',
        title: 'Teamleiter Kundenservice',
        challenge: 'Anfragen aus Telefon, Mail und Formularen landen in getrennten Listen und werden deshalb doppelt oder gar nicht bearbeitet.',
        risk: 'Die Antwortzeiten steigen, Prioritäten verschwimmen und das Team verliert Vertrauen in den Prozess.',
        question: 'Wie würdest du prüfen, wo die Doppelarbeit beginnt, und welche einfache Änderung würdest du zuerst einführen?'
      }
    ],
    pl: [
      {
        eyebrow: 'Podgląd pierwszego wyzwania',
        company: 'Baltic Stay Gdańsk',
        title: 'Koordynator recepcji',
        challenge: 'Recepcja i housekeeping często pracują na różnych informacjach o gotowości pokoi.',
        risk: 'Goście czekają dłużej na meldunek, zespół improwizuje, a w operacji rośnie chaos.',
        question: 'Jak w pierwszych dniach sprawdził(a)byś, gdzie giną informacje, i jaki byłby twój pierwszy ruch?'
      },
      {
        eyebrow: 'Podgląd pierwszego wyzwania',
        company: 'Mazovia Dispatch',
        title: 'Koordynator wysyłek',
        challenge: 'Magazyn, transport i obsługa klienta pracują na różnych godzinach wyjazdu i przekazują klientom sprzeczne terminy.',
        risk: 'Rośnie liczba reklamacji, zespół gasi pożary, a wysyłki tracą przewidywalność.',
        question: 'Od czego zaczął(a)byś, żeby wszyscy pracowali na tej samej informacji o wysyłkach i opóźnieniach?'
      },
      {
        eyebrow: 'Podgląd pierwszego wyzwania',
        company: 'Silesia Med Support',
        title: 'Specjalista obsługi placówek',
        challenge: 'Zamówienia i pytania z placówek wpadają kilkoma kanałami jednocześnie, więc zespół dubluje odpowiedzi.',
        risk: 'Priorytety się rozmywają, odpowiedzi trwają za długo, a frustracja rośnie po obu stronach.',
        question: 'Jak sprawdził(a)byś, gdzie zaczynają się duplikaty, i jaki prosty krok wdrożył(a)byś najpierw?'
      }
    ],
    en: [
      {
        eyebrow: 'Preview of the first challenge',
        company: 'Hotel Vltava Residence',
        title: 'Deputy Front Office Lead',
        challenge: 'Reception and housekeeping keep passing inconsistent information about which rooms are truly ready.',
        risk: 'Guests wait longer to check in, the team improvises, and pressure builds across the operation.',
        question: 'How would you find where the information breaks down in the first days, and what would be your first move?'
      },
      {
        eyebrow: 'Preview of the first challenge',
        company: 'RheinWerk Logistik',
        title: 'Outbound Coordination Lead',
        challenge: 'Warehouse, dispatch, and customer support work with different shipment statuses and promise different delivery times.',
        risk: 'Customers get conflicting expectations, complaints rise, and the team spends energy on firefighting.',
        question: 'Where would you look first to create one shared source of truth for departures and delays?'
      },
      {
        eyebrow: 'Preview of the first challenge',
        company: 'Silesia Med Support',
        title: 'Client Operations Specialist',
        challenge: 'Requests from clinics arrive through multiple channels at once, so the team keeps answering the same thing twice.',
        risk: 'Priorities blur, response times slip, and internal trust in the process drops quickly.',
        question: 'How would you verify where duplicate work begins, and what simple fix would you test first?'
      }
    ]
  } as const;

  const heroDemo = useMemo(() => {
    const variants = demoCardsByLanguage[(language === 'at' ? 'de' : language) as keyof typeof demoCardsByLanguage] || demoCardsByLanguage.en;
    return variants[Math.floor(Math.random() * variants.length)];
  }, [language]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(145deg,#f7fafc_0%,#ffffff_30%,#f8fbff_62%,#eef4fb_100%)] p-5 text-slate-900 shadow-[0_44px_110px_-74px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-[linear-gradient(155deg,#1c1620_0%,#111827_34%,#0f172a_70%,#10211d_100%)] dark:text-slate-100 sm:p-6">
        <div className="pointer-events-none absolute -left-20 top-[-4.5rem] h-56 w-56 rounded-[46%_54%_58%_42%/40%_44%_56%_60%] bg-sky-200/38 blur-3xl dark:bg-sky-500/12" />
        <div className="pointer-events-none absolute right-[-3.5rem] top-[-2rem] h-48 w-48 rounded-[58%_42%_36%_64%/46%_58%_42%_54%] bg-amber-200/30 blur-3xl dark:bg-amber-400/10" />
        <div className="pointer-events-none absolute bottom-[-4rem] left-[18%] h-44 w-56 rounded-[62%_38%_52%_48%/52%_40%_60%_48%] bg-indigo-100/60 blur-3xl dark:bg-indigo-300/8" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_88%_16%,rgba(226,232,240,0.64),transparent_22%),radial-gradient(circle_at_72%_84%,rgba(253,230,138,0.26),transparent_20%)] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.10),transparent_20%),radial-gradient(circle_at_84%_18%,rgba(251,191,36,0.10),transparent_18%),radial-gradient(circle_at_70%_78%,rgba(255,255,255,0.04),transparent_18%)]" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.16fr)_360px] xl:items-start 2xl:grid-cols-[minmax(0,1.08fr)_390px]">
          <div className="relative z-10 space-y-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300/90 bg-white/92 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-200">
              <Sparkles size={12} className="text-[var(--accent)]" />
              {copy.badge}
            </div>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl sm:leading-[1.02]">
                {copy.title}
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                {copy.body}
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-[0_22px_46px_-40px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(15,23,42,0.62))] sm:p-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/90 bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
                    {heroDemo.eyebrow}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {heroDemo.company} · {heroDemo.title}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {copy.heroDemoLead}
                </p>
                <div className="rounded-[1.35rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.9))] p-4 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.72))]">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{copy.heroTeamLabel}</div>
                  <div className="mt-2 text-lg font-semibold leading-7 tracking-[-0.03em] text-slate-950 dark:text-white">
                    {heroDemo.challenge}
                  </div>
                  <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{copy.heroRiskLabel}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {heroDemo.risk}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-[1.35rem] border border-slate-900/88 bg-[linear-gradient(160deg,#172033_0%,#0f172a_100%)] p-4 text-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.58)] dark:border-amber-400/16 dark:bg-[linear-gradient(160deg,#101826_0%,#0b1220_100%)]">
                <div className="text-[11px] uppercase tracking-[0.18em] text-amber-300">{copy.heroEditorLabel}</div>
                <div className="mt-3 rounded-[1rem] border border-white/10 bg-white/5 p-3">
                  <div className="text-sm leading-6 text-slate-100">{heroDemo.question}</div>
                </div>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="mt-3 block w-full rounded-[1rem] border border-amber-300/90 bg-white px-4 py-3 text-left text-sm text-slate-500 transition hover:border-amber-400 hover:bg-amber-50 dark:border-amber-300/40 dark:bg-white dark:text-slate-700 dark:hover:bg-amber-50"
                >
                  {copy.heroEditorPlaceholder}
                </button>
                <div className="mt-3 text-xs leading-5 text-slate-300">
                  {copy.heroEditorHint}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                {copy.primaryCta}
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={onSearchFocus}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-amber-300/40 dark:hover:bg-white/10"
              >
                <Search size={16} />
                {copy.secondaryCta}
              </button>
            </div>
          </div>

          <div className="relative z-10 w-full rounded-[1.6rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,245,249,0.92))] p-4 shadow-[0_30px_70px_-46px_rgba(15,23,42,0.34)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.82),rgba(2,6,23,0.74))]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              {copy.heroTimelineTitle}
            </div>
            <div className="mt-4 space-y-3">
              {[copy.handshakeLaneCompany, copy.handshakeLaneResponse, copy.handshakeLaneOpen].map((label, index) => (
                <div key={label} className="relative rounded-[1.25rem] border border-slate-200/90 bg-white/88 p-4 dark:border-slate-800 dark:bg-slate-900/72">
                  {index < 2 ? (
                    <div className="pointer-events-none absolute left-7 top-full h-5 w-px bg-[rgba(var(--accent-rgb),0.24)]" />
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      index === 0 && 'bg-amber-500 text-slate-950',
                      index === 1 && 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
                      index === 2 && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100'
                    )}>
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-950 dark:text-white">{label}</div>
                      <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {copy.heroTimelineSteps[index]}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-300/90 bg-slate-50/92 p-4 text-sm leading-6 text-slate-600 dark:border-amber-400/20 dark:bg-slate-950/50 dark:text-slate-300">
              {copy.supportNote}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {copy.valueCards.map((card: { title: string; body: string }, index: number) => {
          const Icon = index === 0 ? MessageSquareText : index === 1 ? SlidersHorizontal : BrainCircuit;
          return (
            <article
              key={card.title}
              className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[#111827] dark:text-slate-100"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                <Icon size={20} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.body}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[#111827] dark:text-slate-100">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              <BrainCircuit size={12} />
              {copy.engineEyebrow}
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
              {copy.engineTitle}
            </div>
          </div>
          <div className="space-y-3">
            {copy.enginePoints.map((point: string, index: number) => (
              <div key={point} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">
                  {index + 1}
                </div>
                <div className="text-sm leading-6 text-slate-700 dark:text-slate-200">{point}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default ChallengeHomeSections;
