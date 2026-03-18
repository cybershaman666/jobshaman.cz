import { BrainCircuit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LegalPage from '../components/LegalPage';

const PodminkyUziti = () => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';

  const copy = isCsLike
    ? {
        pageTitle: 'Podmínky užití',
        backLabel: 'Zpět do aplikace',
        mainTitle: 'VŠEOBECNÉ OBCHODNÍ PODMÍNKY PORTÁLU JOBSHAMAN.COM',
        lawNoticeTitle: 'Rozhodné právo',
        lawNoticeBody:
          'Tento web a právní vztahy vznikající při jeho užívání se řídí právním řádem České republiky.',
        sections: {
          introTitle: '1. Úvodní ustanovení',
          introBody:
            'Provozovatelem portálu JobShaman.com je společnost Beyond Caveman s.r.o., IČO: 10733493, se sídlem Jaurisova 515/4, Michle, 140 00 Praha (dále jen „Provozovatel"). Tyto podmínky upravují práva a povinnosti osob využívajících portál (dále jen „Uživatel").',
          serviceTitle: '2. Charakter služby',
          serviceBodyOne:
            'JobShaman.com je informační platforma, která agreguje pracovní nabídky z veřejně dostupných zdrojů a zprostředkovává nabídky vzdělávacích kurzů od partnerů.',
          serviceBodyTwo:
            'Provozovatel není zaměstnavatelem ani zprostředkovatelem zaměstnání ve smyslu zákona o zaměstnanosti. Provozovatel neodpovídá za obsah, pravdivost ani aktuálnost inzerátů převzatých od třetích stran.',
          registrationTitle: '3. Registrace a uživatelský profil',
          registrationBodyOne:
            'Uživatel nahráním svého životopisu (CV) a registrací souhlasí s automatizovaným zpracováním dat za účelem analýzy dovedností (tzv. Skills Gap analýza).',
          registrationBodyTwo:
            'Uživatel odpovídá za to, že jím nahrané dokumenty neobsahují škodlivý kód a že má právo s nimi nakládat.',
          marketplaceTitle: '4. Vzdělávací Marketplace',
          marketplaceBodyOne:
            'JobShaman umožňuje uživateli projevit zájem o kurzy třetích stran (partnerů).',
          marketplaceBodyTwo:
            'Samotný smluvní vztah ohledně vzdělávání vzniká přímo mezi uživatelem a partnerem (vzdělávací institucí). Provozovatel neodpovídá za kvalitu ani realizaci těchto kurzů.',
          marketplaceBodyThree:
            'Informace o dotacích (např. Úřad práce) jsou informačního charakteru. O přiznání dotace rozhoduje výhradně příslušný státní orgán.',
          finalTitle: '5. Závěrečná ustanovení',
          finalBody:
            'Provozovatel si vyhrazuje právo kdykoliv omezit nebo ukončit přístup uživatele k portálu, zejména při porušení těchto podmínek.',
        },
        validFrom: 'Tyto podmínky jsou platné od dne 23. ledna 2026.',
        contactPrefix: 'V případě dotazů kontaktujte nás na',
      }
    : {
        pageTitle: 'Terms of Use',
        backLabel: 'Back to app',
        mainTitle: 'GENERAL TERMS OF USE OF JOBSHAMAN.COM',
        lawNoticeTitle: 'Governing law',
        lawNoticeBody:
          'This website and all legal relationships arising from its use are governed by the laws of the Czech Republic.',
        sections: {
          introTitle: '1. Introductory provisions',
          introBody:
            'The operator of JobShaman.com is Beyond Caveman s.r.o., Company ID: 10733493, registered office: Jaurisova 515/4, Michle, 140 00 Prague, Czech Republic (the “Operator”). These terms govern rights and obligations of users of the portal (the “User”).',
          serviceTitle: '2. Nature of the service',
          serviceBodyOne:
            'JobShaman.com is an information platform that aggregates job offers from publicly available sources and presents educational course offers from partners.',
          serviceBodyTwo:
            'The Operator is not an employer nor an employment agency under Czech employment law. The Operator is not responsible for content, accuracy, or timeliness of third-party listings.',
          registrationTitle: '3. Registration and user profile',
          registrationBodyOne:
            'By uploading a CV and registering, the User agrees to automated data processing for skills analysis (skills-gap analysis).',
          registrationBodyTwo:
            'The User is responsible for ensuring uploaded documents contain no malicious code and that the User has the right to use and share them.',
          marketplaceTitle: '4. Educational marketplace',
          marketplaceBodyOne:
            'JobShaman allows users to express interest in third-party courses (Partners).',
          marketplaceBodyTwo:
            'Any contractual relationship regarding education is formed directly between the User and the Partner (educational institution). The Operator is not responsible for quality or delivery of such courses.',
          marketplaceBodyThree:
            'Information about public subsidies is informational only. Any grant decision is made solely by the competent public authority.',
          finalTitle: '5. Final provisions',
          finalBody:
            'The Operator reserves the right to limit or terminate user access to the portal at any time, especially in case of breach of these terms.',
        },
        validFrom: 'These terms are effective as of January 23, 2026.',
        contactPrefix: 'For questions, contact us at',
      };

  return (
    <LegalPage title={copy.pageTitle} icon={BrainCircuit} backLabel={copy.backLabel}>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h2>{copy.mainTitle}</h2>

        <div className="mt-4 mb-6 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{copy.lawNoticeTitle}</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{copy.lawNoticeBody}</p>
        </div>

        <h3>{copy.sections.introTitle}</h3>
        <p>{copy.sections.introBody}</p>

        <h3>{copy.sections.serviceTitle}</h3>
        <p>{copy.sections.serviceBodyOne}</p>
        <p>{copy.sections.serviceBodyTwo}</p>

        <h3>{copy.sections.registrationTitle}</h3>
        <p>{copy.sections.registrationBodyOne}</p>
        <p>{copy.sections.registrationBodyTwo}</p>

        <h3>{copy.sections.marketplaceTitle}</h3>
        <p>{copy.sections.marketplaceBodyOne}</p>
        <p>{copy.sections.marketplaceBodyTwo}</p>
        <p>{copy.sections.marketplaceBodyThree}</p>

        <h3>{copy.sections.finalTitle}</h3>
        <p>{copy.sections.finalBody}</p>

        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">{copy.validFrom}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {copy.contactPrefix}{' '}
            <a
              href="mailto:floki@jobshaman.cz"
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              floki@jobshaman.cz
            </a>
          </p>
        </div>
      </div>
    </LegalPage>
  );
};

export default PodminkyUziti;
