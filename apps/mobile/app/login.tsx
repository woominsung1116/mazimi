import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/auth";
import { colors, typography, borderRadius, layout, shadows, spacing } from "../constants/theme";

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? "";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

// Backend handles the OAuth callback and redirects to mazimi:// deep link
const CALLBACK_URI = `${API_BASE_URL}/api/v1/auth/kakao/callback`;

const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(CALLBACK_URI)}` +
  `&response_type=code` +
  `&scope=profile_nickname,profile_image`;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoading } = useAuthStore();
  const [showWebView, setShowWebView] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Handle deep link tokens (from both Safari and WebView)
  const handleTokensFromUrl = useCallback(
    async (url: string) => {
      try {
        const params = new URLSearchParams(url.split("?")[1] ?? "");
        const token = params.get("token");
        const refreshToken = params.get("refresh_token");
        const nickname = params.get("nickname") ?? "";
        const image = params.get("image") ?? "";
        const isNew = params.get("is_new") === "1";

        if (token && refreshToken) {
          const SecureStore = await import("expo-secure-store");
          await SecureStore.setItemAsync("mazimi_auth_token", token);
          await SecureStore.setItemAsync("mazimi_refresh_token", refreshToken);
          useAuthStore.setState({
            token,
            refreshToken,
            user: {
              id: "",
              nickname: decodeURIComponent(nickname),
              image: decodeURIComponent(image) || null,
            },
            isLoading: false,
          });
          // Fetch real user ID from /auth/me in background
          try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const me = await res.json();
              if (me.id) {
                useAuthStore.setState((s) => ({
                  user: { ...s.user!, id: me.id },
                }));
              }
            }
          } catch {
            // Non-blocking — user ID will be populated on next session restore
          }
          if (isNew) {
            router.replace("/onboarding");
          } else {
            router.replace("/(tabs)");
          }
        } else {
          Alert.alert("로그인 오류", "토큰을 받지 못했습니다.");
        }
      } catch (e) {
        Alert.alert("로그인 오류", "로그인 처리 중 오류가 발생했습니다.");
      }
    },
    [router]
  );

  // Listen for deep link (Safari redirect back to app)
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.includes("/login?token=") || url.startsWith("mazimi://login")) {
        handleTokensFromUrl(url);
      }
    });
    Linking.getInitialURL().then((url) => {
      if (url && (url.includes("/login?token=") || url.startsWith("mazimi://login"))) {
        handleTokensFromUrl(url);
      }
    });
    return () => subscription.remove();
  }, [handleTokensFromUrl]);

  // WebView request interceptor — blocks navigation to deep link and handles tokens
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      if (request.url.startsWith("mazimi://login")) {
        setShowWebView(false);
        handleTokensFromUrl(request.url);
        return false;
      }
      return true;
    },
    [handleTokensFromUrl]
  );

  // Safari 방식 (기본) — 카카오톡 앱 연동 가능
  async function handleKakaoLoginSafari() {
    setAuthLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        KAKAO_AUTH_URL,
        "mazimi://login"
      );

      if (result.type === "success" && result.url) {
        await handleTokensFromUrl(result.url);
      }
    } catch (e) {
      Alert.alert("로그인 오류", "브라우저를 열 수 없습니다.");
    } finally {
      setAuthLoading(false);
    }
  }

  // WebView 방식 (앱 내부)
  function handleKakaoLoginWebView() {
    setWebViewLoading(true);
    setShowWebView(true);
  }

  function handleSkip() {
    router.replace("/(tabs)");
  }

  const busy = isLoading || authLoading;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.blob} pointerEvents="none" />

      <View style={styles.heroSection}>
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoMark}
        >
          <Text style={styles.logoLetter}>마</Text>
        </LinearGradient>

        <Text style={styles.appTitle}>마지미</Text>
        <Text style={styles.appSubtitle}>
          청년을 위한 정책·장학금{"\n"}맞춤 추천 서비스
        </Text>
      </View>

      <View style={styles.actionSection}>
        <Text style={styles.loginPrompt}>시작하려면 로그인하세요</Text>

        <Pressable
          style={({ pressed }) => [
            styles.kakaoButton,
            pressed && styles.kakaoButtonPressed,
            busy && styles.buttonDisabled,
          ]}
          onPress={handleKakaoLoginSafari}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="카카오로 시작하기"
        >
          {busy ? (
            <ActivityIndicator color="#191919" size="small" />
          ) : (
            <>
              <KakaoIcon />
              <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.webViewLoginButton,
            pressed && styles.skipButtonPressed,
          ]}
          onPress={handleKakaoLoginWebView}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="앱 내부 로그인"
        >
          <Text style={styles.webViewLoginText}>앱 내에서 로그인</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
          onPress={handleSkip}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="둘러보기"
        >
          <Text style={styles.skipButtonText}>둘러보기</Text>
        </Pressable>

        <Text style={styles.legalNote}>
          {"시작하면 "}
          <Text
            style={styles.legalNoteLink}
            onPress={() => router.push("/terms")}
            accessibilityRole="link"
            accessibilityLabel="이용약관 보기"
          >
            서비스 이용약관
          </Text>
          {" 및 "}
          <Text
            style={styles.legalNoteLink}
            onPress={() => router.push("/privacy-policy")}
            accessibilityRole="link"
            accessibilityLabel="개인정보 처리방침 보기"
          >
            개인정보 처리방침
          </Text>
          {"에\n동의하는 것으로 간주됩니다."}
        </Text>
      </View>

      {/* Kakao Login WebView Modal */}
      <Modal visible={showWebView} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.webViewContainer, { paddingTop: insets.top }]}>
          <View style={styles.webViewHeader}>
            <Pressable
              onPress={() => setShowWebView(false)}
              style={styles.webViewClose}
              accessibilityLabel="닫기"
            >
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.webViewTitle}>카카오 로그인</Text>
            <View style={{ width: 40 }} />
          </View>

          {webViewLoading && (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          <WebView
            source={{ uri: KAKAO_AUTH_URL }}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onLoadEnd={() => setWebViewLoading(false)}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          />
        </View>
      </Modal>
    </View>
  );
}

function KakaoIcon() {
  return (
    <View style={kakaoIconStyle.wrap}>
      <View style={kakaoIconStyle.bubble} />
      <View style={kakaoIconStyle.tail} />
    </View>
  );
}

const kakaoIconStyle = StyleSheet.create({
  wrap: {
    width: 22,
    height: 22,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    width: 20,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#191919",
    opacity: 0.85,
  },
  tail: {
    position: "absolute",
    bottom: 1,
    left: 6,
    width: 6,
    height: 6,
    backgroundColor: "#FEE500",
    borderRadius: 1,
    transform: [{ rotate: "10deg" }],
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: layout.pagePadding,
    justifyContent: "space-between",
  },
  blob: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.decorativeBlob,
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...shadows.primaryButton,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.onPrimary,
    letterSpacing: -0.5,
  },
  appTitle: {
    fontSize: typography.fontSize["4xl"],
    fontWeight: typography.fontWeight.black,
    color: colors.onSurface,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: 12,
  },
  appSubtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.regular,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  actionSection: {
    gap: 12,
  },
  loginPrompt: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 4,
  },
  kakaoButton: {
    height: layout.buttonHeightLg,
    backgroundColor: "#FEE500",
    borderRadius: borderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  kakaoButtonPressed: {
    backgroundColor: "#F0D800",
  },
  kakaoButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: "#191919",
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipButton: {
    height: layout.buttonHeightMd,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButtonPressed: {
    opacity: 0.6,
  },
  webViewLoginButton: {
    height: layout.buttonHeightMd,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
  },
  webViewLoginText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  skipButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  legalNote: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
  },
  legalNoteLink: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    textDecorationLine: "underline",
  },

  // WebView modal
  webViewContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  webViewClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  webViewTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  webViewLoading: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  webView: {
    flex: 1,
  },
});
