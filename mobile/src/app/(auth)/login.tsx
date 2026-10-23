import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import { AuthShell } from '@/components/AuthShell';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { useAuth } from '@/store/auth';
import { tr, useLang } from '@/i18n';

/** Log in: phone number and password. */
export default function Login() {
  useLang();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (phone.replace(/\D/g, '').length < 9 || !password) { setErr('Enter your phone number and password.'); return; }
    setBusy(true); setErr(null);
    try { await useAuth.getState().login(phone, password); router.replace('/'); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in with your phone number.">
      <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0911 22 33 44" autoFocus />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
      <PressableScale haptic={false} onPress={() => router.push('/(auth)/forgot')} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
        <Text style={styles.link}>{tr('Forgot password?')}</Text>
      </PressableScale>
      {err ? <Text style={styles.err}>{tr(err)}</Text> : null}
      <Button title="Log in" onPress={submit} loading={busy} />
      <View style={styles.row}>
        <Text style={styles.muted}>{tr('New to BirrPulse?')} </Text>
        <PressableScale haptic={false} onPress={() => router.replace('/(auth)/register')}><Text style={styles.link}>{tr('Create account')}</Text></PressableScale>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  err: { color: colors.expense, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  muted: { color: colors.muted, fontSize: 14 },
  link: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
});
