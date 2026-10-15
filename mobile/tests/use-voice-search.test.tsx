import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useVoiceSearch } from "@/hooks/use-voice-search";
import {
  ExpoSpeechRecognitionModule as speech,
  blocked,
  emitSpeech,
  granted,
  refused,
  resetSpeechMock,
  resultEvent,
} from "./mocks/speech";

jest.mock("expo-speech-recognition", () => require("./mocks/speech"));

const mockSetVoiceLocale = jest.fn((_locale: string) => Promise.resolve());
jest.mock("@/lib/device-store", () => ({
  deviceStore: {
    voiceLocale: () => Promise.resolve(null),
    setVoiceLocale: (locale: string) => mockSetVoiceLocale(locale),
  },
}));

/** Renders the hook and runs `start()` to completion, including its awaited permission calls. */
async function startListening() {
  // renderHook is async in @testing-library/react-native v14.
  const view = await renderHook(() => useVoiceSearch());
  await act(async () => {
    await view.result.current.start();
  });
  return view;
}

/** v14's `act` is async: an unawaited call interleaves renders across tests. */
async function emit(name: string, payload?: unknown) {
  await act(async () => {
    emitSpeech(name, payload);
  });
}

beforeEach(() => {
  resetSpeechMock();
  mockSetVoiceLocale.mockClear();
});

describe("useVoiceSearch permissions", () => {
  it("listens straight away when permission is already granted", async () => {
    const { result } = await startListening();

    expect(speech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(result.current.state).toBe("listening");
    expect(speech.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "en-IN", interimResults: true, requiresOnDeviceRecognition: true }),
    );
  });

  it("raises the OS dialog when permission has not been asked for yet", async () => {
    speech.getPermissionsAsync.mockResolvedValue(refused);
    speech.requestPermissionsAsync.mockResolvedValue(granted);

    const { result } = await startListening();

    expect(speech.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("listening");
  });

  it("cancels gracefully and points at Settings when the shopper refuses", async () => {
    speech.getPermissionsAsync.mockResolvedValue(refused);
    speech.requestPermissionsAsync.mockResolvedValue(blocked);

    const { result } = await startListening();

    expect(result.current.state).toBe("denied");
    expect(result.current.message).toContain("Settings");
    expect(speech.start).not.toHaveBeenCalled();
  });

  it("never re-prompts once permission is blocked", async () => {
    speech.getPermissionsAsync.mockResolvedValue(blocked);

    const { result } = await startListening();

    // Requesting again is a silent no-op at OS level, so the hook must not pretend to ask.
    expect(speech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(result.current.state).toBe("denied");
  });

  it("explains an iOS content restriction rather than blaming the shopper", async () => {
    speech.getPermissionsAsync.mockResolvedValue({ ...blocked, restricted: true });

    const { result } = await startListening();

    expect(result.current.state).toBe("denied");
    expect(result.current.message).toContain("restrictions");
  });
});

describe("useVoiceSearch availability", () => {
  // The offline-model check is Android-only. replaceProperty restores cleanly; assigning to
  // Platform.OS by hand leaves React Native's internals broken for later tests.
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports unavailable when the device has no recognizer", async () => {
    speech.isRecognitionAvailable.mockReturnValue(false);

    const { result } = await startListening();

    expect(result.current.state).toBe("unavailable");
    expect(speech.start).not.toHaveBeenCalled();
  });

  it("offers a download when the language has no on-device model", async () => {
    speech.getSupportedLocales.mockResolvedValue({ locales: ["en-IN"], installedLocales: [] });

    const { result } = await startListening();

    expect(result.current.state).toBe("unavailable");
    expect(result.current.message).toContain("download");
    expect(result.current.canDownloadModel).toBe(true);

    await act(async () => {
      await result.current.downloadModel();
    });
    expect(speech.androidTriggerOfflineModelDownload).toHaveBeenCalledWith({ locale: "en-IN" });
  });

  it("still starts when the device cannot enumerate locales", async () => {
    // Android 12 and below throws here; the platform should get a chance to try anyway.
    speech.getSupportedLocales.mockRejectedValue(new Error("package_not_found"));

    const { result } = await startListening();

    expect(result.current.state).toBe("listening");
  });

  it("pins recognition to Google's on-device service when the model is installed", async () => {
    const { result } = await startListening();

    expect(result.current.state).toBe("listening");
    expect(speech.start).toHaveBeenCalledWith(
      expect.objectContaining({ androidRecognitionServicePackage: "com.google.android.as" }),
    );
  });
});

describe("useVoiceSearch recognition", () => {
  it("shows partial speech while the shopper is talking", async () => {
    const { result } = await startListening();

    await emit("result", resultEvent("red sa", false));

    expect(result.current.partial).toBe("red sa");
    expect(result.current.transcript).toBeNull();
  });

  it("delivers a cleaned transcript on the final result", async () => {
    const { result } = await startListening();

    await emit("result", resultEvent("Show me red cotton sarees", true));

    expect(result.current.transcript).toBe("red cotton sarees");
    expect(result.current.partial).toBe("");
    expect(result.current.state).toBe("idle");
  });

  it("surfaces a recognition failure", async () => {
    const { result } = await startListening();

    await emit("error", { error: "no-speech", message: "No speech detected" });

    expect(result.current.state).toBe("error");
    expect(result.current.message).toContain("try again");
  });

  it("treats our own abort as a quiet stop, not a failure", async () => {
    const { result } = await startListening();

    await emit("error", { error: "aborted", message: "aborted" });

    expect(result.current.state).toBe("idle");
    expect(result.current.message).toBeNull();
  });

  it("keeps a denial visible when the session then ends", async () => {
    speech.getPermissionsAsync.mockResolvedValue(blocked);
    const { result } = await startListening();

    await emit("end");

    expect(result.current.state).toBe("denied");
  });

  it("asks for a final result on stop rather than discarding the utterance", async () => {
    const { result } = await startListening();

    await act(async () => {
      result.current.stop();
    });

    expect(speech.stop).toHaveBeenCalledTimes(1);
    expect(speech.abort).not.toHaveBeenCalled();
  });

  it("releases the microphone when the screen unmounts mid-listen", async () => {
    const view = await startListening();

    await view.unmount();

    expect(speech.abort).toHaveBeenCalledTimes(1);
  });
});

describe("useVoiceSearch language", () => {
  it("persists the chosen language and recognises in it", async () => {
    const { result } = await startListening();

    await act(async () => {
      result.current.setLocale("hi-IN");
    });
    expect(mockSetVoiceLocale).toHaveBeenCalledWith("hi-IN");
    expect(result.current.locale).toBe("hi-IN");

    await act(async () => {
      await result.current.start();
    });
    expect(speech.start).toHaveBeenLastCalledWith(expect.objectContaining({ lang: "hi-IN" }));
  });
});
