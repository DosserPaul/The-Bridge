"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ContactRound,
  LoaderCircle,
  LockKeyhole,
  NotebookPen,
  TriangleAlert,
} from "lucide-react";
import { ClientLogoField } from "@/components/clients/client-logo-field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitShortcutHint } from "@/components/ui/submit-shortcut-hint";
import { createClient, type CreateClientInput } from "@/lib/api";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function optionalValue(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

export function NewClientForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const contactName = optionalValue(formData, "contactName");
    const input: CreateClientInput = {
      name: String(formData.get("name") ?? "").trim(),
      kind:
        formData.get("kind") === "individual" ? "individual" : "organization",
      status:
        formData.get("status") === "prospect"
          ? "prospect"
          : formData.get("status") === "paused"
            ? "paused"
            : "active",
      email: optionalValue(formData, "email"),
      phone: optionalValue(formData, "phone"),
      website: optionalValue(formData, "website"),
      notes: optionalValue(formData, "notes"),
      logoDataUrl: logoDataUrl ?? undefined,
      ...(contactName
        ? {
            primaryContact: {
              name: contactName,
              role: optionalValue(formData, "contactRole"),
              email: optionalValue(formData, "contactEmail"),
              phone: optionalValue(formData, "contactPhone"),
            },
          }
        : {}),
    };

    try {
      const client = await createClient(input);
      router.push(`/clients/${client.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de créer ce client.",
      );
      setIsSubmitting(false);
    }
  }

  function handleSubmitShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key !== "Enter" ||
      (!event.metaKey && !event.ctrlKey) ||
      event.repeat
    ) {
      return;
    }

    event.preventDefault();
    if (!isSubmitting) event.currentTarget.requestSubmit();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/clients"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 text-muted-foreground",
        )}
      >
        <ArrowLeft data-icon="inline-start" />
        Retour aux clients
      </Link>

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Portefeuille
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em]">
            Nouveau client
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Pose le contexte relationnel minimum. Tu pourras ensuite rattacher
            ses projets et repositories.
          </p>

          <form
            className="mt-7 space-y-5"
            onSubmit={handleSubmit}
            onKeyDown={handleSubmitShortcut}
          >
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Identité
                </CardTitle>
                <CardDescription>
                  Le nom et l’état commercial utilisés dans le cockpit.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ClientLogoField
                    clientName={clientName}
                    value={logoDataUrl}
                    onChange={setLogoDataUrl}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nom du client</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Juris Global"
                    minLength={2}
                    maxLength={120}
                    autoFocus
                    required
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kind">Type</Label>
                  <select
                    id="kind"
                    name="kind"
                    className={selectClassName}
                    defaultValue="organization"
                  >
                    <option value="organization">Organisation</option>
                    <option value="individual">Indépendant</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <select
                    id="status"
                    name="status"
                    className={selectClassName}
                    defaultValue="active"
                  >
                    <option value="active">Actif</option>
                    <option value="prospect">Prospect</option>
                    <option value="paused">En pause</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Coordonnées</CardTitle>
                <CardDescription>
                  Les canaux généraux de l’organisation ou de la personne.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email général</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="hello@jurisglobal.fr"
                    maxLength={254}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+33 1 84 80 20 20"
                    maxLength={40}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    placeholder="https://jurisglobal.fr"
                    maxLength={2048}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <ContactRound className="size-4 text-primary" />
                  Contact principal
                </CardTitle>
                <CardDescription>
                  Facultatif, mais utile pour identifier immédiatement ton
                  interlocuteur.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nom</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    placeholder="Camille Martin"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactRole">Rôle</Label>
                  <Input
                    id="contactRole"
                    name="contactRole"
                    placeholder="Direction produit"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    placeholder="camille@jurisglobal.fr"
                    maxLength={254}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Téléphone</Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    placeholder="+33 6 00 00 00 00"
                    maxLength={40}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <NotebookPen className="size-4 text-primary" />
                  Notes
                </CardTitle>
                <CardDescription>
                  Contexte commercial, habitudes ou points de vigilance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="notes" className="sr-only">
                  Notes
                </Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={5}
                  maxLength={5000}
                  placeholder="Contexte de la relation, cadence des points, décisions importantes…"
                  className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </CardContent>
            </Card>

            {error ? (
              <div
                role="alert"
                className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3.5 text-sm text-destructive"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 border-t pt-5">
              <SubmitShortcutHint className="mr-auto" />
              <Link
                href="/clients"
                className={buttonVariants({ variant: "ghost" })}
              >
                Annuler
              </Link>
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <ArrowRight data-icon="inline-start" />
                )}
                {isSubmitting ? "Création…" : "Créer le client"}
              </Button>
            </div>
          </form>
        </div>

        <aside className="space-y-4 lg:pt-24">
          <div className="rounded-xl border bg-muted/25 p-5">
            <LockKeyhole className="size-5 text-primary" />
            <h2 className="mt-4 font-heading text-sm font-semibold">
              Données locales
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Ces informations restent dans la base SQLite locale de THE BRIDGE.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="font-mono text-[9.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Après création
            </p>
            <ol className="mt-4 space-y-3 text-xs text-muted-foreground">
              <li>1. Ouvre la fiche client</li>
              <li>2. Crée ou rattache ses projets</li>
              <li>3. Pilote ses repositories au même endroit</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
