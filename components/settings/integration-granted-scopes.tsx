"use client";

import { Check, Circle } from "lucide-react";
import {
  catalogForProvider,
  isScopeEntryGranted,
  scopeLabel,
  type IntegrationScopeMeta,
} from "@/lib/constants/integration-oauth-scopes";
import { cn } from "@/lib/utils";

function ScopeRow({
  scope,
  granted,
  pending,
  showTechnicalId,
}: {
  scope: IntegrationScopeMeta;
  granted: boolean;
  pending: boolean;
  showTechnicalId: boolean;
}) {
  return (
    <li
      className={cn(
        "flex gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
        pending
          ? "border-border/30 bg-muted/10 opacity-60"
          : granted
            ? "border-border/40 bg-muted/15"
            : "border-border/40 bg-muted/15",
      )}
    >
      {granted ? (
        <Check
          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
      ) : (
        <Circle
          className={cn(
            "mt-0.5 size-4 shrink-0",
            pending ? "text-muted-foreground/35" : "text-muted-foreground/50",
          )}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium leading-snug",
            pending && "text-muted-foreground",
          )}
        >
          {scope.label}
        </p>
        {scope.plannedUse ? (
          <p
            className={cn(
              "text-xs",
              pending ? "text-muted-foreground/70" : "text-muted-foreground",
            )}
          >
            {scope.plannedUse}
          </p>
        ) : null}
        {showTechnicalId && !scope.previewOnly ? (
          <p className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground/80">
            {scope.oauthScopeId ?? scope.id}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Zeigt geplante oder erteilte OAuth-Berechtigungen. */
export function IntegrationGrantedScopes({
  provider,
  requestedScopes,
  grantedScopes,
  variant = "active",
  className,
}: {
  provider: "facebook" | "instagram" | "google_business";
  requestedScopes: string[];
  grantedScopes: string[];
  /** `preview`: alles ausgegraut (noch nicht verbunden). `active`: nach Verbindung. */
  variant?: "preview" | "active";
  className?: string;
}) {
  const catalog = catalogForProvider(provider);
  const grantedOAuthIds = new Set(grantedScopes);
  const requestedOAuthIds = new Set(requestedScopes);
  const providerKind = provider === "google_business" ? "google" : "meta";
  const isPreview = variant === "preview";

  const extraGranted = grantedScopes.filter(
    (id) => !catalog.some((c) => (c.oauthScopeId ?? c.id) === id),
  );

  const grantedCount = catalog.filter((s) =>
    isScopeEntryGranted(s, grantedOAuthIds),
  ).length;

  const missingCount = catalog.filter(
    (s) =>
      !isPreview &&
      (requestedOAuthIds.has(s.oauthScopeId ?? s.id) ||
        requestedOAuthIds.has(s.id)) &&
      !isScopeEntryGranted(s, grantedOAuthIds),
  ).length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {isPreview ? "Geplante Berechtigungen:" : "Freigegebene Berechtigungen:"}
        </span>
        {isPreview ? (
          <span className="text-muted-foreground">
            werden beim Verbinden angefragt
          </span>
        ) : (
          <>
            <span className="font-medium text-emerald-800 dark:text-emerald-200">
              {grantedCount} erteilt
            </span>
            {missingCount > 0 ? (
              <span className="text-amber-800 dark:text-amber-200">
                · {missingCount} fehlen (beim Verbinden nicht bestätigt)
              </span>
            ) : null}
          </>
        )}
      </div>

      <ul className="space-y-2">
        {catalog.map((scope) => (
          <ScopeRow
            key={scope.id}
            scope={scope}
            granted={!isPreview && isScopeEntryGranted(scope, grantedOAuthIds)}
            pending={isPreview}
            showTechnicalId={!isPreview}
          />
        ))}
      </ul>

      {!isPreview && extraGranted.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {extraGranted.map((id) => (
            <li key={id} className="font-mono">
              {scopeLabel(id, providerKind)} ({id})
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {isPreview
          ? "Nach dem Verbinden siehst du hier, welche Zugriffe du bestätigt hast. Beiträge, Bewertungen und Nachrichten schalten wir schrittweise in Gwada frei."
          : "Fehlende Berechtigungen kannst du beim erneuten Verbinden bestätigen. Neue Funktionen wie Beiträge, Bewertungen und Nachrichten schalten wir nach und nach in Gwada frei."}
      </p>
    </div>
  );
}
