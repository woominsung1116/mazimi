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
import { useAuthRequest, makeRedirectUri } from "expo-auth-session";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../store/auth";
import { colors, typography, borderRadius, layout, shadows } from "../constants/theme";

WebBrowser.maybeCompleteAuthSession();

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? "";

const discovery = {
  authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
  tokenEndpoint: "https://kauth.kakao.com/oauth/token",
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(false);

  const redirectUri = makeRedirectUri({ scheme: "wello", path: "login" });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: KAKAO_CLIENT_ID,
      scopes: ["profile_nickname", "profile_image"],
      redirectUri,
      usePKCE: false,
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === "success") {
      const accessToken = response.params.access_token ?? response.authentication?.accessToken;
      if (accessToken) {
        handleKakaoSuccess(accessToken);
      } else {
        Alert.alert("로그인 오류", "카카오 인증에 실패했습니다. 다시 시도해 주세요.");
      }
    } else if (response?.type === "error") {
      Alert.alert("로그인 오류", "카카오 인증에 실패했습니다. 다시 시도해 주세요.");
    }
  }, [response]);

  async function handleKakaoSuccess(accessToken: string) {
    setAuthLoading(true);
    try {
      await login(accessToken);
      router.replace("/(tabs)");
    } catch {
      Alert.alert("로그인 오류", "서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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
      {/* Decorative background blob */}
      <View style={styles.blob} pointerEvents="none" />

      {/* Logo / title area */}
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

      {/* Bottom action area */}
      <View style={styles.actionSection}>
        <Text style={styles.loginPrompt}>시작하려면 로그인하세요</Text>

        {/* Kakao login button */}
        <Pressable
          style={({ pressed }) => [
            styles.kakaoButton,
            pressed && styles.kakaoButtonPressed,
            busy && styles.buttonDisabled,
          ]}
          onPress={() => promptAsync()}
          disabled={!request || busy}
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

        {/* Skip button */}
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
          시작하면 서비스 이용약관 및 개인정보 처리방침에{"\n"}동의하는 것으로 간주됩니다.
        </Text>
      </View>
    </View>
  );
}

/** Minimal inline Kakao chat-bubble icon rendered in pure RN */
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
});
