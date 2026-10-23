import React from "react";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "@/components/TabBar";
import { useAuth } from "@/store/auth";
import { useApp } from "@/store/useApp";

/**
 * The app's single gate. Not signed in (first launch, or after logging out) -> intro, then register.
 * Signed in but first-time setup not finished -> setup. It re-runs whenever the state changes,
 * so logging out lands on the intro automatically.
 */
export default function TabsLayout() {
  const user = useAuth((s) => s.user);
  const onboarded = useApp((s) => s.settings.onboarded);
  if (!user) return <Redirect href='/intro' />;
  if (!onboarded) return <Redirect href='/onboarding' />;
  return (
    <Tabs
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{ headerShown: false, animation: "none" }}
    >
      <Tabs.Screen name='index' />
      <Tabs.Screen name='stats' />
      <Tabs.Screen name='wallet' />
      <Tabs.Screen name='profile' />
    </Tabs>
  );
}
