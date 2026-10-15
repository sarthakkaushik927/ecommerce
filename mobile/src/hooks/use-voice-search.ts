import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { deviceStore } from "@/lib/device-store";
import { DEFAULT_VOICE_LOCALE, isVoiceLocale, normalizeTranscript, VOICE_LOCALES, type VoiceLocale } from "@/lib/voice-query";

type ExpoSpeechModuleType = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
type SpeechEventHookType = typeof import("expo-speech-recognition").useSpeechRecognitionEvent;

let ExpoSpeechRecognitionModule: ExpoSpeechModuleType | null = null;
let useSpeechRecognitionEvent: SpeechEventHookType = () => {};

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const speech = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = speech.ExpoSpeechRecognitionModule ?? null;
  useSpeechRecognitionEvent = speech.useSpeechRecognitionEvent ?? (() => {});
} catch {
  // ExpoSpeechRecognition requires a custom native build and is not available in Expo Go.
  ExpoSpeechRecognitionModule = null;
}

export type VoiceState = "idle" | "requesting" | "listening" | "denied" | "unavailable" | "error";

/** Google's on-device recognizer: the only Android package that reports installed offline locales. */
const ON_DEVICE_PACKAGE = "com.google.android.as";

const DENIED_MESSAGE = "Haat needs microphone access to search by voice. You can turn it on in Settings.";
const RESTRICTED_MESSAGE = "Speech recognition is blocked by this device's content and privacy restrictions.";

function labelFor(locale: VoiceLocale): string {
  return VOICE_LOCALES.find((entry) => entry.code === locale)?.label ?? locale;
}

/**
 * Android can enumerate which locales are installed for offline use, so we only claim strict
 * on-device recognition when the chosen language is actually present. iOS decides for itself and
 * ignores the flag when it cannot honour it.
 */
async function resolveOnDevice(locale: VoiceLocale): Promise<{ ok: true; servicePackage?: string } | { ok: false }> {
  if (!ExpoSpeechRecognitionModule) return { ok: false };
  if (Platform.OS !== "android") return { ok: true };
  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage: ON_DEVICE_PACKAGE,
    });
    return installedLocales.includes(locale) ? { ok: true, servicePackage: ON_DEVICE_PACKAGE } : { ok: false };
  } catch {
    // Android 12 and below cannot list locales; let the platform try and report a real error instead.
    return { ok: true };
  }
}

/**
 * Drives on-device speech recognition for product search.
 *
 * Permission order matters: check first, prompt only when the OS will actually show its dialog, and
 * treat a blocked permission as a dead end rather than prompting into the void.
 */
export function useVoiceSearch() {
  const [state, setState] = useState<VoiceState>("idle");
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<VoiceLocale>(DEFAULT_VOICE_LOCALE);
  /** Tracks whether the native recognizer is actually running, so cleanup only aborts a live session. */
  const running = useRef(false);

  useEffect(() => {
    deviceStore.voiceLocale().then((saved) => {
      if (isVoiceLocale(saved)) setLocaleState(saved);
    });
  }, []);

  useEffect(() => () => {
    if (running.current && ExpoSpeechRecognitionModule) ExpoSpeechRecognitionModule.abort();
  }, []);

  useSpeechRecognitionEvent("result", (event) => {
    const best = event.results[0]?.transcript ?? "";
    if (!event.isFinal) {
      setPartial(best);
      return;
    }
    running.current = false;
    setPartial("");
    setState("idle");
    setTranscript(normalizeTranscript(best));
  });

  useSpeechRecognitionEvent("error", (event) => {
    running.current = false;
    setPartial("");
    switch (event.error) {
      // Our own teardown, not a failure the shopper should see.
      case "aborted":
        setState("idle");
        return;
      case "not-allowed":
        setState("denied");
        setMessage(DENIED_MESSAGE);
        return;
      case "no-speech":
      case "speech-timeout":
        setState("error");
        setMessage("We didn't catch that. Tap the mic and try again.");
        return;
      case "language-not-supported":
      case "service-not-allowed":
        setState("unavailable");
        setMessage(`${labelFor(locale)} voice input isn't available on this device.`);
        return;
      default:
        setState("error");
        setMessage(event.message || "Voice search failed. Tap to try again.");
    }
  });

  useSpeechRecognitionEvent("end", () => {
    running.current = false;
    setPartial("");
    // Only a still-listening session ends as idle; a denial or error keeps its own state.
    setState((current) => (current === "listening" ? "idle" : current));
  });

  const start = useCallback(async () => {
    setMessage(null);
    setTranscript(null);
    setPartial("");
    setState("requesting");

    if (!ExpoSpeechRecognitionModule) {
      setState("unavailable");
      setMessage("Voice search requires a development build. Please type your search instead.");
      return;
    }

    let permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    // Only prompt when the OS will really show its dialog; once blocked, requesting is a silent no-op.
    if (!permission.granted && permission.canAskAgain) {
      permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    }
    if (!permission.granted) {
      setState("denied");
      setMessage(permission.restricted ? RESTRICTED_MESSAGE : DENIED_MESSAGE);
      return;
    }

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState("unavailable");
      setMessage("Voice search isn't available on this device.");
      return;
    }

    const availability = await resolveOnDevice(locale);
    if (!availability.ok) {
      setState("unavailable");
      setMessage(`${labelFor(locale)} voice input needs a one-time download from Google.`);
      return;
    }

    try {
      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
        ...(availability.servicePackage ? { androidRecognitionServicePackage: availability.servicePackage } : {}),
      });
      running.current = true;
      setState("listening");
    } catch {
      setState("error");
      setMessage("Couldn't start the microphone. Tap to try again.");
    }
  }, [locale]);

  const stop = useCallback(() => {
    // stop() asks for a final result; abort() would throw the utterance away.
    if (running.current && ExpoSpeechRecognitionModule) ExpoSpeechRecognitionModule.stop();
  }, []);

  const reset = useCallback(() => {
    if (running.current && ExpoSpeechRecognitionModule) ExpoSpeechRecognitionModule.abort();
    running.current = false;
    setState("idle");
    setPartial("");
    setTranscript(null);
    setMessage(null);
  }, []);

  const setLocale = useCallback(
    (next: VoiceLocale) => {
      setLocaleState(next);
      deviceStore.setVoiceLocale(next).catch(() => undefined);
    },
    [],
  );

  const downloadModel = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) return;
    try {
      await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale });
      setMessage("Download started. Try voice search again once it finishes.");
    } catch {
      setMessage("Couldn't start the download. Check your connection and try again.");
    }
  }, [locale]);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => undefined);
  }, []);

  return {
    state,
    partial,
    transcript,
    message,
    locale,
    setLocale,
    start,
    stop,
    reset,
    openSettings,
    downloadModel,
    /** Offline model downloads are an Android-only affordance. */
    canDownloadModel: Boolean(ExpoSpeechRecognitionModule) && Platform.OS === "android",
  };
}
