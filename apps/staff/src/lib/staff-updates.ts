import * as Updates from "expo-updates";

/** Beim App-Start: OTA-Bundle laden und neu starten (nur Release-Builds mit expo-updates). */
export async function checkForStaffUpdatesOnLaunch(): Promise<void> {
  if (__DEV__) return;
  if (!Updates.isEnabled) return;

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch (error) {
    console.warn(
      "[staff] OTA update check failed",
      error instanceof Error ? error.message : error,
    );
  }
}
