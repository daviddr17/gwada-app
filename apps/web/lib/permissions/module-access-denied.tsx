export function ModuleAccessDenied({ label }: { label: string }) {
  return (
    <p className="px-4 py-8 text-sm text-muted-foreground">
      Keine Berechtigung für {label}.
    </p>
  );
}
