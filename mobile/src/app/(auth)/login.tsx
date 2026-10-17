import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AuthShell } from '@/components/AuthShell';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { useAuth } from '@/store/auth';
import { useLang } from '@/i18n';

export default function Login() {
  useLang();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!id.trim() || pw.length < 6) { setErr('Enter your email or phone and a password of at least 6 characters.'); return; }
    setBusy(true); setErr(null);
    try {
      await useAuth.getState().login(id, pw);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e) {
      setErr((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to sync your money across devices.">
      <Field label="Email or phone" value={id} onChangeText={setId} autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com or 09..." />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" placeholder="Your password" />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Button title="Sign in" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
      <Button title="Sign in with an email code" variant="outline" icon="mail" style={{ marginTop: 12 }} onPress={() => router.push('/(auth)/otp')} />
      <View style={styles.row}>
        <Text style={styles.muted}>New to BirrPulse? </Text>
        <PressableScale haptic={false} onPress={() => router.replace('/(auth)/register')}><Text style={styles.link}>Create account</Text></PressableScale>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  err: { color: colors.expense, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  muted: { color: colors.muted, fontSize: 14 },
  link: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
});
