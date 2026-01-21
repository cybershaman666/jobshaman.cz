
import React, { useState } from 'react';
import { Copy, Check, Bot, Cpu, Zap, Binary } from 'lucide-react';
import { generateCoverLetter } from '../services/geminiService';
import { Job } from '../types';

interface AICoverLetterProps {
  job: Job;
  variant?: 'light' | 'dark';
}

const AICoverLetter: React.FC<AICoverLetterProps> = ({ job, variant = 'light' }) => {
  const [experience, setExperience] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const isDark = variant === 'dark';

  const handleGenerate = async () => {
    if (!experience.trim()) return;
    setLoading(true);
    const letter = await generateCoverLetter(job.title, job.company, job.description, experience);
    setResult(letter);
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Styles - Cyber Shaman Theme (Cyan/Slate)
  const containerStyle = isDark
    ? "bg-slate-950 border-cyan-500/30 shadow-[0_0_20px_rgba(8,145,178,0.1)] text-slate-200"
    : "bg-gradient-to-br from-cyan-50 to-slate-50 border-cyan-200 text-slate-900 shadow-sm";

  const iconBoxStyle = isDark
    ? "bg-cyan-950/50 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
    : "bg-cyan-100 border-cyan-300 text-cyan-700";
    
  const textAreaStyle = isDark
    ? "bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-cyan-500/50 focus:border-cyan-500/50"
    : "bg-white border-cyan-200 text-slate-900 placeholder:text-slate-400 focus:ring-cyan-400";

  const buttonStyle = loading 
    ? (isDark ? "bg-slate-800 text-slate-500 border border-slate-700" : "bg-cyan-100 text-cyan-400")
    : (isDark ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.4)] border border-cyan-400/50" : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-900/10");

  const resultBoxStyle = isDark
    ? "bg-slate-900/80 border-cyan-900/50 text-cyan-100"
    : "bg-white border-cyan-100 text-slate-700";

  const secondaryBtnStyle = isDark
    ? "text-slate-400 hover:text-cyan-400"
    : "text-slate-400 hover:text-cyan-700";
    
  const copyBtnStyle = isDark
    ? "bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 hover:border-cyan-500/30"
    : "bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200";

  return (
    <div className={`rounded-xl p-6 border relative overflow-hidden ${containerStyle}`}>
      {/* Decorative Cyber Background */}
      <div className={`absolute top-[-20px] right-[-20px] opacity-10 pointer-events-none ${isDark ? 'text-cyan-500' : 'text-cyan-600'}`}>
        <Binary size={140} />
      </div>

      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={`p-2.5 rounded-lg border ${iconBoxStyle}`}>
             <Bot size={24} />
        </div>
        <div>
            <h3 className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Kyber Šaman <span className="text-xs font-mono font-normal opacity-70 ml-2">v2.1</span>
            </h3>
            <p className={`text-xs font-medium font-mono ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>Optimalizace textového výstupu.</p>
        </div>
      </div>
      
      {!result ? (
        <div className="space-y-4 relative z-10">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Nahrajte surová data (zkušenosti). Algoritmus vygeneruje motivační dopis s maximální konverzní pravděpodobností.
            </p>
            <textarea
                className={`w-full rounded-lg p-3 text-sm focus:ring-1 focus:outline-none min-h-[120px] font-mono ${textAreaStyle}`}
                placeholder="// Input stream: 5 let React, vybudoval jsem e-shop, clean code..."
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
            />
            <button
                onClick={handleGenerate}
                disabled={loading || !experience}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${buttonStyle}`}
            >
                {loading ? (
                    <>
                        <Cpu size={18} className="animate-spin" /> Procesuji data...
                    </>
                ) : (
                    <>
                        <Zap size={18} className="fill-current" /> Vygenerovat sekvenci
                    </>
                )}
            </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in relative z-10">
            <div className={`rounded-lg p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap border shadow-inner ${resultBoxStyle}`}>
                {result}
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handleCopy}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${copyBtnStyle}`}
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Zkopírováno do schránky' : 'Kopírovat výstup'}
                </button>
                <button 
                    onClick={() => setResult('')}
                    className={`px-4 py-2 text-sm font-medium ${secondaryBtnStyle}`}
                >
                    Reset
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default AICoverLetter;
