import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
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

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[GlobalErrorBoundary] Unhandled error:", error);
    console.error("[GlobalErrorBoundary] Component stack:", info.componentStack);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={errorStyles.container}>
          <View style={errorStyles.content}>
            <Text style={errorStyles.emoji}>😥</Text>
            <Text style={errorStyles.title}>앱에 문제가 발생했어요</Text>
            <Text style={errorStyles.subtitle}>
              잠시 후 다시 시도해 주세요.
            </Text>
            <TouchableOpacity
              style={errorStyles.button}
              onPress={this.handleRestart}
              activeOpacity={0.8}
            >
              <Text style={errorStyles.buttonText}>다시 시작하기</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f5",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#191c1d",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#5CB1A7",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default function RootLayout() {
  return (
    <GlobalErrorBoundary>
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
            name="onboarding/step1"
            options={{ title: "거주 지역" }}
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
            options={{ title: "조건 시뮬레이터" }}
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
          <Stack.Screen
            name="privacy-policy"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="terms"
            options={{ headerShown: false }}
          />
        </Stack>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
