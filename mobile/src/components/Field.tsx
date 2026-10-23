import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { PressableScale } from "./PressableScale";
import { tr, useLang } from "@/i18n";

interface Props {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  prefix?: string;
  right?: React.ReactNode;
  error?: string | null;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  prefix,
  right,
  error,
  multiline,
  style,
  autoFocus,
}: Props) {
  useLang();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;
  const box = {
    borderColor: error ? colors.expense : focused ? colors.primary : colors.line,
    backgroundColor: focused ? "#F6FBFA" : "#FFFFFF",
  };
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={[styles.label, focused && { color: colors.primary }]}>
        {tr(label).toUpperCase()}
      </Text>
      <View
        style={[
          styles.box,
          multiline && { height: 90, alignItems: "flex-start", paddingTop: 10 },
          box,
        ]}
      >
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ? tr(placeholder) : undefined}
          placeholderTextColor='#B5C0BE'
          keyboardType={keyboardType}
          secureTextEntry={isPassword && hidden}
          autoCorrect={isPassword ? false : undefined}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoFocus={autoFocus}
          multiline={multiline}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          style={styles.input}
        />
        {isPassword ? (
          <PressableScale
            haptic={false}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
            accessibilityRole='button'
            accessibilityLabel={tr(hidden ? "Show password" : "Hide password")}
            style={{ paddingLeft: 8 }}
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={hidden ? colors.muted : colors.primary}
            />
          </PressableScale>
        ) : (
          right
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  box: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  prefix: {
    fontSize: 16,
    color: colors.primaryDark,
    fontWeight: "600",
    marginRight: 6,
  },
  error: { color: colors.expense, fontSize: 12, marginTop: 4 },
});
