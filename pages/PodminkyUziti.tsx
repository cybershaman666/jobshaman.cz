import { BrainCircuit } from 'lucide-react';
import LegalPage from '../components/LegalPage';

const PodminkyUziti = () => {
  return (
    <LegalPage title="Podmínky užití" icon={BrainCircuit}>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h2>VŠEOBECNÉ OBCHODNÍ PODMÍNKY PORTÁLU JOBSHAMAN.COM</h2>
        
        <h3>1. Úvodní ustanovení</h3>
        <p>
          Provozovatelem portálu JobShaman.com je společnost Beyond Caveman s.r.o., IČO: 10733493, se sídlem Jaurisova 515/4, Michle, 140 00 Praha (dále jen „Provozovatel"). Tyto podmínky upravují práva a povinnosti osob využívajících portál (dále jen „Uživatel").
        </p>

        <h3>2. Charakter služby</h3>
        <p>
          JobShaman.com je informační platforma, která agreguje pracovní nabídky z veřejně dostupných zdrojů a zprostředkovává nabídky vzdělávacích kurzů od partnerů.
        </p>
        <p>
          Provozovatel není zaměstnavatelem ani zprostředkovatelem zaměstnání ve smyslu zákona o zaměstnanosti. Provozovatel neodpovídá za obsah, pravdivost ani aktuálnost inzerátů převzatých od třetích stran.
        </p>

        <h3>3. Registrace a uživatelský profil</h3>
        <p>
          Uživatel nahráním svého životopisu (CV) a registrací souhlasí s automatizovaným zpracováním dat za účelem analýzy dovedností (tzv. Skills Gap analýza).
        </p>
        <p>
          Uživatel odpovídá za to, že jím nahrané dokumenty neobsahují škodlivý kód a že má právo s nimi nakládat.
        </p>

        <h3>4. Vzdělávací Marketplace</h3>
        <p>
          JobShaman umožňuje Uživateli projevit zájem o kurzy třetích stran (Partnerů).
        </p>
        <p>
          Samotný smluvní vztah ohledně vzdělávání vzniká přímo mezi Uživatelem a Partnerem (vzdělávací institucí). Provozovatel neodpovídá za kvalitu ani realizaci těchto kurzů.
        </p>
        <p>
          Informace o dotacích (např. Úřad práce) jsou informačního charakteru. O přiznání dotace rozhoduje výhradně příslušný státní orgán.
        </p>

        <h3>5. Závěrečná ustanovení</h3>
        <p>
          Provozovatel si vyhrazuje právo kdykoliv omezit nebo ukončit přístup Uživatele k portálu, zejména při porušení těchto podmínek.
        </p>

        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tyto podmínky jsou platné od dne 23. ledna 2026.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            V případě dotazů kontaktujte nás na <a href="mailto:floki@jobshaman.cz" className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">floki@jobshaman.cz</a>
          </p>
        </div>
      </div>
    </LegalPage>
  );
};

export default PodminkyUziti;