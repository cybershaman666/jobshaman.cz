import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Building,
  CheckCircle,
  ChevronDown,
  Clock3,
  Crown,
  Layers3,
  LogIn,
  MessageSquare,
  Shield,
  Sparkles,
  Target
} from 'lucide-react';
import AnalyticsService from '../services/analyticsService';
import AppShellAtmosphere from './ui/AppShellAtmosphere';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

interface PlanCard {
  name: string;
  price: string;
  note: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel?: string;
  ctaMode?: 'register' | 'demo';
}

const CompanyLandingPage: React.FC<CompanyLandingPageProps> = ({ onRegister, onRequestDemo, onLogin }) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = locale === 'at' ? 'de' : locale;
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const hasTrackedView = useRef(false);

  const trackEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(eventName, {
      locale: i18n.language,
      ...metadata
    });
  };

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackEvent('company_landing_view', { section: 'handshake_landing' });
  }, []);

  const copy = useMemo(() => {
    if (language === 'cs') {
      return {
    badge: 'Handshake hiring pro firmy',
    title: 'Lepší první kontakt pro moderní hiring.',
    subtitle: 'JobShaman nahrazuje mrtvé CV a nekonečný funnel omezeným oboustranným dialogem. Firma nejdřív ukáže pravdu o roli a pak dostane odpověď, která ukáže způsob přemýšlení kandidáta.',
    primaryCta: 'Otevřít firemní workspace',
    secondaryCta: 'Vyzkoušet demo',
    login: 'Přihlásit se',
    recommended: 'Doporučeno',
    roleTruth: 'Pravda o roli',
    asyncFirst: 'Async first',
    valuePills: ['Role Canvas místo inzerátu', 'Dialogue Inbox místo application tabulky', 'Sloty místo nekonečného funnelu'],
    rolePreviewLabel: 'Ukázka Role Canvas',
    rolePreviewTitle: 'Ještě před otevřením role firma otevřeně popíše realitu týmu.',
    rolePreviewItems: [
      'Co je na této roli skutečně těžké?',
      'Jaký typ člověka tady selže?',
      'Jak poznáme úspěch po 6 měsících?',
      'Které 2 situace chceme otevřít v handshake?'
    ],
    comparisonTitle: 'Co se mění v praxi',
    comparisonOld: 'Starý hiring',
    comparisonNew: 'Handshake hiring',
    comparisonRows: [
      ['Job post a CV screening', 'Role Canvas a krátký oboustranný dialog'],
      ['100+ uchazečů v jednom funnelu', 'Omezená kapacita a aktivní sloty'],
      ['Video, pitch a sebeprezentace', 'Text-first odpověď, audio jen volitelně'],
      ['Ghosting a nejasné stavy', 'Open, In Review, Shortlisted, Closed s důvodem']
    ],
    systemTitle: 'Core system platformy',
    systemCards: [
      {
        title: 'Modul rolí',
        body: 'Pozice není jen text. Je to strukturovaný objekt s kontextem týmu, hodnotami, realistickými situacemi a definicí úspěchu.'
      },
      {
        title: 'Modul dialogu',
        body: 'Místo seznamu aplikací pracujete s vlákny. Každé vlákno má jasný tah, shrnutí a stav.'
      },
      {
        title: 'Kapacitní sloty',
        body: 'Každá role má limit otevřených dialogů. To drží kvalitu a chrání čas recruiterů.'
      },
      {
        title: 'Transparentní uzavření',
        body: 'Každý uzavřený dialog má důvod. Platforma nemá prostor pro "seen" a pasivní ignoraci.'
      }
    ],
    pricingTitle: 'Monetizace je v souladu s chováním',
    pricingLead: 'Začít můžete zdarma. Neplatíte za CV databázi ani za počet zobrazení. Platíte až za kapacitu, kterou opravdu používáte.',
    pricingPlans: [
      {
        name: 'Free',
        price: 'Zdarma',
        note: 'Na první vyzkoušení bez rizika',
        features: ['1 otevření role', '3 aktivní dialogové sloty', 'Bez AI funkcí'],
        ctaLabel: 'Vyzkoušet zdarma'
      },
      {
        name: 'Starter',
        price: '249 EUR / měsíc',
        note: 'Pro první hiring procesy',
        features: ['3 otevření rolí měsíčně', '12 aktivních dialogue slotů', 'Role Canvas + Dialogue Inbox']
      },
      {
        name: 'Growth',
        price: '599 EUR / měsíc',
        note: 'Pro aktivní hiring tým',
        features: ['10 otevření rolí měsíčně', '40 aktivních dialogue slotů', 'Prioritní SLA a workflow přehled'],
        highlighted: true
      },
      {
        name: 'Professional',
        price: '899 EUR / měsíc',
        note: 'Pro více recruiterů a vyšší throughput',
        features: ['25 otevření rolí měsíčně', '100 aktivních dialogue slotů', 'Rozšířené decision signály a billing kontrola']
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        note: 'Pro komplexní hiring provoz',
        features: ['Custom limity', 'Success fee volitelně', 'Integrace a custom rollout'],
        ctaMode: 'demo'
      }
    ] as PlanCard[],
    faqTitle: 'Co firmy řeší nejčastěji',
    faqItems: [
      {
        q: 'Co když nechceme měnit celý hiring proces naráz?',
        a: 'Nemusíte. Handshake může být první vrstva před dalšími assessmenty. Měníme začátek funnelu, ne nutně všechno ostatní v první fázi.'
      },
      {
        q: 'Proč nejsou v centru CV a video?',
        a: 'CV zůstává jako doplněk. Video zvedá stres, bias a performativnost. Core handshake má být rychlý, soukromý a nízkostresový.'
      },
      {
        q: 'Jak AI pomáhá bez toho, aby rozhodovala?',
        a: 'AI shrnuje vlákna, vytahuje signál a připravuje explainable scorecard. Stav kandidáta pořád mění člověk.'
      },
      {
        q: 'Proč jsou důležité sloty?',
        a: 'Bez limitu se z dialogu stane další zahlcený inbox. Sloty drží tempo, pozornost a kvalitu odpovědí na obou stranách.'
      }
    ],
    finalTitle: 'Vraťte do výběru lidí lidský faktor a pravdu.',
    finalBody: 'Místo dalšího CV funnelu otevřete prostředí, kde se dá dělat rychlý a férový první kontakt bez zbytečného tlaku.',
    finalPrimary: 'Začít s role canvas',
    finalSecondary: 'Přihlásit se do firmy'
      };
    }

    if (language === 'sk') {
      return {
        badge: 'Handshake hiring pre firmy',
        title: 'Lepší prvý kontakt pre moderný hiring.',
        subtitle: 'JobShaman nahrádza mŕtve CV a nekonečný funnel obmedzeným obojstranným dialógom. Firma najprv ukáže pravdu o roli a potom dostane odpoveď, ktorá ukáže spôsob premýšľania kandidáta.',
        primaryCta: 'Otvoriť firemný workspace',
        secondaryCta: 'Vyskúšať demo',
        login: 'Prihlásiť sa',
        recommended: 'Odporúčané',
        roleTruth: 'Pravda o roli',
        asyncFirst: 'Async first',
        valuePills: ['Role Canvas namiesto inzerátu', 'Dialogue Inbox namiesto tabuľky aplikácií', 'Sloty namiesto nekonečného funnelu'],
        rolePreviewLabel: 'Ukážka Role Canvas',
        rolePreviewTitle: 'Ešte pred otvorením roly firma otvorene popíše realitu tímu.',
        rolePreviewItems: [
          'Čo je na tejto roli skutočne ťažké?',
          'Aký typ človeka tu zlyhá?',
          'Ako spoznáme úspech po 6 mesiacoch?',
          'Ktoré 2 situácie chceme otvoriť v handshake?'
        ],
        comparisonTitle: 'Čo sa mení v praxi',
        comparisonOld: 'Starý hiring',
        comparisonNew: 'Handshake hiring',
        comparisonRows: [
          ['Job post a CV screening', 'Role Canvas a krátky obojstranný dialóg'],
          ['100+ uchádzačov v jednom funneli', 'Obmedzená kapacita a aktívne sloty'],
          ['Video, pitch a sebaprezentácia', 'Text-first odpoveď, audio len voliteľne'],
          ['Ghosting a nejasné stavy', 'Open, In Review, Shortlisted, Closed s dôvodom']
        ],
        systemTitle: 'Core systém platformy',
        systemCards: [
          {
            title: 'Modul rolí',
            body: 'Pozícia nie je len text. Je to štruktúrovaný objekt s kontextom tímu, hodnotami, realistickými situáciami a definíciou úspechu.'
          },
          {
            title: 'Modul dialógu',
            body: 'Namiesto zoznamu aplikácií pracujete s vláknami. Každé vlákno má jasný ťah, zhrnutie a stav.'
          },
          {
            title: 'Kapacitné sloty',
            body: 'Každá rola má limit otvorených dialógov. To drží kvalitu a chráni čas recruiterov.'
          },
          {
            title: 'Transparentné uzavretie',
            body: 'Každý uzavretý dialóg má dôvod. Platforma nemá priestor pre "seen" a pasívne ignorovanie.'
          }
        ],
        pricingTitle: 'Monetizácia v súlade so správaním',
        pricingLead: 'Začať môžete zadarmo. Neplatíte za CV databázu ani za počet zobrazení. Platíte až za kapacitu, ktorú naozaj používate.',
        pricingPlans: [
          {
            name: 'Free',
            price: 'Zdarma',
            note: 'Na prvé vyskúšanie bez rizika',
            features: ['1 otvorenie roly', '3 aktívne dialógové sloty', 'Bez AI funkcií'],
            ctaLabel: 'Vyskúšať zadarmo'
          },
          {
            name: 'Starter',
            price: '249 EUR / mesiac',
            note: 'Pre prvé hiring procesy',
            features: ['3 otvorenia rolí mesačne', '12 aktívnych dialogue slotov', 'Role Canvas + Dialogue Inbox']
          },
          {
            name: 'Growth',
            price: '599 EUR / mesiac',
            note: 'Pre aktívny hiring tím',
            features: ['10 otvorení rolí mesačne', '40 aktívnych dialogue slotov', 'Prioritné SLA a workflow prehľad'],
            highlighted: true
          },
          {
            name: 'Professional',
            price: '899 EUR / mesiac',
            note: 'Pre viac recruiterov a vyšší throughput',
            features: ['25 otvorení rolí mesačne', '100 aktívnych dialogue slotov', 'Rozšírené decision signály a billing kontrola']
          },
          {
            name: 'Enterprise',
            price: 'Custom',
            note: 'Pre komplexný hiring workflow',
            features: ['Custom limity', 'Success fee voliteľne', 'Integrácie a custom rollout'],
            ctaMode: 'demo'
          }
        ] as PlanCard[],
        faqTitle: 'Čo firmy riešia najčastejšie',
        faqItems: [
          {
            q: 'Čo ak nechceme meniť celý hiring proces naraz?',
            a: 'Nemusíte. Handshake môže fungovať ako prvá vrstva pred hlbšími assessmentmi. Meníme začiatok funnelu, nie nutne všetko ostatné hneď v prvej fáze.'
          },
          {
            q: 'Prečo nie sú v centre CV a video?',
            a: 'CV zostáva ako doplnok. Video zvyšuje stres, bias a performativitu. Core handshake má byť rýchly, súkromný a nízkostresový.'
          },
          {
            q: 'Ako AI pomáha bez toho, aby rozhodovala?',
            a: 'AI sumarizuje vlákna, vyťahuje signál a pripravuje explainable scorecard. Stav kandidáta stále mení človek.'
          },
          {
            q: 'Prečo sú sloty také dôležité?',
            a: 'Bez limitu sa z dialógu stane ďalší preťažený inbox. Sloty držia tempo, pozornosť a kvalitu odpovedí na oboch stranách.'
          }
        ],
        finalTitle: 'Vráťte do výberu ľudí ľudský faktor a pravdu.',
        finalBody: 'Namiesto ďalšieho CV funnelu otvorte prostredie, kde sa dá robiť rýchly a férový prvý kontakt bez zbytočného tlaku.',
        finalPrimary: 'Začať s role canvas',
        finalSecondary: 'Prihlásiť sa do firmy'
      };
    }

    if (language === 'de') {
      return {
        badge: 'Handshake Hiring für Unternehmen',
        title: 'Ein besserer Erstkontakt für modernes Hiring.',
        subtitle: 'JobShaman ersetzt tote CV-Funnels durch einen begrenzten beidseitigen Dialog. Das Unternehmen zeigt zuerst die Wahrheit über die Rolle und erhält dann eine Antwort, die die Denkweise des Kandidaten sichtbar macht.',
        primaryCta: 'Unternehmens-Workspace öffnen',
        secondaryCta: 'Demo testen',
        login: 'Anmelden',
        recommended: 'Empfohlen',
        roleTruth: 'Wahrheit über die Rolle',
        asyncFirst: 'Async first',
        valuePills: ['Role Canvas statt Anzeige', 'Dialogue Inbox statt Bewerbertabelle', 'Slots statt endlosem Funnel'],
        rolePreviewLabel: 'Role-Canvas-Vorschau',
        rolePreviewTitle: 'Noch vor dem Öffnen der Rolle beschreibt das Unternehmen offen die Teamrealität.',
        rolePreviewItems: [
          'Was ist an dieser Rolle wirklich schwer?',
          'Welcher Typ Mensch scheitert hier?',
          'Woran erkennen wir Erfolg nach 6 Monaten?',
          'Welche 2 Situationen sollen den Handshake eröffnen?'
        ],
        comparisonTitle: 'Was sich in der Praxis ändert',
        comparisonOld: 'Altes Hiring',
        comparisonNew: 'Handshake Hiring',
        comparisonRows: [
          ['Jobanzeige und CV-Screening', 'Role Canvas und kurzer beidseitiger Dialog'],
          ['100+ Kandidaten in einem Funnel', 'Begrenzte Kapazität mit aktiven Slots'],
          ['Video, Pitch und Selbstdarstellung', 'Text-first Antwort, Audio nur optional'],
          ['Ghosting und unklare Status', 'Open, In Review, Shortlisted, Closed mit Grund']
        ],
        systemTitle: 'Kernsystem der Plattform',
        systemCards: [
          {
            title: 'Rollenmodul',
            body: 'Eine Rolle ist nicht nur Text. Sie ist ein strukturiertes Objekt mit Teamkontext, Werten, realistischen Situationen und klarer Erfolgsdefinition.'
          },
          {
            title: 'Dialogmodul',
            body: 'Statt mit Bewerbungslisten arbeitet Ihr Team mit Threads. Jeder Thread hat klare Ownership, Zusammenfassung und Status.'
          },
          {
            title: 'Kapazitäts-Slots',
            body: 'Jede Rolle hat ein Limit offener Dialoge. Das schützt Qualität und die Zeit der Recruiter.'
          },
          {
            title: 'Transparenter Abschluss',
            body: 'Jeder geschlossene Dialog hat einen Grund. Es gibt keinen Produktplatz für "seen" oder passive Stille.'
          }
        ],
        pricingTitle: 'Monetarisierung im Einklang mit dem Verhalten',
        pricingLead: 'Sie können kostenlos starten. Sie zahlen weder für CV-Inventar noch für Impressionen. Bezahlt wird nur die Kapazität, die Sie wirklich nutzen.',
        pricingPlans: [
          {
            name: 'Free',
            price: 'Kostenlos',
            note: 'Zum risikofreien ersten Test',
            features: ['1 Rollenöffnung', '3 aktive Dialog-Slots', 'Keine AI-Funktionen'],
            ctaLabel: 'Kostenlos testen'
          },
          {
            name: 'Starter',
            price: '249 EUR / Monat',
            note: 'Für erste strukturierte Hiring-Loops',
            features: ['3 Rollenöffnungen pro Monat', '12 aktive Dialogue-Slots', 'Role Canvas + Dialogue Inbox']
          },
          {
            name: 'Growth',
            price: '599 EUR / Monat',
            note: 'Für aktive Hiring-Teams',
            features: ['10 Rollenöffnungen pro Monat', '40 aktive Dialogue-Slots', 'Priorisierte SLA und Workflow-Überblick'],
            highlighted: true
          },
          {
            name: 'Professional',
            price: '899 EUR / Monat',
            note: 'Für mehrere Recruiter und höheren Throughput',
            features: ['25 Rollenöffnungen pro Monat', '100 aktive Dialogue-Slots', 'Erweiterte Decision-Signale und Billing-Kontrolle']
          },
          {
            name: 'Enterprise',
            price: 'Custom',
            note: 'Für komplexe Hiring-Operationen',
            features: ['Custom-Limits', 'Optionales Success Fee', 'Integrationen und individuelles Rollout'],
            ctaMode: 'demo'
          }
        ] as PlanCard[],
        faqTitle: 'Was Unternehmen am häufigsten fragen',
        faqItems: [
          {
            q: 'Was, wenn wir nicht den ganzen Hiring-Prozess auf einmal ändern wollen?',
            a: 'Das müssen Sie nicht. Handshake kann als erste Schicht vor tieferen Interviews oder Assessments laufen. Wir verändern zuerst den Anfang des Funnels.'
          },
          {
            q: 'Warum stehen CV und Video nicht mehr im Zentrum?',
            a: 'Das CV bleibt als Kontext erhalten. Video erhöht Stress, Bias und Performance-Druck. Der Core Handshake soll schnell, privat und reibungsarm bleiben.'
          },
          {
            q: 'Wie hilft AI, ohne zu entscheiden?',
            a: 'AI fasst Threads zusammen, zieht Signal heraus und bereitet eine erklärbare Scorecard vor. Den Kandidatenstatus ändert weiterhin ein Mensch.'
          },
          {
            q: 'Warum sind Slots so wichtig?',
            a: 'Ohne Limits wird Dialog zum nächsten überladenen Inbox. Slots schützen Tempo, Aufmerksamkeit und Gegenseitigkeit auf beiden Seiten.'
          }
        ],
        finalTitle: 'Bringen Sie Wahrheit und menschliches Signal zurück ins Hiring.',
        finalBody: 'Ersetzen Sie den nächsten CV-Funnel durch ein System für schnellen, fairen und druckarmen Erstkontakt.',
        finalPrimary: 'Mit Role Canvas starten',
        finalSecondary: 'Als Unternehmen anmelden'
      };
    }

    if (language === 'pl') {
      return {
        badge: 'Handshake hiring dla firm',
        title: 'Lepszy pierwszy kontakt dla nowoczesnego hiringu.',
        subtitle: 'JobShaman zastępuje martwe CV i nieskończony funnel ograniczonym, dwustronnym dialogiem. Firma najpierw pokazuje prawdę o roli, a potem dostaje odpowiedź, która odsłania sposób myślenia kandydata.',
        primaryCta: 'Otwórz firmowy workspace',
        secondaryCta: 'Wypróbuj demo',
        login: 'Zaloguj się',
        recommended: 'Polecane',
        roleTruth: 'Prawda o roli',
        asyncFirst: 'Async first',
        valuePills: ['Role Canvas zamiast ogłoszenia', 'Dialogue Inbox zamiast tabeli aplikacji', 'Sloty zamiast nieskończonego funnelu'],
        rolePreviewLabel: 'Podgląd Role Canvas',
        rolePreviewTitle: 'Jeszcze przed otwarciem roli firma otwarcie opisuje realia zespołu.',
        rolePreviewItems: [
          'Co jest naprawdę trudne w tej roli?',
          'Jaki typ osoby tutaj zawodzi?',
          'Po czym poznamy sukces po 6 miesiącach?',
          'Które 2 sytuacje mają otworzyć handshake?'
        ],
        comparisonTitle: 'Co zmienia się w praktyce',
        comparisonOld: 'Stary hiring',
        comparisonNew: 'Handshake hiring',
        comparisonRows: [
          ['Job post i screening CV', 'Role Canvas i krótki dwustronny dialog'],
          ['100+ kandydatów w jednym funnelu', 'Ograniczona pojemność i aktywne sloty'],
          ['Wideo, pitch i autoprezentacja', 'Odpowiedź text-first, audio tylko opcjonalnie'],
          ['Ghosting i niejasne statusy', 'Open, In Review, Shortlisted, Closed z powodem']
        ],
        systemTitle: 'Core system platformy',
        systemCards: [
          {
            title: 'Moduł ról',
            body: 'Rola to nie tylko tekst. To uporządkowany obiekt z kontekstem zespołu, wartościami, realistycznymi sytuacjami i definicją sukcesu.'
          },
          {
            title: 'Moduł dialogu',
            body: 'Zamiast listy aplikacji zespół pracuje na wątkach. Każdy wątek ma jasny ruch, podsumowanie i status.'
          },
          {
            title: 'Sloty pojemnościowe',
            body: 'Każda rola ma limit otwartych dialogów. To chroni jakość i czas recruiterów.'
          },
          {
            title: 'Transparentne zamknięcie',
            body: 'Każdy zamknięty dialog ma powód. Platforma nie zostawia miejsca na "seen" i bierne milczenie.'
          }
        ],
        pricingTitle: 'Monetyzacja zgodna z zachowaniem',
        pricingLead: 'Możesz zacząć za darmo. Nie płacisz za bazę CV ani za wyświetlenia. Płacisz dopiero za pojemność, której naprawdę używasz.',
        pricingPlans: [
          {
            name: 'Free',
            price: 'Za darmo',
            note: 'Bezpieczny pierwszy test bez ryzyka',
            features: ['1 otwarcie roli', '3 aktywne sloty dialogowe', 'Bez funkcji AI'],
            ctaLabel: 'Wypróbuj za darmo'
          },
          {
            name: 'Starter',
            price: '249 EUR / miesiąc',
            note: 'Dla pierwszych procesów hiringowych',
            features: ['3 otwarcia ról miesięcznie', '12 aktywnych dialogue slotów', 'Role Canvas + Dialogue Inbox']
          },
          {
            name: 'Growth',
            price: '599 EUR / miesiąc',
            note: 'Dla aktywnego zespołu hiringowego',
            features: ['10 otwarć ról miesięcznie', '40 aktywnych dialogue slotów', 'Priorytetowe SLA i przegląd workflow'],
            highlighted: true
          },
          {
            name: 'Professional',
            price: '899 EUR / miesiąc',
            note: 'Dla większej liczby recruiterów i większego throughputu',
            features: ['25 otwarć ról miesięcznie', '100 aktywnych dialogue slotów', 'Rozszerzone sygnały decyzyjne i kontrola billingowa']
          },
          {
            name: 'Enterprise',
            price: 'Custom',
            note: 'Dla złożonych operacji hiringowych',
            features: ['Custom limity', 'Opcjonalne success fee', 'Integracje i indywidualny rollout'],
            ctaMode: 'demo'
          }
        ] as PlanCard[],
        faqTitle: 'O co firmy pytają najczęściej',
        faqItems: [
          {
            q: 'Co jeśli nie chcemy zmieniać całego procesu hiringowego naraz?',
            a: 'Nie musicie. Handshake może działać jako pierwsza warstwa przed głębszymi assessmentami. Zmieniamy początek funnelu, a nie od razu cały proces.'
          },
          {
            q: 'Dlaczego CV i wideo nie są już w centrum?',
            a: 'CV zostaje jako kontekst wspierający. Wideo podnosi stres, bias i presję performatywną. Core handshake ma pozostać szybki, prywatny i niskotarciowy.'
          },
          {
            q: 'Jak AI pomaga, nie podejmując decyzji?',
            a: 'AI podsumowuje wątki, wyciąga sygnał i przygotowuje explainable scorecard. Status kandydata nadal zmienia człowiek.'
          },
          {
            q: 'Dlaczego sloty są tak ważne?',
            a: 'Bez limitu dialog staje się kolejną przeładowaną skrzynką. Sloty chronią tempo, uwagę i wzajemność po obu stronach.'
          }
        ],
        finalTitle: 'Przywróć do hiringu ludzki czynnik i prawdę.',
        finalBody: 'Zamiast kolejnego funnelu CV otwórz system, w którym da się zrobić szybki, uczciwy i mało stresowy pierwszy kontakt.',
        finalPrimary: 'Zacznij od Role Canvas',
        finalSecondary: 'Zaloguj się jako firma'
      };
    }

    return {
    badge: 'Handshake hiring for companies',
    title: 'Build modern hiring on a better first contact.',
    subtitle: 'JobShaman replaces dead CV funnels with limited two-way dialogue. The company shows the truth about the role first, then gets a response that reveals how the candidate actually thinks.',
    primaryCta: 'Open company workspace',
    secondaryCta: 'Try demo',
    login: 'Log in',
    recommended: 'Recommended',
    roleTruth: 'Role truth',
    asyncFirst: 'Async first',
    valuePills: ['Role Canvas instead of a static ad', 'Dialogue Inbox instead of an application table', 'Slots instead of an endless funnel'],
    rolePreviewLabel: 'Role Canvas preview',
    rolePreviewTitle: 'Before a role opens, the company has to tell the truth.',
    rolePreviewItems: [
      'What is actually hard about this role?',
      'What kind of person fails here?',
      'How do we define success after six months?',
      'Which two situations should open the handshake?'
    ],
    comparisonTitle: 'What changes in practice',
    comparisonOld: 'Old hiring',
    comparisonNew: 'Handshake hiring',
    comparisonRows: [
      ['Job post and CV screening', 'Role Canvas and a short two-way dialogue'],
      ['100+ candidates in one funnel', 'Limited capacity with active slots'],
      ['Video, pitch, and self-presentation', 'Text-first response, audio optional'],
      ['Ghosting and unclear states', 'Open, In Review, Shortlisted, Closed with a reason']
    ],
    systemTitle: 'Platform core',
    systemCards: [
      {
        title: 'Role Engine',
        body: 'A role is not just text. It is a structured object with team context, values, realistic situations, and a success definition.'
      },
      {
        title: 'Dialogue Engine',
        body: 'Instead of application lists, your team works with threads. Each thread has turn ownership, summary, and status.'
      },
      {
        title: 'Slot-based capacity',
        body: 'Every role has a hard limit for open dialogues. That keeps recruiter attention focused and response quality high.'
      },
      {
        title: 'Transparent closure',
        body: 'Every closed dialogue has a reason. There is no product space for "seen" or passive silence.'
      }
    ],
    pricingTitle: 'Monetization aligned with behavior',
    pricingLead: 'You can start for free. You do not pay for CV inventory or impressions. You pay only for the capacity you actually use.',
    pricingPlans: [
      {
        name: 'Free',
        price: 'Free',
        note: 'A safe way to try the workflow first',
        features: ['1 role open', '3 active dialogue slots', 'No AI features'],
        ctaLabel: 'Try for free'
      },
      {
        name: 'Starter',
        price: '249 EUR / month',
        note: 'For your first structured hiring loops',
        features: ['3 role opens per month', '12 active dialogue slots', 'Role Canvas + Dialogue Inbox']
      },
      {
        name: 'Growth',
        price: '599 EUR / month',
        note: 'For active hiring teams',
        features: ['10 role opens per month', '40 active dialogue slots', 'Priority SLA and workflow visibility'],
        highlighted: true
      },
      {
        name: 'Professional',
        price: '899 EUR / month',
        note: 'For larger recruiter throughput',
        features: ['25 role opens per month', '100 active dialogue slots', 'Extended decision signals and billing controls']
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        note: 'For complex hiring operations',
        features: ['Custom limits', 'Optional success fee', 'Integrations and tailored rollout'],
        ctaMode: 'demo'
      }
    ] as PlanCard[],
    faqTitle: 'What companies ask most often',
    faqItems: [
      {
        q: 'What if we do not want to replace the whole hiring process at once?',
        a: 'You do not have to. Handshake can operate as the first layer before deeper interviews or assessments. It changes the front of the funnel first.'
      },
      {
        q: 'Why are CV and video no longer central?',
        a: 'CV remains as supporting context. Video increases stress, bias, and performance pressure. The core handshake should stay quick, private, and low-friction.'
      },
      {
        q: 'How does AI help without deciding?',
        a: 'AI summarizes threads, extracts signal, and prepares an explainable scorecard. A human still changes the candidate status.'
      },
      {
        q: 'Why do slots matter so much?',
        a: 'Without limits, dialogue turns into another overloaded inbox. Slots protect pace, attention, and reciprocity on both sides.'
      }
    ],
    finalTitle: 'Bring truth and human signal back into hiring.',
    finalBody: 'Replace another CV funnel with a system built for fast, fair, low-pressure first contact.',
    finalPrimary: 'Start with Role Canvas',
    finalSecondary: 'Log in as company'
    };
  }, [language]);

  const handleRegister = (section: string) => {
    trackEvent('company_landing_cta_register_click', { section });
    onRegister?.();
  };

  const handleDemo = (section: string) => {
    trackEvent('company_landing_cta_demo_click', { section });
    if (onRequestDemo) {
      onRequestDemo();
      return;
    }
    onLogin?.();
  };

  const handleLogin = (section: string) => {
    trackEvent('company_landing_cta_login_click', { section });
    onLogin?.();
  };

  const landingSectionClass =
    'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none lg:p-8';
  const landingHeroSectionClass =
    'rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none lg:p-8';
  const landingCardClass =
    'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none';
  const landingSoftCardClass =
    'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 dark:border-slate-800 dark:bg-slate-900';
  const landingEyebrowClass =
    'inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] dark:border-[rgba(var(--accent-rgb),0.16)] dark:bg-[rgba(var(--accent-rgb),0.08)]';
  const landingChipClass =
    'inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
  const landingPrimaryButtonClass =
    'app-button-primary rounded-[var(--radius-md)] px-6 py-3.5 shadow-none dark:border dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white';
  const landingSecondaryButtonClass =
    'app-button-secondary rounded-[var(--radius-md)] px-6 py-3.5 shadow-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
  const landingTopbarButtonClass =
    'app-button-secondary rounded-full px-4 py-2 shadow-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <AppShellAtmosphere />
      <div className="relative mx-auto w-full max-w-[1680px] px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <div className="app-aurora-shell mx-auto flex w-full max-w-[1480px] flex-col gap-6 lg:gap-7">
        <div className="flex justify-end">
          <button onClick={() => handleLogin('topbar')} className={landingTopbarButtonClass}>
            <LogIn size={16} />
            {copy.login}
          </button>
        </div>

        <section className={landingHeroSectionClass}>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div>
              <div className={landingEyebrowClass}>
                <Sparkles size={14} />
                {copy.badge}
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] md:text-[3.7rem] md:leading-[1.02]">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--text-muted)]">
                {copy.subtitle}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => handleRegister('hero')} className={landingPrimaryButtonClass}>
                  <Building size={18} />
                  {copy.primaryCta}
                </button>
                <button onClick={() => handleDemo('hero')} className={landingSecondaryButtonClass}>
                  {copy.secondaryCta}
                  <ArrowRight size={18} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {copy.valuePills.map((pill) => (
                  <div key={pill} className={landingChipClass}>
                    {pill}
                  </div>
                ))}
              </div>
            </div>

            <div className={landingCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                {copy.rolePreviewLabel}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                {copy.rolePreviewTitle}
              </h2>
              <div className="mt-5 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <Shield size={16} />
                  {copy.roleTruth}
                </div>
                <div className="mt-4 space-y-3">
                  {copy.rolePreviewItems.map((item) => (
                    <div key={item} className={`${landingSoftCardClass} text-sm leading-6 text-[var(--text)] shadow-none`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={landingSectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <Target className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.comparisonTitle}</h2>
          </div>
          <div className="grid grid-cols-[1fr,1fr] gap-3 text-sm">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 font-semibold text-[var(--text-muted)]">
              {copy.comparisonOld}
            </div>
            <div className="rounded-[var(--radius-md)] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-4 py-3 font-semibold text-[var(--accent)]">
              {copy.comparisonNew}
            </div>
            {copy.comparisonRows.map(([legacy, next]) => (
              <React.Fragment key={`${legacy}-${next}`}>
                <div className={`${landingSoftCardClass} text-[var(--text-muted)]`}>
                  {legacy}
                </div>
                <div className={`${landingSoftCardClass} font-medium text-[var(--text-strong)] dark:bg-slate-950`}>
                  {next}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.systemCards.map((card, index) => {
            const Icon = [Layers3, MessageSquare, Clock3, CheckCircle][index] || Layers3;
            return (
              <div key={card.title} className={landingCardClass}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{card.body}</p>
              </div>
            );
          })}
        </section>

        <section className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(145deg,#09131f,#0f172a_52%,#102235)] p-6 shadow-[0_30px_72px_-54px_rgba(8,23,37,0.62)] dark:bg-[linear-gradient(145deg,rgba(8,12,20,0.98),rgba(15,23,42,0.96)_56%,rgba(12,22,34,0.98))] dark:shadow-[0_24px_56px_-44px_rgba(2,6,23,0.72)] lg:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(var(--accent-rgb),0.16),transparent_26%),radial-gradient(circle_at_85%_10%,rgba(var(--accent-sky-rgb),0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_20%)] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(var(--accent-rgb),0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]"
          />
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-3">
              <Crown className="text-[var(--accent)]" size={20} />
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-50">{copy.pricingTitle}</h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">{copy.pricingLead}</p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {copy.pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-[var(--radius-xl)] border p-5 backdrop-blur-md ${
                    plan.highlighted
                      ? 'relative -translate-y-1 border-[rgba(var(--accent-rgb),0.32)] bg-[rgba(8,18,30,0.96)] shadow-[0_22px_44px_-28px_rgba(2,6,23,0.74)]'
                      : 'border-white/10 bg-white/5 shadow-[0_16px_32px_-26px_rgba(2,6,23,0.62)]'
                  }`}
                >
                  {plan.highlighted && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-5 top-0 h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(var(--accent-rgb),0.12),rgba(var(--accent-rgb),0.9),rgba(var(--accent-rgb),0.12))]"
                    />
                  )}
                  {plan.highlighted && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] shadow-none">
                      <Sparkles size={12} />
                      {copy.recommended}
                    </div>
                  )}
                  <div className="mt-3 text-lg font-semibold text-white">{plan.name}</div>
                  <div className={`mt-2 text-2xl font-black ${plan.highlighted ? 'text-white' : 'text-slate-50'}`}>{plan.price}</div>
                  <p className={`mt-2 text-xs leading-5 ${plan.highlighted ? 'text-slate-200' : 'text-slate-300'}`}>{plan.note}</p>
                  <div className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className={`flex items-start gap-2 text-sm ${plan.highlighted ? 'text-white' : 'text-slate-100'}`}>
                        <CheckCircle size={16} className={`mt-0.5 shrink-0 ${plan.highlighted ? 'text-[var(--accent)]' : 'text-slate-300'}`} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => (plan.ctaMode === 'demo' ? handleDemo('pricing') : handleRegister('pricing'))}
                    className={
                      plan.highlighted
                        ? 'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-3 text-sm font-bold text-slate-950 shadow-none transition hover:-translate-y-[1px] hover:brightness-110'
                        : 'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10'
                    }
                  >
                    {plan.ctaLabel || (plan.ctaMode === 'demo' ? copy.secondaryCta : copy.primaryCta)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={landingSectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <MessageSquare className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.faqTitle}</h2>
          </div>
          <div className="space-y-3">
            {copy.faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.q} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] dark:border-slate-800 dark:bg-slate-900">
                  <button
                    onClick={() => {
                      const nextIndex = isOpen ? null : index;
                      setOpenFaqIndex(nextIndex);
                      if (!isOpen) {
                        trackEvent('company_landing_faq_expand', { faq_index: index });
                      }
                    }}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-[var(--text-strong)]">{item.q}</span>
                    <ChevronDown className={`h-4 w-4 text-[var(--text-faint)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm leading-7 text-[var(--text-muted)]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={landingSectionClass}>
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div>
              <div className={landingEyebrowClass}>
                <Shield size={14} />
                {copy.asyncFirst}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                {copy.finalTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
                {copy.finalBody}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <button onClick={() => handleRegister('final_cta')} className={landingPrimaryButtonClass}>
                {copy.finalPrimary}
                <ArrowRight size={18} />
              </button>
              <button onClick={() => handleLogin('final_cta')} className={landingSecondaryButtonClass}>
                <LogIn size={18} />
                {copy.finalSecondary}
              </button>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
};

export default CompanyLandingPage;
