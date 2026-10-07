import "server-only";

import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import {
  authorizeModuleCrud,
  authorizeRestaurantModule,
} from "@/lib/permissions/authorize-restaurant-module";
import type {
  ModuleCrudOperation,
  ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

export function assistantJson(value: unknown): string {
  return JSON.stringify(value);
}

export function skipAssistantModuleAuth(ctx: AssistantToolContext): boolean {
  return ctx.callerIsSuperadmin && ctx.zone === "superadmin";
}

export async function denyUnlessModuleCrud(
  ctx: AssistantToolContext,
  restaurantId: string,
  prefix: ModuleCrudPrefix,
  operation: ModuleCrudOperation,
  error: string,
): Promise<string | null> {
  if (skipAssistantModuleAuth(ctx)) return null;
  const auth = await authorizeModuleCrud(restaurantId, prefix, operation);
  if (!auth.ok) return error;
  return null;
}

export async function denyUnlessPermission(
  ctx: AssistantToolContext,
  restaurantId: string,
  permission: RestaurantPermissionKey,
  error: string,
): Promise<string | null> {
  if (skipAssistantModuleAuth(ctx)) return null;
  const auth = await authorizeRestaurantModule(restaurantId, permission);
  if (!auth.ok) return error;
  return null;
}

/** Short change summary + explicit confirm question for the UI dialog. */
export function withConfirmQuestion(summary: string, locale = "de"): string {
  const base = summary.trim().replace(/[.?!]+\s*$/, "");
  const question = locale === "de" ? "Jetzt umsetzen?" : "Apply now?";
  return `${base}. ${question}`;
}

export function draftMutation(input: {
  action: string;
  message: string;
  preview: Record<string, unknown>;
  locale?: string;
}): string {
  return assistantJson({
    ok: true,
    status: "draft",
    action: input.action,
    message: withConfirmQuestion(input.message, input.locale ?? "de"),
    preview: input.preview,
  });
}
