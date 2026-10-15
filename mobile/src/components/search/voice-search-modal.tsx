import { Mic, MicOff, Settings } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useVoiceSearch } from "@/hooks/use-voice-search";
import { colors, radius, spacing } from "@/lib/theme";
import { VOICE_LOCALES } from "@/lib/voice-query";

type VoiceSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once with a cleaned, non-empty transcript. The caller decides what to search. */
  onTranscript: (text: string) => void;
};

export function VoiceSearchModal({ visible, onClose, onTranscript }: VoiceSearchModalProps) {
  const voice = useVoiceSearch();
  const { state, partial, transcript, message, locale, setLocale, start, stop, reset } = voice;
  /** A parent re-render must not deliver the same transcript twice. */
  const delivered = useRef(false);
  const pulse = useMemo(() => new Animated.Value(0), []);

  // `start` identity tracks the chosen locale, so picking a language restarts recognition in it.
  useEffect(() => {
    if (visible) void start();
    else reset();
  }, [visible, start, reset]);

  useEffect(() => {
    if (!visible) {
      delivered.current = false;
      return;
    }
    if (transcript === null || delivered.current) return;
    delivered.current = true;
    if (transcript) onTranscript(transcript);
    onClose();
  }, [visible, transcript, onTranscript, onClose]);

  useEffect(() => {
    if (state !== "listening") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const halo = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  };

  return (
    <Sheet visible={visible} title="Voice search" onClose={onClose}>
      {state === "requesting" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
          <Text color={colors.ink500}>Checking microphone access…</Text>
        </View>
      ) : null}

      {state === "listening" || state === "idle" ? (
        <View style={styles.center}>
          <View style={styles.micWrap}>
            <Animated.View style={[styles.halo, halo]} />
            <View style={styles.mic}>
              <Mic size={30} color={colors.ink900} strokeWidth={1.75} />
            </View>
          </View>
          <Text variant="h3">{state === "listening" ? "Listening…" : "Getting ready…"}</Text>
          <Text
            accessibilityLiveRegion="polite"
            color={partial ? colors.ink900 : colors.ink500}
            style={styles.transcript}
          >
            {partial || "Say a product, brand or category"}
          </Text>
          <View style={styles.chips}>
            {VOICE_LOCALES.map((entry) => (
              <Chip key={entry.code} label={entry.label} selected={entry.code === locale} onPress={() => setLocale(entry.code)} />
            ))}
          </View>
          <Button title="Stop" variant="outline" small onPress={stop} style={styles.action} />
        </View>
      ) : null}

      {state === "denied" ? (
        <View style={styles.center}>
          <View style={[styles.mic, styles.micMuted]}>
            <MicOff size={30} color={colors.danger} strokeWidth={1.75} />
          </View>
          <Text variant="h3">Microphone is off</Text>
          <View style={styles.alert}>
            <Text color={colors.danger} style={styles.transcript}>
              {message}
            </Text>
          </View>
          <Button title="Open Settings" icon={<Settings size={18} color={colors.ink900} />} onPress={voice.openSettings} style={styles.action} />
          <Button title="Type instead" variant="ghost" small onPress={onClose} />
        </View>
      ) : null}

      {state === "unavailable" ? (
        <View style={styles.center}>
          <Text variant="h3">Not available</Text>
          <Text color={colors.ink500} style={styles.transcript}>
            {message}
          </Text>
          {voice.canDownloadModel ? <Button title="Download voice model" onPress={voice.downloadModel} style={styles.action} /> : null}
          <Button title="Type instead" variant="ghost" small onPress={onClose} />
        </View>
      ) : null}

      {state === "error" ? (
        <View style={styles.center}>
          <Text variant="h3">{"Didn't catch that"}</Text>
          <Text color={colors.ink500} style={styles.transcript}>
            {message}
          </Text>
          <Button title="Try again" onPress={() => void start()} style={styles.action} />
          <Button title="Type instead" variant="ghost" small onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  micWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand200 },
  mic: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" },
  micMuted: { backgroundColor: colors.dangerSoft },
  transcript: { textAlign: "center" },
  chips: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  alert: { alignSelf: "stretch", backgroundColor: colors.dangerSoft, borderRadius: radius.control, padding: spacing.md },
  action: { minWidth: 200, marginTop: spacing.xs },
});
