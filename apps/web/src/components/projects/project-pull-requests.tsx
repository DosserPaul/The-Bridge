"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  CircleX,
  ExternalLink,
  GitBranch,
  GitFork,
  GitMerge,
  GitPullRequest,
  LoaderCircle,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { MarkdownContent } from "@/components/projects/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectPullRequest,
  getProjectPullRequests,
  type ChangeStatus,
  type ProjectPullRequestDetail,
  type ProjectPullRequests,
  type PullRequest,
  type PullRequestState,
  type RepositoryPullRequests,
} from "@/lib/api";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ChangeFilter = "open" | "merged" | "closed" | "all";
type SelectedChange = { repositoryId: string; number: number };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const stateLabels: Record<PullRequestState, string> = {
  open: "Ouverte",
  draft: "Brouillon",
  merged: "Fusionnée",
  closed: "Fermée",
};

function StateBadge({ state }: { state: PullRequestState }) {
  if (state === "merged") {
    return <Badge className="bg-blue-600 text-white">Fusionnée</Badge>;
  }
  if (state === "open") {
    return <Badge className="bg-emerald-600 text-white">Ouverte</Badge>;
  }
  return <Badge variant="secondary">{stateLabels[state]}</Badge>;
}

function PipelineBadge({ status }: { status: ChangeStatus }) {
  if (status === "success") {
    return (
      <Badge variant="outline" className="text-emerald-600">
        <CircleCheck data-icon="inline-start" /> CI réussie
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive">
        <CircleX data-icon="inline-start" /> CI en échec
      </Badge>
    );
  }
  if (status === "running" || status === "pending") {
    return (
      <Badge variant="secondary">
        <LoaderCircle
          className={status === "running" ? "animate-spin" : undefined}
          data-icon="inline-start"
        />
        CI {status === "running" ? "en cours" : "en attente"}
      </Badge>
    );
  }
  return <Badge variant="outline">CI inconnue</Badge>;
}

function selectedChangeFromUrl(): SelectedChange | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get("change");
  if (!value) return null;
  const separator = value.lastIndexOf(":");
  const repositoryId = value.slice(0, separator);
  const number = Number(value.slice(separator + 1));
  return repositoryId && Number.isInteger(number) && number > 0
    ? { repositoryId, number }
    : null;
}

function setChangeInUrl(change: SelectedChange | null) {
  const url = new URL(window.location.href);
  if (change) {
    url.searchParams.set("change", `${change.repositoryId}:${change.number}`);
  } else {
    url.searchParams.delete("change");
  }
  window.history.replaceState(window.history.state, "", url);
}

function PullRequestDialog({
  projectId,
  selectedChange,
  onClose,
}: {
  projectId: string;
  selectedChange: SelectedChange;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<ProjectPullRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => dialogRef.current?.showModal(), []);
  useEffect(() => {
    const controller = new AbortController();
    void getProjectPullRequest(
      projectId,
      selectedChange.repositoryId,
      selectedChange.number,
      controller.signal,
    )
      .then((data) => {
        setDetail(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger cette pull request.",
          );
        }
      });
    return () => controller.abort();
  }, [projectId, selectedChange]);

  const change = detail?.pullRequest;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="change-detail-title"
      className="m-auto h-dvh max-h-none w-screen max-w-none overflow-hidden bg-background p-0 text-foreground backdrop:bg-black/70 sm:h-[min(850px,calc(100dvh-48px))] sm:w-[min(1050px,calc(100vw-48px))] sm:rounded-2xl sm:border sm:shadow-2xl"
      onClose={onClose}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {detail
                ? `${detail.provider} · ${detail.repositoryName}`
                : "Chargement"}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              #{selectedChange.number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {change ? (
              <a
                href={change.webUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink data-icon="inline-start" />
                Ouvrir sur {detail?.provider === "github" ? "GitHub" : "GitLab"}
              </a>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Fermer le détail de la pull request"
              onClick={() => dialogRef.current?.close()}
            >
              <X />
            </Button>
          </div>
        </header>

        {error ? (
          <div className="flex flex-1 items-center justify-center p-6 text-destructive">
            <AlertTriangle className="mr-3 size-5" />
            <p className="text-sm">{error}</p>
          </div>
        ) : !change ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <LoaderCircle className="mr-3 size-5 animate-spin" />
            <p className="text-xs">Chargement du détail…</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_280px]">
              <main className="min-w-0 p-5 sm:p-7 lg:border-r">
                <div className="flex flex-wrap gap-2">
                  <StateBadge state={change.state} />
                  <PipelineBadge status={change.pipelineStatus} />
                  {change.hasConflicts ? (
                    <Badge variant="destructive">Conflits</Badge>
                  ) : null}
                </div>
                <h2
                  id="change-detail-title"
                  className="mt-4 font-heading text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
                >
                  {change.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                  <GitBranch className="size-3.5" />
                  <span>{change.sourceBranch}</span>
                  <ArrowRight className="size-3" />
                  <span>{change.targetBranch}</span>
                </div>
                <section className="mt-7 rounded-xl border bg-card p-4 sm:p-6">
                  {change.description?.trim() ? (
                    <MarkdownContent>{change.description}</MarkdownContent>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Aucune description.
                    </p>
                  )}
                </section>
              </main>
              <aside className="space-y-6 bg-muted/15 p-5 sm:p-6">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Auteur
                  </p>
                  <p className="mt-2 text-xs font-semibold">
                    @{change.author.username}
                  </p>
                </div>
                <div className="border-t pt-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UsersRound className="size-3.5" />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Reviewers
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed">
                    {change.reviewers.length
                      ? change.reviewers
                          .map(({ username }) => `@${username}`)
                          .join(", ")
                      : "Aucun reviewer"}
                  </p>
                </div>
                <div className="border-t pt-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Fusion
                    </p>
                  </div>
                  <p className="mt-2 text-xs font-medium">
                    {change.hasConflicts
                      ? "Conflits à résoudre"
                      : change.mergeable === true
                        ? "Prête à fusionner"
                        : change.mergeable === false
                          ? "Fusion bloquée"
                          : "État non disponible"}
                  </p>
                </div>
                <div className="border-t pt-5 text-xs">
                  <p className="text-[10px] text-muted-foreground">
                    Mise à jour
                  </p>
                  <p className="mt-1 font-medium">
                    {formatDate(change.updatedAt)}
                  </p>
                  <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                    {change.shortSha}
                  </p>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

function PullRequestRow({
  change,
  onSelect,
}: {
  change: PullRequest;
  onSelect: () => void;
}) {
  return (
    <div className="group flex border-b last:border-b-0 hover:bg-muted/30">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer gap-3 px-4 py-4 text-left"
        onClick={onSelect}
      >
        <GitPullRequest className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs leading-relaxed font-semibold group-hover:text-primary">
              <span className="mr-2 font-mono font-normal text-muted-foreground">
                #{change.number}
              </span>
              {change.title}
            </p>
            <div className="flex gap-1.5">
              <StateBadge state={change.state} />
              <PipelineBadge status={change.pipelineStatus} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserRound className="size-3" />@{change.author.username}
            </span>
            <span className="font-mono">
              {change.sourceBranch} → {change.targetBranch}
            </span>
            <span>mise à jour {formatRelativeDate(change.updatedAt)}</span>
            {change.hasConflicts ? (
              <span className="font-semibold text-destructive">Conflits</span>
            ) : null}
          </div>
        </div>
      </button>
      <a
        href={change.webUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Ouvrir la pull request #${change.number} sur le provider`}
        className="flex w-11 items-center justify-center border-l text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

function RepositoryGroup({
  repository,
  filter,
  onSelect,
}: {
  repository: RepositoryPullRequests;
  filter: ChangeFilter;
  onSelect: (change: SelectedChange) => void;
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

  const changes = repository.pullRequests.filter((change) => {
    if (filter === "all") return true;
    if (filter === "open")
      return change.state === "open" || change.state === "draft";
    return change.state === filter;
  });

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b bg-muted/25 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitFork className="size-4 text-muted-foreground" />
          <p className="text-xs font-semibold">{repository.repositoryName}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {changes.length} changement{changes.length > 1 ? "s" : ""}
        </span>
      </div>
      {changes.length ? (
        changes.map((change) => (
          <PullRequestRow
            key={change.id}
            change={change}
            onSelect={() =>
              onSelect({
                repositoryId: repository.repositoryId,
                number: change.number,
              })
            }
          />
        ))
      ) : (
        <div className="py-10 text-center text-xs text-muted-foreground">
          <GitMerge className="mx-auto mb-2 size-5 opacity-60" />
          Aucun changement dans ce filtre.
        </div>
      )}
    </div>
  );
}

export function ProjectPullRequestsPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [view, setView] = useState<ProjectPullRequests | null>(null);
  const [filter, setFilter] = useState<ChangeFilter>("open");
  const [selectedChange, setSelectedChange] = useState<SelectedChange | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void getProjectPullRequests(projectId, controller.signal)
      .then((data) => {
        setView(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les pull requests.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [projectId, refreshKey]);

  useEffect(() => {
    const sync = () => setSelectedChange(selectedChangeFromUrl());
    const timeout = window.setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const selectChange = useCallback((change: SelectedChange) => {
    setSelectedChange(change);
    setChangeInUrl(change);
  }, []);
  const closeChange = useCallback(() => {
    setSelectedChange(null);
    setChangeInUrl(null);
  }, []);

  const counts = useMemo(() => {
    const changes =
      view?.repositories.flatMap((repository) => repository.pullRequests) ?? [];
    return {
      all: changes.length,
      open: changes.filter(
        (change) => change.state === "open" || change.state === "draft",
      ).length,
      merged: changes.filter((change) => change.state === "merged").length,
      closed: changes.filter((change) => change.state === "closed").length,
    };
  }, [view]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Pull requests / Merge requests
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Reviews, CI et capacité de fusion pour chaque repository.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-1">
          {(
            [
              ["open", "Ouvertes"],
              ["merged", "Fusionnées"],
              ["closed", "Fermées"],
              ["all", "Toutes"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={filter === value ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setFilter(value)}
            >
              {label} · {counts[value]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-full" />
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
                filter={filter}
                onSelect={selectChange}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {selectedChange ? (
        <PullRequestDialog
          key={`${selectedChange.repositoryId}:${selectedChange.number}`}
          projectId={projectId}
          selectedChange={selectedChange}
          onClose={closeChange}
        />
      ) : null}
    </section>
  );
}
