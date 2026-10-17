import { AppRegistry } from 'react-native';
import { useApp } from '@/store/useApp';
import { drainQueue } from '../../modules/birrpulse-sms';
import { loadCachedParserConfig } from '@/sms/remoteConfig';
import { formatBirr } from '@/lib/money';
import { bankByCode } from '@/sms/banks';
import { notifyLocal, pushLocal } from './notify';

/**
 * Runs without any screen whenever the Android receiver captures a bank SMS (see modules/birrpulse-sms).
 * It loads the saved data, parses the queued messages, stores the transactions and shows a notification.
 */
export async function handleCapturedSms(): Promise<void> {
  if (!useApp.persist.hasHydrated()) await useApp.persist.rehydrate();
  await loadCachedParserConfig();

  const items = drainQueue();
  if (items.length === 0) return;
  const st = useApp.getState();
  if (!st.settings.onboarded || !st.settings.smsEnabled) return; // tracking is off: drop the messages, keep nothing

  const known = new Set(st.transactions.map((t) => t.id));
  st.ingestSms(items);
  const after = useApp.getState();
  const added = after.transactions.filter((t) => !known.has(t.id) && t.source === 'sms');

  if (after.settings.notificationsOn) {
    for (const t of added.slice(0, 3)) {
      const acc = after.accounts.find((a) => a.id === t.accountId);
      const who = t.counterparty || (acc ? bankByCode(acc.bankCode).name : '');
      await notifyLocal(t.type === 'income' ? 'Money received' : 'Money spent', `${formatBirr(t.amount)}${who ? ` · ${who}` : ''}`);
    }
    await pushLocal(after.refreshAlerts());
  } else {
    after.refreshAlerts();
  }
  await new Promise((resolve) => setTimeout(resolve, 500)); // let the persisted store finish writing before the task ends
}

AppRegistry.registerHeadlessTask('BirrPulseSmsTask', () => handleCapturedSms);
