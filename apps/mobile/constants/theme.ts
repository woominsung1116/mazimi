/**
 * 마지미 Design Token System — "Moss Stone" / Editorial Financial Guidance
 *
 * Based on the Stitch design system (Material Design 3 + custom editorial layer).
 * Single source of truth for the mobile app's visual design.
 *
 * Theme concept: 마지미 마스코트(돌멩이)에서 영감을 받은 올리브 그린 + 따뜻한 스톤 팔레트.
 * Primary는 이끼 낀 돌의 올리브 그린, Surface는 따뜻한 자갈/돌 톤.
 *
 * Design principles:
 *  - No-Line Rule: 1px solid borders for sectioning are PROHIBITED. Use
 *    background color shifts and tonal transitions instead.
 *  - Surface hierarchy through layering, not borders.
 *  - Tinted shadows using secondary_fixed_dim (#C9BFB3) instead of pure black.
 *  - Glass effect for headers (80% opacity + blur).
 *  - Gradient accents for primary CTAs.
 */

import { Platform, type ViewStyle } from "react-native";

// ---------------------------------------------------------------------------
// Colors — Material Design 3 tokens (Moss Stone palette)
// ---------------------------------------------------------------------------

export const colors = {
  // Primary — 틸/민트 그린 (차분한 자연)
  primary: "#5CB1A7",
  primaryContainer: "#4DA89E",
  primaryFixed: "#D0EDE9",
  primaryFixedDim: "#A8D4CD",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#fefcff",
  onPrimaryFixed: "#0D2B26",
  onPrimaryFixedVariant: "#3D5228",

  // Secondary — 따뜻한 어스 브라운
  secondary: "#6B6358",
  secondaryContainer: "#E8DFD5",
  secondaryFixed: "#EDE4DA",
  secondaryFixedDim: "#C9BFB3", // tinted shadow color (warm stone)
  onSecondary: "#ffffff",
  onSecondaryContainer: "#5C5449",

  // Tertiary — 세이지/머드
  tertiary: "#5A6355",
  tertiaryContainer: "#6E7868",
  tertiaryFixed: "#D5DDD0",
  tertiaryFixedDim: "#BCC5B6",

  // Surface — 따뜻한 스톤/자갈 톤 (밝기 UP)
  surface: "#F3F0EB",
  surfaceBright: "#F3F0EB",
  surfaceDim: "#DCD9D4",
  surfaceContainer: "#EAE7E2",
  surfaceContainerLow: "#EFECE7",
  surfaceContainerHigh: "#E2DFDA",
  surfaceContainerHighest: "#DCDAD5",
  surfaceContainerLowest: "#FAF8F4",    // 가장 밝은 스톤 (기존보다 밝게)
  surfaceVariant: "#DCDAD5",
  surfaceTint: "#5CB1A7",

  // On-surface — 스톤 배경 위 가시성 강화
  onSurface: "#141310",
  onSurfaceVariant: "#3A3832",
  onBackground: "#141310",
  inverseSurface: "#323029",
  inverseOnSurface: "#F2EFEA",
  inversePrimary: "#A8BA8E",

  // Outline — 대비 강화
  outline: "#635F58",
  outlineVariant: "#B5B0A9",

  // Error
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  onError: "#ffffff",
  onErrorContainer: "#93000a",

  // Background
  background: "#F3F0EB",

  // Semantic aliases (for backward compat and convenience)
  card: "#FAF8F4",                        // = surfaceContainerLowest (warm stone)
  textPrimary: "#141310",                 // = onSurface (강화)
  textSecondary: "#3A3832",               // = onSurfaceVariant (강화)
  textMuted: "#635F58",                   // = outline (강화)
  textDisabled: "#C9BFB3",               // = secondaryFixedDim
  textInverse: "#ffffff",

  // Tab bar
  tabBarBackground: "rgba(250, 248, 244, 0.88)",
  tabBarActive: "#5CB1A7",               // = primary (teal)
  tabBarActiveBackground: "#D0EDE9",     // ≈ teal tinted
  tabBarInactive: "#635F58",             // = outline (강화)

  // Overlay / scrim
  overlay: "rgba(28, 27, 24, 0.4)",
  overlayLight: "rgba(28, 27, 24, 0.06)",

  // Decorative background blobs (large blurred circles)
  decorativeBlob: "rgba(92, 177, 167, 0.05)",
} as const;

export type ColorToken = keyof typeof colors;

// ---------------------------------------------------------------------------
// Typography — Plus Jakarta Sans (headlines) / Manrope (body)
// ---------------------------------------------------------------------------

export const typography = {
  // Font families
  fontFamily: {
    heading: "PlusJakartaSans",
    body: "Manrope",
  },

  // Font sizes (px equiv)
  fontSize: {
    xs: 11,   // caption small / tab label
    sm: 13,   // body small, label
    base: 15, // body default
    md: 16,   // body medium
    lg: 18,   // section title / sub-heading
    xl: 20,   // page title
    "2xl": 24,
    "3xl": 30,
    "4xl": 36, // hero
    "5xl": 48,
  },

  // Font weights
  fontWeight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
    black: "900" as const,
  },

  // Line heights (raw px values)
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },

  // Letter spacing (tracking)
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.3,
  },

  // Semantic text styles (ready-to-spread objects)
  styles: {
    heroTitle: {
      fontSize: 36,
      fontWeight: "800" as const,
      letterSpacing: -0.5,
      lineHeight: 44,
      color: "#191c1d",
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: "800" as const,
      letterSpacing: -0.3,
      lineHeight: 28,
      color: "#191c1d",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700" as const,
      lineHeight: 22,
      color: "#191c1d",
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700" as const,
      lineHeight: 20,
      color: "#191c1d",
    },
    bodyBase: {
      fontSize: 15,
      fontWeight: "400" as const,
      lineHeight: 22,
      color: "#414755",
    },
    bodySm: {
      fontSize: 13,
      fontWeight: "400" as const,
      lineHeight: 19,
      color: "#414755",
    },
    label: {
      fontSize: 14,
      fontWeight: "600" as const,
      lineHeight: 20,
      color: "#191c1d",
    },
    caption: {
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: 16,
      color: "#717786",
    },
    captionSm: {
      fontSize: 11,
      fontWeight: "400" as const,
      lineHeight: 15,
      color: "#C9BFB3",
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      lineHeight: 14,
    },
    buttonLabel: {
      fontSize: 15,
      fontWeight: "800" as const, // extrabold per Stitch CTA spec
      lineHeight: 20,
    },
    buttonLabelSm: {
      fontSize: 13,
      fontWeight: "600" as const,
      lineHeight: 18,
    },
    inputText: {
      fontSize: 15,
      fontWeight: "400" as const,
      lineHeight: 20,
      color: "#191c1d",
    },
    inputPlaceholder: {
      fontSize: 15,
      fontWeight: "400" as const,
      color: "#717786",
    },
    badge: {
      fontSize: 11,
      fontWeight: "600" as const,
      lineHeight: 14,
      letterSpacing: 0.2,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px base scale)
// ---------------------------------------------------------------------------

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export type SpacingToken = keyof typeof spacing;

// ---------------------------------------------------------------------------
// Border Radius — Stitch scale: DEFAULT 16px, lg 32px, xl 48px, full 9999px
// ---------------------------------------------------------------------------

export const borderRadius = {
  none: 0,
  sm: 4,    // small element detail
  md: 8,    // chip inner
  lg: 16,   // DEFAULT card / button (Stitch "rounded-xl")
  xl: 32,   // large card (Stitch "rounded-lg")
  "2xl": 48, // extra large (Stitch "rounded-xl")
  full: 9999, // pill / avatar / selection chip
} as const;

export type BorderRadiusToken = keyof typeof borderRadius;

// ---------------------------------------------------------------------------
// Shadows — tinted with secondaryFixedDim (#C9BFB3), no harsh black
// ---------------------------------------------------------------------------

type ShadowStyle = Pick<
  ViewStyle,
  | "shadowColor"
  | "shadowOffset"
  | "shadowOpacity"
  | "shadowRadius"
  | "elevation"
>;

function makeShadow(
  color: string,
  opacity: number,
  radius: number,
  elevation: number,
  offsetY = 2
): ShadowStyle {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
      shadowColor: color,
    },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation,
    },
  }) as ShadowStyle;
}

export const shadows = {
  none: {} as ShadowStyle,

  /** Subtle card shadow — tinted warm stone */
  card: makeShadow("#C9BFB3", 0.05, 16, 1, 4),

  /** Standard card with a bit more depth */
  cardMd: makeShadow("#C9BFB3", 0.08, 24, 2, 6),

  /** Large card / sheet */
  cardLg: makeShadow("#C9BFB3", 0.10, 32, 3, 8),

  /** Primary (teal) CTA button shadow — 20% opacity per Stitch spec */
  primaryButton: makeShadow("#5CB1A7", 0.20, 12, 4, 4),

  /** Floating action / modal bottom */
  floating: makeShadow("#C9BFB3", 0.12, 24, 8, 4),

  /** Top bar / header underline replacement */
  header: makeShadow("#C9BFB3", 0.06, 8, 2, 2),
} as const;

export type ShadowToken = keyof typeof shadows;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const layout = {
  // Page-level horizontal padding
  pagePadding: 16,
  pageVerticalPadding: 20,

  // Card internals
  cardPadding: 16,
  cardPaddingLg: 20,

  // Gap between sibling cards in a list
  cardGap: 10,
  cardGapMd: 12,
  cardGapLg: 16,

  // Gap between page sections
  sectionGap: 24,
  sectionGapLg: 28,

  // Touch targets
  touchTargetMin: 44,
  buttonHeightSm: 44,
  buttonHeightMd: 50,
  buttonHeightLg: 56,

  // Input
  inputHeight: 50,
  inputPaddingHorizontal: 14,

  // Tab bar — Stitch spec: rounded top corners, glass effect, 60px height
  tabBarHeight: 60,
  tabBarPaddingBottom: 8,
  tabBarPaddingTop: 6,
  tabBarIconSize: 20,
  tabBarTopRadius: 24,

  // Header
  headerHeight: 56,

  // Bottom safe-area pad (fallback; use useSafeAreaInsets in components)
  bottomSafeArea: 34,

  // Max content width (mirrors web's max-w-lg concept)
  maxContentWidth: 520,

  // Avatar / icon sizes
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 48,
  avatarXl: 64,

  // Progress indicator
  progressDotSize: 10,
  progressDotSizeActive: 12,
  progressBarHeight: 10, // h-2.5 per Stitch spec

  // Badge / tag
  badgePaddingHorizontal: 8,
  badgePaddingVertical: 3,
} as const;

// ---------------------------------------------------------------------------
// Component token presets
// NOTE: No borderWidth/borderColor for structural sectioning (No-Line Rule).
//       Cards use background color to create surface hierarchy.
// ---------------------------------------------------------------------------

export const componentStyles = {
  /** Standard card — white surface, tinted shadow, no border */
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: layout.cardPadding,
    ...shadows.card,
  } as ViewStyle,

  /** Large card */
  cardLg: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    ...shadows.cardMd,
  } as ViewStyle,

  /** Sectioned area (uses tonal background instead of border) */
  section: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: layout.cardPadding,
  } as ViewStyle,

  /** Input field */
  inputBase: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    height: layout.inputHeight,
    paddingHorizontal: layout.inputPaddingHorizontal,
    ...typography.styles.inputText,
  } as ViewStyle,

  inputFocused: {
    backgroundColor: colors.primaryFixed,
  } as ViewStyle,

  /** Primary CTA — extrabold label, gradient via LinearGradient in component */
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    height: layout.buttonHeightMd,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadows.primaryButton,
  } as ViewStyle,

  buttonSecondary: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    height: layout.buttonHeightMd,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  } as ViewStyle,

  buttonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
    height: layout.buttonHeightMd,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  } as ViewStyle,

  /** Selection chip — active: primary fill, inactive: surfaceContainerHighest */
  chipActive: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  } as ViewStyle,

  chipInactive: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  } as ViewStyle,

  tagDefault: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    paddingHorizontal: layout.badgePaddingHorizontal,
    paddingVertical: layout.badgePaddingVertical,
  } as ViewStyle,

  tagPrimary: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: layout.badgePaddingHorizontal,
    paddingVertical: layout.badgePaddingVertical,
  } as ViewStyle,

  selectedState: {
    backgroundColor: colors.tabBarActiveBackground,
  } as ViewStyle,

  /** Bottom tab active indicator pill */
  tabActivePill: {
    backgroundColor: colors.tabBarActiveBackground,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  } as ViewStyle,
} as const;

// ---------------------------------------------------------------------------
// Gradient definitions (use with expo-linear-gradient)
// ---------------------------------------------------------------------------

export const gradients = {
  /** Primary CTA gradient: primary → primaryContainer */
  primaryCta: {
    colors: [colors.primary, colors.primaryContainer],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },

  /** Subtle surface gradient for hero sections */
  surfaceHero: {
    colors: [colors.surfaceContainerLowest, colors.primaryFixed],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
} as const;

// ---------------------------------------------------------------------------
// Full theme export
// ---------------------------------------------------------------------------

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  componentStyles,
  gradients,
} as const;

export type Theme = typeof theme;
export default theme;
