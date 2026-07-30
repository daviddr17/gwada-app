/**
 * Portal-Ziel für Select/Combobox/Tooltip/Popover.
 * Nur echte Element-/ShadowRoot-Knoten — sonst fällt Base UI auf `document.body` zurück.
 * Verhindert React #200 / #299 („Target container is not a DOM element“) bei
 * Soft-Nav + Drawer-Teardown (stale Host / RefObject / null).
 */
export function resolveFloatingPortalContainer(
  ...candidates: unknown[]
): HTMLElement | ShadowRoot | undefined {
  for (const candidate of candidates) {
    const resolved = unwrapPortalCandidate(candidate);
    if (resolved) return resolved;
  }
  return undefined;
}

function unwrapPortalCandidate(
  candidate: unknown,
): HTMLElement | ShadowRoot | undefined {
  if (isElementOrShadowRoot(candidate)) return candidate;
  if (
    candidate &&
    typeof candidate === "object" &&
    "current" in candidate
  ) {
    const current = (candidate as { current: unknown }).current;
    if (isElementOrShadowRoot(current)) return current;
  }
  return undefined;
}

function isElementOrShadowRoot(
  value: unknown,
): value is HTMLElement | ShadowRoot {
  if (!value || typeof value !== "object" || !("nodeType" in value)) {
    return false;
  }
  const nodeType = (value as Node).nodeType;
  // 1 = ELEMENT_NODE, 11 = DOCUMENT_FRAGMENT_NODE (ShadowRoot)
  return nodeType === 1 || (nodeType === 11 && "host" in value);
}

/** Sicheres Ziel für `createPortal(..., document.body)`. */
export function getDocumentBodyPortalTarget(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const body = document.body;
  if (!body || body.nodeType !== 1) return null;
  return body;
}
