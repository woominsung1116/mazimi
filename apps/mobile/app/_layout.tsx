import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

/** Restores auth session on app start. No navigation — just reads SecureStore. */
function SessionRestore() {
  const { restoreSession } = useAuthStore();
  const restored = useRef(false);

  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      restoreSession();
    }
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <SessionRestore />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#191c1d",
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#f3f4f5" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding/index"
          options={{ title: "기본 정보", headerLeft: () => null }}
        />
        <Stack.Screen
          name="onboarding/step2"
          options={{ title: "추가 정보" }}
        />
        <Stack.Screen
          name="onboarding/step3"
          options={{ title: "취업 상태" }}
        />
        <Stack.Screen
          name="preview"
          options={{ title: "맞춤 추천", headerLeft: () => null }}
        />
        <Stack.Screen
          name="calculator"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="programs/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="stack-calculator"
          options={{ title: "혜택 중복 계산기" }}
        />
        <Stack.Screen
          name="region-compare"
          options={{ title: "지역 이동 비교" }}
        />
        <Stack.Screen
          name="document-vault"
          options={{ title: "서류 보관함" }}
        />
        <Stack.Screen
          name="auto-fill"
          options={{ title: "신청 정보 준비" }}
        />
        <Stack.Screen
          name="apply-assistant"
          options={{ headerShown: false }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
