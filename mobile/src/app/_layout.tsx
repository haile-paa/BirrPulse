import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  NotoSansEthiopic_400Regular,
  NotoSansEthiopic_500Medium,
  NotoSansEthiopic_600SemiBold,
  NotoSansEthiopic_700Bold,
} from "@expo-google-fonts/noto-sans-ethiopic";
import { colors } from "@/theme";
import { useApp } from "@/store/useApp";
import { useAuth } from "@/store/auth";
import { useRuntime } from "@/services/runtime";
import { setupNotifications } from "@/services/notify";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrated = useApp((s) => s.hydrated);
  const loaded = useAuth((s) => s.loaded);
  const onboarded = useApp((s) => s.settings.onboarded);
  const [fontsLoaded, fontError] = useFonts({
    NotoSansEthiopic_400Regular,
    NotoSansEthiopic_500Medium,
    NotoSansEthiopic_600SemiBold,
    NotoSansEthiopic_700Bold,
  });
  const ready = hydrated && loaded && (fontsLoaded || !!fontError);

  useEffect(() => {
    void useAuth.getState().load();
  }, []);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  useEffect(() => {
    if (ready && onboarded) void setupNotifications();
  }, [ready, onboarded]);
  useRuntime(ready && onboarded);

  if (!ready) return null;
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.primary }}
    >
      <SafeAreaProvider>
        <StatusBar style='light' />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade_from_bottom",
            contentStyle: { backgroundColor: colors.primary },
          }}
        >
          <Stack.Screen name='intro' options={{ animation: "fade" }} />
          <Stack.Screen name='(tabs)' options={{ animation: "fade" }} />
          <Stack.Screen
            name='add'
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
