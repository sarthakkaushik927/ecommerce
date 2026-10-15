import AsyncStorage from "@react-native-async-storage/async-storage";

/** Device-only preferences; nothing here is account data. */
const KEYS = {
  onboarded: "haat.onboarded",
  recentSearches: "haat.recentSearches",
  recentlyViewed: "haat.recentlyViewed",
  voiceLocale: "haat.voiceLocale",
} as const;
const MAX_RECENT = 10;

async function readList(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function pushUnique(key: string, value: string) {
  const list = await readList(key);
  await AsyncStorage.setItem(key, JSON.stringify([value, ...list.filter((item) => item !== value)].slice(0, MAX_RECENT)));
}

export const deviceStore = {
  isOnboarded: async () => (await AsyncStorage.getItem(KEYS.onboarded)) === "1",
  setOnboarded: () => AsyncStorage.setItem(KEYS.onboarded, "1"),
  recentSearches: () => readList(KEYS.recentSearches),
  addRecentSearch: (term: string) => pushUnique(KEYS.recentSearches, term.trim()),
  clearRecentSearches: () => AsyncStorage.removeItem(KEYS.recentSearches),
  recentlyViewed: () => readList(KEYS.recentlyViewed),
  addRecentlyViewed: (productId: string) => pushUnique(KEYS.recentlyViewed, productId),
  /** Returned raw; the caller validates it, so this layer stays free of feature types. */
  voiceLocale: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(KEYS.voiceLocale);
    } catch {
      return null;
    }
  },
  setVoiceLocale: (locale: string) => AsyncStorage.setItem(KEYS.voiceLocale, locale),
};
