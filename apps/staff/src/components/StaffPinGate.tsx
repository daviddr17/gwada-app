import { useState } from "react";
import { PinPad } from "@/src/components/PinPad";
import { usePinLockStore } from "@/src/stores/pin-lock-store";
import { useAuthStore } from "@/src/stores/auth-store";

type StaffPinGateProps = {
  mode: "unlock" | "setup";
};

export function StaffPinGate({ mode }: StaffPinGateProps) {
  const verifyPin = usePinLockStore((s) => s.verifyPin);
  const setPin = usePinLockStore((s) => s.setPin);
  const signOutOnLockout = usePinLockStore((s) => s.signOutOnLockout);
  const signOut = useAuthStore((s) => s.signOut);
  const [error, setError] = useState<string | null>(null);
  const [confirmPin, setConfirmPin] = useState<string | null>(null);

  if (mode === "setup") {
    return (
      <PinPad
        title={confirmPin ? "PIN bestätigen" : "App-PIN festlegen"}
        subtitle="4 Ziffern — schützt die App auf geteilten Geräten."
        error={error}
        maxLength={4}
        onComplete={async (pin) => {
          setError(null);
          if (!confirmPin) {
            setConfirmPin(pin);
            return;
          }
          if (confirmPin !== pin) {
            setConfirmPin(null);
            setError("PINs stimmen nicht überein.");
            return;
          }
          try {
            await setPin(pin);
          } catch (err) {
            setError(err instanceof Error ? err.message : "PIN konnte nicht gespeichert werden.");
            setConfirmPin(null);
          }
        }}
        onCancel={() => void signOut()}
        cancelLabel="Abmelden"
      />
    );
  }

  return (
    <PinPad
      title="App entsperren"
      subtitle="PIN eingeben"
      error={error}
      maxLength={4}
      onComplete={async (pin) => {
        setError(null);
        const result = await verifyPin(pin);
        if (result === "ok") return;
        if (result === "locked") {
          await signOutOnLockout();
          return;
        }
        if (result === "not_set") {
          setError("Kein PIN hinterlegt — bitte erneut anmelden.");
          await signOut();
          return;
        }
        setError("Falscher PIN.");
      }}
      onCancel={() => void signOut()}
      cancelLabel="Abmelden"
    />
  );
}
