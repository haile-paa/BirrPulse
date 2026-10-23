import React from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/Text';

interface Props {
  value: number;
  format: (v: number) => string;
  style?: StyleProp<TextStyle>;
  /** Kept for compatibility: numbers are no longer counted up. */
  duration?: number;
}

export function AnimatedNumber({ value, format, style }: Props) {
  return <Text style={style}>{format(Math.round(value))}</Text>;
}
