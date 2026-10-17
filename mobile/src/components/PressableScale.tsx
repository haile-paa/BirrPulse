import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}

export function PressableScale({ style, scaleTo = 0.96, haptic = true, onPress, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, anim]}
      onPressIn={(e) => { scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 }); onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, { damping: 14, stiffness: 260 }); onPressOut?.(e); }}
      onPress={(e) => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(e); }}>
      {children as React.ReactNode}
    </AnimatedPressable>
  );
}
