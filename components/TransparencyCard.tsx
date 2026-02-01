
import React from 'react';

import { Activity, Info, Euro } from 'lucide-react';

interface TransparencyCardProps {
   variant?: 'light' | 'dark';
}

const TransparencyCard: React.FC<TransparencyCardProps> = ({ variant = 'light' }) => {
   const isDark = variant === 'dark';

   // Styles
   const containerStyle = isDark
      ? "bg-slate-900 border-slate-800 shadow-lg"
      : "bg-white border-slate-200 shadow-sm";

   const headerStyle = isDark
      ? "bg-slate-950/30 border-slate-800"
      : "bg-slate-50 border-slate-100";

   const headerTitleColor = isDark ? "text-slate-400" : "text-slate-600";
   const subTextColor = isDark ? "text-slate-400" : "text-slate-400"; // Lightened

   return (
      <div className={`border rounded-xl overflow-hidden ${containerStyle}`}>
         <div className={`p-3 border-b flex items-center justify-between ${headerStyle}`}>
            <div className="flex items-center gap-2">
               <Activity size={16} className="text-indigo-500" />
               <h3 className={`text-xs font-bold uppercase tracking-widest ${headerTitleColor}`}>
                  Brutální Transparentnost
               </h3>
            </div>
            <span className={`text-[10px] ${subTextColor}`}>Data: JobShaman</span>
         </div>

         {/* EU Transparent Badge Explanation */}
         <div className={`p-3 ${isDark ? 'bg-emerald-950/10' : 'bg-emerald-50'}`}>
            <div className="flex items-start gap-2">
               <Euro size={14} className="text-emerald-600 mt-0.5" />
               <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                     <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Proč vidíte EU Transparent odznak?</h4>
                     <Info size={10} className="text-emerald-500" />
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                     Od června 2026 bude uvádění platového rozmezí v EU povinné.
                     My v JobShamanu věříme, že váš čas má svou cenu už dnes.
                     Firmy s tímto označením hrají fér a otevřeně ukazují odměnu jako první.
                  </p>
               </div>
            </div>
         </div>
      </div>
   );
};

export default TransparencyCard;
