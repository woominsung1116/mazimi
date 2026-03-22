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

export default function TermsScreen() {
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
        <Text style={styles.headerTitle}>이용약관</Text>
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
          본 약관은 마지미(이하 "회사")가 운영하는 청년 정책·장학금·혜택 추천
          서비스 마지미(이하 "서비스")의 이용 조건 및 절차에 관한 사항을
          규정합니다. 서비스 이용 전 본 약관을 주의 깊게 읽어 주시기 바랍니다.
        </Text>

        <Section title="제1조 서비스 소개 및 목적">
          <Para>
            마지미는 대한민국 청년을 위한 정부·지자체 정책, 장학금, 생활 혜택
            정보를 수집·정규화하여 개인 프로필 기반 맞춤 추천을 제공하는
            모바일 서비스입니다.
          </Para>
          <BulletList
            items={[
              "맞춤형 정책·장학금·혜택 추천",
              "신청 서류 체크리스트 및 신청 지원 안내",
              "혜택 중복 수령 가능 여부 계산 (스택 계산기)",
              "지역 이동 시 혜택 비교",
              "마감 임박 알림 및 새 정책 등록 알림",
            ]}
          />
          <Para>
            서비스는 정보 제공 및 신청 지원을 목적으로 하며, 각 정책·장학금의
            실제 지원 기관을 대신하여 신청을 대리하거나 결과를 보증하지
            않습니다.
          </Para>
        </Section>

        <Section title="제2조 약관의 효력 및 변경">
          <Para>
            본 약관은 서비스 이용자(이하 "이용자")가 서비스에 가입하거나
            이용을 시작함으로써 효력이 발생합니다.
          </Para>
          <BulletList
            items={[
              "회사는 필요한 경우 약관을 변경할 수 있으며, 변경 시 앱 내 공지사항을 통해 7일 전 사전 고지합니다.",
              "중요한 내용 변경 시에는 30일 전에 고지합니다.",
              "변경된 약관 시행일 이후 서비스를 계속 이용하면 변경 내용에 동의한 것으로 봅니다.",
            ]}
          />
        </Section>

        <Section title="제3조 회원가입 및 탈퇴">
          <Para style={styles.subHeading}>가입</Para>
          <BulletList
            items={[
              "카카오 계정을 통한 소셜 로그인으로 가입합니다.",
              "만 14세 이상이어야 가입할 수 있습니다. 만 14세 미만 이용자는 법정대리인의 동의가 필요합니다.",
              "가입 시 본 약관 및 개인정보처리방침에 동의하는 것으로 처리됩니다.",
              "1인 1계정 원칙을 적용합니다.",
            ]}
          />
          <Para style={[styles.subHeading, { marginTop: spacing[3] }]}>탈퇴</Para>
          <BulletList
            items={[
              "설정 화면의 '회원 탈퇴' 메뉴를 통해 언제든지 탈퇴할 수 있습니다.",
              "탈퇴 즉시 개인정보는 파기되며, 단 법령에 따라 보관이 의무화된 정보는 해당 기간 동안 보관됩니다.",
              "탈퇴 후 동일 카카오 계정으로 재가입은 30일 이후 가능합니다.",
            ]}
          />
        </Section>

        <Section title="제4조 서비스 이용 규칙">
          <Para>이용자는 다음 행위를 해서는 안 됩니다.</Para>
          <BulletList
            items={[
              "타인의 개인정보를 도용하거나 허위 정보를 입력하는 행위",
              "서비스 운영을 방해하거나 비정상적인 방법으로 접근하는 행위",
              "서비스를 통해 얻은 정보를 상업적 목적으로 무단 이용하는 행위",
              "회사의 지적재산권을 침해하는 행위",
              "관계 법령을 위반하는 행위",
            ]}
          />
          <Para>
            위 금지 행위 위반 시 회사는 서비스 이용을 제한하거나 계정을
            정지·삭제할 수 있습니다.
          </Para>
        </Section>

        <Section title="제5조 마지미의 역할 및 한계">
          <Para style={styles.highlightBox}>
            마지미는 정보 제공 및 신청 지원 플랫폼입니다. 회사는 각 정책·장학금
            지원 기관을 대신하여 신청을 대리하거나, 선발·지급 결과에 관여하지
            않습니다.
          </Para>
          <BulletList
            items={[
              "정보 제공: 공공 데이터·공식 안내를 기반으로 정책 정보를 제공합니다.",
              "맞춤 추천: 이용자가 입력한 프로필 정보를 기반으로 적합도를 산정하여 추천합니다.",
              "신청 지원: 필요 서류 체크리스트, 신청 링크, 작성 팁을 안내합니다.",
              "대리 신청 제외: 실제 신청은 각 기관의 공식 채널을 통해 이용자가 직접 진행합니다.",
            ]}
          />
        </Section>

        <Section title="제6조 면책 조항">
          <Para>
            회사는 다음의 경우 책임을 지지 않습니다.
          </Para>
          <BulletList
            items={[
              "추천 결과의 정확성: 추천 알고리즘은 이용자 프로필을 기반으로 하나, 최종 지원 자격 판단은 해당 기관이 합니다. 회사는 추천 결과가 지원 자격을 보증한다고 보장하지 않습니다.",
              "정보의 최신성: 정책 내용·마감일 등은 원천 기관의 변경에 따라 실시간 반영이 어려울 수 있습니다. 신청 전 공식 홈페이지에서 최신 정보를 확인하세요.",
              "최종 신청 결과: 신청 결과(합격·불합격·지급 여부 등)는 전적으로 해당 기관의 판단에 따릅니다.",
              "이용자 귀책 사유: 이용자가 허위 정보를 입력하거나, 기기 분실·비밀번호 관리 소홀로 발생한 손해",
              "불가항력: 천재지변, 통신 장애, 제3자 서비스(카카오, FCM 등) 장애",
            ]}
          />
        </Section>

        <Section title="제7조 서류 보관 관련 이용자 책임">
          <Para>
            서류 보관함에 저장된 파일은 이용자 기기에만 저장됩니다.
          </Para>
          <BulletList
            items={[
              "회사 서버에 저장되지 않으므로 기기 분실·초기화·앱 삭제 시 복구가 불가능합니다.",
              "이용자는 중요 서류의 별도 백업에 책임을 집니다.",
              "저장된 서류의 위·변조 여부 및 진위 확인 책임은 이용자에게 있습니다.",
            ]}
          />
        </Section>

        <Section title="제8조 지적재산권">
          <BulletList
            items={[
              "마지미 서비스 내 콘텐츠(UI, 텍스트, 이미지, 아이콘, 로고, 데이터 구조 등)에 대한 저작권 및 지적재산권은 회사에 귀속됩니다.",
              "이용자는 서비스를 통해 제공된 정보를 개인적·비상업적 목적으로만 이용할 수 있습니다.",
              "회사의 사전 서면 동의 없이 서비스 콘텐츠를 복제·배포·전송·전시·판매하는 행위는 금지됩니다.",
            ]}
          />
        </Section>

        <Section title="제9조 서비스의 변경 및 중단">
          <BulletList
            items={[
              "회사는 서비스 내용을 사전 고지 후 변경하거나 종료할 수 있습니다.",
              "서비스 종료 시 앱 내 공지 및 가입 시 등록된 연락처로 30일 전 고지합니다.",
              "설비 점검·교체, 통신 장애, 불가항력 등으로 일시 중단될 수 있으며, 이 경우 빠른 시일 내 공지합니다.",
            ]}
          />
        </Section>

        <Section title="제10조 준거법 및 분쟁 해결">
          <BulletList
            items={[
              "본 약관은 대한민국 법률을 준거법으로 합니다.",
              "서비스 이용으로 발생한 분쟁은 먼저 당사자 간 협의로 해결합니다.",
              "협의가 이루어지지 않는 경우, 회사의 본사 소재지를 관할하는 법원을 1심 관할법원으로 합니다.",
            ]}
          />
        </Section>

        <Section title="제11조 문의">
          <View style={styles.contactCard}>
            <ContactRow label="서비스명" value="마지미 (Majimi)" />
            <ContactRow label="이메일" value="support@majimi.app" isLast />
          </View>
        </Section>

        <Text style={styles.footer}>
          본 이용약관은 2026년 3월 21일부터 적용됩니다.
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
  subHeading: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    lineHeight: 20,
  },
  highlightBox: {
    fontSize: typography.fontSize.sm,
    color: colors.onPrimaryFixedVariant,
    lineHeight: 20,
    backgroundColor: colors.primaryFixed,
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
