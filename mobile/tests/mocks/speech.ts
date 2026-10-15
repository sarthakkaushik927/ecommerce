/**
 * Controllable stand-in for the native speech module, so every permission and recognition branch
 * can be driven deterministically without a device.
 */

type Listener = (event: unknown) => void;

export type PermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
  expires: string;
  restricted?: boolean;
};

export const granted: PermissionResult = { granted: true, canAskAgain: true, status: "granted", expires: "never" };
/** Refused just now, but the OS would still show its dialog again. */
export const refused: PermissionResult = { granted: false, canAskAgain: true, status: "denied", expires: "never" };
/** Refused for good: requesting again is a silent no-op on both platforms. */
export const blocked: PermissionResult = { granted: false, canAskAgain: false, status: "denied", expires: "never" };

const handlers: Record<string, Listener | undefined> = {};

export const ExpoSpeechRecognitionModule = {
  getPermissionsAsync: jest.fn<Promise<PermissionResult>, []>(),
  requestPermissionsAsync: jest.fn<Promise<PermissionResult>, []>(),
  isRecognitionAvailable: jest.fn<boolean, []>(),
  getSupportedLocales: jest.fn<Promise<{ locales: string[]; installedLocales: string[] }>, [unknown]>(),
  androidTriggerOfflineModelDownload: jest.fn<Promise<{ status: string; message: string }>, [unknown]>(),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};

/** Mirrors the real hook: the latest render's closure becomes the live listener. */
export function useSpeechRecognitionEvent(name: string, listener: Listener) {
  handlers[name] = listener;
}

export function emitSpeech(name: string, payload?: unknown) {
  handlers[name]?.(payload);
}

export function resetSpeechMock() {
  for (const key of Object.keys(handlers)) delete handlers[key];
  ExpoSpeechRecognitionModule.getPermissionsAsync.mockReset().mockResolvedValue(granted);
  ExpoSpeechRecognitionModule.requestPermissionsAsync.mockReset().mockResolvedValue(granted);
  ExpoSpeechRecognitionModule.isRecognitionAvailable.mockReset().mockReturnValue(true);
  ExpoSpeechRecognitionModule.getSupportedLocales
    .mockReset()
    .mockResolvedValue({ locales: ["en-IN", "hi-IN"], installedLocales: ["en-IN", "hi-IN"] });
  ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload
    .mockReset()
    .mockResolvedValue({ status: "download_success", message: "ok" });
  ExpoSpeechRecognitionModule.start.mockReset();
  ExpoSpeechRecognitionModule.stop.mockReset();
  ExpoSpeechRecognitionModule.abort.mockReset();
}

/** Shapes a final or partial `result` event the way the native module emits it. */
export function resultEvent(transcript: string, isFinal: boolean) {
  return { isFinal, results: [{ transcript, confidence: 0.9, segments: [] }] };
}
