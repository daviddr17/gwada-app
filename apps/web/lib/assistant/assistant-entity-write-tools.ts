import "server-only";

import { assistantAsk, assistantAskWhich } from "@/lib/assistant/assistant-ask";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import {
  assistantJson,
  denyUnlessModuleCrud,
  draftMutation,
} from "@/lib/assistant/assistant-tool-auth";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppLocale } from "@/i18n/config";
import type { SupabaseClient } from "@supabase/supabase-js";

type RecipeArg = { ingredient: string; amount: number };

function parseRecipeArgs(raw: unknown): RecipeArg[] | { ask: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    return { ask: "Rezept bitte als Liste [{ingredient, amount}] angeben." };
  }
  const out: RecipeArg[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const ingredient = String(
      row.ingredient ?? row.name ?? row.ingredient_name ?? "",
    ).trim();
    const amount = Number(row.amount ?? row.qty ?? row.quantity);
    if (!ingredient || !Number.isFinite(amount) || amount <= 0) {
      return {
        ask: "Jede Rezeptzeile braucht Zutat und Menge (amount > 0).",
      };
    }
    out.push({ ingredient, amount });
  }
  return out;
}

async function resolveIngredientIds(
  sb: SupabaseClient,
  restaurantId: string,
  recipe: RecipeArg[],
  locale: AppLocale,
): Promise<
  | { ok: true; lines: Array<{ ingredient_id: string; name: string; amount: number }> }
  | { ok: false; ask?: string; error?: string }
> {
  const lines: Array<{ ingredient_id: string; name: string; amount: number }> =
    [];
  for (const line of recipe) {
    const q = line.ingredient.replace(/[%_,]/g, "");
    const { data, error } = await sb
      .from("inventory_ingredients")
      .select("id, name, unit")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(6);
    if (error) return { ok: false, error: error.message };
    const rows = data ?? [];
    if (rows.length === 0) {
      return {
        ok: false,
        ask:
          locale === "de"
            ? `Welche Zutat meinst du mit „${line.ingredient}“?`
            : `Which ingredient is “${line.ingredient}”?`,
      };
    }
    if (rows.length > 1) {
      return {
        ok: false,
        ask: assistantAskWhich(
          locale,
          "which",
          rows.map((r) => String(r.name)),
        ),
      };
    }
    lines.push({
      ingredient_id: rows[0]!.id as string,
      name: String(rows[0]!.name),
      amount: line.amount,
    });
  }
  return { ok: true, lines };
}

async function resolveCategoryId(
  sb: SupabaseClient,
  restaurantId: string,
  categoryName: string,
  locale: AppLocale,
): Promise<
  | { ok: true; id: string; name: string }
  | { ok: false; ask?: string; error?: string }
> {
  const q = categoryName.replace(/[%_,]/g, "").trim();
  if (!q) {
    return {
      ok: false,
      ask:
        locale === "de"
          ? "In welche Kategorie soll das Gericht?"
          : "Which menu category?",
    };
  }
  const { data, error } = await sb
    .from("menu_categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .ilike("name", `%${q}%`)
    .limit(6);
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      ask:
        locale === "de"
          ? `Keine Kategorie für „${categoryName}“. Welche Kategorie?`
          : `No category for “${categoryName}”. Which category?`,
    };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        rows.map((r) => String(r.name)),
      ),
    };
  }
  return { ok: true, id: rows[0]!.id as string, name: String(rows[0]!.name) };
}

async function replaceRecipeLines(
  sb: SupabaseClient,
  menuItemId: string,
  lines: Array<{ ingredient_id: string; amount: number }>,
): Promise<string | null> {
  const { error: delErr } = await sb
    .from("menu_item_recipe_lines")
    .delete()
    .eq("menu_item_id", menuItemId);
  if (delErr) return delErr.message;
  if (!lines.length) return null;
  const { error: insErr } = await sb.from("menu_item_recipe_lines").insert(
    lines.map((line, i) => ({
      menu_item_id: menuItemId,
      ingredient_id: line.ingredient_id,
      amount: line.amount,
      sort_order: i,
    })),
  );
  return insErr?.message ?? null;
}

/**
 * Create or update a dish, optionally with recipe lines from inventory ingredients.
 * Always drafts first (confirm=false); confirm route applies with confirm=true.
 */
export async function toolUpsertMenuItem(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }

  const mode = String(args.mode ?? "create").toLowerCase();
  const isUpdate = mode === "update" || mode === "edit" || Boolean(args.menu_item_id);
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "menu",
    isUpdate ? "update" : "create",
    isUpdate
      ? "Keine Berechtigung, Gerichte zu ändern."
      : "Keine Berechtigung, Gerichte anzulegen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const name = String(args.name ?? "").trim();
  if (!name) return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });

  const recipeProvided =
    args.recipe != null ||
    args.recipe_lines != null ||
    args.replace_recipe === true;
  const recipeParsed = parseRecipeArgs(args.recipe ?? args.recipe_lines);
  if ("ask" in recipeParsed) {
    return assistantJson({ ok: false, ask: recipeParsed.ask });
  }

  let menuItemId =
    typeof args.menu_item_id === "string" ? args.menu_item_id.trim() : "";
  let existingName = name;
  let existingCategoryId: string | null = null;
  let existingDescription = "";
  let existingPrice = 0;
  let existingActive = true;

  if (isUpdate) {
    if (!menuItemId) {
      const q = name.replace(/[%_,]/g, "");
      const { data, error } = await target.sb
        .from("menu_items")
        .select("id, name, description, price, is_active, category_id")
        .eq("restaurant_id", target.restaurantId)
        .ilike("name", `%${q}%`)
        .limit(6);
      if (error) return assistantJson({ ok: false, error: error.message });
      const rows = data ?? [];
      if (rows.length === 0) {
        return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
      }
      if (rows.length > 1) {
        return assistantJson({
          ok: false,
          ask: assistantAskWhich(
            locale,
            "which",
            rows.map((r) => String(r.name)),
          ),
        });
      }
      menuItemId = rows[0]!.id as string;
      existingName = String(rows[0]!.name);
      existingDescription = String(rows[0]!.description ?? "");
      existingPrice = Number(rows[0]!.price) || 0;
      existingActive = rows[0]!.is_active !== false;
      existingCategoryId =
        typeof rows[0]!.category_id === "string" ? rows[0]!.category_id : null;
    } else {
      const { data, error } = await target.sb
        .from("menu_items")
        .select("id, name, description, price, is_active, category_id")
        .eq("restaurant_id", target.restaurantId)
        .eq("id", menuItemId)
        .maybeSingle();
      if (error) return assistantJson({ ok: false, error: error.message });
      if (!data) {
        return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
      }
      existingName = String(data.name);
      existingDescription = String(data.description ?? "");
      existingPrice = Number(data.price) || 0;
      existingActive = data.is_active !== false;
      existingCategoryId =
        typeof data.category_id === "string" ? data.category_id : null;
    }
  }

  const nextName =
    typeof args.new_name === "string" && args.new_name.trim()
      ? args.new_name.trim()
      : isUpdate
        ? existingName
        : name;
  const description =
    args.description == null
      ? isUpdate
        ? existingDescription
        : ""
      : String(args.description);
  const priceRaw = args.price ?? args.price_eur;
  const price =
    priceRaw == null
      ? isUpdate
        ? existingPrice
        : NaN
      : Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welcher Preis?" : "What price?",
    });
  }

  let categoryId = existingCategoryId;
  let categoryName: string | null = null;
  const categoryArg = String(args.category ?? args.category_name ?? "").trim();
  if (categoryArg || !isUpdate) {
    const cat = await resolveCategoryId(
      target.sb,
      target.restaurantId,
      categoryArg || String(args.category ?? ""),
      locale,
    );
    if (!cat.ok) {
      return assistantJson({ ok: false, ask: cat.ask, error: cat.error });
    }
    categoryId = cat.id;
    categoryName = cat.name;
  } else if (categoryId) {
    const { data: catRow } = await target.sb
      .from("menu_categories")
      .select("name")
      .eq("id", categoryId)
      .maybeSingle();
    categoryName = typeof catRow?.name === "string" ? catRow.name : null;
  }

  if (!categoryId) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "In welche Kategorie soll das Gericht?"
          : "Which menu category?",
    });
  }

  const active =
    args.active == null
      ? existingActive
      : args.active === true ||
        String(args.active).toLowerCase() === "true" ||
        String(args.status ?? "").toLowerCase() === "active";

  let recipeLines: Array<{
    ingredient_id: string;
    name: string;
    amount: number;
  }> = [];
  if (recipeProvided && recipeParsed.length) {
    const resolved = await resolveIngredientIds(
      target.sb,
      target.restaurantId,
      recipeParsed,
      locale,
    );
    if (!resolved.ok) {
      return assistantJson({
        ok: false,
        ask: resolved.ask,
        error: resolved.error,
      });
    }
    recipeLines = resolved.lines;
  } else if (isUpdate && args.replace_recipe === true) {
    recipeLines = [];
  } else if (isUpdate) {
    // Keep existing recipe unless explicitly provided — only for draft summary.
    const { data: existingRecipe } = await target.sb
      .from("menu_item_recipe_lines")
      .select("ingredient_id, amount")
      .eq("menu_item_id", menuItemId)
      .order("sort_order", { ascending: true });
    const ingIds = [
      ...new Set(
        (existingRecipe ?? [])
          .map((row) => row.ingredient_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];
    const nameById = new Map<string, string>();
    if (ingIds.length) {
      const { data: ings } = await target.sb
        .from("inventory_ingredients")
        .select("id, name")
        .eq("restaurant_id", target.restaurantId)
        .in("id", ingIds);
      for (const ing of ings ?? []) {
        nameById.set(ing.id as string, String(ing.name));
      }
    }
    recipeLines = (existingRecipe ?? []).map((row) => ({
      ingredient_id: row.ingredient_id as string,
      name: nameById.get(row.ingredient_id as string) ?? "?",
      amount: Number(row.amount) || 0,
    }));
  }

  const preview = {
    mode: isUpdate ? "update" : "create",
    menu_item_id: menuItemId || null,
    name: nextName,
    description,
    price,
    category_id: categoryId,
    category_name: categoryName,
    active,
    replace_recipe: recipeProvided,
    recipe: recipeLines.map((l) => ({
      ingredient_id: l.ingredient_id,
      ingredient: l.name,
      amount: l.amount,
    })),
  };

  if (!args.confirm) {
    const recipeLabel = !recipeProvided
      ? locale === "de"
        ? "ohne Rezeptänderung"
        : "no recipe change"
      : preview.recipe.length
        ? preview.recipe.map((r) => `${r.amount}× ${r.ingredient}`).join(", ")
        : locale === "de"
          ? "Rezept leeren"
          : "clear recipe";
    return draftMutation({
      action: "upsert_menu_item",
      locale,
      message:
        locale === "de"
          ? `${isUpdate ? "Gericht ändern" : "Gericht anlegen"}: ${nextName}, ${price.toFixed(2)} €, Kategorie ${categoryName ?? "?"}, Rezept: ${recipeLabel}`
          : `${isUpdate ? "Update dish" : "Create dish"}: ${nextName}, ${price.toFixed(2)} EUR, category ${categoryName ?? "?"}, recipe: ${recipeLabel}`,
      preview,
    });
  }

  if (isUpdate) {
    const { error: upErr } = await target.sb
      .from("menu_items")
      .update({
        name: nextName,
        description,
        price,
        category_id: categoryId,
        is_active: active,
      })
      .eq("id", menuItemId)
      .eq("restaurant_id", target.restaurantId);
    if (upErr) return assistantJson({ ok: false, error: upErr.message });
    if (preview.replace_recipe) {
      const recipeErr = await replaceRecipeLines(
        target.sb,
        menuItemId,
        recipeLines.map((l) => ({
          ingredient_id: l.ingredient_id,
          amount: l.amount,
        })),
      );
      if (recipeErr) return assistantJson({ ok: false, error: recipeErr });
    }
    return assistantJson({
      ok: true,
      status: "saved",
      menu_item_id: menuItemId,
      message:
        locale === "de"
          ? `Gericht „${nextName}“ aktualisiert.`
          : `Dish “${nextName}” updated.`,
    });
  }

  const newId = crypto.randomUUID();
  const { error: insErr } = await target.sb.from("menu_items").insert({
    id: newId,
    restaurant_id: target.restaurantId,
    category_id: categoryId,
    name: nextName,
    description,
    price,
    image_url: "",
    is_active: active,
    list_number: null,
  });
  if (insErr) return assistantJson({ ok: false, error: insErr.message });
  if (recipeLines.length) {
    const recipeErr = await replaceRecipeLines(
      target.sb,
      newId,
      recipeLines.map((l) => ({
        ingredient_id: l.ingredient_id,
        amount: l.amount,
      })),
    );
    if (recipeErr) {
      await target.sb
        .from("menu_items")
        .delete()
        .eq("id", newId)
        .eq("restaurant_id", target.restaurantId);
      return assistantJson({ ok: false, error: recipeErr });
    }
  }
  return assistantJson({
    ok: true,
    status: "saved",
    menu_item_id: newId,
    message:
      locale === "de"
        ? `Gericht „${nextName}“ angelegt.`
        : `Dish “${nextName}” created.`,
  });
}

export async function applyUpsertMenuItemPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const replaceRecipe = preview.replace_recipe === true;
  return toolUpsertMenuItem(
    ctx,
    {
      mode: preview.mode,
      menu_item_id: preview.menu_item_id,
      name: preview.name,
      new_name: preview.name,
      description: preview.description,
      price: preview.price,
      category: preview.category_name,
      active: preview.active,
      replace_recipe: replaceRecipe,
      recipe: replaceRecipe
        ? Array.isArray(preview.recipe)
          ? preview.recipe.map((row) => {
              const r = row as Record<string, unknown>;
              return {
                ingredient: r.ingredient,
                amount: r.amount,
              };
            })
          : []
        : undefined,
      confirm: true,
    },
    locale,
  );
}

export async function toolUpdateStaff(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "staff",
    "update",
    "Keine Berechtigung, Mitarbeiter zu ändern.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const name = String(args.name ?? args.staff_name ?? "").trim();
  const staffIdArg =
    typeof args.staff_id === "string" ? args.staff_id.trim() : "";
  if (!name && !staffIdArg) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welchen Mitarbeiter meinst du?"
          : "Which staff member?",
    });
  }

  let staffId = staffIdArg;
  let label = name;
  if (!staffId) {
    const q = name.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("restaurant_staff")
      .select("id, given_name, family_name, email, phone, is_active")
      .eq("restaurant_id", target.restaurantId)
      .or(`given_name.ilike.%${q}%,family_name.ilike.%${q}%`)
      .limit(6);
    if (error) return assistantJson({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length === 0) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "Welchen Mitarbeiter meinst du?"
            : "Which staff member?",
      });
    }
    if (rows.length > 1) {
      return assistantJson({
        ok: false,
        ask: assistantAskWhich(
          locale,
          "which",
          rows.map((r) =>
            `${r.given_name ?? ""} ${r.family_name ?? ""}`.trim(),
          ),
        ),
      });
    }
    staffId = rows[0]!.id as string;
    label = `${rows[0]!.given_name ?? ""} ${rows[0]!.family_name ?? ""}`.trim();
  }

  const { data: current, error: curErr } = await target.sb
    .from("restaurant_staff")
    .select(
      "id, given_name, family_name, email, phone, is_active, birth_date, city, postal_code, address_line1",
    )
    .eq("restaurant_id", target.restaurantId)
    .eq("id", staffId)
    .maybeSingle();
  if (curErr) return assistantJson({ ok: false, error: curErr.message });
  if (!current) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welchen Mitarbeiter meinst du?"
          : "Which staff member?",
    });
  }
  label = `${current.given_name ?? ""} ${current.family_name ?? ""}`.trim();

  const patch: Record<string, unknown> = {};
  const changes: string[] = [];
  const setStr = (key: string, labelDe: string, raw: unknown) => {
    if (raw == null) return;
    const value = String(raw).trim();
    if (!value && key !== "email" && key !== "phone") return;
    const prev = current[key as keyof typeof current];
    if (String(prev ?? "") === value) return;
    patch[key] = value || null;
    changes.push(`${labelDe}: ${prev ?? "—"} → ${value || "—"}`);
  };
  if (args.given_name != null) setStr("given_name", "Vorname", args.given_name);
  if (args.family_name != null)
    setStr("family_name", "Nachname", args.family_name);
  if (args.email != null) setStr("email", "E-Mail", args.email);
  if (args.phone != null) setStr("phone", "Telefon", args.phone);
  if (args.city != null) setStr("city", "Ort", args.city);
  if (args.postal_code != null)
    setStr("postal_code", "PLZ", args.postal_code);
  if (args.address_line1 != null)
    setStr("address_line1", "Adresse", args.address_line1);
  if (args.birth_date != null) setStr("birth_date", "Geburtsdatum", args.birth_date);
  if (args.is_active != null || args.active != null) {
    const nextActive =
      args.is_active === true ||
      args.active === true ||
      String(args.is_active ?? args.active).toLowerCase() === "true" ||
      String(args.status ?? "").toLowerCase() === "active";
    if (Boolean(current.is_active) !== nextActive) {
      patch.is_active = nextActive;
      changes.push(
        locale === "de"
          ? `Aktiv: ${current.is_active ? "ja" : "nein"} → ${nextActive ? "ja" : "nein"}`
          : `Active: ${current.is_active} → ${nextActive}`,
      );
    }
  }

  if (!Object.keys(patch).length) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welche Felder soll ich beim Mitarbeiter ändern?"
          : "Which staff fields should I change?",
    });
  }

  const preview = {
    staff_id: staffId,
    name: label,
    patch,
    changes,
  };
  if (!args.confirm) {
    return draftMutation({
      action: "update_staff",
      locale,
      message:
        locale === "de"
          ? `Mitarbeiter ${label} ändern — ${changes.join("; ")}`
          : `Update staff ${label} — ${changes.join("; ")}`,
      preview,
    });
  }

  const { error: upErr } = await target.sb
    .from("restaurant_staff")
    .update(patch)
    .eq("id", staffId)
    .eq("restaurant_id", target.restaurantId);
  if (upErr) return assistantJson({ ok: false, error: upErr.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Mitarbeiter ${label} aktualisiert.`
        : `Staff ${label} updated.`,
  });
}

export async function applyUpdateStaffPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const patch =
    preview.patch && typeof preview.patch === "object"
      ? (preview.patch as Record<string, unknown>)
      : {};
  return toolUpdateStaff(
    ctx,
    {
      staff_id: preview.staff_id,
      name: preview.name,
      ...patch,
      confirm: true,
    },
    locale,
  );
}

export async function toolSendContactMessage(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "contacts",
    "read",
    "Keine Berechtigung, Nachrichten zu senden.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const { data: isStaff } = await target.sb.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: target.restaurantId,
  });
  if (!isStaff && !(ctx.callerIsSuperadmin && ctx.zone === "superadmin")) {
    return assistantJson({
      ok: false,
      error: "Keine Berechtigung, Nachrichten zu senden.",
    });
  }

  const body = String(args.body ?? args.message ?? args.text ?? "").trim();
  if (!body) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welchen Text soll ich senden?"
          : "What message should I send?",
    });
  }
  if (body.length > 4000) {
    return assistantJson({
      ok: false,
      error: locale === "de" ? "Nachricht zu lang." : "Message too long.",
    });
  }

  const contactName = String(args.contact_name ?? args.name ?? "").trim();
  const contactIdArg =
    typeof args.contact_id === "string" ? args.contact_id.trim() : "";
  let contactId = contactIdArg;
  let label = contactName;

  if (!contactId) {
    if (!contactName) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "An welchen Kontakt soll ich schreiben?"
            : "Which contact should I message?",
      });
    }
    const q = contactName.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("contacts")
      .select("id, first_name, last_name, company")
      .eq("restaurant_id", target.restaurantId)
      .or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`,
      )
      .limit(6);
    if (error) return assistantJson({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length === 0) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "An welchen Kontakt soll ich schreiben?"
            : "Which contact should I message?",
      });
    }
    if (rows.length > 1) {
      return assistantJson({
        ok: false,
        ask: assistantAskWhich(
          locale,
          "which",
          rows.map(
            (r) =>
              [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
              String(r.company ?? "?"),
          ),
        ),
      });
    }
    contactId = rows[0]!.id as string;
    label =
      [rows[0]!.first_name, rows[0]!.last_name].filter(Boolean).join(" ").trim() ||
      String(rows[0]!.company ?? contactName);
  }

  const channelRaw = String(args.channel ?? args.channels ?? "whatsapp")
    .trim()
    .toLowerCase();
  const channel =
    channelRaw === "email" || channelRaw === "mail"
      ? "email"
      : channelRaw === "gwada" || channelRaw === "app"
        ? "gwada"
        : channelRaw === "facebook"
          ? "facebook"
          : channelRaw === "instagram"
            ? "instagram"
            : "whatsapp";

  const preview = {
    contact_id: contactId,
    contact_name: label,
    channel,
    body,
    restaurant_name: target.restaurantName,
  };

  if (!args.confirm) {
    const snippet = body.length > 120 ? `${body.slice(0, 117)}…` : body;
    return draftMutation({
      action: "send_contact_message",
      locale,
      message:
        locale === "de"
          ? `Nachricht an ${label} über ${channel}: „${snippet}“`
          : `Message to ${label} via ${channel}: “${snippet}”`,
      preview,
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return assistantJson({ ok: false, error: "server_misconfigured" });
  }

  const result = await sendContactMessageServer(admin, {
    restaurantId: target.restaurantId,
    contactId,
    body,
    direction: "outbound",
    channels: [channel],
    sentBy: ctx.userId,
    restaurantName: target.restaurantName,
  });
  if (!result.ok) {
    return assistantJson({
      ok: false,
      error: result.errors.join("; ") || "send_failed",
    });
  }
  return assistantJson({
    ok: true,
    status: "saved",
    message_id: result.messageId ?? null,
    message:
      locale === "de"
        ? `Nachricht an ${label} gesendet (${channel}).`
        : `Message sent to ${label} (${channel}).`,
  });
}

export async function applySendContactMessagePreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolSendContactMessage(
    ctx,
    {
      contact_id: preview.contact_id,
      contact_name: preview.contact_name,
      channel: preview.channel,
      body: preview.body,
      confirm: true,
    },
    locale,
  );
}
