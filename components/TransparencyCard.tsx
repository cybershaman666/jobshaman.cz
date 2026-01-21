
import React from 'react';
import { TransparencyMetrics } from '../types';
import { Users, UserX, Clock, AlertOctagon, Activity } from 'lucide-react';

interface TransparencyCardProps {
  data: TransparencyMetrics;
  companyName: string;
  variant?: 'light' | 'dark';
}

const TransparencyCard: React.FC<TransparencyCardProps> = ({ data, companyName, variant = 'light' }) => {
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

  // Stat Box Helpers
  const getTurnoverStyle = (rate: number) => {
    if (rate > 25) return isDark 
        ? 'text-rose-400 bg-rose-950/20 border-rose-900/50' 
        : 'text-rose-600 bg-rose-50 border-rose-100';
    if (rate > 15) return isDark
        ? 'text-amber-400 bg-amber-950/20 border-amber-900/50'
        : 'text-amber-600 bg-amber-50 border-amber-100';
    return isDark
        ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/50'
        : 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  const getGhostingColor = (rate: number) => {
    if (rate > 40) return isDark ? 'text-rose-500' : 'text-rose-600';
    if (rate > 20) return isDark ? 'text-amber-500' : 'text-amber-600';
    return isDark ? 'text-slate-400' : 'text-slate-600';
  };

  const hiringBoxStyle = isDark
    ? "bg-slate-800/50 border-slate-700 text-slate-300"
    : "bg-slate-50 border-slate-100 text-slate-700";

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

      <div className="p-4 grid grid-cols-2 gap-4">
         
         {/* Turnover */}
         <div className={`p-3 rounded-lg border ${getTurnoverStyle(data.turnoverRate)}`}>
            <div className="flex items-center gap-2 mb-1 opacity-80">
               <Users size={14} />
               <span className="text-xs font-bold uppercase">Roční Fluktuace</span>
            </div>
            <div className="text-2xl font-mono font-bold">{data.turnoverRate}%</div>
            <div className="text-[10px] opacity-80 mt-1">
               {data.turnoverRate > 20 ? 'Vysoké riziko odchodů' : 'Stabilní tým'}
            </div>
         </div>

         {/* Hiring Speed */}
         <div className={`p-3 rounded-lg border ${hiringBoxStyle}`}>
            <div className="flex items-center gap-2 mb-1 opacity-70">
               <Clock size={14} />
               <span className="text-xs font-bold uppercase">Rychlost náboru</span>
            </div>
            <div className="text-lg font-medium leading-tight">{data.hiringSpeed}</div>
            <div className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Očekávaný proces</div>
         </div>

         {/* Avg Tenure */}
         <div className="col-span-1 p-3">
             <div className={`text-xs mb-1 ${subTextColor}`}>Průměrná délka úvazku</div>
             <div className="flex items-end gap-1">
                <span className={`text-xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{data.avgTenure}</span>
                <span className={`text-sm mb-0.5 ${subTextColor}`}>roku</span>
             </div>
             <div className={`w-full h-1.5 rounded-full mt-2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div 
                   className={`h-1.5 rounded-full ${data.avgTenure < 1.5 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                   style={{ width: `${Math.min(100, data.avgTenure * 20)}%` }}
                ></div>
             </div>
         </div>

         {/* Ghosting */}
         <div className="col-span-1 p-3">
             <div className={`text-xs mb-1 flex items-center gap-1 ${subTextColor}`}>
                <UserX size={12} /> Pravděpodobnost Ghostingu
             </div>
             <div className={`text-xl font-bold ${getGhostingColor(data.ghostingRate)}`}>
                {data.ghostingRate}%
             </div>
             <div className={`text-[10px] leading-tight mt-1 ${subTextColor}`}>
                šance, že se po CV nikdy neozvou
             </div>
         </div>
      </div>

      {/* Red Flags Specifics */}
      {data.redFlags.length > 0 && (
         <div className={`p-3 border-t ${isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50 border-rose-100'}`}>
            <div className="flex items-start gap-2">
               <AlertOctagon size={14} className="text-rose-600 mt-0.5" />
               <div className="flex flex-wrap gap-1">
                  {data.redFlags.map((flag, idx) => (
                     <span key={idx} className={`text-xs font-medium px-1.5 py-0.5 rounded border ${isDark ? 'text-rose-400 bg-rose-950/40 border-rose-900/50' : 'text-rose-700 bg-white/50 border-rose-200'}`}>
                        {flag}
                     </span>
                  ))}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default TransparencyCard;
