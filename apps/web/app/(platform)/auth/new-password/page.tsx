import { Suspense } from "react";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export default function NeuesPasswortPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
          Laden…
        </div>
      }
    >
      <NewPasswordForm />
    </Suspense>
  );
}
