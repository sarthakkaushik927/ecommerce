import type { LucideIcon } from "lucide-react-native";
import { forwardRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { TabTriggerSlotProps } from "expo-router/ui";
import { Text } from "@/components/ui/text";
import { colors, radius, shadow } from "@/lib/theme";

type PillTabProps = TabTriggerSlotProps & { icon: LucideIcon; label: string; badge?: number };

/** The active tab expands into a yellow capsule with its label; inactive tabs show the icon only. */
export const PillTab = forwardRef<View, PillTabProps>(function PillTab(
  { icon: Icon, label, badge, isFocused, style: _style, ...props },
  ref
) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      {...props}
      style={({ pressed }) => [styles.tab, isFocused && styles.active, pressed && styles.pressed]}
    >
      <View>
        <Icon size={22} color={isFocused ? colors.ink900 : colors.ink500} strokeWidth={1.75} />
        {badge ? (
          <View style={styles.badge}>
            <Text variant="small" color={colors.surface} style={styles.badgeText}>
              {badge > 9 ? "9+" : badge}
            </Text>
          </View>
        ) : null}
      </View>
      {isFocused ? <Text variant="h3">{label}</Text> : null}
    </Pressable>
  );
});

export const pillBarStyles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    ...shadow.float,
  },
});

const styles = StyleSheet.create({
  tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, paddingHorizontal: 12, borderRadius: radius.pill },
  active: { backgroundColor: colors.brand500, paddingHorizontal: 18 },
  pressed: { transform: [{ scale: 0.97 }] },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
});

/** Bottom padding tab screens add so content scrolls clear of the floating bar. */
export const TAB_BAR_CLEARANCE = 112;
