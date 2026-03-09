import React, { useEffect, useState } from 'react';
import { BrainCircuit, MessageSquareText, Search, SlidersHorizontal } from 'lucide-react';
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
  onOpenAuth
}) => {
  const { i18n } = useTranslation();
  const [activeHeroMoment, setActiveHeroMoment] = useState(0);
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = ['cs', 'sk', 'de', 'at', 'pl'].includes(locale) ? locale : 'en';

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroMoment((current) => (current + 1) % 3);
    }, 5600);

    return () => window.clearInterval(intervalId);
  }, []);

  const copyMap = {
    cs: {
      badge: 'Odpovědi vedou k lidskému dialogu, ne k algoritmu.',
      title: 'Nejdřív výzva. Pak dialog.',
      body: 'Firmy ukazují skutečný problém. Ty ukážeš svůj přístup.',
      heroCompareLeftTitle: 'Poslat CV',
      heroCompareRightTitle: 'Ukázat přístup',
      heroCompareLeftMode: 'Starý model',
      heroCompareRightMode: 'Nový model',
      heroDemoCaption: 'Jak vypadá první kontakt',
      heroLegacyLabel: 'Pracovní portál',
      heroLegacyBrand: 'Profesní feed',
      heroLegacyListTitle: 'Seznam pozic',
      heroLegacySearch: 'Hledat pozice',
      heroLegacyChipOne: 'na dálku',
      heroLegacyChipTwo: 'hybrid',
      heroLegacyChipThree: 'rychlá reakce',
      heroLegacyRole: 'Produktový manažer',
      heroLegacyCompany: 'Talvex Cargo',
      heroLegacyMeta: 'Brno • Hybrid • Plný úvazek',
      heroLegacyRoleAlt: 'Specialista provozu',
      heroLegacyMetaAlt: 'Ostrava • Na místě • Směny',
      heroLegacyApply: 'Přihlásit se',
      heroLegacyButton: 'Poslat CV',
      heroLegacyQueue: '100+ uchazečů',
      heroLegacyDelay: 'Bez odpovědi 12 dní',
      heroLegacyBatch: 'Ve frontě s dalšími CV',
      heroLegacyApplicantsPrimary: 'Odpovědělo 143 uchazečů',
      heroLegacyApplicantsSecondary: 'Odpovědělo 97 uchazečů',
      heroHandshakeLabel: 'JobShaman',
      primaryCta: 'Začít odpověď',
      secondaryCta: 'Přejít do hledání',
      promisePills: ['Firma otevře problém', 'Pošlete první přístup', 'Pak se otevře soukromý dialog'],
      heroDemoEyebrow: 'Ukázka první výzvy',
      heroDemoLead: 'Takto vypadá první kontakt místo slepého posílání životopisu.',
      heroTeamLabel: 'Výzva týmu',
      heroRiskLabel: 'Riziko',
      heroEditorLabel: 'Jak byste začal(a) problém řešit?',
      heroEditorPlaceholder: 'Můj první krok by byl…',
      heroEditorHint: 'Kliknutí otevře registraci.',
      heroEditorAction: 'Klikněte sem a začněte psát',
      heroEditorDraft: 'Nejdřív bych sjednotil odjezdy do jedné pravdy a ověřil, kde se data rozcházejí.',
      heroEditorContinue: 'pokračovat do registrace',
      heroLiveCandidateLabel: 'Tvůj první krok',
      heroLiveCompanyLabel: 'Firma odpověděla',
      heroLiveCompanyBody: 'Dobrý den, váš způsob řešení nás zaujal. Pojďme si o tom říct víc.',
      heroLiveCompanyEta: 'reakce do 2 pracovních dnů',
      heroLiveSlotsLabel: 'Premium sloty',
      heroLiveSlotsValue: '22 / 25 zbývá',
      heroLiveSlotsNote: 'Omezené sloty drží dialog živý.',
      heroDialogOpenBody: 'Soukromý dialog je otevřený. Teď má smysl pokračovat.',
      heroDialogOpenCta: 'Otevřít dialog',
      heroWhyTitle: 'Proč se ti tato výzva ukazuje?',
      heroWhySignals: ['25 km od tebe', 'IČO možné', 'Čeština nebo angličtina', 'JHI 82'],
      heroTimelineTitle: 'Jak začíná první kontakt',
      heroTimelineSteps: [
        'Firma otevře výzvu.',
        'Ty pošleš první přístup.',
        'Otevře se soukromý dialog.'
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
      previewQuestionFallback: 'Jak byste během prvního týdne ověřil(a), kde je skutečné úzké místo, a co by byl váš první krok?',
      previewReplyFallback: 'Začal(a) bych rychlým rozdělením problému na dva až tři rozhodující body, ověřil(a) je s týmem a navrhl(a) první konkrétní zásah místo obecného slibu.',
      engineEyebrow: 'Potom přichází chytřejší hledání',
      engineTitle: 'Hledání, filtry a předvýběr na jednom místě.',
      enginePoints: [
        'Najdete role podle toho, co budete opravdu řešit, ne jen podle názvu pozice.',
        'Použijete filtry podle životní reality a osobní nastavení z profilu.',
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
      title: 'Najprv výzva. Potom dialóg.',
      body: 'Firmy ukazujú skutočný problém. Ty ukážeš svoj prístup.',
      heroCompareLeftTitle: 'Poslať CV',
      heroCompareRightTitle: 'Ukázať prístup',
      heroCompareLeftMode: 'Starý model',
      heroCompareRightMode: 'Nový model',
      heroDemoCaption: 'Ako vyzerá prvý kontakt',
      heroLegacyLabel: 'Pracovný portál',
      heroLegacyBrand: 'Pracovný feed',
      heroLegacyListTitle: 'Zoznam pozícií',
      heroLegacySearch: 'Hľadať pozície',
      heroLegacyChipOne: 'na diaľku',
      heroLegacyChipTwo: 'hybrid',
      heroLegacyChipThree: 'rýchla reakcia',
      heroLegacyRole: 'Produktový manažér',
      heroLegacyCompany: 'Talvex Cargo',
      heroLegacyMeta: 'Brno • Hybrid • Plný úväzok',
      heroLegacyRoleAlt: 'Špecialista prevádzky',
      heroLegacyMetaAlt: 'Ostrava • Na mieste • Zmeny',
      heroLegacyApply: 'Prihlásiť sa',
      heroLegacyButton: 'Poslať CV',
      heroLegacyQueue: '100+ uchádzačov',
      heroLegacyDelay: 'Bez odpovede 12 dní',
      heroLegacyBatch: 'Vo fronte s ďalšími CV',
      heroLegacyApplicantsPrimary: 'Odpovedalo 143 uchádzačov',
      heroLegacyApplicantsSecondary: 'Odpovedalo 97 uchádzačov',
      heroHandshakeLabel: 'JobShaman',
      primaryCta: 'Začať odpoveď',
      secondaryCta: 'Prejsť do hľadania',
      promisePills: ['Firma otvorí problém', 'Pošlete prvý prístup', 'Potom sa otvorí súkromný dialóg'],
      heroDemoEyebrow: 'Ukážka prvej výzvy',
      heroDemoLead: 'Takto vyzerá prvý kontakt namiesto slepého posielania životopisu.',
      heroTeamLabel: 'Výzva tímu',
      heroRiskLabel: 'Riziko',
      heroEditorLabel: 'Ako by ste začal(a) riešiť problém?',
      heroEditorPlaceholder: 'Môj prvý krok by bol…',
      heroEditorHint: 'Kliknutie otvorí registráciu.',
      heroEditorAction: 'Kliknite sem a začnite písať',
      heroEditorDraft: 'Najprv by som zjednotil odchody do jednej pravdy a overil, kde sa dáta rozchádzajú.',
      heroEditorContinue: 'pokračovať do registrácie',
      heroLiveCandidateLabel: 'Tvoj prvý krok',
      heroLiveCompanyLabel: 'Firma odpovedala',
      heroLiveCompanyBody: 'Dobrý deň, váš spôsob riešenia nás zaujal. Poďme si o tom povedať viac.',
      heroLiveCompanyEta: 'reakcia do 2 pracovných dní',
      heroLiveSlotsLabel: 'Premium sloty',
      heroLiveSlotsValue: '22 / 25 zostáva',
      heroLiveSlotsNote: 'Obmedzené sloty držia dialóg živý.',
      heroDialogOpenBody: 'Súkromný dialóg je otvorený. Teraz má zmysel pokračovať.',
      heroDialogOpenCta: 'Otvoriť dialóg',
      heroWhyTitle: 'Prečo sa ti táto výzva ukazuje?',
      heroWhySignals: ['25 km od teba', 'Živnosť možná', 'Slovenčina alebo angličtina', 'JHI 82'],
      heroTimelineTitle: 'Ako začína prvý kontakt',
      heroTimelineSteps: [
        'Firma otvorí výzvu.',
        'Ty pošleš prvý prístup.',
        'Otvorí sa súkromný dialóg.'
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
      previewQuestionFallback: 'Ako by ste počas prvého týždňa overil(a), kde je skutočné úzke miesto, a čo by bol váš prvý krok?',
      previewReplyFallback: 'Začal(a) by som rýchlym rozdelením problému na dva až tri rozhodujúce body, overil(a) ich s tímom a navrhol(a) prvý konkrétny zásah namiesto všeobecného sľubu.',
      engineEyebrow: 'Potom prichádza múdrejšie hľadanie',
      engineTitle: 'Hľadanie, filtre a predvýber na jednom mieste.',
      enginePoints: [
        'Nájdete roly podľa toho, čo budete naozaj riešiť, nielen podľa názvu pozície.',
        'Použijete filtre podľa životnej reality a osobné nastavenie z profilu.',
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
      title: 'Erst die Aufgabe. Dann das Gespräch.',
      body: 'Unternehmen zeigen das echte Problem. Du zeigst deinen Ansatz.',
      heroCompareLeftTitle: 'CV senden',
      heroCompareRightTitle: 'Ansatz zeigen',
      heroCompareLeftMode: 'Altes Modell',
      heroCompareRightMode: 'Neues Modell',
      heroDemoCaption: 'So sieht der erste Kontakt aus',
      heroLegacyLabel: 'Jobbörse',
      heroLegacyBrand: 'Karriere-Feed',
      heroLegacyListTitle: 'Stellenliste',
      heroLegacySearch: 'Jobs suchen',
      heroLegacyChipOne: 'remote',
      heroLegacyChipTwo: 'hybrid',
      heroLegacyChipThree: 'Sofortbewerbung',
      heroLegacyRole: 'Produktmanager',
      heroLegacyCompany: 'Talvex Cargo',
      heroLegacyMeta: 'Brno • Hybrid • Vollzeit',
      heroLegacyRoleAlt: 'Operations-Spezialist',
      heroLegacyMetaAlt: 'Ostrava • Vor Ort • Schichten',
      heroLegacyApply: 'Jetzt bewerben',
      heroLegacyButton: 'CV senden',
      heroLegacyQueue: '100+ Bewerber',
      heroLegacyDelay: '12 Tage ohne Antwort',
      heroLegacyBatch: 'In der Warteschlange mit weiteren CVs',
      heroLegacyApplicantsPrimary: '143 Bewerber haben reagiert',
      heroLegacyApplicantsSecondary: '97 Bewerber haben reagiert',
      heroHandshakeLabel: 'JobShaman',
      primaryCta: 'Antwort starten',
      secondaryCta: 'Zur Suche',
      promisePills: ['Das Unternehmen öffnet das Problem', 'Du sendest den ersten Ansatz', 'Dann öffnet sich der private Dialog'],
      heroDemoEyebrow: 'Vorschau der ersten Aufgabe',
      heroDemoLead: 'So sieht der erste Kontakt aus, statt blind Unterlagen zu schicken.',
      heroTeamLabel: 'Aufgabe des Teams',
      heroRiskLabel: 'Risiko',
      heroEditorLabel: 'Wie würdest du das Problem angehen?',
      heroEditorPlaceholder: 'Mein erster Schritt wäre…',
      heroEditorHint: 'Klick öffnet die Registrierung.',
      heroEditorAction: 'Hier klicken und losschreiben',
      heroEditorDraft: 'Ich würde zuerst eine gemeinsame Quelle für Abfahrten schaffen und prüfen, wo die Daten auseinanderlaufen.',
      heroEditorContinue: 'weiter zur Registrierung',
      heroLiveCandidateLabel: 'Dein erster Schritt',
      heroLiveCompanyLabel: 'Firma hat geantwortet',
      heroLiveCompanyBody: 'Guten Tag, Ihr Lösungsansatz hat uns angesprochen. Lassen Sie uns dazu mehr besprechen.',
      heroLiveCompanyEta: 'Antwort in 2 Werktagen',
      heroLiveSlotsLabel: 'Premium-Slots',
      heroLiveSlotsValue: '22 / 25 frei',
      heroLiveSlotsNote: 'Begrenzte Slots halten den Dialog aktiv.',
      heroDialogOpenBody: 'Der private Dialog ist offen. Jetzt lohnt sich der nächste Schritt.',
      heroDialogOpenCta: 'Dialog öffnen',
      heroWhyTitle: 'Warum wird dir diese Aufgabe gezeigt?',
      heroWhySignals: ['25 km entfernt', 'Freier Vertrag möglich', 'Deutsch oder Englisch', 'JHI 82'],
      heroTimelineTitle: 'So beginnt der erste Kontakt',
      heroTimelineSteps: [
        'Das Unternehmen öffnet die Aufgabe.',
        'Du sendest deinen ersten Ansatz.',
        'Der private Dialog öffnet sich.'
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
      title: 'Najpierw wyzwanie. Potem rozmowa.',
      body: 'Firmy pokazują prawdziwy problem. Ty pokazujesz swoje podejście.',
      heroCompareLeftTitle: 'Wyślij CV',
      heroCompareRightTitle: 'Pokaż podejście',
      heroCompareLeftMode: 'Stary model',
      heroCompareRightMode: 'Nowy model',
      heroDemoCaption: 'Tak wygląda pierwszy kontakt',
      heroLegacyLabel: 'Portal pracy',
      heroLegacyBrand: 'Feed zawodowy',
      heroLegacyListTitle: 'Lista ofert',
      heroLegacySearch: 'Szukaj ofert',
      heroLegacyChipOne: 'zdalnie',
      heroLegacyChipTwo: 'hybrydowo',
      heroLegacyChipThree: 'szybka aplikacja',
      heroLegacyRole: 'Menedżer produktu',
      heroLegacyCompany: 'Talvex Cargo',
      heroLegacyMeta: 'Brno • Hybrydowo • Pełny etat',
      heroLegacyRoleAlt: 'Specjalista operacyjny',
      heroLegacyMetaAlt: 'Ostrawa • Na miejscu • Zmiany',
      heroLegacyApply: 'Aplikuj teraz',
      heroLegacyButton: 'Wyślij CV',
      heroLegacyQueue: '100+ kandydatów',
      heroLegacyDelay: '12 dni bez odpowiedzi',
      heroLegacyBatch: 'W kolejce z innymi CV',
      heroLegacyApplicantsPrimary: 'Odpowiedziało 143 kandydatów',
      heroLegacyApplicantsSecondary: 'Odpowiedziało 97 kandydatów',
      heroHandshakeLabel: 'JobShaman',
      primaryCta: 'Zacznij odpowiedź',
      secondaryCta: 'Przejdź do wyszukiwania',
      promisePills: ['Firma otwiera problem', 'Ty wysyłasz pierwsze podejście', 'Potem otwiera się prywatna rozmowa'],
      heroDemoEyebrow: 'Podgląd pierwszego wyzwania',
      heroDemoLead: 'Tak wygląda pierwszy kontakt zamiast ślepego wysyłania CV.',
      heroTeamLabel: 'Wyzwanie zespołu',
      heroRiskLabel: 'Ryzyko',
      heroEditorLabel: 'Jak zaczął(a)byś rozwiązywać problem?',
      heroEditorPlaceholder: 'Mój pierwszy krok to…',
      heroEditorHint: 'Kliknięcie otworzy rejestrację.',
      heroEditorAction: 'Kliknij tutaj i zacznij pisać',
      heroEditorDraft: 'Najpierw ustawił(a)bym jedno źródło prawdy dla wyjazdów i sprawdził(a), gdzie dane się rozjeżdżają.',
      heroEditorContinue: 'przejdź do rejestracji',
      heroLiveCandidateLabel: 'Twój pierwszy krok',
      heroLiveCompanyLabel: 'Firma odpowiedziała',
      heroLiveCompanyBody: 'Dzień dobry, sposób rozwiązania zwrócił naszą uwagę. Porozmawiajmy o tym szerzej.',
      heroLiveCompanyEta: 'odpowiedź do 2 dni roboczych',
      heroLiveSlotsLabel: 'Sloty premium',
      heroLiveSlotsValue: '22 / 25 wolnych',
      heroLiveSlotsNote: 'Ograniczone sloty utrzymują żywy dialog.',
      heroDialogOpenBody: 'Prywatna rozmowa jest otwarta. Teraz warto przejść dalej.',
      heroDialogOpenCta: 'Otwórz rozmowę',
      heroWhyTitle: 'Dlaczego widzisz to wyzwanie?',
      heroWhySignals: ['25 km od Ciebie', 'B2B możliwe', 'Polski lub angielski', 'JHI 82'],
      heroTimelineTitle: 'Jak zaczyna się pierwszy kontakt',
      heroTimelineSteps: [
        'Firma otwiera wyzwanie.',
        'Ty wysyłasz pierwsze podejście.',
        'Otwiera się prywatna rozmowa.'
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
      title: 'Challenge first. Dialogue second.',
      body: 'Companies show the real problem. You show your approach.',
      heroCompareLeftTitle: 'Send CV',
      heroCompareRightTitle: 'Show your approach',
      heroCompareLeftMode: 'Old model',
      heroCompareRightMode: 'New model',
      heroDemoCaption: 'What the first contact looks like',
      heroLegacyLabel: 'Job board',
      heroLegacyBrand: 'Professional feed',
      heroLegacyListTitle: 'Job list',
      heroLegacySearch: 'Search roles',
      heroLegacyChipOne: 'remote',
      heroLegacyChipTwo: 'hybrid',
      heroLegacyChipThree: 'easy apply',
      heroLegacyRole: 'Product Manager',
      heroLegacyCompany: 'Talvex Cargo',
      heroLegacyMeta: 'Brno • Hybrid • Full-time',
      heroLegacyRoleAlt: 'Operations Specialist',
      heroLegacyMetaAlt: 'Ostrava • On-site • Shifts',
      heroLegacyApply: 'Apply now',
      heroLegacyButton: 'Send CV',
      heroLegacyQueue: '100+ applicants',
      heroLegacyDelay: 'No reply for 12 days',
      heroLegacyBatch: 'Queued with other CVs',
      heroLegacyApplicantsPrimary: '143 applicants responded',
      heroLegacyApplicantsSecondary: '97 applicants responded',
      heroHandshakeLabel: 'JobShaman',
      primaryCta: 'Start your reply',
      secondaryCta: 'Go to search',
      promisePills: ['The company opens the problem', 'You send your first approach', 'Then the private dialogue opens'],
      heroDemoEyebrow: 'Preview of the first challenge',
      heroDemoLead: 'This is what the first contact looks like instead of blindly sending a CV.',
      heroTeamLabel: 'Team challenge',
      heroRiskLabel: 'Risk',
      heroEditorLabel: 'How would you start solving the problem?',
      heroEditorPlaceholder: 'My first step would be…',
      heroEditorHint: 'Click opens registration.',
      heroEditorAction: 'Click here and start typing',
      heroEditorDraft: 'I would first create one source of truth for departures and verify where the data starts diverging.',
      heroEditorContinue: 'continue to registration',
      heroLiveCandidateLabel: 'Your first step',
      heroLiveCompanyLabel: 'Company replied',
      heroLiveCompanyBody: 'Hello, your way of solving this caught our attention. Let us talk about it in more detail.',
      heroLiveCompanyEta: 'reply within 2 business days',
      heroLiveSlotsLabel: 'Premium slots',
      heroLiveSlotsValue: '22 / 25 left',
      heroLiveSlotsNote: 'Limited slots keep the dialogue active.',
      heroDialogOpenBody: 'The private dialogue is open. Now it makes sense to continue.',
      heroDialogOpenCta: 'Open dialogue',
      heroWhyTitle: 'Why are you seeing this challenge?',
      heroWhySignals: ['Within 25 km', 'Contractor setup possible', 'English-friendly', 'JHI 82'],
      heroTimelineTitle: 'How the first contact starts',
      heroTimelineSteps: [
        'The company opens the challenge.',
        'You send your first approach.',
        'The private dialogue opens.'
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
  const heroDemoByLanguage = {
    cs: {
      eyebrow: 'VÝZVA TÝMU',
      company: 'Talvex Cargo',
      title: 'Koordinátor expedice',
      challenge: 'Sklad, doprava a zákaznická linka pracují s různými časy odjezdu.',
      risk: 'Zákazníci dostávají nepřesné termíny a tým řeší zbytečné reklamace.',
      question: 'Čím byste začal(a), aby všichni pracovali se stejnou pravdou o odjezdech a zpožděních?'
    },
    sk: {
      eyebrow: 'VÝZVA TÍMU',
      company: 'Talvex Cargo',
      title: 'Koordinátor expedície',
      challenge: 'Sklad, doprava a zákaznícka linka pracujú s rôznymi časmi odchodu.',
      risk: 'Zákazníci dostávajú nepresné termíny a tím rieši zbytočné reklamácie.',
      question: 'Čím by ste začal(a), aby všetci pracovali s rovnakou pravdou o odchodoch a meškaniach?'
    },
    de: {
      eyebrow: 'TEAM-AUFGABE',
      company: 'Talvex Cargo',
      title: 'Koordinator Warenausgang',
      challenge: 'Lager, Disposition und Kundenservice arbeiten mit unterschiedlichen Abfahrtszeiten.',
      risk: 'Kunden erhalten ungenaue Termine und das Team verliert Zeit mit unnötigen Reklamationen.',
      question: 'Womit würdest du beginnen, damit alle mit demselben Stand zu Abfahrten und Verzögerungen arbeiten?'
    },
    pl: {
      eyebrow: 'WYZWANIE ZESPOŁU',
      company: 'Talvex Cargo',
      title: 'Koordynator wysyłek',
      challenge: 'Magazyn, transport i obsługa klienta pracują na różnych godzinach wyjazdu.',
      risk: 'Klienci dostają niedokładne terminy, a zespół traci czas na zbędne reklamacje.',
      question: 'Od czego zaczął(a)byś, żeby wszyscy pracowali na tej samej informacji o wysyłkach i opóźnieniach?'
    },
    en: {
      eyebrow: 'TEAM CHALLENGE',
      company: 'Talvex Cargo',
      title: 'Outbound Coordination Lead',
      challenge: 'Warehouse, dispatch, and customer support work from different departure times.',
      risk: 'Customers get inaccurate delivery dates and the team spends time on avoidable complaints.',
      question: 'Where would you start so everyone works from the same source of truth on departures and delays?'
    }
  } as const;

  const heroDemo = heroDemoByLanguage[(language === 'at' ? 'de' : language) as keyof typeof heroDemoByLanguage] || heroDemoByLanguage.en;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(145deg,#f7fafc_0%,#ffffff_30%,#f8fbff_62%,#eef4fb_100%)] p-3 text-slate-900 shadow-[0_44px_110px_-74px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-[linear-gradient(155deg,#1c1620_0%,#111827_34%,#0f172a_70%,#10211d_100%)] dark:text-slate-100 sm:p-4">
        <div className="pointer-events-none absolute -left-20 top-[-4.5rem] h-56 w-56 rounded-[46%_54%_58%_42%/40%_44%_56%_60%] bg-sky-200/38 blur-3xl dark:bg-sky-500/12" />
        <div className="pointer-events-none absolute right-[-3.5rem] top-[-2rem] h-48 w-48 rounded-[58%_42%_36%_64%/46%_58%_42%_54%] bg-amber-200/30 blur-3xl dark:bg-amber-400/10" />
        <div className="pointer-events-none absolute bottom-[-4rem] left-[18%] h-44 w-56 rounded-[62%_38%_52%_48%/52%_40%_60%_48%] bg-indigo-100/60 blur-3xl dark:bg-indigo-300/8" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_88%_16%,rgba(226,232,240,0.64),transparent_22%),radial-gradient(circle_at_72%_84%,rgba(253,230,138,0.26),transparent_20%)] dark:bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.10),transparent_20%),radial-gradient(circle_at_84%_18%,rgba(251,191,36,0.10),transparent_18%),radial-gradient(circle_at_70%_78%,rgba(255,255,255,0.04),transparent_18%)]" />
        <div className="relative z-10 space-y-4">
          <div className="grid items-center gap-3 text-center xl:grid-cols-[minmax(240px,0.66fr)_24px_minmax(0,1.34fr)] xl:text-left">
            <div className="justify-self-center rounded-full border border-slate-300/90 bg-slate-100/92 px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-300 xl:justify-self-start">
              <span className="mr-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">{copy.heroCompareLeftMode}</span>
              {copy.heroCompareLeftTitle}
            </div>
            <div className="justify-self-center rounded-full border border-slate-300/90 bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white dark:border-white/10 dark:bg-white dark:text-slate-950">
              vs
            </div>
            <div className="justify-self-center rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)] shadow-[0_14px_28px_-24px_rgba(var(--accent-rgb),0.18)] dark:border-[rgba(var(--accent-rgb),0.18)] dark:bg-[var(--accent-soft)] dark:text-[var(--accent)] xl:justify-self-start">
              <span className="mr-2 text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">{copy.heroCompareRightMode}</span>
              {copy.heroCompareRightTitle}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.66fr)_24px_minmax(0,1.34fr)] xl:items-stretch">
            <article className="relative rounded-[1.6rem] border border-slate-300/90 bg-[linear-gradient(180deg,rgba(246,248,251,0.96),rgba(235,239,245,0.96))] p-3 text-slate-700 shadow-[0_22px_46px_-40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-none dark:bg-[var(--surface)] dark:text-slate-300">
              <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
              <div className="pointer-events-none absolute inset-y-6 right-6 w-10 rounded-full bg-slate-400/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[0.9rem] border border-slate-300 bg-[#f3f4f6] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.12)] grayscale-[0.22] dark:border-white/10 dark:bg-[var(--surface-elevated)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-[#0a66c2] px-3 py-2.5 text-white dark:border-white/10 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-[0.7rem] bg-white text-[#0a66c2] shadow-inner dark:bg-slate-950 dark:text-slate-300">
                      <div className="h-3 w-3 rounded-full bg-[#0a66c2] dark:bg-slate-300" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">{copy.heroLegacyLabel}</div>
                      <div className="text-sm font-semibold">{copy.heroLegacyBrand}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-white/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-white/40" />
                    <div className="h-2.5 w-2.5 rounded-full bg-white/30" />
                  </div>
                </div>

                <div className="space-y-2.5 p-3">
                  <div className="flex items-center gap-2 rounded-[0.45rem] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-500 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-400">
                    <Search size={15} />
                    <span>{copy.heroLegacySearch}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-[0.35rem] border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-400">{copy.heroLegacyChipOne}</div>
                    <div className="rounded-[0.35rem] border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-400">{copy.heroLegacyChipTwo}</div>
                    <div className="rounded-[0.35rem] border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-400">{copy.heroLegacyChipThree}</div>
                  </div>

                  <div className="space-y-2.5">
                    {[0, 1].map((index) => (
                      <div
                        key={index}
                        className={cn(
                          'rounded-[0.5rem] border bg-white px-3 py-2.5 transition',
                          index === 0
                            ? 'border-slate-400 shadow-[0_8px_18px_-16px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[var(--surface)]'
                            : 'border-slate-300 opacity-80 dark:border-white/10 dark:bg-[var(--surface)]'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <div className="mt-0.5 h-10 w-10 rounded-[0.35rem] border border-slate-300 bg-slate-200 dark:border-white/10 dark:bg-[var(--surface-elevated)]" />
                            <div>
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {index === 0 ? copy.heroLegacyRole : copy.heroLegacyRoleAlt}
                              </div>
                              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.heroLegacyCompany}</div>
                              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                {(index === 0 ? copy.heroLegacyMeta : copy.heroLegacyMetaAlt).split(' • ').map((part: string, partIndex: number) => (
                                  <React.Fragment key={part}>
                                    {partIndex > 0 ? <span>•</span> : null}
                                    <span>{part}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="rounded-[0.35rem] border border-rose-300 bg-rose-100 px-2 py-1 text-[10px] font-semibold leading-4 text-rose-800">
                              {index === 0 ? copy.heroLegacyApplicantsPrimary : copy.heroLegacyApplicantsSecondary}
                            </div>
                            <div className="mt-1 h-5 w-5 rounded-[0.25rem] border border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-[var(--surface-elevated)]" />
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            {copy.heroLegacyApply}
                          </div>
                          {index === 0 ? (
                            <div className="rounded-[0.35rem] bg-[#0a66c2] px-3 py-1.5 text-xs font-semibold text-white">
                              {copy.heroLegacyButton}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[1rem] border border-rose-300/90 bg-rose-100/92 p-3 shadow-[0_16px_30px_-24px_rgba(244,63,94,0.22)] dark:border-rose-400/18 dark:bg-rose-400/8">
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-rose-950 dark:text-rose-100">
                      <span>{copy.heroLegacyQueue}</span>
                      <span>{copy.heroLegacyDelay}</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70 dark:bg-white/10">
                      <div className="h-full w-[88%] rounded-full bg-rose-500" />
                    </div>
                    <div className="mt-3 text-sm font-medium text-rose-900 dark:text-rose-200">
                      {copy.heroLegacyBatch}
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <div className="relative hidden xl:flex xl:items-center xl:justify-center">
              <div className="h-full w-px bg-[linear-gradient(180deg,rgba(148,163,184,0),rgba(148,163,184,0.45),rgba(14,165,233,0.28),rgba(148,163,184,0))]" />
              <div className="absolute grid h-10 w-10 place-items-center rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-white text-[var(--accent)] shadow-[0_10px_24px_-18px_rgba(var(--accent-rgb),0.24)] animate-pulse dark:border-white/10 dark:bg-[var(--surface-elevated)]">
                →
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.85rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-slate-900 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-[var(--surface-elevated)] dark:text-white sm:p-4">

              <div className="relative z-10">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)] dark:text-[var(--accent)]">
                    {copy.heroHandshakeLabel}
                  </div>
                  <div className="text-sm text-[var(--text-muted)] dark:text-slate-300">
                    {copy.heroDemoCaption}
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(300px,1.2fr)]">
                <div className="space-y-3">
                  <article className="rounded-[1.35rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-soft)] dark:border-white/10 dark:bg-[var(--surface)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{copy.heroTeamLabel}</div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{heroDemo.company}</div>
                    </div>
                    <div className="mt-2 text-[1.02rem] font-semibold leading-6 text-slate-950 dark:text-white">
                      {heroDemo.challenge}
                    </div>
                    <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-rose-200/90 bg-rose-50/88 px-3 py-2 text-sm text-rose-900 dark:border-rose-400/14 dark:bg-rose-400/8 dark:text-slate-200">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">{copy.heroRiskLabel}</span>
                      <span className="truncate">
                        {heroDemo.risk}
                      </span>
                    </div>
                  </article>

                  <article className="rounded-[1.22rem] border border-emerald-300/40 bg-emerald-50/82 p-3.5 shadow-[0_18px_34px_-28px_rgba(5,150,105,0.16)] dark:border-white/10 dark:bg-[var(--surface)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">{copy.heroWhyTitle}</div>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                      {copy.heroWhySignals.map((signal: string) => (
                        <div
                          key={signal}
                          className="rounded-[999px] border border-emerald-200/70 bg-white/78 px-3 py-2 text-sm text-emerald-950 dark:border-white/10 dark:bg-[var(--surface-elevated)] dark:text-slate-100"
                        >
                          ✓ {signal}
                        </div>
                      ))}
                    </div>
                  </article>

                </div>

                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="group relative flex min-h-[21rem] flex-col rounded-[1.55rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 text-left text-slate-900 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.28)] dark:border-white/10 dark:bg-[var(--surface)] dark:text-white sm:min-h-[23rem] sm:p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] dark:text-[var(--accent)]">{copy.heroEditorLabel}</div>
                    <div className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] dark:border-white/10 dark:bg-[var(--surface-elevated)] dark:text-[var(--accent)]">
                      {copy.heroEditorHint}
                    </div>
                  </div>

                  <div className="relative mt-3 rounded-[1.15rem] border border-slate-200 bg-white px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_16px_34px_-30px_rgba(14,165,233,0.18)] dark:border-white/10 dark:bg-[var(--surface-elevated)]">
                    <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                      {heroDemo.eyebrow}
                    </div>
                    <div className="mt-2 text-base font-semibold leading-6 text-slate-950 dark:text-white sm:text-[1.18rem]">
                      {heroDemo.question}
                    </div>
                  </div>

                  <div className="mt-3 flex-1 rounded-[1.32rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[linear-gradient(180deg,#ffffff_0%,#fffdfa_100%)] px-3.5 py-3.5 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_20px_40px_-34px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-none dark:bg-[var(--surface-elevated)] dark:text-slate-100 dark:shadow-[var(--shadow-soft)]">
                    <div className="flex items-center gap-2">
                      {[`1. ${copy.heroLiveCandidateLabel}`, `2. ${copy.heroLiveCompanyLabel}`, `3. ${copy.handshakeLaneOpen}`].map((label, index) => (
                        <div
                          key={label}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-300',
                            activeHeroMoment === index
                              ? 'bg-[var(--accent)] text-white shadow-[0_10px_22px_-14px_rgba(var(--accent-rgb),0.55)]'
                              : 'border border-[var(--border-subtle)] bg-white text-slate-400 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-300'
                          )}
                        >
                          {label}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 h-[17.5rem] sm:h-[17.75rem]">
                      <div className="flex h-full flex-col rounded-[1.12rem] border border-[var(--border-subtle)] bg-white/92 p-4 shadow-[0_20px_38px_-26px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[var(--surface)]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
                            {[`1. ${copy.heroLiveCandidateLabel}`, `2. ${copy.heroLiveCompanyLabel}`, `3. ${copy.handshakeLaneOpen}`][activeHeroMoment]}
                          </div>
                          <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-200">
                            {activeHeroMoment === 0
                              ? copy.heroEditorHint
                              : activeHeroMoment === 1
                                ? copy.heroLiveCompanyEta
                                : copy.heroLiveSlotsValue}
                          </div>
                        </div>

                        <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[1rem] border border-slate-200 bg-[var(--surface)] p-3.5 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[var(--surface)]">
                          {activeHeroMoment === 0 ? (
                            <>
                              <div className="rounded-[0.95rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)] shadow-[0_12px_24px_-22px_rgba(var(--accent-rgb),0.2)] dark:border-white/10 dark:bg-[var(--surface-elevated)] dark:text-[var(--accent)]">
                                {copy.heroEditorAction}
                              </div>
                              <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[0.95rem] border-2 border-dashed border-[rgba(var(--accent-rgb),0.28)] bg-white px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-[rgba(var(--accent-rgb),0.24)] dark:bg-[var(--surface-elevated)]">
                                <div className="text-[15px] font-medium leading-6 text-slate-500 sm:text-base">
                                  {copy.heroEditorPlaceholder}
                                </div>
                                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                                  <div className="flex items-center gap-2">
                                    <div className="h-5 w-0.5 rounded-full bg-[var(--accent)] animate-pulse" />
                                    <div className="text-xs font-medium text-slate-400">
                                      {copy.heroEditorHint}
                                    </div>
                                  </div>
                                  <div className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_24px_-16px_rgba(var(--accent-rgb),0.6)]">
                                    {copy.primaryCta}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}

                          {activeHeroMoment === 1 ? (
                            <>
                              <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-[var(--surface-elevated)] dark:text-slate-300">
                                {copy.heroLiveCompanyLabel}
                              </div>
                              <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[0.95rem] border border-slate-200 bg-white px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-[var(--surface-elevated)]">
                                <div className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                                  {copy.heroLiveCompanyBody}
                                </div>
                                <div className="mt-auto flex items-center justify-end gap-3 pt-4">
                                  <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-200">
                                    {copy.handshakeLaneOpen}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}

                          {activeHeroMoment === 2 ? (
                            <>
                              <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-[var(--surface-elevated)] dark:text-slate-300">
                                {copy.handshakeLaneOpen}
                              </div>
                              <div className="mt-3 flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-[0.95rem] border border-slate-200 bg-white px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-[var(--surface-elevated)]">
                                <div className="space-y-3">
                                  <div className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                                    {copy.heroDialogOpenBody}
                                  </div>
                                  <div className="rounded-[0.85rem] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-[var(--surface)] dark:text-slate-300">
                                    {copy.heroLiveSlotsNote}
                                  </div>
                                </div>
                                <div className="flex items-center justify-end pt-3">
                                  <div className="inline-flex max-w-full items-center justify-center rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_24px_-16px_rgba(var(--accent-rgb),0.62)]">
                                    {copy.heroDialogOpenCta}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                  </div>
                </button>
              </div>
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
