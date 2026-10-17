import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { setupNotifications } from './notify';
import { getNotifications } from './notificationsModule';

const KEY = 'bp_push_token';
let registering = false;
let listener: { remove: () => void } | null = null;

async function send(token: string): Promise<void> {
  await api('/devices', { method: 'POST', body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }) });
  await SecureStore.setItemAsync(KEY, token);
}

/** Registers this phone's Firebase (FCM) token with the server so reminders reach it when the app is closed. */
export async function registerPush(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications || registering || Platform.OS !== 'android') return;
  registering = true;
  try {
    if (!(await setupNotifications())) return;
    const { data } = await Notifications.getDevicePushTokenAsync(); // fails in Expo Go and without google-services.json
    if (typeof data !== 'string' || data.length < 10) return;
    if ((await SecureStore.getItemAsync(KEY)) !== data) await send(data);
    listener ??= Notifications.addPushTokenListener((t) => { if (typeof t.data === 'string') void send(t.data).catch(() => {}); });
  } catch {
    /* push is optional: local reminders still work */
  } finally {
    registering = false;
  }
}

/** Call before signing out so the old account stops receiving this phone's notifications. */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(KEY);
    if (token) await api(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch {
    /* offline: the server drops dead tokens when FCM reports them */
  }
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
  listener?.remove();
  listener = null;
}
