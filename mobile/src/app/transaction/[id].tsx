import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Screen, IconButton } from '@/components/Header';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryPicker } from '@/components/CategoryPicker';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { formatBirr } from '@/lib/money';
import { addDays, fmtDate, fmtTime, startOfDay } from '@/lib/format';
import { categoryById, categorize, pickable } from '@/lib/categories';
import { bankByCode } from '@/sms/banks';
import { useApp } from '@/store/useApp';
import { debtOutstanding } from '@/services/insights';
import { t, tr, alertT, useLang } from '@/i18n';

type Sheet = null | 'debt' | 'repay' | 'source';

function Option({ icon, title, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={styles.option}>
      <View style={styles.optionIcon}><Ionicons name={icon} size={20} color={colors.primaryDark} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        {sub ? <Text style={styles.optionSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#B5C0BE" />
    </PressableScale>
  );
}

export default function TransactionDetails() {
  useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useApp();
  const tx = s.transactions.find((x) => x.id === id && !x.deleted);
  const [pick, setPick] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(tx?.note ?? '');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [person, setPerson] = useState('');
  const [days, setDays] = useState('');
  const [who, setWho] = useState('');
  const [asSalary, setAsSalary] = useState(false);

  const recentSources = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of s.transactions) {
      const name = x.counterparty?.trim();
      if (x.deleted || !name || x.type !== tx?.type || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push(name);
      if (out.length >= 5) break;
    }
    return out;
  }, [s.transactions, tx?.type]);

  if (!tx) return <Screen title="Transaction"><EmptyState icon="alert-circle-outline" title="Transaction not found" /></Screen>;

  const cat = categoryById(s.categories, tx.categoryId);
  const acc = s.accounts.find((a) => a.id === tx.accountId);
  const income = tx.type === 'income';
  const total = income ? tx.amount : tx.amount + tx.fee;
  const linked = tx.debtId ? s.debts.find((d) => d.id === tx.debtId && !d.deleted) : undefined;
  // Money going out can repay something I borrowed; money coming in can be a person paying back what I lent.
  const openDebts = s.debts.filter((d) => !d.deleted && d.workspace === tx.workspace && d.direction === (income ? 'lent' : 'borrowed') && debtOutstanding(d) > 0);
  const employer = s.settings.userType === 'employee' ? s.settings.incomeSource : '';

  const rows: Array<[string, string]> = [
    ['Status', linked ? (income ? 'Borrowed money (debt)' : 'Lent money (debt)') : tx.transferGroup ? 'Own transfer' : income ? 'Income' : 'Expense'],
    [income ? 'From' : 'To', tx.counterparty || '—'],
    ['Time', fmtTime(tx.occurredAt)],
    ['Date', fmtDate(tx.occurredAt)],
    ['Account', acc ? `${bankByCode(acc.bankCode).short} · ${acc.nickname}` : '—'],
    ['Source', tx.source === 'sms' ? 'Bank SMS' : 'Added by hand'],
    ...(tx.ref ? [['Reference', tx.ref] as [string, string]] : []),
  ];

  const ok = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

  const flip = () => { s.flipTransaction(tx.id); ok(); };
  const openDebtSheet = () => { setPerson(tx.counterparty || ''); setDays(''); setSheet('debt'); };
  const openSourceSheet = () => { setWho(tx.counterparty || ''); setAsSalary(tx.categoryId === 'salary'); setSheet('source'); };

  const moveToDebt = () => {
    if (!person.trim()) return;
    const n = parseInt(days, 10);
    s.moveToDebt(tx.id, { person: person.trim(), dueDate: n > 0 ? addDays(startOfDay(Date.now()), n) : null });
    ok(); setSheet(null);
  };

  const saveSource = () => {
    const name = who.trim();
    const patch: Parameters<typeof s.updateTransaction>[1] = { counterparty: name };
    if (income && s.settings.userType === 'employee') {
      if (asSalary) { patch.categoryId = 'salary'; patch.incomeKind = 'salary'; }
      else if (tx.categoryId === 'salary') { patch.categoryId = categorize({ type: 'income', channel: tx.channel, counterparty: name, note: tx.note, learned: s.learned }); patch.incomeKind = 'other'; }
    }
    if (!patch.categoryId && ['other_exp', 'other_inc'].includes(tx.categoryId)) {
      patch.categoryId = categorize({ type: tx.type === 'income' ? 'income' : 'expense', channel: tx.channel, counterparty: name, note: tx.note, learned: s.learned });
    }
    s.updateTransaction(tx.id, patch, false);
    ok(); setSheet(null);
  };

  const receipt = async () => {
    try {
      const html = `<html><body style="font-family:Helvetica;padding:32px;color:#16302D"><h2 style="color:#3A8D87">BirrPulse receipt</h2>
        <p style="font-size:28px;margin:4px 0"><b>${formatBirr(total)}</b></p><p>${income ? 'Income' : 'Expense'} · ${cat.name}</p><hr/>
        ${rows.map(([k, v]) => `<p><span style="color:#8A9895">${k}:</span> ${v}</p>`).join('')}
        <hr/><p>Amount: ${formatBirr(tx.amount)}<br/>Fee: ${formatBirr(tx.fee)}<br/><b>Total: ${formatBirr(total)}</b></p>
        <p style="color:#8A9895;font-size:11px">Generated by BirrPulse from ${tx.source === 'sms' ? 'a bank SMS' : 'a manual entry'}; not an official bank receipt.</p></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Receipt' });
    } catch { alertT('Could not create the receipt'); }
  };

  return (
    <Screen title="Transaction Details" right={<IconButton name="trash" onPress={() => alertT('Delete transaction?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { s.deleteTransaction(tx.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); router.back(); } }])} />}>
      <View style={{ alignItems: 'center' }}>
        <CategoryIcon icon={cat.icon} color={cat.color} size={68} />
        <View style={[styles.tag, { backgroundColor: linked ? '#EEF2F1' : income ? '#E3F5EC' : '#FDECEC' }]}>
          <Text style={{ color: linked ? colors.muted : income ? colors.income : colors.expense, fontSize: 12, fontWeight: '700' }}>{linked ? 'Debt' : income ? 'Income' : 'Expense'}</Text>
        </View>
        <Text style={styles.amount}>{formatBirr(tx.amount)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Transaction details</Text>
        {rows.map(([k, v]) => <View key={k} style={styles.row}><Text style={styles.k}>{k}</Text><Text style={[styles.v, k === 'Status' && !linked && { color: income ? colors.income : colors.expense }]} selectable>{v}</Text></View>)}
        <View style={styles.sep} />
        <View style={styles.row}><Text style={styles.k}>{income ? 'Received' : 'Spent'}</Text><Text style={styles.v}>{formatBirr(tx.amount)}</Text></View>
        <View style={styles.row}><Text style={styles.k}>Fee & VAT</Text><Text style={styles.v}>{formatBirr(tx.fee)}</Text></View>
        <View style={styles.sep} />
        <View style={styles.row}><Text style={[styles.k, { color: colors.text, fontWeight: '700' }]}>Total</Text><Text style={[styles.v, { fontWeight: '800' }]}>{formatBirr(total)}</Text></View>
        {tx.balanceAfter != null ? <View style={styles.row}><Text style={styles.k}>Balance after (bank)</Text><Text style={styles.v}>{formatBirr(tx.balanceAfter)}</Text></View> : null}
      </View>

      <Text style={styles.section}>CHANGE THIS TRANSACTION</Text>
      <View style={{ gap: 10 }}>
        {linked ? (
          <View style={styles.linked}>
            <Ionicons name="people" size={18} color={colors.primaryDark} />
            <Text style={styles.linkedText}>{t(income ? 'Counted as money you borrowed from {name}.' : 'Counted as money you lent to {name}.', { name: linked.person })}</Text>
          </View>
        ) : null}
        {tx.debtId ? (
          <Option icon="arrow-undo" title={income ? 'This is normal income' : 'This is normal spending'} sub="Take it out of Debts" onPress={() => { s.unlinkDebt(tx.id); ok(); }} />
        ) : (
          <>
            <Option icon="swap-vertical" title={income ? 'This was money I spent' : 'This was money I received'} sub={income ? 'Move it to expenses' : 'Move it to income'} onPress={flip} />
            <Option icon="people" title={income ? 'I borrowed this money' : 'I lent this money'} sub={income ? 'Move to Debts: I owe this person' : 'Move to Debts: this person owes me'} onPress={openDebtSheet} />
            {openDebts.length > 0 ? <Option icon="return-down-back" title={income ? 'Someone paid me back' : 'I paid back a debt'} sub="Count it as a repayment" onPress={() => setSheet('repay')} /> : null}
            <Option icon={income ? 'business' : 'create'} title={income ? 'Income from a company or person' : 'Change who I paid'} sub={tx.counterparty || (income ? 'For example your company' : 'Add a name')} onPress={openSourceSheet} />
          </>
        )}
      </View>

      <View style={{ marginTop: 16, gap: 10 }}>
        {!tx.debtId ? <Button title={t('Category: {name}', { name: tr(cat.name) })} variant="soft" icon="pricetag" onPress={() => setPick(true)} /> : null}
        <Button title={tx.note ? 'Edit note' : 'Add note'} variant="soft" icon="create" onPress={() => { setNote(tx.note ?? ''); setNoteOpen(true); }} />
        {tx.note ? <Text style={styles.note}>{tx.note}</Text> : null}
        <Button title="Download receipt" variant="outline" icon="download" onPress={receipt} />
      </View>

      <BottomSheet visible={pick} onClose={() => setPick(false)} title="Change category">
        <CategoryPicker categories={pickable(s.categories).filter((c) => c.kind === tx.type)} value={tx.categoryId} onChange={(c) => { s.updateTransaction(tx.id, { categoryId: c }, true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setPick(false); }} />
        <Text style={styles.hint}>{t('BirrPulse remembers this choice for {name} payments.', { name: tx.counterparty || tr('similar') })}</Text>
      </BottomSheet>

      <BottomSheet visible={noteOpen} onClose={() => setNoteOpen(false)} title="Note">
        <Field label="Note" value={note} onChangeText={setNote} multiline placeholder="What was this for?" />
        <Button title="Save note" onPress={() => { s.updateTransaction(tx.id, { note: note.trim() || undefined }); setNoteOpen(false); }} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'debt'} onClose={() => setSheet(null)} title="Move to Debts">
        <Text style={styles.hint2}>{income ? 'This money was borrowed. It will be listed under "I owe" and will not count as income.' : 'This money was lent. It will be listed under "Owed to me" and will not count as spending.'}</Text>
        <Field label={income ? 'Borrowed from' : 'Lent to'} value={person} onChangeText={setPerson} autoCapitalize="words" placeholder="Name" style={{ marginTop: 12 }} autoFocus />
        <Field label={income ? 'Pay back in (days, optional)' : 'Should be paid back in (days, optional)'} value={days} onChangeText={(v) => setDays(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Button title="Move to Debts" onPress={moveToDebt} disabled={!person.trim()} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'repay'} onClose={() => setSheet(null)} title={income ? 'Who paid you back?' : 'Which debt did you pay?'}>
        {openDebts.map((d) => (
          <Option key={d.id} icon="person" title={d.person} sub={t('Still open: {amount}', { amount: formatBirr(debtOutstanding(d)) })}
            onPress={() => { if (s.applyToDebt(tx.id, d.id)) { ok(); setSheet(null); } else alertT('This does not fit', 'Choose a debt that is still open.'); }} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'source'} onClose={() => setSheet(null)} title={income ? 'Income from' : 'Paid to'}>
        {income && employer ? (
          <PressableScale onPress={() => { setWho(employer); setAsSalary(true); }} style={styles.chipWide}><Ionicons name="briefcase" size={16} color={colors.primaryDark} /><Text style={styles.chipText}>{t('My salary from {name}', { name: employer })}</Text></PressableScale>
        ) : null}
        <Field label={income ? 'Company or person' : 'Name'} value={who} onChangeText={setWho} autoCapitalize="words" placeholder={income ? 'e.g. ABC Company' : 'e.g. Tomoca Coffee'} autoFocus />
        {recentSources.length > 0 ? (
          <View style={styles.chips}>
            {recentSources.map((n) => <PressableScale key={n} onPress={() => setWho(n)} style={styles.chip}><Text style={styles.chipText}>{n}</Text></PressableScale>)}
          </View>
        ) : null}
        {income && s.settings.userType === 'employee' ? (
          <View style={styles.switchRow}>
            <Text style={styles.optionTitle}>This is my salary</Text>
            <Switch value={asSalary} onValueChange={setAsSalary} trackColor={{ true: colors.primary, false: '#D5DDDB' }} thumbColor="#fff" />
          </View>
        ) : null}
        <Button title="Save" onPress={saveSource} style={{ marginTop: 14 }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10, marginTop: 12 },
  amount: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 8 },
  card: { marginTop: 22, backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  k: { color: colors.muted, fontSize: 14 },
  v: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 6 },
  note: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 12, textAlign: 'center' },
  hint2: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  section: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, marginTop: 22, marginBottom: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12, backgroundColor: '#fff' },
  optionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  optionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: 14, padding: 12 },
  linkedText: { flex: 1, fontSize: 13, color: colors.primaryDeep, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  chipWide: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: 14, padding: 12, marginBottom: 14 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
});
