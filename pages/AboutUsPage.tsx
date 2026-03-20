import { Handshake, Leaf, Sparkles, Users2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import LegalPage from '../components/LegalPage';

const AboutUsPage = () => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const normalizedLocale = locale === 'at' ? 'de' : locale;
  const backLink = `/${locale}/`;

  const copy = normalizedLocale === 'cs'
    ? {
        pageTitle: 'O nás',
        backLabel: 'Zpět do aplikace',
        heroEyebrow: 'About JobShaman',
        heroTitle: 'Trh práce je plný aktivity, ale téměř bez skutečného spojení.',
        heroSubtitle:
          'Firmy dostávají stovky životopisů, ale nedokážou najít správné lidi. Lidé posílají desítky reakcí, ale nedostávají odpověď. Problém není v nedostatku talentu. Problém je v tom, jak spolu obě strany začínají komunikaci.',
        aboutTitle: 'About JobShaman',
        aboutBody: [
          'JobShaman vznikl z jednoduchého pozorování: pracovní trh generuje obrovské množství aktivity, ale velmi málo skutečného porozumění.',
          'Místo posílání CV začíná první kontakt konkrétní situací — výzvou, kterou firma skutečně řeší. Kandidát neříká jen co dělal, ale ukazuje, jak přemýšlí a jak by začal.',
          'Tomu říkáme handshake.',
          'Nad tímto momentem stavíme další vrstvu: rozhodovací systém, který pomáhá pochopit, jak práce zapadne do reálného života.',
        ],
        decisionLayerTitle: 'Decision Layer',
        decisionLayerBullets: [
          'čistá mzda po zdanění',
          'reálný dopad dojíždění',
          'Job Happiness Index',
          'kontext osobní situace',
        ],
        handshakeTitle: 'Handshake',
        handshakeBody: [
          'Handshake je náš způsob, jak vrátit do hiringu moment, který dřív vznikal přirozeně: člověk přijde, obě strany se uvidí, rychle si udělají obrázek a poznají, jestli má smysl pokračovat.',
          'Online tenhle moment zmizel. Nahradily ho formuláře, CV a nekonečné fronty bez zpětné vazby.',
          'Handshake ho vrací zpátky jako omezenou, reálnou interakci. Firma ukáže problém. Kandidát ukáže svůj přístup. Obě strany se můžou rozhodnout, jestli pokračovat dál.',
        ],
        buildingTitle: 'Co tím vzniká',
        buildingIntro:
          'Výsledkem není jen lepší hledání práce, ale nový způsob, jak se lidé rozhodují o své kariéře. JobShaman je career operating system, ne job board.',
        buildingFlowBefore: 'Místo modelu: apply → wait → interview → guess',
        buildingFlowAfter: 'Přecházíme na: interact → try → understand → decide',
        manifestoTitle: 'Manifesto',
        manifestoSections: [
          {
            title: 'Práce není seznam pozic',
            body:
              'Současné platformy zobrazují práci jako katalog. Role, požadavky, benefity. Ale práce není položka v seznamu. Je to rozhodnutí, které ovlivňuje život.',
          },
          {
            title: 'CV není začátek',
            body:
              'Životopis je retrospektiva. Ukazuje minulost, ale téměř nic neříká o tom, jak člověk přemýšlí dnes. Proto většina hiringu začíná špatně.',
          },
          {
            title: 'Nejlepší kandidáti dělají krok navíc',
            body:
              'Zavolají. Napíšou konkrétnímu člověku. Přijdou osobně. Ukážou zájem a přístup. To není hack systému. To je přirozený způsob, jak vzniká spolupráce. JobShaman tento krok dává všem.',
          },
          {
            title: 'Handshake místo aplikace',
            body:
              'Každá spolupráce by měla začít ne dokumentem, ale dialogem. Firma ukáže problém. Člověk ukáže svůj přístup. A teprve potom dává smysl pokračovat.',
          },
          {
            title: 'Méně reakcí, lepší výsledky',
            body:
              'Neoptimalizujeme počet kliků. Neoptimalizujeme počet CV. Optimalizujeme kvalitu konverzací, relevanci spojení a reálné výsledky. Lepší jsou tři smysluplné reakce než sto bez odpovědi.',
          },
          {
            title: 'Práce musí dávat smysl v reálném životě',
            body:
              'Mzda na papíře nestačí. Remote nestačí. Benefity nestačí. Důležité je, kolik ti skutečně zůstane, kolik času strávíš dojížděním a jak práce zapadne do tvého života.',
          },
          {
            title: 'Technologie má vracet lidskost',
            body:
              'AI může zrychlit procesy. Ale neměla by odstranit člověka. Naopak. Má odstranit šum, aby zbylo to důležité: smysluplný dialog mezi lidmi.',
          },
          {
            title: 'Budujeme nový typ trhu práce',
            body:
              'Ne job board. Ne sociální síť. Ale systém, kde práce začíná problémem, kandidát začíná přístupem a rozhodnutí vychází z reality.',
          },
        ],
        careTitle: 'Proč nám na tom záleží',
        careBody: [
          'Roky jsme stavěli systémy, produkty a operace napříč zeměmi i obory. Viděli jsme, jak hiring opravdu funguje. A jak často selhává.',
          'Ne proto, že by lidé byli špatní. Ale protože celý systém stojí na slabých signálech.',
          'JobShaman je náš pokus to opravit. Přesněji řečeno: nahradit.',
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
        closingTitle: 'To je JobShaman',
        closingBody:
          'Challenge marketplace. Handshake hiring. Career OS. Než se člověk upíše práci, měl by jí rozumět. A ideálně ji i zažít.',
        footerPunchline: 'Méně guessworku. Více lidskosti. Lepší rozhodnutí.',
      }
    : normalizedLocale === 'sk'
      ? {
          pageTitle: 'O nás',
          backLabel: 'Späť do aplikácie',
          heroEyebrow: 'About JobShaman',
          heroTitle: 'Trh práce je plný aktivity, ale takmer bez skutočného spojenia.',
          heroSubtitle:
            'Firmy dostávajú stovky životopisov, ale aj tak nevedia nájsť správnych ľudí. Ľudia posielajú desiatky reakcií a nedostávajú odpoveď. Problém nie je v nedostatku talentu. Problém je v tom, ako obe strany začínajú komunikáciu.',
          aboutTitle: 'About JobShaman',
          aboutBody: [
            'JobShaman vznikol z jednoduchého pozorovania: pracovný trh generuje obrovské množstvo aktivity, ale veľmi málo skutočného porozumenia.',
            'Namiesto posielania CV začína prvý kontakt konkrétnou situáciou — výzvou, ktorú firma reálne rieši. Kandidát nehovorí len čo robil, ale ukazuje, ako premýšľa a ako by začal.',
            'Tomu hovoríme handshake.',
            'Nad týmto momentom staviame ďalšiu vrstvu: rozhodovací systém, ktorý pomáha pochopiť, ako práca zapadne do reálneho života.',
          ],
          decisionLayerTitle: 'Decision Layer',
          decisionLayerBullets: [
            'čistá mzda po zdanení',
            'reálny dopad dochádzania',
            'Job Happiness Index',
            'kontext osobnej situácie',
          ],
          handshakeTitle: 'Handshake',
          handshakeBody: [
            'Handshake je náš spôsob, ako vrátiť do hiringu moment, ktorý kedysi vznikal prirodzene: človek príde, obe strany sa uvidia, rýchlo si vytvoria obraz a zistia, či má zmysel pokračovať.',
            'Online tento moment zmizol. Nahradili ho formuláre, CV a nekonečné rady bez spätnej väzby.',
            'Handshake ho vracia späť ako obmedzenú, ale reálnu interakciu. Firma ukáže problém. Kandidát ukáže svoj prístup. Obe strany sa môžu rozhodnúť, či má zmysel pokračovať ďalej.',
          ],
          buildingTitle: 'Čo tým vzniká',
          buildingIntro:
            'Výsledkom nie je len lepšie hľadanie práce, ale nový spôsob, akým sa ľudia rozhodujú o svojej kariére. JobShaman je career operating system, nie job board.',
          buildingFlowBefore: 'Namiesto modelu: apply → wait → interview → guess',
          buildingFlowAfter: 'Posúvame sa k: interact → try → understand → decide',
          manifestoTitle: 'Manifesto',
          manifestoSections: [
            {
              title: 'Práca nie je zoznam pozícií',
              body:
                'Súčasné platformy zobrazujú prácu ako katalóg. Roly, požiadavky, benefity. Ale práca nie je položka v zozname. Je to rozhodnutie, ktoré ovplyvňuje život.',
            },
            {
              title: 'CV nie je začiatok',
              body:
                'Životopis je retrospektíva. Ukazuje minulosť, ale takmer nič nehovorí o tom, ako človek premýšľa dnes. Preto väčšina hiringu začína zle.',
            },
            {
              title: 'Najlepší kandidáti urobia krok navyše',
              body:
                'Zavolajú. Napíšu konkrétnemu človeku. Prídu osobne. Ukážu záujem a prístup. To nie je hack systému. To je prirodzený spôsob, ako vzniká spolupráca. JobShaman dáva tento krok každému.',
            },
            {
              title: 'Handshake namiesto aplikácie',
              body:
                'Každá spolupráca by mala začať nie dokumentom, ale dialógom. Firma ukáže problém. Človek ukáže svoj prístup. Až potom dáva zmysel pokračovať.',
            },
            {
              title: 'Menej reakcií, lepšie výsledky',
              body:
                'Neoptimalizujeme počet klikov. Neoptimalizujeme počet CV. Optimalizujeme kvalitu konverzácií, relevanciu spojenia a reálne výsledky. Tri zmysluplné reakcie sú lepšie než sto bez odpovede.',
            },
            {
              title: 'Práca musí dávať zmysel v reálnom živote',
              body:
                'Mzda na papieri nestačí. Remote nestačí. Benefity nestačia. Dôležité je, koľko ti reálne zostane, koľko času ťa stojí dochádzanie a ako práca zapadne do tvojho života.',
            },
            {
              title: 'Technológia má vracať ľudskosť',
              body:
                'AI môže zrýchliť procesy. Nemala by však odstrániť človeka. Naopak. Má odstrániť šum, aby zostalo to dôležité: zmysluplný dialóg medzi ľuďmi.',
            },
            {
              title: 'Budujeme nový typ trhu práce',
              body:
                'Nie job board. Nie sociálnu sieť. Ale systém, kde práca začína problémom, kandidát začína prístupom a rozhodnutia vychádzajú z reality.',
            },
          ],
          careTitle: 'Prečo nám na tom záleží',
          careBody: [
            'Roky sme budovali systémy, produkty a operácie naprieč krajinami aj odvetviami. Videli sme, ako hiring naozaj funguje. A ako často zlyháva.',
            'Nie preto, že by ľudia boli zlí. Ale preto, že celý systém stojí na slabých signáloch.',
            'JobShaman je náš pokus to opraviť. Presnejšie povedané: nahradiť.',
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
          closingTitle: 'To je JobShaman',
          closingBody:
            'Challenge marketplace. Handshake hiring. Career OS. Skôr než sa človek upíše práci, mal by jej rozumieť. A ideálne ju aj zažiť.',
          footerPunchline: 'Menej guessworku. Viac ľudskosti. Lepšie rozhodnutia.',
        }
      : normalizedLocale === 'de'
        ? {
            pageTitle: 'Uber Uns',
            backLabel: 'Zuruck zur App',
            heroEyebrow: 'About JobShaman',
            heroTitle: 'Der Arbeitsmarkt ist voller Aktivitat, aber fast ohne echte Verbindung.',
            heroSubtitle:
              'Unternehmen erhalten Hunderte von Lebenslaufen und finden trotzdem nicht die richtigen Menschen. Menschen schicken Dutzende Bewerbungen und bekommen keine Antwort. Das Problem ist nicht fehlendes Talent. Das Problem ist, wie die Kommunikation beginnt.',
            aboutTitle: 'About JobShaman',
            aboutBody: [
              'JobShaman entstand aus einer einfachen Beobachtung: Der Arbeitsmarkt erzeugt enorme Aktivitat, aber sehr wenig echtes Verstandnis.',
              'Statt mit einem Lebenslauf zu starten, beginnt der erste Kontakt mit einer konkreten Situation — einer Aufgabe, die das Unternehmen tatsachlich losen muss. Der Kandidat sagt nicht nur, was er getan hat. Er zeigt, wie er denkt und wie er anfangen wurde.',
              'Das nennen wir Handshake.',
              'Auf diesem Moment bauen wir eine weitere Ebene auf: ein Entscheidungssystem, das Menschen hilft zu verstehen, wie Arbeit in ihr reales Leben passt.',
            ],
            decisionLayerTitle: 'Decision Layer',
            decisionLayerBullets: [
              'Nettoeinkommen nach Steuern',
              'reale Auswirkungen des Pendelns',
              'Job Happiness Index',
              'persoenlicher Lebenskontext',
            ],
            handshakeTitle: 'Handshake',
            handshakeBody: [
              'Der Handshake ist unser Weg, den Moment ins Hiring zuruckzubringen, der fruher ganz naturlich entstand: Menschen treffen sich, bekommen ein Gefuhl fureinander und verstehen schnell, ob es Sinn macht weiterzugehen.',
              'Online ist dieser Moment verschwunden. Er wurde durch Formulare, Lebenslaufe und endlose Warteschlangen ohne echte Interaktion ersetzt.',
              'Handshake bringt ihn als begrenzten, aber echten Austausch zuruck. Das Unternehmen zeigt das Problem. Der Kandidat zeigt seinen Ansatz. Beide Seiten konnen entscheiden, ob ein weiterer Schritt sinnvoll ist.',
            ],
            buildingTitle: 'Was daraus entsteht',
            buildingIntro:
              'Das Ergebnis ist nicht nur bessere Jobsuche, sondern eine neue Art, Karriereentscheidungen zu treffen. JobShaman ist ein Career Operating System, kein Job Board.',
            buildingFlowBefore: 'Statt: apply → wait → interview → guess',
            buildingFlowAfter: 'Wir gehen zu: interact → try → understand → decide',
            manifestoTitle: 'Manifest',
            manifestoSections: [
              {
                title: 'Arbeit ist keine Liste von Positionen',
                body:
                  'Die meisten Plattformen zeigen Arbeit wie einen Katalog: Rollen, Anforderungen, Benefits. Aber Arbeit ist kein Eintrag in einer Liste. Sie ist eine Entscheidung, die ein Leben pragt.',
              },
              {
                title: 'Der Lebenslauf ist nicht der Anfang',
                body:
                  'Ein Lebenslauf ist rückblickend. Er zeigt die Vergangenheit, sagt aber wenig daruber aus, wie jemand heute denkt. Deshalb beginnt so viel Hiring am falschen Punkt.',
              },
              {
                title: 'Die besten Kandidaten gehen immer einen Schritt weiter',
                body:
                  'Sie rufen an. Sie schreiben einer echten Person. Sie zeigen Initiative und Haltung. Das ist kein Hack. So beginnt Zusammenarbeit ganz naturlich. JobShaman gibt diesen Schritt allen.',
              },
              {
                title: 'Handshake statt Bewerbung',
                body:
                  'Jede Zusammenarbeit sollte nicht mit einem Dokument, sondern mit einem Dialog beginnen. Das Unternehmen zeigt das Problem. Die Person zeigt ihren Ansatz. Erst dann ergibt es Sinn weiterzumachen.',
              },
              {
                title: 'Weniger Reaktionen, bessere Ergebnisse',
                body:
                  'Wir optimieren nicht auf Klicks. Wir optimieren nicht auf Lebenslauf-Volumen. Wir optimieren auf Qualitat der Gesprache, Relevanz der Verbindung und echte Ergebnisse. Drei sinnvolle Reaktionen sind besser als hundert ignorierte.',
              },
              {
                title: 'Arbeit muss im echten Leben Sinn ergeben',
                body:
                  'Gehalt auf dem Papier reicht nicht. Remote reicht nicht. Benefits reichen nicht. Entscheidend ist, was real ubrig bleibt, wie viel Zeit Pendeln kostet und wie gut die Rolle in dein Leben passt.',
              },
              {
                title: 'Technologie sollte Menschlichkeit zuruckbringen',
                body:
                  'AI kann Prozesse beschleunigen. Sie sollte den Menschen aber nicht entfernen. Sie sollte das Rauschen entfernen, damit der sinnvolle Dialog zwischen Menschen wieder sichtbar wird.',
              },
              {
                title: 'Wir bauen eine neue Art von Arbeitsmarkt',
                body:
                  'Kein Job Board. Kein soziales Netzwerk. Sondern ein System, in dem Arbeit mit einem Problem beginnt, der Kandidat mit einem Ansatz startet und Entscheidungen aus der Realitat entstehen.',
              },
            ],
            careTitle: 'Warum uns das wichtig ist',
            careBody: [
              'Wir haben uber Jahre hinweg Systeme, Produkte und Operations in verschiedenen Landern und Branchen aufgebaut. Wir haben gesehen, wie Hiring wirklich funktioniert — und wie oft es scheitert.',
              'Nicht weil Menschen schlecht sind. Sondern weil das System auf schwachen Signalen basiert.',
              'JobShaman ist unser Versuch, das zu reparieren. Oder genauer: es zu ersetzen.',
            ],
            foundersTitle: 'Founders',
            founders: [
              {
                name: 'Misha Hlaváčů',
                role: 'Systems thinker. Builder. Doesn’t trust black boxes.',
                body:
                  'Misha entwirft und baut Systeme von Grund auf — von AI-driven Plattformen bis zu realen Operations. Er glaubt, dass die meiste Software Probleme nicht lost, sondern nur verdeckt. JobShaman ist sein Versuch, etwas zu bauen, das die Realitat wirklich abbildet.',
                initials: 'MH',
              },
              {
                name: 'Danijela Nandi',
                role: 'Product leader. Operator. Sees the whole system.',
                body:
                  'Danijela hat mehr als 15 Jahre digitale Produkte aufgebaut, Teams gefuhrt und Organisationen in Europa und den USA transformiert. Sie versteht, wie Entscheidungen getroffen werden — und wie oft sie falsch sind. JobShaman soll diese Entscheidungen klarer, schneller und menschlicher machen.',
                initials: 'DN',
              },
            ],
            closingTitle: 'Das ist JobShaman',
            closingBody:
              'Challenge marketplace. Handshake hiring. Career OS. Bevor man sich fur einen Job entscheidet, sollte man ihn verstehen. Und idealerweise sogar erleben.',
            footerPunchline: 'Weniger Guesswork. Mehr Menschlichkeit. Bessere Entscheidungen.',
          }
        : normalizedLocale === 'pl'
          ? {
              pageTitle: 'O Nas',
              backLabel: 'Powrot do aplikacji',
              heroEyebrow: 'About JobShaman',
              heroTitle: 'Rynek pracy jest pelen aktywnosci, ale prawie bez prawdziwego polaczenia.',
              heroSubtitle:
                'Firmy otrzymuja setki CV, a mimo to nie potrafia znalezc odpowiednich ludzi. Ludzie wysylaja dziesiatki aplikacji i nie dostaja odpowiedzi. Problemem nie jest brak talentu. Problemem jest to, jak obie strony zaczynaja rozmowe.',
              aboutTitle: 'About JobShaman',
              aboutBody: [
                'JobShaman powstal z prostej obserwacji: rynek pracy generuje ogromna aktywnosc, ale bardzo malo prawdziwego zrozumienia.',
                'Zamiast zaczynac od CV, pierwszy kontakt zaczyna sie od konkretnej sytuacji — wyzwania, ktore firma rzeczywiscie rozwiazuje. Kandydat nie tylko mowi, co robil. Pokazuje, jak mysli i jak by zaczal.',
                'To nazywamy handshake.',
                'Na tym momencie budujemy kolejna warstwe: system decyzyjny, ktory pomaga zrozumiec, jak praca wpisuje sie w realne zycie.',
              ],
              decisionLayerTitle: 'Decision Layer',
              decisionLayerBullets: [
                'wynagrodzenie netto po podatkach',
                'realny wplyw dojazdow',
                'Job Happiness Index',
                'kontekst zyciowy',
              ],
              handshakeTitle: 'Handshake',
              handshakeBody: [
                'Handshake to nasz sposob na przywrocenie do hiringu momentu, ktory kiedys pojawial sie naturalnie: ludzie spotykali sie, wyczuwali sie nawzajem i szybko rozumieli, czy warto isc dalej.',
                'Online ten moment zniknal. Zastapily go formularze, CV i nieskonczone kolejki bez prawdziwej interakcji.',
                'Handshake przywraca go jako ograniczona, ale realna wymiane. Firma pokazuje problem. Kandydat pokazuje swoje podejscie. Obie strony moga zdecydowac, czy warto kontynuowac.',
              ],
              buildingTitle: 'Co to tworzy',
              buildingIntro:
                'Rezultatem nie jest tylko lepsze szukanie pracy, ale nowy sposob podejmowania decyzji zawodowych. JobShaman to career operating system, a nie job board.',
              buildingFlowBefore: 'Zamiast: apply → wait → interview → guess',
              buildingFlowAfter: 'Przechodzimy do: interact → try → understand → decide',
              manifestoTitle: 'Manifest',
              manifestoSections: [
                {
                  title: 'Praca nie jest lista stanowisk',
                  body:
                    'Wiekszosc platform pokazuje prace jak katalog: role, wymagania, benefity. Ale praca nie jest pozycja na liscie. To decyzja, ktora wplywa na zycie.',
                },
                {
                  title: 'CV nie jest poczatkiem',
                  body:
                    'CV jest retrospektywne. Pokazuje przeszlosc, ale niewiele mowi o tym, jak dana osoba mysli dzisiaj. Dlatego tak wiele procesow hiringowych zaczyna sie zle.',
                },
                {
                  title: 'Najlepsi kandydaci robia jeden krok wiecej',
                  body:
                    'Dzwonia. Pisza do konkretnej osoby. Pokazuja intencje i podejscie. To nie jest hack. To naturalny sposob, w jaki zaczyna sie wspolpraca. JobShaman daje ten krok wszystkim.',
                },
                {
                  title: 'Handshake zamiast aplikacji',
                  body:
                    'Kazda wspolpraca powinna zaczynac sie nie od dokumentu, ale od dialogu. Firma pokazuje problem. Czlowiek pokazuje swoje podejscie. Dopiero potem ma sens isc dalej.',
                },
                {
                  title: 'Mniej reakcji, lepsze wyniki',
                  body:
                    'Nie optymalizujemy klikniec. Nie optymalizujemy liczby CV. Optymalizujemy jakosc rozmow, trafnosc polaczen i realne rezultaty. Trzy sensowne reakcje sa lepsze niz sto zignorowanych.',
                },
                {
                  title: 'Praca musi miec sens w prawdziwym zyciu',
                  body:
                    'Pensja na papierze nie wystarcza. Remote nie wystarcza. Benefity nie wystarczaja. Liczy sie to, ile realnie zostaje, ile czasu kosztuja dojazdy i jak rola pasuje do zycia.',
                },
                {
                  title: 'Technologia powinna przywracac ludzkosc',
                  body:
                    'AI moze przyspieszac procesy. Nie powinna usuwac czlowieka. Powinna usuwac szum, aby znowu bylo widac sensowny dialog miedzy ludzmi.',
                },
                {
                  title: 'Budujemy nowy typ rynku pracy',
                  body:
                    'Nie job board. Nie social network. Ale system, w ktorym praca zaczyna sie od problemu, kandydat zaczyna od podejscia, a decyzje wynikaja z rzeczywistosci.',
                },
              ],
              careTitle: 'Dlaczego nam na tym zalezy',
              careBody: [
                'Przez lata budowalismy systemy, produkty i operacje w roznych krajach i branzach. Widzielismy, jak hiring dziala naprawde — i jak czesto zawodzi.',
                'Nie dlatego, ze ludzie sa zli. Ale dlatego, ze caly system opiera sie na slabych sygnalach.',
                'JobShaman to nasza proba, by to naprawic. A dokladniej: zastapic.',
              ],
              foundersTitle: 'Founders',
              founders: [
                {
                  name: 'Misha Hlaváčů',
                  role: 'Systems thinker. Builder. Doesn’t trust black boxes.',
                  body:
                    'Misha projektuje i buduje systemy od podstaw — od platform AI-driven po realne operacje. Wierzy, ze wiekszosc oprogramowania nie rozwiazuje problemow, tylko je ukrywa. JobShaman to jego proba zbudowania czegos, co naprawde odzwierciedla rzeczywistosc.',
                  initials: 'MH',
                },
                {
                  name: 'Danijela Nandi',
                  role: 'Product leader. Operator. Sees the whole system.',
                  body:
                    'Danijela ma ponad 15 lat doswiadczenia w budowaniu produktow cyfrowych, prowadzeniu zespolow i transformacji organizacji w Europie i USA. Rozumie, jak podejmowane sa decyzje — i jak czesto sa bledne. JobShaman ma sprawiac, ze te decyzje beda jasniejsze, szybsze i bardziej ludzkie.',
                  initials: 'DN',
                },
              ],
              closingTitle: 'To jest JobShaman',
              closingBody:
                'Challenge marketplace. Handshake hiring. Career OS. Zanim ktos zdecyduje sie na prace, powinien ja zrozumiec. A idealnie takze jej doswiadczyc.',
              footerPunchline: 'Mniej guessworku. Wiecej ludzkosci. Lepsze decyzje.',
            }
          : {
        pageTitle: 'About Us',
        backLabel: 'Back to app',
        heroEyebrow: 'About JobShaman',
        heroTitle: 'The job market is full of activity, but almost no real connection.',
        heroSubtitle:
          'Companies receive hundreds of CVs but still struggle to find the right people. People send dozens of applications and hear nothing back. The problem is not a lack of talent. The problem is how the conversation starts.',
        aboutTitle: 'About JobShaman',
        aboutBody: [
          'JobShaman started from a simple observation: the labor market generates enormous activity, but very little actual understanding.',
          'Instead of starting with a CV, the first interaction begins with a real situation — a challenge the company is actually solving. The candidate does not just say what they did. They show how they think and how they would begin.',
          'We call that the handshake.',
          'On top of that moment, we build another layer: a decision system that helps people understand how work fits into real life.',
        ],
        decisionLayerTitle: 'Decision Layer',
        decisionLayerBullets: [
          'net income after tax',
          'real commuting impact',
          'Job Happiness Index',
          'personal life context',
        ],
        handshakeTitle: 'Handshake',
        handshakeBody: [
          'The handshake is our way of bringing back the moment that used to happen naturally in hiring: people meet, get a feel for each other, and quickly understand whether it makes sense to continue.',
          'Online, that moment disappeared. It was replaced by forms, CVs, and endless queues without real interaction.',
          'Handshake restores it as a limited but real exchange. The company shows the problem. The candidate shows their approach. Both sides can decide whether moving forward actually makes sense.',
        ],
        buildingTitle: 'What this creates',
        buildingIntro:
          'The result is not just better job search. It is a new way to make career decisions. JobShaman is a career operating system, not a job board.',
        buildingFlowBefore: 'Instead of: apply → wait → interview → guess',
        buildingFlowAfter: 'We move to: interact → try → understand → decide',
        manifestoTitle: 'Manifesto',
        manifestoSections: [
          {
            title: 'Work is not a list of positions',
            body:
              'Most platforms present work as a catalog: roles, requirements, benefits. But work is not a line item. It is a decision that shapes a life.',
          },
          {
            title: 'The CV is not the beginning',
            body:
              'A CV is retrospective. It shows the past, but says very little about how a person thinks today. That is why so much hiring starts from the wrong place.',
          },
          {
            title: 'The best candidates always take one extra step',
            body:
              'They call. They write to a real person. They show up. They show intent and approach. That is not a hack. That is how collaboration naturally begins. JobShaman gives that step to everyone.',
          },
          {
            title: 'Handshake instead of application',
            body:
              'Every collaboration should start not with a document, but with dialogue. The company shows the problem. The person shows their approach. Only then does it make sense to continue.',
          },
          {
            title: 'Fewer reactions, better outcomes',
            body:
              'We do not optimize for clicks. We do not optimize for CV volume. We optimize for conversation quality, connection relevance, and real outcomes. Three meaningful reactions are better than one hundred ignored ones.',
          },
          {
            title: 'Work has to make sense in real life',
            body:
              'Salary on paper is not enough. Remote is not enough. Benefits are not enough. What matters is what stays in your pocket, how much time commuting costs, and how the role actually fits your life.',
          },
          {
            title: 'Technology should restore humanity',
            body:
              'AI can speed up processes. But it should not remove the human. It should remove the noise so the meaningful dialogue between people becomes visible again.',
          },
          {
            title: 'We are building a new kind of labor market',
            body:
              'Not a job board. Not a social network. A system where work starts with a problem, the candidate starts with an approach, and decisions come from reality.',
          },
        ],
        careTitle: 'Why we care',
        careBody: [
          'We have spent years building systems, products, and operations across countries and industries. We have seen how hiring actually works and how often it fails.',
          'Not because people are bad. But because the system is built on weak signals.',
          'JobShaman is our attempt to fix that. Or more precisely: replace it.',
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
        closingTitle: 'This is JobShaman',
        closingBody:
          'Challenge marketplace. Handshake hiring. Career OS. Before you commit to a job, you should be able to understand it — and ideally, experience it.',
        footerPunchline: 'Less guesswork. More humanity. Better decisions.',
      };

  return (
    <LegalPage
      title={copy.pageTitle}
      icon={Leaf}
      backLabel={copy.backLabel}
      backLink={backLink}
      widthClassName="max-w-6xl"
    >
      <div className="space-y-14 text-slate-700 dark:text-slate-200">
        <section className="border-b border-slate-200 pb-10 dark:border-slate-800">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.heroEyebrow}
          </div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-end">
            <div>
              <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-slate-900 dark:text-white sm:text-5xl">
                {copy.heroTitle}
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                {copy.heroSubtitle}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                JobShaman
              </div>
              <p className="mt-3 text-base leading-8 text-slate-700 dark:text-slate-200">
                {copy.footerPunchline}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {copy.aboutTitle}
          </div>
          <div className="space-y-5">
            {copy.aboutBody.map((paragraph) => (
              <p key={paragraph} className="max-w-3xl text-base leading-8">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {copy.decisionLayerTitle}
          </div>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {copy.decisionLayerBullets.map((bullet) => (
                <div key={bullet} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {copy.buildingTitle}
          </div>
          <div className="space-y-6">
            <p className="max-w-3xl text-base leading-8">{copy.buildingIntro}</p>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Handshake className="h-4 w-4 text-[var(--accent)]" />
                JobShaman flow
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  {copy.buildingFlowBefore}
                </div>
                <div className="rounded-2xl border border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.08)] px-4 py-4 text-sm leading-7 text-slate-900 dark:text-slate-100">
                  {copy.buildingFlowAfter}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {copy.handshakeTitle}
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-5">
              {copy.handshakeBody.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className={index === 0 ? 'text-lg leading-8 text-slate-900 dark:text-white' : 'text-base leading-8'}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {copy.manifestoTitle}
          </div>
          <div className="space-y-5">
            {copy.manifestoSections.map((item) => (
              <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-3 max-w-3xl text-base leading-8 text-slate-700 dark:text-slate-300">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {copy.careTitle}
          </div>
          <div className="space-y-5">
            {copy.careBody.map((paragraph) => (
              <p key={paragraph} className="max-w-3xl text-base leading-8">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <Users2 className="h-4 w-4" />
            {copy.foundersTitle}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {copy.founders.map((founder) => (
              <article key={founder.name} className="rounded-[1.5rem] border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    {founder.initials}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">{founder.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{founder.role}</p>
                  </div>
                </div>
                <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{founder.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-8 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-white">{copy.closingTitle}</h3>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700 dark:text-slate-200">{copy.closingBody}</p>
          <div className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
            {copy.footerPunchline}
          </div>
        </section>
      </div>
    </LegalPage>
  );
};

export default AboutUsPage;
