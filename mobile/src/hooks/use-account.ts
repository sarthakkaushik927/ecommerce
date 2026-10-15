import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { Address, AddressInput, AppNotification, CartCoupon, Coins, Offer, ReferralSummary, User } from "@/lib/types";

const useSignedIn = () => useAuthStore((state) => state.user !== null);

/** Refreshes the stored user (coin balance changes after orders). */
export function useMe() {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ["me"],
    enabled: signedIn,
    queryFn: async () => {
      const user = await api.get<User>("/auth/me");
      useAuthStore.getState().setUser(user);
      return user;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; phone?: string }) => api.patch<User>("/profile", input),
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: { currentPassword: string; newPassword: string }) => api.post("/auth/password/change", input) });
}

export function useAddresses() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["addresses"], enabled: signedIn, queryFn: () => api.get<Address[]>("/addresses") });
}

export function useSaveAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AddressInput }) => (id ? api.patch<Address>(`/addresses/${id}`, input) : api.post<Address>("/addresses", input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/addresses/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }) });
}

export function useCoins() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["coins"], enabled: signedIn, queryFn: () => api.get<Coins>("/coins", { limit: 50 }) });
}

export function usePublicCoupons() {
  return useQuery({ queryKey: ["coupons", "public"], queryFn: () => api.get<Offer[]>("/coupons") });
}

export function useMyCoupons(enabled: boolean) {
  return useQuery({ queryKey: ["cart", "coupons"], enabled, queryFn: () => api.get<CartCoupon[]>("/cart/coupons") });
}

export function useNotifications() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["notifications"], enabled: signedIn, queryFn: () => api.get<AppNotification[]>("/notifications", { limit: 50 }) });
}

export function useUnreadCount() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["notifications", "unread"], enabled: signedIn, queryFn: () => api.get<{ count: number }>("/notifications/unread-count"), select: (data) => data.count });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => api.post("/notifications/read-all"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }) });
}

export function useReferralSummary() {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ["referrals", "me"],
    enabled: signedIn,
    queryFn: () => api.get<ReferralSummary>("/profile/referrals"),
  });
}

