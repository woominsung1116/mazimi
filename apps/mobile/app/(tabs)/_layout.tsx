import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { colors, layout, typography } from "../../constants/theme";

// ---------------------------------------------------------------------------
// Geometric icon shapes — no external icon package required.
// Each icon is a small View-based shape that communicates the tab's function.
// ---------------------------------------------------------------------------

type IconProps = { focused: boolean };

/** 홈 (Home): classic house silhouette — triangle roof + rect body */
function IconHome({ focused }: IconProps) {
  const color = focused ? colors.tabBarActive : colors.tabBarInactive;
  return (
    <View
      style={{
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      {/* Roof: filled triangle via rotated square clipped at bottom */}
      <View
        style={{
          width: 14,
          height: 14,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          transform: [{ rotate: "45deg" }],
          backgroundColor: color,
          position: "absolute",
          top: 0,
        }}
      />
      {/* Body: filled rectangle */}
      <View
        style={{
          width: 10,
          height: 7,
          borderTopLeftRadius: 1,
          borderTopRightRadius: 1,
          backgroundColor: focused ? colors.tabBarActive : colors.tabBarInactive,
        }}
      />
    </View>
  );
}

/** 탐색 (Explore / Search): magnifying glass — circle outline + handle */
function IconExplore({ focused }: IconProps) {
  const color = focused ? colors.tabBarActive : colors.tabBarInactive;
  return (
    <View
      style={{
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Glass lens */}
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
          position: "absolute",
          top: 1,
          left: 1,
        }}
      >
        {/* Inner cutout for ring effect */}
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: focused
              ? colors.tabBarActiveBackground
              : colors.surfaceContainerLowest,
          }}
        />
      </View>
      {/* Handle */}
      <View
        style={{
          width: 5,
          height: 3,
          borderRadius: 2,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
          position: "absolute",
          bottom: 1,
          right: 1,
        }}
      />
    </View>
  );
}

/** 신청 관리 (Manage): clipboard with a checkmark tick */
function IconManage({ focused }: IconProps) {
  const color = focused ? colors.tabBarActive : colors.tabBarInactive;
  const bgColor = focused
    ? colors.tabBarActiveBackground
    : colors.surfaceContainerLowest;
  return (
    <View
      style={{
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Clipboard body */}
      <View
        style={{
          width: 13,
          height: 16,
          borderRadius: 3,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Clip at top */}
        <View
          style={{
            width: 6,
            height: 3,
            borderRadius: 2,
            backgroundColor: bgColor,
            position: "absolute",
            top: -1,
          }}
        />
        {/* Check mark: left diagonal */}
        <View
          style={{
            width: 3,
            height: 2,
            borderRadius: 1,
            backgroundColor: bgColor,
            transform: [{ rotate: "45deg" }],
            position: "absolute",
            bottom: 5,
            left: 2,
          }}
        />
        {/* Check mark: right diagonal (longer) */}
        <View
          style={{
            width: 5,
            height: 2,
            borderRadius: 1,
            backgroundColor: bgColor,
            transform: [{ rotate: "-45deg" }],
            position: "absolute",
            bottom: 5,
            right: 1,
          }}
        />
      </View>
    </View>
  );
}

/** 내 정보 (Profile): person silhouette — circle head + rounded body */
function IconProfile({ focused }: IconProps) {
  const color = focused ? colors.tabBarActive : colors.tabBarInactive;
  return (
    <View
      style={{
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      {/* Head */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          position: "absolute",
          top: 0,
        }}
      />
      {/* Body / shoulders */}
      <View
        style={{
          width: 14,
          height: 9,
          borderTopLeftRadius: 7,
          borderTopRightRadius: 7,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab icon wrapper — applies the active pill background per Stitch spec
// Active:   bg-blue-50 text-blue-700 rounded-full px-5 py-2
// Inactive: text-slate-400 px-5 py-2
// ---------------------------------------------------------------------------

function TabIcon({
  icon,
  focused,
}: {
  icon: React.ReactNode;
  focused: boolean;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20, // px-5 = 20px
        paddingVertical: 8,    // py-2 = 8px
        borderRadius: layout.tabBarTopRadius * 2, // rounded-full
        backgroundColor: focused ? colors.tabBarActiveBackground : "transparent",
        minWidth: 40,
        minHeight: layout.touchTargetMin,
      }}
    >
      {icon}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared tab label renderer
// ---------------------------------------------------------------------------

function TabLabel({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text
      style={{
        fontSize: typography.fontSize.xs,       // 11px per Stitch spec
        fontWeight: focused
          ? typography.fontWeight.bold
          : typography.fontWeight.semibold,     // semibold when inactive, bold when active
        color,
        marginTop: 4, // mt-1
        fontFamily: typography.fontFamily.body, // Manrope per Stitch spec
      }}
    >
      {label}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          // Glass effect: bg-white/80 backdrop-blur-xl
          backgroundColor: colors.tabBarBackground,
          // No-Line Rule: remove default hairline border
          borderTopWidth: 0,
          // Stitch: rounded-t-[3rem] = 48px, mapped to layout token
          borderTopLeftRadius: layout.tabBarTopRadius * 2,
          borderTopRightRadius: layout.tabBarTopRadius * 2,
          height: layout.tabBarHeight + layout.bottomSafeArea,
          paddingBottom: layout.bottomSafeArea,
          paddingTop: layout.tabBarPaddingTop,
          // Stitch shadow: shadow-[0_-8px_32px_rgba(182,199,235,0.06)]
          shadowColor: colors.secondaryFixedDim,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.06,
          shadowRadius: 32,
          elevation: 8,
          overflow: "hidden" as const,
        },
        tabBarLabelStyle: {
          // Overridden per-tab via tabBarLabel prop; this is fallback
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.semibold,
          marginTop: 4,
        },
        // Header: bg-white/80 backdrop-blur-xl sticky, brand "마지미"
        headerStyle: {
          backgroundColor: colors.tabBarBackground,
        },
        headerTintColor: colors.onSurface,
        headerTitleStyle: {
          // text-2xl font-extrabold text-blue-600 font-headline
          fontWeight: typography.fontWeight.extrabold,
          fontSize: typography.fontSize["2xl"],
          color: colors.primary,
          fontFamily: typography.fontFamily.heading,
        },
        headerShadowVisible: false,
        // Header left: user avatar circle; right: notification bell
        // These are applied per-screen via options on the index tab
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          headerTitle: "마지미",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<IconHome focused={focused} />} focused={focused} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="홈" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "탐색",
          headerTitle: "탐색",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<IconExplore focused={focused} />} focused={focused} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="탐색" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: "신청 관리",
          headerTitle: "신청 관리",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<IconManage focused={focused} />} focused={focused} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="신청 관리" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "내 정보",
          headerTitle: "내 정보",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<IconProfile focused={focused} />} focused={focused} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="내 정보" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
