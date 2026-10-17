import { Redirect, Stack } from "expo-router";
import { colors } from "@/theme";
import { useAuth } from "@/store/auth";

export default function AuthLayout() {
  const user = useAuth((s) => s.user);
  if (user) return <Redirect href='/' />; // already signed in: the tabs layout decides between setup and home
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.primary },
      }}
    />
  );
}
