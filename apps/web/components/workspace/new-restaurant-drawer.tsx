"use client";

import { useState } from "react";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RESTAURANT_SLUG_TAKEN_MESSAGE,
  restaurantSlugFromName,
} from "@/lib/restaurant/restaurant-slug";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { isRestaurantSlugAvailable } from "@/lib/supabase/restaurant-stammdaten-db";
import { seedRestaurantDefaultPositions } from "@/lib/supabase/restaurant-positions-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  invalidateWorkspaceRestaurantCache,
  notifyWorkspaceRestaurantChanged,
} from "@/lib/supabase/workspace-persistence";

async function pickUniqueRestaurantSlug(
  baseSlug: string,
): Promise<string | null> {
  const sb = createSupabaseBrowserClient();
  let candidate = baseSlug;
  let n = 2;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (isReservedRestaurantSlug(candidate)) {
      candidate = `${baseSlug}-${n}`;
      n += 1;
      continue;
    }
    const { available, error } = await isRestaurantSlugAvailable(sb, candidate);
    if (error) {
      console.warn("[gwada] pickUniqueRestaurantSlug", error);
      return null;
    }
    if (available) return candidate;
    candidate = `${baseSlug}-${n}`;
    n += 1;
  }
  return null;
}

export function NewRestaurantDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setSlugOverride("");
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Bitte einen Restaurantnamen eintragen.");
      return;
    }

    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      toast.error("Bitte zuerst anmelden.");
      return;
    }

    const base =
      slugOverride.trim().length > 0
        ? restaurantSlugFromName(slugOverride.trim())
        : restaurantSlugFromName(trimmedName);

    setBusy(true);
    try {
      const slug = await pickUniqueRestaurantSlug(base);
      if (!slug) {
        toast.error(RESTAURANT_SLUG_TAKEN_MESSAGE);
        return;
      }

      const { data: inserted, error: insErr } = await sb
        .from("restaurants")
        .insert({
          name: trimmedName,
          slug,
          owner_profile_id: user.id,
          timezone: "Europe/Berlin",
          country: "DE",
          is_published: true,
        })
        .select("id")
        .single();

      if (insErr || !inserted?.id) {
        console.warn(insErr);
        const msg = insErr?.message ?? "";
        toast.error(
          msg.includes("duplicate key") || msg.includes("restaurants_slug")
            ? RESTAURANT_SLUG_TAKEN_MESSAGE
            : msg || "Restaurant konnte nicht angelegt werden.",
        );
        return;
      }

      const newId = inserted.id as string;

      const { error: empErr } = await sb.from("restaurant_employees").insert({
        restaurant_id: newId,
        profile_id: user.id,
        role: "owner",
        is_active: true,
      });

      if (empErr) {
        console.warn(empErr);
        toast.error("Zuordnung zum Restaurant ist fehlgeschlagen.");
        return;
      }

      const { error: seedErr } = await seedRestaurantDefaultPositions(sb, newId);
      if (seedErr) {
        console.warn("seed_restaurant_default_positions", seedErr);
      }

      const { error: profErr } = await sb
        .from("profiles")
        .update({ active_restaurant_id: newId })
        .eq("id", user.id);

      if (profErr) {
        console.warn(profErr);
        toast.error("Aktives Restaurant konnte nicht gesetzt werden.");
        return;
      }

      void fetch(`/api/pos/fiskaly/provision?restaurantId=${encodeURIComponent(newId)}`, {
        method: "POST",
      }).catch((err) => {
        console.warn("fiskaly provision after restaurant create", err);
      });

      invalidateWorkspaceRestaurantCache();
      notifyWorkspaceRestaurantChanged();
      toast.success("Restaurant angelegt und als aktiv gesetzt.");
      reset();
      onOpenChange(false);
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Neues Restaurant</DrawerTitle>
          <DrawerDescription>
            Name und optionaler Kurzname für die URL. Du wirst als Inhaber
            eingetragen; das neue Restaurant ist sofort aktiv.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={drawerScrollAreaClassName(4)}>
            <DrawerFormSection contentPadding={4}>
              <div className="space-y-2">
                <Label htmlFor="nr-name">Restaurantname</Label>
                <Input
                  id="nr-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Lion Bistro"
                  className="h-11 rounded-xl"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr-slug">URL-Slug (optional)</Label>
                <Input
                  id="nr-slug"
                  value={slugOverride}
                  onChange={(e) => setSlugOverride(e.target.value)}
                  placeholder="Leer = aus dem Namen abgeleitet"
                  className="h-11 rounded-xl"
                  autoComplete="off"
                />
              </div>
            </DrawerFormSection>
          </div>
          <DrawerFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Wird angelegt…" : "Anlegen"}
          </Button>
        </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
