import React, { useEffect, useRef, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/Text';

interface Props {
  value: number;
  format: (v: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

/** Counts smoothly from the previous value to the new one (ease-out cubic). */
export function AnimatedNumber({ value, format, style, duration = 900 }: Props) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const f = from.current;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = f + (value - f) * eased;
      from.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style}>{format(Math.round(display))}</Text>;
}
