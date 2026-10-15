import { router } from "expo-router";
import { Share2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Text } from "@/components/ui/text";
import { useChangePassword, useReferralSummary, useUpdateProfile } from "@/hooks/use-account";
import { errorMessage, fieldErrors } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { colors, radius, spacing } from "@/lib/theme";

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const referrals = useReferralSummary();
  const referralCode = referrals.data?.referralCode ?? user?.referralCode;
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const update = useUpdateProfile();
  const change = useChangePassword();
  const profileErrors = fieldErrors(update.error);
  const passwordErrors = fieldErrors(change.error);

  return (
    <Screen>
      <StackHeader title="Edit profile" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {referralCode ? (
          <Card title="Refer & earn">
            <Text variant="small" color={colors.ink700}>
              Share your referral code with friends. When they sign up and get their first order delivered, you earn ₹
              {referrals.data?.referrerBonus ?? 50} in coins and they get ₹
              {referrals.data?.refereeBonus ?? 25}!
            </Text>
            <View style={styles.codeContainer}>
              <View>
                <Text variant="small" color={colors.ink500}>
                  YOUR CODE
                </Text>
                <Text variant="h2" style={styles.codeText}>
                  {referralCode}
                </Text>
              </View>
              <Button
                title="Share"
                variant="outline"
                small
                icon={<Share2 size={14} color={colors.ink900} />}
                onPress={() => {
                  Share.share({
                    message: `Shop on Haat! Use my referral code ${referralCode} when signing up to get ₹${referrals.data?.refereeBonus ?? 25} in coins: https://haat.local`,
                  });
                }}
              />
            </View>
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text variant="small" color={colors.ink500}>
                  Friends joined
                </Text>
                <Text variant="h3">{referrals.data?.completedCount ?? 0}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text variant="small" color={colors.ink500}>
                  Coins earned
                </Text>
                <Text variant="h3" color={colors.brand700}>
                  {referrals.data?.totalCoinsEarned ?? 0}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        <Card title="Details">
          <Input label="Full name" value={name} onChangeText={setName} error={profileErrors.name} />
          <Input label="Email" value={user?.email ?? ""} editable={false} hint="Email can't be changed" />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={profileErrors.phone} />
          <Button
            title="Save"
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { name: name.trim(), phone: phone.trim() || undefined },
                { onSuccess: () => router.back(), onError: (error) => Object.keys(fieldErrors(error)).length || Alert.alert("Couldn't save", errorMessage(error)) },
              )
            }
          />
        </Card>
        <Card title="Change password">
          <Input label="Current password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} error={passwordErrors.currentPassword} />
          <Input label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} hint="At least 8 characters" error={passwordErrors.newPassword} />
          <Button
            title="Update password"
            variant="outline"
            loading={change.isPending}
            disabled={!currentPassword || newPassword.length < 8}
            onPress={() =>
              change.mutate(
                { currentPassword, newPassword },
                {
                  onSuccess: () => {
                    setCurrentPassword("");
                    setNewPassword("");
                    Alert.alert("Password updated");
                  },
                  onError: (error) => Object.keys(fieldErrors(error)).length || Alert.alert("Couldn't update password", errorMessage(error)),
                },
              )
            }
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.brand100,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  codeText: {
    fontFamily: "PlusJakartaSans_800ExtraBold",
    letterSpacing: 2,
    color: colors.ink900,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.line,
  },
});
