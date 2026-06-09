import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "@/src/stores/auth-store";
import {
  StaffThemeProvider,
  ThemedStatusBar,
  useStaffTheme,
} from "@/src/theme/staff-theme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, activeRestaurantId, isLoading, init } = useAuthStore();

  useEffect(() => {
    void init().finally(() => SplashScreen.hideAsync());
  }, [init]);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "login";
    const inRestaurantSelect = segments[0] === "restaurant-select";

    if (!session) {
      if (!inAuth) router.replace("/login");
      return;
    }

    if (!activeRestaurantId) {
      if (!inRestaurantSelect) router.replace("/restaurant-select");
      return;
    }

    if (inAuth) {
      router.replace("/(tabs)/tables");
      return;
    }

    // Erst-Login: nach Restaurantwahl weiter zu Tische (nicht beim Wechsel aus dem Menü).
    if (inRestaurantSelect && activeRestaurantId && !router.canGoBack()) {
      router.replace("/(tabs)/tables");
    }
  }, [session, activeRestaurantId, isLoading, segments, router]);

  return children;
}

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { colors } = useStaffTheme();
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {children}
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { colors } = useStaffTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="restaurant-select" />
      <Stack.Screen
        name="kasse"
        options={{
          headerShown: true,
          title: "Kasse",
          headerBackTitle: "Menü",
        }}
      />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="order/new"
        options={{
          headerShown: true,
          title: "Neue Bestellung",
          headerBackTitle: "Zurück",
        }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{
          headerShown: true,
          title: "Bestellung",
          headerBackTitle: "Zurück",
        }}
      />
      <Stack.Screen
        name="session/[sessionId]"
        options={{
          headerShown: true,
          title: "Tisch-Session",
          headerBackTitle: "Tische",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StaffThemeProvider>
        <ThemedRoot>
          <AuthGate>
            <ThemedStatusBar />
            <ThemedStack />
          </AuthGate>
        </ThemedRoot>
      </StaffThemeProvider>
    </QueryClientProvider>
  );
}
