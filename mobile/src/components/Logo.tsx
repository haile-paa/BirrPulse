import React from 'react';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '@/theme';

/** BirrPulse mark: coin ring, rising bars and an upward trend arrow. Matches the app icon. */
export function Logo({ size = 64, bg = 'rgba(255,255,255,0.18)', fg = '#fff', accent = colors.warn }: { size?: number; bg?: string; fg?: string; accent?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.74} height={size * 0.74} viewBox="205 205 614 614">
        <Circle cx={512} cy={512} r={270} fill="none" stroke={fg} strokeWidth={46} />
        <Rect x={373} y={590} width={74} height={90} rx={16} fill={fg} />
        <Rect x={475} y={530} width={74} height={150} rx={16} fill={fg} />
        <Rect x={577} y={465} width={74} height={215} rx={16} fill={fg} />
        <Polyline points="352,500 452,420 510,462 650,338" fill="none" stroke={accent} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="623,418 650,338 568,355" fill="none" stroke={accent} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
