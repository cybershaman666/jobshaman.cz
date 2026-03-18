export type ChallengeUiLanguage = 'cs' | 'sk' | 'de' | 'at' | 'pl' | 'en';

const normalizeLanguage = (language: string): ChallengeUiLanguage => {
  const normalized = String(language || 'en').split('-')[0].toLowerCase();
  if (normalized === 'at') return 'at';
  if (normalized === 'cs' || normalized === 'sk' || normalized === 'de' || normalized === 'pl') {
    return normalized;
  }
  return 'en';
};

type ChallengeDetailPageCopy = {
  back: string;
  badgeImported: string;
  badgeMicro: string;
  badgeNative: string;
  insideTitle: string;
  culture: string;
  mission: string;
  missionBody: string;
  firstStep: string;
  risk: string;
  team: string;
  publisher: string;
  responders: string;
  trust: string;
  trustDialogues: string;
  trustResponse: string;
  trustResponseUnderHour: string;
  companySignal: string;
  companyFallback: string;
  companyPeopleFallback: string;
  companyButton: string;
  importedButton: string;
  handshakeCta: string;
  companyCta: string;
  sideTitle: string;
  realityTitle: string;
  salary: string;
  workModel: string;
  location: string;
  compatibility: string;
  salaryMissing: string;
  locationMissing: string;
  workModelMissing: string;
  financialTitle: string;
  financialBody: string;
  remoteReality: string;
  jhiImpact: string;
  dailyTime: string;
  gross: string;
  net: string;
  benefits: string;
  commute: string;
  oneWay: string;
  realValue: string;
  financialFormula: string;
  loginPrompt: string;
  signInCreate: string;
  addressPrompt: string;
  openProfile: string;
  financialNoteTitle: string;
  financialNoteBody: string;
  handshakeTitle: string;
  handshakeBody: string;
  teamFallbackRole: string;
  importedDetail: string;
  importedSnapshot: string;
  jhiTitle: string;
  jhiTopSignals: string;
  jhiDimensionFinancial: string;
  jhiDimensionTimeCost: string;
  jhiDimensionMentalLoad: string;
  jhiDimensionGrowth: string;
  jhiDimensionValues: string;
  aiWandTitle: string;
  aiWandSummary: string;
  jhiGood: string;
  jhiMixed: string;
  jhiLow: string;
  verdictGo: string;
  verdictMaybe: string;
  verdictNo: string;
  verdictGoBody: string;
  verdictMaybeBody: string;
  verdictNoBody: string;
  verdictTitle: string;
  takeHome: string;
  commuteTime: string;
  commuteCost: string;
  bullshitTitle: string;
  currentLocation: string;
  unknownTime: string;
  unknownCost: string;
  zeroCost: string;
  heroLeadImported: string;
  heroLeadNative: string;
  match: string;
  matchUpper: string;
  response: string;
  importedContinue: string;
  importedReality: string;
  roleDetailUnavailable: string;
  rawImportNote: string;
  benefitsReserve: string;
  bullshitSmells: string;
  bullshitWatch: string;
  greenTitle: string;
  greenSubtitle: string;
};

type ChallengeFocusCopy = {
  back: string;
  eyebrow: string;
  body: string;
  reality: string;
  decision: string;
  importedDecision: string;
  company: string;
  quickInsights: string;
  challenge: string;
  risk: string;
  question: string;
  importedQuestion: string;
  fit: string;
  jhiTitle: string;
  jhiBody: string;
  jhiTopSignals: string;
  jhiDimensionFinancial: string;
  jhiDimensionTimeCost: string;
  jhiDimensionMentalLoad: string;
  jhiDimensionGrowth: string;
  jhiDimensionValues: string;
  salary: string;
  workModel: string;
  location: string;
  source: string;
  openListing: string;
  openCompany: string;
  openContext: string;
  importedSnapshot: string;
  importedNextStepTitle: string;
  importedNextStepBody: string;
  importedSupportTitle: string;
  importedSupportBody: string;
  importedPrepareContext: string;
  importedRealityTitle: string;
  importedRealityBody: string;
  importedHandshakeHintTitle: string;
  importedHandshakeHintBody: string;
  financialTitle: string;
  financialBody: string;
  financialFormula: string;
  loginPrompt: string;
  addressPrompt: string;
  openProfile: string;
  gross: string;
  net: string;
  benefits: string;
  commute: string;
  commuteDistance: string;
  realValue: string;
  jhiImpact: string;
  oneWay: string;
  dailyTime: string;
  marketMedian: string;
  marketDelta: string;
  benefitsList: string;
  realIncome: string;
  compatibility: string;
  originalListing: string;
  originalBody: string;
  noDescription: string;
  companySignal: string;
  importedNote: string;
  importedActionTitle: string;
  importedActionBody: string;
  importedActionCta: string;
  remoteReality: string;
  moreCompany: string;
  moreOriginal: string;
  firstContactGuideTitle: string;
  firstContactGuideBody: string;
  firstContactGuidePointOne: string;
  firstContactGuidePointTwo: string;
  firstContactGuidePointThree: string;
  firstContactGuideDismiss: string;
  firstContactGuideContext: string;
  publisherLabel: string;
  respondersLabel: string;
  teamTrustLabel: string;
  trustDialogues: string;
  trustResponse: string;
  trustResponseUnderHour: string;
  humanContextFallbackRole: string;
  currentLocation: string;
  salaryMissing: string;
  locationMissing: string;
  companyMissing: string;
  addAddress: string;
  afterSignIn: string;
  signInCreate: string;
  defaultCurrency: string;
  nativeHeroLead: string;
  importedHeroLead: string;
};

type MicroJobCopy = {
  badge: string;
  budget: string;
  type: string;
  timeEstimate: string;
  collaboration: string;
  longTermPotential: string;
  financialNoteTitle: string;
  financialNoteBody: string;
};

const detailPageEn: ChallengeDetailPageCopy = {
  back: 'Back to marketplace',
  badgeImported: 'Imported role',
  badgeMicro: 'Mini challenge',
  badgeNative: 'Company mission',
  insideTitle: 'Inside the company',
  culture: 'Team atmosphere',
  mission: 'What you would solve here',
  missionBody: 'A quick read of the situation and the people around it.',
  firstStep: 'First move',
  risk: 'Watch-out',
  team: 'People behind this',
  publisher: 'Who published it',
  responders: 'Who usually replies',
  trust: 'How alive the team feels',
  trustDialogues: '{{count}} active dialogues in 90 days',
  trustResponse: 'First response around {{hours}} h',
  trustResponseUnderHour: 'First response within an hour',
  companySignal: 'How the company feels',
  companyFallback: 'This team is not looking for a perfect PDF. It is looking for someone who reads the situation quickly and shows a healthy first move.',
  companyPeopleFallback: 'The team has no public faces yet, but this detail is already shaped around human context and a direct reply.',
  companyButton: 'Open company',
  importedButton: 'Open original listing',
  handshakeCta: 'Handshake',
  companyCta: 'Enter company',
  sideTitle: 'Enter the company',
  realityTitle: 'Work reality',
  salary: 'Salary',
  workModel: 'Mode',
  location: 'Location',
  compatibility: 'JHI',
  salaryMissing: 'Salary not specified',
  locationMissing: 'Location not specified',
  workModelMissing: 'Mode not specified',
  financialTitle: 'Finance and commute',
  financialBody: 'What this role looks like once time and commute costs are counted in.',
  remoteReality: 'Remote roles save both time and commute cost.',
  jhiImpact: 'JHI impact',
  dailyTime: 'Daily travel time',
  gross: 'Gross salary',
  net: 'Net base',
  benefits: 'Benefits',
  commute: 'Commute',
  oneWay: 'One way',
  realValue: 'Real value',
  financialFormula: '{{net}} + {{benefits}} − {{commute}} = {{total}}',
  loginPrompt: 'Sign in and we will compute the real value of this role for your profile.',
  signInCreate: 'Sign in',
  addressPrompt: 'Add your address or coordinates to compute commute reality.',
  openProfile: 'Open profile',
  financialNoteTitle: 'Mini challenge budget',
  financialNoteBody: 'For mini challenges, pace, clarity of scope, and speed of agreement matter more than a classic salary calculator.',
  handshakeTitle: 'Digital handshake',
  handshakeBody: 'Instead of a tired “I’m interested,” show how you would actually get your hands on the situation.',
  teamFallbackRole: 'Team',
  importedDetail: 'Listing breakdown',
  importedSnapshot: 'What actually comes through',
  jhiTitle: 'Job Happiness Index',
  jhiTopSignals: 'Strongest pillars',
  jhiDimensionFinancial: 'Financial reality',
  jhiDimensionTimeCost: 'Time and mode',
  jhiDimensionMentalLoad: 'Mental load',
  jhiDimensionGrowth: 'Growth',
  jhiDimensionValues: 'Values fit',
  aiWandTitle: 'Reality check',
  aiWandSummary: 'Short version: you take home {{takeHome}}, spend {{time}} and {{cost}} on the road daily, and the JHI looks {{jhi}}.',
  jhiGood: 'comfortably high',
  jhiMixed: 'mixed',
  jhiLow: 'out of sync with your profile',
  verdictGo: 'Yep, I’d go in',
  verdictMaybe: 'Look twice',
  verdictNo: 'I’d skip this one',
  verdictGoBody: 'For your profile, this actually looks solid. If the work itself clicks, send the handshake.',
  verdictMaybeBody: 'Some things fit, some things stink. Only send the handshake if the team or mission really pulls you in.',
  verdictNoBody: 'This will probably eat too much time, money, or sanity. Without a very strong reason, I’d skip it.',
  verdictTitle: 'Worth it or trap?',
  takeHome: 'Take home',
  commuteTime: 'Travel time',
  commuteCost: 'Travel cost',
  bullshitTitle: 'Bullshit detector',
  currentLocation: 'Your current location',
  unknownTime: 'unknown time',
  unknownCost: 'unknown cost',
  zeroCost: '0',
  heroLeadImported: 'What this role really is and whether it deserves your time.',
  heroLeadNative: 'Who you meet, what you solve, and whether it is worth stepping in.',
  match: 'match',
  matchUpper: 'MATCH',
  response: 'Apply',
  importedContinue: 'Imported roles continue on the original listing.',
  importedReality: 'You pressure-test the reality here. The actual apply happens on the source portal.',
  roleDetailUnavailable: 'The role detail is not available yet.',
  rawImportNote: 'This is the raw import. No polish, no company perfume. If the listing is stuffed with fluff, it shows fast here.',
  benefitsReserve: 'We treat perks with caution. Dog-friendly office on a remote role is not a flex. It is just noise.',
  bullshitSmells: 'Smells off',
  bullshitWatch: 'Watch the fluff',
  greenTitle: 'AI also sees the good parts',
  greenSubtitle: 'Concrete signs of a fairly described role',
};

const detailPageCs: ChallengeDetailPageCopy = {
  ...detailPageEn,
  back: 'Zpět na marketplace',
  badgeImported: 'Importovaná role',
  badgeMicro: 'Mini výzva',
  badgeNative: 'Firemní mise',
  insideTitle: 'Uvnitř firmy',
  culture: 'Atmosféra týmu',
  mission: 'Co tu budeš řešit',
  missionBody: 'Rychlý vstup do situace a lidí kolem ní.',
  firstStep: 'První krok',
  risk: 'Na co si dát pozor',
  team: 'Lidé, kteří za tím stojí',
  publisher: 'Kdo výzvu zveřejnil',
  responders: 'Kdo typicky odpovídá',
  trust: 'Jak živě tým komunikuje',
  trustDialogues: '{{count}} aktivních dialogů za 90 dní',
  trustResponse: 'První reakce kolem {{hours}} h',
  trustResponseUnderHour: 'První reakce do hodiny',
  companySignal: 'Jak firma působí',
  companyFallback: 'Tým tu nehledá perfektní PDF. Hledá člověka, který rychle pochopí situaci a ukáže zdravý první krok.',
  companyPeopleFallback: 'Tým je zatím bez veřejných profilů, ale detail už je připravený na lidský kontext i přímou reakci.',
  companyButton: 'Otevřít firmu',
  importedButton: 'Otevřít původní listing',
  handshakeCta: 'Podat ruku',
  companyCta: 'Vejít do firmy',
  sideTitle: 'Vstup do firmy',
  realityTitle: 'Pracovní realita',
  salary: 'Mzda',
  workModel: 'Režim',
  location: 'Místo',
  salaryMissing: 'Mzda neuvedena',
  locationMissing: 'Lokalita neuvedena',
  workModelMissing: 'Režim neuveden',
  financialTitle: 'Peníze a realita kolem',
  financialBody: 'Jak tahle role vypadá po odečtení času a nákladů na přesun.',
  remoteReality: 'Remote role šetří čas i dojezd.',
  jhiImpact: 'Dopad do JHI',
  dailyTime: 'Denně na cestě',
  gross: 'Hrubá mzda',
  net: 'Čistý základ',
  benefits: 'Papírové benefity',
  commute: 'Dojíždění',
  oneWay: 'Jedna cesta',
  realValue: 'Reálná hodnota',
  loginPrompt: 'Přihlas se a spočítáme reálnou hodnotu role podle tvého profilu.',
  signInCreate: 'Přihlásit se',
  addressPrompt: 'Doplň adresu nebo souřadnice v profilu, ať spočítáme realitu dojezdu.',
  openProfile: 'Otevřít profil',
  financialNoteTitle: 'Rozpočet mini výzvy',
  financialNoteBody: 'U mini výzev je důležitější tempo, jasný rozsah a rychlost domluvy než klasická mzdová kalkulačka.',
  handshakeTitle: 'Digitální podání ruky',
  handshakeBody: 'Místo unaveného „mám zájem“ ukaž, jak bys to reálně vzal(a) do ruky.',
  teamFallbackRole: 'Tým',
  importedDetail: 'Rozebraný inzerát',
  importedSnapshot: 'Co z toho fakt leze',
  jhiTopSignals: 'Nejsilnější osy',
  jhiDimensionFinancial: 'Finance',
  jhiDimensionTimeCost: 'Čas a režim',
  jhiDimensionMentalLoad: 'Mentální zátěž',
  jhiDimensionGrowth: 'Růst',
  jhiDimensionValues: 'Hodnotový fit',
  aiWandTitle: 'Detektor reality',
  aiWandSummary: 'Když to zkrátíme: domů si odneseš {{takeHome}}, denně necháš na cestě {{time}} a {{cost}}, a JHI je {{jhi}}.',
  jhiGood: 'příjemně vysoko',
  jhiMixed: 'spíš napůl',
  jhiLow: 'spíš mimo tvoji realitu',
  verdictGo: 'Jo, sem bych šel',
  verdictMaybe: 'Tady zpozorni',
  verdictNo: 'Tuhle bych vynechal',
  verdictGoBody: 'Na tvůj profil to vychází podezřele dobře. Jestli tě bere i samotná práce, handshake sem klidně pošli.',
  verdictMaybeBody: 'Něco sedí, něco smrdí. Handshake jen když tě fakt táhne tým nebo obsah práce.',
  verdictNoBody: 'Tohle ti spíš vysaje čas, peníze nebo nervy. Bez extra silného důvodu bych to nechal být.',
  verdictTitle: 'Má to cenu, nebo je to past?',
  takeHome: 'Domů',
  commuteTime: 'Čas na cestě',
  commuteCost: 'Cena cesty',
  bullshitTitle: 'Bullshit detektor',
  currentLocation: 'Vaše aktuální poloha',
  unknownTime: 'neznámý čas',
  unknownCost: 'neznámé náklady',
  zeroCost: '0 Kč',
  heroLeadImported: 'Co je to za roli a jestli má cenu jí věnovat čas.',
  heroLeadNative: 'Koho potkáš, co budeš řešit a jestli do toho vůbec vstoupit.',
  match: 'shoda',
  matchUpper: 'SHODA',
  response: 'Odpověď',
  importedContinue: 'Na importovanou roli pokračuješ do původního inzerátu.',
  importedReality: 'Tady si prosiješ realitu. Reálná odpověď pak letí přes zdrojový portál.',
  roleDetailUnavailable: 'Detail nabídky zatím není dostupný.',
  rawImportNote: 'Tohle je syrový import. Bez laku, bez firemního parfému. Když je inzerát nafouknutý vatou, tady to uvidíš rychle.',
  benefitsReserve: 'Benefity bereme s rezervou. Dog-friendly office u remote role fakt není flex, ale jen další PR mlha.',
  bullshitSmells: 'Smrdí to',
  bullshitWatch: 'Pozor na vatu',
  greenTitle: 'AI vidí i to dobré',
  greenSubtitle: 'Konkrétní signály férově popsané role',
};

const detailPageSk: ChallengeDetailPageCopy = {
  ...detailPageEn,
  back: 'Späť na marketplace',
  badgeImported: 'Importovaná rola',
  badgeMicro: 'Mini výzva',
  badgeNative: 'Firemná misia',
  insideTitle: 'Vo vnútri firmy',
  culture: 'Atmosféra tímu',
  mission: 'Čo tu budeš riešiť',
  missionBody: 'Rýchly vstup do situácie a ľudí okolo nej.',
  firstStep: 'Prvý krok',
  risk: 'Na čo si dať pozor',
  team: 'Ľudia, ktorí za tým stoja',
  publisher: 'Kto výzvu zverejnil',
  responders: 'Kto typicky odpovedá',
  trust: 'Ako živo tím komunikuje',
  trustDialogues: '{{count}} aktívnych dialógov za 90 dní',
  trustResponse: 'Prvá reakcia okolo {{hours}} h',
  trustResponseUnderHour: 'Prvá reakcia do hodiny',
  companySignal: 'Ako firma pôsobí',
  companyFallback: 'Tím tu nehľadá perfektné PDF. Hľadá človeka, ktorý rýchlo pochopí situáciu a ukáže zdravý prvý krok.',
  companyPeopleFallback: 'Tím je zatiaľ bez verejných profilov, ale detail je už pripravený na ľudský kontext aj priamu reakciu.',
  companyButton: 'Otvoriť firmu',
  importedButton: 'Otvoriť pôvodný listing',
  handshakeCta: 'Podať ruku',
  companyCta: 'Vstúpiť do firmy',
  sideTitle: 'Vstup do firmy',
  realityTitle: 'Pracovná realita',
  salary: 'Mzda',
  workModel: 'Režim',
  location: 'Miesto',
  salaryMissing: 'Mzda neuvedená',
  locationMissing: 'Lokalita neuvedená',
  workModelMissing: 'Režim neuvedený',
  financialTitle: 'Peniaze a otrava okolo',
  financialBody: 'Ako táto rola vyzerá po odpočítaní času a nákladov na presun.',
  remoteReality: 'Remote rola šetrí čas aj dochádzanie.',
  jhiImpact: 'Dopad do JHI',
  dailyTime: 'Denne na ceste',
  gross: 'Hrubá mzda',
  net: 'Čistý základ',
  benefits: 'Papierové benefity',
  commute: 'Dochádzanie',
  oneWay: 'Jedna cesta',
  realValue: 'Reálna hodnota',
  loginPrompt: 'Prihlás sa a spočítame reálnu hodnotu role podľa tvojho profilu.',
  signInCreate: 'Prihlásiť sa',
  addressPrompt: 'Doplň adresu alebo súradnice v profile, nech spočítame realitu dochádzania.',
  openProfile: 'Otvoriť profil',
  financialNoteTitle: 'Rozpočet mini výzvy',
  financialNoteBody: 'Pri mini výzvach je dôležitejšie tempo, jasný rozsah a rýchlosť dohody než klasická mzdová kalkulačka.',
  handshakeTitle: 'Digitálne podanie ruky',
  handshakeBody: 'Namiesto unaveného „mám záujem“ ukáž, ako by si to reálne zobral(a) do rúk.',
  teamFallbackRole: 'Tím',
  importedDetail: 'Rozobratý inzerát',
  importedSnapshot: 'Čo z toho fakt lezie',
  jhiTopSignals: 'Najsilnejšie osi',
  jhiDimensionFinancial: 'Financie',
  jhiDimensionTimeCost: 'Čas a režim',
  jhiDimensionMentalLoad: 'Mentálna záťaž',
  jhiDimensionGrowth: 'Rast',
  jhiDimensionValues: 'Hodnotový fit',
  aiWandTitle: 'Detektor reality',
  aiWandSummary: 'Keď to skrátime: domov si odnesieš {{takeHome}}, denne necháš na ceste {{time}} a {{cost}}, a JHI je {{jhi}}.',
  jhiGood: 'príjemne vysoko',
  jhiMixed: 'skôr napoly',
  jhiLow: 'skôr mimo tvojej reality',
  verdictGo: 'Jo, sem by som šiel',
  verdictMaybe: 'Tu brzdím',
  verdictNo: 'Toto neber',
  verdictGoBody: 'Rola má proti tvojmu profilu dosť dobrý pomer reality a potenciálu. Ak ťa baví aj samotná práca, handshake dáva zmysel.',
  verdictMaybeBody: 'Niečo tu sedí, ale realita nie je úplne čistá. Handshake urob len keď ťa naozaj zaujíma tím alebo obsah práce.',
  verdictNoBody: 'Táto rola ti pravdepodobne spáli príliš veľa času, peňazí alebo energie. Bez silného dôvodu by som handshake skôr neposielal.',
  verdictTitle: 'Má to cenu, alebo je to pasca?',
  takeHome: 'Domov',
  commuteTime: 'Čas na ceste',
  commuteCost: 'Cena cesty',
  bullshitTitle: 'Bullshit detektor',
  currentLocation: 'Vaša aktuálna poloha',
  unknownTime: 'neznámy čas',
  unknownCost: 'neznáme náklady',
  zeroCost: '0 €',
  heroLeadImported: 'Čo je to za rolu a či jej má zmysel venovať čas.',
  heroLeadNative: 'Koho stretneš, čo budeš riešiť a či sa do toho vôbec oplatí vstúpiť.',
  match: 'zhoda',
  matchUpper: 'ZHODA',
  response: 'Odpoveď',
  importedContinue: 'Na importovanú rolu pokračuješ do pôvodného inzerátu.',
  importedReality: 'Tu si overíš realitu. Odpoveď pošleš na zdrojovom portáli.',
  roleDetailUnavailable: 'Detail ponuky zatiaľ nie je dostupný.',
  rawImportNote: 'Toto je surový import. Bez prikrášlenia, bez firemného parfumu. Keď je inzerát plný vatových benefitov, tu to uvidíš rýchlejšie.',
  benefitsReserve: 'Benefity berieme s rezervou. Keď inzerát sľubuje dog-friendly office pri remote role, body za realitu tým fakt nezíska.',
  bullshitSmells: 'Smrdí to',
  bullshitWatch: 'Pozor na vatu',
  greenTitle: 'AI vidí aj to dobré',
  greenSubtitle: 'Konkrétne signály férovo popísanej roly',
};

const detailPageDe: ChallengeDetailPageCopy = {
  ...detailPageEn,
  back: 'Zurück zum Marketplace',
  badgeImported: 'Importierte Rolle',
  badgeMicro: 'Mini-Challenge',
  badgeNative: 'Unternehmensmission',
  insideTitle: 'Im Unternehmen',
  mission: 'Woran du hier arbeitest',
  firstStep: 'Erster Schritt',
  risk: 'Worauf du achten solltest',
  team: 'Menschen dahinter',
  publisher: 'Wer die Aufgabe veröffentlicht hat',
  responders: 'Wer typischerweise antwortet',
  trust: 'Wie lebendig das Team kommuniziert',
  companySignal: 'Wie die Firma wirkt',
  companyButton: 'Firma öffnen',
  importedButton: 'Originalanzeige öffnen',
  handshakeCta: 'Handshake senden',
  companyCta: 'Zur Firma gehen',
  sideTitle: 'Ins Unternehmen',
  realityTitle: 'Arbeitsrealität',
  workModel: 'Modell',
  financialTitle: 'Geld und Realität',
  remoteReality: 'Remote spart Zeit und Pendeln.',
  signInCreate: 'Anmelden',
  handshakeTitle: 'Digitaler Handshake',
  importedDetail: 'Zerlegte Anzeige',
  importedSnapshot: 'Was wirklich durchscheint',
  aiWandTitle: 'Realitätscheck',
  verdictMaybe: 'Hier genauer hinschauen',
  takeHome: 'Netto übrig',
  commuteTime: 'Zeit auf dem Weg',
  commuteCost: 'Pendelpreis',
  bullshitTitle: 'Bullshit-Detektor',
  heroLeadImported: 'Was das für eine Rolle ist und ob sie deine Zeit verdient.',
  heroLeadNative: 'Wen du triffst, was du löst und ob du überhaupt einsteigen solltest.',
  response: 'Antwort',
  importedContinue: 'Bei importierten Rollen gehst du über die Originalanzeige weiter.',
  importedReality: 'Hier prüfst du die Realität. Die echte Bewerbung läuft über das Quellportal.',
  rawImportNote: 'Das ist ein roher Import. Ohne Lack, ohne Firmenparfum. Wenn die Anzeige mit Floskeln aufgeblasen ist, merkst du es hier schnell.',
  benefitsReserve: 'Benefits lesen wir mit Vorsicht. Dog-friendly office bei einer Remote-Rolle ist kein echter Pluspunkt.',
  bullshitSmells: 'Riecht komisch',
  bullshitWatch: 'Vorsicht vor Floskeln',
  greenTitle: 'AI sieht auch das Gute',
  greenSubtitle: 'Konkrete Signale einer fair beschriebenen Rolle',
};

const detailPagePl: ChallengeDetailPageCopy = {
  ...detailPageEn,
  back: 'Powrót do marketplace',
  badgeImported: 'Importowana rola',
  badgeMicro: 'Mini wyzwanie',
  badgeNative: 'Misja firmy',
  insideTitle: 'W środku firmy',
  mission: 'Co będziesz tu rozwiązywać',
  firstStep: 'Pierwszy krok',
  risk: 'Na co uważać',
  team: 'Ludzie za tym stojący',
  publisher: 'Kto opublikował wyzwanie',
  responders: 'Kto zwykle odpowiada',
  trust: 'Jak żywo komunikuje zespół',
  companySignal: 'Jak firma wypada',
  companyButton: 'Otwórz firmę',
  importedButton: 'Otwórz oryginalne ogłoszenie',
  handshakeCta: 'Podaj rękę',
  companyCta: 'Wejdź do firmy',
  sideTitle: 'Wejście do firmy',
  realityTitle: 'Realność pracy',
  workModel: 'Tryb',
  financialTitle: 'Pieniądze i realia',
  remoteReality: 'Rola zdalna oszczędza czas i dojazd.',
  signInCreate: 'Zaloguj się',
  handshakeTitle: 'Cyfrowy handshake',
  importedDetail: 'Rozebrane ogłoszenie',
  importedSnapshot: 'Co z tego naprawdę wynika',
  aiWandTitle: 'Detektor realności',
  verdictMaybe: 'Tu warto zwolnić',
  takeHome: 'Na rękę',
  commuteTime: 'Czas w drodze',
  commuteCost: 'Koszt dojazdu',
  bullshitTitle: 'Detektor ściemy',
  heroLeadImported: 'Czym naprawdę jest ta rola i czy warto poświęcić jej czas.',
  heroLeadNative: 'Kogo spotkasz, co będziesz rozwiązywać i czy w ogóle warto w to wejść.',
  response: 'Odpowiedź',
  importedContinue: 'Przy importowanej roli przechodzisz dalej do oryginalnego ogłoszenia.',
  importedReality: 'Tutaj przesiewasz realia. Prawdziwa odpowiedź idzie potem przez portal źródłowy.',
  rawImportNote: 'To surowy import. Bez lakieru, bez firmowych perfum. Jeśli ogłoszenie jest napompowane watą, zobaczysz to tu szybko.',
  benefitsReserve: 'Benefity traktujemy ostrożnie. Dog-friendly office przy roli remote to nie jest realny plus.',
  bullshitSmells: 'Śmierdzi to',
  bullshitWatch: 'Uwaga na watę',
  greenTitle: 'AI widzi też dobre rzeczy',
  greenSubtitle: 'Konkretne sygnały uczciwie opisanej roli',
};

const detailPageCopyByLanguage: Record<ChallengeUiLanguage, ChallengeDetailPageCopy> = {
  cs: detailPageCs,
  sk: detailPageSk,
  de: detailPageDe,
  at: detailPageDe,
  pl: detailPagePl,
  en: detailPageEn,
};

export const getChallengeDetailPageCopy = (language: string): ChallengeDetailPageCopy => {
  return detailPageCopyByLanguage[normalizeLanguage(language)];
};

export const getChallengeFocusCopy = (language: string, isImported: boolean): ChallengeFocusCopy => {
  const locale = normalizeLanguage(language);
  const localizedLanguage = locale === 'at' ? 'de' : locale;
  const copy = ({
    cs: {
      back: 'Zpět na seznam',
      eyebrow: isImported ? 'Importovaná nabídka' : 'Nabídka s vlastní výzvou',
      body: 'Co bude potřeba zvládnout, na co si dát pozor, jak odpovědět a co to znamená pro tvoji realitu.',
      reality: 'Rychlá orientace',
      decision: 'Na co odpovědět',
      importedDecision: 'Co si ověřit před odchodem',
      company: 'Firma a kontext',
      quickInsights: 'Rychlý přehled',
      challenge: 'Co bude potřeba zvládnout',
      risk: 'Na co si dát pozor',
      question: 'První otázka',
      importedQuestion: 'Co si rychle ujasnit',
      fit: 'Shoda podle JHI',
      jhiTitle: 'Job Happiness Index',
      jhiBody: 'JHI není odhad od boku. Kombinuje finanční realitu, časovou náročnost, mentální zátěž, růst a hodnotovou shodu do jednoho čitelného signálu.',
      jhiTopSignals: 'Nejsilnější signály',
      jhiDimensionFinancial: 'Finance',
      jhiDimensionTimeCost: 'Čas a režim',
      jhiDimensionMentalLoad: 'Mentální zátěž',
      jhiDimensionGrowth: 'Růst',
      jhiDimensionValues: 'Hodnotová shoda',
      salary: 'Mzda',
      workModel: 'Způsob práce',
      location: 'Místo',
      source: 'Zdroj',
      openListing: 'Otevřít původní inzerát',
      openCompany: 'Otevřít profil firmy',
      openContext: 'Doplnit vlastní kontext',
      importedSnapshot: 'Rychlé shrnutí role',
      importedNextStepTitle: 'Co teď dává smysl udělat',
      importedNextStepBody: 'Pokud tě tenhle problém dává smysl, pokračuj na původní inzerát a odpověz přímo tam. Tady si jen rychle ujasníš, jestli do toho chceš jít.',
      importedSupportTitle: 'Další podklady k rozhodnutí',
      importedSupportBody: 'Finance, firma a původní text jsou pořád dostupné níž, ale až jako druhá vrstva.',
      importedPrepareContext: 'Připravit si kontext',
      importedRealityTitle: 'Tohle je pořád importovaná nabídka',
      importedRealityBody: 'JobShaman ti tu pomáhá rychleji pochopit, co firma pravděpodobně řeší. Samotná odpověď ale dál probíhá mimo JobShaman na původním webu.',
      importedHandshakeHintTitle: 'Jak by to vypadalo nativně',
      importedHandshakeHintBody: 'U nativní nabídky bys tady neposílal životopis naslepo, ale krátký první krok k reálnému problému týmu. Tady je to jen orientační náznak, ne skutečný handshake flow.',
      financialTitle: 'Finanční a dojezdová realita',
      financialBody: 'Tady vidíš skutečný dopad nabídky po započtení čisté mzdy, benefitů a dojíždění.',
      financialFormula: 'Výpočet: čistá mzda {{net}} + benefity {{benefits}} - dojíždění {{commute}} = {{total}}',
      loginPrompt: 'Přihlas se a uvidíš dopad mzdy a dojíždění na svou vlastní situaci.',
      addressPrompt: 'Doplň v profilu adresu nebo polohu a dopočítáme reálné dojíždění.',
      openProfile: 'Otevřít profil',
      gross: 'Hrubá mzda',
      net: 'Čistá mzda',
      benefits: 'Hodnota benefitů',
      commute: 'Náklady na dojíždění',
      commuteDistance: 'Vzdálenost do práce',
      realValue: 'Skutečná měsíční hodnota',
      jhiImpact: 'Dopad do JHI',
      oneWay: 'Jedna cesta',
      dailyTime: 'Čas za den',
      marketMedian: 'Medián trhu',
      marketDelta: 'Rozdíl oproti mediánu',
      benefitsList: 'Benefity',
      realIncome: 'Skutečný příjem',
      compatibility: 'Míra shody',
      originalListing: 'Původní text nabídky',
      originalBody: 'Plný text zůstává dostupný i tady, aby bylo vždy jasné, z čeho nabídka vychází.',
      noDescription: 'Plný text nabídky není k dispozici.',
      companySignal: 'Co o firmě a roli víme',
      importedNote: 'Tato výzva je odvozená z importované nabídky, ale stále vychází z původního inzerátu.',
      importedActionTitle: 'Na tuto nabídku odpovíš na původním webu',
      importedActionBody: 'Otázka výše slouží jen jako pomůcka pro tvoje rozhodnutí. Pokud ti nabídka dává smysl, pokračuješ přes původní inzerát, kde má firma vlastní tlačítko pro odpověď.',
      importedActionCta: 'Otevřít původní inzerát',
      remoteReality: 'Práce na dálku se počítá jako nulové dojíždění, ne jako chybějící údaj.',
      moreCompany: 'Firma a kontext',
      moreOriginal: 'Původní text nabídky',
      firstContactGuideTitle: 'Jak funguje první kontakt s firmou',
      firstContactGuideBody: isImported
        ? 'Tady se nejdřív zorientuješ v tom, co firma skutečně řeší. U importované nabídky ti tato otázka pomůže udělat lepší rozhodnutí před odchodem na původní web.'
        : 'Na JobShamanu nezačínáš slepým CV. Firma nejdřív uvidí krátkou odpověď na konkrétní situaci a až potom volitelný kontext z profilu nebo životopisu.',
      firstContactGuidePointOne: isImported
        ? 'Otázka výše se firmě sama neposílá. Slouží jako tvoje příprava před otevřením původního inzerátu.'
        : 'První signál je tvoje stručná odpověď: co bys udělal(a) jako první krok a co bys potřeboval(a) ověřit.',
      firstContactGuidePointTwo: isImported
        ? 'Pokud ti role dává smysl, odpověď dokončíš na původním webu firmy nebo job boardu.'
        : 'Profil, CV a delší kontext jsou až druhá vrstva. Pomáhají, ale nepřebíjejí první odpověď.',
      firstContactGuidePointThree: isImported
        ? 'Doplňující kontext si můžeš připravit tady, ať nejdeš na původní web bez rozmyšlení.'
        : 'Čím konkrétnější odpověď na skutečný problém, tím vyšší šance na smysluplný dialog místo generické reakce.',
      firstContactGuideDismiss: 'Rozumím',
      firstContactGuideContext: 'Doplnit kontext',
      publisherLabel: 'Tuto výzvu publikoval',
      respondersLabel: 'Kdo bude pravděpodobně reagovat',
      teamTrustLabel: 'Jak tento tým vede dialog',
      trustDialogues: 'Tým vedl za posledních 90 dní {{count}} dialogů.',
      trustResponse: 'Obvykle reaguje do {{hours}} hodin.',
      trustResponseUnderHour: 'Obvykle reaguje do 1 hodiny.',
      humanContextFallbackRole: 'Tým',
      currentLocation: 'Aktuální poloha',
      salaryMissing: 'Mzda neuvedena',
      locationMissing: 'Místo neuvedeno',
      companyMissing: 'Firma neuvedena',
      addAddress: 'Doplň adresu',
      afterSignIn: 'Po přihlášení',
      signInCreate: 'Přihlásit / vytvořit účet',
      defaultCurrency: 'CZK',
      nativeHeroLead: 'Práce tu nezačíná dokumentem, ale vstupem do konkrétní situace, kterou tým právě řeší.',
      importedHeroLead: 'Tohle je převyprávěná importovaná nabídka. JobShaman ji pomáhá rychle přečíst, ale skutečný další krok je pořád mimo platformu.'
    },
    sk: {
      back: 'Späť na zoznam',
      eyebrow: isImported ? 'Importovaná ponuka' : 'Ponuka s vlastnou výzvou',
      body: 'Čo bude treba zvládnuť, na čo si dať pozor, ako odpovedať a čo to znamená pre tvoju realitu.',
      reality: 'Rýchla orientácia',
      decision: 'Na čo odpovedať',
      importedDecision: 'Čo si overiť pred odchodom',
      company: 'Firma a kontext',
      quickInsights: 'Rýchly prehľad',
      challenge: 'Čo bude treba zvládnuť',
      risk: 'Na čo si dať pozor',
      question: 'Prvá otázka',
      importedQuestion: 'Čo si rýchlo ujasniť',
      fit: 'Zhoda podľa JHI',
      jhiTitle: 'Job Happiness Index',
      jhiBody: 'JHI nie je odhad od oka. Kombinuje finančnú realitu, časovú náročnosť, mentálnu záťaž, rast a hodnotovú zhodu do jedného čitateľného signálu.',
      jhiTopSignals: 'Najsilnejšie signály',
      jhiDimensionFinancial: 'Financie',
      jhiDimensionTimeCost: 'Čas a režim',
      jhiDimensionMentalLoad: 'Mentálna záťaž',
      jhiDimensionGrowth: 'Rast',
      jhiDimensionValues: 'Hodnotová zhoda',
      salary: 'Mzda',
      workModel: 'Spôsob práce',
      location: 'Miesto',
      source: 'Zdroj',
      openListing: 'Otvoriť pôvodný inzerát',
      openCompany: 'Otvoriť profil firmy',
      openContext: 'Doplniť vlastný kontext',
      importedSnapshot: 'Rýchle zhrnutie roly',
      importedNextStepTitle: 'Čo teraz dáva zmysel urobiť',
      importedNextStepBody: 'Ak ti tento problém dáva zmysel, pokračuj na pôvodný inzerát a odpovedz priamo tam. Tu si len rýchlo ujasníš, či do toho chceš ísť.',
      importedSupportTitle: 'Ďalšie podklady na rozhodnutie',
      importedSupportBody: 'Financie, firma a pôvodný text sú stále dostupné nižšie, ale až ako druhá vrstva.',
      importedPrepareContext: 'Pripraviť si kontext',
      importedRealityTitle: 'Toto je stále importovaná ponuka',
      importedRealityBody: 'JobShaman ti tu pomáha rýchlejšie pochopiť, čo firma pravdepodobne rieši. Samotná odpoveď ale ďalej prebieha mimo JobShaman na pôvodnom webe.',
      importedHandshakeHintTitle: 'Ako by to vyzeralo natívne',
      importedHandshakeHintBody: 'Pri natívnej ponuke by si sem neposielal životopis naslepo, ale krátky prvý krok k reálnemu problému tímu. Tu je to len orientačný náznak, nie skutočný handshake flow.',
      financialTitle: 'Finančná a dochádzková realita',
      financialBody: 'Tu vidíš skutočný dopad ponuky po započítaní čistej mzdy, benefitov a dochádzania.',
      financialFormula: 'Výpočet: čistá mzda {{net}} + benefity {{benefits}} - dochádzanie {{commute}} = {{total}}',
      loginPrompt: 'Prihlás sa a uvidíš dopad mzdy a dochádzania na svoju vlastnú situáciu.',
      addressPrompt: 'Doplň v profile adresu alebo polohu a dopočítame reálne dochádzanie.',
      openProfile: 'Otvoriť profil',
      gross: 'Hrubá mzda',
      net: 'Čistá mzda',
      benefits: 'Hodnota benefitov',
      commute: 'Náklady na dochádzanie',
      commuteDistance: 'Vzdialenosť do práce',
      realValue: 'Skutočná mesačná hodnota',
      jhiImpact: 'Dopad do JHI',
      oneWay: 'Jedna cesta',
      dailyTime: 'Čas za deň',
      marketMedian: 'Medián trhu',
      marketDelta: 'Rozdiel oproti mediánu',
      benefitsList: 'Benefity',
      realIncome: 'Skutočný príjem',
      compatibility: 'Miera zhody',
      originalListing: 'Pôvodný text ponuky',
      originalBody: 'Plný text zostáva dostupný aj tu, aby bolo vždy jasné, z čoho ponuka vychádza.',
      noDescription: 'Plný text ponuky nie je k dispozícii.',
      companySignal: 'Čo o firme a roli vieme',
      importedNote: 'Táto výzva je odvodená z importovanej ponuky, ale stále vychádza z pôvodného inzerátu.',
      importedActionTitle: 'Na túto ponuku odpovieš na pôvodnom webe',
      importedActionBody: 'Otázka vyššie slúži len ako pomôcka pre tvoje rozhodnutie. Ak ti ponuka dáva zmysel, pokračuješ cez pôvodný inzerát, kde má firma vlastné tlačidlo na odpoveď.',
      importedActionCta: 'Otvoriť pôvodný inzerát',
      remoteReality: 'Práca na diaľku sa počíta ako nulové dochádzanie, nie ako chýbajúci údaj.',
      moreCompany: 'Firma a kontext',
      moreOriginal: 'Pôvodný text ponuky',
      firstContactGuideTitle: 'Ako funguje prvý kontakt s firmou',
      firstContactGuideBody: isImported
        ? 'Tu sa najprv zorientuješ v tom, čo firma skutočne rieši. Pri importovanej ponuke ti táto otázka pomôže urobiť lepšie rozhodnutie ešte pred odchodom na pôvodný web.'
        : 'Na JobShamane nezačínaš slepým CV. Firma najprv uvidí krátku odpoveď na konkrétnu situáciu a až potom voliteľný kontext z profilu alebo životopisu.',
      firstContactGuidePointOne: isImported
        ? 'Otázka vyššie sa firme sama neposiela. Slúži ako tvoja príprava pred otvorením pôvodného inzerátu.'
        : 'Prvý signál je tvoja stručná odpoveď: čo by si urobil(a) ako prvý krok a čo by si potreboval(a) overiť.',
      firstContactGuidePointTwo: isImported
        ? 'Ak ti rola dáva zmysel, odpoveď dokončíš na pôvodnom webe firmy alebo job boarde.'
        : 'Profil, CV a dlhší kontext sú až druhá vrstva. Pomáhajú, ale neprebíjajú prvú odpoveď.',
      firstContactGuidePointThree: isImported
        ? 'Doplňujúci kontext si môžeš pripraviť tu, aby si na pôvodný web nešiel bez rozmyslenia.'
        : 'Čím konkrétnejšia odpoveď na skutočný problém, tým vyššia šanca na zmysluplný dialóg namiesto generickej reakcie.',
      firstContactGuideDismiss: 'Rozumiem',
      firstContactGuideContext: 'Doplniť kontext',
      publisherLabel: 'Túto výzvu publikoval',
      respondersLabel: 'Kto bude pravdepodobne reagovať',
      teamTrustLabel: 'Ako tento tím vedie dialóg',
      trustDialogues: 'Tím viedol za posledných 90 dní {{count}} dialógov.',
      trustResponse: 'Zvyčajne reaguje do {{hours}} hodín.',
      trustResponseUnderHour: 'Zvyčajne reaguje do 1 hodiny.',
      humanContextFallbackRole: 'Tím',
      currentLocation: 'Aktuálna poloha',
      salaryMissing: 'Mzda neuvedená',
      locationMissing: 'Miesto neuvedené',
      companyMissing: 'Firma neuvedená',
      addAddress: 'Doplň adresu',
      afterSignIn: 'Po prihlásení',
      signInCreate: 'Prihlásiť / vytvoriť účet',
      defaultCurrency: 'CZK',
      nativeHeroLead: 'Práca tu nezačína dokumentom, ale vstupom do konkrétnej situácie, ktorú tím práve rieši.',
      importedHeroLead: 'Toto je prevyrozprávaná importovaná ponuka. JobShaman ju pomáha rýchlo prečítať, ale skutočný ďalší krok je stále mimo platformy.'
    },
    de: {
      back: 'Zurück zur Liste',
      eyebrow: isImported ? 'Importierte Rolle' : 'Rolle mit eigener Aufgabe',
      body: 'Was gelöst werden soll, worauf man achten sollte, wie du antworten kannst und was das für deinen Alltag bedeutet.',
      reality: 'Schnelle Orientierung',
      decision: 'Worauf du antwortest',
      importedDecision: 'Was du prüfen solltest, bevor du weitergehst',
      company: 'Firma und Kontext',
      quickInsights: 'Kurzübersicht',
      challenge: 'Was gelöst werden soll',
      risk: 'Worauf man achten sollte',
      question: 'Erste Frage',
      importedQuestion: 'Was du kurz für dich klären solltest',
      fit: 'JHI-Passung',
      jhiTitle: 'Job Happiness Index',
      jhiBody: 'JHI ist keine grobe Schätzung. Er kombiniert finanzielle Realität, Zeitaufwand, mentale Last, Wachstum und Wert-Passung zu einem lesbaren Signal.',
      jhiTopSignals: 'Stärkste Signale',
      jhiDimensionFinancial: 'Finanzen',
      jhiDimensionTimeCost: 'Zeit und Modus',
      jhiDimensionMentalLoad: 'Mentale Last',
      jhiDimensionGrowth: 'Wachstum',
      jhiDimensionValues: 'Werte-Fit',
      salary: 'Gehalt',
      workModel: 'Arbeitsweise',
      location: 'Ort',
      source: 'Quelle',
      openListing: 'Originalanzeige öffnen',
      openCompany: 'Firmenprofil öffnen',
      openContext: 'Eigenen Kontext ergänzen',
      importedSnapshot: 'Kurze Rollenzusammenfassung',
      importedNextStepTitle: 'Was jetzt sinnvoll ist',
      importedNextStepBody: 'Wenn dieses Problem für dich Sinn ergibt, geh über die Originalanzeige weiter und antworte direkt dort. Hier klärst du nur schnell, ob du den nächsten Schritt gehen willst.',
      importedSupportTitle: 'Weitere Entscheidungsgrundlagen',
      importedSupportBody: 'Finanzen, Firma und Originaltext bleiben unten verfügbar, aber nur als zweite Ebene.',
      importedPrepareContext: 'Kontext vorbereiten',
      importedRealityTitle: 'Das bleibt eine importierte Rolle',
      importedRealityBody: 'JobShaman hilft dir hier nur dabei, schneller zu verstehen, was das Unternehmen wahrscheinlich lösen will. Die eigentliche Bewerbung läuft weiterhin außerhalb von JobShaman über die Originalseite.',
      importedHandshakeHintTitle: 'Wie es nativ aussehen würde',
      importedHandshakeHintBody: 'Bei einer nativen Rolle würdest du hier keinen Lebenslauf blind schicken, sondern einen kurzen ersten Schritt zu einem echten Teamproblem. Hier ist das nur ein Hinweis, kein echter Handshake-Flow.',
      financialTitle: 'Finanz- und Pendelrealität',
      financialBody: 'Hier siehst du die tatsächliche Auswirkung des Angebots nach Netto, Benefits und Pendeln.',
      financialFormula: 'Berechnung: netto {{net}} + Benefits {{benefits}} - Pendeln {{commute}} = {{total}}',
      loginPrompt: 'Melde dich an, um Gehalt und Pendeln für deine eigene Situation zu sehen.',
      addressPrompt: 'Ergänze im Profil deine Adresse oder Position, dann berechnen wir das reale Pendeln.',
      openProfile: 'Profil öffnen',
      gross: 'Bruttogehalt',
      net: 'Nettogehalt',
      benefits: 'Wert der Benefits',
      commute: 'Pendelkosten',
      commuteDistance: 'Entfernung zur Arbeit',
      realValue: 'Tatsächlicher Monatswert',
      jhiImpact: 'Einfluss auf JHI',
      oneWay: 'Eine Strecke',
      dailyTime: 'Zeit pro Tag',
      marketMedian: 'Marktmedian',
      marketDelta: 'Abweichung vom Median',
      benefitsList: 'Benefits',
      realIncome: 'Realer Ertrag',
      compatibility: 'Passungswert',
      originalListing: 'Originaltext der Anzeige',
      originalBody: 'Der vollständige Anzeigentext bleibt sichtbar, damit immer klar ist, worauf die Rolle basiert.',
      noDescription: 'Der vollständige Anzeigentext ist nicht verfügbar.',
      companySignal: 'Was wir über Firma und Rolle wissen',
      importedNote: 'Diese Aufgabe wurde aus einer importierten Rolle abgeleitet, basiert aber weiterhin auf der Originalanzeige.',
      importedActionTitle: 'Auf diese Rolle antwortest du auf der Originalseite',
      importedActionBody: 'Die Frage oben dient nur als Denkstütze für deine Entscheidung. Wenn die Rolle für dich passt, gehst du über die Originalanzeige weiter, wo das Unternehmen seinen eigenen Bewerbungsweg hat.',
      importedActionCta: 'Originalanzeige öffnen',
      remoteReality: 'Remote-Arbeit wird als null Pendelaufwand behandelt, nicht als fehlende Angabe.',
      moreCompany: 'Firma und Kontext',
      moreOriginal: 'Originaltext der Anzeige',
      firstContactGuideTitle: 'So funktioniert der erste Kontakt mit dem Unternehmen',
      firstContactGuideBody: isImported
        ? 'Hier orientierst du dich zuerst daran, was das Unternehmen tatsächlich lösen will. Bei importierten Rollen hilft dir diese Frage, besser zu entscheiden, bevor du zur Originalseite wechselst.'
        : 'Bei JobShaman startest du nicht mit einem blinden CV. Das Unternehmen sieht zuerst eine kurze Antwort auf eine konkrete Situation und erst danach optionalen Kontext aus Profil oder Lebenslauf.',
      firstContactGuidePointOne: isImported
        ? 'Die Frage oben wird nicht automatisch an das Unternehmen gesendet. Sie ist deine Vorbereitung vor dem Wechsel zur Originalanzeige.'
        : 'Das erste Signal ist deine kurze Antwort: Was wäre dein erster Schritt und was müsstest du zuerst prüfen?',
      firstContactGuidePointTwo: isImported
        ? 'Wenn die Rolle für dich passt, machst du auf der Originalseite des Unternehmens oder Jobboards weiter.'
        : 'Profil, CV und zusätzlicher Kontext sind die zweite Ebene. Sie helfen, ersetzen aber nicht deine erste Antwort.',
      firstContactGuidePointThree: isImported
        ? 'Zusätzlichen Kontext kannst du hier vorbereiten, damit du nicht unvorbereitet auf die Originalseite gehst.'
        : 'Je konkreter deine Antwort auf das echte Problem ist, desto höher die Chance auf einen sinnvollen Dialog statt einer generischen Reaktion.',
      firstContactGuideDismiss: 'Verstanden',
      firstContactGuideContext: 'Kontext ergänzen',
      publisherLabel: 'Diese Aufgabe wurde veröffentlicht von',
      respondersLabel: 'Wer voraussichtlich antwortet',
      teamTrustLabel: 'Wie dieses Team Dialoge führt',
      trustDialogues: 'Das Team hat in den letzten 90 Tagen {{count}} Dialoge geführt.',
      trustResponse: 'Antwortet normalerweise innerhalb von {{hours}} Stunden.',
      trustResponseUnderHour: 'Antwortet normalerweise innerhalb von 1 Stunde.',
      humanContextFallbackRole: 'Team',
      currentLocation: 'Aktueller Standort',
      salaryMissing: 'Gehalt nicht angegeben',
      locationMissing: 'Ort nicht angegeben',
      companyMissing: 'Firma nicht angegeben',
      addAddress: 'Adresse ergänzen',
      afterSignIn: 'Nach dem Login',
      signInCreate: 'Anmelden / Konto erstellen',
      defaultCurrency: 'EUR',
      nativeHeroLead: 'Die Arbeit beginnt hier nicht mit einem Dokument, sondern mit dem Einstieg in eine konkrete Situation, die das Team gerade lösen will.',
      importedHeroLead: 'Das hier ist eine neu erzählte importierte Rolle. JobShaman hilft dir, sie schneller zu lesen, aber der eigentliche nächste Schritt liegt weiter außerhalb der Plattform.'
    },
    pl: {
      back: 'Powrót do listy',
      eyebrow: isImported ? 'Importowana oferta' : 'Oferta z własnym wyzwaniem',
      body: 'Co trzeba ogarnąć, na co uważać, jak możesz odpowiedzieć i co to oznacza w twojej codzienności.',
      reality: 'Szybki przegląd',
      decision: 'Na co odpowiadasz',
      importedDecision: 'Co sprawdzić przed przejściem dalej',
      company: 'Firma i kontekst',
      quickInsights: 'Szybki podgląd',
      challenge: 'Co trzeba ogarnąć',
      risk: 'Na co uważać',
      question: 'Pierwsze pytanie',
      importedQuestion: 'Co szybko doprecyzować dla siebie',
      fit: 'Dopasowanie JHI',
      jhiTitle: 'Job Happiness Index',
      jhiBody: 'JHI nie jest zgadywaniem. Łączy realia finansowe, koszt czasu, obciążenie mentalne, rozwój i zgodność wartości w jeden czytelny sygnał.',
      jhiTopSignals: 'Najsilniejsze sygnały',
      jhiDimensionFinancial: 'Finanse',
      jhiDimensionTimeCost: 'Czas i tryb',
      jhiDimensionMentalLoad: 'Obciążenie mentalne',
      jhiDimensionGrowth: 'Rozwój',
      jhiDimensionValues: 'Zgodność wartości',
      salary: 'Wynagrodzenie',
      workModel: 'Sposób pracy',
      location: 'Miejsce',
      source: 'Źródło',
      openListing: 'Otwórz oryginalne ogłoszenie',
      openCompany: 'Otwórz profil firmy',
      openContext: 'Dodaj własny kontekst',
      importedSnapshot: 'Szybkie podsumowanie roli',
      importedNextStepTitle: 'Co teraz ma sens zrobić',
      importedNextStepBody: 'Jeśli ten problem ma dla ciebie sens, przejdź do oryginalnego ogłoszenia i odpowiedz bezpośrednio tam. Tutaj tylko szybko sprawdzasz, czy chcesz iść dalej.',
      importedSupportTitle: 'Dodatkowe materiały do decyzji',
      importedSupportBody: 'Finanse, firma i oryginalny tekst są nadal dostępne niżej, ale już jako druga warstwa.',
      importedPrepareContext: 'Przygotuj kontekst',
      importedRealityTitle: 'To nadal importowana oferta',
      importedRealityBody: 'JobShaman pomaga ci tu szybciej zrozumieć, co firma prawdopodobnie chce rozwiązać. Sama odpowiedź nadal odbywa się poza JobShaman na oryginalnej stronie.',
      importedHandshakeHintTitle: 'Jak wyglądałoby to natywnie',
      importedHandshakeHintBody: 'W natywnej ofercie nie wysyłasz tu CV w ciemno, tylko krótki pierwszy krok wobec realnego problemu zespołu. Tutaj to tylko orientacyjna podpowiedź, a nie prawdziwy handshake flow.',
      financialTitle: 'Finanse i realny dojazd',
      financialBody: 'Tutaj widzisz rzeczywisty wpływ oferty po uwzględnieniu wynagrodzenia netto, benefitów i dojazdu.',
      financialFormula: 'Wyliczenie: netto {{net}} + benefity {{benefits}} - dojazd {{commute}} = {{total}}',
      loginPrompt: 'Zaloguj się, aby zobaczyć wpływ pensji i dojazdu na swoją sytuację.',
      addressPrompt: 'Uzupełnij adres lub lokalizację w profilu, a policzymy realny dojazd.',
      openProfile: 'Otwórz profil',
      gross: 'Wynagrodzenie brutto',
      net: 'Wynagrodzenie netto',
      benefits: 'Wartość benefitów',
      commute: 'Koszt dojazdu',
      commuteDistance: 'Odległość do pracy',
      realValue: 'Rzeczywista wartość miesięczna',
      jhiImpact: 'Wpływ na JHI',
      oneWay: 'W jedną stronę',
      dailyTime: 'Czas dziennie',
      marketMedian: 'Mediana rynku',
      marketDelta: 'Różnica względem mediany',
      benefitsList: 'Benefity',
      realIncome: 'Rzeczywisty dochód',
      compatibility: 'Poziom dopasowania',
      originalListing: 'Oryginalna treść oferty',
      originalBody: 'Pełna treść ogłoszenia pozostaje widoczna także tutaj, żeby zawsze było jasne, na czym opiera się oferta.',
      noDescription: 'Pełna treść oferty nie jest dostępna.',
      companySignal: 'Co wiemy o firmie i roli',
      importedNote: 'To wyzwanie zostało wyprowadzone z importowanej oferty, ale nadal opiera się na oryginalnym ogłoszeniu.',
      importedActionTitle: 'Na tę ofertę odpowiadasz na oryginalnej stronie',
      importedActionBody: 'Pytanie wyżej to tylko pomoc w podjęciu decyzji. Jeśli oferta ma sens, przechodzisz do oryginalnego ogłoszenia, gdzie firma ma własny sposób zgłoszenia.',
      importedActionCta: 'Otwórz oryginalne ogłoszenie',
      remoteReality: 'Praca zdalna liczy się jako zerowy dojazd, a nie brak danych.',
      moreCompany: 'Firma i kontekst',
      moreOriginal: 'Oryginalna treść oferty',
      firstContactGuideTitle: 'Jak działa pierwszy kontakt z firmą',
      firstContactGuideBody: isImported
        ? 'Tutaj najpierw orientujesz się, co firma naprawdę chce rozwiązać. Przy importowanej ofercie to pytanie pomaga podjąć lepszą decyzję, zanim przejdziesz na oryginalną stronę.'
        : 'W JobShaman nie zaczynasz od ślepego CV. Firma najpierw widzi krótką odpowiedź na konkretną sytuację, a dopiero potem opcjonalny kontekst z profilu lub CV.',
      firstContactGuidePointOne: isImported
        ? 'Pytanie wyżej nie wysyła się automatycznie do firmy. To twoje przygotowanie przed otwarciem oryginalnego ogłoszenia.'
        : 'Pierwszym sygnałem jest twoja krótka odpowiedź: jaki byłby pierwszy krok i co chcesz najpierw sprawdzić.',
      firstContactGuidePointTwo: isImported
        ? 'Jeśli rola ma sens, kończysz odpowiedź na oryginalnej stronie firmy albo job boardu.'
        : 'Profil, CV i szerszy kontekst to druga warstwa. Pomagają, ale nie zastępują pierwszej odpowiedzi.',
      firstContactGuidePointThree: isImported
        ? 'Dodatkowy kontekst możesz przygotować tutaj, żeby nie iść na oryginalną stronę bez przemyślenia.'
        : 'Im bardziej konkretna odpowiedź na realny problem, tym większa szansa na sensowny dialog zamiast generycznej reakcji.',
      firstContactGuideDismiss: 'Rozumiem',
      firstContactGuideContext: 'Dodaj kontekst',
      publisherLabel: 'To wyzwanie opublikował(a)',
      respondersLabel: 'Kto prawdopodobnie odpowie',
      teamTrustLabel: 'Jak ten zespół prowadzi dialog',
      trustDialogues: 'Zespół prowadził w ostatnich 90 dniach {{count}} dialogów.',
      trustResponse: 'Zwykle odpowiada w ciągu {{hours}} godzin.',
      trustResponseUnderHour: 'Zwykle odpowiada w ciągu 1 godziny.',
      humanContextFallbackRole: 'Zespół',
      currentLocation: 'Aktualna lokalizacja',
      salaryMissing: 'Nie podano wynagrodzenia',
      locationMissing: 'Nie podano lokalizacji',
      companyMissing: 'Nie podano firmy',
      addAddress: 'Dodaj adres',
      afterSignIn: 'Po zalogowaniu',
      signInCreate: 'Zaloguj się / utwórz konto',
      defaultCurrency: 'EUR',
      nativeHeroLead: 'Praca nie zaczyna się tu od dokumentu, ale od wejścia w konkretną sytuację, którą zespół właśnie próbuje rozwiązać.',
      importedHeroLead: 'To jest przepisana importowana oferta. JobShaman pomaga szybciej ją przeczytać, ale prawdziwy kolejny krok nadal dzieje się poza platformą.'
    },
    en: {
      back: 'Back to list',
      eyebrow: isImported ? 'Imported role' : 'Role with native challenge',
      body: 'What needs to be solved, what to watch out for, how you can respond, and what it means for your reality.',
      reality: 'Quick actions',
      decision: 'What to respond to',
      importedDecision: 'What to verify before you leave',
      company: 'Company and context',
      quickInsights: 'Quick insights',
      challenge: 'What needs to be solved',
      risk: 'What to watch out for',
      question: 'First question',
      importedQuestion: 'What to clarify for yourself',
      fit: 'JHI fit',
      jhiTitle: 'Job Happiness Index',
      jhiBody: 'JHI is not a vague guess. It combines financial reality, time cost, mental load, growth, and values alignment into one readable signal.',
      jhiTopSignals: 'Strongest signals',
      jhiDimensionFinancial: 'Financial reality',
      jhiDimensionTimeCost: 'Time and mode',
      jhiDimensionMentalLoad: 'Mental load',
      jhiDimensionGrowth: 'Growth',
      jhiDimensionValues: 'Values alignment',
      salary: 'Salary',
      workModel: 'Work model',
      location: 'Location',
      source: 'Source',
      openListing: 'Open original listing',
      openCompany: 'Open company profile',
      openContext: 'Add your context',
      importedSnapshot: 'Quick role snapshot',
      importedNextStepTitle: 'What makes sense to do next',
      importedNextStepBody: 'If this problem feels worth pursuing, continue to the original listing and respond there directly. Here, you are only clarifying whether you want to take that step.',
      importedSupportTitle: 'More context if you need it',
      importedSupportBody: 'Financial reality, company context, and the original listing are still available below, but only as a second layer.',
      importedPrepareContext: 'Prepare your context',
      importedRealityTitle: 'This is still an imported role',
      importedRealityBody: 'JobShaman is only helping you understand faster what the company is probably trying to solve. The actual application still happens outside JobShaman on the original site.',
      importedHandshakeHintTitle: 'How this would work natively',
      importedHandshakeHintBody: 'On a native role, you would not send a blind resume here. You would send a short first step toward a real team problem. Here, that is only a directional hint, not a true handshake flow.',
      financialTitle: 'Financial and commute reality',
      financialBody: 'This shows the real impact of the role after net salary, benefits, and commute are taken into account.',
      financialFormula: 'Calculation: net pay {{net}} + benefits {{benefits}} - commute {{commute}} = {{total}}',
      loginPrompt: 'Sign in to see salary and commute impact for your own situation.',
      addressPrompt: 'Add your address or location in profile and we will calculate real commute impact.',
      openProfile: 'Open profile',
      gross: 'Gross salary',
      net: 'Net salary',
      benefits: 'Benefit value',
      commute: 'Commute cost',
      commuteDistance: 'Distance to work',
      realValue: 'Real monthly value',
      jhiImpact: 'JHI impact',
      oneWay: 'One way',
      dailyTime: 'Daily time',
      marketMedian: 'Market median',
      marketDelta: 'Difference vs median',
      benefitsList: 'Benefits',
      realIncome: 'Real income',
      compatibility: 'Compatibility',
      originalListing: 'Original listing',
      originalBody: 'The full source listing stays visible here so it is always clear what the role is based on.',
      noDescription: 'The full source listing is not available.',
      companySignal: 'What we know about the company and role',
      importedNote: 'This challenge is derived from an imported role, but still anchored in the original listing.',
      importedActionTitle: 'You respond to this role on the original website',
      importedActionBody: 'The question above is only a thinking aid for your decision. If the role makes sense, you continue through the original listing, where the company keeps its own application flow.',
      importedActionCta: 'Open original listing',
      remoteReality: 'Remote work counts as zero commute, not as missing data.',
      moreCompany: 'Company and context',
      moreOriginal: 'Original listing',
      firstContactGuideTitle: 'How first contact with the company works',
      firstContactGuideBody: isImported
        ? 'This is where you first understand what the company is actually trying to solve. For imported roles, the question helps you decide better before you leave for the original site.'
        : 'On JobShaman, you do not start with a blind CV. The company first sees a short response to a concrete situation, then optional context from your profile or resume.',
      firstContactGuidePointOne: isImported
        ? 'The question above is not sent to the company automatically. It prepares you before you open the original listing.'
        : 'Your first signal is a short response: what your first step would be and what you would need to verify first.',
      firstContactGuidePointTwo: isImported
        ? 'If the role makes sense, you finish the response on the company or job board website.'
        : 'Profile, CV, and richer context are the second layer. They help, but they should not override the first response.',
      firstContactGuidePointThree: isImported
        ? 'You can prepare additional context here so you do not go to the original site cold.'
        : 'The more concrete your answer to the real problem, the higher the chance of a meaningful dialogue instead of a generic reaction.',
      firstContactGuideDismiss: 'Understood',
      firstContactGuideContext: 'Add context',
      publisherLabel: 'This challenge was published by',
      respondersLabel: 'Who will likely reply',
      teamTrustLabel: 'How this team runs dialogue',
      trustDialogues: 'The team ran {{count}} dialogues in the last 90 days.',
      trustResponse: 'Usually replies within {{hours}} hours.',
      trustResponseUnderHour: 'Usually replies within 1 hour.',
      humanContextFallbackRole: 'Team',
      currentLocation: 'Current location',
      salaryMissing: 'Salary not specified',
      locationMissing: 'Location not specified',
      companyMissing: 'Company not specified',
      addAddress: 'Add address',
      afterSignIn: 'After sign in',
      signInCreate: 'Sign in / create account',
      defaultCurrency: 'EUR',
      nativeHeroLead: 'Work here does not start with a document, but with a real situation the team is trying to solve.',
      importedHeroLead: 'This is a reframed imported role. JobShaman helps you read it faster, but the real next step still lives off-platform.'
    }
  } as const)[localizedLanguage];

  return copy;
};

export const getMicroJobCopy = (language: string): MicroJobCopy => {
  const locale = normalizeLanguage(language);
  const localizedLanguage = locale === 'at' ? 'de' : locale;
  return ({
    cs: {
      badge: 'MINI VYZVA',
      budget: 'Rozpočet',
      type: 'Typ mini výzvy',
      timeEstimate: 'Odhad času',
      collaboration: 'Typ spolupráce',
      longTermPotential: 'Další spolupráce',
      financialNoteTitle: 'Rychlá spolupráce místo měsíční mzdy',
      financialNoteBody: 'U mini výzvy ukazujeme rozpočet, časový odhad a způsob spolupráce. Měsíční salary benchmark a čistý příjem zde nedávají smysl.'
    },
    sk: {
      badge: 'MINI VYZVA',
      budget: 'Rozpočet',
      type: 'Typ mini výzvy',
      timeEstimate: 'Odhad času',
      collaboration: 'Typ spolupráce',
      longTermPotential: 'Ďalšia spolupráca',
      financialNoteTitle: 'Rýchla spolupráca namiesto mesačnej mzdy',
      financialNoteBody: 'Pri mini výzve ukazujeme rozpočet, odhad času a spôsob spolupráce. Mesačný salary benchmark a čistý príjem tu nedávajú zmysel.'
    },
    de: {
      badge: 'MINI-AUFGABE',
      budget: 'Budget',
      type: 'Typ',
      timeEstimate: 'Zeitaufwand',
      collaboration: 'Zusammenarbeit',
      longTermPotential: 'Weitere Zusammenarbeit',
      financialNoteTitle: 'Schnelle Zusammenarbeit statt Monatsgehalt',
      financialNoteBody: 'Bei einer Mini-Aufgabe zeigen wir Budget, Zeitaufwand und die Form der Zusammenarbeit. Monatliche Gehaltsbenchmarks und Nettoeinkommen sind hier nicht sinnvoll.'
    },
    pl: {
      badge: 'MINI WYZWANIE',
      budget: 'Budżet',
      type: 'Typ',
      timeEstimate: 'Szacowany czas',
      collaboration: 'Typ współpracy',
      longTermPotential: 'Dalsza współpraca',
      financialNoteTitle: 'Szybka współpraca zamiast miesięcznej pensji',
      financialNoteBody: 'Przy mini wyzwaniu pokazujemy budżet, czas i sposób współpracy. Miesięczny benchmark wynagrodzenia i dochód netto nie mają tu sensu.'
    },
    en: {
      badge: 'MINI CHALLENGE',
      budget: 'Budget',
      type: 'Type',
      timeEstimate: 'Time estimate',
      collaboration: 'Collaboration',
      longTermPotential: 'Long-term potential',
      financialNoteTitle: 'Quick collaboration instead of monthly salary',
      financialNoteBody: 'For a mini challenge, we show budget, time estimate, and collaboration mode. Monthly salary benchmarks and net income do not make sense here.'
    }
  } as const)[localizedLanguage];
};
