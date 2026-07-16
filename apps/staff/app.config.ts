import type { ExpoConfig } from "expo/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EAS_PROJECT_ID = "d5cd3319-4636-4199-8dc4-877ccdb03665";

/** Expo Metro inlined `process.env.EXPO_PUBLIC_*` unreliably in pnpm monorepos — load `.env` here. */
function loadStaffDotEnv(): Record<string, string> {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return {};

  const out: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function escapeTsString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function writeStaffEnvModule(values: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  gwadaApiUrl: string;
}): void {
  const target = join(__dirname, "src/lib/staff-env.generated.ts");
  writeFileSync(
    target,
    `// Auto-generated — do not edit manually.
export const staffEnv = {
  supabaseUrl: '${escapeTsString(values.supabaseUrl)}',
  supabaseAnonKey: '${escapeTsString(values.supabaseAnonKey)}',
  gwadaApiUrl: '${escapeTsString(values.gwadaApiUrl)}',
} as const;
`,
  );
}

const buildProfile =
  process.env.GWADA_STAFF_BUILD_PROFILE ??
  process.env.EAS_BUILD_PROFILE ??
  "";

const dotenv = loadStaffDotEnv();

const supabaseUrl =
  dotenv.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";

const supabaseAnonKey =
  dotenv.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const gwadaApiUrl =
  dotenv.EXPO_PUBLIC_GWADA_API_URL ??
  process.env.EXPO_PUBLIC_GWADA_API_URL ??
  "http://127.0.0.1:3000";

writeStaffEnvModule({ supabaseUrl, supabaseAnonKey, gwadaApiUrl });

const config: ExpoConfig = {
  name: "Gwada Staff",
  slug: "gwada-staff",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "gwada-staff",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.gwada.staff",
    appleTeamId: "26N959J5Q3",
    buildNumber: "5",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // iPad-Kasse ↔ iPhone-Handgeräte (lokales WLAN / Bonjour)
      NSLocalNetworkUsageDescription:
        "Gwada Staff verbindet iPhone-Handgeräte mit der iPad-Kasse im lokalen WLAN.",
      NSBonjourServices: ["_gwada-pos._tcp"],
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
    },
    package: "app.gwada.staff",
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-updates",
    "expo-zeroconf",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    staffBuildProfile: buildProfile || "development",
    supabaseUrl,
    supabaseAnonKey,
    gwadaApiUrl,
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
  owner: "atfadi17",
};

export default config;
