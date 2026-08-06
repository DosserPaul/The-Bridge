"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  FolderPlus,
  GitBranch,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjects, type Project, type Repository } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function providerLabel(provider: Repository["provider"]): string {
  if (provider === "github") return "GitHub";
  if (provider === "gitlab") return "GitLab";
  return "Git";
}

function RepositoryBadge({ repository }: { repository: Repository }) {
  if (repository.state.availability === "unavailable") {
    return (
      <Badge variant="destructive">
        <AlertTriangle data-icon="inline-start" />
        Indisponible
      </Badge>
    );
  }

  if (repository.state.isDirty) {
    return (
      <Badge variant="secondary">
        {repository.state.changedFilesCount} modification
        {repository.state.changedFilesCount > 1 ? "s" : ""}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
    >
      À jour
    </Badge>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const repository = project.repositories[0];

  return (
    <Link href={`/projects/${project.id}`} className="group block min-w-0">
      <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:ring-foreground/20 group-hover:shadow-lg group-hover:shadow-slate-900/[0.04]">
        <CardHeader>
          <ClientAvatar
            name={project.name}
            logoDataUrl={project.logoDataUrl}
            size="sm"
            className="mb-3"
          />
          <CardTitle className="text-[17px]">{project.name}</CardTitle>
          <CardDescription>
            {project.client?.name ?? "Projet personnel"}
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {project.status === "active"
                  ? "Actif"
                  : project.status === "planned"
                    ? "Planifié"
                    : project.status === "paused"
                      ? "En pause"
                      : project.status === "completed"
                        ? "Terminé"
                        : "Archivé"}
              </Badge>
              <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
            </div>
          </CardAction>
        </CardHeader>

        {repository ? (
          <CardContent className="mt-auto space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="size-3.5 shrink-0" />
                <span className="truncate font-mono text-[11px]">
                  {repository.state.branch ?? "HEAD détachée"}
                </span>
              </div>
              <RepositoryBadge repository={repository} />
            </div>

            <div className="rounded-lg border bg-muted/25 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span>{providerLabel(repository.provider)}</span>
                {repository.state.head ? (
                  <span className="font-mono">
                    {repository.state.head.shortSha}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs font-medium">
                {repository.state.head?.message ?? "Aucun commit détecté"}
              </p>
            </div>

            <p className="truncate font-mono text-[10px] text-muted-foreground/75">
              {repository.localPath}
            </p>
          </CardContent>
        ) : null}
      </Card>
    </Link>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="mb-3 size-9 rounded-lg" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const loadProjects = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await listProjects(signal);
      setError(null);
      setProjects(data);
    } catch (loadError) {
      if (!isAbortError(loadError)) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les projets.",
        );
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listProjects(controller.signal)
      .then((data) => {
        setError(null);
        setProjects(data);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les projets.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const summary = useMemo(() => {
    const repositories = projects.flatMap((project) => project.repositories);
    return {
      projects: projects.length,
      repositories: repositories.length,
      attention: repositories.filter(
        (repository) =>
          repository.state.isDirty ||
          repository.state.availability === "unavailable",
      ).length,
    };
  }, [projects]);
  const visibleProjects = projects.filter((project) =>
    showArchived
      ? project.status === "archived"
      : project.status !== "archived",
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Portfolio technique
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Projets
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Tes contextes de travail et leurs repositories locaux, réunis au
            même endroit.
          </p>
        </div>
        <Link
          href="/projects/new"
          className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
        >
          <Plus data-icon="inline-start" />
          Nouveau projet
        </Link>
      </section>

      <section className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3">
        {[
          ["Projets", summary.projects],
          ["Repositories", summary.repositories],
          ["À examiner", summary.attention],
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

      {isLoading ? <ProjectsSkeleton /> : null}

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
                void loadProjects();
              }}
              className={cn(buttonVariants({ variant: "outline" }), "mt-5")}
            >
              <RefreshCw data-icon="inline-start" />
              Réessayer
            </button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && projects.length === 0 ? (
        <Card className="border-dashed bg-card/60 text-center">
          <CardContent className="flex flex-col items-center py-14">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/50">
              <FolderPlus className="size-5" />
            </div>
            <h2 className="mt-5 font-heading text-lg font-semibold">
              Ajoute ton premier projet
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              THE BRIDGE détectera le repository Git, sa branche et son dernier
              commit sans rien modifier.
            </p>
            <Link href="/projects/new" className={cn(buttonVariants(), "mt-6")}>
              <Plus data-icon="inline-start" />
              Connecter un repository
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && projects.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium",
                  !showArchived
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setShowArchived(false)}
              >
                En cours
              </button>
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium",
                  showArchived
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setShowArchived(true)}
              >
                Archives
              </button>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Actualisé {formatRelativeDate(new Date().toISOString())}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          {!visibleProjects.length ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {showArchived
                  ? "Aucun projet archivé."
                  : "Aucun projet en cours."}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
