import { useSyncExternalStore } from 'react';
import { Alert, type AlertButton } from 'react-native';
import { tr } from './core';
import { getLang, subscribeLang, type Lang } from './lang';

export { tr, t } from './core';
export { getLang, setLang, type Lang } from './lang';

/** Re-renders the calling component when the language changes. */
export const useLang = (): Lang => useSyncExternalStore(subscribeLang, getLang, getLang);

/** Alert.alert with translated title, message and button labels. */
export function alertT(title: string, message?: string, buttons?: AlertButton[]): void {
  Alert.alert(tr(title), message ? tr(message) : undefined, buttons?.map((b) => ({ ...b, text: b.text ? tr(b.text) : b.text })));
}
