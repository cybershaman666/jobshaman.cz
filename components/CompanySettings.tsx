import React, { useState } from 'react';
import { CompanyProfile, RecruiterMember } from '../types';
import { inviteRecruiter } from '../services/supabaseService';
import { Settings, Save, Sparkles, MessageSquare, Heart, Target, Users, Mail, UserPlus, Shield, X, CheckCircle, Info, Loader2 } from 'lucide-react';

interface CompanySettingsProps {
    profile: CompanyProfile;
    onSave: (profile: CompanyProfile) => void;
}

const CompanySettings: React.FC<CompanySettingsProps> = ({ profile, onSave }) => {
    const [activeTab, setActiveTab] = useState<'dna' | 'team'>('dna');
    const [localProfile, setLocalProfile] = useState(profile);
    const [newValue, setNewValue] = useState('');

    // Team Management State
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
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
            const result = await inviteRecruiter(profile.id, inviteEmail, profile.created_by || 'system');

            if (result) {
                alert(`Pozvánka pro ${inviteEmail} byla odeslána!`);
                // For immediate feedback in demo, we'll manually add to local list if successful
                const newMember: RecruiterMember = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: inviteEmail.split('@')[0],
                    email: inviteEmail,
                    role: 'recruiter',
                    joinedAt: new Date().toISOString()
                };
                setMembers([...members, newMember]);
            } else {
                alert(`Pozvánka odeslána uživateli ${inviteEmail}. Připojí se jakmile přijme pozvání.`);
            }
        } catch (e) {
            console.error(e);
            alert("Chyba při odesílání pozvánky.");
        } finally {
            setIsInviting(false);
            setInviteEmail('');
        }
    };

    const removeMember = (id: string) => {
        if (members.find(m => m.id === id)?.role === 'admin') {
            alert("Administrátora nelze odebrat.");
            return;
        }
        setMembers(members.filter(m => m.id !== id));
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
            {/* Header */}
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-600 text-white rounded-2xl shadow-lg shadow-cyan-900/20">
                            <Settings size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Správa Společnosti</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Konfigurace identity a týmu vaší firmy.</p>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('dna')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dna' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Sparkles size={16} /> Firemní DNA
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Users size={16} /> Tým
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-8">
                {activeTab === 'dna' ? (
                    <div className="space-y-10">
                        {/* Philosophy */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4">
                                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                    <Target size={16} className="text-cyan-500" /> Filosofie & Mission
                                </h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Definujte své "Proč". AI Šaman tyto informace využije k budování autentického brandu ve vašich inzerátech.
                                </p>
                            </div>
                            <div className="lg:col-span-8">
                                <textarea
                                    value={localProfile.philosophy}
                                    onChange={(e) => setLocalProfile({ ...localProfile, philosophy: e.target.value })}
                                    className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm leading-relaxed text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all resize-none"
                                    placeholder="Např. Věříme v absolutní transparentnost a lidský přístup k technologiím..."
                                />
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-800" />

                        {/* Tone */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4">
                                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                    <MessageSquare size={16} className="text-cyan-500" /> Tone of Voice
                                </h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Jakým hlasem vaše firma mluví ke kandidátům?
                                </p>
                            </div>
                            <div className="lg:col-span-8">
                                <select
                                    value={localProfile.tone}
                                    onChange={(e) => setLocalProfile({ ...localProfile, tone: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm font-bold text-slate-900 dark:text-slate-200 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="Professional but friendly">Profesionální ale přátelský</option>
                                    <option value="Technical and dry">Technický a věcný</option>
                                    <option value="Startup hype">Energický startup</option>
                                    <option value="Empathetic and calm">Empatický a klidný</option>
                                </select>
                                <div className="mt-4 p-4 bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-100 dark:border-cyan-500/10 rounded-xl flex items-start gap-3">
                                    <Sparkles size={16} className="text-cyan-600 dark:text-cyan-400 mt-0.5" />
                                    <p className="text-xs text-cyan-800 dark:text-cyan-200 leading-relaxed font-medium">
                                        Tato volba zásadně ovlivňuje generovaný text inzerátů a styl komunikace v Assessment Centru.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-800" />

                        {/* Values */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4">
                                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                    <Heart size={16} className="text-cyan-500" /> Skutečné Hodnoty
                                </h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Co je pro vás při spolupráci nediskutovatelné?
                                </p>
                            </div>
                            <div className="lg:col-span-8">
                                <div className="flex gap-2 mb-6">
                                    <input
                                        type="text"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addValue()}
                                        placeholder="Nová hodnota (např. 'Radikální upřímnost')"
                                        className="flex-1 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm text-slate-900 dark:text-slate-200 transition-all"
                                    />
                                    <button
                                        onClick={addValue}
                                        className="px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black transition-all hover:opacity-90 active:scale-95"
                                    >
                                        Přidat
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {localProfile.values.map((val, idx) => (
                                        <div key={idx} className="group relative flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold shadow-sm transition-all hover:border-cyan-500 dark:hover:border-cyan-500">
                                            {val}
                                            <button
                                                onClick={() => removeValue(val)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        {/* Team Invite */}
                        <div className="bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative group">
                                    <Mail size={18} className="absolute left-4 top-4 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="Email nového náboraře..."
                                        className="w-full pl-12 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleInvite}
                                    className="flex items-center justify-center gap-2 px-8 py-4 bg-cyan-600 text-white rounded-2xl font-black transition-all hover:bg-cyan-500 shadow-lg shadow-cyan-900/20"
                                >
                                    <UserPlus size={20} /> Pozvat do Týmu
                                </button>
                            </div>
                            <div className="mt-4 flex items-start gap-2 px-1">
                                <Info size={14} className="text-slate-400 mt-1" />
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Pozvaný uživatel obdrží e-mail s odkazem pro připojení k vaší společnosti. Bude moci spravovat své pozice a kandidáty.
                                </p>
                            </div>
                        </div>

                        {/* Member List */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Členové Týmu ({members.length})</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {members.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold">
                                                {member.name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    {member.name}
                                                    {member.role === 'admin' && (
                                                        <span className="flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-slate-500 uppercase tracking-tighter border border-slate-200 dark:border-slate-700">
                                                            <Shield size={10} /> Admin
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500">{member.email}</div>
                                            </div>
                                        </div>
                                        {member.role !== 'admin' && (
                                            <button
                                                onClick={() => removeMember(member.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Odebrat z týmu"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-10 border-t border-slate-100 dark:border-slate-800 mt-10">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-10 py-4 rounded-2xl font-black hover:opacity-90 transition-all shadow-xl active:scale-95 flex-col sm:flex-row group"
                    >
                        <div className="flex items-center gap-2">
                            <Save size={20} className="group-hover:scale-110 transition-transform" />
                            Uložit veškerá nastavení
                        </div>
                    </button>
                </div>
            </div>

            {/* Visual Decorative elements */}
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        </div>
    );
};

export default CompanySettings;
