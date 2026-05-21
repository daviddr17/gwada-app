import { buildGwadaPublicEnvForScript } from "@/lib/public-env";

/** Injiziert öffentliche Env zur Laufzeit (Coolify: Keys oft nicht im Client-Bundle). */
export function GwadaPublicEnvScript() {
  const payload = buildGwadaPublicEnvForScript();
  if (!payload.supabaseAnonKey?.trim()) return null;

  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__GWADA_PUBLIC_ENV__=${json};`,
      }}
    />
  );
}
