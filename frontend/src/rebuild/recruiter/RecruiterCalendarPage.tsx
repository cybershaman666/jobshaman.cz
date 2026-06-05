import React from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  User,
  Settings,
  Bell,
  CheckCircle,
  Plus,
  RefreshCw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { CalendarEvent } from '../models';

interface RecruiterCalendarPageProps {
  calendarEvents: CalendarEvent[];
  t: (key: string, options?: any) => string;
}

export const RecruiterCalendarPage: React.FC<RecruiterCalendarPageProps> = ({
  calendarEvents,
  t,
}) => {
  const [syncGoogle, setSyncGoogle] = React.useState(true);
  const [syncOutlook, setSyncOutlook] = React.useState(false);
  const [meetingDuration, setMeetingDuration] = React.useState('30');
  const [meetingPlatform, setMeetingPlatform] = React.useState('google_meet');
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  // Derive notifications from upcoming calendar events
  const upcomingEvents = React.useMemo(() => {
    return [...calendarEvents]
      .map((event) => {
        // Map relative day to actual date object
        const date = new Date();
        date.setDate(event.day);
        return { ...event, date };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendarEvents]);

  // Stage styling helpers
  const getStageBadge = (stage: CalendarEvent['stage']) => {
    switch (stage) {
      case 'initial':
        return {
          label: 'Úvodní hovor',
          bg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40',
        };
      case 'assessment':
        return {
          label: 'Review testu',
          bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/40',
        };
      case 'panel':
        return {
          label: 'Firma / Panel',
          bg: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/40',
        };
      case 'offer':
        return {
          label: 'Nabídka',
          bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40',
        };
      default:
        return {
          label: 'Pohovor',
          bg: 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
        };
    }
  };

  // Generate calendar grid for current month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    
    // Adjusted firstDay for Monday start (0: Sun -> 6, 1: Mon -> 0)
    const mondayStartIdx = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    // Padding for previous month
    for (let i = 0; i < mondayStartIdx; i++) {
      days.push(null);
    }
    // Days of current month
    for (let i = 1; i <= daysCount; i++) {
      days.push(i);
    }
    return days;
  };

  const daysGrid = React.useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const monthName = currentMonth.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Notification Bar for urgent calendar actions */}
      <div className="rounded-2xl border border-amber-250 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Bell size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Připomínka plánování schůzek
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Máte 2 nové kandidáty žádající o termín úvodního rozhovoru.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => alert('Přesměrování na talent pool s filtrem nevyřešených termínů...')}
          className="rounded-xl bg-amber-500 text-white px-4 py-2 text-xs font-bold hover:bg-amber-600 transition shadow-sm"
        >
          Vyřešit žádosti
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        
        {/* Left: Monthly Calendar View */}
        <div className="rounded-[32px] border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 backdrop-blur-xl p-7 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">
                Přehled schůzek
              </h3>
              <h2 className="text-lg font-black text-slate-900 dark:text-white capitalize mt-1">
                {monthName}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            <div>po</div>
            <div>út</div>
            <div>st</div>
            <div>čt</div>
            <div>pá</div>
            <div className="text-slate-350 dark:text-slate-550">so</div>
            <div className="text-slate-350 dark:text-slate-550">ne</div>
          </div>

          {/* Calendar Grid Body */}
          <div className="grid grid-cols-7 gap-2 flex-1 min-h-[350px]">
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="rounded-2xl bg-slate-50/30 dark:bg-slate-950/10 border border-transparent"
                  />
                );
              }

              // Check if any events fall on this day
              const dayEvents = calendarEvents.filter((ev) => ev.day === day);
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === currentMonth.getMonth() &&
                new Date().getFullYear() === currentMonth.getFullYear();

              return (
                <div
                  key={`day-${day}`}
                  className={`rounded-2xl border p-2 flex flex-col justify-between min-h-[70px] relative transition-all ${
                    isToday
                      ? 'border-cyan-500 bg-cyan-500/5 dark:bg-cyan-950/10'
                      : 'border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/10 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-750'
                  }`}
                >
                  <span
                    className={`text-xs font-black self-start h-5 w-5 flex items-center justify-center rounded-lg ${
                      isToday
                        ? 'bg-cyan-500 text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {day}
                  </span>

                  {/* Dot markers or mini lists of events */}
                  {dayEvents.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const style = getStageBadge(ev.stage);
                        return (
                          <div
                            key={ev.id}
                            title={`${ev.title} (${style.label})`}
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md border truncate ${style.bg}`}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[7px] font-black text-cyan-600 dark:text-cyan-400 self-center pl-1">
                          +{dayEvents.length - 2} další
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Scheduler and Integrations settings */}
        <div className="space-y-6">
          
          {/* Calendar settings */}
          <div className="rounded-[32px] border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 backdrop-blur-xl p-7 shadow-sm space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)] flex items-center gap-1.5">
              <Settings size={14} /> Nastavení schůzek
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Výchozí délka schůzky
                </label>
                <select
                  value={meetingDuration}
                  onChange={(e) => setMeetingDuration(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="15">15 minut (Rychlý intro call)</option>
                  <option value="30">30 minut (Standardní review)</option>
                  <option value="45">45 minut (Hloubkový pohovor)</option>
                  <option value="60">60 minut (Technický panel)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Platforma pro pohovory
                </label>
                <select
                  value={meetingPlatform}
                  onChange={(e) => setMeetingPlatform(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="google_meet">Google Meet (Automatické generování odkazu)</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="phone">Telefonní hovor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sync integrations */}
          <div className="rounded-[32px] border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 backdrop-blur-xl p-7 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)] flex items-center gap-1.5">
              <RefreshCw size={14} /> Synchronizace kalendáře
            </h3>

            <div className="space-y-3 pt-1">
              {/* Google */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
                    G
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-250">Google Calendar</div>
                    <div className="text-[10px] text-emerald-500 font-medium">Připojeno a synchronizováno</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncGoogle}
                    onChange={(e) => setSyncGoogle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Outlook */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-sm">
                    O
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-250">Outlook / Exchange</div>
                    <div className="text-[10px] text-slate-400 font-medium">Odpojeno</div>
                  </div>
                </div>
                <label className="relative inline-flex inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncOutlook}
                    onChange={(e) => setSyncOutlook(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming events list */}
      <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 backdrop-blur-xl p-7 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)] mb-5">
          Nadcházející schůzky ({upcomingEvents.length})
        </h3>
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 italic">
            Žádné naplánované schůzky v kalendáři.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((ev) => {
              const style = getStageBadge(ev.stage);
              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 p-4 space-y-3 hover:border-slate-200 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-slate-800 dark:text-white leading-snug">
                        {ev.title}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        <Clock size={11} />
                        <span>{ev.time}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-1" />
                        <span>Den {ev.day}. v měsíci</span>
                      </div>
                    </div>
                    <span className={`rounded-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border shrink-0 ${style.bg}`}>
                      {style.label}
                    </span>
                  </div>

                  {ev.note && (
                    <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 italic border-l-2 border-slate-200 dark:border-slate-800 pl-2">
                      “{ev.note}”
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[10px] font-bold">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Video size={12} /> Google Meet
                    </span>
                    <button
                      type="button"
                      onClick={() => alert(`Spouštím pohovor s ${ev.title} přes Google Meet...`)}
                      className="text-cyan-500 hover:text-cyan-600 flex items-center gap-0.5 hover:underline"
                    >
                      Připojit se <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
