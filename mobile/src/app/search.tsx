import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Clock, Mic, Search, TrendingUp, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { VoiceSearchModal } from "@/components/search/voice-search-modal";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useSuggestions, useTrendingSearches } from "@/hooks/use-catalog";
import { deviceStore } from "@/lib/device-store";
import { openListing } from "@/lib/navigation";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function SearchScreen() {
  const { voice } = useLocalSearchParams<{ voice?: string }>();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  // Arriving from the home search bar's mic opens the sheet straight away.
  const [voiceOpen, setVoiceOpen] = useState(voice === "1");
  const input = useRef<TextInput>(null);
  const suggestions = useSuggestions(q);
  const trending = useTrendingSearches();
  const typing = q.trim().length >= 2;

  useEffect(() => {
    deviceStore.recentSearches().then(setRecent);
  }, []);

  const closeVoice = useCallback(() => {
    setVoiceOpen(false);
    input.current?.focus();
  }, []);

  const submit = (term: string) => {
    const value = term.trim();
    if (!value) return;
    deviceStore.addRecentSearch(value).then(() => deviceStore.recentSearches().then(setRecent));
    openListing({ q: value }, value);
  };

  const data = suggestions.data;
  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.ink900} />
        </Pressable>
        <View style={styles.inputBox}>
          <Search size={18} color={colors.ink500} />
          <TextInput
            ref={input}
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Search for products, brands and more"
            placeholderTextColor={colors.ink300}
            returnKeyType="search"
            onSubmitEditing={() => submit(q)}
            style={styles.input}
          />
          {q ? (
            <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQ("")}>
              <X size={18} color={colors.ink500} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Search by voice" hitSlop={10} onPress={() => setVoiceOpen(true)}>
            <Mic size={18} color={colors.brand700} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {typing && data ? (
          <>
            {data.products.map((product) => (
              <Pressable key={product.id} style={styles.row} onPress={() => router.push(`/product/${product.slug}`)}>
                <Image source={product.imageUrl} style={styles.thumb} contentFit="contain" />
                <Text numberOfLines={1} style={styles.flex}>
                  {product.name}
                </Text>
              </Pressable>
            ))}
            {data.categories.map((category) => (
              <Pressable key={category.id} style={styles.row} onPress={() => openListing({ category: category.slug }, category.name)}>
                <Search size={18} color={colors.ink500} />
                <Text style={styles.flex}>
                  {category.name}{" "}
                  <Text variant="small" color={colors.ink500}>
                    in categories
                  </Text>
                </Text>
              </Pressable>
            ))}
            {data.brands.map((brand) => (
              <Pressable key={brand.id} style={styles.row} onPress={() => openListing({ brand: brand.slug }, brand.name)}>
                <Search size={18} color={colors.ink500} />
                <Text style={styles.flex}>
                  {brand.name}{" "}
                  <Text variant="small" color={colors.ink500}>
                    brand
                  </Text>
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.row} onPress={() => submit(q)}>
              <Search size={18} color={colors.ink900} />
              <Text style={styles.flex}>See all results for “{q.trim()}”</Text>
            </Pressable>
          </>
        ) : (
          <>
            {recent.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text variant="h3">Recent searches</Text>
                  <Pressable hitSlop={8} onPress={() => deviceStore.clearRecentSearches().then(() => setRecent([]))}>
                    <Text variant="small" color={colors.brand700}>
                      Clear
                    </Text>
                  </Pressable>
                </View>
                {recent.map((term) => (
                  <Pressable key={term} style={styles.row} onPress={() => submit(term)}>
                    <Clock size={18} color={colors.ink500} />
                    <Text style={styles.flex}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {trending.data?.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text variant="h3">Trending</Text>
                  <TrendingUp size={18} color={colors.ink500} />
                </View>
                <View style={styles.chips}>
                  {trending.data.map((term) => (
                    <Chip key={term} label={term} onPress={() => submit(term)} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <VoiceSearchModal visible={voiceOpen} onClose={closeVoice} onTranscript={setQ} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  inputBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.control, borderWidth: 1, borderColor: colors.brand500, backgroundColor: colors.surface },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink900 },
  content: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.xs },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  thumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
