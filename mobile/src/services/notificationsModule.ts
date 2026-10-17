import Constants, { ExecutionEnvironment } from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * Loads expo-notifications lazily. Expo Go does not ship its native parts (importing it there crashes the whole app
 * with "Cannot find native module ExpoTopicSubscriptionModule"), so it is skipped there and in any build without it.
 * Returns null when notifications are unavailable; callers must treat that as "do nothing".
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cached = null; // running inside Expo Go
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}
