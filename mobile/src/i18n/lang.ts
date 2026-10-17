export type Lang = 'en' | 'am';

let current: Lang = 'en';
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  listeners.forEach((fn) => fn());
}

export const subscribeLang = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
