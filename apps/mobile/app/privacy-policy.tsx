import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  layout,
  shadows,
} from "@/constants/theme";

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing[2] },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.onSurface}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보처리방침</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing[8]) + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.effectiveDate}>시행일: 2026년 3월 21일</Text>

        <Text style={styles.intro}>
          마지미(이하 "회사")는 이용자의 개인정보를 소중히 여기며, 「개인정보
          보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련
          법령을 준수합니다. 본 방침은 회사가 운영하는 마지미 앱(이하 "서비스")
          이용과정에서 어떤 정보를 수집하고, 어떻게 사용하며, 어떻게 보호하는지
          안내합니다.
        </Text>

        <Section title="제1조 수집하는 개인정보 항목">
          <Para>
            회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.
          </Para>
          <BulletList
            items={[
              "필수 항목: 이름(닉네임), 생년월일, 거주 지역, 학적 상태(재학·휴학·졸업 등), 취업 상태, 소득 구간",
              "카카오 로그인 시 자동 수집: 카카오 계정 식별자(고유 ID), 프로필 닉네임, 프로필 이미지(선택)",
              "서비스 이용 중 자동 생성: 서비스 이용 기록, 접속 로그, 기기 식별자(푸시 알림 토큰)",
            ]}
          />
          <Para style={styles.noteText}>
            서류 보관함에 등록하는 파일(증명서 등)은 이용자 기기 내에만 암호화
            저장되며, 회사 서버로 전송·저장되지 않습니다(MVP 단계 기준).
          </Para>
        </Section>

        <Section title="제2조 개인정보 수집 및 이용 목적">
          <BulletList
            items={[
              "맞춤형 정책·장학금·청년 혜택 추천 및 적합도 산정",
              "서류 체크리스트 생성 및 신청 지원 안내",
              "마감 임박·새 정책 등록 등 맞춤 알림 발송",
              "회원 식별 및 본인 확인",
              "서비스 이용 통계 분석 및 품질 개선",
              "관계 법령 준수 및 분쟁 처리",
            ]}
          />
        </Section>

        <Section title="제3조 개인정보 보유 및 이용 기간">
          <Para>
            회사는 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후 해당
            정보를 지체 없이 파기합니다.
          </Para>
          <BulletList
            items={[
              "회원 탈퇴 시: 즉시 파기 (단, 아래 법정 보관 기간이 적용되는 경우 제외)",
              "전자상거래법에 따른 계약·청약철회 기록: 5년",
              "전자상거래법에 따른 소비자 불만·분쟁 기록: 3년",
              "통신비밀보호법에 따른 로그인 기록: 3개월",
            ]}
          />
        </Section>

        <Section title="제4조 개인정보의 제3자 제공">
          <Para>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
            다만, 다음의 경우에는 예외로 합니다.
          </Para>
          <BulletList
            items={[
              "카카오 로그인: 카카오에서 제공하는 OAuth 2.0 방식을 사용하며, 이 과정에서 카카오의 개인정보처리방침이 적용됩니다. 회사는 카카오로부터 최소한의 식별 정보만을 수신합니다.",
              "이용자의 사전 동의가 있는 경우",
              "법령에 의거하거나 수사 기관의 적법한 요청이 있는 경우",
            ]}
          />
          <Para style={styles.noteText}>
            카카오 로그인 외 제3자 제공은 현재 단계에서 없습니다.
          </Para>
        </Section>

        <Section title="제5조 개인정보 처리 위탁">
          <Para>
            회사는 서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁할 수
            있으며, 위탁 계약 시 개인정보가 안전하게 관리될 수 있도록 필요한
            사항을 규정합니다.
          </Para>
          <BulletList
            items={[
              "인프라·서버 운영: Amazon Web Services(AWS) — 국내 리전 우선 적용",
              "푸시 알림 발송: Google Firebase Cloud Messaging(FCM)",
            ]}
          />
        </Section>

        <Section title="제6조 서류 보관 및 기기 내 데이터">
          <Para>
            이용자가 서류 보관함에 등록한 파일은 이용자 본인의 기기 내
            암호화된 저장소(expo-secure-store / AsyncStorage)에만 보관됩니다.
          </Para>
          <BulletList
            items={[
              "서버 전송 없음: 해당 파일은 회사 서버로 전송되거나 저장되지 않습니다.",
              "기기 분실·초기화 시 복구 불가: 이용자가 직접 관리에 책임을 집니다.",
              "앱 삭제 시: 기기에 저장된 모든 로컬 데이터가 함께 삭제됩니다.",
            ]}
          />
        </Section>

        <Section title="제7조 이용자 및 법정대리인의 권리">
          <Para>
            이용자(만 14세 미만의 경우 법정대리인)는 언제든지 다음 권리를
            행사할 수 있습니다.
          </Para>
          <BulletList
            items={[
              "개인정보 열람 요청",
              "개인정보 정정·수정 요청 (앱 내 프로필 편집 또는 고객 지원 이메일로 요청)",
              "개인정보 삭제 요청 (회원 탈퇴 시 자동 처리)",
              "개인정보 처리 정지 요청",
              "회원 탈퇴는 설정 화면에서 직접 처리하거나 고객 지원으로 요청할 수 있습니다.",
            ]}
          />
          <Para>
            위 요청은 고객 지원 이메일(아래 개인정보 보호책임자 연락처)로 접수하며,
            접수 후 10일 이내에 처리 결과를 통보합니다.
          </Para>
        </Section>

        <Section title="제8조 개인정보의 파기 절차 및 방법">
          <BulletList
            items={[
              "전자 파일 형태: 복원 불가능한 기술적 방법으로 영구 삭제",
              "종이 출력물: 분쇄 또는 소각 (해당하는 경우)",
              "보유 기간이 만료되거나 처리 목적이 달성된 경우 지체 없이 파기",
            ]}
          />
        </Section>

        <Section title="제9조 개인정보 안전성 확보 조치">
          <BulletList
            items={[
              "전송 구간 암호화: HTTPS/TLS 1.2 이상 적용",
              "접근 통제: 개인정보 취급 직원 최소화 및 권한 관리",
              "기기 내 저장 데이터: iOS Keychain / Android Keystore를 통한 암호화",
              "정기적 보안 점검 및 취약점 분석",
            ]}
          />
        </Section>

        <Section title="제10조 쿠키 및 유사 기술 사용">
          <Para>
            마지미 앱은 웹 쿠키를 사용하지 않습니다. 다만, 서비스 품질 향상을
            위해 기기 내 로컬 저장소(AsyncStorage)를 사용하며, 이는 언제든지
            앱 삭제를 통해 제거할 수 있습니다.
          </Para>
        </Section>

        <Section title="제11조 개인정보처리방침의 변경">
          <Para>
            본 방침은 법령 변경, 정책 변경 등에 따라 내용이 추가·삭제·수정될
            수 있습니다.
          </Para>
          <BulletList
            items={[
              "변경 시 앱 내 공지사항 또는 알림을 통해 사전 고지합니다 (최소 7일 전, 중요 변경 시 30일 전).",
              "변경된 방침의 시행일 이후에도 서비스를 계속 이용하는 경우 변경 내용에 동의한 것으로 봅니다.",
            ]}
          />
        </Section>

        <Section title="제12조 개인정보 보호책임자">
          <Para>
            회사는 개인정보 처리에 관한 업무를 총괄하고, 이용자의 개인정보
            관련 불만 처리 및 피해 구제를 담당하는 개인정보 보호책임자를 지정합니다.
          </Para>
          <View style={styles.contactCard}>
            <ContactRow label="성명" value="마지미 개인정보 보호책임자" />
            <ContactRow label="이메일" value="privacy@majimi.app" />
            <ContactRow label="처리 기간" value="문의 접수 후 10일 이내" isLast />
          </View>
          <Para>
            개인정보 침해로 인한 신고나 상담은 아래 기관에도 문의하실 수 있습니다.
          </Para>
          <BulletList
            items={[
              "개인정보 침해신고센터: privacy.kisa.or.kr / 118",
              "개인정보 분쟁조정위원회: www.kopico.go.kr / 1833-6972",
              "대검찰청 사이버수사과: www.spo.go.kr / 1301",
              "경찰청 사이버수사국: ecrm.cyber.go.kr / 182",
            ]}
          />
        </Section>

        <Text style={styles.footer}>
          본 개인정보처리방침은 2026년 3월 21일부터 적용됩니다.
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Para({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <Text style={[styles.para, style]}>{children}</Text>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ContactRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.contactRow, !isLast && styles.contactRowDivider]}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: spacing[3],
    ...shadows.header,
  },
  backButton: {
    width: layout.touchTargetMin,
    height: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -spacing[2],
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  headerRight: {
    width: layout.touchTargetMin,
  },

  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[6],
    gap: spacing[6],
  },

  effectiveDate: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    marginBottom: -spacing[2],
  },

  intro: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  section: {
    gap: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    lineHeight: 22,
  },

  para: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noteText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    lineHeight: 17,
    backgroundColor: colors.surfaceContainerHigh,
    padding: spacing[3],
    borderRadius: borderRadius.md,
  },

  bulletList: {
    gap: spacing[2],
  },
  bulletItem: {
    flexDirection: "row",
    gap: spacing[2],
  },
  bulletDot: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    lineHeight: 20,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  contactCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    paddingHorizontal: layout.cardPadding,
    ...shadows.card,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  contactRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  contactLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  contactValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
  },

  footer: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 17,
    paddingTop: spacing[2],
  },
});
