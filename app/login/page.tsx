import { Suspense } from "react";
import { DocumentTitle } from "@/components/layout/document-title";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background p-4 text-sm text-muted-foreground">
          Lade Anmeldung…
        </div>
      }
    >
      <DocumentTitle pageTitle="Anmelden" />
      <LoginForm />
    </Suspense>
  );
}
