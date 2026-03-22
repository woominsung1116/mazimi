import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../store/auth";
import { colors, typography, borderRadius, layout, shadows } from "../constants/theme";

WebBrowser.maybeCompleteAuthSession();

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? "";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(false);

  const redirectUri = makeRedirectUri({ scheme: "majimi", path: "login" });

  async function handleKakaoLogin() {
    setAuthLoading(true);
    try {
      // Build Kakao OAuth URL manually and open in system browser
      const authUrl =
        `https://kauth.kakao.com/oauth/authorize` +
        `?client_id=${KAKAO_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=profile_nickname,profile_image`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === "success" && result.url) {
        // Extract authorization code from redirect URL
        const url = new URL(result.url);
        const code = url.searchParams.get("code");

        if (code) {
          // Exchange code for access token
          const tokenResp = await fetch("https://kauth.kakao.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: KAKAO_CLIENT_ID,
              redirect_uri: redirectUri,
              code,
            }).toString(),
          });

          const tokenData = await tokenResp.json();

          if (tokenData.access_token) {
            await login(tokenData.access_token);
            router.replace("/(tabs)");
          } else {
            Alert.alert("로그인 오류", "카카오 토큰 발급에 실패했습니다.");
          }
        } else {
          Alert.alert("로그인 오류", "인증 코드를 받지 못했습니다.");
        }
      }
    } catch (e) {
      Alert.alert("로그인 오류", "카카오 로그인 중 오류가 발생했습니다.");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleSkip() {
    router.replace("/(tabs)");
  }

  const busy = authLoading || isLoading;

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
          onPress={handleKakaoLogin}
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
    borderRadius: borderRadius.xl,
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
});
