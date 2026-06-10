import Constants from "expo-constants";

export function getStaffBuildProfile(): string {
  const fromExtra = Constants.expoConfig?.extra?.staffBuildProfile;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }
  return __DEV__ ? "development" : "production";
}

export function isLanPreviewBuild(): boolean {
  return getStaffBuildProfile() === "preview-lan";
}
