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
import { useApp } from '@/store/useApp';
import { useLang } from '@/i18n';

export default function Register() {
  useLang();
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 2 || !id.trim() || pw.length < 8) { setErr('Enter your name, an email or phone, and a password of at least 8 characters.'); return; }
    setBusy(true); setErr(null);
    try {
      await useAuth.getState().register(name.trim(), id, pw);
      useApp.getState().setSettings({ userName: name.trim().split(' ')[0] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e) {
      setErr((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Create account" subtitle="Track every birr automatically, safely.">
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" />
      <Field label="Email or phone" value={id} onChangeText={setId} autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com or 09..." />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" placeholder="At least 8 characters" />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
      <Button title="Sign in with an email code" variant="outline" icon="mail" style={{ marginTop: 12 }} onPress={() => router.push('/(auth)/otp')} />
      <View style={styles.row}>
        <Text style={styles.muted}>Already have an account? </Text>
        <PressableScale haptic={false} onPress={() => router.replace('/(auth)/login')}><Text style={styles.link}>Sign in</Text></PressableScale>
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
