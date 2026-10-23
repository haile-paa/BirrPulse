import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { CategoryPicker } from '@/components/CategoryPicker';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { toMinor } from '@/lib/money';
import { addDays, fmtDate, startOfDay } from '@/lib/format';
import { bankByCode } from '@/sms/banks';
import { useApp } from '@/store/useApp';
import { categorize, pickable } from '@/lib/categories';
import { useLang, tr } from '@/i18n';

export default function AddTransaction() {
  useLang();
  const params = useLocalSearchParams<{ amount?: string; note?: string }>();
  const s = useApp();
  const ws = s.settings.workspace;
  const accounts = s.accounts.filter((a) => !a.deleted && a.workspace === ws);
  const [type, setType] = useState<'Expense' | 'Income'>('Expense');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [fee, setFee] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState(params.note ?? '');
  const [cat, setCat] = useState<string | null>(null);
  const [accId, setAccId] = useState<string | null>(accounts[0]?.id ?? null);
  const [dayOffset, setDayOffset] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [debt, setDebt] = useState(false);

  const kind = type === 'Expense' ? 'expense' : 'income';
  const cats = useMemo(() => {
    const list = pickable(s.categories).filter((c) => c.kind === kind);
    const business = new Set(['stock', 'supplier', 'staff', 'business_inc']);
    return ws === 'business' ? [...list.filter((c) => business.has(c.id)), ...list.filter((c) => !business.has(c.id))] : list.filter((c) => !['stock', 'supplier', 'staff', 'business_inc'].includes(c.id));
  }, [s.categories, kind, ws]);
  const chosenCat = cat && cats.some((c) => c.id === cat) ? cat : null;

  const save = () => {
    const a = toMinor(amount);
    if (a <= 0) { setErr('Enter an amount greater than zero.'); return; }
    const acc = accId ?? accounts[0]?.id;
    if (!acc) { setErr('Add an account first (Wallet → accounts).'); return; }
    if (debt && !name.trim()) { setErr(kind === 'expense' ? 'Enter who you lent the money to.' : 'Enter who you borrowed the money from.'); return; }
    const categoryId = chosenCat ?? categorize({ type: kind, channel: 'other', counterparty: name, note, learned: s.learned });
    const when = addDays(startOfDay(Date.now()), -dayOffset) + (dayOffset === 0 ? Date.now() - startOfDay(Date.now()) : 12 * 3600000);
    const tx = s.addTransaction({
      accountId: acc, type: kind, channel: 'other', amount: a, fee: toMinor(fee), categoryId, counterparty: name.trim(), note: note.trim() || undefined,
      occurredAt: when, incomeKind: kind === 'income' ? (categoryId === 'salary' ? 'salary' : categoryId === 'business_inc' ? 'business' : categoryId === 'allowance' ? 'allowance' : 'other') : undefined,
    });
    if (debt) s.moveToDebt(tx.id, { person: name.trim() }); // a loan is listed under Debts and is not counted as spending or income
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    s.refreshAlerts();
    router.back();
  };

  return (
    <Screen title="Add Transaction" scroll>
      <Segmented options={['Expense', 'Income'] as const} value={type} onChange={(v) => { setType(v); setCat(null); setDebt(false); }} />
      <View style={styles.amountBox}>
        <Text style={styles.cur}>ETB</Text>
        <Field label="" value={amount} onChangeText={(t) => { setAmount(t.replace(/[^0-9.]/g, '')); setErr(null); }} keyboardType="decimal-pad" placeholder="0.00" autoFocus style={{ flex: 1, marginBottom: 0 }} />
      </View>
      {err ? <Text style={styles.err}>{tr(err)}</Text> : null}

      <Text style={styles.label}>CATEGORY</Text>
      <CategoryPicker categories={cats} value={chosenCat} onChange={setCat} />
      {!chosenCat ? <Text style={styles.hint}>Leave empty to categorize automatically from the name.</Text> : null}

      <Field label={kind === 'expense' ? 'Paid to' : 'Received from'} value={name} onChangeText={setName} placeholder={kind === 'expense' ? 'e.g. Tomoca Coffee' : 'e.g. ABC Trading'} style={{ marginTop: 14 }} />

      <View style={styles.debtRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.debtTitle}>{kind === 'expense' ? 'I lent this money' : 'I borrowed this money'}</Text>
          <Text style={styles.hint}>{kind === 'expense' ? 'It goes to Debts (owed to me) and is not counted as spending.' : 'It goes to Debts (I owe) and is not counted as income.'}</Text>
        </View>
        <Switch value={debt} onValueChange={setDebt} trackColor={{ true: colors.primary, false: '#D5DDDB' }} thumbColor="#fff" />
      </View>

      <Text style={styles.label}>ACCOUNT</Text>
      <View style={styles.chips}>
        {accounts.map((a) => (
          <PressableScale key={a.id} onPress={() => setAccId(a.id)} style={[styles.chip, (accId ?? accounts[0]?.id) === a.id && styles.chipOn]}>
            <Text style={[styles.chipText, (accId ?? accounts[0]?.id) === a.id && { color: '#fff' }]}>{bankByCode(a.bankCode).short} · {a.nickname}</Text>
          </PressableScale>
        ))}
        {accounts.length === 0 ? <Text style={styles.hint}>No accounts in this workspace yet. Add one under Wallet → accounts.</Text> : null}
      </View>

      <Text style={styles.label}>DATE</Text>
      <View style={styles.dateRow}>
        <PressableScale onPress={() => setDayOffset(dayOffset + 1)} style={styles.dateBtn}><Ionicons name="chevron-back" size={20} color={colors.primaryDark} /></PressableScale>
        <Text style={styles.dateText}>{dayOffset === 0 ? tr('Today') : dayOffset === 1 ? tr('Yesterday') : fmtDate(addDays(startOfDay(Date.now()), -dayOffset))}</Text>
        <PressableScale onPress={() => setDayOffset(Math.max(0, dayOffset - 1))} style={[styles.dateBtn, dayOffset === 0 && { opacity: 0.35 }]}><Ionicons name="chevron-forward" size={20} color={colors.primaryDark} /></PressableScale>
      </View>

      <Field label="Fee (optional)" value={fee} onChangeText={(t) => setFee(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" style={{ marginTop: 14 }} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Add a note" multiline />
      <Button title="Save transaction" onPress={save} style={{ marginTop: 6 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  cur: { fontSize: 22, fontWeight: '800', color: colors.primaryDark, marginTop: 4 },
  err: { color: colors.expense, fontSize: 13, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, padding: 12, borderRadius: 14, backgroundColor: colors.primarySoft },
  debtTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primaryDark },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, height: 52, paddingHorizontal: 6 },
  dateBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 15, fontWeight: '600', color: colors.text },
});
