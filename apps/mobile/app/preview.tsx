/**
 * Preview Screen — shows recommendation results after onboarding.
 *
 * Data source: api.getRecommendPreview(ProfileInput)
 *   POST /api/v1/recommend/preview
 *   Response: RecommendationResult { total_available, estimated_monthly,
 *             estimated_semester, items: RecommendationItem[] }
 *
 * Offline: caches the last successful result in AsyncStorage and shows
 * a banner when the cached copy is being used.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
import { api, type RecommendationResult, type RecommendationItem } from "@/lib/api";
import RecommendationCard from "@/components/RecommendationCard";

const CACHE_KEY = "majimi_preview_cache_v2";

function formatWon(amount: number): string {
  if (amount >= 10_000) {
    return `${Math.floor(amount / 10_000)}만`;
  }
  return amount.toLocaleString("ko-KR");
}

// ---------------------------------------------------------------------------
// Adapter: onboarding store → ProfileInput (new snake_case API shape)
// ---------------------------------------------------------------------------

function buildProfileInput(params: {
  region: string;
  birthYear: number;
  enrollmentStatus: string;
  schoolName?: string | null;
  incomeBracket?: number | null;
}) {
  return {
    birth_year: params.birthYear,
    region_code: params.region,
    enrollment_status: params.enrollmentStatus || null,
    school_name: params.schoolName || null,
    income_bracket: params.incomeBracket ?? null,
  };
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function PreviewScreen() {
  const router = useRouter();
  const { region, age, enrollmentStatus, schoolName, incomeBracket, reset } =
    useOnboardingStore();
  const birthYear = getBirthYear(age);

  const [data, setData] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Redirect if onboarding is incomplete
  if (!region || !birthYear || !enrollmentStatus) {
    router.replace("/onboarding");
    return null;
  }

  const fetchPreview = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        setFromCache(false);

        const profile = buildProfileInput({
          region,
          birthYear,
          enrollmentStatus,
          schoolName,
          incomeBracket,
        });

        const result = await api.getRecommendPreview(profile);
        setData(result);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
      } catch (err: unknown) {
        // Network error — try cache
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          setData(JSON.parse(cached) as RecommendationResult);
          setFromCache(true);
        } else {
          setError(err instanceof Error ? err.message : "알 수 없는 오류");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [region, birthYear, enrollmentStatus, schoolName, incomeBracket]
  );

  useEffect(() => {
    // Load cache immediately, then refresh in background
    AsyncStorage.getItem(CACHE_KEY).then((cached) => {
      if (cached) {
        setData(JSON.parse(cached) as RecommendationResult);
        setFromCache(true);
        setLoading(false);
      }
      fetchPreview();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0058bc" />
        <Text style={styles.loadingText}>맞춤 추천을 분석하고 있어요...</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorTitle}>추천 결과를 불러오지 못했어요</Text>
        <Text style={styles.errorDesc}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => fetchPreview()}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text style={styles.retryBtnText}>다시 시도</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.replace("/onboarding")}
          accessibilityRole="button"
        >
          <Text style={styles.backLinkText}>조건 다시 입력하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchPreview(true)}
          tintColor="#0058bc"
        />
      }
    >
      {/* Offline/cache banner */}
      {fromCache && (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheBannerText}>
            📶 오프라인 상태 — 저장된 결과를 표시하고 있어요
          </Text>
        </View>
      )}

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryMeta}>
          {region} · {enrollmentStatus} 기준
        </Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>이번 달 신청 가능</Text>
            <Text style={styles.summaryValue}>{data.total_available}건</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.summaryLabel}>예상 월 수혜액</Text>
            <Text style={styles.summaryValue}>
              {data.estimated_monthly > 0
                ? `월 ${formatWon(data.estimated_monthly)}원`
                : "확인 필요"}
            </Text>
          </View>
        </View>
      </View>

      {/* Recommendation list */}
      <Text style={styles.sectionTitle}>맞춤 추천 혜택</Text>

      {data.items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            현재 조건에 맞는 추천 결과가 없어요
          </Text>
          <TouchableOpacity
            style={styles.emptyRetryBtn}
            onPress={() => router.replace("/onboarding")}
            accessibilityRole="button"
          >
            <Text style={styles.emptyRetryBtnText}>조건 변경하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        data.items.map((item: RecommendationItem) => (
          <RecommendationCard key={item.program_id} data={item} />
        ))
      )}

      {/* Bottom actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => {
            /* TODO: 로그인 후 저장 */
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="내 조건 저장하기"
        >
          <Text style={styles.saveBtnText}>내 조건 저장하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => {
            reset();
            router.replace("/onboarding");
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="조건 다시 입력"
        >
          <Text style={styles.resetBtnText}>조건 다시 입력</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f5",
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    backgroundColor: "#f3f4f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#717786",
    marginTop: 12,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#414755",
    textAlign: "center",
  },
  errorDesc: {
    fontSize: 13,
    color: "#c1c6d7",
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#0070eb",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#0058bc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  backLink: {
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  backLinkText: {
    fontSize: 14,
    color: "#717786",
    textDecorationLine: "underline",
  },
  cacheBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  cacheBannerText: {
    fontSize: 13,
    color: "#92400E",
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: "#0070eb",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#0058bc",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  summaryMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  summaryLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#191c1d",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 16,
    shadowColor: "#b6c7eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 1,
  },
  emptyText: {
    fontSize: 14,
    color: "#717786",
    textAlign: "center",
  },
  emptyRetryBtn: {
    backgroundColor: "#e1e3e4",
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  emptyRetryBtnText: {
    fontSize: 14,
    color: "#414755",
    fontWeight: "500",
  },
  bottomActions: {
    marginTop: 24,
    gap: 10,
  },
  saveBtn: {
    backgroundColor: "#0070eb",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 54,
    justifyContent: "center",
    shadowColor: "#0058bc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  resetBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#b6c7eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 1,
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#717786",
  },
});
