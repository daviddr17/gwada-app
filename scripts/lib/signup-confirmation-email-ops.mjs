import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..", "..");
const webRoot = join(repoRoot, "apps/web");

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": webRoot,
  },
});

export const { rewriteAdminAuthActionLink } = jiti(
  join(webRoot, "lib/auth/rewrite-admin-auth-action-link.ts"),
);

export const { generateAdminAuthActionLink } = jiti(
  join(webRoot, "lib/auth/generate-admin-auth-action-link.ts"),
);

export const {
  buildSignupConfirmationEmailHtml,
  buildSignupConfirmationEmailText,
} = jiti(join(webRoot, "lib/email/signup-confirmation-email-html.ts"));
