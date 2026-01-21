import React from 'react';
import { Shield, Lock, Eye, Users, Database, FileText, AlertTriangle } from 'lucide-react';

interface PolicyPageProps {
  theme?: 'light' | 'dark';
}

const PrivacyPolicyPage: React.FC<PolicyPageProps> = ({ theme = 'light' }) => {
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900';
  const cardClass = isDark 
    ? 'bg-slate-800 border-slate-700' 
    : 'bg-white border-slate-200';
  const sectionClass = isDark ? 'border-slate-700' : 'border-slate-200';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 mx-auto mb-4 text-indigo-600" />
          <h1 className="text-3xl font-bold mb-2">Zásady ochrany osobních údajů</h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-lg`}>
            Poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
          </p>
          <p className={`${isDark ? 'text-slate-300' : 'text-slate-500'} mt-2 max-w-2xl`}>
            JobShaman respektuje vaše soukromí a je váán General Data Protection Regulation (GDPR).
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Introduction */}
          <section className={`p-6 rounded-lg ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              1. Informace shromažďované o vás
            </h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Jaké údaje shromažďujeme
                  </h3>
                  <ul className="space-y-2">
                    <li>• <strong>Jméno a kontaktní údaje</strong> - Při registraci účtu</li>
                    <li>• <strong>Uživatelský profil</strong> - Profesní informace, dovednosti, vzdělání</li>
                    <li>• <strong>Životopis (CV)</strong> - Pokud ho nahráte</li>
                    <li>• <strong>Nastavení preferencí</strong> - Typ dopravy, mzdová očekávání</li>
                    <li>• <strong>Historie interakcí</strong> - Uložené pozice, žádosti o práci</li>
                  </ul>
                </div>
                
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    Jak údaje používáme
                  </h3>
                  <ul className="space-y-2">
                    <li>• <strong>Personalizace obsahu</strong> - Doporučení relevantních pozic</li>
                    <li>• <strong>Analytika chování</strong> - Zlepšování uživatelského zážitku</li>
                    <li>• <strong>Komunikace s firmami</strong> - Zprostředkování kontaktů</li>
                    <li>• <strong>Statistiky a reporty</strong> - Analýza trhu práce</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Legal Basis */}
          <section className={`p-6 rounded-lg ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Lock className="w-6 h-6 text-indigo-600" />
              2. Právní základ zpracování
            </h2>
            <div className="space-y-4">
              <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} leading-relaxed`}>
                Vaše osobní údaje zpracováváme na základě:
              </p>
              <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-2">GDPR (Nařízení EU 2016/679)</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Souhlas se zpracováním</strong> - Udělujete souhlas</li>
                    <li>• <strong>Právo na informace</strong> - Přehled o všech shromažďovaných údajích</li>
                    <li>• <strong>Právo na opravu</strong> - Možnost úpravy vašich údajů</li>
                    <li>• <strong>Právo být zapomenut</strong> - Mazání dat na vyžádání</li>
                    <li>• <strong>Omezená doba uložení</strong> - 2 roky od poslední aktivity</li>
                  </ul>
                </div>
                
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-2">Zákon č. 110/2019 Sb.</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Ochrana osobních údajů</strong> - Technická a organizační opatření</li>
                    <li>• <strong>Zpracování osobních údajů</strong> - Postupy a podmínky</li>
                    <li>• <strong>Povinnosti správce</strong> - Směrné orgány dohledu</li>
                    <li>• <strong>Práva subjektů údajů</strong> - Vaše práva vztahující se k údajům</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className={`p-6 rounded-lg ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-indigo-600" />
              3. Zabezpečení dat
            </h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-3">Technická opatření</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Šifrování</strong> - HTTPS na všech stránkách</li>
                    <li>• <strong>Šifrování databáze</strong> - Všechna citlivá data jsou šifrována</li>
                    <li>• <strong>Přístupová práva</strong> - Přísná kontrola přístupu</li>
                    <li>• <strong>Pravidelné audity</strong> - Testování bezpečnosti</li>
                  </ul>
                </div>
                
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-3">Organizační opatření</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Minimalizace dat</strong> - Shromažďujeme jen nezbytné údaje</li>
                    <li>• <strong>Přístup k datům</strong> - Omezený jen na autorizované osoby</li>
                    <li>• <strong>Školení zaměstnanců</strong> - GDPR školení pro personál</li>
                    <li>• <strong>Smlouvy o důvěrnosti</strong> - Písemné závazky mlčenosti</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section className={`p-6 rounded-lg ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4">4. Vaše práva</h2>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-3">Právo na přístup</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Export všech vašich dat ve formátu JSON</li>
                    <li>• Přehled všech zpracovaných údajů</li>
                    <li>• Historie vašich aktivit</li>
                  </ul>
                </div>
                
                <div className={`p-4 rounded-lg border ${sectionClass}`}>
                  <h3 className="font-semibold mb-3">Právo na mazání</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Smazání účtu s veškerými daty</li>
                    <li>• "Právo být zapomenut" - automatické mazání</li>
                    <li>• Potvrzení mazání e-mailem</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className={`p-6 rounded-lg ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-indigo-600" />
              5. Kontakt a stížnosti
            </h2>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${sectionClass}`}>
                <h3 className="font-semibold mb-3">Ochrana údajů</h3>
                <p className="text-sm leading-relaxed mb-3">
                  Pokud máte dotazy ohledně ochrany osobních údajů, kontaktujte nás:
                </p>
                <div className="space-y-2">
                  <div><strong>E-mail:</strong> <a href="mailto:privacy@jobshaman.cz" className="text-indigo-600 hover:underline">privacy@jobshaman.cz</a></div>
                  <div><strong>Telefon:</strong> +420 123 456 789</div>
                </div>
              </div>
              
              <div className={`p-4 rounded-lg border ${sectionClass}`}>
                <h3 className="font-semibold mb-3">Úřad pro ochranu osobních údajů</h3>
                <p className="text-sm leading-relaxed mb-3">
                  Stížnosti na zpracování osobních údajů můžete podat:
                </p>
                <div className="space-y-2">
                  <div><strong>ÚOOÚ:</strong> Úřad pro ochranu osobních údajů</div>
                  <div><strong>Adresa:</strong> Příbržní 1, 110 00 Praha 1</div>
                  <div><strong>E-mail:</strong> podatelna@uoou.cz</div>
                  <div><strong>Web:</strong> <a href="https://www.uoou.cz" className="text-indigo-600 hover:underline" target="_blank" rel="noopener">www.uoou.cz</a></div>
                </div>
              </div>
            </div>
          </section>

          {/* Policy Updates */}
          <section className={`p-6 rounded-lg border-2 ${isDark ? 'border-amber-700' : 'border-amber-200'} ${isDark ? 'bg-amber-900/20' : 'bg-amber-50'}`}>
            <h2 className="text-2xl font-bold mb-4">6. Změny zásad</h2>
            <p className={`${isDark ? 'text-amber-200' : 'text-amber-800'} leading-relaxed`}>
              Všechny změny v těchto zásadách ochrany osobních údajů budou oznámeny na této stránce a také e-mailem, pokud jste registrován uživatel.
            </p>
            <p className={`${isDark ? 'text-amber-200' : 'text-amber-800'} mt-3`}>
              Poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className={`mt-8 pt-6 border-t ${sectionClass}`}>
          <div className="text-center">
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm`}>
              Tento dokument je platný od {new Date().toLocaleDateString('cs-CZ')}.
            </p>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm mt-2`}>
              JobShaman s.r.o. | IČO: 12345678 | Dorožní 1, 110 00 Praha 1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;