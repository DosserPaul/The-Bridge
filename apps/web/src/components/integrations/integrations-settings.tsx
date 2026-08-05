"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  GitBranch,
  GitFork,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  connectGitHub,
  connectGitLab,
  disconnectGitHub,
  disconnectGitLab,
  listGitHubConnections,
  listGitLabConnections,
  type GitHubConnection,
  type GitLabConnection,
} from "@/lib/api";

type Provider = "github" | "gitlab";
type ProviderConnection = GitHubConnection | GitLabConnection;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function ConnectionCard({
  connection,
  onDisconnect,
  isDisconnecting,
}: {
  connection: ProviderConnection;
  onDisconnect: (connection: ProviderConnection) => void;
  isDisconnecting: boolean;
}) {
  const credentialAvailable = connection.credentialState === "available";
  const isGitHub = connection.provider === "github";
  const ProviderIcon = isGitHub ? GitBranch : GitFork;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
      <div
        className={
          isGitHub
            ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] text-foreground"
            : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#fc6d26]/10 text-[#e24329]"
        }
      >
        <ProviderIcon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-sm font-semibold">
            {connection.account.name}
          </p>
          <Badge variant="outline">{isGitHub ? "GitHub" : "GitLab"}</Badge>
          <Badge variant={credentialAvailable ? "secondary" : "destructive"}>
            {credentialAvailable ? "Connecté" : "Token absent"}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          @{connection.account.username} · {connection.baseUrl}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isDisconnecting}
        onClick={() => onDisconnect(connection)}
      >
        {isDisconnecting ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <Trash2 data-icon="inline-start" />
        )}
        Déconnecter
      </Button>
    </div>
  );
}

export function IntegrationsSettings() {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [gitHubToken, setGitHubToken] = useState("");
  const [gitLabBaseUrl, setGitLabBaseUrl] = useState("https://gitlab.com");
  const [gitLabToken, setGitLabToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(
    null,
  );
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      listGitHubConnections(controller.signal),
      listGitLabConnections(controller.signal),
    ])
      .then(([gitHubConnections, gitLabConnections]) => {
        setConnections([...gitHubConnections, ...gitLabConnections]);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les connexions.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  function upsertConnection(connection: ProviderConnection) {
    setConnections((current) => [
      ...current.filter((item) => item.id !== connection.id),
      connection,
    ]);
  }

  async function handleGitHubSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectingProvider("github");
    setError(null);
    setSuccess(null);

    try {
      const connection = await connectGitHub({ token: gitHubToken });
      upsertConnection(connection);
      setGitHubToken("");
      setSuccess(
        `Connexion GitHub validée pour @${connection.account.username}.`,
      );
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "La connexion GitHub a échoué.",
      );
    } finally {
      setConnectingProvider(null);
    }
  }

  async function handleGitLabSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectingProvider("gitlab");
    setError(null);
    setSuccess(null);

    try {
      const connection = await connectGitLab({
        baseUrl: gitLabBaseUrl,
        token: gitLabToken,
      });
      upsertConnection(connection);
      setGitLabToken("");
      setSuccess(
        `Connexion GitLab validée pour @${connection.account.username}.`,
      );
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "La connexion GitLab a échoué.",
      );
    } finally {
      setConnectingProvider(null);
    }
  }

  async function handleDisconnect(connection: ProviderConnection) {
    const providerLabel =
      connection.provider === "github" ? "GitHub" : "GitLab";
    if (
      !window.confirm(
        `Déconnecter le compte ${providerLabel} @${connection.account.username} de THE BRIDGE ?`,
      )
    ) {
      return;
    }

    setDisconnectingId(connection.id);
    setError(null);
    setSuccess(null);

    try {
      if (connection.provider === "github") {
        await disconnectGitHub(connection.id);
      } else {
        await disconnectGitLab(connection.id);
      }
      setConnections((current) =>
        current.filter((item) => item.id !== connection.id),
      );
      setSuccess(
        `La connexion ${providerLabel} et son token local ont été supprimés.`,
      );
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Impossible de supprimer cette connexion.",
      );
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <Badge variant="outline">Réglages</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          Intégrations
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connectez les providers qui alimentent votre Mission Control. Les
          secrets restent dans le Trousseau de ce Mac.
        </p>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] p-4 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="flex gap-3 rounded-xl border border-emerald-600/20 bg-emerald-600/[0.05] p-4 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <div className="flex size-10 items-center justify-center rounded-xl bg-foreground/[0.06] text-foreground">
              <GitBranch className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>GitHub</CardTitle>
            <CardDescription>
              Validez votre compte maintenant, puis pilotez vos repositories et
              workflows depuis THE BRIDGE.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleGitHubSubmit}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="github-token">Personal access token</Label>
                  <a
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Créer un token
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </a>
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="github-token"
                    type="password"
                    required
                    autoComplete="off"
                    value={gitHubToken}
                    onChange={(event) => setGitHubToken(event.target.value)}
                    placeholder="github_pat_… ou ghp_…"
                    className="pl-9"
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Aucun droit supplémentaire n’est requis pour vérifier votre
                  identité. L’accès futur aux repositories dépendra des droits
                  choisis sur ce token.
                </p>
              </div>

              <Button type="submit" disabled={connectingProvider !== null}>
                {connectingProvider === "github" ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <LockKeyhole data-icon="inline-start" />
                )}
                Vérifier et connecter
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#fc6d26]/10 text-[#e24329]">
              <GitFork className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>GitLab</CardTitle>
            <CardDescription>
              Pipelines, merge requests et issues derrière une connexion en
              lecture seule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleGitLabSubmit}>
              <div className="space-y-2">
                <Label htmlFor="gitlab-url">URL de l’instance</Label>
                <Input
                  id="gitlab-url"
                  type="url"
                  required
                  value={gitLabBaseUrl}
                  onChange={(event) => setGitLabBaseUrl(event.target.value)}
                  placeholder="https://gitlab.com"
                />
                <p className="text-[11px] text-muted-foreground">
                  GitLab.com ou l’URL racine de votre instance auto-hébergée.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gitlab-token">Personal access token</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="gitlab-token"
                    type="password"
                    required
                    autoComplete="off"
                    value={gitLabToken}
                    onChange={(event) => setGitLabToken(event.target.value)}
                    placeholder="glpat-…"
                    className="pl-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Le scope <code>read_api</code> suffit pour cette première
                  version.
                </p>
              </div>

              <Button type="submit" disabled={connectingProvider !== null}>
                {connectingProvider === "gitlab" ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <LockKeyhole data-icon="inline-start" />
                )}
                Vérifier et connecter
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Connexions actives</CardTitle>
          <CardDescription>
            Les métadonnées sont locales ; les tokens restent dans le Trousseau
            macOS et ne sont jamais enregistrés dans l’Activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </>
          ) : connections.length ? (
            connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onDisconnect={handleDisconnect}
                isDisconnecting={disconnectingId === connection.id}
              />
            ))
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
              <PlugZap className="size-6 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">Aucune connexion</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Connectez GitHub ou GitLab pour faire remonter l’activité de vos
                repositories.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
