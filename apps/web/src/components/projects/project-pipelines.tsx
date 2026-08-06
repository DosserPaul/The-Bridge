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
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectPipelines,
  type Pipeline,
  type PipelineStatus,
  type ProjectPipelines,
  type RepositoryPipelines,
} from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const statusLabels: Record<PipelineStatus, string> = {
  pending: "En attente",
  running: "En cours",
  success: "Réussi",
  failed: "Échec",
  canceled: "Annulé",
  skipped: "Ignoré",
  manual: "Manuel",
  unknown: "Inconnu",
};

function PipelineStatusBadge({ status }: { status: PipelineStatus }) {
  if (status === "success") {
    return (
      <Badge className="bg-emerald-600 text-white">
        <CircleCheck data-icon="inline-start" />
        {statusLabels[status]}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive">
        <CircleX data-icon="inline-start" />
        {statusLabels[status]}
      </Badge>
    );
  }

  if (status === "running") {
    return (
      <Badge className="bg-sky-600 text-white">
        <LoaderCircle className="animate-spin" data-icon="inline-start" />
        {statusLabels[status]}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <CircleDashed data-icon="inline-start" />
      {statusLabels[status]}
    </Badge>
  );
}

function PipelineRow({ pipeline }: { pipeline: Pipeline }) {
  return (
    <a
      href={pipeline.webUrl}
      target="_blank"
      rel="noreferrer"
      className="grid gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs font-semibold">#{pipeline.number}</p>
          <span className="text-border">·</span>
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs">
            <GitBranch className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{pipeline.ref}</span>
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <GitCommitHorizontal className="size-3" />
          <span className="font-mono">{pipeline.shortSha}</span>
          <span>·</span>
          <span>{formatRelativeDate(pipeline.updatedAt)}</span>
        </div>
      </div>
      <PipelineStatusBadge status={pipeline.status} />
      <ExternalLink className="hidden size-3.5 text-muted-foreground sm:block" />
    </a>
  );
}

function RepositoryPipelineGroup({
  repository,
}: {
  repository: RepositoryPipelines;
}) {
  const providerName =
    repository.provider === "github"
      ? "GitHub"
      : repository.provider === "gitlab"
        ? "GitLab"
        : "le provider";

  if (repository.state !== "ready") {
    const needsConnection = repository.state === "connection_required";

    return (
      <div className="rounded-xl border border-dashed p-5">
        <div className="flex items-start gap-3">
          {repository.state === "error" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          ) : (
            <GitFork
              className={cn(
                "mt-0.5 size-4 shrink-0",
                repository.provider === "gitlab"
                  ? "text-[#e24329]"
                  : "text-muted-foreground",
              )}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{repository.repositoryName}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {repository.message}
            </p>
            {needsConnection ? (
              <Link
                href="/settings/integrations"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-4",
                )}
              >
                <Settings2 data-icon="inline-start" />
                Configurer {providerName}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b bg-muted/25 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitFork
            className={cn(
              "size-4",
              repository.provider === "gitlab"
                ? "text-[#e24329]"
                : "text-muted-foreground",
            )}
          />
          <p className="text-xs font-semibold">{repository.repositoryName}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {repository.pipelines.length} exécution
          {repository.pipelines.length > 1 ? "s" : ""}
        </span>
      </div>
      {repository.pipelines.length ? (
        repository.pipelines.map((pipeline) => (
          <PipelineRow key={pipeline.id} pipeline={pipeline} />
        ))
      ) : (
        <div className="px-4 py-8 text-center">
          <CircleDashed className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-2 text-xs text-muted-foreground">
            Aucune exécution CI / CD récente sur ce repository.
          </p>
        </div>
      )}
    </div>
  );
}

export function ProjectPipelinesPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [view, setView] = useState<ProjectPipelines | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void getProjectPipelines(projectId, controller.signal)
      .then((data) => {
        setView(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les exécutions CI / CD.",
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-sm font-semibold">CI / CD</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Les cinq exécutions GitHub Actions ou GitLab les plus récentes.
          </p>
        </div>
        <Link
          href="/settings/integrations"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground",
          )}
        >
          <Settings2 data-icon="inline-start" />
          Réglages
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex gap-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            {view?.repositories.length ? (
              view.repositories.map((repository) => (
                <RepositoryPipelineGroup
                  key={repository.repositoryId}
                  repository={repository}
                />
              ))
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Aucun repository à examiner.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
