"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  ContactRound,
  FolderKanban,
  Globe2,
  Mail,
  NotebookPen,
  Phone,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient, type Client } from "@/lib/api";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function ClientDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

function DetailLink({
  icon: Icon,
  label,
  value,
  href,
  external = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </p>
        {value && href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className="mt-1 block truncate text-xs font-medium hover:text-primary"
          >
            {value}
          </a>
        ) : (
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {value ?? "Non renseigné"}
          </p>
        )}
      </div>
    </div>
  );
}

export function ClientDetails({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClient = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await getClient(clientId, signal);
        setClient(data);
        setError(null);
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger ce client.",
          );
        }
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [clientId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void getClient(clientId, controller.signal)
      .then((data) => {
        setClient(data);
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

  if (isLoading) return <ClientDetailsSkeleton />;

  if (error || !client) {
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/clients"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 text-muted-foreground",
          )}
        >
          <ArrowLeft data-icon="inline-start" />
          Clients
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil data-icon="inline-start" />
            Modifier
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              void loadClient();
            }}
          >
            <RefreshCw data-icon="inline-start" />
            Actualiser
          </Button>
        </div>
      </div>

      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="flex items-start gap-4">
          <ClientAvatar
            name={client.name}
            logoDataUrl={client.logoDataUrl}
            size="md"
          />
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                {client.kind === "organization"
                  ? "Organisation"
                  : "Indépendant"}
              </p>
              <ClientStatusBadge status={client.status} />
            </div>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              {client.name}
            </h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Dans THE BRIDGE depuis le {formatDate(client.createdAt)}
            </p>
          </div>
        </div>
        <Link
          href={`/projects/new?clientId=${client.id}`}
          className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
        >
          <Plus data-icon="inline-start" />
          Nouveau projet
        </Link>
      </section>

      <section className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3">
        {[
          ["Projets", client.projectsCount],
          ["Repositories", client.repositoriesCount],
          ["Contacts", client.contacts.length],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              "px-5 py-4",
              index > 0 && "border-t sm:border-t-0 sm:border-l",
            )}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.65fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="size-4 text-primary" />
                Projets
              </CardTitle>
              <CardDescription>
                Les contextes techniques rattachés à ce client.
              </CardDescription>
              <CardAction>
                <Badge variant="outline">
                  {client.projects.length} projet
                  {client.projects.length > 1 ? "s" : ""}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {client.projects.length ? (
                <div className="divide-y">
                  {client.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                        <FolderKanban className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-primary">
                          {project.name}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {project.repositoriesCount} repo
                          {project.repositoriesCount > 1 ? "s" : ""} · mis à
                          jour {formatRelativeDate(project.updatedAt)}
                        </p>
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/15 px-5 py-10 text-center">
                  <FolderKanban className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    Aucun projet rattaché
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Crée le premier contexte technique de ce client.
                  </p>
                  <Link
                    href={`/projects/new?clientId=${client.id}`}
                    className={cn(buttonVariants({ size: "sm" }), "mt-5")}
                  >
                    <Plus data-icon="inline-start" />
                    Créer un projet
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <ContactRound className="size-4 text-primary" />
                Contacts
              </CardTitle>
              <CardDescription>
                Les interlocuteurs identifiés chez ce client.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {client.contacts.length ? (
                <div className="divide-y">
                  {client.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)]"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{contact.name}</p>
                          {contact.isPrimary ? (
                            <Badge variant="secondary">Principal</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {contact.role ?? "Rôle non renseigné"}
                        </p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-2 truncate hover:text-foreground"
                          >
                            <Mail className="size-3.5 shrink-0" />
                            {contact.email}
                          </a>
                        ) : null}
                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-2 hover:text-foreground"
                          >
                            <Phone className="size-3.5 shrink-0" />
                            {contact.phone}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun contact renseigné pour le moment.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <DetailLink
                icon={Mail}
                label="Email"
                value={client.email}
                href={client.email ? `mailto:${client.email}` : undefined}
              />
              <DetailLink
                icon={Phone}
                label="Téléphone"
                value={client.phone}
                href={client.phone ? `tel:${client.phone}` : undefined}
              />
              <DetailLink
                icon={Globe2}
                label="Site web"
                value={client.website}
                href={client.website ?? undefined}
                external
              />
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
              {client.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {client.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune note enregistrée.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
