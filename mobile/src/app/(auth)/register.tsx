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
import { useApp } from '@/store/useApp';
import { tr, useLang } from '@/i18n';

/** Create account: username, phone number and password. Nothing else. */
export default function Register() {
  useLang();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 2) { setErr('Enter a username.'); return; }
    if (phone.replace(/\D/g, '').length < 9) { setErr('Enter your phone number, for example 0911 22 33 44.'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setBusy(true); setErr(null);
    try {
      await useAuth.getState().register(name, phone, password);
      useApp.getState().setSettings({ userName: name.trim().split(' ')[0] });
      router.replace('/');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Create account" subtitle="Track every birr automatically, safely.">
      <Field label="Username" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" />
      <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0911 22 33 44" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" />
      {err ? <Text style={styles.err}>{tr(err)}</Text> : null}
      <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
      <View style={styles.row}>
        <Text style={styles.muted}>{tr('Already have an account?')} </Text>
        <PressableScale haptic={false} onPress={() => router.replace('/(auth)/login')}><Text style={styles.link}>{tr('Log in')}</Text></PressableScale>
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
