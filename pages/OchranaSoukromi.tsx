import { Shield } from 'lucide-react';
import LegalPage from '../components/LegalPage';

const OchranaSoukromi = () => {
  return (
    <LegalPage title="Ochrana soukromí" icon={Shield}>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h2>ZÁSADY ZPRACOVÁNÍ OSOBNÍCH ÚDAJŮ (GDPR)</h2>
        
        <h3>1. Správce osobních údajů</h3>
        <p>
          Správcem je společnost Beyond Caveman s.r.o., IČO: 10733493, sídlo Jaurisova 515/4, Michle, 140 00 Praha.
        </p>

        <h3>2. Rozsah a účel zpracování</h3>
        <p>
          Zpracováváme údaje, které nám poskytnete (zejména jméno, e-mail, údaje v životopisu) za účelem:
        </p>
        <ul>
          <li>Poskytování služeb portálu (analýza shody s pracovními nabídkami).</li>
          <li>Zprostředkování kontaktu mezi Vámi a partnery v Marketplace (pokud projevíte zájem o kurz).</li>
          <li>Statistické analýzy trhu práce a efektivity vzdělávání (anonymizovaně).</li>
        </ul>

        <h3>3. AI analýza a předávání dat</h3>
        <p>
          <strong>AI analýza:</strong> Pro analýzu Vašeho životopisu využíváme technologii OpenAI API. Vaše data jsou zasílána k jednorázové analýze a nejsou využívána k trénování veřejných modelů AI.
        </p>
        <p>
          <strong>Cloud:</strong> Data jsou bezpečně uložena v infrastruktuře Supabase (EU datacentra).
        </p>
        <p>
          <strong>Předávání:</strong> Vaše údaje předáme Partnerovi (vzdělávací instituci) pouze v případě, že u konkrétního kurzu kliknete na tlačítko vyjadřující zájem.
        </p>

        <h3>4. Doba uložení</h3>
        <p>
          Osobní údaje uchováváme po dobu nezbytnou k poskytování služby, nebo do doby, než požádáte o jejich smazání. Inaktivní profily a staré inzeráty jsou automaticky promazávány (standardně po 25 dnech, pokud není nastaveno jinak).
        </p>

        <h3>5. Vaše práva</h3>
        <p>
          Máte právo požadovat přístup ke svým údajům, jejich opravu, výmaz, nebo omezení zpracování. Své požadavky posílejte na <a href="mailto:floki@jobshaman.cz" className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">floki@jobshaman.cz</a>.
        </p>

        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tyto zásady jsou platné od dne 23. ledna 2026.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Pro aktuální kontakt a další informace navštivte naši hlavní stránku.
          </p>
        </div>
      </div>

      {/* Contact Section */}
      <div className="mt-8 text-center">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 mb-4">
            <span className="text-xl">📧</span>
            <span className="font-medium">Kontakt na ochranu údajů</span>
          </div>
          <a 
            href="mailto:floki@jobshaman.cz" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            <span>Kontaktovat DPO</span>
          </a>
        </div>
      </div>
    </LegalPage>
  );
};

export default OchranaSoukromi;