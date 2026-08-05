"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  FolderKanban,
  Mail,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listClients, type Client } from "@/lib/api";
import { cn } from "@/lib/utils";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function ClientCard({ client }: { client: Client }) {
  const primaryContact =
    client.contacts.find((contact) => contact.isPrimary) ?? client.contacts[0];

  return (
    <Link href={`/clients/${client.id}`} className="group block min-w-0">
      <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:ring-primary/25 group-hover:shadow-lg group-hover:shadow-slate-900/[0.04]">
        <CardHeader>
          <ClientAvatar
            name={client.name}
            logoDataUrl={client.logoDataUrl}
            size="sm"
            className="mb-3 size-10"
          />
          <CardTitle className="text-[17px]">{client.name}</CardTitle>
          <CardDescription>
            {client.kind === "organization" ? "Organisation" : "Indépendant"}
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <ClientStatusBadge status={client.status} />
            <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
          </CardAction>
        </CardHeader>

        <CardContent className="mt-auto space-y-4">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-border">
            <div className="bg-card px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground">Projets</p>
              <p className="mt-0.5 font-heading text-lg font-semibold">
                {client.projectsCount}
              </p>
            </div>
            <div className="border-l bg-card px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground">Repositories</p>
              <p className="mt-0.5 font-heading text-lg font-semibold">
                {client.repositoriesCount}
              </p>
            </div>
          </div>

          <div className="min-h-10 text-xs">
            {primaryContact ? (
              <>
                <p className="truncate font-medium">{primaryContact.name}</p>
                <p className="mt-1 truncate text-muted-foreground">
                  {primaryContact.role ??
                    primaryContact.email ??
                    "Contact principal"}
                </p>
              </>
            ) : client.email ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5" />
                <span className="truncate">{client.email}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun contact renseigné</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ClientsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="mb-3 size-10 rounded-lg" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listClients(controller.signal)
      .then((data) => {
        setClients(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les clients.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const summary = useMemo(
    () => ({
      clients: clients.length,
      active: clients.filter((client) => client.status === "active").length,
      projects: clients.reduce(
        (total, client) => total + client.projectsCount,
        0,
      ),
    }),
    [clients],
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    if (!normalizedQuery) return clients;

    return clients.filter((client) =>
      [
        client.name,
        client.email,
        ...client.contacts.flatMap((contact) => [contact.name, contact.email]),
      ].some((value) =>
        value?.toLocaleLowerCase("fr").includes(normalizedQuery),
      ),
    );
  }, [clients, query]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Portefeuille relationnel
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Clients
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Les organisations, contacts et projets que tu pilotes depuis THE
            BRIDGE.
          </p>
        </div>
        <Link
          href="/clients/new"
          className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
        >
          <Plus data-icon="inline-start" />
          Nouveau client
        </Link>
      </section>

      <section className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3">
        {[
          ["Clients", summary.clients],
          ["Actifs", summary.active],
          ["Projets rattachés", summary.projects],
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

      {!isLoading && !error && clients.length > 0 ? (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Rechercher un client ou un contact"
            aria-label="Rechercher un client ou un contact"
          />
        </div>
      ) : null}

      {isLoading ? <ClientsSkeleton /> : null}

      {!isLoading && error ? (
        <Card className="border-destructive/20 bg-destructive/[0.025] text-center">
          <CardContent className="flex flex-col items-center py-8">
            <AlertTriangle className="size-5 text-destructive" />
            <p className="mt-3 font-medium">API indisponible</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {error} Vérifie que pnpm dev:api est lancé.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setRefreshKey((current) => current + 1);
              }}
              className={cn(buttonVariants({ variant: "outline" }), "mt-5")}
            >
              <RefreshCw data-icon="inline-start" />
              Réessayer
            </button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && clients.length === 0 ? (
        <Card className="border-dashed bg-card/60 text-center">
          <CardContent className="flex flex-col items-center py-14">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/50">
              <UsersRound className="size-5" />
            </div>
            <h2 className="mt-5 font-heading text-lg font-semibold">
              Crée ton premier client
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Centralise ses coordonnées, son contact principal et les projets
              que tu pilotes pour lui.
            </p>
            <Link href="/clients/new" className={cn(buttonVariants(), "mt-6")}>
              <Plus data-icon="inline-start" />
              Ajouter un client
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && clients.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-heading text-sm font-semibold">
              {query ? "Résultats" : "Tous les clients"}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {clients.some((client) => client.kind === "organization") ? (
                <Building2 className="size-3.5" />
              ) : (
                <UserRound className="size-3.5" />
              )}
              {filteredClients.length} client
              {filteredClients.length > 1 ? "s" : ""}
            </div>
          </div>

          {filteredClients.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card/50 px-5 py-10 text-center">
              <FolderKanban className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Aucun résultat</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Essaie avec un autre nom ou une autre adresse email.
              </p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
