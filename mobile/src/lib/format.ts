import { tr } from '@/i18n/core';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
export const startOfMonth = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
export const startOfWeek = (t: number) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };
export const daysInMonth = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };

export function fmtDate(t: number): string {
  const d = new Date(t);
  return `${tr(MONTHS[d.getMonth()])} ${d.getDate()}, ${d.getFullYear()}`;
}
export function fmtTime(t: number): string {
  const d = new Date(t);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${tr(h >= 12 ? 'PM' : 'AM')}`;
}
export function fmtRelativeDay(t: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86400000);
  if (diff === 0) return tr('Today');
  if (diff === 1) return tr('Yesterday');
  if (diff === -1) return tr('Tomorrow');
  const d = new Date(t);
  return `${tr(MONTHS[d.getMonth()])} ${d.getDate()}`;
}
export const dayName = (t: number) => tr(DAYS[new Date(t).getDay()]);
export const monthName = (t: number) => tr(MONTHS[new Date(t).getMonth()]);

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return tr(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
}

let counter = 0;
export const uid = (): string =>
  `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
