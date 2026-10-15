import { router } from "expo-router";
import { Bell, Coins, HelpCircle, LogOut, MapPin, Package, Share2, Tag, UserRound } from "lucide-react-native";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import { TAB_BAR_CLEARANCE } from "@/components/navigation/pill-tab-bar";
import { Button } from "@/components/ui/button";
import { MenuGroup, MenuRow } from "@/components/ui/menu-row";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useMe, useUnreadCount } from "@/hooks/use-account";
import { useLogout } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-catalog";
import { useAuthStore } from "@/lib/auth-store";
import { colors, radius, spacing } from "@/lib/theme";

export default function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  useMe();
  const unread = useUnreadCount();
  const settings = useSettings();
  const logout = useLogout();

  const help = () => {
    const phone = settings.data?.supportPhone;
    const email = settings.data?.supportEmail;
    Alert.alert("Help & support", [phone, email].filter(Boolean).join("\n") || "Contact the store for help.", [
      ...(phone ? [{ text: "Call", onPress: () => Linking.openURL(`tel:${phone}`) }] : []),
      ...(email ? [{ text: "Email", onPress: () => Linking.openURL(`mailto:${email}`) }] : []),
      { text: "Close", style: "cancel" as const },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
        <Text variant="h1">Account</Text>
        {user ? (
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text variant="h2">{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text variant="h2" numberOfLines={1}>
                {user.name}
              </Text>
              <Text variant="small" color={colors.ink700} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <View style={styles.coins}>
              <Coins size={16} color={colors.ink900} />
              <Text variant="h3">{user.coinBalance}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.guest}>
            <Text variant="h2">Welcome to Haat</Text>
            <Text color={colors.ink700}>Login to track orders, save addresses and earn coins.</Text>
            <View style={styles.buttons}>
              <Button title="Login" onPress={() => router.push("/login")} style={styles.flex} />
              <Button title="Sign up" variant="outline" onPress={() => router.push("/signup")} style={styles.flex} />
            </View>
          </View>
        )}

        {user ? (
          <MenuGroup>
            <MenuRow icon={Package} label="My orders" onPress={() => router.push("/orders")} />
            <MenuRow icon={MapPin} label="Saved addresses" onPress={() => router.push("/account/addresses")} />
            <MenuRow icon={Coins} label="Haat coins" hint={String(user.coinBalance)} onPress={() => router.push("/account/coins")} />
            <MenuRow icon={Share2} label="Refer & earn" hint={user.referralCode ?? undefined} onPress={() => router.push("/account/profile")} />
            <MenuRow icon={Bell} label="Notifications" hint={unread.data ? `${unread.data} new` : undefined} onPress={() => router.push("/account/notifications")} />
            <MenuRow icon={UserRound} label="Edit profile" onPress={() => router.push("/account/profile")} />
          </MenuGroup>
        ) : null}

        <MenuGroup>
          <MenuRow icon={Tag} label="Offers & coupons" onPress={() => router.push("/account/offers")} />
          <MenuRow icon={HelpCircle} label="Help & support" onPress={help} />
          {user ? (
            <MenuRow
              icon={LogOut}
              label="Logout"
              danger
              onPress={() =>
                Alert.alert("Logout?", "You will need to sign in again to see your cart and orders.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Logout", style: "destructive", onPress: () => logout.mutate() },
                ])
              }
            />
          ) : null}
        </MenuGroup>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.brand100 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand500, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  coins: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  guest: { padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.brand100, gap: spacing.sm },
  buttons: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
});
