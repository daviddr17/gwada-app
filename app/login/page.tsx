import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  description: "Anmelden oder registrieren.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background p-4 text-sm text-muted-foreground">
          Lade Anmeldung…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
