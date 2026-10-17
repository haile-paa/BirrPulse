import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeSms { id: string; address: string; body: string; date: number }

interface Native {
  setAllowList(senders: string[], hints: string[]): void;
  drainQueue(): NativeSms[];
  listInbox(minDate: number, indexFrom: number, maxCount: number): string;
  queueSize(): number;
  isIgnoringBatteryOptimizations(): boolean;
  openBatterySettings(): void;
}

// null in Expo Go, on iOS, and in any build that does not include this module.
const native = requireOptionalNativeModule<Native>('BirrPulseSms');

export const isNativeSmsAvailable = native !== null;
export const setAllowList = (senders: string[], hints: string[]) => { try { native?.setAllowList(senders, hints); } catch { /* best effort */ } };
export const drainQueue = (): NativeSms[] => { try { return native?.drainQueue() ?? []; } catch { return []; } };
export const queueSize = (): number => { try { return native?.queueSize() ?? 0; } catch { return 0; } };
export const isIgnoringBatteryOptimizations = (): boolean => { try { return native?.isIgnoringBatteryOptimizations() ?? true; } catch { return true; } };
export const openBatterySettings = () => { try { native?.openBatterySettings(); } catch { /* ignore */ } };

/** One inbox page as a JSON string (empty array when the native module is missing). */
export const listInbox = (minDate: number, indexFrom: number, maxCount: number): string => { try { return native?.listInbox(minDate, indexFrom, maxCount) ?? '[]'; } catch { return '[]'; } };
