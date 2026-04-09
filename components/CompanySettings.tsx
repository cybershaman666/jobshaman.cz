import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Heart,
  MessageSquare,
  Save,
  Shield,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import type { CompanyProfile } from '../types';
import { uploadCompanyLogo, updateCompanyProfile } from '../services/supabaseService';

interface CompanySettingsProps {
  profile: CompanyProfile;
  onSave: (profile: CompanyProfile) => void;
  onDeleteAccount?: () => Promise<boolean>;
}

const normalizeGalleryUrlsFromText = (value: string): string[] => {
  const seen = new Set<string>();
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      try {
        const parsed = new URL(line);
        const normalized = parsed.toString();
        if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 6);
};

const CompanySettings: React.FC<CompanySettingsProps> = ({ profile, onSave, onDeleteAccount }) => {
  const { t } = useTranslation();
  const [localProfile, setLocalProfile] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [galleryDraft, setGalleryDraft] = useState((profile.gallery_urls || []).join('\n'));

  useEffect(() => {
    setLocalProfile(profile);
    setGalleryDraft((profile.gallery_urls || []).join('\n'));
  }, [profile]);

  const profileReadinessFields = [
    localProfile.name,
    localProfile.ico,
    localProfile.dic,
    localProfile.website,
    localProfile.legal_address,
    localProfile.address,
    localProfile.industry,
    localProfile.philosophy,
  ];
  const filledProfileFields = profileReadinessFields.filter((value) => String(value || '').trim().length > 0).length;
  const profileReadinessPercent = Math.round((filledProfileFields / profileReadinessFields.length) * 100);
  const valuesCount = Array.isArray(localProfile.values) ? localProfile.values.length : 0;
  const galleryUrls = normalizeGalleryUrlsFromText(galleryDraft);

  const summaryCards = [
    {
      id: 'profile',
      label: t('company.settings.profile_readiness', { defaultValue: 'Připravenost profilu' }),
      value: `${profileReadinessPercent}%`,
      hint: t('company.settings.profile_readiness_hint', {
        defaultValue: '{{filled}} z {{total}} klíčových údajů je vyplněno.',
        filled: filledProfileFields,
        total: profileReadinessFields.length,
      }),
    },
    {
      id: 'brand',
      label: t('company.settings.brand_readiness', { defaultValue: 'Firemní identita' }),
      value: localProfile.logo_url
        ? t('company.settings.ready_state', { defaultValue: 'Připraveno' })
        : t('company.settings.logo_missing', { defaultValue: 'Chybí logo' }),
      hint: localProfile.logo_url
        ? t('company.settings.brand_readiness_hint', { defaultValue: 'Logo je připravené pro nabídky i recruiter workspace.' })
        : t('company.settings.logo_hint', { defaultValue: 'Nahrajte vlastní logo firmy. Doporučený formát je čtverec alespoň 300 × 300 px.' }),
    },
    {
      id: 'culture',
      label: t('company.settings.culture_signal', { defaultValue: 'Kulturní signál' }),
      value: `${valuesCount}/5`,
      hint: t('company.settings.culture_signal_hint', {
        defaultValue: '{{count}} hodnot se už propisuje do firemní prezentace a matchingu.',
        count: valuesCount,
      }),
    },
    {
      id: 'gallery',
      label: t('company.settings.gallery_title', { defaultValue: 'Firemní galerie' }),
      value: `${galleryUrls.length}/6`,
      hint: t('company.settings.gallery_hint', {
        defaultValue: 'Používáme prvních 6 validních odkazů na fotky prostředí, týmu nebo produktu.',
      }),
    },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextGalleryUrls = normalizeGalleryUrlsFromText(galleryDraft);
      const nextProfile = { ...localProfile, gallery_urls: nextGalleryUrls };
      if (profile.id) {
        const updated = await updateCompanyProfile(profile.id, nextProfile);
        setLocalProfile(updated);
        setGalleryDraft((updated.gallery_urls || []).join('\n'));
        await onSave(updated);
      } else {
        setLocalProfile(nextProfile);
        await onSave(nextProfile);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file || !profile.id) return;
    try {
      setLogoUploading(true);
      const logoUrl = await uploadCompanyLogo(profile.id, file);
      const updated = await updateCompanyProfile(profile.id, { logo_url: logoUrl });
      setLocalProfile(updated);
      await onSave(updated);
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert(t('company.settings.logo_error', { defaultValue: 'Logo se nepodařilo nahrát.' }));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleClearLogo = async () => {
    if (!profile.id) {
      setLocalProfile((prev) => ({ ...prev, logo_url: undefined }));
      return;
    }
    try {
      setLogoUploading(true);
      const updated = await updateCompanyProfile(profile.id, { logo_url: null });
      setLocalProfile(updated);
      await onSave(updated);
    } catch (err) {
      console.error('Logo clear failed:', err);
      alert(t('company.settings.logo_error', { defaultValue: 'Logo se nepodařilo odebrat.' }));
    } finally {
      setLogoUploading(false);
    }
  };

  const addValue = () => {
    if (!newValue.trim()) return;
    setLocalProfile((prev) => ({
      ...prev,
      values: [...(prev.values || []), newValue.trim()],
    }));
    setNewValue('');
  };

  const removeValue = (valueToRemove: string) => {
    setLocalProfile((prev) => ({
      ...prev,
      values: (prev.values || []).filter((value) => value !== valueToRemove),
    }));
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
        <div className="app-eyebrow">
          <Sparkles size={12} />
          {t('company.settings.title', { defaultValue: 'Nastavení firmy' })}
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
          {t('company.settings.workspace_title', { defaultValue: 'Operativní nastavení firmy' })}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
          {t('company.settings.workspace_desc', {
            defaultValue: 'Spravujte identitu firmy, právní údaje, jazyk prezentace i výchozí hiring kontext v jednom přehledném workspace. Přístupy členů týmu řešíte samostatně v záložce Tým.',
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{card.label}</div>
            <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{card.value}</div>
            <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_26px_60px_-40px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]">
            <Target size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
              {t('company.settings.company_identity_title', { defaultValue: 'Identita a prezentace firmy' })}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {t('company.settings.company_identity_desc', { defaultValue: 'Údaje, které se propisují do firemního profilu, nabídky i recruiter komunikace.' })}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="app-field-label">
              <Building2 size={16} /> {t('company.settings.logo', { defaultValue: 'Logo firmy' })}
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xl font-semibold text-[var(--text-faint)]">
                {localProfile.logo_url ? (
                  <img src={localProfile.logo_url} alt={localProfile.name} className="h-full w-full object-cover" />
                ) : (
                  (localProfile.name || 'F').slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="space-y-2">
                <label className="app-button-secondary inline-flex cursor-pointer rounded-[var(--radius-md)] px-4 py-2">
                  {logoUploading
                    ? t('company.settings.logo_uploading', { defaultValue: 'Nahrávám...' })
                    : t('company.settings.logo_btn', { defaultValue: 'Nahrát logo' })}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoUploading}
                    onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)}
                  />
                </label>
                {localProfile.logo_url ? (
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-strong)]"
                    onClick={handleClearLogo}
                    disabled={logoUploading}
                  >
                    <Trash2 size={15} />
                    {t('company.settings.logo_remove', { defaultValue: 'Odebrat' })}
                  </button>
                ) : null}
                <div className="text-xs text-[var(--text-muted)]">
                  {t('company.settings.logo_hint', { defaultValue: 'Použijte prosím vlastní logo firmy. Když logo chybí, zobrazujeme jen čistý monogram.' })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="company-name" className="app-field-label">
                <Building2 size={16} /> {t('company.settings.name', { defaultValue: 'Název firmy' })}
              </label>
              <input
                id="company-name"
                type="text"
                placeholder={t('company.settings.name_placeholder', { defaultValue: 'Název společnosti' })}
                className="app-input-field"
                value={localProfile.name || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-industry" className="app-field-label">
                <Target size={16} /> {t('company.settings.industry', { defaultValue: 'Obor' })}
              </label>
              <input
                id="company-industry"
                type="text"
                placeholder={t('company.settings.industry_placeholder', { defaultValue: 'Např. SaaS, výroba, logistika, zdravotnictví' })}
                className="app-input-field"
                value={localProfile.industry || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, industry: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-website" className="app-field-label">
                <Briefcase size={16} /> {t('company.settings.website', { defaultValue: 'Web' })}
              </label>
              <input
                id="company-website"
                type="url"
                placeholder={t('company.settings.website_placeholder', { defaultValue: 'https://www.firma.cz' })}
                className="app-input-field"
                value={localProfile.website || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, website: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-address" className="app-field-label">
                <Briefcase size={16} /> {t('company.settings.address', { defaultValue: 'Adresa provozu nebo kanceláře' })}
              </label>
              <input
                id="company-address"
                type="text"
                placeholder={t('company.settings.address_placeholder', { defaultValue: 'Město, ulice nebo hlavní lokalita' })}
                className="app-input-field"
                value={localProfile.address || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, address: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-ico" className="app-field-label">
                <Shield size={16} /> {t('company.settings.ico', { defaultValue: 'IČO' })}
              </label>
              <input
                id="company-ico"
                type="text"
                placeholder={t('company.settings.ico_placeholder', { defaultValue: 'Identifikační číslo' })}
                className="app-input-field"
                value={localProfile.ico || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, ico: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-dic" className="app-field-label">
                <Shield size={16} /> {t('company.settings.dic', { defaultValue: 'DIČ' })}
              </label>
              <input
                id="company-dic"
                type="text"
                placeholder={t('company.settings.dic_placeholder', { defaultValue: 'Daňové identifikační číslo' })}
                className="app-input-field"
                value={localProfile.dic || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, dic: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-legal-address" className="app-field-label">
                <Building2 size={16} /> {t('company.settings.legal_address', { defaultValue: 'Sídlo společnosti' })}
              </label>
              <input
                id="company-legal-address"
                type="text"
                placeholder={t('company.settings.legal_address_placeholder', { defaultValue: 'Oficiální sídlo firmy' })}
                className="app-input-field"
                value={localProfile.legal_address || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, legal_address: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="company-registry" className="app-field-label">
                <Shield size={16} /> {t('company.settings.registry_info', { defaultValue: 'Zápis v rejstříku' })}
              </label>
              <input
                id="company-registry"
                type="text"
                placeholder={t('company.settings.registry_info_placeholder', { defaultValue: 'Např. obchodní rejstřík, spisová značka' })}
                className="app-input-field"
                value={localProfile.registry_info || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, registry_info: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="company-mission" className="app-field-label">
              <MessageSquare size={16} /> {t('company.settings.mission', { defaultValue: 'Jak firma mluví sama o sobě' })}
            </label>
            <textarea
              id="company-mission"
              className="app-input-field min-h-[110px]"
              value={localProfile.philosophy || ''}
              onChange={(e) => setLocalProfile({ ...localProfile, philosophy: e.target.value })}
              placeholder={t('company.settings.mission_placeholder', {
                defaultValue: 'Krátce a přirozeně popište, co firma dělá, jak funguje a co je pro ni důležité.',
              })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="company-tone" className="app-field-label">
                <Heart size={16} /> {t('company.settings.tone', { defaultValue: 'Tón komunikace' })}
              </label>
              <select
                id="company-tone"
                className="app-input-field"
                value={localProfile.tone}
                onChange={(e) => setLocalProfile({ ...localProfile, tone: e.target.value })}
              >
                <option value="Professional but friendly">{t('company.settings.tones.friendly', { defaultValue: 'Profesionální a lidský' })}</option>
                <option value="Technical and geeky">{t('company.settings.tones.geeky', { defaultValue: 'Technický a věcný' })}</option>
                <option value="Corporate and formal">{t('company.settings.tones.formal', { defaultValue: 'Formální a korporátní' })}</option>
                <option value="Startup hustle">{t('company.settings.tones.startup', { defaultValue: 'Rychlý startupový styl' })}</option>
              </select>
            </div>
            <div>
              <label htmlFor="company-size" className="app-field-label">
                <Building2 size={16} /> {t('company.settings.size', { defaultValue: 'Velikost firmy' })}
              </label>
              <select
                id="company-size"
                className="app-input-field"
                value={(localProfile as any).company_size || '1-10'}
                onChange={(e) => setLocalProfile({ ...localProfile, company_size: e.target.value } as any)}
              >
                <option value="1-10">1–10 {t('company.settings.employess', { defaultValue: 'zaměstnanců' })}</option>
                <option value="11-50">11–50 {t('company.settings.employess', { defaultValue: 'zaměstnanců' })}</option>
                <option value="51-200">51–200 {t('company.settings.employess', { defaultValue: 'zaměstnanců' })}</option>
                <option value="201-500">201–500 {t('company.settings.employess', { defaultValue: 'zaměstnanců' })}</option>
                <option value="500+">500+ {t('company.settings.employess', { defaultValue: 'zaměstnanců' })}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="company-gallery-urls" className="app-field-label">
              <Sparkles size={16} /> {t('company.settings.gallery_title', { defaultValue: 'Firemní galerie' })}
            </label>
            <div className="mb-2 text-xs leading-5 text-[var(--text-muted)]">
              {t('company.settings.gallery_body', {
                defaultValue: 'Přidejte odkazy na fotky kanceláře, týmu, produktu nebo atmosféry ve firmě. Tyto obrázky použijeme tam, kde je firma vizuálně prezentovaná.',
              })}
            </div>
            <textarea
              id="company-gallery-urls"
              className="app-input-field min-h-[120px]"
              value={galleryDraft}
              onChange={(e) => {
                const nextValue = e.target.value;
                setGalleryDraft(nextValue);
                setLocalProfile({
                  ...localProfile,
                  gallery_urls: normalizeGalleryUrlsFromText(nextValue),
                });
              }}
              placeholder={'https://images.example.com/office-1.jpg\nhttps://images.example.com/team-2.jpg\nhttps://images.example.com/product-3.jpg'}
            />
            {galleryUrls.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {galleryUrls.map((imageUrl, index) => (
                  <div key={imageUrl} className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                    <img
                      src={imageUrl}
                      alt={`${localProfile.name || 'Company'} gallery ${index + 1}`}
                      className="h-28 w-full object-cover"
                      loading="lazy"
                    />
                    <div className="truncate px-3 py-2 text-[11px] text-[var(--text-muted)]">
                      {new URL(imageUrl).host.replace(/^www\./, '')}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className="app-field-label !mb-2">{t('company.settings.values', { defaultValue: 'Hodnoty a pracovní styl' })}</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {(localProfile.values || []).map((value, index) => (
                <span key={`${value}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent)]">
                  {value}
                  <button onClick={() => removeValue(value)} className="hover:opacity-80">
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="app-input-field flex-1"
                placeholder={t('company.settings.add_value_placeholder', { defaultValue: 'Např. transparentnost, autonomie, rychlé rozhodování' })}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addValue()}
              />
              <button onClick={addValue} className="app-button-secondary rounded-[var(--radius-md)] px-4 py-2">
                {t('company.settings.add_btn', { defaultValue: 'Přidat' })}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="app-button-primary rounded-[var(--radius-md)] px-8 py-3 disabled:opacity-50"
        >
          <Save size={18} />
          {isSaving ? t('common.saving', { defaultValue: 'Ukládám...' }) : t('company.settings.save_changes', { defaultValue: 'Uložit změny' })}
        </button>
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-rose-600">
          <AlertCircle className="h-5 w-5" />
          {t('profile.danger_zone_title', { defaultValue: 'Citlivé akce' })}
        </h3>
        <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 p-4">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h4 className="mb-1 font-semibold text-[var(--text-strong)]">
                {t('profile.delete_account_title', { defaultValue: 'Smazat účet firmy' })}
              </h4>
              <p className="text-sm text-[var(--text-muted)]">
                {t('profile.delete_account_desc', { defaultValue: 'Trvale smaže účet firmy i navázaná data. Tuto akci nejde vrátit zpět.' })}
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="whitespace-nowrap rounded-[var(--radius-md)] border border-rose-200 bg-white px-6 py-3 font-semibold text-rose-600 transition-all hover:bg-rose-50 active:scale-[0.98]"
            >
              {t('profile.delete_account_btn', { defaultValue: 'Smazat účet' })}
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-all duration-300">
          <div className="max-w-md w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-slate-700 dark:bg-slate-800">
            <div className="p-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-white">
                {t('profile.delete_account_warning_title', { defaultValue: 'Opravdu chcete účet smazat?' })}
              </h3>
              <p className="mb-8 text-center text-slate-600 dark:text-slate-400">
                {t('profile.delete_account_warning_desc', { defaultValue: 'Smazáním ztratíte firemní profil, nastavení i historii práce s kandidáty.' })}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (onDeleteAccount) {
                      setIsDeleting(true);
                      try {
                        const success = await onDeleteAccount();
                        if (!success) {
                          setIsDeleting(false);
                          alert(t('profile.delete_account_error', { defaultValue: 'Účet se nepodařilo smazat.' }));
                        }
                      } catch (err) {
                        setIsDeleting(false);
                        console.error('Deletion error:', err);
                        alert(t('profile.delete_account_error', { defaultValue: 'Účet se nepodařilo smazat.' }));
                      }
                    }
                  }}
                  disabled={isDeleting}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 py-4 font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-700 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('app.loading', { defaultValue: 'Probíhá...' })}</span>
                    </div>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      {t('profile.delete_account_confirm', { defaultValue: 'Ano, smazat účet' })}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="w-full rounded-xl bg-slate-100 py-3 font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  {t('profile.delete_account_cancel', { defaultValue: 'Zrušit' })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySettings;
