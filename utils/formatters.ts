export const formatJobDescription = (description: string): string => {
    if (!description) return '';

    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const INLINE_HEADINGS = [
        'Nabízíme',
        'Nabizime',
        'Požadujeme',
        'Pozadujeme',
        'Pracovní náplň',
        'Pracovní napln',
        'Náplň práce',
        'Napln prace',
        'Co vás čeká',
        'Co vas ceka',
        'Co bude Vaší náplní práce',
        'Co bude Vasi naplni prace',
        'Co bude Vaší náplní práce?',
        'Co bude Vasi naplni prace?',
        'Co bude Vaší náplní',
        'Co bude Vasi naplni',
        'Co bude Vaší náplní?',
        'Co bude Vasi naplni?',
        'Co bude Vaší prací',
        'Co bude Vasi praci',
        'Co bude Vaší prací?',
        'Co bude Vasi praci?',
        'Co bude Vaším úkolem',
        'Co bude Vasim ukolem',
        'Co bude Vaším úkolem?',
        'Co bude Vasim ukolem?',
        'Co bude Vaší rolí',
        'Co bude Vasi roli',
        'Co bude Vaší rolí?',
        'Co bude Vasi roli?',
        'Co bude Vaší odpovědností',
        'Co bude Vasi odpovednosti',
        'Co bude Vaší odpovědností?',
        'Co bude Vasi odpovednosti?',
        'Co bude Vaší zodpovědností',
        'Co bude Vasi zodpovednosti',
        'Co bude Vaší zodpovědností?',
        'Co bude Vasi zodpovednosti?',
        'Jaké znalosti a dovednosti byste měli mít',
        'Jake znalosti a dovednosti byste meli mit',
        'Co vám můžeme nabídnout',
        'Co vam muzeme nabidnout',
        'Co vám môžeme ponúknuť',
        'Co vam mozeme ponuknut',
        'Co vám můžeme nabídnout',
        'Co vám nabídneme',
        'Co vam nabidneme',
        'Co nabízíme',
        'Co nabízíme:',
        'Co vam muzeme nabidnout:',
        'Co vam nabidneme:',
        'Co mozeme ponuknut',
        'Co môžeme ponúknuť',
        'Co môžeme ponúknuť:',
        'Co mozeme ponuknut:',
        'Co vás čeká:',
        'Co vas ceka:',
        'Jaké znalosti a dovednosti byste měli mít:',
        'Jake znalosti a dovednosti byste meli mit:',
        'Co vám můžeme nabídnout:',
        'Co vam muzeme nabidnout:',
        'Co vám môžeme ponúknuť:',
        'Co vam mozeme ponuknut:',
        'Koho hledáme',
        'Koho hledame',
        'Koho hledáme:',
        'Koho hledame:',
        'Koho potřebujeme',
        'Koho potrebujeme',
        'Koho potřebujeme:',
        'Koho potrebujeme:',
        'Naše požadavky',
        'Nase pozadavky',
        'Naše požadavky:',
        'Nase pozadavky:',
        'Naše očekávání',
        'Nase ocekavani',
        'Naše očekávání:',
        'Nase ocekavani:',
        'Co očekáváme',
        'Co ocekavame',
        'Co očekáváme:',
        'Co ocekavame:',
        'Co požadujeme',
        'Co pozadujeme',
        'Co požadujeme:',
        'Co pozadujeme:',
        'Co od Vás očekáváme',
        'Co od Vas ocekavame',
        'Co od Vás očekáváme?',
        'Co od Vas ocekavame?',
        'Co od tebe očekáváme',
        'Co od tebe ocekavame',
        'Co od tebe očekáváme?',
        'Co od tebe ocekavame?',
        'Co od Vás očekáváme:',
        'Co od Vas ocekavame:',
        'Požadavky na pozici',
        'Pozadavky na pozici',
        'Požadavky na pozici:',
        'Pozadavky na pozici:',
        'Požadavky na kandidáta',
        'Pozadavky na kandidata',
        'Požadavky na kandidáta:',
        'Pozadavky na kandidata:',
        'Požadavky na uchazeče',
        'Pozadavky na uchazece',
        'Požadavky na uchazeče:',
        'Pozadavky na uchazece:',
        'Znalosti a dovednosti',
        'Znalosti a dovednosti:',
        'Znalosti',
        'Znalosti:',
        'Dovednosti',
        'Dovednosti:',
        'Schopnosti',
        'Schopnosti:',
        'Co je pro nás důležité',
        'Co je pro nas dulezite',
        'Co je pro nás důležité:',
        'Co je pro nas dulezite:',
        'Požadované zkušenosti',
        'Pozadovane zkusenosti',
        'Požadované zkušenosti:',
        'Pozadovane zkusenosti:',
        'Minimální požadavky',
        'Minimalni pozadavky',
        'Minimální požadavky:',
        'Minimalni pozadavky:',
        'Výhodou',
        'Vyhodou',
        'Výhodou:',
        'Vyhodou:',
        'Výhodou bude',
        'Vyhodou bude',
        'Výhodou bude:',
        'Vyhodou bude:',
        'Nabídka',
        'Nabidka',
        'Nabídka:',
        'Nabidka:',
        'Benefity',
        'Benefity:',
        'Výhody',
        'Vyhody',
        'Výhody:',
        'Vyhody:',
        'Co získáte',
        'Co ziskate',
        'Co získáte:',
        'Co ziskate:',
        'Co vám nabízíme',
        'Co vam nabizime',
        'Co vám nabízíme:',
        'Co vam nabizime:',
        'Co vám přinese',
        'Co vam prinese',
        'Co vám přinese:',
        'Co vam prinese:',
        'O nás',
        'O nás:',
        'O nas',
        'O nas:',
        'O firmě',
        'O firme',
        'O firmě:',
        'O firme:',
        'O společnosti',
        'O spolocnosti',
        'O společnosti:',
        'O spolocnosti:',
        'Kontakt',
        'Kontakt:',
        'Kontaktní údaje',
        'Kontaktni udaje',
        'Kontaktní údaje:',
        'Kontaktni udaje:',
        'Mzda',
        'Plat',
        'Mzda:',
        'Plat:',
        'Mzdové podmínky',
        'Mzdove podminky',
        'Mzdové podmínky:',
        'Mzdove podminky:',
        'Nástup',
        'Nastup',
        'Nástup:',
        'Nastup:',
        'Nástup možný',
        'Nastup mozny',
        'Nástup možný:',
        'Nastup mozny:',
        'Nástup ihned',
        'Nastup ihned',
        'Nástup ihned:',
        'Nastup ihned:',
        'Místo výkonu práce',
        'Misto vykonu prace',
        'Místo výkonu práce:',
        'Misto vykonu prace:',
        'Pracoviště',
        'Pracoviste',
        'Pracoviště:',
        'Pracoviste:',
        'Lokalita',
        'Lokalita:',
        'Místo práce',
        'Misto prace',
        'Místo práce:',
        'Misto prace:',
        'Jaké budou vaše úkoly',
        'Jake budou vase ukoly',
        'Jaké budou vaše úkoly:',
        'Jake budou vase ukoly:',
        'Popis práce',
        'Popis prace',
        'Popis práce:',
        'Popis prace:',
        'Náplň práce',
        'Napln prace',
        'Náplň práce:',
        'Napln prace:',
        'Co budete dělat',
        'Co budete delat',
        'Co budete dělat:',
        'Co budete delat:',
        'Hledáme',
        'Hledáme:',
        'Hledame',
        'Hledame:',
        'Co tě čeká',
        'Co te ceka',
        'Co tě čeká:',
        'Co te ceka:',
        'Odpovědnosti',
        'Odpovednosti',
        'Zodpovednosti',
        'Požiadavky',
        'Poziadavky',
        'Ponúkame',
        'Ponukame',
        'Wymagania',
        'Oferujemy',
        'Zakres obowiązków',
        'Zakres obowiazkow',
        'Opis stanowiska',
        'Responsibilities',
        'Requirements',
        'We offer',
        'Benefits',
        'Benefits:',
        'Benefits and perks',
        'Benefits and perks:',
        'Our benefits',
        'Our benefits:',
        'What we offer',
        'What we offer:',
        'What you\'ll get',
        'What you’ll get',
        'What you’ll get:',
        'Employee benefits',
        'Employee benefits:',
        'Compensation and benefits',
        'Compensation and benefits:',
        'Perks',
        'Perks:',
        'What we offer',
        'What you will do',
        'Job description',
        'Job description:',
        'Who we are',
        'Who we are:',
        'About us',
        'About us:',
        'About the role',
        'About the role:',
        'Application closing date',
        'Application closing date:',
        'Application deadline',
        'Application deadline:',
        'What you’ll achieve',
        'What you’ll achieve:',
        'What you will achieve',
        'What you will achieve:',
        'Here’s what we are looking for',
        'Here’s what we are looking for with this role',
        'Here’s what we are looking for with this role:',
        'Here is what we are looking for',
        'Here is what we are looking for:',
        'Essential Requirements',
        'Essential Requirements:',
        'Preferred Requirements',
        'Preferred Requirements:',
        'Nice to have',
        'Nice to have:',
        'Required Qualifications',
        'Required Qualifications:',
        'Preferred Qualifications',
        'Preferred Qualifications:',
        'Aufgaben',
        'Anforderungen',
        'Wir bieten'
    ];
    const inlineHeadingRegex = new RegExp(`\\s*(${INLINE_HEADINGS.map(escapeRegex).join('|')})\\s*:`, 'gi');
    const inlineHeadingLooseRegex = new RegExp(`\\s*(${INLINE_HEADINGS.map(escapeRegex).join('|')})(?=\\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])`, 'gi');
    // Start inline bullet lists only at line start or after punctuation.
    const inlineBulletStartRegex = /(^|[.!?:;)\]]\s+)[-–—]\s(?=(?:[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9]|[^\w\s]))/gm;
    // Generic inline bullet separator used for dense one-line descriptions.
    const inlineBulletInnerRegex = /\s[-–—]\s(?=(?:[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9]|[^\w\s]))/g;
    const inlineBulletMarkerCount = (description.match(inlineBulletInnerRegex) || []).length;
    const hasInlineBullets = inlineBulletMarkerCount >= 3;

    const normalizeDashToken = (token: string): string =>
        token.replace(/^[^A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž0-9]+|[^A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž0-9]+$/g, '');

    const isUpperToken = (token: string): boolean => {
        if (!token) return false;
        const hasLetter = /[A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž]/.test(token);
        if (!hasLetter) return false;
        return token === token.toUpperCase();
    };

    const splitInlineBulletSegments = (value: string, aggressive: boolean): string => {
        if (!aggressive) {
            return value.replace(inlineBulletStartRegex, '$1\n- ');
        }

        return value.replace(inlineBulletInnerRegex, (match, offset, full) => {
            const leftSlice = full.slice(0, offset as number).trimEnd();
            const rightSlice = full.slice((offset as number) + match.length).trimStart();
            const leftTokenRaw = leftSlice.split(/\s+/).pop() || '';
            const rightTokenRaw = rightSlice.split(/\s+/)[0] || '';
            const leftToken = normalizeDashToken(leftTokenRaw);
            const rightToken = normalizeDashToken(rightTokenRaw);

            // Keep company/title patterns like "ALBA - METAL" as plain text.
            if (
                leftToken &&
                rightToken &&
                leftToken.length <= 16 &&
                rightToken.length <= 16 &&
                isUpperToken(leftToken) &&
                isUpperToken(rightToken)
            ) {
                return match;
            }

            return '\n- ';
        });
    };

    const rawLines = description
        // Repair common OCR/scrape issue: missing space after sentence punctuation.
        .replace(/([.!?])(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/g, '$1 ')
        .replace(inlineHeadingLooseRegex, '\n$1:\n')
        .replace(inlineHeadingRegex, '\n$1:\n')
        .replace(/[\s\S]*/, (value) => splitInlineBulletSegments(value, hasInlineBullets))
        // Preserve list-like separators into newlines so we can render bullets naturally.
        .replace(/([.;])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/g, '$1\n')
        .replace(/\s{2,}/g, ' ')
        .split(/\r?\n/);

    const isBulletLikeLine = (line: string) => /^[•◦▪▫∙‣⁃]|^[\-\*]\s+/.test(line.trim());
    const isHeadingCandidate = (line: string) => {
        const value = line.trim();
        if (!value) return false;
        if (/:\s*$/.test(value)) return true;
        const normalized = value
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase();
        return INLINE_HEADINGS.some((heading) =>
            normalized === heading
                .normalize('NFD')
                .replace(/\p{M}/gu, '')
                .toLowerCase()
        );
    };
    const shouldMergeWrappedLine = (prev: string, next: string): boolean => {
        const a = prev.trim();
        const b = next.trim();
        if (!a || !b) return false;
        if (isBulletLikeLine(a) || isBulletLikeLine(b)) return false;
        if (isHeadingCandidate(a) || isHeadingCandidate(b)) return false;
        if (/[.!?:]$/.test(a)) return false;
        if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(b) && b.length > 42) return false;
        return true;
    };
    const mergedRawLines: string[] = [];
    for (const raw of rawLines) {
        const trimmed = raw.trim();
        if (!trimmed) {
            mergedRawLines.push('');
            continue;
        }
        const lastIndex = mergedRawLines.length - 1;
        if (lastIndex >= 0 && mergedRawLines[lastIndex] && shouldMergeWrappedLine(mergedRawLines[lastIndex], trimmed)) {
            mergedRawLines[lastIndex] = `${mergedRawLines[lastIndex]} ${trimmed}`;
        } else {
            mergedRawLines.push(trimmed);
        }
    }

    type Line = {
        text: string;
        isBullet: boolean;
        isBlank: boolean;
    };

    const isPlnSalaryNoise = (value: string) => {
        const normalized = value
            .replace(/\s+/g, ' ')
            .replace(/[‐–—]/g, '-')
            .trim();
        if (!normalized) return false;
        const plnToken = /(pln|zł|zl)/i;
        if (!plnToken.test(normalized)) return false;
        const onlyAmount = normalized.replace(/[^\d><=,.\s]/g, '').trim();
        const hasDigits = /\d/.test(onlyAmount);
        const isShort = normalized.length <= 24;
        const looksLikeThreshold = /^[><=]?\s*\d[\d\s.,]*\s*(pln|zł|zl)?$/i.test(normalized);
        return hasDigits && isShort && looksLikeThreshold;
    };

    const lines: Line[] = mergedRawLines.map((raw) => {
        const trimmed = raw.trim();
        const isBlank = trimmed.length === 0;
        const bulletMatch = /^[•◦▪▫∙‣⁃]|^[\-\*]\s+/.test(trimmed);
        const cleaned = trimmed.replace(/^[•◦▪▫∙‣⁃\-\*]+\s*/g, '');
        const skip = isPlnSalaryNoise(cleaned);
        return {
            text: skip ? '' : cleaned,
            isBullet: skip ? false : bulletMatch,
            isBlank: isBlank || skip
        };
    }).filter((line) => !line.isBlank || line.text);

    const isHeading = (line: string) => /^#{1,6}\s+/.test(line) || /:\s*$/.test(line);
    const normalizeToken = (input: string) =>
        input
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .trim();
    const LIST_HEADINGS = [
        'requirements',
        'responsibilities',
        'what you will do',
        'what you will be doing',
        'what you will need',
        'your role',
        'your responsibilities',
        'qualifications',
        'skills',
        'must have',
        'nice to have',
        'we offer',
        'what we offer',
        'benefits',
        'perks',
        'offer',
        'tasks',
        'duties',
        'expected',
        'required',
        'preferable',
        'requirements and qualifications',
        'minimum requirements',
        'preferred qualifications',
        'requirements:',
        'wymagania',
        'obowiazki',
        'obowiązki',
        'zakres obowiazkow',
        'zakres obowiązków',
        'oferujemy',
        'mile widziane',
        'nice to have',
        'oczekiwania',
        'twoje zadania',
        'twoja rola',
        'twoje obowiazki',
        'twoje obowiązki',
        'co bedziesz robic',
        'co będziesz robic',
        'co bedziesz robić',
        'co będziesz robić',
        'co oferujemy',
        'benefity',
        'pozadane',
        'pożądane',
        'pozadane umiejetnosci',
        'pożądane umiejętności',
        'poziadane',
        'pożądane',
        'požiadavky',
        'poziadavky',
        'požiadavky a kvalifikácia',
        'pozadavky',
        'požadavky',
        'co ti nabizime',
        'co ti nabízíme',
        'co nabízíme',
        'nabizime',
        'nabízíme',
        'nabizime:',
        'nabízíme:',
        'benefity a vyhody',
        'benefity a výhody',
        'co budes delat',
        'co budeš dělat',
        'napln prace',
        'náplň práce',
        'odpovednosti',
        'odpovědnosti',
        'zodpovednosti',
        'zodpovědnosti',
        'zodpovednosti a povinnosti',
        'job requirements',
        'job description',
        'key responsibilities',
        'what you bring',
        'what you bring to the table',
        'who you are',
        'what you will have',
        'what we expect',
        'what we need',
        'you should have',
        'skills and experience',
        'experience',
        'your tasks',
        'your mission',
        'what we are looking for',
        'what you will need',
        'what you will deliver',
        'what you can expect',
        'why join us',
        'what we provide',
        'what we guarantee',
        'our offer',
        'benefits and perks',
        'benefits & perks',
        'what we give',
        'what we give you',
        'what we bring',
        'tasks and responsibilities',
        'responsibilities and tasks',
        'requirements and duties',
        'responsibilities:',
        'requirements:',
        'nice to have:',
        'must have:',
        'offer:',
        'benefits:',
        'perks:',
        'o nasich pozadavcich',
        'o našich požadavcích',
        'co je potreba',
        'co je potřeba',
        'co je nutne',
        'co je nutné',
        'pozadujeme',
        'požadujeme',
        'pozadujeme od vas',
        'požadujeme od vás',
        'pozadujeme od tebe',
        'požadujeme od tebe',
        'pozadavky na kandidata',
        'požadavky na kandidáta',
        'pozadovane znalosti',
        'požadované znalosti',
        'pozadovane dovednosti',
        'požadované dovednosti',
        'mame pro vas',
        'máme pro vás',
        'nabizime vam',
        'nabízíme vám',
        'co ti nabidneme',
        'co ti nabídneme',
        'napln pozice',
        'náplň pozice',
        'napln role',
        'náplň role',
        'co budete delat',
        'co budete dělat',
        'co budete mit na starosti',
        'co budete mít na starosti',
        'poziadavky na uchadzaca',
        'požiadavky na uchádzača',
        'pozadovane skusenosti',
        'požadované skúsenosti',
        'poziadavky na poziciu',
        'požiadavky na pozíciu',
        'ponukame',
        'ponúkame',
        'co ponukame',
        'čo ponúkame',
        'co vam ponukame',
        'čo vám ponúkame',
        'co ti ponukame',
        'čo ti ponúkame',
        'vyhody',
        'výhody',
        'benefity a vyhody',
        'benefity a výhody',
        'your profile',
        'your profile:',
        'your profile includes',
        'your skills',
        'your skills:',
        'skills:',
        'technologies',
        'tech stack',
        'stack',
        'stack:',
        'required skills',
        'preferred skills',
        'nice-to-have',
        'nice-to-have:',
        'must-have',
        'must-have:',
        'wymagania:',
        'obowiazki:',
        'obowiązki:',
        'oferujemy:',
        'mile widziane:',
        'zakres obowiazkow:',
        'zakres obowiązków:',
        'twoje zadania:',
        'twoja rola:',
        'twoje obowiazki:',
        'twoje obowiązki:',
        'kwalifikacje',
        'kwalifikacje:',
        'kompetencje',
        'kompetencje:',
        'obowiazki i zadania',
        'obowiązki i zadania',
        'umiejetnosci',
        'umiejętności',
        'umiejetnosci:',
        'umiejętności:',
        'twoj profil',
        'twój profil',
        'twoj profil:',
        'twój profil:',
        'twoje umiejetnosci',
        'twoje umiejętności',
        'twoje umiejetnosci:',
        'twoje umiejętności:',
        'was wir erwarten',
        'was wir erwarten:',
        'anforderungen',
        'anforderungen:',
        'aufgaben',
        'aufgaben:',
        'ihre aufgaben',
        'ihre aufgaben:',
        'ihr profil',
        'ihr profil:',
        'voraussetzungen',
        'voraussetzungen:',
        'wir bieten',
        'wir bieten:',
        'wir bieten ihnen',
        'wir bieten ihnen:',
        'was wir bieten',
        'was wir bieten:',
        'benefits:',
        'vorteile',
        'vorteile:',
        'das bringen sie mit',
        'das bringen sie mit:',
        'das erwartet sie',
        'das erwartet sie:',
        'das bieten wir',
        'das bieten wir:',
        'ihre qualifikationen',
        'ihre qualifikationen:',
        'kenntnisse',
        'kenntnisse:',
        'erfahrung',
        'erfahrung:',
        'skillset',
        'skillset:',
        'what we’re looking for',
        'what were looking for',
        'what we are looking for:',
        'what we expect:',
        'what you will do:',
        'what you will need:',
        'what we offer:',
        'what we provide:',
        'benefits & perks:',
        'perks & benefits',
        'job requirements',
        'job responsibilities',
        'job duties',
        'role responsibilities',
        'role description',
        'role overview',
        'position requirements',
        'position responsibilities',
        'skills and competencies',
        'skills & competencies',
        'skills and knowledge',
        'skills & knowledge',
        'technical skills',
        'soft skills',
        'tools',
        'tools and technologies',
        'tools & technologies',
        'technologies',
        'tech stack',
        'technology stack',
        'stack technologiczny',
        'technologie',
        'technologie i narzedzia',
        'technologie i narzędzia',
        'narzedzia',
        'narzędzia',
        'what you will do:',
        'what you will deliver:',
        'what we expect from you',
        'what we expect from you:',
        'what we need from you',
        'what we need from you:',
        'what you bring:',
        'what you bring to the table:',
        'what you will bring',
        'what you will bring:',
        'co budeš mít na starosti',
        'co budeš mít na starosti:',
        'co budeš dělat',
        'co budeš dělat:',
        'co budete mít na starosti',
        'co budete mít na starosti:',
        'co budete dělat',
        'co budete dělat:',
        'pracovni napln',
        'pracovní náplň',
        'pracovni napln:',
        'pracovní náplň:',
        'napln prace',
        'náplň práce',
        'napln prace:',
        'náplň práce:',
        'napln pozice',
        'náplň pozice',
        'napln pozice:',
        'náplň pozice:',
        'pozadujeme',
        'požadujeme',
        'pozadujeme:',
        'požadujeme:',
        'pozadujeme od vas',
        'požadujeme od vás',
        'pozadujeme od vas:',
        'požadujeme od vás:',
        'pozadujeme od tebe',
        'požadujeme od tebe',
        'pozadujeme od tebe:',
        'požadujeme od tebe:',
        'poziadavky na uchadzaca',
        'požiadavky na uchádzača',
        'poziadavky na uchadzaca:',
        'požiadavky na uchádzača:',
        'poziadavky na zamestnanca',
        'požiadavky na zamestnanca',
        'poziadavky na zamestnanca:',
        'požiadavky na zamestnanca:',
        'poziadavky na poziciu',
        'požiadavky na pozíciu',
        'poziadavky na poziciu:',
        'požiadavky na pozíciu:',
        'co ponukame',
        'čo ponúkame',
        'co ponukame:',
        'čo ponúkame:',
        'ponukame',
        'ponúkame',
        'ponukame:',
        'ponúkame:',
        'vyhody a benefity',
        'výhody a benefity',
        'vyhody a benefity:',
        'výhody a benefity:',
        'benefity a vyhody',
        'benefity a výhody',
        'benefity a vyhody:',
        'benefity a výhody:',
        'wymagania pracodawcy',
        'wymagania pracodawcy:',
        'opis stanowiska',
        'opis stanowiska:',
        'zakres zadan',
        'zakres zadań',
        'zakres zadan:',
        'zakres zadań:',
        'twoj zakres obowiazkow',
        'twój zakres obowiązków',
        'twoj zakres obowiazkow:',
        'twój zakres obowiązków:',
        'twoj zakres zadan',
        'twój zakres zadań',
        'twoj zakres zadan:',
        'twój zakres zadań:',
        'your tasks',
        'your tasks:',
        'your duties',
        'your duties:',
        'was wir suchen',
        'was wir suchen:',
        'wir erwarten',
        'wir erwarten:',
        'ihre aufgaben',
        'ihre aufgaben:',
        'ihre taetigkeiten',
        'ihre tätigkeiten',
        'ihre taetigkeiten:',
        'ihre tätigkeiten:',
        'ihr aufgabengebiet',
        'ihr aufgabengebiet:',
        'ihr profil',
        'ihr profil:',
        'voraussetzungen',
        'voraussetzungen:',
        'anforderungen',
        'anforderungen:',
        'wir bieten',
        'wir bieten:',
        'wir bieten ihnen',
        'wir bieten ihnen:',
        'was wir bieten',
        'was wir bieten:',
        'vorteile',
        'vorteile:'
    ];
    const TAG_HEADINGS = [
        'lokalizacje',
        'lokalizacja',
        'location',
        'locations',
        'misto vykonu prace',
        'místo výkonu práce',
        'miejsce pracy',
        'siedziba',
        'siedziba:',
        'headquarters',
        'headquarters:',
        'kategoria',
        'category',
        'seniority',
        'level',
        'poziom',
        'poziom stanowiska',
        'jazyk',
        'jezyk',
        'jezyk wymagany',
        'jezyk rekrutacji',
        'język rekrutacji',
        'jezyk rekrutacji:',
        'język rekrutacji:',
        'language',
        'languages',
        'work model',
        'typ umowy',
        'contract',
        'contract type',
        'employment type',
        'rodzaj umowy',
        'wielkosc firmy',
        'wielkość firmy',
        'company size',
        'industry',
        'branża',
        'branza',
        'location:',
        'locations:',
        'locality',
        'localities',
        'city',
        'cities',
        'region',
        'country',
        'remote',
        'on-site',
        'onsite',
        'hybrid',
        'work type',
        'working model',
        'working mode',
        'employment',
        'contract type:',
        'employment type:',
        'job type',
        'job category',
        'category:',
        'kategoria:',
        'industry:',
        'branża:',
        'branza:',
        'workplace',
        'workplace:',
        'work location',
        'work location:',
        'position level',
        'level:',
        'seniority:',
        'experience level',
        'experience level:',
        'experience:',
        'job level',
        'job level:',
        'career level',
        'career level:',
        'role level',
        'role level:',
        'company',
        'company:',
        'company size:',
        'company size',
        'about company',
        'about the company',
        'firm size',
        'firm size:',
        'wielkosc firmy:',
        'wielkość firmy:',
        'lokalizacja:',
        'lokalizacje:',
        'miejsce pracy:',
        'misto vykonu prace:',
        'místo výkonu práce:',
        'miasto',
        'miasto:',
        'miasto pracy',
        'miasto pracy:',
        'praca zdalna',
        'praca zdalna:',
        'praca hybrydowa',
        'praca hybrydowa:',
        'pracodawca',
        'pracodawca:',
        'employer',
        'employer:',
        'utworzona w',
        'utworzona w:',
        'founded',
        'founded:',
        'company founded',
        'company founded:',
        'established',
        'established:',
        'company established',
        'company established:',
        'founded in',
        'founded in:',
        'created in',
        'created in:',
        'created',
        'created:',
        'created at',
        'created at:',
        'posted',
        'posted:',
        'posted at',
        'posted at:',
        'wielkosc firmy',
        'wielkosc firmy:',
        'wielkość firmy',
        'wielkość firmy:',
        'size',
        'size:',
        'employees',
        'employees:',
        'headcount',
        'headcount:',
        'liczba pracownikow',
        'liczba pracowników',
        'liczba pracownikow:',
        'liczba pracowników:',
        'salary details',
        'salary details:',
        'salary match',
        'salary match:',
        'salary match score',
        'salary match score:',
        'salary range',
        'salary range:',
        'salary',
        'salary:',
        'details',
        'details:',
        'offer valid to',
        'offer valid to:',
        'oferta wazna do',
        'oferta ważna do',
        'oferta wazna do:',
        'oferta ważna do:',
        'valid to',
        'valid to:',
        'valid until',
        'valid until:',
        'offer ends',
        'offer ends:',
        'deadline',
        'deadline:',
        'term',
        'term:',
        'kraj',
        'kraj:',
        'country:',
        'region:',
        'job location:',
        'job type:',
        'job type',
        'workplace type',
        'workplace type:',
        'work arrangement',
        'work arrangement:',
        'work mode',
        'work mode:',
        'model pracy',
        'model pracy:',
        'tryb pracy',
        'tryb pracy:',
        'forma pracy',
        'forma pracy:',
        'forma zatrudnienia',
        'forma zatrudnienia:',
        'forma wspolpracy',
        'forma współpracy',
        'forma wspolpracy:',
        'forma współpracy:',
        'rodzaj pracy',
        'rodzaj pracy:',
        'rodzaj zatrudnienia',
        'rodzaj zatrudnienia:',
        'kontrakt',
        'kontrakt:',
        'typ kontraktu',
        'typ kontraktu:',
        'typ umowy:',
        'umowa',
        'umowa:',
        'umowa o prace',
        'umowa o pracę',
        'umowa o prace:',
        'umowa o pracę:',
        'b2b',
        'b2b:',
        'full-time',
        'full time',
        'part-time',
        'part time',
        'umowa zlecenie',
        'umowa zlecenie:',
        'umowa o dzielo',
        'umowa o dzieło',
        'umowa o dzielo:',
        'umowa o dzieło:',
        'wynagrodzenie',
        'wynagrodzenie:',
        'szczegoly wynagrodzenia',
        'szczegóły wynagrodzenia',
        'szczegoly wynagrodzenia:',
        'szczegóły wynagrodzenia:',
        'salary details',
        'salary details:',
        'salary range',
        'salary range:',
        'salary',
        'salary:',
        'rate',
        'rate:',
        'start',
        'start:',
        'start pracy',
        'start pracy:',
        'start date',
        'start date:',
        'available from',
        'available from:',
        'valid until',
        'valid until:',
        'offer valid to',
        'offer valid to:',
        'oferta wazna do',
        'oferta ważna do',
        'oferta wazna do:',
        'oferta ważna do:',
        'valid to',
        'valid to:',
        'deadline',
        'deadline:',
        'termin',
        'termin:',
        'termin waznosci',
        'termin ważności',
        'termin waznosci:',
        'termin ważności:',
        'firma',
        'firma:',
        'pracodawca',
        'pracodawca:',
        'employer',
        'employer:',
        'company',
        'company:',
        'o firmie',
        'o firmie:',
        'o spolocnosti',
        'o spoločnosti',
        'o spolocnosti:',
        'o spoločnosti:',
        'informacje o firmie',
        'informacje o firmie:',
        'informacje o pracodawcy',
        'informacje o pracodawcy:',
        'about the company',
        'about the company:',
        'company info',
        'company info:',
        'company information',
        'company information:',
        'details',
        'details:'
    ];
    const normalizeHeadingToken = (value: string) => normalizeToken(value.replace(/:\s*$/, ''));
    const isListHeading = (header: string) => {
        const normalized = normalizeHeadingToken(header);
        return LIST_HEADINGS.some((keyword) => normalized.includes(normalizeHeadingToken(keyword)));
    };
    const isTagHeading = (header: string) => {
        const normalized = normalizeHeadingToken(header);
        return TAG_HEADINGS.some((keyword) => normalized.includes(normalizeHeadingToken(keyword)));
    };
    const isShortToken = (line: string) => {
        if (!line) return false;
        const wordCount = line.split(/\s+/).length;
        return line.length <= 40 && wordCount <= 4;
    };
    const looksLikeSentence = (line: string) => /[.!?]$/.test(line) || line.length > 90;
    const requirementCueRegex = /(experience|years|year|praxe|praxi|zkušenost|zkusenost|skusenost|znalost|schopnost|ability|proficiency|knowledge|certifikat|certifikát|certification|degree|education|vzdělání|vzdelani|qualification|skills|umiejętno[śs]ci|doświadczen|erfahrung|kenntnisse|kenntnis|qualifikation|voraussetzung|requirements)/i;
    const looksLikeRequirementLine = (line: string) =>
        requirementCueRegex.test(line) || line.toLowerCase().startsWith('min.') || line.toLowerCase().startsWith('min ');

    const output: string[] = [];
    let i = 0;

    const splitInlineList = (text: string): string[] => {
        const markerCount = (text.match(inlineBulletInnerRegex) || []).length;
        const hasMarkers = markerCount >= 2;
        const startsAsBullet = /^[•◦▪▫∙‣⁃]|^[\-\*]\s+/.test(text.trim());
        const normalized = text
            .replace(/([.!?])(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/g, '$1 ')
            .replace(inlineHeadingLooseRegex, '\n$1:\n')
            .replace(inlineHeadingRegex, '\n$1:\n')
            .replace(/[\s\S]*/, (value) => splitInlineBulletSegments(value, hasMarkers))
            .replace(startsAsBullet ? inlineBulletInnerRegex : /$^/, '\n- ')
            .replace(/([.;])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/g, '$1\n')
            .replace(/\s{2,}/g, ' ');
        let pieces = normalized
            .split(/\r?\n/)
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => part.replace(/^[•◦▪▫∙‣⁃\-\*]+\s*/g, ''));
        if (
            pieces.length === 1 &&
            pieces[0].split(',').length >= 3 &&
            !/[.!?]/.test(pieces[0])
        ) {
            pieces = pieces[0]
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean);
        }
        return pieces.length ? pieces : [text];
    };

    const pushParagraph = (chunk: string[]) => {
        if (!chunk.length) return;
        if (output.length > 0) output.push('');
        output.push(chunk.join(' '));
    };

    while (i < lines.length) {
        const current = lines[i];

        if (current.isBlank) {
            i += 1;
            continue;
        }

        if (isHeading(current.text)) {
            const header = current.text.replace(/:\s*$/, '');
            const sectionLines: Line[] = [];
            let j = i + 1;
            while (j < lines.length && !isHeading(lines[j].text)) {
                if (!lines[j].isBlank) {
                    sectionLines.push(lines[j]);
                }
                j += 1;
            }

            const texts = sectionLines.map((l) => l.text).filter(Boolean);
            const bulletCount = sectionLines.filter((l) => l.isBullet).length;
            const shortCount = texts.filter(isShortToken).length;
            const sentenceCount = texts.filter(looksLikeSentence).length;
            const requirementLikeCount = texts.filter(looksLikeRequirementLine).length;
            const hasList =
                isListHeading(header) ||
                bulletCount >= 2 ||
                requirementLikeCount >= Math.ceil(texts.length * 0.5) ||
                (texts.length >= 4 && shortCount >= Math.ceil(texts.length * 0.6) && sentenceCount === 0);
            const isTagCloud = isTagHeading(header) || (texts.length >= 8 && shortCount >= Math.ceil(texts.length * 0.7) && sentenceCount === 0);

            if (output.length > 0) output.push('');
            output.push(`**${header}**`);

            if (!texts.length) {
                i = j;
                continue;
            }

            const exploded = texts.flatMap((item) => splitInlineList(item));
            const uniqueTexts = Array.from(new Set(exploded));

            if (isTagCloud) {
                const unique = uniqueTexts;
                const sliced = unique.slice(0, 30);
                const suffix = unique.length > sliced.length ? '…' : '';
                output.push('');
                output.push(sliced.join(', ') + suffix);
            } else if (hasList) {
                output.push('');
                for (const item of uniqueTexts) {
                    output.push(`- ${item}`);
                }
            } else {
                pushParagraph(uniqueTexts);
            }

            i = j;
            continue;
        }

        // Non-heading flow: preserve bullets, otherwise build paragraphs
        if (current.isBullet) {
            if (output.length > 0 && output[output.length - 1] !== '') {
                output.push('');
            }
            const parts = splitInlineList(current.text);
            if (parts.length > 1) {
                for (const part of parts) {
                    output.push(`- ${part}`);
                }
            } else {
                output.push(`- ${current.text}`);
            }
            i += 1;
            continue;
        }

        const paragraph: string[] = [current.text];
        let j = i + 1;
        while (j < lines.length && !lines[j].isBlank && !lines[j].isBullet && !isHeading(lines[j].text)) {
            paragraph.push(lines[j].text);
            j += 1;
        }
        pushParagraph(paragraph);
        i = j;
    }

    return output.join('\n');
};
