import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { HeaderScene } from '@/components/Header';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { alertT, tr, useLang } from '@/i18n';
import { colors, radius, shadow } from '@/theme';
import { toMinor } from '@/lib/money';
import { useApp } from '@/store/useApp';
import { useAuth } from '@/store/auth';
import { isSmsSupported, requestSmsPermission } from '@/sms/smsService';
import { scanSms } from '@/services/runtime';
import { setupNotifications } from '@/services/notify';
import type { UserType } from '@/types';

const TYPES: Array<{ id: UserType; icon: keyof typeof Ionicons.glyphMap; title: string; text: string }> = [
  { id: 'student', icon: 'school', title: 'Student', text: 'Make allowance last' },
  { id: 'employee', icon: 'briefcase', title: 'Employee', text: 'Stretch salary to payday' },
  { id: 'business', icon: 'storefront', title: 'Business owner', text: 'Cash flow and debts' },
];

/** First-time setup, shown once after the first sign-in. The role chosen here is permanent. */
export default function Onboarding() {
  useLang();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const onboarded = useApp((s) => s.settings.onboarded);
  const [name, setName] = useState(useApp.getState().settings.userName || user?.name?.split(' ')[0] || '');
  const [type, setType] = useState<UserType | null>(null);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [payday, setPayday] = useState('');
  const [smsOk, setSmsOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return <Redirect href="/intro" />;
  if (onboarded && !busy) return <Redirect href="/(tabs)" />;

  const employee = type === 'employee';
  const student = type === 'student';

  const askSms = async () => {
    if (!isSmsSupported()) {
      alertT('SMS tracking needs an Android development build', 'In Expo Go or on iOS, you can still try BirrPulse with sample messages or add transactions manually.', [
        { text: 'Use sample messages', onPress: () => { useApp.getState().loadDemo(); setSmsOk(true); } },
        { text: 'Skip', style: 'cancel' },
      ]);
      return;
    }
    const ok = await requestSmsPermission();
    setSmsOk(ok);
    if (!ok) alertT('Permission not granted', 'You can still add transactions by hand and turn on SMS tracking later in Profile.');
  };

  const finish = async () => {
    setBusy(true);
    const st = useApp.getState();
    const pd = parseInt(payday, 10);
    const salary = toMinor(amount);
    const workspace = type === 'business' ? 'business' : 'personal';
    if (!st.accounts.some((a) => a.bankCode === 'CASH' && !a.deleted)) st.saveAccount({ bankCode: 'CASH', nickname: 'Cash', workspace });
    void setupNotifications();
    st.setSettings({
      onboarded: true, userName: name.trim() || st.settings.userName, smsEnabled: smsOk && isSmsSupported(),
    });
    st.setProfile({
      userType: type, incomeSource: source.trim(), incomeAmount: salary > 0 ? salary : null,
      payday: pd >= 1 && pd <= 31 ? pd : st.settings.payday,
    });
    if (smsOk && isSmsSupported()) { try { await scanSms(true); } catch { /* shown as empty state */ } }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/(tabs)');
  };

  const next = () => {
    if (!type) return;
    const pd = parseInt(payday, 10);
    if (employee && (!source.trim() || toMinor(amount) <= 0 || !(pd >= 1 && pd <= 31))) {
      setErr('Enter your company, your monthly salary and the day of the month you get paid.');
      return;
    }
    setErr(null);
    const label = type === 'business' ? 'Business owner' : type === 'employee' ? 'Employee' : 'Student';
    alertT(`Continue as ${label}?`, 'Your role cannot be changed later. Every screen of the app is made for it.', [
      { text: 'Back', style: 'cancel' },
      { text: 'Continue', onPress: () => { void finish(); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="light" />
      <HeaderScene style={{ paddingTop: insets.top + 24, paddingBottom: 56, paddingHorizontal: 24 }}>
        <Text style={[styles.title, { marginTop: 4 }]}>Set up BirrPulse</Text>
        <Text style={styles.text}>Two quick steps so the app fits you.</Text>
      </HeaderScene>
      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Field label="Your first name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Name" />
        <Text style={styles.label}>I AM A...</Text>
        {TYPES.map((t) => (
          <PressableScale key={t.id} onPress={() => { setType(t.id); setErr(null); }} style={[styles.typeCard, type === t.id && styles.typeOn]}>
            <View style={[styles.typeIcon, type === t.id && { backgroundColor: colors.primary }]}><Ionicons name={t.icon} size={22} color={type === t.id ? '#fff' : colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.typeTitle}>{t.title}</Text>
              <Text style={styles.typeText}>{t.text}</Text>
            </View>
            {type === t.id ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : null}
          </PressableScale>
        ))}
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={14} color={colors.muted} />
          <Text style={styles.lockText}>You choose this once. It cannot be changed later.</Text>
        </View>

        {employee ? (
          <View style={{ marginTop: 14 }}>
            <Field label="Company you work for" value={source} onChangeText={setSource} autoCapitalize="words" placeholder="e.g. ABC Trading" />
            <Field label="Monthly salary" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" />
            <Field label="Payday (day of the month)" value={payday} onChangeText={(t) => setPayday(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="e.g. 25" />
          </View>
        ) : null}
        {student ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.optional}>Optional: your monthly allowance, so the home screen can count the days left.</Text>
            <Field label="Who sends it" value={source} onChangeText={setSource} autoCapitalize="words" placeholder="e.g. Family" />
            <Field label="Monthly allowance" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" />
            <Field label="Day it arrives" value={payday} onChangeText={(t) => setPayday(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="e.g. 1" />
          </View>
        ) : null}
        {err ? <Text style={styles.err}>{tr(err)}</Text> : null}

        <View style={styles.smsBox}>
          <Ionicons name={smsOk ? 'shield-checkmark' : 'chatbubble-ellipses'} size={26} color={smsOk ? colors.income : colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.typeTitle}>{smsOk ? 'SMS tracking is on' : 'Automatic SMS tracking'}</Text>
            <Text style={styles.typeText}>Only messages from supported banks, from the last 5 months, are read on your phone. Personal messages are ignored. You can decline and add transactions by hand.</Text>
          </View>
        </View>
        {!smsOk ? <Button title="Allow SMS access" icon="chatbubbles" variant="outline" onPress={askSms} style={{ marginTop: 12 }} /> : null}
        <Button title="Get started" onPress={next} loading={busy} disabled={!type} style={{ marginTop: 14 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  text: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, marginTop: 10 },
  sheet: { flex: 1, marginTop: -radius.xl, backgroundColor: '#fff', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  label: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  typeCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, marginBottom: 10, backgroundColor: '#fff' },
  typeOn: { borderColor: colors.primary, backgroundColor: '#F6FBFA', ...shadow.soft },
  typeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  typeTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  typeText: { fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 18 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  lockText: { fontSize: 12, color: colors.muted },
  optional: { fontSize: 12.5, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  err: { color: colors.expense, fontSize: 13, marginTop: 4, lineHeight: 18 },
  smsBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 18, padding: 14, marginTop: 14 },
});
