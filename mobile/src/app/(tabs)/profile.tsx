import React, { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScrollView } from 'react-native';
import { HeaderScene } from '@/components/Header';
import { PressableScale } from '@/components/PressableScale';
import { Segmented } from '@/components/Segmented';
import { BottomSheet } from '@/components/BottomSheet';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { colors, radius } from '@/theme';
import { fmtDate } from '@/lib/format';
import { useApp } from '@/store/useApp';
import { useAuth } from '@/store/auth';
import { isSmsSupported, requestSmsPermission } from '@/sms/smsService';
import { scanSms } from '@/services/runtime';
import { syncNow } from '@/services/sync';
import { backupBeforeSignOut } from '@/services/session';
import { isNativeSmsAvailable, isIgnoringBatteryOptimizations, openBatterySettings } from '../../../modules/birrpulse-sms';
import { t, alertT, useLang } from '@/i18n';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; badge?: number; right?: React.ReactNode; danger?: boolean; sub?: string };

export default function Profile() {
  useLang();
  const insets = useSafeAreaInsets();
  const s = useApp();
  const auth = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [paydayOpen, setPaydayOpen] = useState(false);
  const [payday, setPayday] = useState(s.settings.payday ? String(s.settings.payday) : '');
  const name = auth.user?.name ?? (s.settings.userName || 'BirrPulse');
  const unread = s.notifications.filter((n) => !n.read).length;

  const toggleSms = async (on: boolean) => {
    if (!on) { s.setSettings({ smsEnabled: false }); return; }
    if (!isSmsSupported()) { alertT('Not available here', 'Reading SMS needs the Android development build of BirrPulse. You can try sample messages from the home screen.'); return; }
    if (await requestSmsPermission()) { s.setSettings({ smsEnabled: true }); setBusy('scan'); try { await scanSms(true); } finally { setBusy(null); } }
    else alertT('Permission needed', 'Allow SMS access in system settings to track bank messages automatically.');
  };

  const finishLogout = async () => {
    await auth.logout();          // signed out: the tabs layout now redirects to the intro
    useApp.getState().resetAll(); // remove this phone's copy of the data (it stays in the account)
    setBusy(null);
  };

  const confirmLogout = () => alertT(
    'Log out?',
    'Your data is backed up to your account and comes back when you sign in again. This phone\'s copy will be removed.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          setBusy('logout');
          if (await backupBeforeSignOut()) { await finishLogout(); return; }
          setBusy(null);
          alertT('Could not back up', 'You seem to be offline. Logging out now loses changes that are not backed up yet.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out anyway', style: 'destructive', onPress: () => { setBusy('logout'); void finishLogout(); } },
          ]);
        },
      },
    ],
  );

  const sections: Array<{ title: string; rows: Row[] }> = [
    { title: 'Money', rows: [
      { icon: 'business', label: 'Accounts', onPress: () => router.push('/accounts') },
      { icon: 'pie-chart', label: 'Budgets', onPress: () => router.push('/budgets') },
      { icon: 'flag', label: 'Savings goals', onPress: () => router.push('/goals') },
      { icon: 'people', label: s.settings.workspace === 'business' ? 'Customer & supplier debts' : 'Debts & credit', onPress: () => router.push('/debts') },
      { icon: 'document-text', label: 'Reports', onPress: () => router.push('/reports') },
    ] },
    { title: 'Automation', rows: [
      { icon: 'chatbubbles', label: 'Automatic SMS tracking', sub: isSmsSupported() ? 'Reads supported bank messages on this phone' : 'Needs the Android development build', right: <Switch value={s.settings.smsEnabled} onValueChange={toggleSms} trackColor={{ true: colors.primary, false: '#D5DDDB' }} thumbColor="#fff" /> },
      { icon: 'refresh', label: busy === 'scan' ? 'Scanning...' : 'Scan messages now', onPress: async () => { setBusy('scan'); try { const r = await scanSms(true); alertT('Scan finished', r ? t('{added} new transaction(s), {unparsed} need review.', { added: r.added, unparsed: r.unparsed }) : 'SMS tracking is off or unavailable.'); } finally { setBusy(null); } } },
      ...(isNativeSmsAvailable ? [{ icon: 'flash' as const, label: 'Background capture', sub: isIgnoringBatteryOptimizations() ? 'Bank messages are captured the moment they arrive' : 'Tap to stop Android from pausing BirrPulse', onPress: () => openBatterySettings() }] : []),
      { icon: 'alert-circle', label: 'Messages to review', badge: s.unparsed.length, onPress: () => router.push('/sms-review') },
      { icon: 'notifications', label: 'Notifications', badge: unread, onPress: () => router.push('/notifications') },
      { icon: 'notifications-circle', label: 'Smart alerts', right: <Switch value={s.settings.notificationsOn} onValueChange={(v) => s.setSettings({ notificationsOn: v })} trackColor={{ true: colors.primary, false: '#D5DDDB' }} thumbColor="#fff" /> },
      { icon: 'calendar', label: 'Payday', sub: s.settings.payday ? t('Day {n} of the month', { n: s.settings.payday }) : 'Used for safe-to-spend', onPress: () => setPaydayOpen(true) },
    ] },
    { title: 'Account', rows: [
      { icon: 'cloud-done', label: busy === 'sync' ? 'Syncing...' : 'Sync now', sub: s.settings.lastSync ? t('Last sync {date}', { date: fmtDate(s.settings.lastSync) }) : 'Not synced yet', onPress: async () => { setBusy('sync'); try { const r = await syncNow(); alertT('Synced', r ? t('Sent {pushed}, received {pulled}.', { pushed: r.pushed, pulled: r.pulled }) : 'A sync is already running.'); } catch (e) { alertT('Sync failed', (e as Error).message); } finally { setBusy(null); } } },
      { icon: 'flask', label: 'Load sample data', sub: 'Demo transactions, budgets and bills', onPress: () => alertT('Load sample data?', 'Adds demo transactions and bills so you can explore the app.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Load', onPress: () => s.loadDemo() }]) },
      { icon: 'log-out', label: busy === 'logout' ? 'Logging out...' : 'Log out', danger: true, onPress: confirmLogout },
      { icon: 'trash', label: 'Erase all local data', danger: true, onPress: () => alertT('Erase all data?', 'This removes every transaction, budget and goal on this phone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Erase', style: 'destructive', onPress: () => { s.resetAll(); router.replace('/'); } }]) },
    ] },
  ];

  let n = 0;
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <StatusBar style="light" />
      <HeaderScene style={{ paddingTop: insets.top + 16, paddingBottom: 70, alignItems: 'center' }}>
        <Text style={styles.title}>Profile</Text>
      </HeaderScene>
      <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.springify().damping(13)} style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></Animated.View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.handle}>{auth.user?.email ?? auth.user?.phone ?? ''}</Text>
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Text style={styles.wsLabel}>WORKSPACE</Text>
          <Segmented options={['Personal', 'Business'] as const} value={s.settings.workspace === 'business' ? 'Business' : 'Personal'} onChange={(v) => s.setSettings({ workspace: v === 'Business' ? 'business' : 'personal' })} />
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <Text style={styles.wsLabel}>LANGUAGE</Text>
          <Segmented options={['English', 'አማርኛ'] as const} value={s.settings.language === 'am' ? 'አማርኛ' : 'English'} onChange={(v) => s.setSettings({ language: v === 'አማርኛ' ? 'am' : 'en' })} />
        </View>
        {sections.map((sec) => (
          <View key={sec.title} style={{ paddingHorizontal: 20, marginTop: 18 }}>
            <Text style={styles.wsLabel}>{sec.title.toUpperCase()}</Text>
            {sec.rows.map((r) => (
              <Animated.View key={r.label} entering={FadeInDown.delay(n++ * 35).springify().damping(18)}>
                <PressableScale onPress={r.onPress} disabled={!r.onPress} haptic={!!r.onPress} scaleTo={0.98} style={styles.row}>
                  <View style={[styles.rowIcon, r.danger && { backgroundColor: '#FDECEC' }]}><Ionicons name={r.icon} size={19} color={r.danger ? colors.expense : colors.primaryDark} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, r.danger && { color: colors.expense }]}>{r.label}</Text>
                    {r.sub ? <Text style={styles.rowSub}>{r.sub}</Text> : null}
                  </View>
                  {r.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{r.badge}</Text></View> : null}
                  {r.right ?? (r.onPress && !r.danger ? <Ionicons name="chevron-forward" size={18} color="#B5C0BE" /> : null)}
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ))}
        <Text style={styles.ver}>BirrPulse 1.0.0</Text>
      </ScrollView>
      <BottomSheet visible={paydayOpen} onClose={() => setPaydayOpen(false)} title="Payday">
        <Field label="Day of month (1-31)" value={payday} onChangeText={setPayday} keyboardType="number-pad" placeholder="e.g. 25" />
        <Button title="Save" onPress={() => { const d = parseInt(payday, 10); s.setSettings({ payday: d >= 1 && d <= 31 ? d : null }); setPaydayOpen(false); }} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  sheet: { flex: 1, marginTop: -radius.xl, backgroundColor: '#fff', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  avatar: { alignSelf: 'center', marginTop: -46, width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primaryDark, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 10 },
  handle: { textAlign: 'center', color: colors.primary, fontSize: 13, marginTop: 2 },
  wsLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.expense, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  ver: { textAlign: 'center', color: '#B5C0BE', fontSize: 12, marginTop: 24 },
});
