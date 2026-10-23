import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import { Screen } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { colors } from '@/theme';
import { fmtDate, fmtTime } from '@/lib/format';
import { useApp } from '@/store/useApp';
import { useLang } from '@/i18n';

export default function SmsReview() {
  useLang();
  const list = useApp((s) => s.unparsed);
  const dismiss = useApp((s) => s.dismissUnparsed);
  return (
    <Screen title="Messages to review">
      <Text style={styles.note}>These messages come from a supported bank but BirrPulse could not read the amount or direction. Add them by hand or dismiss them. Message formats are updated over time.</Text>
      {list.length === 0 ? <EmptyState icon="checkmark-done-circle-outline" title="Nothing to review" /> : null}
      {list.map((m, i) => (
        <View key={m.id} style={styles.card}>
          <Text style={styles.meta}>{m.address} · {fmtDate(m.date)} {fmtTime(m.date)}</Text>
          <Text style={styles.body}>{m.body}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button title="Add by hand" variant="soft" style={{ flex: 1, height: 42 }} onPress={() => { const a = /(\d[\d,]*\.?\d*)/.exec(m.body)?.[1]?.replace(/,/g, ''); router.push({ pathname: '/add', params: { amount: a ?? '', note: 'From bank SMS' } }); dismiss(m.id); }} />
            <Button title="Dismiss" variant="outline" style={{ flex: 1, height: 42 }} onPress={() => dismiss(m.id)} />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12.5, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, marginBottom: 10 },
  meta: { fontSize: 11.5, color: colors.muted, fontWeight: '600' },
  body: { fontSize: 13.5, color: colors.text, marginTop: 6, lineHeight: 19 },
});
