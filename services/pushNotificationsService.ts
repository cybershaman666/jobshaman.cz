import { authenticatedFetch } from './csrfService';
import { BACKEND_URL } from '../constants';

const API_URL = BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const isPushSupported = (): boolean => {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.warn('Service worker registration failed:', error);
    return null;
  }
};

export const getPushPermission = (): NotificationPermission => {
  if (typeof Notification === 'undefined') return 'default';
  return Notification.permission;
};

export const getCurrentSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
};

export const subscribeToPush = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  if (!VAPID_PUBLIC_KEY) {
    console.warn('Missing VITE_VAPID_PUBLIC_KEY');
    return null;
  }

  const registration = await registerServiceWorker();
  if (!registration) return null;

  let permission = getPushPermission();
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return null;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer
  });
};

export const registerPushSubscription = async (subscription: PushSubscription) => {
  const payload = subscription.toJSON();
  const response = await authenticatedFetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: payload, user_agent: navigator.userAgent })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Push subscription failed');
  }

  return response.json();
};

export const unsubscribeFromPush = async (): Promise<void> => {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const response = await authenticatedFetch(`${API_URL}/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Push unsubscribe failed');
  }
};
