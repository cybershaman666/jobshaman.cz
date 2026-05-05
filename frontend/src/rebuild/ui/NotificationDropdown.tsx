import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Check, X, ArrowRight, Zap, Handshake, Info, Sparkles } from 'lucide-react';
import { cn } from '../cn';
import { notificationService, Notification } from '../../services/notificationService';
import { useRebuildTheme } from './rebuildTheme';

interface NotificationDropdownProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  userId,
  isOpen,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { resolvedMode } = useRebuildTheme();
  const isDark = resolvedMode === 'dark';
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await notificationService.listNotifications(userId);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(userId, id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div 
      ref={dropdownRef}
      className={cn(
        "absolute right-0 top-full mt-2 w-[380px] overflow-hidden rounded-[28px] border shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 z-50",
        isDark 
          ? "border-white/10 bg-[#0d1117] text-white" 
          : "border-slate-200 bg-white text-slate-900"
      )}
    >
      <div className="flex items-center justify-between border-b border-white/5 p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black uppercase tracking-wider">{t('rebuild.ui.notifications.title')}</h3>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('rebuild.ui.notifications.mark_all_read')}
          </button>
        )}
      </div>

      <div className="max-h-[480px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={cn(
              "mb-4 flex h-16 w-16 items-center justify-center rounded-full",
              isDark ? "bg-white/5 text-white/20" : "bg-slate-50 text-slate-300"
            )}>
              <Bell size={24} />
            </div>
            <p className="text-sm font-medium opacity-50">{t('rebuild.ui.notifications.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notification) => (
              <div 
                key={notification.id}
                className={cn(
                  "group relative p-5 transition hover:bg-white/5",
                  !notification.isRead && (isDark ? "bg-white/[0.02]" : "bg-blue-50/30")
                )}
              >
                <div className="flex gap-4">
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    notification.type === 'match' ? "bg-teal-500/10 text-teal-500" :
                    notification.type === 'handshake' ? "bg-amber-500/10 text-amber-500" :
                    "bg-blue-500/10 text-blue-500"
                  )}>
                    {notification.type === 'match' ? <Sparkles size={18} /> :
                     notification.type === 'handshake' ? <Handshake size={18} /> :
                     <Info size={18} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[13px] font-bold leading-tight">{notification.title}</h4>
                      {!notification.isRead && (
                        <button 
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="mt-1 h-2 w-2 rounded-full bg-blue-500"
                          title={t('rebuild.ui.notifications.mark_read')}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed opacity-60 line-clamp-2">
                      {notification.content}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] font-medium opacity-30">
                        {new Date(notification.createdAt).toLocaleDateString('cs-CZ')}
                      </span>
                      {notification.link && (
                        <a 
                          href={notification.link}
                          className="flex items-center gap-1 text-[11px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {t('rebuild.ui.notifications.view_detail')}
                          <ArrowRight size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 p-4 text-center">
        <button 
          onClick={onClose}
          className="text-[11px] font-bold opacity-40 hover:opacity-100 transition-opacity"
        >
          {t('rebuild.ui.notifications.close')}
        </button>
      </div>
    </div>
  );
};
