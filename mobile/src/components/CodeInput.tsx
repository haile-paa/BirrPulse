import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { colors } from '@/theme';

export interface CodeInputHandle { shake: () => void; clear: () => void }

/** Six boxes backed by one hidden input: easy to read, supports paste and one-time-code autofill. */
export const CodeInput = forwardRef<CodeInputHandle, { length?: number; onComplete: (code: string) => void; disabled?: boolean }>(
  function CodeInput({ length = 6, onComplete, disabled }, ref) {
    const [value, setValue] = useState('');
    const input = useRef<TextInput>(null);
    const dx = useSharedValue(0);
    const row = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
    useImperativeHandle(ref, () => ({
      shake: () => { dx.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 80 }), withTiming(-8, { duration: 70 }), withTiming(0, { duration: 50 })); },
      clear: () => { setValue(''); input.current?.focus(); },
    }));
    const change = (t: string) => {
      const digits = t.replace(/\D/g, '').slice(0, length);
      setValue(digits);
      if (digits.length === length) onComplete(digits);
    };
    return (
      <Pressable onPress={() => input.current?.focus()}>
        <Animated.View style={[styles.row, row]}>
          {Array.from({ length }).map((_, i) => {
            const active = i === Math.min(value.length, length - 1) && !disabled;
            return (
              <View key={i} style={[styles.box, active && styles.boxActive, value[i] ? styles.boxFilled : null]}>
                <Text style={styles.digit}>{value[i] ?? ''}</Text>
              </View>
            );
          })}
        </Animated.View>
        <TextInput ref={input} value={value} onChangeText={change} keyboardType="number-pad" maxLength={length} autoFocus editable={!disabled}
          textContentType="oneTimeCode" autoComplete="one-time-code" style={styles.hidden} caretHidden />
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxActive: { borderColor: colors.primary, backgroundColor: '#F6FBFA' },
  boxFilled: { borderColor: colors.primaryTint, backgroundColor: colors.primarySoft },
  digit: { fontSize: 24, fontWeight: '800', color: colors.text },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
