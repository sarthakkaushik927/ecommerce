import { router } from "expo-router";
import { Mic, Search } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "./text";

/** Tappable stand-in that opens the real search screen. The mic opens it listening. */
export function SearchBar({ placeholder = "Search for products, brands and more" }: { placeholder?: string }) {
  return (
    <Pressable accessibilityRole="search" accessibilityLabel="Search" onPress={() => router.push("/search")} style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
      <Search size={18} color={colors.ink500} />
      <Text color={colors.ink300} numberOfLines={1} style={styles.text}>
        {placeholder}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search by voice"
        hitSlop={10}
        onPress={() => router.push({ pathname: "/search", params: { voice: "1" } })}
      >
        <Mic size={18} color={colors.brand700} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, paddingHorizontal: spacing.md, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pressed: { opacity: 0.85 },
  text: { flex: 1 },
});
