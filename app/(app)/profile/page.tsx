"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";

/** Platzhalter bis OAuth / Sessions angebunden sind (nur UI-Vorschau). */
const DEMO_OAUTH = {
  googleSignedIn: true,
  appleRegistered: true,
} as const;

export default function ProfilePage() {
  const { profile } = useRestaurantProfile();
  const {
    firstName,
    lastName,
    setFirstName,
    setLastName,
    save: savePersonalNames,
    isHydrated: personalNamesHydrated,
  } = usePersonalProfileNames();

  const [email, setEmail] = useState("chef@example.com");
  const [street, setStreet] = useState("Beispielweg 7");
  const [postalCode, setPostalCode] = useState("10115");
  const [city, setCity] = useState("Berlin");
  const [birthday, setBirthday] = useState("1990-06-15");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const restaurantAddress = useMemo(() => {
    const p = profile;
    if (!p.street && !p.city) return "—";
    return [p.street, [p.postalCode, p.city].filter(Boolean).join(" "), p.country]
      .filter(Boolean)
      .join(", ");
  }, [profile]);

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-6 gap-2 text-muted-foreground"
          render={<Link href="/dashboard" prefetch />}
        >
          <ArrowLeft className="size-4" />
          Zum Dashboard
        </Button>

        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Persönliches Profil
          </h1>
          <p className="text-muted-foreground">
            Deine Kontaktdaten und Anmeldemethoden. Speichern von Profil und
            Passwort folgt mit echter Anmeldung.
          </p>
        </header>

        <div className="space-y-8">
          <Card className="border-border/50 shadow-card">
            <CardHeader className="gap-2">
              <CardTitle className="text-xl">Anmeldung</CardTitle>
              <CardDescription>
                Verknüpfte Konten (Vorschau – OAuth-Anbindung kommt später).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Google
                </span>
                {DEMO_OAUTH.googleSignedIn ? (
                  <Badge className="font-normal">
                    Mit Google-Profil angemeldet
                  </Badge>
                ) : (
                  <Badge variant="secondary">Nicht verbunden</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Apple
                </span>
                {DEMO_OAUTH.appleRegistered ? (
                  <Badge className="font-normal">
                    Registrierung / Anmeldung über Apple
                  </Badge>
                ) : (
                  <Badge variant="secondary">Nicht verbunden</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Die Badges zeigen beispielhaft mögliche Zustände. Echte
                OAuth-Prüfung und Konto-Verknüpfung werden später implementiert.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Persönliche Daten</CardTitle>
              <CardDescription>
                Erreichbar unter dieser E-Mail; Adresse für persönliche Angaben
                (unabhängig vom Restaurant). Vor- und Nachname werden lokal
                gespeichert und u.a. im Bestellprotokoll unter „Bestand“
                verwendet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-email">E-Mail</Label>
                <Input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-first">Vorname</Label>
                  <Input
                    id="profile-first"
                    autoComplete="given-name"
                    disabled={!personalNamesHydrated}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-last">Nachname</Label>
                  <Input
                    id="profile-last"
                    autoComplete="family-name"
                    disabled={!personalNamesHydrated}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-birthday">Geburtstag</Label>
                <Input
                  id="profile-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <Separator />
              <p className="text-sm font-medium">Persönliche Adresse</p>
              <div className="space-y-2">
                <Label htmlFor="profile-street">Straße & Hausnummer</Label>
                <Input
                  id="profile-street"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-zip">PLZ</Label>
                  <Input
                    id="profile-zip"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-city">Ort</Label>
                  <Input
                    id="profile-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                className="h-11 w-full sm:w-auto"
                disabled={!personalNamesHydrated}
                onClick={() => savePersonalNames()}
              >
                Vor- und Nachname speichern
              </Button>
              <p className="mt-2 w-full text-xs text-muted-foreground sm:ml-4 sm:mt-0 sm:inline">
                Weitere Felder (E-Mail, Adresse …) folgen mit Benutzerkonto.
              </p>
            </CardFooter>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Aktives Restaurant</CardTitle>
              <CardDescription>
                Entspricht dem Restaurant, das du in der App gerade bearbeitest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">Name</span>
                <br />
                <span className="text-muted-foreground">
                  {profile.name.trim() || "—"}
                </span>
              </p>
              <p>
                <span className="font-medium text-foreground">Adresse</span>
                <br />
                <span className="text-muted-foreground">
                  {restaurantAddress}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Passwort ändern</CardTitle>
              <CardDescription>
                Nur relevant, wenn du dich per E-Mail und Passwort anmeldest –
                nicht bei ausschließlich Apple / Google.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw-current">Aktuelles Passwort</Label>
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-new">Neues Passwort</Label>
                <Input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-confirm">Neues Passwort wiederholen</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button type="button" className="h-11 w-full sm:w-auto" disabled>
                Passwort aktualisieren
              </Button>
              <p className="text-xs text-muted-foreground">
                Backend-Anbindung und Auth folgen in einem späteren Schritt.
              </p>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
