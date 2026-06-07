"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SaveHandler = () => Promise<void>;

type RegistryContextValue = {
  dirty: boolean;
  saving: boolean;
  register: (id: string, isDirty: boolean, save: SaveHandler) => void;
  saveAll: () => Promise<void>;
};

const RegistryContext = createContext<RegistryContextValue | null>(null);

export function SuperadminIntegrationsSaveProvider({
  children,
  onAfterSave,
}: {
  children: ReactNode;
  onAfterSave: () => void | Promise<void>;
}) {
  const handlersRef = useRef<Map<string, SaveHandler>>(new Map());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const register = useCallback(
    (id: string, isDirty: boolean, save: SaveHandler) => {
      handlersRef.current.set(id, save);
      setDirtyIds((prev) => {
        const next = new Set(prev);
        if (isDirty) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [],
  );

  const saveAll = useCallback(async () => {
    if (dirtyIds.size === 0) return;
    setSaving(true);
    try {
      for (const id of dirtyIds) {
        const fn = handlersRef.current.get(id);
        if (fn) await fn();
      }
      setDirtyIds(new Set());
      await onAfterSave();
    } finally {
      setSaving(false);
    }
  }, [dirtyIds, onAfterSave]);

  const value = useMemo(
    () => ({
      dirty: dirtyIds.size > 0,
      saving,
      register,
      saveAll,
    }),
    [dirtyIds.size, saving, register, saveAll],
  );

  return (
    <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>
  );
}

export function useSuperadminIntegrationsSave() {
  const ctx = useContext(RegistryContext);
  if (!ctx) {
    throw new Error("useSuperadminIntegrationsSave requires SuperadminIntegrationsSaveProvider");
  }
  return ctx;
}

export function useRegisterSuperadminIntegrationSave(
  id: string,
  isDirty: boolean,
  save: SaveHandler,
) {
  const { register } = useSuperadminIntegrationsSave();
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    register(id, isDirty, async () => {
      await saveRef.current();
    });
  }, [id, isDirty, register]);
}
