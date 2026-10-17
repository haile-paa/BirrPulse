import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, IconButton } from '@/components/Header';
import { BalanceBadge } from '@/components/BalanceBadge';
import { BottomSheet } from '@/components/BottomSheet';
import { Segmented } from '@/components/Segmented';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { formatBirr, toMinor } from '@/lib/money';
import { BANKS, bankByCode } from '@/sms/banks';
import { useApp } from '@/store/useApp';
import { accountBalance } from '@/services/insights';
import type { Account } from '@/types';
import { t, tr, useLang } from '@/i18n';

export default function Accounts() {
  useLang();
  const s = useApp();
  const accounts = s.accounts.filter((a) => !a.deleted);
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState('CASH');
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('');
  const [wsel, setWsel] = useState<'Personal' | 'Business'>(s.settings.workspace === 'business' ? 'Business' : 'Personal');

  return (
    <Screen title="Accounts" right={<IconButton name="add" onPress={() => setOpen(true)} />}>
      <Text style={styles.note}>Bank accounts appear automatically from SMS. Balances from a bank message are marked Verified. Anything you add by hand makes the balance Calculated.</Text>
      {accounts.length === 0 ? <EmptyState icon="business-outline" title="No accounts yet" action="Add an account" onAction={() => setOpen(true)} /> : null}
      {accounts.map((a: Account, i) => {
        const b = accountBalance(a, s.transactions);
        const bk = bankByCode(a.bankCode);
        return (
          <Animated.View key={a.id} entering={FadeInDown.delay(i * 70).springify().damping(18)} style={styles.card}>
            <View style={[styles.logo, { backgroundColor: bk.color }]}><Text style={styles.logoText}>{bk.short.slice(0, 4)}</Text></View>
            <View style={{ flex: 1, marginLeft: 12, gap: 4 }}>
              <Text style={styles.name}>{a.nickname}{a.tail ? `  ••${a.tail}` : ''}</Text>
              <Text style={styles.bal}>{formatBirr(b.amount)}</Text>
              <BalanceBadge verified={b.verified} at={b.at} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <PressableScale onPress={() => s.saveAccount({ ...a, workspace: a.workspace === 'personal' ? 'business' : 'personal' })} style={styles.pill}><Text style={styles.pillText}>{t('{ws} · switch', { ws: tr(a.workspace === 'personal' ? 'Personal' : 'Business') })}</Text></PressableScale>
                <PressableScale onPress={() => s.deleteAccount(a.id)} style={[styles.pill, { backgroundColor: '#FDECEC' }]}><Text style={[styles.pillText, { color: colors.expense }]}>Remove</Text></PressableScale>
              </View>
            </View>
          </Animated.View>
        );
      })}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Add account">
        <View style={styles.banks}>
          {BANKS.map((b) => (
            <PressableScale key={b.code} onPress={() => { setBank(b.code); if (!name) setName(b.name); }} style={[styles.bankChip, bank === b.code && { backgroundColor: b.color }]}><Text style={[styles.bankText, bank === b.code && { color: '#fff' }]}>{b.short}</Text></PressableScale>
          ))}
        </View>
        <Field label="Nickname" value={name} onChangeText={setName} placeholder="e.g. Salary account" style={{ marginTop: 14 }} />
        <Field label="Opening balance (optional)" value={opening} onChangeText={(t) => setOpening(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" />
        <Segmented options={['Personal', 'Business'] as const} value={wsel} onChange={setWsel} />
        <Button title="Save account" style={{ marginTop: 16 }} onPress={() => { s.saveAccount({ bankCode: bank, nickname: name.trim() || bankByCode(bank).name, calcBalance: toMinor(opening), workspace: wsel === 'Business' ? 'business' : 'personal' }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setName(''); setOpening(''); setOpen(false); }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12.5, color: colors.muted, lineHeight: 18, marginBottom: 12, backgroundColor: colors.primarySoft, padding: 12, borderRadius: 14, overflow: 'hidden' },
  card: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, marginBottom: 10 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  bal: { fontSize: 20, fontWeight: '800', color: colors.text },
  pill: { backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  banks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bankChip: { paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  bankText: { fontWeight: '700', color: colors.primaryDark, fontSize: 13 },
});
