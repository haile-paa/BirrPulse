import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function CategoryIcon({ icon, color, size = 46 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={size * 0.48} color={color} />
    </View>
  );
}
