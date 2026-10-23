import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Kept for compatibility. The press feedback is now a plain, instant dim (no animation). */
  scaleTo?: number;
  haptic?: boolean;
}

export function PressableScale({ style, scaleTo: _scaleTo, haptic = true, onPress, children, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { opacity: 0.8 }]}
      onPress={(e) => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(e); }}>
      {children as React.ReactNode}
    </Pressable>
  );
}
