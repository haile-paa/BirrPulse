import React from 'react';
import { Redirect } from 'expo-router';

// DISABLED: the email-code screen. BirrPulse now signs in with a phone number and a code that arrives as a notification
// (see login.tsx and register.tsx). The old screen is kept below, commented out, so it can be switched back on.
export default function EmailCodeDisabled() {
  return <Redirect href="/(auth)/login" />;
}

/*
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AuthShell } from '@/components/AuthShell';
import { CodeInput, type CodeInputHandle } from '@/components/CodeInput';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { t, useLang } from '@/i18n';
import { colors } from '@/theme';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/useApp';
import { ApiError } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailCode() {
  useLang();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const code = useRef<CodeInputHandle>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const send = async () => {
    if (!EMAIL_RE.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await useAuth.getState().requestEmailCode(email);
      setWait(r.resendIn || 60);
      setStep('code');
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setWait(60);
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  const verify = async (value: string) => {
    setBusy(true); setErr(null);
    try {
      const { isNew } = await useAuth.getState().verifyEmailCode(email, value, name);
      if (isNew && name.trim()) useApp.getState().setSettings({ userName: name.trim().split(' ')[0] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e) {
      setErr((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      code.current?.shake();
      code.current?.clear();
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title={step === 'email' ? 'Sign in with email' : 'Check your email'} subtitle={step === 'email' ? 'No password needed. We send you a 6 digit code.' : t('We sent a 6 digit code to {email}.', { email: email.trim() })}>
      {step === 'email' ? (
        <Animated.View key="email" entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft.duration(120)}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com" autoFocus />
          <Field label="Your name (new accounts)" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Name" />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <Button title="Send code" onPress={send} loading={busy} style={{ marginTop: 6 }} />
        </Animated.View>
      ) : (
        <Animated.View key="code" entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft.duration(120)}>
          <CodeInput ref={code} onComplete={verify} disabled={busy} />
          {err ? <Text style={[styles.err, { marginTop: 12 }]}>{err}</Text> : null}
          <Button title="Verify" loading={busy} disabled style={{ marginTop: 18, opacity: busy ? 1 : 0 }} />
          <View style={styles.row}>
            <PressableScale haptic={false} disabled={wait > 0 || busy} onPress={send}>
              <Text style={[styles.link, (wait > 0 || busy) && { color: colors.muted }]}>{wait > 0 ? t('Resend code in {s}s', { s: wait }) : 'Resend code'}</Text>
            </PressableScale>
            <PressableScale haptic={false} onPress={() => { setStep('email'); setErr(null); }}><Text style={styles.link}>Change email</Text></PressableScale>
          </View>
          <Text style={styles.hint}>Check your spam folder if you do not see it. The code works once and expires in 5 minutes.</Text>
        </Animated.View>
      )}
      <PressableScale haptic={false} onPress={() => router.replace('/(auth)/login')} style={{ alignItems: 'center', marginTop: 24 }}><Text style={styles.link}>Use a password instead</Text></PressableScale>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  err: { color: colors.expense, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  link: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
*/
