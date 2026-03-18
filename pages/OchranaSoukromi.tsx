import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LegalPage from '../components/LegalPage';

const OchranaSoukromi = () => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';

  const copy = isCsLike
    ? {
        pageTitle: 'Ochrana soukromí',
        backLabel: 'Zpět do aplikace',
        mainTitle: 'ZÁSADY ZPRACOVÁNÍ OSOBNÍCH ÚDAJŮ (GDPR)',
        lawNoticeTitle: 'Právní režim',
        lawNoticeBody:
          'Tento web a právní vztahy vznikající při jeho užívání se řídí právním řádem České republiky.',
        sections: {
          controllerTitle: '1. Správce osobních údajů',
          controllerBody:
            'Správcem je společnost Beyond Caveman s.r.o., IČO: 10733493, sídlo Jaurisova 515/4, Michle, 140 00 Praha.',
          scopeTitle: '2. Rozsah a účel zpracování',
          scopeBody:
            'Zpracováváme údaje, které nám poskytnete (zejména jméno, e-mail, údaje v životopisu) za účelem:',
          scopeItems: [
            'Poskytování služeb portálu (analýza shody s pracovními nabídkami).',
            'Zprostředkování kontaktu mezi Vámi a partnery v Marketplace (pokud projevíte zájem o kurz).',
            'Statistické analýzy trhu práce a efektivity vzdělávání (anonymizovaně).',
          ],
          aiTitle: '3. AI analýza a předávání dat',
          aiBody:
            'Pro analýzu Vašeho životopisu využíváme technologii OpenAI API. Vaše data jsou zasílána k jednorázové analýze a nejsou využívána k trénování veřejných modelů AI.',
          cloudBody: 'Data jsou bezpečně uložena v infrastruktuře Supabase (EU datacentra).',
          transferBody:
            'Vaše údaje předáme partnerovi (vzdělávací instituci) pouze v případě, že u konkrétního kurzu kliknete na tlačítko vyjadřující zájem.',
          retentionTitle: '4. Doba uložení',
          retentionBody:
            'Osobní údaje uchováváme po dobu nezbytnou k poskytování služby, nebo do doby, než požádáte o jejich smazání. Inaktivní profily a staré inzeráty jsou automaticky promazávány (standardně po 25 dnech, pokud není nastaveno jinak).',
          rightsTitle: '5. Vaše práva',
          rightsBodyPrefix:
            'Máte právo požadovat přístup ke svým údajům, jejich opravu, výmaz, nebo omezení zpracování. Své požadavky posílejte na',
        },
        validFrom: 'Tyto zásady jsou platné od dne 23. ledna 2026.',
        validHint: 'Pro aktuální kontakt a další informace navštivte naši hlavní stránku.',
        contactTitle: 'Kontakt na ochranu údajů',
        contactCta: 'Kontaktovat DPO',
      }
    : {
        pageTitle: 'Privacy Policy',
        backLabel: 'Back to app',
        mainTitle: 'PERSONAL DATA PROCESSING POLICY (GDPR)',
        lawNoticeTitle: 'Governing law',
        lawNoticeBody:
          'This website and all legal relationships arising from its use are governed by the laws of the Czech Republic.',
        sections: {
          controllerTitle: '1. Data controller',
          controllerBody:
            'The controller is Beyond Caveman s.r.o., Company ID: 10733493, registered office: Jaurisova 515/4, Michle, 140 00 Prague, Czech Republic.',
          scopeTitle: '2. Scope and purpose of processing',
          scopeBody:
            'We process data you provide (especially name, email, and CV data) for the following purposes:',
          scopeItems: [
            'Providing portal services (matching and role-fit analysis).',
            'Facilitating contact between you and marketplace partners (if you explicitly show interest).',
            'Statistical labour-market and education-effectiveness analysis (in anonymized form).',
          ],
          aiTitle: '3. AI analysis and data sharing',
          aiBody:
            'For CV analysis we use OpenAI API technology. Your data is sent for one-time analysis and is not used to train public AI models.',
          cloudBody: 'Data is securely stored in Supabase infrastructure (EU data centers).',
          transferBody:
            'Your data is shared with a partner (educational institution) only if you click the explicit interest action for a specific course.',
          retentionTitle: '4. Retention period',
          retentionBody:
            'We retain personal data for as long as necessary to provide the service, or until you request deletion. Inactive profiles and old listings are automatically cleaned up (typically after 25 days unless configured otherwise).',
          rightsTitle: '5. Your rights',
          rightsBodyPrefix:
            'You have the right to request access, correction, deletion, or restriction of processing of your personal data. Send your request to',
        },
        validFrom: 'This policy is effective as of January 23, 2026.',
        validHint: 'For current contact details and additional information, please visit our main page.',
        contactTitle: 'Data protection contact',
        contactCta: 'Contact DPO',
      };

  return (
    <LegalPage title={copy.pageTitle} icon={Shield} backLabel={copy.backLabel}>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h2>{copy.mainTitle}</h2>

        <div className="mt-4 mb-6 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{copy.lawNoticeTitle}</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{copy.lawNoticeBody}</p>
        </div>

        <h3>{copy.sections.controllerTitle}</h3>
        <p>{copy.sections.controllerBody}</p>

        <h3>{copy.sections.scopeTitle}</h3>
        <p>{copy.sections.scopeBody}</p>
        <ul>
          {copy.sections.scopeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3>{copy.sections.aiTitle}</h3>
        <p>
          <strong>AI:</strong> {copy.sections.aiBody}
        </p>
        <p>
          <strong>Cloud:</strong> {copy.sections.cloudBody}
        </p>
        <p>
          <strong>{isCsLike ? 'Předávání:' : 'Sharing:'}</strong> {copy.sections.transferBody}
        </p>

        <h3>{copy.sections.retentionTitle}</h3>
        <p>{copy.sections.retentionBody}</p>

        <h3>{copy.sections.rightsTitle}</h3>
        <p>
          {copy.sections.rightsBodyPrefix}{' '}
          <a
            href="mailto:floki@jobshaman.cz"
            className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            floki@jobshaman.cz
          </a>
          .
        </p>

        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">{copy.validFrom}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{copy.validHint}</p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 mb-4">
            <span className="font-medium">{copy.contactTitle}</span>
          </div>
          <a
            href="mailto:floki@jobshaman.cz"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            <span>{copy.contactCta}</span>
          </a>
        </div>
      </div>
    </LegalPage>
  );
};

export default OchranaSoukromi;
