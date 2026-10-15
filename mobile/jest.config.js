/** @type {import("jest").Config} */
module.exports = {
  // The platform-specific presets (jest-expo/android) rebuild `transform` in a way that leaves
  // Flow types in @react-native/jest-preset unstripped, so stay on the base preset and let the
  // one platform-dependent test set Platform.OS itself.
  preset: "jest-expo",
  // Tests live outside src/ so expo-router never mistakes a test file for a route.
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  // Mirrors the "@/*" -> "./src/*" paths entry in tsconfig.json.
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
