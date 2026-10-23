/**
 * Only messages from the last 5 months are ever read. Older ones almost always belong to bank accounts the person
 * no longer uses, and importing them filled the app with dead accounts. An account that is still active keeps
 * receiving new messages, so it stays inside the window.
 */
export const SMS_WINDOW_MONTHS = 5;

export function smsCutoff(now = Date.now()): number {
  const d = new Date(now);
  d.setMonth(d.getMonth() - SMS_WINDOW_MONTHS);
  return d.getTime();
}
