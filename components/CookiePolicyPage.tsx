import React from 'react';
import { Cookie, Shield, Clock, Database, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CookiePolicyPageProps {
  theme?: 'light' | 'dark';
}

const CookiePolicyPage: React.FC<CookiePolicyPageProps> = ({ theme = 'light' }) => {
  const { t, i18n } = useTranslation();
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900';
  const cardClass = isDark
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white border-slate-200';
  const localizedDate = new Date().toLocaleDateString(i18n.language);

  const cookieRows = [
    {
      name: 'session_id',
      purpose: t('cookie_policy.table.rows.session_id.purpose'),
      duration: t('cookie_policy.table.rows.session_id.duration'),
      type: t('cookie_policy.table.rows.session_id.type')
    },
    {
      name: 'user_preferences',
      purpose: t('cookie_policy.table.rows.user_preferences.purpose'),
      duration: t('cookie_policy.table.rows.user_preferences.duration'),
      type: t('cookie_policy.table.rows.user_preferences.type')
    },
    {
      name: 'analytics_consent',
      purpose: t('cookie_policy.table.rows.analytics_consent.purpose'),
      duration: t('cookie_policy.table.rows.analytics_consent.duration'),
      type: t('cookie_policy.table.rows.analytics_consent.type')
    },
    {
      name: 'jobshaman_search',
      purpose: t('cookie_policy.table.rows.jobshaman_search.purpose'),
      duration: t('cookie_policy.table.rows.jobshaman_search.duration'),
      type: t('cookie_policy.table.rows.jobshaman_search.type')
    },
    {
      name: 'third_party_cookie',
      purpose: t('cookie_policy.table.rows.third_party_cookie.purpose'),
      duration: t('cookie_policy.table.rows.third_party_cookie.duration'),
      type: t('cookie_policy.table.rows.third_party_cookie.type')
    }
  ];

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Cookie className="w-12 h-12 mx-auto mb-4 text-indigo-600" />
          <h1 className="text-3xl font-bold mb-2">{t('cookie_policy.title')}</h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-lg`}>
            {t('cookie_policy.last_update', { date: localizedDate })}
          </p>
        </div>

        <div className="space-y-8">
          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4">{t('cookie_policy.what_are.title')}</h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                {t('cookie_policy.what_are.description')}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-6">
                <li>{t('cookie_policy.what_are.uses.keep_login')}</li>
                <li>{t('cookie_policy.what_are.uses.remember_preferences')}</li>
                <li>{t('cookie_policy.what_are.uses.analyze_usage')}</li>
                <li>{t('cookie_policy.what_are.uses.improve_performance')}</li>
                <li>{t('cookie_policy.what_are.uses.personalize_content')}</li>
              </ul>
            </div>
          </section>

          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Cookie className="w-6 h-6 text-indigo-600" />
              {t('cookie_policy.types.title')}
            </h2>

            <div className="space-y-6">
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  {t('cookie_policy.types.necessary.title')}
                  <span className="ml-2 text-sm text-green-600">({t('cookie_policy.types.necessary.badge')})</span>
                </h3>
                <div className="space-y-2">
                  <div><strong>{t('cookie_policy.types.necessary.session_label')}:</strong> {t('cookie_policy.types.necessary.session_desc')}</div>
                  <div><strong>{t('cookie_policy.types.necessary.security_label')}:</strong> {t('cookie_policy.types.necessary.security_desc')}</div>
                  <div><strong>{t('cookie_policy.types.necessary.functional_label')}:</strong> {t('cookie_policy.types.necessary.functional_desc')}</div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  {t('cookie_policy.types.analytics.title')}
                  <span className="ml-2 text-sm text-blue-600">({t('cookie_policy.types.analytics.badge')})</span>
                </h3>
                <div className="space-y-2">
                  <div><strong>Google Analytics:</strong> {t('cookie_policy.types.analytics.ga_desc')}</div>
                  <div><strong>Hotjar:</strong> {t('cookie_policy.types.analytics.hotjar_desc')}</div>
                  <div><strong>{t('cookie_policy.types.analytics.performance_label')}:</strong> {t('cookie_policy.types.analytics.performance_desc')}</div>
                  <div><strong>{t('cookie_policy.types.analytics.ab_label')}:</strong> {t('cookie_policy.types.analytics.ab_desc')}</div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  {t('cookie_policy.types.marketing.title')}
                  <span className="ml-2 text-sm text-purple-600">({t('cookie_policy.types.marketing.badge')})</span>
                </h3>
                <div className="space-y-2">
                  <div><strong>{t('cookie_policy.types.marketing.remarketing_label')}:</strong> {t('cookie_policy.types.marketing.remarketing_desc')}</div>
                  <div><strong>{t('cookie_policy.types.marketing.social_label')}:</strong> {t('cookie_policy.types.marketing.social_desc')}</div>
                  <div><strong>{t('cookie_policy.types.marketing.personalization_label')}:</strong> {t('cookie_policy.types.marketing.personalization_desc')}</div>
                  <div><strong>{t('cookie_policy.types.marketing.targeting_label')}:</strong> {t('cookie_policy.types.marketing.targeting_desc')}</div>
                </div>
              </div>
            </div>
          </section>

          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4">{t('cookie_policy.table.title')}</h2>

            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <thead>
                  <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <th className="text-left py-3 px-4">{t('cookie_policy.table.headers.name')}</th>
                    <th className="text-left py-3 px-4">{t('cookie_policy.table.headers.purpose')}</th>
                    <th className="text-left py-3 px-4">{t('cookie_policy.table.headers.duration')}</th>
                    <th className="text-left py-3 px-4">{t('cookie_policy.table.headers.type')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cookieRows.map((row) => (
                    <tr key={row.name} className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      <td className="py-3 px-4 font-medium">{row.name}</td>
                      <td className="py-3 px-4">{row.purpose}</td>
                      <td className="py-3 px-4">{row.duration}</td>
                      <td className="py-3 px-4">{row.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" />
              {t('cookie_policy.management.title')}
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('cookie_policy.management.how_to_manage_title')}</h3>
                <ul className="space-y-2 list-disc list-inside ml-6">
                  <li><strong>{t('cookie_policy.management.browser_settings_label')}:</strong> {t('cookie_policy.management.browser_settings_desc')}</li>
                  <li><strong>{t('cookie_policy.management.banner_label')}:</strong> {t('cookie_policy.management.banner_desc')}</li>
                  <li>
                    <strong>{t('cookie_policy.management.preferences_overview_label')}:</strong>{' '}
                    {t('cookie_policy.management.preferences_overview_desc_prefix')}{' '}
                    <a href="/cookie-preferences" className="text-indigo-600 hover:underline">{t('cookie_policy.management.preferences_overview_link')}</a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('cookie_policy.management.blocking_title')}</h3>
                <p className="mb-2">
                  {t('cookie_policy.management.blocking_desc')}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('cookie_policy.management.deleting_title')}</h3>
                <p className="mb-2">
                  {t('cookie_policy.management.deleting_desc')}
                </p>
              </div>
            </div>
          </section>

          <section className={`p-6 rounded-lg border-2 ${isDark ? 'border-amber-700' : 'border-amber-200'} ${isDark ? 'bg-amber-900/20' : 'bg-amber-50'}`}>
            <h2 className="text-2xl font-bold mb-4">{t('cookie_policy.third_party.title')}</h2>
            <div className="space-y-3">
              <p>
                {t('cookie_policy.third_party.description')}
              </p>
              <div>
                <h3 className="font-semibold mb-2">{t('cookie_policy.third_party.main_partners_title')}</h3>
                <ul className="space-y-2 list-disc list-inside ml-6">
                  <li><strong>Google Analytics:</strong> {t('cookie_policy.third_party.partners.google')}</li>
                  <li><strong>LinkedIn:</strong> {t('cookie_policy.third_party.partners.linkedin')}</li>
                  <li><strong>Facebook/Meta:</strong> {t('cookie_policy.third_party.partners.meta')}</li>
                </ul>
              </div>
            </div>
          </section>

          <section className={`p-6 rounded-lg border ${cardClass}`}>
            <h2 className="text-2xl font-bold mb-4">{t('cookie_policy.contact.title')}</h2>
            <div className="space-y-3">
              <p><strong>{t('cookie_policy.contact.email_label')}:</strong> <a href="mailto:privacy@jobshaman.cz" className="text-indigo-600 hover:underline">privacy@jobshaman.cz</a></p>
              <p><strong>{t('cookie_policy.contact.phone_label')}:</strong> +420 123 456 789</p>
              <p><strong>{t('cookie_policy.contact.authority_label')}:</strong> {t('cookie_policy.contact.authority_value')}</p>
            </div>
          </section>

          <section className={`p-6 rounded-lg border-2 ${isDark ? 'border-indigo-700' : 'border-indigo-200'} ${isDark ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
            <h2 className="text-2xl font-bold mb-4">{t('cookie_policy.updates.title')}</h2>
            <p className="mb-3">
              {t('cookie_policy.updates.description', { date: localizedDate })}
            </p>
            <div className={`${isDark ? 'text-indigo-200' : 'text-indigo-800'} text-sm`}>
              {t('cookie_policy.updates.version_line', { date: localizedDate })}
            </div>
          </section>
        </div>

        <div className={`mt-8 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="text-center">
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm`}>
              {t('cookie_policy.footer.company_line')}
            </p>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm mt-2`}>
              {t('cookie_policy.footer.privacy_part_1')}{' '}
              <a href="/privacy-policy" className="text-indigo-600 hover:underline">{t('cookie_policy.footer.privacy_link')}</a>
              {t('cookie_policy.footer.privacy_part_2')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicyPage;
