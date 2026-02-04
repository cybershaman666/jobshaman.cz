
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import { CompanyProfile, RecruiterMember } from '../types';
import { inviteRecruiter, uploadCompanyLogo, updateCompanyProfile } from '../services/supabaseService';
import { Save, Sparkles, MessageSquare, Heart, Target, Users, Mail, UserPlus, Shield, X, Briefcase, Building2, AlertCircle, Trash2 } from 'lucide-react';

interface CompanySettingsProps {
    profile: CompanyProfile;
    onSave: (profile: CompanyProfile) => void;
    onDeleteAccount?: () => Promise<boolean>;
}

const CompanySettings: React.FC<CompanySettingsProps> = ({ profile, onSave, onDeleteAccount }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'dna' | 'team'>('dna');
    const [localProfile, setLocalProfile] = useState(profile);
    const [isSaving, setIsSaving] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);

    // Team Management State
    const [inviteEmail, setInviteEmail] = useState('');
    const [members, setMembers] = useState<RecruiterMember[]>(profile.members || [
        { id: '1', name: 'Floki Shaman', email: 'floki@jobshaman.cz', role: 'admin', joinedAt: new Date().toISOString() }
    ]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (profile.id) {
                const updated = await updateCompanyProfile(profile.id, { ...localProfile, members });
                setLocalProfile(updated);
                await onSave({ ...updated, members });
            } else {
                await onSave({ ...localProfile, members });
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
            alert(t('company.settings.logo_error') || 'Nepodařilo se nahrát logo.');
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
            // For demo/simplified flow, we pass the company ID and target email
            const result = await inviteRecruiter(profile.id, inviteEmail, (profile as any).created_by || 'system');

            if (result) {
                alert(t('company.settings.invite_success', { email: inviteEmail }));
                // For immediate feedback in demo, we'll manually add to local list if successful
                const newMember: RecruiterMember = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: inviteEmail.split('@')[0],
                    email: inviteEmail,
                    role: 'recruiter',
                    joinedAt: new Date().toISOString()
                };
                setMembers(prev => [...prev, newMember]);
            } else {
                alert(t('company.settings.invite_failed'));
            }
            setInviteEmail('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsInviting(false);
        }
    };

    const removeMember = (id: string) => {
        setMembers(prev => prev.filter(m => m.id !== id));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1 space-y-2">
                <button
                    onClick={() => setActiveTab('dna')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dna' ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <Sparkles size={18} />
                    {t('company.settings.dna')}
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'team' ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <Users size={18} />
                    {t('company.settings.team')}
                </button>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3 space-y-6">
                {activeTab === 'dna' && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                <Target size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.settings.culture_title')}</h3>
                                <p className="text-sm text-slate-500">{t('company.settings.culture_desc')}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Company Logo */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <Building2 size={16} /> {t('company.settings.logo')}
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                        {localProfile.logo_url ? (
                                            <img src={localProfile.logo_url} alt={localProfile.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-lg font-bold text-slate-500">{localProfile.name?.charAt(0) || 'C'}</span>
                                        )}
                                    </div>
                                    <div>
                                        <label className="inline-flex items-center px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-semibold cursor-pointer">
                                            {logoUploading ? (t('company.settings.logo_uploading') || 'Nahrávám...') : (t('company.settings.logo_btn') || 'Nahrát logo')}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={logoUploading}
                                                onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)}
                                            />
                                        </label>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {t('company.settings.logo_hint') || 'Doporučeno: čtverec, min. 300×300 px'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mission / Philosophy */}
                            <div>
                                <label htmlFor="company-mission" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <MessageSquare size={16} /> {t('company.settings.mission')}
                                </label>
                                <textarea
                                    id="company-mission"
                                    name="company-mission"
                                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-cyan-500 outline-none text-slate-700 dark:text-slate-300 min-h-[100px]"
                                    value={localProfile.philosophy || ''}
                                    onChange={(e) => setLocalProfile({ ...localProfile, philosophy: e.target.value })}
                                    placeholder={t('company.settings.mission_placeholder')}
                                />
                            </div>

                            {/* Tone of Voice */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="company-tone" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                        <Heart size={16} /> {t('company.settings.tone')}
                                    </label>
                                    <select
                                        id="company-tone"
                                        name="company-tone"
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-cyan-500 outline-none text-slate-700 dark:text-slate-300"
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
                                    <label htmlFor="company-size" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                        <Building2 size={16} /> {t('company.settings.size')}
                                    </label>
                                    <select
                                        id="company-size"
                                        name="company-size"
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-cyan-500 outline-none text-slate-700 dark:text-slate-300"
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
                                    <label htmlFor="company-industry" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                        <Target size={16} /> {t('company.settings.industry')}
                                    </label>
                                    <input
                                        id="company-industry"
                                        name="company-industry"
                                        type="text"
                                        placeholder={t('company.settings.industry_placeholder')}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-cyan-500 outline-none text-slate-700 dark:text-slate-300"
                                        value={(localProfile as any).field_of_business || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, field_of_business: e.target.value } as any)}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label htmlFor="company-address" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                        <Briefcase size={16} /> {t('company.settings.address')}
                                    </label>
                                    <input
                                        id="company-address"
                                        name="company-address"
                                        type="text"
                                        placeholder={t('company.settings.address_placeholder')}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-cyan-500 outline-none text-slate-700 dark:text-slate-300"
                                        value={localProfile.address || ''}
                                        onChange={(e) => setLocalProfile({ ...localProfile, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Values Tags */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('company.settings.values')}</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {localProfile.values.map((val, idx) => (
                                        <span key={idx} className="bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                            {val}
                                            <button onClick={() => removeValue(val)} className="hover:text-cyan-900 dark:hover:text-white"><X size={14} /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <label htmlFor="add-value" className="sr-only">{t('company.settings.add_value_placeholder')}</label>
                                    <input
                                        id="add-value"
                                        name="add-value"
                                        type="text"
                                        className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-cyan-500 outline-none"
                                        placeholder={t('company.settings.add_value_placeholder')}
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addValue()}
                                    />
                                    <button onClick={addValue} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                                        {t('company.settings.add_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.settings.team_mgmt')}</h3>
                                    <p className="text-sm text-slate-500">{t('company.settings.team_mgmt_desc')}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-medium text-slate-500">
                                    {t('company.settings.plan_label')} {profile.subscription?.tier === 'business' ? t('company.subscription.tiers.business') : profile.subscription?.tier === 'basic' ? t('company.subscription.tiers.basic') : t('company.subscription.tiers.free')}
                                </span>
                                {profile.subscription?.expiresAt && (
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
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
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6">
                            <label htmlFor="invite-email" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t('company.settings.invite_colleague')}</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input
                                        id="invite-email"
                                        name="invite-email"
                                        type="email"
                                        placeholder={t('company.settings.invite_placeholder')}
                                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-cyan-500 outline-none"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleInvite}
                                    disabled={!inviteEmail || isInviting}
                                    className="px-6 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isInviting ? <Sparkles className="animate-spin" size={18} /> : <UserPlus size={18} />}
                                    {t('company.settings.invite_btn')}
                                </button>
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="space-y-3">
                            {members.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                {member.name}
                                                {member.role === 'admin' && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1"><Shield size={10} /> {t('company.settings.admin_label')}</span>}
                                            </div>
                                            <div className="text-xs text-slate-500">{member.email}</div>
                                        </div>
                                    </div>
                                    {member.role !== 'admin' && (
                                        <button
                                            onClick={() => removeMember(member.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Odebrat z týmu"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {isSaving ? t('common.saving') : t('company.settings.save_changes')}
                    </button>
                </div>

                {/* Danger Zone */}
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-rose-600 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {t('profile.danger_zone_title') || 'Nebezpečná zóna'}
                    </h3>
                    <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                                    {t('profile.delete_account_title') || 'Smazat účet'}
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('profile.delete_account_desc') || 'Trvale smaže váš účet a všechna přidružená data společnosti. Tuto akci nelze vrátit zpět.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-6 py-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-[0.98] shadow-sm shadow-rose-500/5 whitespace-nowrap"
                            >
                                {t('profile.delete_account_btn') || 'Smazat můj účet'}
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
