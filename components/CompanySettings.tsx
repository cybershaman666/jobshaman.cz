
import React, { useState } from 'react';
import { CompanyProfile } from '../types';
import { Settings, Save, Sparkles, MessageSquare, Heart, Target } from 'lucide-react';

interface CompanySettingsProps {
  profile: CompanyProfile;
  onSave: (profile: CompanyProfile) => void;
}

const CompanySettings: React.FC<CompanySettingsProps> = ({ profile, onSave }) => {
  const [localProfile, setLocalProfile] = useState(profile);
  const [newValue, setNewValue] = useState('');

  const handleSave = () => {
    onSave(localProfile);
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in transition-colors duration-300">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-950/50 rounded-t-xl">
        <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-500/20">
          <Settings size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Firemní DNA</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Tato nastavení ovlivňují, jak AI píše vaše inzeráty a vyhodnocuje kandidáty.</p>
        </div>
      </div>

      <div className="p-8 space-y-8">
        
        {/* Philosophy */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-4">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    <Target size={16} /> Filosofie (Our Why)
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Proč vaše firma existuje? AI použije tento kontext, aby inzeráty nepůsobily prázdně.
                </p>
            </div>
            <div className="md:col-span-8">
                <textarea 
                    value={localProfile.philosophy}
                    onChange={(e) => setLocalProfile({...localProfile, philosophy: e.target.value})}
                    className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                    placeholder="Např. Věříme, že software má sloužit lidem, ne naopak..."
                />
            </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* Tone */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-4">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    <MessageSquare size={16} /> Tone of Voice
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Jak chcete znít? Formálně, přátelsky, geeky?
                </p>
            </div>
            <div className="md:col-span-8">
                <select 
                    value={localProfile.tone}
                    onChange={(e) => setLocalProfile({...localProfile, tone: e.target.value})}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-slate-200 transition-colors"
                >
                    <option value="Professional but friendly">Profesionální ale přátelský</option>
                    <option value="Technical and dry">Technický a věcný</option>
                    <option value="Startup hype">Energický startup (pozor na prázdné fráze)</option>
                    <option value="Empathetic and calm">Empatický a klidný</option>
                </select>
                <div className="mt-3 p-3 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-xs rounded-lg border border-cyan-500/20">
                    <Sparkles size={12} className="inline mr-1" />
                    AI upraví slovní zásobu a strukturu vět podle tohoto nastavení.
                </div>
            </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-4">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    <Heart size={16} /> Skutečné Hodnoty
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Žádné prázdné fráze. Co skutečně žijete?
                </p>
            </div>
            <div className="md:col-span-8">
                <div className="flex gap-2 mb-3">
                    <input 
                        type="text" 
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addValue()}
                        placeholder="Přidat hodnotu (např. 'Chyby jsou OK')"
                        className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                    />
                    <button 
                        onClick={addValue}
                        className="px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors"
                    >
                        +
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {localProfile.values.map((val, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 rounded-lg text-sm font-medium">
                            {val}
                            <button onClick={() => removeValue(val)} className="hover:text-cyan-900 dark:hover:text-cyan-100">×</button>
                        </span>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex justify-end pt-4">
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-cyan-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-cyan-500 transition-colors shadow-[0_0_20px_rgba(8,145,178,0.4)] active:scale-95"
            >
                <Save size={18} /> Uložit DNA
            </button>
        </div>

      </div>
    </div>
  );
};

export default CompanySettings;
