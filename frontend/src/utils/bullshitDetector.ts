import type { Job } from '../types';

export type BullshitTone = 'clean' | 'watch' | 'bullshit';

export type BullshitAnalysis = {
  score: number;
  maxScore: number;
  tone: BullshitTone;
  signals: string[];
  categories: string[];
  summary: string;
  greenFlags: string[];
  greenSummary: string;
};

export const BULLSHIT_MAX_SCORE = 8;

type SupportedLocale = 'cs' | 'sk' | 'de' | 'pl' | 'en';

const resolveLocale = (localeOrCsLike?: string | boolean): SupportedLocale => {
  if (typeof localeOrCsLike === 'string') {
    const normalized = localeOrCsLike.split('-')[0].toLowerCase();
    if (normalized === 'cs' || normalized === 'sk' || normalized === 'de' || normalized === 'pl') {
      return normalized;
    }
    return 'en';
  }
  if (localeOrCsLike === true) return 'cs';
  return 'en';
};

const pickLabel = (locale: SupportedLocale, labels: { cs: string; sk: string; de: string; pl: string; en: string }): string => {
  if (locale === 'cs') return labels.cs;
  if (locale === 'sk') return labels.sk;
  if (locale === 'de') return labels.de;
  if (locale === 'pl') return labels.pl;
  return labels.en;
};

const normalizeBenefitList = (benefits: unknown): string[] => {
  if (!Array.isArray(benefits)) return [];
  return benefits
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const buildCategoryLabels = (locale: SupportedLocale) => ({
  payFog: pickLabel(locale, {
    cs: 'Mlha kolem peněz',
    sk: 'Hmla okolo peňazí',
    de: 'Nebel rund ums Geld',
    pl: 'Mgła wokół pieniędzy',
    en: 'Pay fog',
  }),
  pressure: pickLabel(locale, {
    cs: 'Tlak jako kultura',
    sk: 'Tlak ako kultúra',
    de: 'Druck als Kultur',
    pl: 'Presja jako kultura',
    en: 'Pressure as culture',
  }),
  fakePerks: pickLabel(locale, {
    cs: 'Fake benefity',
    sk: 'Fake benefity',
    de: 'Pseudo-Benefits',
    pl: 'Pseudo-benefity',
    en: 'Fake perks',
  }),
  blurryBoundaries: pickLabel(locale, {
    cs: 'Rozmazané hranice',
    sk: 'Rozmazané hranice',
    de: 'Verschwommene Grenzen',
    pl: 'Rozmyte granice',
    en: 'Blurry boundaries',
  }),
  foggyCopy: pickLabel(locale, {
    cs: 'Korporátní mlha',
    sk: 'Korporátna hmla',
    de: 'Corporate-Nebel',
    pl: 'Korporacyjna mgła',
    en: 'Corporate fog',
  }),
  vagueRole: pickLabel(locale, {
    cs: 'Nejasná náplň práce',
    sk: 'Nejasná náplň práce',
    de: 'Unklare Aufgaben',
    pl: 'Niejasny zakres roli',
    en: 'Vague role scope',
  }),
});

const buildSummary = (locale: SupportedLocale, categories: string[], tone: BullshitTone): string => {
  const joined = categories.slice(0, 3).join(', ');
  if (!joined) {
    return pickLabel(locale, {
      cs: 'Text působí poměrně čistě a bez velkých varovných vzorců.',
      sk: 'Text pôsobí pomerne čisto a bez veľkých varovných vzorcov.',
      de: 'Der Text wirkt insgesamt sauber und ohne große Warnmuster.',
      pl: 'Treść wygląda dość czysto i bez dużych wzorców ostrzegawczych.',
      en: 'The listing reads fairly cleanly without major warning patterns.',
    });
  }

  if (tone === 'bullshit') {
    return pickLabel(locale, {
      cs: `AI v textu vidí hlavně ${joined}. Tohle už nepůsobí jako náhoda, ale jako vzorec.`,
      sk: `AI v texte vidí hlavne ${joined}. Toto už nepôsobí ako náhoda, ale ako vzorec.`,
      de: `Die AI sieht hier vor allem ${joined}. Das wirkt nicht mehr zufällig, sondern wie ein Muster.`,
      pl: `AI widzi tu głównie: ${joined}. To nie wygląda już na przypadek, ale na wzorzec.`,
      en: `AI mainly sees ${joined} in this listing. That no longer looks accidental, it looks patterned.`,
    });
  }

  return pickLabel(locale, {
    cs: `AI tady zachytila hlavně ${joined}. Je dobré zpozornět a ptát se na detaily.`,
    sk: `AI tu zachytila hlavne ${joined}. Oplatí sa spozornieť a pýtať sa na detaily.`,
    de: `Die AI erkennt hier vor allem ${joined}. Es lohnt sich, genauer nachzufragen.`,
    pl: `AI wyłapała tu głównie: ${joined}. Warto się zatrzymać i dopytać o szczegóły.`,
    en: `AI mainly picked up ${joined} here. It is worth slowing down and asking for specifics.`,
  });
};

const buildGreenSummary = (locale: SupportedLocale, greenFlags: string[]): string => {
  if (greenFlags.length === 0) {
    return pickLabel(locale, {
      cs: 'AI tu nenašla moc konkrétních signálů férově popsané role.',
      sk: 'AI tu nenašla veľa konkrétnych signálov férovo opísanej roly.',
      de: 'Die AI hat hier nicht viele konkrete Signale einer fair beschriebenen Rolle gefunden.',
      pl: 'AI nie znalazła tu wielu konkretnych sygnałów uczciwie opisanej roli.',
      en: 'AI did not find many concrete signals of a fairly described role here.',
    });
  }

  return pickLabel(locale, {
    cs: `AI naopak oceňuje hlavně toto: ${greenFlags.slice(0, 3).join(', ')}.`,
    sk: `AI naopak oceňuje hlavne toto: ${greenFlags.slice(0, 3).join(', ')}.`,
    de: `Die AI bewertet auf der anderen Seite vor allem das hier positiv: ${greenFlags.slice(0, 3).join(', ')}.`,
    pl: `AI z drugiej strony docenia tu przede wszystkim: ${greenFlags.slice(0, 3).join(', ')}.`,
    en: `On the positive side, AI mainly values this here: ${greenFlags.slice(0, 3).join(', ')}.`,
  });
};

export const analyzeJobBullshit = (job: Job, localeOrCsLike?: string | boolean): BullshitAnalysis => {
  const locale = resolveLocale(localeOrCsLike);
  const categoryLabels = buildCategoryLabels(locale);
  const benefits = normalizeBenefitList((job as any).benefits);
  const remoteRole = /remote/i.test(String(job.work_model || job.type || ''));
  const normalizedBenefits = benefits.map((benefit) => benefit.toLowerCase());
  const description = String(job.description || '').toLowerCase();
  const salaryText = String(job.salaryRange || '').toLowerCase();
  const haystack = `${normalizedBenefits.join(' ')} ${description}`;
  const compensationHaystack = `${salaryText} ${description}`;

  const signals: string[] = [];
  const categories = new Set<string>();
  const greenFlags: string[] = [];
  let score = 0;

  const hasCommissionLanguage = /(provizn[ií]|provize|commission[-\s]?only|commission[-\s]?based|odm[eě]na je provizn[ií]|odmena je provizni|výdělek je provizn[ií]|vydelek je provizni)/i.test(compensationHaystack);
  const hasContractorLanguage = /(\bičo\b|\bico\b|živnost|zivnost|živnostensk[ýá]|na živnost|na zivnost|contractor|freelance)/i.test(compensationHaystack);
  const hasFixedBaseLanguage = /(fixn[ií]\s*(mzd|plat|slozk)|fix \+ provize|fix plus provize|z[aá]kladn[ií]\s*(mzd|plat|slozk)|base salary|fixed salary|guaranteed pay|garantovan[aý]\s*(z[aá]klad|mzda|plat|odm[eě]na))/i.test(compensationHaystack);
  const hasPerformanceEuphemism = /(podle v[ýy]konu|dle v[ýy]konu|according to performance|based on performance|výsledky jsou podle v[ýy]konu|vysledky jsou podle vykonu|konzistenc[ei]|pipeline|n[aá]vyky|navyky|habits|not first week|ne prvn[ií]m t[ýy]dnem|ne prvym tyzdnom)/i.test(compensationHaystack);

  if (hasCommissionLanguage && hasContractorLanguage && !hasFixedBaseLanguage) {
    score += 4;
    categories.add(categoryLabels.payFog);
    signals.push(
      pickLabel(locale, {
        cs: 'Provizní IČO bez jasného fixu je velká červená vlajka. Riziko je skoro celé přehozené na tebe.',
        sk: 'Provízne IČO bez jasného fixu je veľká červená vlajka. Riziko je takmer celé hodené na teba.',
        de: 'Provision auf IČO-/Freelance-Basis ohne klaren Fixum-Anteil ist eine fette rote Flagge. Das Risiko liegt fast komplett bei dir.',
        pl: 'Prowizyjne B2B bez jasno podanej stałej części to duża czerwona flaga. Prawie całe ryzyko ląduje po twojej stronie.',
        en: 'Commission-only contractor language without a clear fixed base is a major red flag. Most of the risk gets pushed onto you.',
      })
    );
  }

  if (hasPerformanceEuphemism && (hasCommissionLanguage || hasContractorLanguage) && !hasFixedBaseLanguage) {
    score += 3;
    categories.add(categoryLabels.payFog);
    categories.add(categoryLabels.pressure);
    signals.push(
      pickLabel(locale, {
        cs: '„Výkon“, „konzistence“ a „pipeline“ místo jasně popsaného výdělku obvykle znamenají, že reálné peníze jsou schované za motivační mlhou.',
        sk: '„Výkon“, „konzistencia“ a „pipeline“ namiesto jasne popísaného zárobku zvyčajne znamenajú, že reálne peniaze sú schované za motivačnou hmlou.',
        de: '„Performance“, „Konstanz“ und „Pipeline“ statt klar beschriebenem Einkommen bedeutet oft, dass das echte Geld hinter Motivationsnebel schwingt.',
        pl: '„Wyniki”, „konsekwencja” i „pipeline” zamiast jasno opisanego wynagrodzenia zwykle znaczą, że realne pieniądze chowają się za motywacyjną mgłą.',
        en: 'When “performance,” “consistency,” and “pipeline” replace a clear pay description, the real money is usually hiding behind motivational fog.',
      })
    );
  }

  const familyCulturePattern = /(jsme jako rodina|jsme rodina|rodina ne firma|family not company|we are like a family|we're like a family|family[-\s]?like culture)/i;
  if (familyCulturePattern.test(haystack)) {
    score += 2;
    categories.add(categoryLabels.blurryBoundaries);
    signals.push(
      pickLabel(locale, {
        cs: '„Jsme jako rodina“ bývá často kód pro rozmazané hranice, emoční tlak a očekávání navíc bez jasných pravidel.',
        sk: '„Sme ako rodina“ býva často kód pre rozmazané hranice, emočný tlak a očakávania navyše bez jasných pravidiel.',
        de: '„Wir sind wie eine Familie“ ist oft Code für verschwommene Grenzen, emotionalen Druck und Extraerwartungen ohne klare Regeln.',
        pl: '„Jesteśmy jak rodzina” bywa często kodem na rozmyte granice, presję emocjonalną i dodatkowe oczekiwania bez jasnych zasad.',
        en: '"We are like a family" is often code for blurry boundaries, emotional pressure, and extra expectations without clear rules.',
      })
    );
  }

  const performanceCulturePattern = /(orientace na v[ýy]kon|vykonnostn[ií] kultura|performance[-\s]?driven|performance culture|high[-\s]?performance culture|results[-\s]?driven|driven by results|tah na v[ýy]sledek|siln[aá] orientace na v[ýy]sledek)/i;
  if (performanceCulturePattern.test(haystack)) {
    score += 2;
    categories.add(categoryLabels.pressure);
    signals.push(
      pickLabel(locale, {
        cs: '„Orientace na výkon“ bez popisu podpory, tempa a hranic často znamená tlak jako kulturu, ne zdravě nastavenou práci.',
        sk: '„Orientácia na výkon“ bez popisu podpory, tempa a hraníc často znamená tlak ako kultúru, nie zdravo nastavenú prácu.',
        de: '„Performance-Kultur“ ohne Beschreibung von Unterstützung, Tempo und Grenzen bedeutet oft Druck als Kultur statt sauber aufgesetzter Arbeit.',
        pl: '„Orientacja na wyniki” bez opisu wsparcia, tempa i granic często oznacza kulturę presji, a ne zdrowo ułożoną pracę.',
        en: '"Performance-driven" without any clarity on support, pace, and boundaries often means pressure is the culture.',
      })
    );
  }

  const basicObligationAsBenefitPattern = /(v[ýy]plata (je )?v[zž]dy v[čc]as|mzda v[ýy]pl[aá]cena v[čc]as|salary paid on time|always paid on time|paid on time every month|v[ýy]plata pravideln[eě]|vyplata pravidelne)/i;
  if (basicObligationAsBenefitPattern.test(haystack)) {
    score += 2;
    categories.add(categoryLabels.fakePerks);
    signals.push(
      pickLabel(locale, {
        cs: '„Výplata vždy včas“ není benefit, ale naprostý základ. Když se tím firma chlubí, spíš tím nechtěně něco prozrazuje.',
        sk: '„Výplata vždy načas“ nie je benefit, ale úplný základ. Keď sa tým firma chváli, skôr tým nechtiac niečo prezrádza.',
        de: '„Gehalt immer pünktlich“ ist kein Benefit, sondern absolute Grundhygiene. Wenn das groß verkauft wird, verrät das spíš něco bokem.',
        pl: '„Wypłata zawsze na czas” to nie benefit, tylko absolutna podstawa. Gdy firma moc to podkreśla, zwykle coś tím sama prozrazuje.',
        en: '"Salary paid on time" is not a perk, it is the bare minimum. If a company sells it hard, it is usually revealing something by accident.',
      })
    );
  }

  const stressTolerancePattern = /(pr[aá]ce pod stresem ti nevad[ií]|odolnost vůči stresu|odolnost vuci stresu|stress resistance|ability to work under pressure|schopnost pracovat pod tlakem|zvl[aá]d[aá]n[ií] stresu|resistance to stress)/i;
  if (stressTolerancePattern.test(haystack)) {
    score += 2;
    categories.add(categoryLabels.pressure);
    signals.push(
      pickLabel(locale, {
        cs: 'Když inzerát dopředu normalizuje stres a tlak, bývá fér zbystřit. Často tím popisuje problém jako osobnostní požadavek.',
        sk: 'Keď inzerát dopredu normalizuje stres a tlak, oplatí sa spozornieť. Často tým opisuje problém ako osobnostnú požiadavku.',
        de: 'Wenn ein Inserat Stress und Druck vorab normalisiert, lohnt es sich wach zu werden. Oft wird damit ein Strukturproblem als Persönlichkeitsanforderung verkauft.',
        pl: 'Gdy ogłoszenie z góry normalizuje stres i presję, warto się zatrzymać. Często problem organizacyjny sprzedaje jako cechę kandydata.',
        en: 'When a listing normalizes stress and pressure upfront, it is worth paying attention. It often turns an organizational problem into a personality requirement.',
      })
    );
  }

  const vagueGrowthPattern = /(možnost kari[eé]rn[ií]ho r[uů]stu|career growth opportunity|great growth potential|rapid career growth|rychl[yý] kari[eé]rn[ií] r[uů]st|opportunity for growth)/i;
  const concreteGrowthPattern = /(career path|growth plan|mentoring|mentor|learning budget|školen[ií]|skoleni|certifikac|rozvojov[yý] pl[aá]n|promotion framework)/i;
  if (vagueGrowthPattern.test(haystack) && !concreteGrowthPattern.test(haystack)) {
    score += 1;
    categories.add(categoryLabels.foggyCopy);
    signals.push(
      pickLabel(locale, {
        cs: '„Možnost kariérního růstu“ bez toho, jak přesně růst vypadá, je spíš slogan než informace.',
        sk: '„Možnosť kariérneho rastu“ bez toho, ako presne rast vyzerá, je skôr slogan než informácia.',
        de: '„Karrierewachstum“ ohne jede Erklärung, wie das konkret aussieht, ist eher ein Slogan als eine Information.',
        pl: '„Możliwość rozwoju kariery” bez pokazania, jak ten rozwój wygląda, to bardziej slogan niż konkret.',
        en: '"Career growth opportunity" without saying what growth actually looks like is more slogan than information.',
      })
    );
  }

  const fakeFlexibilityPattern = /(časov[aá] flexibilita|casova flexibilita|flexible schedule|schedule flexibility|čas si organizuješ s[aá]m|manage your own time|own time management|flexibilita dle potřeby firmy|flexibility as needed)/i;
  const realFlexibilityPattern = /(flexible hours|flexibiln[ií] pracovn[ií] doba|core hours|compressed week|4 day week|4denn[ií] pracovn[ií] t[yý]den)/i;
  if (fakeFlexibilityPattern.test(haystack) && !realFlexibilityPattern.test(haystack)) {
    score += 1;
    categories.add(categoryLabels.blurryBoundaries);
    signals.push(
      pickLabel(locale, {
        cs: '„Časová flexibilita“ bez jasných hranic často znamená jen to, že se režim ohýbá hlavně podle firmy.',
        sk: '„Časová flexibilita“ bez jasných hraníc často znamená len to, že režim sa ohýba hlavne podľa firmy.',
        de: '„Zeitliche Flexibilität“ ohne klare Grenzen heißt oft nur, dass sich der Rhythmus vor allem nach der Firma biegt.',
        pl: '„Elastyczność czasu” bez jasnych granic często znaczy tylko tyle, że grafik wygina się głównie pod firmę.',
        en: '"Flexibility" without clear boundaries often just means the schedule bends mostly for the company.',
      })
    );
  }

  const officePerkPattern = /(dog[-\s]?friendly|pet[-\s]?friendly|office snacks|občerstvení|kancelářské občerstvení|parking|parkování|fruit|ovoce v kanceláři|game room|herna)/i;
  if (remoteRole && officePerkPattern.test(haystack)) {
    score += 3;
    categories.add(categoryLabels.fakePerks);
    signals.push(
      pickLabel(locale, {
        cs: 'Remote role a tahání office perks? To už se fakt máme ptát psa, jestli nás snese doma.',
        sk: 'Remote rola a ťahanie office perks? To sa už fakt máme pýtať psa, či nás znesie doma.',
        de: 'Remote-Job plus Office-Perks? Klingt, als müsste erst der Hund Homeoffice freigeben.',
        pl: 'Rola remote i wciskanie office perks? To już serio mamy pytać psa, czy zniesie nas w domu.',
        en: 'Remote role plus office perks? That sounds like asking your dog to approve working from home.',
      })
    );
  }

  const lowValuePerks = normalizedBenefits.filter((benefit) =>
    /(fruit|ovoce|teambuilding|multisport|coffee|káva|notebook|mobilní telefon|mobile phone|firemní akce|company events|party room)/i.test(benefit)
  );
  const realPerks = normalizedBenefits.filter((benefit) =>
    /(home office|remote|bonus|extra vacation|extra dovolen|stock|equity|learning budget|vzdělávání|sick day|health|therapy|pension|penzijní|13\.? plat|14\.? plat|flexible hours|flexibilní pracovní doba)/i.test(benefit)
  );
  if (lowValuePerks.length >= 2 && realPerks.length === 0) {
    score += 2;
    categories.add(categoryLabels.fakePerks);
    signals.push(
      pickLabel(locale, {
        cs: 'Tady je dost vaty a málo reality. Ovoce, teambuilding a notebook nejsou game changer.',
        sk: 'Je tu dosť vaty a málo reality. Ovocie, teambuilding a notebook nie sú game changer.',
        de: 'Hier ist viel Watte und wenig Realität. Obst, Teambuilding und ein Laptop sind kein Gamechanger.',
        pl: 'Jest tu sporo waty i mało konkretu. Owoce, teambuilding i laptop to nie game changer.',
        en: 'There is a lot of fluff and not much substance here. Fruit, teambuilding, and a laptop are not game changers.',
      })
    );
  }

  if (/above[-\s]?standard|nadstandardní ohodnocení|atraktivní finanční ohodnocení|zajímavé benefity|great benefits|amazing perks/i.test(haystack) && realPerks.length === 0) {
    score += 2;
    categories.add(categoryLabels.fakePerks);
    signals.push(
      pickLabel(locale, {
        cs: '„Zajímavé benefity“ bez konkrétních karet na stole je spíš parfém než informace.',
        sk: '„Zaujímavé benefity“ bez konkrétnych kariet na stole sú skôr parfum než informácia.',
        de: '„Tolle Benefits“ ohne konkrete Karten auf dem Tisch sind eher Parfüm als Information.',
        pl: '„Świetne benefity” bez konkretów na stole to bardziej perfumy niż informacja.',
        en: '"Interesting benefits" without specifics is perfume, not information.',
      })
    );
  }

  const salaryMissing = !Number(job.salary_from || 0) && !Number(job.salary_to || 0) && !String(job.salaryRange || '').trim();
  const hasConcreteSalary =
    Number(job.salary_from || 0) > 0
    || Number(job.salary_to || 0) > 0
    || /\b\d{2,3}\s?\d{3}\s*(kč|czk|eur|€)?\b/i.test(compensationHaystack)
    || /\b\d{2,3}\s?(?:000|tis\.?|kč|czk|eur|€)\b/i.test(salaryText)
    || /\b\d+\s*[-–]\s*\d+\s*(kč|czk|eur|€|tis\.?)\b/i.test(compensationHaystack);
  if (hasConcreteSalary) {
    greenFlags.push(
      pickLabel(locale, {
        cs: 'konkrétně popsané peníze',
        sk: 'konkrétne popísané peniaze',
        de: 'konkret beschriebene Vergütung',
        pl: 'konkretnie opisana płaca',
        en: 'concrete pay information',
      })
    );
  }

  if (salaryMissing && /competitive salary|atraktivní mzda|motivující finanční ohodnocení|nadstandardní mzda/i.test(haystack)) {
    score += 1;
    categories.add(categoryLabels.payFog);
    signals.push(
      pickLabel(locale, {
        cs: '„Atraktivní mzda“ bez čísla je pořád jen kouř.',
        sk: '„Atraktívna mzda“ bez čísla je stále len dym.',
        de: '„Attraktives Gehalt“ ohne Zahl ist immer noch nur Rauch.',
        pl: '„Atrakcyjne wynagrodzenie” bez liczby to dalej tylko dym.',
        en: '"Competitive salary" without a number is still smoke.',
      })
    );
  }

  const corporateFogMatches = haystack.match(/(dynamic team|dynamický tým|young team|mladý kolektiv|family atmosphere|rodinná atmosféra|market leader|lídr na trhu|pleasant environment|příjemné pracovní prostředí|interesting work|zajímavá práce|varied work|různorodá práce|opportunity for growth|možnost růstu|stability of a strong company|stabilita silné společnosti|friendly team|přátelský kolektiv)/gi) || [];
  if (corporateFogMatches.length >= 3) {
    score += 2;
    categories.add(categoryLabels.foggyCopy);
    signals.push(
      pickLabel(locale, {
        cs: 'Text je plný korporátní mlhy. Hodně atmosféry a málo konkrétní reality práce.',
        sk: 'Text je plný korporátnej hmly. Veľa atmosféry a málo konkrétnej reality práce.',
        de: 'Der Text ist voller Corporate-Nebel. Viel Atmosphäre, wenig konkrete Arbeitsrealität.',
        pl: 'Tekst jest pełen korporacyjnej mgły. Dużo atmosfery, mało konkretnej rzeczywistości pracy.',
        en: 'The listing is heavy on corporate fog. Plenty of atmosphere, not enough concrete work reality.',
      })
    );
  }

  const responsibilitySignals = haystack.match(/(odpovědnost|náplň práce|co budeš dělat|your role|responsibilities|you will|budeš mít na starosti)/gi) || [];
  if (responsibilitySignals.length > 0) {
    greenFlags.push(
      pickLabel(locale, {
        cs: 'jasně popsaná náplň práce',
        sk: 'jasne popísaná náplň práce',
        de: 'klar beschriebene Aufgaben',
        pl: 'jasno opisany zakres pracy',
        en: 'clearly described responsibilities',
      })
    );
  }

  if (/(hybrid|remote|onsite|on-site|na místě|na miste|práce z domova|home office)/i.test(haystack)) {
    greenFlags.push(
      pickLabel(locale, {
        cs: 'srozumitelně popsaný režim práce',
        sk: 'zrozumiteľne popísaný režim práce',
        de: 'klar beschriebener Arbeitsmodus',
        pl: 'jasno opisany tryb pracy',
        en: 'clearly described work mode',
      })
    );
  }

  if (concreteGrowthPattern.test(haystack)) {
    greenFlags.push(
      pickLabel(locale, {
        cs: 'konkrétní rozvoj nebo mentoring',
        sk: 'konkrétny rozvoj alebo mentoring',
        de: 'konkrete Entwicklung oder Mentoring',
        pl: 'konkretny rozwój lub mentoring',
        en: 'concrete growth or mentoring',
      })
    );
  }

  if (description.length > 500 && responsibilitySignals.length === 0) {
    score += 1;
    categories.add(categoryLabels.vagueRole);
    signals.push(
      pickLabel(locale, {
        cs: 'Dlouhý text, ale skoro žádné konkrétní „co budeš dělat“. To je podezřelé samo o sobě.',
        sk: 'Dlhý text, ale skoro žiadne konkrétne „čo budeš robiť“. To je podozrivé samo osebe.',
        de: 'Ein langer Text, aber fast nichts Konkretes zu „was du tun wirst“. Das ist schon für sich verdächtig.',
        pl: 'Długi tekst, ale prawie nic konkretnego o tym, „co będziesz robić”. To samo w sobie jest podejrzane.',
        en: 'A long listing with barely any concrete “what you will do” is suspicious on its own.',
      })
    );
  }

  score = Math.min(score, BULLSHIT_MAX_SCORE);
  const tone: BullshitTone = score >= 5 ? 'bullshit' : score >= 2 ? 'watch' : 'clean';
  const categoryList = Array.from(categories).slice(0, 4);
  const dedupedGreenFlags = Array.from(new Set(greenFlags)).slice(0, 4);
  return {
    score,
    maxScore: BULLSHIT_MAX_SCORE,
    tone,
    signals: signals.slice(0, 3),
    categories: categoryList,
    summary: buildSummary(locale, categoryList, tone),
    greenFlags: dedupedGreenFlags,
    greenSummary: buildGreenSummary(locale, dedupedGreenFlags),
  };
};
