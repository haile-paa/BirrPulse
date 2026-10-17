import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, IconButton } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { ProgressBar } from '@/components/ProgressBar';
import { BottomSheet } from '@/components/BottomSheet';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { formatBirr, toMinor } from '@/lib/money';
import { addDays, fmtRelativeDay, startOfDay } from '@/lib/format';
import { useApp } from '@/store/useApp';
import { debtOutstanding, debtPaid, debtSummary } from '@/services/insights';
import type { Debt } from '@/types';
import { t, tr, useLang } from '@/i18n';

export default function Debts() {
  useLang();
  const s = useApp();
  const ws = s.settings.workspace;
  const biz = ws === 'business';
  const labels = biz ? (['Customers owe me', 'I owe suppliers'] as const) : (['Owed to me', 'I owe'] as const);
  const [tab, setTab] = useState<string>(labels[0]);
  const direction: Debt['direction'] = tab === labels[0] ? 'lent' : 'borrowed';
  const [open, setOpen] = useState<Debt | null>(null);
  const [create, setCreate] = useState(false);
  const sum = useMemo(() => debtSummary(s.debts, ws), [s.debts, ws]);
  const list = s.debts.filter((d) => !d.deleted && d.workspace === ws && d.direction === direction).sort((a, b) => debtOutstanding(b) - debtOutstanding(a));

  return (
    <Screen title={biz ? 'Customer & supplier debts' : 'Debts & credit'} right={<IconButton name="add" onPress={() => setCreate(true)} />}>
      <View style={styles.pair}>
        <Animated.View entering={FadeInDown.springify()} style={[styles.tile, { backgroundColor: '#E3F5EC' }]}><Text style={styles.tileK}>{biz ? 'Customers owe you' : 'People owe you'}</Text><Text style={[styles.tileV, { color: colors.income }]}>{formatBirr(sum.owedToMe, { compact: true })}</Text></Animated.View>
        <Animated.View entering={FadeInDown.delay(80).springify()} style={[styles.tile, { backgroundColor: '#FDECEC' }]}><Text style={styles.tileK}>{biz ? 'You owe suppliers' : 'You owe'}</Text><Text style={[styles.tileV, { color: colors.expense }]}>{formatBirr(sum.iOwe, { compact: true })}</Text></Animated.View>
      </View>
      <View style={{ marginTop: 18 }}><Segmented options={labels} value={tab as (typeof labels)[number]} onChange={setTab} /></View>
      <View style={{ marginTop: 10 }}>
        {list.length === 0 ? <EmptyState icon="people-outline" title="Nothing here" text={direction === 'lent' ? 'Money you lend appears here until it is paid back.' : 'Money you borrow appears here with its due date.'} action="Add a record" onAction={() => setCreate(true)} /> : null}
        {list.map((d, i) => {
          const out = debtOutstanding(d);
          const overdue = !!d.dueDate && out > 0 && d.dueDate < startOfDay(Date.now());
          return (
            <Animated.View key={d.id} entering={FadeInDown.delay(i * 60).springify().damping(18)}>
              <PressableScale onPress={() => setOpen(d)} scaleTo={0.98} style={styles.card}>
                <View style={styles.top}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{d.person.slice(0, 1).toUpperCase()}</Text></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{d.person}</Text>
                    <Text style={[styles.sub, overdue && { color: colors.expense }]}>{d.dueDate ? t(overdue ? 'Overdue · {day}' : 'Due {day}', { day: fmtRelativeDay(d.dueDate) }) : 'No due date'}</Text>
                  </View>
                  <Text style={[styles.amt, { color: out === 0 ? colors.income : direction === 'lent' ? colors.income : colors.expense }]}>{out === 0 ? 'Settled' : formatBirr(out, { symbol: false })}</Text>
                </View>
                <ProgressBar pct={d.principal ? debtPaid(d) / d.principal : 0} warn={false} height={6} color={colors.income} />
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
      <RepaySheet debt={open} onClose={() => setOpen(null)} />
      <NewDebtSheet visible={create} onClose={() => setCreate(false)} defaultDirection={direction} biz={biz} />
    </Screen>
  );
}

function RepaySheet({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const s = useApp();
  const [amt, setAmt] = useState('');
  return (
    <BottomSheet visible={!!debt} onClose={onClose} title={debt?.person ?? ''}>
      {debt ? (
        <>
          <View style={styles.line}><Text style={styles.sub}>Original amount</Text><Text style={styles.v}>{formatBirr(debt.principal)}</Text></View>
          <View style={styles.line}><Text style={styles.sub}>Paid so far</Text><Text style={styles.v}>{formatBirr(debtPaid(debt))}</Text></View>
          <View style={styles.line}><Text style={styles.sub}>Outstanding</Text><Text style={[styles.v, { fontWeight: '800' }]}>{formatBirr(debtOutstanding(debt))}</Text></View>
          {debt.note ? <Text style={[styles.sub, { marginTop: 6 }]}>{debt.note}</Text> : null}
          <Field label={debt.direction === 'lent' ? 'Repayment received' : 'Repayment made'} value={amt} onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" style={{ marginTop: 14 }} />
          <Button title="Record repayment" onPress={() => { const a = toMinor(amt); if (a > 0) { s.addRepayment(debt.id, a); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setAmt(''); onClose(); } }} />
          <Button title="Delete record" variant="danger" style={{ marginTop: 10, height: 46 }} onPress={() => { s.deleteDebt(debt.id); onClose(); }} />
        </>
      ) : null}
    </BottomSheet>
  );
}

function NewDebtSheet({ visible, onClose, defaultDirection, biz }: { visible: boolean; onClose: () => void; defaultDirection: Debt['direction']; biz: boolean }) {
  const [person, setPerson] = useState('');
  const [amt, setAmt] = useState('');
  const [days, setDays] = useState('');
  const [note, setNote] = useState('');
  const [dir, setDir] = useState<Debt['direction'] | null>(null);
  const d = dir ?? defaultDirection;
  const opts = biz ? (['Customer owes me', 'I owe supplier'] as const) : (['I lent money', 'I borrowed'] as const);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="New debt record">
      <Segmented options={opts} value={d === 'lent' ? opts[0] : opts[1]} onChange={(v) => setDir(v === opts[0] ? 'lent' : 'borrowed')} />
      <Field label={biz ? 'Customer / supplier' : 'Person'} value={person} onChangeText={setPerson} autoCapitalize="words" placeholder="Name" style={{ marginTop: 14 }} />
      <Field label="Amount" value={amt} onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" />
      <Field label="Due in (days, optional)" value={days} onChangeText={setDays} keyboardType="number-pad" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      <Button title="Save" onPress={() => {
        const a = toMinor(amt);
        if (!person.trim() || a <= 0) return;
        const n = parseInt(days, 10);
        useApp.getState().saveDebt({ person: person.trim(), principal: a, direction: d, note: note.trim() || undefined, dueDate: n > 0 ? addDays(startOfDay(Date.now()), n) : null });
        setPerson(''); setAmt(''); setDays(''); setNote(''); setDir(null); onClose();
      }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 20, padding: 14 },
  tileK: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  tileV: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, marginTop: 10, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 16 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  amt: { fontSize: 15, fontWeight: '800' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  v: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
