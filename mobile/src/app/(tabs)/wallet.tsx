import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen, IconButton } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { BalanceBadge } from '@/components/BalanceBadge';
import { TxRow } from '@/components/TxRow';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { CategoryIcon } from '@/components/CategoryIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { colors, shadow } from '@/theme';
import { formatBirr, toMinor } from '@/lib/money';
import { addDays, fmtDate, fmtRelativeDay, startOfDay } from '@/lib/format';
import { categoryById } from '@/lib/categories';
import { bankByCode } from '@/sms/banks';
import { useApp } from '@/store/useApp';
import { accountBalance, live, totalBalance } from '@/services/insights';
import type { Bill } from '@/types';
import { t, tr, useLang } from '@/i18n';

const TABS = ['Transactions', 'Upcoming Bills'] as const;

function Action({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={{ alignItems: 'center', gap: 8 }}>
      <View style={styles.action}><Ionicons name={icon} size={24} color={colors.primary} /></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </PressableScale>
  );
}

export default function Wallet() {
  useLang();
  const s = useApp();
  const ws = s.settings.workspace;
  const [tab, setTab] = useState<(typeof TABS)[number]>('Transactions');
  const [limit, setLimit] = useState(20);
  const [billOpen, setBillOpen] = useState<Bill | null>(null);
  const [newBill, setNewBill] = useState(false);

  const txs = useMemo(() => live(s.transactions, ws), [s.transactions, ws]);
  const bal = useMemo(() => totalBalance(s.accounts, s.transactions, ws), [s.accounts, s.transactions, ws]);
  const accounts = s.accounts.filter((a) => !a.deleted && a.workspace === ws);
  const bills = s.bills.filter((b) => !b.deleted && b.workspace === ws).sort((a, b) => a.nextDue - b.nextDue);

  return (
    <Screen title="Wallet" back={false} tabs right={<IconButton name="business" onPress={() => router.push('/accounts')} />}>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.label}>Total Balance</Text>
        <AnimatedNumber value={bal.amount} format={(v) => formatBirr(v)} style={styles.balance} />
        <View style={{ marginTop: 8 }}><BalanceBadge verified={bal.allVerified} /></View>
      </View>

      <View style={styles.actions}>
        <Action icon="add" label="Add" onPress={() => router.push('/add')} />
        <Action icon="receipt" label="Bills" onPress={() => { setTab('Upcoming Bills'); Haptics.selectionAsync().catch(() => {}); }} />
        <Action icon="people" label="Debts" onPress={() => router.push('/debts')} />
        <Action icon="flag" label="Goals" onPress={() => router.push('/goals')} />
      </View>

      {accounts.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 22, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {accounts.map((a, i) => {
            const b = accountBalance(a, s.transactions);
            const bank = bankByCode(a.bankCode);
            return (
              <View key={a.id}>
                <PressableScale onPress={() => router.push('/accounts')} style={[styles.accCard, { backgroundColor: bank.color }, shadow.soft]}>
                  <Text style={styles.accBank}>{bank.short}{a.tail ? `  ••${a.tail}` : ''}</Text>
                  <Text style={styles.accName} numberOfLines={1}>{a.nickname}</Text>
                  <Text style={styles.accBal}>{formatBirr(b.amount)}</Text>
                  <BalanceBadge verified={b.verified} at={b.at} dark />
                </PressableScale>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={{ marginTop: 22 }}><Segmented options={TABS} value={tab} onChange={setTab} /></View>

      {tab === 'Transactions' ? (
        <View key="tx" style={{ marginTop: 14 }}>
          {txs.length === 0 ? <EmptyState icon="receipt-outline" title="No transactions" text="They will appear here as bank SMS arrive or when you add them." action="Add transaction" onAction={() => router.push('/add')} /> : null}
          {txs.slice(0, limit).map((t, i) => <TxRow key={t.id} tx={t} index={i} categories={s.categories} accounts={s.accounts} />)}
          {txs.length > limit ? <Button title="Show more" variant="soft" style={{ marginTop: 10, height: 46 }} onPress={() => setLimit(limit + 20)} /> : null}
        </View>
      ) : (
        <View key="bills" style={{ marginTop: 14 }}>
          {bills.length === 0 ? <EmptyState icon="calendar-outline" title="No upcoming bills" text="Add rent, electricity or internet to get reminders before they are due." /> : null}
          {bills.map((b, i) => {
            const c = categoryById(s.categories, b.categoryId);
            const overdue = b.nextDue < startOfDay(Date.now());
            return (
              <View key={b.id}>
                <PressableScale scaleTo={0.98} onPress={() => setBillOpen(b)} style={styles.billRow}>
                  <CategoryIcon icon={b.icon} color={c.color} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.billName}>{b.name}</Text>
                    <Text style={[styles.billDue, overdue && { color: colors.expense }]}>{overdue ? t('Overdue · {day}', { day: fmtDate(b.nextDue) }) : fmtDate(b.nextDue)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.billAmt}>{formatBirr(b.amount, { symbol: false })}</Text>
                    <View style={styles.payPill}><Text style={styles.payText}>Pay</Text></View>
                  </View>
                </PressableScale>
              </View>
            );
          })}
          <Button title="Add a bill" icon="add" variant="outline" style={{ marginTop: 12 }} onPress={() => setNewBill(true)} />
        </View>
      )}

      <BillSheet bill={billOpen} onClose={() => setBillOpen(null)} />
      <NewBillSheet visible={newBill} onClose={() => setNewBill(false)} />
    </Screen>
  );
}

function BillSheet({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const s = useApp();
  const accs = s.accounts.filter((a) => !a.deleted && a.workspace === (bill?.workspace ?? 'personal'));
  const [accId, setAccId] = useState<string | null>(null);
  const chosen = accId ?? accs[0]?.id ?? null;
  return (
    <BottomSheet visible={!!bill} onClose={onClose} title={bill?.name ?? ''}>
      {bill ? (
        <>
          <View style={styles.line}><Text style={styles.k}>Amount</Text><Text style={styles.v}>{formatBirr(bill.amount)}</Text></View>
          <View style={styles.line}><Text style={styles.k}>Due</Text><Text style={styles.v}>{fmtRelativeDay(bill.nextDue)} · {fmtDate(bill.nextDue)}</Text></View>
          <View style={styles.line}><Text style={styles.k}>Repeats</Text><Text style={styles.v}>{bill.repeat}</Text></View>
          <Text style={[styles.k, { marginTop: 16, marginBottom: 8 }]}>PAY FROM</Text>
          {accs.map((a) => (
            <PressableScale key={a.id} onPress={() => setAccId(a.id)} style={[styles.payOpt, chosen === a.id && { borderColor: colors.primary, backgroundColor: '#F2FAF8' }]}>
              <Ionicons name={chosen === a.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={chosen === a.id ? colors.primary : colors.muted} />
              <Text style={styles.payOptText}>{a.nickname}</Text>
              <Text style={styles.k}>{formatBirr(accountBalance(a, s.transactions).amount, { compact: true })}</Text>
            </PressableScale>
          ))}
          {accs.length === 0 ? <Text style={styles.k}>Add an account first in Wallet → accounts.</Text> : null}
          <Button title="Mark as paid" style={{ marginTop: 16 }} disabled={!chosen} onPress={() => { s.payBill(bill.id, chosen); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onClose(); }} />
          <Button title="Delete bill" variant="danger" style={{ marginTop: 10, height: 46 }} onPress={() => { s.deleteBill(bill.id); onClose(); }} />
        </>
      ) : null}
    </BottomSheet>
  );
}

function NewBillSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('7');
  const [repeat, setRepeat] = useState<'monthly' | 'weekly' | 'once'>('monthly');
  const save = () => {
    const a = toMinor(amount);
    if (!name.trim() || a <= 0) return;
    useApp.getState().saveBill({ name: name.trim(), amount: a, nextDue: addDays(startOfDay(Date.now()), Math.max(0, parseInt(days, 10) || 0)), repeat, icon: 'receipt', categoryId: 'bills' });
    setName(''); setAmount(''); setDays('7'); onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="New bill">
      <Field label="Name" value={name} onChangeText={setName} placeholder="Electricity" />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" />
      <Field label="Due in (days)" value={days} onChangeText={setDays} keyboardType="number-pad" />
      <Segmented options={['monthly', 'weekly', 'once'] as const} value={repeat} onChange={setRepeat} />
      <Button title="Save bill" style={{ marginTop: 16 }} onPress={save} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, color: colors.muted },
  balance: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 22 },
  action: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, color: colors.primaryDark, fontWeight: '500' },
  accCard: { width: 188, borderRadius: 20, padding: 14, gap: 4 },
  accBank: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  accName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  accBal: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 6, marginBottom: 6 },
  billRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  billName: { fontSize: 15, fontWeight: '600', color: colors.text },
  billDue: { fontSize: 12, color: colors.muted, marginTop: 2 },
  billAmt: { fontSize: 14, fontWeight: '700', color: colors.text },
  payPill: { backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 5 },
  payText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  k: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  v: { fontSize: 14, color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  payOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.line, borderRadius: 16, padding: 14, marginBottom: 8 },
  payOptText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
});
