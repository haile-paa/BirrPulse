import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import { AuthShell } from '@/components/AuthShell';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { CodeInput, type CodeInputHandle } from '@/components/CodeInput';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { useAuth } from '@/store/auth';
import { alertT, t, tr, useLang } from '@/i18n';

/** Forgot password: phone number + email, a code arrives by email, then the person picks a new password. */
export default function Forgot() {
  useLang();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<CodeInputHandle>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const send = async () => {
    if (phone.replace(/\D/g, '').length < 9) { setErr('Enter your phone number, for example 0911 22 33 44.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await useAuth.getState().requestReset(phone, email);
      setWait(r.resendIn || 60);
      setStep('code');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const reset = async () => {
    if (code.length !== 6) { setErr('Enter the 6 digit code from the email.'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setBusy(true); setErr(null);
    try {
      await useAuth.getState().confirmReset(phone, email, code, password);
      alertT('Password changed', 'Log in with your new password.', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]);
    } catch (e) { setErr((e as Error).message); box.current?.shake(); box.current?.clear(); setCode(''); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Forgot password" subtitle={step === 'email' ? 'We will email you a code.' : 'Check your email.'}>
      {step === 'email' ? (
        <>
          <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0911 22 33 44" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <Text style={styles.hint}>{tr('Use the recovery email saved in your Profile. If your account has none, the code cannot be sent.')}</Text>
          {err ? <Text style={styles.err}>{tr(err)}</Text> : null}
          <Button title="Send code" onPress={send} loading={busy} />
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t('If this email is linked to your account, a 6 digit code was sent to {email}.', { email: email.trim() })}</Text>
          <CodeInput ref={box} onComplete={setCode} disabled={busy} />
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" style={{ marginTop: 16 }} />
          {err ? <Text style={styles.err}>{tr(err)}</Text> : null}
          <Button title="Change password" onPress={reset} loading={busy} />
          <View style={styles.row}>
            <PressableScale haptic={false} disabled={wait > 0 || busy} onPress={send}>
              <Text style={[styles.link, (wait > 0 || busy) && { color: colors.muted }]}>{wait > 0 ? t('Send again in {s}s', { s: wait }) : tr('Send again')}</Text>
            </PressableScale>
            <PressableScale haptic={false} onPress={() => { setStep('email'); setErr(null); }}><Text style={styles.link}>{tr('Change email')}</Text></PressableScale>
          </View>
        </>
      )}
      <View style={[styles.row, { justifyContent: 'center', marginTop: 24 }]}>
        <PressableScale haptic={false} onPress={() => router.replace('/(auth)/login')}><Text style={styles.link}>{tr('Back to log in')}</Text></PressableScale>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  err: { color: colors.expense, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  link: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
});
