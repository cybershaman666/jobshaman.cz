
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import { CompanyProfile, RecruiterMember } from '../types';
import { inviteRecruiter, removeRecruiterMember, uploadCompanyLogo, updateCompanyProfile } from '../services/supabaseService';
import { Save, Sparkles, MessageSquare, Heart, Target, Users, Mail, UserPlus, Shield, X, Briefcase, Building2, AlertCircle, Trash2 } from 'lucide-react';
import { STOCK_COMPANY_AVATARS, isStockCompanyAvatarUrl } from '../utils/companyStockAvatars';
import { cn } from './ui/primitives';

interface CompanySettingsProps {
    profile: CompanyProfile;
    onSave: (profile: CompanyProfile) => void;
    onDeleteAccount?: () => Promise<boolean>;
}

const getMemberInitials = (member: RecruiterMember): string => {
    const source = String(member.name || member.email || '').trim();
    if (!source) return 'TM';
    const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) return source.slice(0, 2).toUpperCase();
    return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

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
    const [activeTab, setActiveTab] = useState<'dna' | 'team'>('dna');
    const [localProfile, setLocalProfile] = useState(profile);
    const [isSaving, setIsSaving] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [galleryDraft, setGalleryDraft] = useState((profile.gallery_urls || []).join('\n'));

    // Team Management State
    const [inviteEmail, setInviteEmail] = useState('');
    const [members, setMembers] = useState<RecruiterMember[]>(profile.members || []);

    useEffect(() => {
        setLocalProfile(profile);
        setMembers(profile.members || []);
        setGalleryDraft((profile.gallery_urls || []).join('\n'));
    }, [profile]);
    const profileReadinessFields = [
        localProfile.name,
        localProfile.ico,
        localProfile.dic,
        localProfile.website,
        localProfile.legal_address,
        localProfile.address,
        (localProfile as any).field_of_business,
        localProfile.philosophy
    ];
    const filledProfileFields = profileReadinessFields.filter((value) => String(value || '').trim().length > 0).length;
    const profileReadinessPercent = Math.round((filledProfileFields / profileReadinessFields.length) * 100);
    const valuesCount = Array.isArray(localProfile.values) ? localProfile.values.length : 0;
    const galleryUrls = normalizeGalleryUrlsFromText(galleryDraft);
    const summaryCards = [
        {
            id: 'profile',
            label: t('company.settings.profile_readiness', { defaultValue: 'Profile readiness' }),
            value: `${profileReadinessPercent}%`,
            hint: t('company.settings.profile_readiness_hint', {
                defaultValue: '{{filled}} of {{total}} core fields are filled.',
                filled: filledProfileFields,
                total: profileReadinessFields.length
            })
        },
        {
            id: 'brand',
            label: t('company.settings.brand_readiness', { defaultValue: 'Brand readiness' }),
            value: localProfile.logo_url
                ? t('company.settings.ready_state', { defaultValue: 'Ready' })
                : t('company.settings.logo_missing', { defaultValue: 'Missing logo' }),
            hint: localProfile.logo_url
                ? t('company.settings.brand_readiness_hint', { defaultValue: 'Logo is ready for job ads and recruiter views.' })
                : t('company.settings.logo_hint')
        },
        {
            id: 'team',
            label: t('company.settings.team_access', { defaultValue: 'Team access' }),
            value: `${members.length}`,
            hint: t('company.settings.team_access_hint', {
                defaultValue: '{{count}} recruiter seats currently configured.',
                count: members.length
            })
        },
        {
            id: 'values',
            label: t('company.settings.culture_signal', { defaultValue: 'Culture signal' }),
            value: `${valuesCount}/5`,
            hint: t('company.settings.culture_signal_hint', {
                defaultValue: '{{count}} values are visible to candidates and AI matching.',
                count: valuesCount
            })
        }
    ];

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const nextGalleryUrls = normalizeGalleryUrlsFromText(galleryDraft);
            const nextProfile = { ...localProfile, gallery_urls: nextGalleryUrls };
            if (profile.id) {
                const updated = await updateCompanyProfile(profile.id, { ...nextProfile, members });
                setLocalProfile(updated);
                setGalleryDraft((updated.gallery_urls || []).join('\n'));
                setMembers(updated.members || members);
                await onSave({ ...updated, members: updated.members || members });
            } else {
                setLocalProfile(nextProfile);
                await onSave({ ...nextProfile, members });
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
            await onSave({ ...updated, members });
        } catch (err) {
            console.error('Logo upload failed:', err);
            alert(t('company.settings.logo_error', { defaultValue: 'Failed to upload the logo.' }));
        } finally {
            setLogoUploading(false);
        }
    };

    const handlePickStockLogo = async (logoUrl: string) => {
        if (!profile.id) {
            setLocalProfile((prev) => ({ ...prev, logo_url: logoUrl }));
            return;
        }
        try {
            setLogoUploading(true);
            const updated = await updateCompanyProfile(profile.id, { logo_url: logoUrl });
            setLocalProfile(updated);
            await onSave({ ...updated, members });
        } catch (err) {
            console.error('Stock logo set failed:', err);
            alert(t('company.settings.logo_error', { defaultValue: 'Failed to update the logo.' }));
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
            await onSave({ ...updated, members });
        } catch (err) {
            console.error('Logo clear failed:', err);
            alert(t('company.settings.logo_error', { defaultValue: 'Failed to update the logo.' }));
        } finally {
            setLogoUploading(false);
        }
    };

    const addValue = () => {
        if (newValue.trim()) {
            setLocalProfile(prev => ({
                ...prev,
                values: [...prev.values, newValue.trim()]
            }));
            setNewValue('');
        }
    };

    const removeValue = (valToRemove: string) => {
        setLocalProfile(prev => ({
            ...prev,
            values: prev.values.filter(v => v !== valToRemove)
        }));
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim() || !profile.id) return;

        setIsInviting(true);
        try {
            const result = await inviteRecruiter(profile.id, inviteEmail, profile.created_by || 'system');

            if (!result) {
                alert(t('company.settings.invite_failed'));
                return;
            }

            const nextMembers = [
                ...members.filter((member) => member.id !== result.id && (!result.userId || member.userId !== result.userId)),
                {
                    ...result,
                    email: result.email || inviteEmail.trim().toLowerCase()
                }
            ];
            const updated = await updateCompanyProfile(profile.id, { members: nextMembers, gallery_urls: localProfile.gallery_urls });
            setMembers(updated.members || nextMembers);
            setLocalProfile((prev) => ({
                ...prev,
                team_member_profiles: updated.team_member_profiles ?? prev.team_member_profiles ?? null,
                members: updated.members || nextMembers
            }));
            await onSave({ ...localProfile, team_member_profiles: updated.team_member_profiles ?? localProfile.team_member_profiles ?? null, members: updated.members || nextMembers });
            alert(t('company.settings.invite_success', { email: inviteEmail }));
            setInviteEmail('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsInviting(false);
        }
    };

    const handleMemberFieldChange = (memberId: string, field: 'companyRole' | 'relationshipToCompany' | 'teamBio', value: string) => {
        setMembers((prev) => prev.map((member) => (
            member.id === memberId
                ? { ...member, [field]: value }
                : member
        )));
    };

    const removeMember = async (member: RecruiterMember) => {
        if (!profile.id || member.source === 'owner') return;

        setRemovingMemberId(member.id);
        try {
            const removed = await removeRecruiterMember(profile.id, member);
            if (!removed) {
                alert(t('company.settings.member_remove_failed', { defaultValue: 'Unable to remove this team member right now.' }));
                return;
            }
            const nextMembers = members.filter((item) => item.id !== member.id);
            const updated = await updateCompanyProfile(profile.id, { members: nextMembers, gallery_urls: localProfile.gallery_urls });
            setMembers(updated.members || nextMembers);
            setLocalProfile((prev) => ({
                ...prev,
                team_member_profiles: updated.team_member_profiles ?? prev.team_member_profiles ?? null,
                members: updated.members || nextMembers
            }));
            await onSave({ ...localProfile, team_member_profiles: updated.team_member_profiles ?? localProfile.team_member_profiles ?? null, members: updated.members || nextMembers });
        } finally {
            setRemovingMemberId(null);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-4 animate-in fade-in">
            {/* Sidebar Navigation */}
            <div className="space-y-3">
                <div className="company-surface rounded-[var(--radius-lg)] border p-3 shadow-[var(--shadow-soft)] xl:sticky xl:top-[var(--app-header-offset)]">
                    <div className="border-b border-[var(--border-subtle)] pb-3">
                        <div className="app-eyebrow">
                            <Sparkles size={12} />
                            {t('company.settings.title')}
                        </div>
                        <h2 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                            {t('company.settings.workspace_title', { defaultValue: 'Company operating setup' })}
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            {t('company.settings.workspace_desc', { defaultValue: 'Keep company identity, recruiter access, and hiring defaults in one compact workspace.' })}
                        </p>
                    </div>
                    <div className="pt-3 space-y-2">
                        <button
                            onClick={() => setActiveTab('dna')}
                            className={`w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'dna' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
                        >
                            <Sparkles size={17} />
                            <div className="text-left">
                                <div>{t('company.settings.dna')}</div>
                                <div className="text-[11px] font-normal opacity-80">
                                    {t('company.settings.dna_hint', { defaultValue: 'Brand, culture and legal identity' })}
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={`w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'team' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
                        >
                            <Users size={17} />
                            <div className="text-left">
                                <div>{t('company.settings.team')}</div>
                                <div className="text-[11px] font-normal opacity-80">
                                    {t('company.settings.team_hint', { defaultValue: 'Recruiter access and invite flow' })}
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {summaryCards.map((card) => (
                        <div key={card.id} className="company-surface rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)]">
                            <div className="mb-2 text-[11px] uppercase tracking-widest text-[var(--text-faint)]">
                                {card.label}
                            </div>
                            <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                                {card.value}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                                {card.hint}
                            </div>
                        </div>
                    ))}
                </div>

                {activeTab === 'dna' && (
                    <div className="company-surface rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-card)] relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
                                <Target size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{t('company.settings.culture_title')}</h3>
                                <p className="text-sm text-[var(--text-muted)]">{t('company.settings.culture_desc')}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Company Logo */}
                            <div>
                                <label className="app-field-label">
                                    <Building2 size={16} /> {t('company.settings.logo')}
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                                        {localProfile.logo_url ? (
                                            <img src={localProfile.logo_url} alt={localProfile.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-lg font-bold text-[var(--text-faint)]">{localProfile.name?.charAt(0) || 'C'}</span>
                                        )}
                                    </div>
                                    <div>
                                        <label className="app-button-secondary cursor-pointer rounded-[var(--radius-md)] px-4 py-2">
                                            {logoUploading
                                                ? t('company.settings.logo_uploading', { defaultValue: 'Uploading...' })
                                                : t('company.settings.logo_btn', { defaultValue: 'Upload logo' })}
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
                                                className="ml-2 inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[rgba(var(--accent-rgb),0.08)] transition"
                                                onClick={handleClearLogo}
                                                disabled={logoUploading}
                                                title={t('company.settings.logo_remove', { defaultValue: 'Remove logo' })}
                                            >
                                                <Trash2 size={16} />
                                                {t('company.settings.logo_remove', { defaultValue: 'Remove' })}
                                            </button>
                                        ) : null}
                                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                                            {t('company.settings.logo_hint', { defaultValue: 'Recommended: square, min. 300×300 px' })}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[rgba(var(--accent-rgb),0.04)] p-4">
                                    <div className="text-sm font-semibold text-[var(--text-strong)]">
                                        {t('company.settings.stock_avatars_title', { defaultValue: 'Or pick a stock avatar' })}
                                    </div>
                                    <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                        {t('company.settings.stock_avatars_body', { defaultValue: 'Useful while you’re setting up — you can switch to your real logo anytime.' })}
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                                        {STOCK_COMPANY_AVATARS.map((avatar) => {
                                            const selected = String(localProfile.logo_url || '').trim() === avatar.url;
                                            return (
                                                <button
                                                    key={avatar.key}
                                                    type="button"
                                                    className={cn(
                                                        "group flex items-center gap-2 rounded-[var(--radius-md)] border p-2 text-left transition",
                                                        selected
                                                            ? "border-[rgba(var(--accent-rgb),0.40)] bg-white shadow-[var(--shadow-soft)]"
                                                            : "border-[var(--border-subtle)] bg-white/70 hover:border-[rgba(var(--accent-rgb),0.28)] hover:bg-white"
                                                    )}
                                                    onClick={() => handlePickStockLogo(avatar.url)}
                                                    disabled={logoUploading}
                                                    title={avatar.label}
                                                >
                                                    <img
                                                        src={avatar.url}
                                                        alt={avatar.label}
                                                        className="h-10 w-10 rounded-[var(--radius-md)] object-cover"
                                                        loading="lazy"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="truncate text-xs font-semibold text-[var(--text-strong)]">{avatar.label}</div>
                                                        <div className="truncate text-[11px] text-[var(--text-faint)]">
                                                            {selected
                                                                ? t('company.settings.stock_avatars_selected', { defaultValue: 'Selected' })
                                                                : isStockCompanyAvatarUrl(localProfile.logo_url) && !selected
                                                                    ? t('company.settings.stock_avatars_pick', { defaultValue: 'Pick' })
                                                                    : t('company.settings.stock_avatars_pick', { defaultValue: 'Pick' })}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Basic Company Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="company-name" className="app-field-label">
                                        <Building2 size={16} /> {t('company.settings.name')}
                                    </label>
                                    <input
                                        id="company-name"
                                        name="company-name"
                                        type="text"
                                        placeholder={t('company.settings.name_placeholder')}
                                        className="app-input-field"
                                        value={localProfile.name || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company-ico" className="app-field-label">
                                        <Shield size={16} /> {t('company.settings.ico')}
                                    </label>
                                    <input
                                        id="company-ico"
                                        name="company-ico"
                                        type="text"
                                        placeholder={t('company.settings.ico_placeholder')}
                                        className="app-input-field"
                                        value={localProfile.ico || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, ico: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company-dic" className="app-field-label">
                                        <Shield size={16} /> {t('company.settings.dic')}
                                    </label>
                                    <input
                                        id="company-dic"
                                        name="company-dic"
                                        type="text"
                                        placeholder={t('company.settings.dic_placeholder')}
                                        className="app-input-field"
                                        value={localProfile.dic || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, dic: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company-website" className="app-field-label">
                                        <Briefcase size={16} /> {t('company.settings.website')}
                                    </label>
                                    <input
                                        id="company-website"
                                        name="company-website"
                                        type="url"
                                        placeholder={t('company.settings.website_placeholder')}
                                        className="app-input-field"
                                        value={localProfile.website || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, website: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company-legal-address" className="app-field-label">
                                        <Building2 size={16} /> {t('company.settings.legal_address')}
                                    </label>
                                    <input
                                        id="company-legal-address"
                                        name="company-legal-address"
                                        type="text"
                                        placeholder={t('company.settings.legal_address_placeholder')}
                                        className="app-input-field"
                                        value={localProfile.legal_address || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, legal_address: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company-registry" className="app-field-label">
                                        <Shield size={16} /> {t('company.settings.registry_info')}
                                    </label>
                                    <input
                                        id="company-registry"
                                        name="company-registry"
                                        type="text"
                                        placeholder={t('company.settings.registry_info_placeholder')}
                                        className="app-input-field"
                                        value={localProfile.registry_info || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, registry_info: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Mission / Philosophy */}
                            <div>
                                <label htmlFor="company-mission" className="app-field-label">
                                    <MessageSquare size={16} /> {t('company.settings.mission')}
                                </label>
                                <textarea
                                    id="company-mission"
                                    name="company-mission"
                                    className="app-input-field min-h-[100px]"
                                    value={localProfile.philosophy || ''}
                                    onChange={(e) => setLocalProfile({ ...localProfile, philosophy: e.target.value })}
                                    placeholder={t('company.settings.mission_placeholder')}
                                />
                            </div>

                            <div>
                                <label htmlFor="company-gallery-urls" className="app-field-label">
                                    <Sparkles size={16} /> {t('company.settings.gallery_title', { defaultValue: 'Company gallery' })}
                                </label>
                                <div className="mb-2 text-xs leading-5 text-[var(--text-muted)]">
                                    {t('company.settings.gallery_body', { defaultValue: 'Paste 3-6 image URLs that show your office, team, product, or work atmosphere. Native role detail will use these photos first.' })}
                                </div>
                                <textarea
                                    id="company-gallery-urls"
                                    name="company-gallery-urls"
                                    className="app-input-field min-h-[120px]"
                                    value={galleryDraft}
                                    onChange={(e) => {
                                        const nextValue = e.target.value;
                                        setGalleryDraft(nextValue);
                                        setLocalProfile({
                                            ...localProfile,
                                            gallery_urls: normalizeGalleryUrlsFromText(nextValue)
                                        });
                                    }}
                                    placeholder={'https://images.example.com/office-1.jpg\nhttps://images.example.com/team-2.jpg\nhttps://images.example.com/product-3.jpg'}
                                />
                                <div className="mt-2 text-[11px] text-[var(--text-faint)]">
                                    {t('company.settings.gallery_hint', { defaultValue: 'One image URL per line. We keep the first 6 valid http/https links.' })}
                                </div>
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

                            {/* Tone of Voice */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="company-tone" className="app-field-label">
                                        <Heart size={16} /> {t('company.settings.tone')}
                                    </label>
                                    <select
                                        id="company-tone"
                                        name="company-tone"
                                        className="app-input-field"
                                        value={localProfile.tone}
                                        onChange={(e) => setLocalProfile({ ...localProfile, tone: e.target.value })}
                                    >
                                        <option value="Professional but friendly">{t('company.settings.tones.friendly')}</option>
                                        <option value="Technical and geeky">{t('company.settings.tones.geeky')}</option>
                                        <option value="Corporate and formal">{t('company.settings.tones.formal')}</option>
                                        <option value="Startup hustle">{t('company.settings.tones.startup')}</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="company-size" className="app-field-label">
                                        <Building2 size={16} /> {t('company.settings.size')}
                                    </label>
                                    <select
                                        id="company-size"
                                        name="company-size"
                                        className="app-input-field"
                                        value={(localProfile as any).company_size || '1-10'}
                                        onChange={(e) => setLocalProfile({ ...localProfile, company_size: e.target.value } as any)}
                                    >
                                        <option value="1-10">1-10 {t('company.settings.employess')}</option>
                                        <option value="11-50">11-50 {t('company.settings.employess')}</option>
                                        <option value="51-200">51-200 {t('company.settings.employess')}</option>
                                        <option value="201-500">201-500 {t('company.settings.employess')}</option>
                                        <option value="500+">500+ {t('company.settings.employess')}</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label htmlFor="company-industry" className="app-field-label">
                                        <Target size={16} /> {t('company.settings.industry')}
                                    </label>
                                    <input
                                        id="company-industry"
                                        name="company-industry"
                                        type="text"
                                        placeholder={t('company.settings.industry_placeholder')}
                                        className="app-input-field"
                                        value={(localProfile as any).field_of_business || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, field_of_business: e.target.value } as any)}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label htmlFor="company-address" className="app-field-label">
                                        <Briefcase size={16} /> {t('company.settings.address')}
                                    </label>
                                    <input
                                        id="company-address"
                                        name="company-address"
                                        type="text"
                                        placeholder={t('company.settings.address_placeholder')}
                                        className="app-input-field"
                                        value={localProfile.address || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Values Tags */}
                            <div>
                                <label className="app-field-label !mb-2">{t('company.settings.values')}</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {localProfile.values.map((val, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent)]">
                                            {val}
                                            <button onClick={() => removeValue(val)} className="hover:opacity-80"><X size={14} /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <label htmlFor="add-value" className="sr-only">{t('company.settings.add_value_placeholder')}</label>
                                    <input
                                        id="add-value"
                                        name="add-value"
                                        type="text"
                                        className="app-input-field flex-1"
                                        placeholder={t('company.settings.add_value_placeholder')}
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addValue()}
                                    />
                                    <button onClick={addValue} className="app-button-secondary rounded-[var(--radius-md)] px-4 py-2">
                                        {t('company.settings.add_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="company-surface rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-card)]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{t('company.settings.team_mgmt')}</h3>
                                    <p className="text-sm text-[var(--text-muted)]">{t('company.settings.team_mgmt_desc')}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-medium text-[var(--text-muted)]">
                                    {t('company.settings.plan_label')} {profile.subscription?.tier === 'professional' ? t('company.subscription.tiers.professional', { defaultValue: 'Professional' }) : profile.subscription?.tier === 'growth' ? t('company.subscription.tiers.growth', { defaultValue: 'Growth' }) : profile.subscription?.tier === 'starter' ? t('company.subscription.tiers.starter', { defaultValue: 'Starter' }) : profile.subscription?.tier === 'trial' ? t('company.subscription.tiers.trial', { defaultValue: 'Free (Trial)' }) : t('company.subscription.tiers.free')}
                                </span>
                                {profile.subscription?.expiresAt && (
                                    <div className="text-xs text-amber-600 dark:text-amber-400">
                                        {t('company.settings.active_until')} {new Date(profile.subscription.expiresAt).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US')}
                                    </div>
                                )}
                                {profile.subscription?.usage && (
                                    <div className="text-xs text-slate-500">
                                        {profile.subscription.usage.aiAssessmentsUsed} {t('company.settings.ai_usage')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Invite Form */}
                        <div className="company-surface-soft mb-4 rounded-[var(--radius-md)] border p-3">
                            <label htmlFor="invite-email" className="block text-xs font-bold uppercase tracking-widest text-[var(--text-faint)] mb-2">{t('company.settings.invite_colleague')}</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail size={16} className="absolute left-3 top-3.5 text-[var(--text-faint)]" />
                                    <input
                                        id="invite-email"
                                        name="invite-email"
                                        type="email"
                                        placeholder={t('company.settings.invite_placeholder')}
                                        className="app-input-field pl-10"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleInvite}
                                    disabled={!inviteEmail || isInviting}
                                    className="app-button-primary rounded-[var(--radius-md)] px-6 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isInviting ? <Sparkles className="animate-spin" size={18} /> : <UserPlus size={18} />}
                                    {t('company.settings.invite_btn')}
                                </button>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                                {t('company.settings.invite_helper', {
                                    defaultValue: 'After the invite is created, you can immediately set what this person does in the company and how they show up in hiring.'
                                })}
                            </div>
                        </div>

                        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 p-3">
                            <div className="text-sm font-semibold text-[var(--text-strong)]">
                                {t('company.settings.team_profiles_title', { defaultValue: 'Team profiles and company context' })}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                {t('company.settings.team_profiles_desc', {
                                    defaultValue: 'Name, avatar and email are linked to the standard JobShaman profile when the member has an account. Here you only manage the company-specific context used in hiring.'
                                })}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {members.length === 0 ? (
                                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                                    {t('company.settings.team_empty', {
                                        defaultValue: 'No team members are configured yet. Invite the first recruiter to give them access and define their role in the company.'
                                    })}
                                </div>
                            ) : null}

                            {members.map(member => (
                                <div key={member.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 transition-colors hover:bg-[var(--surface-muted)]/40">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="h-11 w-11 rounded-full object-cover border border-[var(--border-subtle)]"
                                                />
                                            ) : (
                                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] font-bold text-[var(--text-muted)]">
                                                    {getMemberInitials(member)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 font-semibold text-[var(--text-strong)]">
                                                    <span className="truncate">{member.name}</span>
                                                    {member.role === 'admin' && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                                            <Shield size={10} /> {t('company.settings.admin_label')}
                                                        </span>
                                                    )}
                                                    <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                                        {member.linkedProfile
                                                            ? t('company.settings.member_profile_linked', { defaultValue: 'Linked profile' })
                                                            : t('company.settings.member_profile_pending', { defaultValue: 'Invite pending' })}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-[var(--text-muted)]">{member.email || t('company.settings.member_email_missing', { defaultValue: 'No email available yet' })}</div>
                                                <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                                                    {member.linkedProfile
                                                        ? t('company.settings.member_profile_linked_hint', {
                                                            defaultValue: 'Identity is synced from the user profile. Use the fields below for company role and hiring context only.'
                                                        })
                                                        : t('company.settings.member_profile_pending_hint', {
                                                            defaultValue: 'This invite is not linked to a user account yet. We keep the email and company context here until the account is connected.'
                                                        })}
                                                </div>
                                            </div>
                                        </div>
                                        {member.source !== 'owner' && (
                                            <button
                                                onClick={() => void removeMember(member)}
                                                disabled={removingMemberId === member.id}
                                                className="self-start rounded-[var(--radius-sm)] p-2 text-[var(--text-faint)] transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                title={t('company.settings.remove_from_team')}
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div>
                                            <label htmlFor={`member-company-role-${member.id}`} className="app-field-label">
                                                <Briefcase size={16} /> {t('company.settings.member_company_role', { defaultValue: 'Role in the company' })}
                                            </label>
                                            <input
                                                id={`member-company-role-${member.id}`}
                                                type="text"
                                                className="app-input-field"
                                                value={member.companyRole || ''}
                                                placeholder={t('company.settings.member_company_role_placeholder', { defaultValue: 'Head of Engineering, Founder, Recruiter...' })}
                                                onChange={(e) => handleMemberFieldChange(member.id, 'companyRole', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor={`member-relationship-${member.id}`} className="app-field-label">
                                                <Users size={16} /> {t('company.settings.member_relationship', { defaultValue: 'How is this person connected to the company?' })}
                                            </label>
                                            <input
                                                id={`member-relationship-${member.id}`}
                                                type="text"
                                                className="app-input-field"
                                                value={member.relationshipToCompany || ''}
                                                placeholder={t('company.settings.member_relationship_placeholder', { defaultValue: 'Leads the product team, hiring manager for engineering, co-founder...' })}
                                                onChange={(e) => handleMemberFieldChange(member.id, 'relationshipToCompany', e.target.value)}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label htmlFor={`member-bio-${member.id}`} className="app-field-label">
                                                <MessageSquare size={16} /> {t('company.settings.member_team_bio', { defaultValue: 'Short team / hiring context' })}
                                            </label>
                                            <textarea
                                                id={`member-bio-${member.id}`}
                                                className="app-input-field min-h-[96px]"
                                                value={member.teamBio || ''}
                                                placeholder={t('company.settings.member_team_bio_placeholder', { defaultValue: 'What this person owns, what project they work on, or why candidates may meet them.' })}
                                                onChange={(e) => handleMemberFieldChange(member.id, 'teamBio', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="app-button-primary rounded-[var(--radius-md)] px-8 py-3 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {isSaving ? t('common.saving') : t('company.settings.save_changes')}
                    </button>
                </div>

                {/* Danger Zone */}
                <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-rose-600">
                        <AlertCircle className="w-5 h-5" />
                        {t('profile.danger_zone_title', { defaultValue: 'Danger zone' })}
                    </h3>
                    <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h4 className="mb-1 font-semibold text-[var(--text-strong)]">
                                    {t('profile.delete_account_title', { defaultValue: 'Delete account' })}
                                </h4>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {t('profile.delete_account_desc', { defaultValue: 'Permanently deletes your account and all associated company data. This action cannot be undone.' })}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="whitespace-nowrap rounded-[var(--radius-md)] border border-rose-200 bg-white px-6 py-3 font-semibold text-rose-600 transition-all hover:bg-rose-50 active:scale-[0.98]"
                            >
                                {t('profile.delete_account_btn', { defaultValue: 'Delete my account' })}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Deletion Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
                                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">
                                {t('profile.delete_account_warning_title')}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 text-center mb-8">
                                {t('profile.delete_account_warning_desc')}
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
                                                    alert(t('profile.delete_account_error'));
                                                }
                                            } catch (err) {
                                                setIsDeleting(false);
                                                console.error("Deletion error:", err);
                                                alert(t('profile.delete_account_error'));
                                            }
                                        }
                                    }}
                                    disabled={isDeleting}
                                    className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-500/20 disabled:opacity-50 active:scale-[0.98]"
                                >
                                    {isDeleting ? (
                                        <div className="flex items-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>{t('app.loading')}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Trash2 size={20} />
                                            {t('profile.delete_account_confirm')}
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                    className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                                >
                                    {t('profile.delete_account_cancel')}
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
