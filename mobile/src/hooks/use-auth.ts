import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { Session } from "@/lib/types";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { identifier: string; password: string }) => api.post<Session>("/auth/login", input),
    onSuccess: async (session) => {
      await useAuthStore.getState().setSession(session);
      await queryClient.invalidateQueries();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; phone: string; password: string; referralCode?: string }) =>
      api.post<Session>("/auth/register", input),
    onSuccess: async (session) => {
      await useAuthStore.getState().setSession(session);
      await queryClient.invalidateQueries();
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => api.post("/auth/password/forgot", { email }) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: (input: { email: string; otp: string; password: string }) => api.post("/auth/password/reset", input) });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { refreshToken, clear } = useAuthStore.getState();
      if (refreshToken) await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
      await clear();
    },
    onSettled: () => queryClient.clear(),
  });
}
