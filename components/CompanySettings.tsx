
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import { CompanyProfile, RecruiterMember } from '../types';
import { inviteRecruiter } from '../services/supabaseService';
import { Save, Sparkles, MessageSquare, Heart, Target, Users, Mail, UserPlus, Shield, X } from 'lucide-react';

interface CompanySettingsProps {
    profile: CompanyProfile;
    onSave: (profile: CompanyProfile) => void;
}

const CompanySettings: React.FC<CompanySettingsProps> = ({ profile, onSave }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'dna' | 'team'>('dna');
    const [localProfile, setLocalProfile] = useState(profile);
    const [newValue, setNewValue] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    // Team Management State
    const [inviteEmail, setInviteEmail] = useState('');
    const [members, setMembers] = useState<RecruiterMember[]>(profile.members || [
        { id: '1', name: 'Floki Shaman', email: 'floki@jobshaman.cz', role: 'admin', joinedAt: new Date().toISOString() }
    ]);

    const handleSave = () => {
        onSave({ ...localProfile, members });
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dna' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <Sparkles size={18} />
                    {t('company.settings.dna')}
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'team' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
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
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                <Target size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('company.settings.culture_title')}</h3>
                                <p className="text-sm text-slate-500">{t('company.settings.culture_desc')}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Mission / Philosophy */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <MessageSquare size={16} /> {t('company.settings.mission')}
                                </label>
                                <textarea
                                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-300 min-h-[100px]"
                                    value={localProfile.philosophy}
                                    onChange={(e) => setLocalProfile({ ...localProfile, philosophy: e.target.value })}
                                    placeholder={t('company.settings.mission_placeholder')}
                                />
                            </div>

                            {/* Tone of Voice */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                        <Heart size={16} /> {t('company.settings.tone')}
                                    </label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-300"
                                        value={localProfile.tone}
                                        onChange={(e) => setLocalProfile({ ...localProfile, tone: e.target.value })}
                                    >
                                        <option value="Professional but friendly">{t('company.settings.tones.friendly')}</option>
                                        <option value="Technical and geeky">{t('company.settings.tones.geeky')}</option>
                                        <option value="Corporate and formal">{t('company.settings.tones.formal')}</option>
                                        <option value="Startup hustle">{t('company.settings.tones.startup')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Values Tags */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('company.settings.values')}</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {localProfile.values.map((val, idx) => (
                                        <span key={idx} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                            {val}
                                            <button onClick={() => removeValue(val)} className="hover:text-indigo-900 dark:hover:text-white"><X size={14} /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
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
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t('company.settings.invite_colleague')}</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input
                                        type="email"
                                        placeholder={t('company.settings.invite_placeholder')}
                                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleInvite}
                                    disabled={!inviteEmail || isInviting}
                                    className="px-6 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                        className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2"
                    >
                        <Save size={18} />
                        {t('company.settings.save_changes')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanySettings;
