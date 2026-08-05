"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Code2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  Layers3,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPipelinesPanel } from "@/components/projects/project-pipelines";
import { getProject, type Project, type Repository } from "@/lib/api";
import {
  formatCalendarDate,
  formatDate,
  formatRelativeDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function providerLabel(provider: Repository["provider"]): string {
  if (provider === "github") return "GitHub";
  if (provider === "gitlab") return "GitLab";
  return "Provider inconnu";
}

const statusLabels: Record<Project["status"], string> = {
  planned: "Planifié",
  active: "Actif",
  paused: "En pause",
  completed: "Terminé",
  archived: "Archivé",
};

const priorityLabels: Record<Project["priority"], string> = {
  low: "Priorité basse",
  normal: "Priorité normale",
  high: "Priorité haute",
  critical: "Priorité critique",
};

const typeLabels: Record<string, string> = {
  web: "Web",
  mobile: "Mobile",
  backend: "Backend / API",
  ai: "IA",
  desktop: "Desktop",
  data: "Data",
  automation: "Automatisation",
  infrastructure: "Infrastructure",
  other: "Autre",
};

function DetailsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

function RepositoryPanel({ repository }: { repository: Repository }) {
  const state = repository.state;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl border bg-muted/40">
          <FolderGit2 className="size-4" />
        </div>
        <CardTitle className="text-lg">{repository.name}</CardTitle>
        <CardDescription className="font-mono text-[11px]">
          {repository.localPath}
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 flex gap-2 self-start justify-self-end">
          <Badge variant="outline">{providerLabel(repository.provider)}</Badge>
          {state.availability === "unavailable" ? (
            <Badge variant="destructive">Indisponible</Badge>
          ) : state.isDirty ? (
            <Badge variant="secondary">Working tree modifié</Badge>
          ) : (
            <Badge className="bg-emerald-600 text-white">Propre</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {state.availability === "unavailable" ? (
          <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Repository introuvable</p>
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                {state.error}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2 xl:grid-cols-4">
            <div className="bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="size-3.5" />
                Branche
              </div>
              <p className="mt-2 truncate font-mono text-xs font-medium">
                {state.branch ?? "HEAD détachée"}
              </p>
            </div>
            <div className="bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GitCommitHorizontal className="size-3.5" />
                Commit
              </div>
              <p className="mt-2 font-mono text-xs font-medium">
                {state.head?.shortSha ?? "—"}
              </p>
            </div>
            <div className="bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HardDrive className="size-3.5" />
                Working tree
              </div>
              <p className="mt-2 text-xs font-medium">
                {state.isDirty
                  ? `${state.changedFilesCount} fichier${state.changedFilesCount > 1 ? "s" : ""}`
                  : "Aucune modification"}
              </p>
            </div>
            <div className="bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                Dernière activité
              </div>
              <p className="mt-2 text-xs font-medium">
                {state.head ? formatRelativeDate(state.head.committedAt) : "—"}
              </p>
            </div>
          </div>
        )}

        {state.head ? (
          <div className="mt-5 flex items-start gap-3 rounded-lg bg-muted/35 p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {state.head.message}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {state.head.sha} · {formatDate(state.head.committedAt)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t pt-4">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Remote origin
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
            {repository.remoteUrl ?? "Aucun remote origin configuré"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectDetails({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineRefreshKey, setPipelineRefreshKey] = useState(0);

  const loadProject = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await getProject(projectId, signal);
        setError(null);
        setProject(data);
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger ce projet.",
          );
        }
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void getProject(projectId, controller.signal)
      .then((data) => {
        setError(null);
        setProject(data);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger ce projet.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [projectId]);

  if (isLoading) return <DetailsSkeleton />;

  if (error || !project) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardContent className="flex flex-col items-center py-12">
          <AlertTriangle className="size-6 text-destructive" />
          <h1 className="mt-4 font-heading text-lg font-semibold">
            Projet indisponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
          >
            <ArrowLeft data-icon="inline-start" />
            Retour aux projets
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/projects"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 text-muted-foreground",
          )}
        >
          <ArrowLeft data-icon="inline-start" />
          Projets
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            setPipelineRefreshKey((current) => current + 1);
            void loadProject();
          }}
        >
          <RefreshCw data-icon="inline-start" />
          Actualiser
        </Button>
      </div>

      <section className="flex items-start gap-4">
        <ClientAvatar
          name={project.name}
          logoDataUrl={project.logoDataUrl}
          size="lg"
          className="bg-background"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {project.client?.name ?? "Projet personnel"}
            </Badge>
            <Badge variant="secondary">{statusLabels[project.status]}</Badge>
            <span className="text-xs text-muted-foreground">
              {project.repositories.length} repository
              {project.repositories.length > 1 ? "s" : ""}
            </span>
          </div>
          <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {project.description ??
              "État local observé au moment de l’ouverture de cette page."}
          </p>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-4">
        <div className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers3 className="size-3.5" />
            Nature
          </div>
          <p className="mt-2 text-sm font-medium">
            {project.types.length
              ? project.types.map((type) => typeLabels[type] ?? type).join(", ")
              : "Non renseignée"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {priorityLabels[project.priority]}
          </p>
        </div>
        <div className="border-t p-4 sm:border-t-0 sm:border-l">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarCheck2 className="size-3.5" />
            Deadline
          </div>
          <p className="mt-2 text-sm font-medium">
            {project.deadline
              ? formatCalendarDate(project.deadline)
              : "Aucune deadline"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {project.startDate
              ? `Début ${formatCalendarDate(project.startDate)}`
              : "Date de début libre"}
          </p>
        </div>
        <div className="border-t p-4 sm:border-l xl:border-t-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquareText className="size-3.5" />
            Prochain follow-up
          </div>
          <p className="mt-2 text-sm font-medium">
            {project.followUp
              ? formatCalendarDate(project.followUp.date)
              : "Non planifié"}
          </p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {project.followUp?.note ?? "Aucune note"}
          </p>
        </div>
        <div className="border-t p-4 sm:border-l">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Code2 className="size-3.5" />
            Technologies
          </div>
          <p className="mt-2 text-sm font-medium">
            {project.technologies.length
              ? project.technologies.join(", ")
              : "À renseigner"}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold">Repositories</h2>
          <p className="text-xs text-muted-foreground">Lecture seule</p>
        </div>
        {project.repositories.map((repository) => (
          <RepositoryPanel key={repository.id} repository={repository} />
        ))}
      </section>

      <ProjectPipelinesPanel
        projectId={project.id}
        refreshKey={pipelineRefreshKey}
      />
    </div>
  );
}
