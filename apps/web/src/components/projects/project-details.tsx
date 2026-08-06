"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Archive,
  CalendarCheck2,
  CheckCircle2,
  CircleDot,
  Clock3,
  Code2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  Layers3,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Signal,
  Trash2,
  UserRound,
} from "lucide-react";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { ProjectActivityPanel } from "@/components/projects/project-activity";
import { ProjectAgentsPanel } from "@/components/projects/project-agents";
import { ProjectAttentionPanel } from "@/components/projects/project-attention";
import { ProjectDecisionsPanel } from "@/components/projects/project-decisions";
import { ProjectDocumentsPanel } from "@/components/projects/project-documents";
import { ProjectEnvironmentsPanel } from "@/components/projects/project-environments";
import { ProjectHealthPanel } from "@/components/projects/project-health";
import { ProjectIssuesPanel } from "@/components/projects/project-issues";
import { ProjectLocalActionsPanel } from "@/components/projects/project-local-actions";
import { ProjectPipelinesPanel } from "@/components/projects/project-pipelines";
import { ProjectPullRequestsPanel } from "@/components/projects/project-pull-requests";
import { ProjectRoadmapPanel } from "@/components/projects/project-roadmap";
import { ProjectCommercialPanel } from "@/components/projects/project-commercial";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  archiveProject,
  associateRepositoryConnection,
  getProject,
  listGitHubConnections,
  listGitLabConnections,
  removeProjectRepository,
  type GitHubConnection,
  type GitLabConnection,
  type Project,
  type Repository,
} from "@/lib/api";
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
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  critical: "Critique",
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
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

type ProviderConnection = GitHubConnection | GitLabConnection;
type ProjectTab =
  | "overview"
  | "repositories"
  | "issues"
  | "changes"
  | "environments"
  | "pipelines"
  | "activity"
  | "agents"
  | "roadmap"
  | "decisions"
  | "local-actions"
  | "documents"
  | "commercial"
  | "health";

const projectTabs: readonly ProjectTab[] = [
  "overview",
  "repositories",
  "issues",
  "changes",
  "environments",
  "pipelines",
  "activity",
  "agents",
  "roadmap",
  "decisions",
  "local-actions",
  "documents",
  "commercial",
  "health",
];

function isProjectTab(value: string | null): value is ProjectTab {
  return Boolean(value) && projectTabs.includes(value as ProjectTab);
}

type ProjectHealth = {
  label: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

function getProjectHealth(repositories: Repository[]): ProjectHealth {
  if (!repositories.length) {
    return {
      label: "À configurer",
      detail: "Aucun repository",
      tone: "neutral",
    };
  }

  const unavailableCount = repositories.filter(
    ({ state }) => state.availability === "unavailable",
  ).length;
  if (unavailableCount) {
    return {
      label: "Attention requise",
      detail: `${unavailableCount} repository indisponible${unavailableCount > 1 ? "s" : ""}`,
      tone: "danger",
    };
  }

  const dirtyCount = repositories.filter(({ state }) => state.isDirty).length;
  if (dirtyCount) {
    return {
      label: "Travail en cours",
      detail: `${dirtyCount} working tree modifié${dirtyCount > 1 ? "s" : ""}`,
      tone: "warning",
    };
  }

  return {
    label: "Opérationnel",
    detail: "Tous les repositories sont propres",
    tone: "success",
  };
}

function healthToneClasses(tone: ProjectHealth["tone"]): string {
  if (tone === "success") return "bg-emerald-500 ring-emerald-500/20";
  if (tone === "warning") return "bg-amber-500 ring-amber-500/20";
  if (tone === "danger") return "bg-destructive ring-destructive/20";
  return "bg-muted-foreground ring-muted-foreground/15";
}

function getDeadlineLabel(deadline: string | null): string {
  if (!deadline) return "Non planifiée";

  const target = new Date(`${deadline}T23:59:59`);
  const days = Math.ceil((target.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Dépassée de ${Math.abs(days)} j`;
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

function MetadataRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof CalendarCheck2;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium">{value}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RepositoryPanel({
  projectId,
  repository,
  connections,
  onChanged,
  onError,
}: {
  projectId: string;
  repository: Repository;
  connections: ProviderConnection[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const state = repository.state;
  const [isMutating, setIsMutating] = useState(false);
  const compatibleConnections = connections.filter(
    (connection) =>
      repository.provider === "unknown" ||
      connection.provider === repository.provider,
  );

  async function changeConnection(connectionId: string) {
    setIsMutating(true);
    try {
      await associateRepositoryConnection(
        projectId,
        repository.id,
        connectionId || null,
      );
      await onChanged();
    } catch (mutationError) {
      onError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de modifier la connexion.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function removeRepository() {
    if (
      !window.confirm(
        `Retirer ${repository.name} de ce projet ? Le dossier local et le repository distant ne seront pas supprimés.`,
      )
    ) {
      return;
    }
    setIsMutating(true);
    try {
      await removeProjectRepository(projectId, repository.id);
      await onChanged();
    } catch (mutationError) {
      onError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de retirer le repository.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-b p-4">
        <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/35">
          <FolderGit2 className="size-4" />
        </div>
        <div className="min-w-0">
          <CardTitle className="truncate text-sm">{repository.name}</CardTitle>
          <CardDescription className="mt-0.5 truncate font-mono text-[10px]">
            {repository.localPath}
          </CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {providerLabel(repository.provider)}
          </Badge>
          {state.availability === "unavailable" ? (
            <Badge variant="destructive" className="text-[10px]">
              Indisponible
            </Badge>
          ) : state.isDirty ? (
            <Badge
              variant="secondary"
              className="bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
            >
              {state.changedFilesCount} modifié
              {state.changedFilesCount > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge className="bg-emerald-600 text-[10px] text-white">
              Propre
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {state.availability === "unavailable" ? (
          <div className="m-4 flex gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Repository introuvable</p>
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                {state.error}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid divide-y border-b sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <div className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
                <GitBranch className="size-3" /> Branche
              </div>
              <p className="mt-2 truncate font-mono text-xs font-semibold">
                {state.branch ?? "HEAD détachée"}
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
                <GitCommitHorizontal className="size-3" /> Commit
              </div>
              <p className="mt-2 font-mono text-xs font-semibold">
                {state.head?.shortSha ?? "—"}
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
                <HardDrive className="size-3" /> Working tree
              </div>
              <p className="mt-2 text-xs font-semibold">
                {state.isDirty
                  ? `${state.changedFilesCount} fichier${state.changedFilesCount > 1 ? "s" : ""}`
                  : "Synchronisé"}
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
                <Clock3 className="size-3" /> Activité
              </div>
              <p className="mt-2 text-xs font-semibold">
                {state.head ? formatRelativeDate(state.head.committedAt) : "—"}
              </p>
            </div>
          </div>
        )}

        {state.head ? (
          <div className="flex items-start gap-3 border-b px-4 py-3.5">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {state.head.message}
              </p>
              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                {state.head.sha} · {formatDate(state.head.committedAt)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Remote origin
            </p>
            <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
              {repository.remoteUrl ?? "Aucun remote origin configuré"}
            </p>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label
              htmlFor={`connection-${repository.id}`}
              className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              Connexion provider
            </label>
            <select
              id={`connection-${repository.id}`}
              className="h-8 w-full cursor-pointer appearance-auto rounded-lg border border-input bg-transparent px-2.5 pr-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={repository.connectionId ?? ""}
              disabled={isMutating}
              onChange={(event) => void changeConnection(event.target.value)}
            >
              <option value="">Aucune connexion explicite</option>
              {compatibleConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.provider === "github" ? "GitHub" : "GitLab"} · @
                  {connection.account.username}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            disabled={isMutating}
            onClick={() => void removeRepository()}
          >
            <Trash2 /> Retirer
          </Button>
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
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");

  useEffect(() => {
    const searchParams = new URL(window.location.href).searchParams;
    const requestedTab = searchParams.get("tab");
    const targetTab: ProjectTab | null = searchParams.has("change")
      ? "changes"
      : searchParams.has("issue")
        ? "issues"
        : isProjectTab(requestedTab)
          ? requestedTab
          : null;
    if (!targetTab) return;
    const timeout = window.setTimeout(() => setActiveTab(targetTab), 0);
    return () => window.clearTimeout(timeout);
  }, []);

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

  const health = useMemo(
    () => getProjectHealth(project?.repositories ?? []),
    [project?.repositories],
  );

  async function reloadAfterRepositoryChange() {
    await loadProject();
    setPipelineRefreshKey((current) => current + 1);
  }

  async function handleArchive() {
    if (!project || !window.confirm(`Archiver le projet ${project.name} ?`))
      return;
    setIsArchiving(true);
    try {
      const archived = await archiveProject(project.id);
      setProject(archived);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Impossible d’archiver le projet.",
      );
    } finally {
      setIsArchiving(false);
    }
  }

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
    <div className="space-y-6">
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
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/projects/${project.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil /> Modifier
          </Link>
          {project.status !== "archived" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isArchiving}
              onClick={() => void handleArchive()}
            >
              <Archive /> Archiver
            </Button>
          ) : null}
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
      </div>

      <section
        id="overview"
        className="relative overflow-hidden rounded-xl border bg-card"
      >
        <div className="pointer-events-none absolute -top-20 right-0 size-64 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="relative grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <ClientAvatar
              name={project.name}
              logoDataUrl={project.logoDataUrl}
              size="md"
              className="size-14 rounded-2xl bg-background shadow-sm"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {statusLabels[project.status]}
                </Badge>
                <Badge variant="outline">
                  {project.client?.name ?? "Projet personnel"}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Mis à jour {formatRelativeDate(project.updatedAt)}
                </span>
              </div>
              <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                {project.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {project.description ??
                  "Le centre de pilotage opérationnel de ce projet."}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {project.types.map((type) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className="bg-background/60"
                  >
                    {typeLabels[type] ?? type}
                  </Badge>
                ))}
                {project.technologies.slice(0, 5).map((technology) => (
                  <Badge
                    key={technology}
                    variant="secondary"
                    className="font-mono text-[10px]"
                  >
                    {technology}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-w-56 items-start gap-3 rounded-xl border bg-background/75 p-4 shadow-sm backdrop-blur">
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full ring-4",
                healthToneClasses(health.tone),
              )}
            />
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                État opérationnel
              </p>
              <p className="mt-1 text-sm font-semibold">{health.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {health.detail}
              </p>
            </div>
          </div>
        </div>

        <div className="relative grid border-t bg-muted/[0.18] sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4">
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
              <Signal className="size-3" /> Repositories
            </div>
            <p className="mt-1.5 font-heading text-xl font-semibold">
              {project.repositories.length}
            </p>
          </div>
          <div className="border-t p-4 sm:border-t-0 sm:border-l">
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
              <CircleDot className="size-3" /> Priorité
            </div>
            <p className="mt-1.5 text-sm font-semibold">
              {priorityLabels[project.priority]}
            </p>
          </div>
          <div className="border-t p-4 lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
              <CalendarCheck2 className="size-3" /> Deadline
            </div>
            <p className="mt-1.5 text-sm font-semibold">
              {getDeadlineLabel(project.deadline)}
            </p>
          </div>
          <div className="border-t p-4 sm:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase">
              <Activity className="size-3" /> Dernière activité
            </div>
            <p className="mt-1.5 text-sm font-semibold">
              {formatRelativeDate(project.updatedAt)}
            </p>
          </div>
        </div>
      </section>

      <nav
        aria-label="Sections du projet"
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b"
      >
        {(
          [
            ["overview", "Vue d’ensemble"],
            ["repositories", `Repositories · ${project.repositories.length}`],
            ["issues", "Issues"],
            ["changes", "PR / MR"],
            ["environments", "Environnements"],
            ["pipelines", "CI / CD"],
            ["activity", "Activité"],
            ["agents", "Agents"],
            ["roadmap", "Roadmap"],
            ["decisions", "Décisions"],
            ["local-actions", "Actions locales"],
            ["documents", "Documents"],
            ["commercial", "Temps & budget"],
            ["health", "Santé"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={cn(
              "shrink-0 cursor-pointer border-b-2 px-3 py-3 text-xs whitespace-nowrap transition-colors",
              activeTab === tab
                ? "border-primary font-semibold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-8">
          {activeTab === "overview" ? (
            <ProjectAttentionPanel
              project={project}
              refreshKey={pipelineRefreshKey}
              onNavigate={setActiveTab}
            />
          ) : null}

          {activeTab === "overview" || activeTab === "repositories" ? (
            <section id="repositories" className="scroll-mt-6 space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-heading text-base font-semibold">
                    Cibles de développement
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    État local, branche active et liaison au provider distant.
                  </p>
                </div>
                <Link
                  href={`/projects/${project.id}/repositories/new`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Plus /> Ajouter
                </Link>
              </div>
              {project.repositories.map((repository) => (
                <RepositoryPanel
                  key={repository.id}
                  projectId={project.id}
                  repository={repository}
                  connections={connections}
                  onChanged={reloadAfterRepositoryChange}
                  onError={setError}
                />
              ))}
              {!project.repositories.length ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Aucun repository associé à ce projet.
                  </CardContent>
                </Card>
              ) : null}
            </section>
          ) : null}

          {activeTab === "issues" ? (
            <div id="issues" className="scroll-mt-6">
              <ProjectIssuesPanel
                projectId={project.id}
                refreshKey={pipelineRefreshKey}
              />
            </div>
          ) : null}

          {activeTab === "changes" ? (
            <div id="changes" className="scroll-mt-6">
              <ProjectPullRequestsPanel
                projectId={project.id}
                refreshKey={pipelineRefreshKey}
              />
            </div>
          ) : null}

          {activeTab === "environments" ? (
            <div id="environments" className="scroll-mt-6">
              <ProjectEnvironmentsPanel
                projectId={project.id}
                refreshKey={pipelineRefreshKey}
              />
            </div>
          ) : null}

          {activeTab === "pipelines" ? (
            <div id="pipelines" className="scroll-mt-6">
              <ProjectPipelinesPanel
                projectId={project.id}
                refreshKey={pipelineRefreshKey}
              />
            </div>
          ) : null}

          {activeTab === "activity" ? (
            <div id="activity" className="scroll-mt-6">
              <ProjectActivityPanel
                projectId={project.id}
                refreshKey={pipelineRefreshKey}
              />
            </div>
          ) : null}

          {activeTab === "agents" ? (
            <div id="agents" className="scroll-mt-6">
              <ProjectAgentsPanel projectId={project.id} />
            </div>
          ) : null}

          {activeTab === "roadmap" ? (
            <div id="roadmap" className="scroll-mt-6">
              <ProjectRoadmapPanel
                projectId={project.id}
                refreshKey={pipelineRefreshKey}
              />
            </div>
          ) : null}

          {activeTab === "decisions" ? (
            <div id="decisions" className="scroll-mt-6">
              <ProjectDecisionsPanel
                projectId={project.id}
                refreshKey={pipelineRefreshKey}
              />
            </div>
          ) : null}

          {activeTab === "local-actions" ? (
            <div id="local-actions" className="scroll-mt-6">
              <ProjectLocalActionsPanel
                projectId={project.id}
                repositories={project.repositories}
              />
            </div>
          ) : null}

          {activeTab === "documents" ? (
            <div id="documents" className="scroll-mt-6">
              <ProjectDocumentsPanel
                projectId={project.id}
                repositories={project.repositories}
              />
            </div>
          ) : null}

          {activeTab === "commercial" ? (
            <div id="commercial" className="scroll-mt-6">
              <ProjectCommercialPanel projectId={project.id} />
            </div>
          ) : null}

          {activeTab === "health" ? (
            <div id="health" className="scroll-mt-6">
              <ProjectHealthPanel projectId={project.id} />
            </div>
          ) : null}
        </main>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>Cadre du projet</CardTitle>
              <CardDescription className="text-xs">
                Les repères essentiels pour garder le cap.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <MetadataRow
                icon={CalendarCheck2}
                label="Planning"
                value={
                  project.deadline
                    ? formatCalendarDate(project.deadline)
                    : "Aucune deadline"
                }
                detail={
                  project.startDate
                    ? `Début ${formatCalendarDate(project.startDate)}`
                    : "Date de début non renseignée"
                }
              />
              <MetadataRow
                icon={Layers3}
                label="Nature"
                value={
                  project.types.length
                    ? project.types
                        .map((type) => typeLabels[type] ?? type)
                        .join(", ")
                    : "Non renseignée"
                }
                detail={`Priorité ${priorityLabels[project.priority].toLowerCase()}`}
              />
              <MetadataRow
                icon={Code2}
                label="Stack"
                value={
                  project.technologies.length
                    ? project.technologies.join(", ")
                    : "À renseigner"
                }
              />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>Relation client</CardTitle>
            </CardHeader>
            <CardContent>
              {project.client ? (
                <Link
                  href={`/clients/${project.client.id}`}
                  className="group flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <ClientAvatar
                    name={project.client.name}
                    logoDataUrl={null}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold group-hover:text-primary">
                      {project.client.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Ouvrir la fiche client
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-muted-foreground">
                  <UserRound className="size-4" />
                  <p className="text-xs">Projet personnel</p>
                </div>
              )}

              <div className="mt-4 rounded-lg bg-primary/[0.05] p-3 ring-1 ring-primary/10">
                <div className="flex items-center gap-2 text-primary">
                  <MessageSquareText className="size-3.5" />
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase">
                    Prochain follow-up
                  </p>
                </div>
                <p className="mt-2 text-xs font-semibold">
                  {project.followUp
                    ? formatCalendarDate(project.followUp.date)
                    : "Non planifié"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {project.followUp?.note ??
                    "Ajoutez une échéance de suivi depuis l’édition du projet."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="divide-y">
              <MetadataRow
                icon={Clock3}
                label="Créé"
                value={formatDate(project.createdAt)}
              />
              <MetadataRow
                icon={RefreshCw}
                label="Dernière mise à jour"
                value={formatRelativeDate(project.updatedAt)}
                detail={formatDate(project.updatedAt)}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
