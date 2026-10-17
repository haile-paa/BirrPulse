import { Platform } from 'react-native';
import type { AppNotification } from '@/types';
import { getNotifications } from './notificationsModule';

let configured = false;

export async function setupNotifications(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    if (!configured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', { name: 'BirrPulse alerts', importance: Notifications.AndroidImportance.DEFAULT });
      }
      configured = true;
    }
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export async function pushLocal(list: AppNotification[]): Promise<void> {
  for (const n of list.slice(0, 3)) await notifyLocal(n.title, n.body);
}

export async function notifyLocal(title: string, body: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    /* notifications are best-effort */
  }
}
