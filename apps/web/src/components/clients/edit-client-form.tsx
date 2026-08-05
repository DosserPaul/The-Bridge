"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ContactRound,
  LoaderCircle,
  NotebookPen,
  Save,
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
import { Skeleton } from "@/components/ui/skeleton";
import { SubmitShortcutHint } from "@/components/ui/submit-shortcut-hint";
import {
  getClient,
  updateClient,
  type Client,
  type UpdateClientInput,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function optionalValue(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function EditClientSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <Skeleton className="h-7 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function EditClientForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getClient(clientId, controller.signal)
      .then((data) => {
        setClient(data);
        setClientName(data.name);
        setLogoDataUrl(data.logoDataUrl);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger ce client.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [clientId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const contactName = optionalValue(formData, "contactName");
    const input: UpdateClientInput = {
      name: clientName.trim(),
      kind:
        formData.get("kind") === "individual" ? "individual" : "organization",
      status:
        formData.get("status") === "prospect"
          ? "prospect"
          : formData.get("status") === "paused"
            ? "paused"
            : "active",
      email: optionalValue(formData, "email") ?? null,
      phone: optionalValue(formData, "phone") ?? null,
      website: optionalValue(formData, "website") ?? null,
      notes: optionalValue(formData, "notes") ?? null,
      logoDataUrl,
      primaryContact: contactName
        ? {
            name: contactName,
            role: optionalValue(formData, "contactRole"),
            email: optionalValue(formData, "contactEmail"),
            phone: optionalValue(formData, "contactPhone"),
          }
        : null,
    };

    try {
      await updateClient(clientId, input);
      router.push(`/clients/${clientId}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de modifier ce client.",
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

  if (isLoading) return <EditClientSkeleton />;

  if (!client) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardContent className="flex flex-col items-center py-12">
          <AlertTriangle className="size-6 text-destructive" />
          <h1 className="mt-4 font-heading text-lg font-semibold">
            Client indisponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link
            href="/clients"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
          >
            <ArrowLeft data-icon="inline-start" />
            Retour aux clients
          </Link>
        </CardContent>
      </Card>
    );
  }

  const primaryContact =
    client.contacts.find((contact) => contact.isPrimary) ?? client.contacts[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/clients/${client.id}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 text-muted-foreground",
        )}
      >
        <ArrowLeft data-icon="inline-start" />
        Retour à la fiche
      </Link>

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Portefeuille
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em]">
            Modifier {client.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Mets à jour l’identité, les coordonnées et le contact principal du
            client.
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
                  Le logo, le nom et l’état commercial affichés dans le cockpit.
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
                    minLength={2}
                    maxLength={120}
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
                    defaultValue={client.kind}
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
                    defaultValue={client.status}
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
                    maxLength={254}
                    defaultValue={client.email ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    maxLength={40}
                    defaultValue={client.phone ?? ""}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    maxLength={2048}
                    defaultValue={client.website ?? ""}
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
                  Laisse le nom vide pour retirer le contact principal actuel.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nom</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    maxLength={120}
                    defaultValue={primaryContact?.name ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactRole">Rôle</Label>
                  <Input
                    id="contactRole"
                    name="contactRole"
                    maxLength={120}
                    defaultValue={primaryContact?.role ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    maxLength={254}
                    defaultValue={primaryContact?.email ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Téléphone</Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    maxLength={40}
                    defaultValue={primaryContact?.phone ?? ""}
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
                  defaultValue={client.notes ?? ""}
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
                href={`/clients/${client.id}`}
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
                  <Save data-icon="inline-start" />
                )}
                {isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </div>

        <aside className="space-y-4 lg:pt-24">
          <div className="rounded-xl border bg-muted/25 p-5">
            <Save className="size-5 text-primary" />
            <h2 className="mt-4 font-heading text-sm font-semibold">
              Mise à jour immédiate
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Les changements sont répercutés dans la liste clients et les
              projets associés.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
