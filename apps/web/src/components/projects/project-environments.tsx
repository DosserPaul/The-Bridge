"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  CircleX,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  LoaderCircle,
  Server,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectEnvironments,
  type DeploymentState,
  type ProjectEnvironment,
  type ProjectEnvironments,
  type RepositoryEnvironments,
} from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const stateLabels: Record<DeploymentState, string> = {
  success: "Déployé",
  failed: "Échec",
  running: "Déploiement",
  pending: "En attente",
  inactive: "Inactif",
  unknown: "Inconnu",
};

function EnvironmentStateBadge({ state }: { state: DeploymentState }) {
  if (state === "success") {
    return (
      <Badge className="bg-emerald-600 text-white">
        <CircleCheck data-icon="inline-start" /> Déployé
      </Badge>
    );
  }
  if (state === "failed") {
    return (
      <Badge variant="destructive">
        <CircleX data-icon="inline-start" /> Échec
      </Badge>
    );
  }
  if (state === "running" || state === "pending") {
    return (
      <Badge className="bg-sky-600 text-white">
        <LoaderCircle
          className={state === "running" ? "animate-spin" : undefined}
          data-icon="inline-start"
        />
        {stateLabels[state]}
      </Badge>
    );
  }
  return <Badge variant="secondary">{stateLabels[state]}</Badge>;
}

function EnvironmentCard({ environment }: { environment: ProjectEnvironment }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/35">
            <Server className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{environment.name}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {environment.updatedAt
                ? `Mis à jour ${formatRelativeDate(environment.updatedAt)}`
                : "Aucun déploiement"}
            </p>
          </div>
        </div>
        <EnvironmentStateBadge state={environment.state} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
        <div className="bg-card p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
            <GitBranch className="size-3" /> Référence
          </div>
          <p className="mt-1.5 truncate font-mono text-[11px] font-medium">
            {environment.ref ?? "—"}
          </p>
        </div>
        <div className="bg-card p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
            <GitCommitHorizontal className="size-3" /> Commit
          </div>
          <p className="mt-1.5 font-mono text-[11px] font-medium">
            {environment.shortSha ?? "—"}
          </p>
        </div>
      </div>

      {environment.url ? (
        <a
          href={environment.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-4 w-full",
          )}
        >
          <ExternalLink data-icon="inline-start" /> Ouvrir l’environnement
        </a>
      ) : (
        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Aucune URL publique fournie par le provider.
        </p>
      )}
    </div>
  );
}

function RepositoryGroup({
  repository,
}: {
  repository: RepositoryEnvironments;
}) {
  if (repository.state !== "ready") {
    return (
      <div className="rounded-xl border border-dashed p-5">
        <p className="text-sm font-medium">{repository.repositoryName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {repository.message}
        </p>
        {repository.state === "connection_required" ? (
          <Link
            href="/settings/integrations"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-4",
            )}
          >
            <Settings2 data-icon="inline-start" /> Configurer le provider
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <GitFork className="size-4 text-muted-foreground" />
          <p className="text-xs font-semibold">{repository.repositoryName}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {repository.environments.length} environnement
          {repository.environments.length > 1 ? "s" : ""}
        </span>
      </div>
      {repository.environments.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {repository.environments.map((environment) => (
            <EnvironmentCard key={environment.id} environment={environment} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <CircleDashed className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-2 text-xs text-muted-foreground">
            Aucun environnement ou déploiement trouvé.
          </p>
        </div>
      )}
    </div>
  );
}

export function ProjectEnvironmentsPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [view, setView] = useState<ProjectEnvironments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void getProjectEnvironments(projectId, controller.signal)
      .then((data) => {
        setView(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les environnements.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [projectId, refreshKey]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-base font-semibold">
          Environnements et déploiements
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Production, staging et previews déclarés auprès du provider.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex gap-3 text-destructive">
            <AlertTriangle className="size-4" /> {error}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            {view?.repositories.map((repository) => (
              <RepositoryGroup
                key={repository.repositoryId}
                repository={repository}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
