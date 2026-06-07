"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Ctx = {
  override: string | null;
  setOverride: (title: string | null) => void;
};

const DocumentTitleOverrideContext = createContext<Ctx | null>(null);

export function DocumentTitleOverrideProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [override, setOverride] = useState<string | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return (
    <DocumentTitleOverrideContext.Provider value={value}>
      {children}
    </DocumentTitleOverrideContext.Provider>
  );
}

export function useDocumentTitleOverride(): Ctx {
  const ctx = useContext(DocumentTitleOverrideContext);
  if (!ctx) {
    throw new Error(
      "useDocumentTitleOverride must be used within DocumentTitleOverrideProvider",
    );
  }
  return ctx;
}

export function useDocumentTitleOverrideOptional(): Ctx | null {
  return useContext(DocumentTitleOverrideContext);
}
