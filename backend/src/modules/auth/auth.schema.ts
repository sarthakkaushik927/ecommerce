import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?\d{1,3}[- ]?)?\d{10}$/, "Enter a valid 10-digit phone number");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

const email = z.email("Enter a valid email").trim().toLowerCase();

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email,
  phone: phoneSchema,
  password: passwordSchema,
  referralCode: z.string().trim().optional(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone"),
  password: z.string().min(1, "Enter your password"),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
