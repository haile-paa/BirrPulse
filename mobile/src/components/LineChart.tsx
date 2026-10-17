import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Svg, { ClipPath, Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import { formatBirr } from '@/lib/money';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

interface Props {
  values: number[];
  labels: string[];
  activeIndex?: number;
  height?: number;
  color?: string;
  /** Show only every n-th x label (useful for 30 day views). */
  labelEvery?: number;
}

const PAD_X = 10;
const TOP = 46;
const BOTTOM = 8;

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function LineChart({ values, labels, activeIndex = 0, height = 210, color = colors.primary, labelEvery = 1 }: Props) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState(activeIndex);
  const reveal = useSharedValue(0);
  const mx = useSharedValue(0);
  const my = useSharedValue(0);
  const chartH = height - BOTTOM;

  const { pts, line, area } = useMemo(() => {
    const max = Math.max(...values, 1) * 1.12;
    const n = values.length;
    const step = n > 1 ? (w - PAD_X * 2) / (n - 1) : 0;
    const p = values.map((v, i) => ({ x: PAD_X + i * step, y: TOP + (1 - v / max) * (chartH - TOP) }));
    const l = smoothPath(p);
    const a = p.length > 1 ? `${l} L ${p[p.length - 1].x} ${chartH} L ${p[0].x} ${chartH} Z` : '';
    return { pts: p, line: l, area: a };
  }, [values, w, chartH]);

  useEffect(() => { setSel(Math.min(activeIndex, Math.max(0, values.length - 1))); }, [activeIndex, values.length]);
  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [values, reveal]);
  useEffect(() => {
    const p = pts[sel];
    if (!p) return;
    mx.value = withSpring(p.x, { damping: 20, stiffness: 200 });
    my.value = withSpring(p.y, { damping: 20, stiffness: 200 });
  }, [sel, pts, mx, my]);

  const clipProps = useAnimatedProps(() => ({ width: reveal.value * w }));
  const circleProps = useAnimatedProps(() => ({ cx: mx.value, cy: my.value }));
  const lineProps = useAnimatedProps(() => ({ x1: mx.value, x2: mx.value, y1: my.value + 8 }));
  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: Math.min(Math.max(mx.value - 38, 0), Math.max(0, w - 76)) }, { translateY: my.value - 44 }], opacity: reveal.value }));

  const pick = (x: number) => {
    if (!pts.length) return;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i;
    if (best !== sel) { setSel(best); Haptics.selectionAsync().catch(() => {}); }
  };

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: height + 24 }}>
      {w > 0 ? (
        <>
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
              <ClipPath id="reveal"><AnimatedRect x={0} y={0} height={height} animatedProps={clipProps} /></ClipPath>
            </Defs>
            <Path d={area} fill="url(#fill)" clipPath="url(#reveal)" />
            <Path d={line} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" clipPath="url(#reveal)" />
            <AnimatedLine animatedProps={lineProps} y2={chartH} stroke={color} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.6} />
            <AnimatedCircle animatedProps={circleProps} r={6.5} fill="#fff" stroke={color} strokeWidth={3} />
          </Svg>
          <Animated.View pointerEvents="none" style={[styles.bubble, bubble]}>
            <Text style={styles.bubbleText}>{formatBirr(values[sel] ?? 0, { compact: true, symbol: false })}</Text>
          </Animated.View>
          <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onResponderGrant={(e) => pick(e.nativeEvent.locationX)} onResponderMove={(e) => pick(e.nativeEvent.locationX)} />
          <View style={styles.labels} pointerEvents="none">
            {labels.map((l, i) => (
              <Text key={`${l}-${i}`} style={[styles.label, { left: pts[i]?.x - 16, color: i === sel ? colors.primaryDark : colors.muted, fontWeight: i === sel ? '700' : '500' }]}>
                {i % labelEvery === 0 || i === sel ? l : ''}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', left: 0, top: 0, width: 76, height: 30, borderRadius: 10, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  bubbleText: { fontSize: 12, fontWeight: '700', color: colors.primaryDeep },
  labels: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 20 },
  label: { position: 'absolute', width: 32, textAlign: 'center', fontSize: 11 },
});
