"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { DisplayRoundAvatar } from "@/components/display/display-round-avatar";
import { displayPersonInitials } from "@/lib/display/display-avatar-utils";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import type { DisplayStaffProfilePayload } from "@/lib/display/display-profile-types";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  type StaffProfileChangeDiffItem,
  type StaffProfileChangeFields,
  emptyStaffProfileChangeFields,
} from "@/lib/staff/staff-profile-change-request-types";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { staffDisplayName } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

type PendingRequest = {
  id: string;
  proposed_fields: StaffProfileChangeFields;
  created_at: string;
  diff: StaffProfileChangeDiffItem[];
};

type Resolution = {
  id: string;
  status: "approved" | "declined";
  review_note: string | null;
  reviewed_at: string | null;
};

type FormState = {
  given_name: string;
  family_name: string;
  birth_date: string;
  nationality: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
};

function profileToForm(profile: DisplayStaffProfilePayload): FormState {
  return {
    given_name: profile.given_name ?? "",
    family_name: profile.family_name ?? "",
    birth_date: profile.birth_date ?? "",
    nationality: profile.nationality ?? "",
    address_line1: profile.address_line1 ?? "",
    address_line2: profile.address_line2 ?? "",
    postal_code: profile.postal_code ?? "",
    city: profile.city ?? "",
    country: profile.country?.trim() || "DE",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
  };
}

function proposedToForm(fields: StaffProfileChangeFields): FormState {
  return {
    given_name: fields.given_name ?? "",
    family_name: fields.family_name ?? "",
    birth_date: fields.birth_date ?? "",
    nationality: fields.nationality ?? "",
    address_line1: fields.address_line1 ?? "",
    address_line2: fields.address_line2 ?? "",
    postal_code: fields.postal_code ?? "",
    city: fields.city ?? "",
    country: fields.country?.trim() || "DE",
    email: fields.email ?? "",
    phone: fields.phone ?? "",
  };
}

function formToFields(form: FormState): StaffProfileChangeFields {
  const out = emptyStaffProfileChangeFields();
  out.given_name = form.given_name.trim() || null;
  out.family_name = form.family_name.trim() || null;
  out.birth_date = form.birth_date.trim() || null;
  out.nationality = form.nationality.trim() || null;
  out.address_line1 = form.address_line1.trim() || null;
  out.address_line2 = form.address_line2.trim() || null;
  out.postal_code = form.postal_code.trim() || null;
  out.city = form.city.trim() || null;
  out.country = form.country.trim() || "DE";
  out.email = form.email.trim() || null;
  out.phone = form.phone.trim() || null;
  return out;
}

function StammdatenSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <SkeletonCardFrame className="flex items-center gap-4 p-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-48 max-w-full rounded-md" />
          <Skeleton className="h-4 w-32 max-w-full rounded-md" />
        </div>
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-4 p-4">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-5/6 rounded-md" />
      </SkeletonCardFrame>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

const inputClassName = "h-11 rounded-xl";

export function DisplayProfileStammdatenPanel() {
  const [profile, setProfile] = useState<DisplayStaffProfilePayload | null>(
    null,
  );
  const [form, setForm] = useState<FormState | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, requestRes] = await Promise.all([
        fetch("/api/display/profile", { credentials: "include" }),
        fetch("/api/display/profile/change-request", { credentials: "include" }),
      ]);

      const profileJson = (await profileRes.json()) as {
        profile?: DisplayStaffProfilePayload;
        error?: string;
      };
      if (!profileRes.ok) {
        toast.error(profileJson.error ?? "Profil konnte nicht geladen werden");
        setProfile(null);
        setForm(null);
        return;
      }

      const nextProfile = profileJson.profile ?? null;
      setProfile(nextProfile);

      const requestJson = (await requestRes.json()) as {
        pending_request?: PendingRequest | null;
        unacknowledged_resolutions?: Resolution[];
        error?: string;
      };

      if (requestRes.ok) {
        const resolutions = requestJson.unacknowledged_resolutions ?? [];
        if (resolutions.length > 0) {
          for (const row of resolutions) {
            if (row.status === "approved") {
              toast.success("Profiländerung übernommen.");
            } else {
              toast.error(
                row.review_note?.trim()
                  ? `Profiländerung abgelehnt: ${row.review_note.trim()}`
                  : "Profiländerung abgelehnt.",
              );
            }
          }
          void fetch("/api/display/profile/change-request", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request_ids: resolutions.map((r) => r.id),
            }),
          });
        }

        const pendingReq = requestJson.pending_request ?? null;
        setPending(pendingReq);
        if (pendingReq) {
          setForm(proposedToForm(pendingReq.proposed_fields));
        } else if (nextProfile) {
          setForm(profileToForm(nextProfile));
        }
      } else if (nextProfile) {
        setPending(null);
        setForm(profileToForm(nextProfile));
      }
    } catch {
      toast.error("Profil konnte nicht geladen werden");
      setProfile(null);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = async () => {
    if (!form || pending) return;
    if (!form.given_name.trim() || !form.family_name.trim()) {
      toast.error("Vor- und Nachname sind erforderlich.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/display/profile/change-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: formToFields(form) }),
      });
      const json = (await res.json()) as {
        error?: string;
        request?: PendingRequest;
      };
      if (!res.ok) {
        const msg =
          json.error === "no_changes"
            ? "Keine Änderungen zum Einreichen."
            : json.error === "already_pending"
              ? "Es liegt bereits eine offene Anfrage vor."
              : json.error === "name_required"
                ? "Vor- und Nachname sind erforderlich."
                : json.error === "invalid_email"
                  ? "E-Mail ist ungültig."
                  : json.error === "invalid_birth_date"
                    ? "Geburtsdatum ist ungültig."
                    : "Anfrage konnte nicht gesendet werden.";
        toast.error(msg);
        return;
      }
      toast.success("Änderungsanfrage gesendet — wartet auf Freigabe.");
      setPending(json.request ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && showSkeleton) return <StammdatenSkeleton />;
  if (loading) return <div className="min-h-[12rem]" aria-busy="true" />;
  if (!profile || !form) {
    return (
      <p className="rounded-xl border border-border/50 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
        Profildaten konnten nicht geladen werden.
      </p>
    );
  }

  const name = staffDisplayName(profile);
  const locked = pending != null || submitting;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-card">
        <DisplayRoundAvatar
          src={profile.avatar_url}
          initials={displayPersonInitials(
            form.given_name || profile.given_name,
            form.family_name || profile.family_name,
          )}
          alt={name}
          size="lg"
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">
            {[form.given_name, form.family_name].filter(Boolean).join(" ") ||
              name}
          </p>
          {profile.position_name ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {profile.position_name}
            </p>
          ) : null}
        </div>
      </div>

      {pending ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-sm font-medium">Änderung wartet auf Freigabe</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dein Admin prüft die Anfrage. Bis dahin bleiben die aktuellen Daten
            gültig.
          </p>
          {pending.diff.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {pending.diff.map((item) => (
                <li key={item.key} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {item.label}:
                  </span>{" "}
                  {item.fromLabel} → {item.toLabel}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-card sm:grid-cols-2">
        <Field label="Vorname">
          <Input
            value={form.given_name}
            onChange={(e) => setField("given_name", e.target.value)}
            disabled={locked}
            required
            className={inputClassName}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Nachname">
          <Input
            value={form.family_name}
            onChange={(e) => setField("family_name", e.target.value)}
            disabled={locked}
            required
            className={inputClassName}
            autoComplete="family-name"
          />
        </Field>
        <Field label="E-Mail">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            disabled={locked}
            className={inputClassName}
            autoComplete="email"
          />
        </Field>
        <Field label="Telefon">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            disabled={locked}
            className={inputClassName}
            autoComplete="tel"
          />
        </Field>
        <Field label="Geburtsdatum">
          <DatePickerField
            value={form.birth_date || null}
            onChange={(v) => setField("birth_date", v ?? "")}
            fallbackMonth={new Date(1990, 0)}
            fullWidth
            disabled={locked}
            className="!h-11 w-full"
          />
        </Field>
        <Field label="Nationalität">
          <Input
            value={form.nationality}
            onChange={(e) => setField("nationality", e.target.value)}
            disabled={locked}
            className={inputClassName}
          />
        </Field>
        <Field label="Straße" className="sm:col-span-2">
          <Input
            value={form.address_line1}
            onChange={(e) => setField("address_line1", e.target.value)}
            disabled={locked}
            placeholder="Straße und Hausnummer"
            className={inputClassName}
            autoComplete="address-line1"
          />
        </Field>
        <Field label="Adresszusatz" className="sm:col-span-2">
          <Input
            value={form.address_line2}
            onChange={(e) => setField("address_line2", e.target.value)}
            disabled={locked}
            className={inputClassName}
            autoComplete="address-line2"
          />
        </Field>
        <Field label="PLZ">
          <Input
            value={form.postal_code}
            onChange={(e) => setField("postal_code", e.target.value)}
            disabled={locked}
            className={inputClassName}
            autoComplete="postal-code"
          />
        </Field>
        <Field label="Ort">
          <Input
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
            disabled={locked}
            className={inputClassName}
            autoComplete="address-level2"
          />
        </Field>
        <Field label="Land" className="sm:col-span-2">
          <Input
            value={form.country}
            onChange={(e) => setField("country", e.target.value)}
            disabled={locked}
            className={inputClassName}
            autoComplete="country"
            maxLength={2}
          />
        </Field>
      </div>

      {!pending ? (
        <Button
          type="button"
          size="lg"
          disabled={submitting}
          className={cn("w-full", brandActionButtonRoundedClassName)}
          onClick={() => void submit()}
        >
          <Send className="size-4" />
          {submitting ? "Wird gesendet…" : "Änderungen zur Freigabe senden"}
        </Button>
      ) : null}
    </div>
  );
}
