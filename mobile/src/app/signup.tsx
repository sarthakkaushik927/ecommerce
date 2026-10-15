import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AuthLayout, finishAuth } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useRegister } from "@/hooks/use-auth";
import { errorMessage, fieldErrors } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";

export default function SignupScreen() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", referralCode: "" });
  const register = useRegister();
  const errors = fieldErrors(register.error);
  const formError = register.error && Object.keys(errors).length === 0 ? errorMessage(register.error) : null;
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const ready = form.name.trim() && form.email.trim() && form.phone.trim() && form.password.length >= 8;

  return (
    <AuthLayout title="Create account" subtitle="Shop from your neighbourhood store and earn coins on every order.">
      <Input label="Full name" value={form.name} onChangeText={set("name")} autoComplete="name" error={errors.name} />
      <Input label="Email" value={form.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <Input label="Phone" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" error={errors.phone} />
      <Input label="Password" value={form.password} onChangeText={set("password")} secureTextEntry hint="At least 8 characters" error={errors.password} />
      <Input
        label="Referral code (optional)"
        value={form.referralCode}
        onChangeText={(text) => set("referralCode")(text.toUpperCase())}
        autoCapitalize="characters"
        hint="Enter referral code, then open your box."
        error={errors.referralCode}
      />
      {formError ? (
        <Text variant="small" color={colors.danger}>
          {formError}
        </Text>
      ) : null}
      <Button
        title="Create account"
        loading={register.isPending}
        disabled={!ready}
        onPress={() =>
          register.mutate(
            {
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim(),
              password: form.password,
              referralCode: form.referralCode.trim() || undefined,
            },
            { onSuccess: finishAuth },
          )
        }
      />
      <View style={styles.switch}>
        <Text color={colors.ink500}>Already have an account?</Text>
        <Pressable hitSlop={8} onPress={() => router.replace("/login")}>
          <Text style={styles.bold}>Login</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
  switch: { flexDirection: "row", justifyContent: "center", gap: spacing.xs },
});
