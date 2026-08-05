"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FolderGit2,
  LoaderCircle,
  Plus,
  SearchCheck,
  TriangleAlert,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addProjectRepository,
  listGitHubConnections,
  listGitLabConnections,
  listRemoteRepositories,
  validateRepositoryPath,
  type GitHubConnection,
  type GitLabConnection,
  type RemoteRepository,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Mode = "local" | "existing" | "create";
type Provider = "github" | "gitlab";
type Connection = GitHubConnection | GitLabConnection;

const selectClassName =
  "h-8 w-full cursor-pointer appearance-auto rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AddRepositoryForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [remoteRepositories, setRemoteRepositories] = useState<
    RemoteRepository[]
  >([]);
  const [mode, setMode] = useState<Mode>("local");
  const [provider, setProvider] = useState<Provider>("github");
  const [connectionId, setConnectionId] = useState("");
  const [remoteRepositoryId, setRemoteRepositoryId] = useState("");
  const [remoteRepositoryName, setRemoteRepositoryName] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("");
  const [destinationMode, setDestinationMode] = useState<"exact" | "subfolder">(
    "subfolder",
  );
  const [verifiedPath, setVerifiedPath] = useState("");
  const [verificationSignature, setVerificationSignature] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      listGitHubConnections(controller.signal),
      listGitLabConnections(controller.signal),
    ])
      .then(([github, gitlab]) => setConnections([...github, ...gitlab]))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const providerConnections = useMemo(
    () => connections.filter((connection) => connection.provider === provider),
    [connections, provider],
  );
  const effectiveConnectionId = providerConnections.some(
    (item) => item.id === connectionId,
  )
    ? connectionId
    : (providerConnections[0]?.id ?? "");
  const selectedConnectionId =
    mode === "local" ? connectionId : effectiveConnectionId;
  const selectedRemote = remoteRepositories.find(
    (item) => item.id === remoteRepositoryId,
  );
  const directoryName =
    mode === "existing"
      ? (selectedRemote?.name ?? "")
      : slugify(remoteRepositoryName);
  const signature = [
    mode,
    repositoryPath.trim(),
    destinationMode,
    directoryName,
  ].join(":");
  const isVerified =
    verificationSignature === signature && Boolean(verifiedPath);

  useEffect(() => {
    if (mode !== "existing" || !effectiveConnectionId) {
      return;
    }
    const controller = new AbortController();
    void listRemoteRepositories(
      provider,
      effectiveConnectionId,
      controller.signal,
    )
      .then((repositories) => {
        setRemoteRepositories(repositories);
        setRemoteRepositoryId((current) =>
          repositories.some((item) => item.id === current)
            ? current
            : (repositories[0]?.id ?? ""),
        );
      })
      .catch((loadError: unknown) => {
        if (!(
          loadError instanceof DOMException && loadError.name === "AbortError"
        )) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les repositories.",
          );
        }
      });
    return () => controller.abort();
  }, [effectiveConnectionId, mode, provider]);

  async function verifyPath() {
    if (!repositoryPath.trim()) {
      setError("Indique le chemin local à vérifier.");
      return;
    }
    if (mode !== "local" && destinationMode === "subfolder" && !directoryName) {
      setError("Indique le repository ou le dossier à créer.");
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const result = await validateRepositoryPath({
        repositoryMode: mode,
        repositoryPath: repositoryPath.trim(),
        ...(mode === "local"
          ? {}
          : {
              cloneDestinationMode: destinationMode,
              ...(destinationMode === "subfolder"
                ? { cloneDirectoryName: directoryName }
                : {}),
            }),
      });
      setVerifiedPath(result.resolvedPath);
      setVerificationSignature(signature);
    } catch (verificationError) {
      setVerifiedPath("");
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Ce chemin ne peut pas être utilisé.",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isVerified) {
      setError("Vérifie le chemin avant d’ajouter le repository.");
      return;
    }
    if (mode !== "local" && !effectiveConnectionId) {
      setError("Sélectionne une connexion GitHub ou GitLab.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await addProjectRepository(projectId, {
        repositoryPath: verifiedPath,
        repositoryMode: mode,
        provider,
        ...(selectedConnectionId ? { connectionId: selectedConnectionId } : {}),
        ...(mode === "existing" ? { remoteRepositoryId } : {}),
        ...(mode === "create"
          ? {
              remoteRepositoryName: remoteRepositoryName.trim(),
              repositoryVisibility: "private",
              initializeReadme: true,
            }
          : {}),
      });
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible d’ajouter le repository.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mx-auto max-w-3xl space-y-6" onSubmit={handleSubmit}>
      <Link
        href={`/projects/${projectId}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2",
        )}
      >
        <ArrowLeft /> Projet
      </Link>
      <div>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Repository
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.035em]">
          Ajouter une source de code
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Le dossier local ne sera jamais supprimé lorsque tu retires son
          association.
        </p>
      </div>
      {error ? (
        <div className="flex gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["local", "Repository local"],
                ["existing", "Cloner un repository"],
                ["create", "Créer puis cloner"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setVerifiedPath("");
                }}
                className={cn(
                  "cursor-pointer rounded-xl border p-4 text-left text-sm transition hover:bg-muted",
                  mode === value &&
                    "border-primary bg-primary/5 ring-2 ring-primary/15",
                )}
              >
                <FolderGit2 className="mb-3 size-5" />
                {label}
              </button>
            ))}
          </div>

          {mode !== "local" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  className={selectClassName}
                  value={provider}
                  onChange={(event) => {
                    setProvider(event.target.value as Provider);
                    setConnectionId("");
                  }}
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="connection">Connexion</Label>
                <select
                  id="connection"
                  className={selectClassName}
                  value={effectiveConnectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                >
                  {providerConnections.length ? (
                    providerConnections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        @{connection.account.username} · {connection.baseUrl}
                      </option>
                    ))
                  ) : (
                    <option value="">Aucune connexion</option>
                  )}
                </select>
              </div>
            </div>
          ) : null}

          {mode === "local" ? (
            <div className="space-y-2">
              <Label htmlFor="localConnection">
                Connexion provider optionnelle
              </Label>
              <select
                id="localConnection"
                className={selectClassName}
                value={connectionId}
                onChange={(event) => {
                  const selected = connections.find(
                    (connection) => connection.id === event.target.value,
                  );
                  setConnectionId(event.target.value);
                  if (selected) setProvider(selected.provider);
                }}
              >
                <option value="">Aucune connexion explicite</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.provider === "github" ? "GitHub" : "GitLab"} · @
                    {connection.account.username}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {mode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="remote">Repository distant</Label>
              <select
                id="remote"
                className={selectClassName}
                value={remoteRepositoryId}
                onChange={(event) => setRemoteRepositoryId(event.target.value)}
              >
                {remoteRepositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.fullName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {mode === "create" ? (
            <div className="space-y-2">
              <Label htmlFor="remoteName">Nom du nouveau repository</Label>
              <Input
                id="remoteName"
                value={remoteRepositoryName}
                onChange={(event) =>
                  setRemoteRepositoryName(event.target.value)
                }
                placeholder="the-bridge-api"
              />
            </div>
          ) : null}

          {mode !== "local" ? (
            <div className="space-y-2">
              <Label htmlFor="destinationMode">Destination</Label>
              <select
                id="destinationMode"
                className={selectClassName}
                value={destinationMode}
                onChange={(event) =>
                  setDestinationMode(
                    event.target.value as "exact" | "subfolder",
                  )
                }
              >
                <option value="subfolder">Créer un sous-dossier</option>
                <option value="exact">
                  Cloner directement dans ce dossier
                </option>
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="repositoryPath">
              {mode === "local" ? "Chemin du repository" : "Destination locale"}
            </Label>
            <div className="flex gap-2">
              <Input
                id="repositoryPath"
                className="font-mono"
                value={repositoryPath}
                onChange={(event) => setRepositoryPath(event.target.value)}
                placeholder="/path/to/repository"
              />
              <Button
                type="button"
                variant="outline"
                disabled={isVerifying}
                onClick={() => void verifyPath()}
              >
                {isVerifying ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <SearchCheck />
                )}
                Vérifier
              </Button>
            </div>
            {isVerified ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3.5" />
                {verifiedPath}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={!isVerified || isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Plus />}
          Ajouter le repository
        </Button>
      </div>
    </form>
  );
}
