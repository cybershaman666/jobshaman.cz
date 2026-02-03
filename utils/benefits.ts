// HELPER: Benefit keyword mapping for smart filtering
export const BENEFIT_KEYWORDS: Record<string, string[]> = {
    'Remote First': ['remote', 'home office', 'home-office', 'z domova', 'práce na dálku', 'homeoffice', 'arbeit von zu hause', 'praca zdalna', 'zdalnie'],
    'Flexibilní doba': ['flexibilní', 'pružná', 'volná pracovní doba', 'flexibilita', 'flexibel', 'gleitzeit', 'elastyczne godziny', 'elastyczny czas'],
    '5 týdnů dovolené': ['5 týdnů', '25 dnů', 'týden dovolené navíc', 'dovolená 5 týdnů', '25 dní', '30 tage urlaub', '25 tage urlaub', '26 dni urlopu', 'dodatkowy urlop'],
    'Dog Friendly': ['dog', 'pes', 'psa', 'pet friendly', 'hund', 'tierfreundlich', 'przyjazne zwierzętom'],
    'Stravení': ['stravené', 'oběd', 'jídlo', 'káva', 'nápoje', 'mittagessen', 'kantine', 'essens', 'bony żywieniowe', 'posiłki', 'karta lunchowa'],
    'Vzdělávání': ['školení', 'kurz', 'certifikace', 'vzdělávání', 'školné', 'školenia', 'training', 'weiterbildung', 'szkolenia', 'kursy'],
    'Příspěvek na penzijní': ['penzijo', 'penzijní připojištění', 'doplňkové penzijní spoření', 'betriebliche altersvorsorge', 'rentenversicherung', 'emerytalne'],
    'MultiSportka': ['multisport', 'sport', 'fitness', 'posilovna', 'bazén', 'sauna', 'sportpaket', 'karta multisport', 'pakiet sportowy'],
    'Služební telefon': ['telefon', 'služební mobil', 'firemní telefon', 'diensthandy', 'firmenhandy', 'telefon służbowy'],
    'Notebook': ['notebook', 'laptop', 'pracovní notebook', 'firemní notebook', 'arbeitslaptop', 'laptop służbowy'],
    'Auto': ['auto', 'služební auto', 'firemní auto', 'vozidlo', 'dienstwagen', 'firmenwagen', 'samochód służbowy'],
    '13. plat': ['13 plat', '13 týdnů', ' třináctý plat', '13. gehalt', 'trzynasta pensja'],
    'Příplatky za práci z domova': ['home office příspěvek', 'příplatek home office', 'práce z domova příspěvek', 'homeoffice zuschuss', 'dodatek za pracę zdalną'],
    'Bonusy/prémie': ['bonus', 'prémie', 'roční bonus', 'výkonostní odměna', 'bonusy', 'premia', 'prämie'],
    'Akcie': ['akcie', 'stock options', 'podíly', 'mitarbeiteraktien', 'aktienoptionen', 'opcje na akcje'],
    'Kafetérie': ['kavárna', 'jídelna', 'kantýna', 'cafeteria', 'kafeteria'],
    'Zdravotní péče': ['zdravotní péče', 'zdravotní připojištění', 'nadstandardní péče', 'private krankenversicherung', 'opieka medyczna', 'prywatna opieka'],
    'Dovolená navíc': ['extra dovolená', 'dovolená navíc', 'týden navíc', 'zusatzurlaub', 'dodatkowy urlop']
};

// HELPER: Remove accents for robust searching (Brno == Brňo, Plzen == Plzeň)
export const removeAccents = (str: any) => {
    if (!str) return '';
    if (typeof str !== 'string') return String(str).toLowerCase();
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};
