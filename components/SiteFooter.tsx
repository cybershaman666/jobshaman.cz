import React from 'react';
import { useTranslation } from 'react-i18next';

import { getLocaleFromPathname } from '../utils/appRouting';

const SiteFooter: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = getLocaleFromPathname(window.location.pathname, (i18n.language || 'cs').split('-')[0]);
  const prefix = `/${locale}`;
  const links = [
    { href: `${prefix}/about`, label: t('footer.about', { defaultValue: 'About Us' }) },
    { href: `${prefix}/terms`, label: t('footer.terms', { defaultValue: 'Terms of Use' }) },
    { href: `${prefix}/privacy-policy`, label: t('footer.privacy', { defaultValue: 'Privacy Policy' }) },
  ];

  return (
    <footer className="mt-8 border-t border-[var(--border)] bg-[var(--surface)]/85 px-4 py-5 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-[var(--text-faint)]">
          {t('footer.rights_reserved', { defaultValue: '© 2026 JobShaman. All rights reserved.' })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-muted)]">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-[var(--text-strong)] hover:underline">
              {link.label}
            </a>
          ))}
          <a href="mailto:floki@jobshaman.cz" className="transition hover:text-[var(--text-strong)] hover:underline">
            {t('footer.contact', { defaultValue: 'Contact' })}
          </a>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
