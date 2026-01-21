
import React from 'react';
import { AlertTriangle, ThumbsUp, Activity, Ban } from 'lucide-react';
import { NoiseMetrics } from '../types';

interface BullshitMeterProps {
  metrics: NoiseMetrics;
  variant?: 'light' | 'dark';
}

const BullshitMeter: React.FC<BullshitMeterProps> = ({ metrics, variant = 'light' }) => {
  const isDark = variant === 'dark';
  const isHigh = metrics.score > 50;
  const isMedium = metrics.score > 20 && metrics.score <= 50;
  
  // Define accent colors
  let accentColor = "bg-emerald-500";
  let iconColor = isHigh ? "text-rose-500" : isMedium ? "text-amber-500" : "text-emerald-500";
  let statusText = "Čistý signál";
  
  if (isHigh) {
    accentColor = "bg-rose-500";
    statusText = "Vysoký šum";
  } else if (isMedium) {
    accentColor = "bg-amber-500";
    statusText = "Střední šum";
  }

  // Theme Base Styles
  const containerStyle = isDark 
    ? "bg-slate-900 border-slate-800 text-slate-100 shadow-lg" 
    : "bg-white border-slate-200 text-slate-900 shadow-sm";

  const subTextStyle = isDark ? "text-slate-400" : "text-slate-500"; // Lightened
  const badgeStyle = isDark 
    ? (isHigh ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-slate-800 border-slate-700 text-slate-300")
    : (isHigh ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-slate-100 border-slate-200 text-slate-600");

  const iconBoxStyle = isDark 
    ? "bg-slate-800 border border-slate-700" 
    : (isHigh ? "bg-rose-50" : "bg-slate-50");

  const trackStyle = isDark ? "bg-slate-800" : "bg-slate-100";
  const dividerStyle = isDark ? "border-slate-800" : "border-slate-100";
  
  const flagStyle = isDark
    ? "bg-slate-800 border-slate-700 text-slate-300"
    : "bg-slate-50 border-slate-200 text-slate-600";

  return (
    <div className={`rounded-xl border p-5 relative overflow-hidden ${containerStyle}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <Activity size={16} className={isDark ? "text-rose-400" : "text-slate-400"} />
                <h4 className={`text-xs font-bold uppercase tracking-widest ${subTextStyle}`}>Detektor Klišé</h4>
            </div>
            <div className="flex items-center gap-2">
                <span className={`text-2xl font-mono font-bold ${isHigh ? 'text-rose-500' : (isDark ? 'text-slate-100' : 'text-slate-800')}`}>
                    {metrics.score}%
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                    {statusText}
                </span>
            </div>
        </div>
        <div className={`p-2 rounded-lg ${iconBoxStyle}`}>
             {isHigh ? <AlertTriangle size={20} className={iconColor} /> : <ThumbsUp size={20} className={iconColor} />}
        </div>
      </div>
      
      {/* Gauge Bar */}
      <div className={`w-full rounded-full h-2.5 mb-4 overflow-hidden ${trackStyle}`}>
        <div 
            className={`h-full rounded-full transition-all duration-500 ${accentColor} ${isDark ? 'shadow-[0_0_10px_currentColor] opacity-90' : ''}`} 
            style={{ width: `${metrics.score}%` }}
        />
      </div>

      <div className={`space-y-3 pt-3 border-t ${dividerStyle}`}>
        <div className="flex justify-between items-center text-xs">
            <span className={subTextStyle}>Detekovaný tón</span>
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{metrics.tone}</span>
        </div>
        
        {metrics.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {metrics.flags.map((flag, idx) => (
              <span key={idx} className={`inline-flex items-center gap-1 px-2 py-1 border rounded text-[10px] font-medium ${flagStyle}`}>
                <Ban size={10} className="text-rose-400" />
                {flag}
              </span>
            ))}
          </div>
        ) : (
          <p className={`text-xs italic mt-2 ${subTextStyle}`}>Nebyly nalezeny žádné varovné signály.</p>
        )}
      </div>
    </div>
  );
};

export default BullshitMeter;
