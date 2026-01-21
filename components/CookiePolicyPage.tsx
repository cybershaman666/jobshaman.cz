import React from 'react';
import { Cookie, Shield, Clock, Database, Users } from 'lucide-react';

interface CookiePolicyPageProps {
  theme?: 'light' | 'dark';
}

const CookiePolicyPage: React.FC<CookiePolicyPageProps> = ({ theme = 'light' }) => {
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900';
  const cardClass = isDark 
    ? 'bg-slate-800 border-slate-700' 
    : 'bg-white border-slate-200';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Cookie className="w-12 h-12 mx-auto mb-4 text-indigo-600" />
          <h1 className="text-3xl font-bold mb-2">Politika Cookies</h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-lg`}>
            Poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
          </p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4">Co jsou cookies?</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Cookies jsou malé textové soubory, které se ukládají do vašeho prohlížeče při návštěvě našich webových stránek. 
                Používáme cookies k:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-6">
                <li>Udržování vašeho přihlášení a stavu session</li>
                <li>Pamatování si vašich preferencí a nastavení</li>
                <li>Analyzování, jak používáte naše služby</li>
                <li>Zlepšování výkonu a funkčnosti webu</li>
                <li>Přizpůsobení obsahu a reklam relevantních vašim zájmům</li>
              </ul>
            </div>
          </section>

          {/* Types of Cookies */}
          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Cookie className="w-6 h-6 text-indigo-600" />
              Typy cookies, které používáme
            </h2>
            
            <div className="space-y-6">
              {/* Nezbytné cookies */}
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  Nezbytné cookies
                  <span className="ml-2 text-sm text-green-600">(Vždy povoleny)</span>
                </h3>
                <div className="space-y-2">
                  <div><strong>Session cookies:</strong> Udržují vás přihlášeného během používání webu</div>
                  <div><strong>Security cookies:</strong> Chrání před CSRF útoky a bezpečnostní hrozby</div>
                  <div><strong>Functional cookies:</strong> Zajišťují základní funkce jako košík a uložení preferencí</div>
                </div>
              </div>

              {/* Analytické cookies */}
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Analytické cookies
                  <span className="ml-2 text-sm text-blue-600">(Volitelné)</span>
                </h3>
                <div className="space-y-2">
                  <div><strong>Google Analytics:</strong> Pomáhají nám pochopit, jak návštěvníci používají web</div>
                  <div><strong>Hotjar:</strong> Zaznamenávává chování uživatelů pro vylepšení UI/UX</div>
                  <div><strong>Výkonové metriky:</strong> Sledují rychlost načítání a chybovost</div>
                  <div><strong>A/B testování:</strong> Porovnávají různé verze funkcí</div>
                </div>
              </div>

              {/* Marketingové cookies */}
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Marketingové cookies
                  <span className="ml-2 text-sm text-purple-600">(Volitelné)</span>
                </h3>
                <div className="space-y-2">
                  <div><strong>Remarketing/Retargeting:</strong> Personalizované reklamy na základě vaší aktivity</div>
                  <div><strong>Sociální média integrace:</strong> Možnost sdílení na sociální sítě</div>
                  <div><strong>Personalizace obsahu:</strong> Přizpůsobení obsahu vašim zájmům</div>
                  <div><strong>Cílený marketing:</strong> Sledování účinnosti marketingových kampaní</div>
                </div>
              </div>
            </div>
          </section>

          {/* Cookies Table */}
          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4">Přehled používaných cookies</h2>
            
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <thead>
                  <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <th className="text-left py-3 px-4">Název cookie</th>
                    <th className="text-left py-3 px-4">Účel</th>
                    <th className="text-left py-3 px-4">Trvanlivost</th>
                    <th className="text-left py-3 px-4">Typ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <td className="py-3 px-4 font-medium">session_id</td>
                    <td className="py-3 px-4">Přihlášení a session</td>
                    <td className="py-3 px-4">Do konce session</td>
                    <td className="py-3 px-4">Nezbytný</td>
                  </tr>
                  <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <td className="py-3 px-4 font-medium">user_preferences</td>
                    <td className="py-3 px-4">Ukládání uživatelských preferencí</td>
                    <td className="py-3 px-4">1 rok</td>
                    <td className="py-3 px-4">Funkční</td>
                  </tr>
                  <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <td className="py-3 px-4 font-medium">analytics_consent</td>
                    <td className="py-3 px-4">Souhlas s analytikou</td>
                    <td className="py-3 px-4">1 rok</td>
                    <td className="py-3 px-4">Analytický</td>
                  </tr>
                  <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <td className="py-3 px-4 font-medium">jobshaman_search</td>
                    <td className="py-3 px-4">Ukládání vyhledávacích dotazů</td>
                    <td className="py-3 px-4">30 dní</td>
                    <td className="py-3 px-4">Funkční</td>
                  </tr>
                  <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <td className="py-3 px-4 font-medium">third_party_cookie</td>
                    <td className="py-3 px-4">Integrace s externími službami (LinkedIn, atd.)</td>
                    <td className="py-3 px-4">90 dní</td>
                    <td className="py-3 px-4">Marketingový</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Management */}
          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" />
              Správa cookies
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Jak spravovat cookies:</h3>
                <ul className="space-y-2 list-disc list-inside ml-6">
                  <li><strong>Nastavení v prohlížeči:</strong> Většina prohlížečů umožňuje spravu cookies</li>
                  <li><strong>Použití našeho banneru:</strong> Můžete kdykoli změnit svá nastavení</li>
                  <li><strong>Přehled preferencí:</strong> Podívat se na <a href="/cookie-preferences" className="text-indigo-600 hover:underline">Správa dat</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Blokování cookies:</h3>
                <p className="mb-2">
                  Můžete kdykoli zablokovat cookies z vašeho prohlížeče. Upozorujeme, že blokování nezbytných cookies může ovlivnit funkčnost některých částí webu.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Mazání cookies:</h3>
                <p className="mb-2">
                  Vymazání cookies odstraní všechna uložená data z vašeho prohlížeče. Budete muset znovu přihlásit.
                </p>
              </div>
            </div>
          </section>

          {/* Third Party Cookies */}
          <section className={`p-6 rounded-lg border-2 ${isDark ? 'border-amber-700' : 'border-amber-200'} ${isDark ? 'bg-amber-900/20' : 'bg-amber-50'}`}>
            <h2 className="text-2xl font-bold mb-4">Cookies třetích stran</h2>
            <div className="space-y-3">
              <p>
                Některé části našich stránek mohou používat cookies od externích partnerů (např. LinkedIn, Google, atd.). 
                Tyto cookies podléhají zásadám ochrany osobních údajů příslušných třetích stran.
              </p>
              <div>
                <h3 className="font-semibold mb-2">Hlavní partneři:</h3>
                <ul className="space-y-2 list-disc list-inside ml-6">
                  <li><strong>Google Analytics:</strong> Analytika a statistiky</li>
                  <li><strong>LinkedIn:</strong> Profesionální networking a integrace</li>
                  <li><strong>Facebook/Meta:</strong> Marketing a sociální integrace</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4">Kontakt ohledně cookies</h2>
            <div className="space-y-3">
              <p><strong>E-mail:</strong> <a href="mailto:privacy@jobshaman.cz" className="text-indigo-600 hover:underline">privacy@jobshaman.cz</a></p>
              <p><strong>Telefon:</strong> +420 123 456 789</p>
              <p><strong>Úřad pro ochranu osobních údajů:</strong> Úřad pro ochranu osobních údajů</p>
            </div>
          </section>

          {/* Updates */}
          <section className={`p-6 rounded-lg border-2 ${isDark ? 'border-indigo-700' : 'border-indigo-200'} ${isDark ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
            <h2 className="text-2xl font-bold mb-4">Aktualizace politiky</h2>
            <p className="mb-3">
              Tato politika cookies byla naposledy aktualizována dne {new Date().toLocaleDateString('cs-CZ')}. 
              Jakékoliv změny budou zveřejněny na této stránce a v případě podstatných změn také e-mailem registrovaným uživatelům.
            </p>
            <div className={`${isDark ? 'text-indigo-200' : 'text-indigo-800'} text-sm`}>
              Verze dokumentu: 1.0 | Datum poslední revize: {new Date().toLocaleDateString('cs-CZ')}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className={`mt-8 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="text-center">
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm`}>
              JobShaman s.r.o. | IČO: 12345678 | Dorožní 1, 110 00 Praha 1
            </p>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm mt-2`}>
              Tato politika je součástí našich <a href="/privacy-policy" className="text-indigo-600 hover:underline">Zásad ochrany osobních údajů</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicyPage;