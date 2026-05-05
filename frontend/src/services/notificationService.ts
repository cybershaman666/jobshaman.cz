import ApiService from './apiService';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'match' | 'handshake' | 'system' | 'info';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationService = {
  async listNotifications(userId: string): Promise<Notification[]> {
    const data = await ApiService.get<any[]>(`/notifications/?user_id=${encodeURIComponent(userId)}`);
    return data.map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      content: n.content,
      type: n.type,
      link: n.link,
      isRead: n.is_read,
      createdAt: n.created_at
    }));
  },

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await ApiService.post(`/notifications/${encodeURIComponent(notificationId)}/read?user_id=${encodeURIComponent(userId)}`, {});
  },

  async markAllAsRead(userId: string): Promise<void> {
    await ApiService.post(`/notifications/read-all?user_id=${encodeURIComponent(userId)}`, {});
  }
};
