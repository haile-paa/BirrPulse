import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';
import { formatBirr } from '@/lib/money';
import { fmtRelativeDay } from '@/lib/format';
import { categoryById } from '@/lib/categories';
import { bankByCode } from '@/sms/banks';
import { isInternal } from '@/services/insights';
import type { Account, Category, Transaction } from '@/types';
import { CategoryIcon } from './CategoryIcon';
import { PressableScale } from './PressableScale';
import { t, tr, useLang } from '@/i18n';

interface Props { tx: Transaction; categories: Category[]; accounts?: Account[]; index?: number; onPress?: () => void }

export function TxRow({ tx, categories, accounts, index = 0, onPress }: Props) {
  useLang();
  const cat = categoryById(categories, tx.categoryId);
  const internal = isInternal(tx);
  const income = tx.type === 'income';
  const acc = accounts?.find((a) => a.id === tx.accountId);
  const title = tx.counterparty || cat.name;
  return (
    <View>
      <PressableScale onPress={onPress ?? (() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } }))} scaleTo={0.98} style={styles.row}>
        {internal ? (
          <View style={styles.internal}><Ionicons name="swap-horizontal" size={20} color={colors.muted} /></View>
        ) : (
          <CategoryIcon icon={cat.icon} color={cat.color} />
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {fmtRelativeDay(tx.occurredAt)}{acc ? ` · ${bankByCode(acc.bankCode).short}` : ''}{internal ? ` · ${tr('own transfer')}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.amount, { color: internal ? colors.muted : income ? colors.income : colors.expense }]}>
            {income ? '+ ' : '- '}{formatBirr(tx.amount, { symbol: false })}
          </Text>
          {tx.fee > 0 ? <Text style={styles.fee}>{t('fee {amount}', { amount: formatBirr(tx.fee, { symbol: false }) })}</Text> : null}
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  internal: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#EEF2F1', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  fee: { fontSize: 10, color: colors.muted, marginTop: 2 },
});
