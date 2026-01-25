// HELPER: Benefit keyword mapping for smart filtering
export const BENEFIT_KEYWORDS: Record<string, string[]> = {
    'Remote First': ['remote', 'home office', 'home-office', 'z domova', 'práce na dálku'],
    'Flexibilní doba': ['flexibilní', 'pružná', 'volná pracovní doba', 'flexibilita'],
    '5 týdnů dovolené': ['5 týdnů', '25 dnů', 'týden dovolené navíc', 'dovolená 5 týdnů', '25 dní'],
    'Dog Friendly': ['dog', 'pes', 'psa', 'pet friendly'],
    'Stravení': ['stravené', 'oběd', 'jídlo', 'káva', 'nápoje'],
    'Vzdělávání': ['školení', 'kurz', 'certifikace', 'vzdělávání', 'školné', 'školenia'],
    'Příspěvek na penzijní': ['penzijo', 'penzijní připojištění', 'doplňkové penzijní spoření'],
    'MultiSportka': ['multisport', 'sport', 'fitness', 'posilovna', 'bazén', 'sauna'],
    'Služební telefon': ['telefon', 'služební mobil', 'firemní telefon'],
    'Notebook': ['notebook', 'laptop', 'pracovní notebook', 'firemní notebook'],
    'Auto': ['auto', 'služební auto', 'firemní auto', 'vozidlo'],
    '13. plat': ['13 plat', '13 týdnů', ' třináctý plat'],
    'Příplatky za práci z domova': ['home office příspěvek', 'příplatek home office', 'práce z domova příspěvek'],
    'Bonusy/prémie': ['bonus', 'prémie', 'roční bonus', 'výkonostní odměna'],
    'Akcie': ['akcie', 'stock options', 'podíly'],
    'Kafetérie': ['kavárna', 'jídelna', 'kantýna', 'cafeteria'],
    'Zdravotní péče': ['zdravotní péče', 'zdravotní připojištění', 'nadstandardní péče'],
    'Dovolená navíc': ['extra dovolená', 'dovolená navíc', 'týden navíc']
};

// HELPER: Remove accents for robust searching (Brno == Brňo, Plzen == Plzeň)
export const removeAccents = (str: any) => {
    if (!str) return '';
    if (typeof str !== 'string') return String(str).toLowerCase();
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};