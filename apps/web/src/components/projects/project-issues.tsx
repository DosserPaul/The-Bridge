"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CircleCheck,
  CircleDot,
  ExternalLink,
  GitFork,
  LoaderCircle,
  MessageSquare,
  Settings2,
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
  getProjectIssue,
  getProjectIssues,
  type Issue,
  type IssueComment,
  type ProjectIssueDetail,
  type ProjectIssues,
  type RepositoryIssues,
} from "@/lib/api";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type IssueFilter = "open" | "closed" | "all";
type SelectedIssue = { repositoryId: string; issueNumber: number };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function selectedIssueFromUrl(): SelectedIssue | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get("issue");
  if (!value) return null;
  const separator = value.lastIndexOf(":");
  const repositoryId = value.slice(0, separator);
  const issueNumber = Number(value.slice(separator + 1));
  return repositoryId && Number.isInteger(issueNumber) && issueNumber > 0
    ? { repositoryId, issueNumber }
    : null;
}

function setIssueInUrl(selectedIssue: SelectedIssue | null) {
  const url = new URL(window.location.href);
  if (selectedIssue) {
    url.searchParams.set(
      "issue",
      `${selectedIssue.repositoryId}:${selectedIssue.issueNumber}`,
    );
  } else {
    url.searchParams.delete("issue");
  }
  window.history.replaceState(window.history.state, "", url);
}

function IssueStateBadge({ state }: { state: Issue["state"] }) {
  return state === "open" ? (
    <Badge className="bg-emerald-600 text-white">
      <CircleDot data-icon="inline-start" />
      Ouverte
    </Badge>
  ) : (
    <Badge variant="secondary">
      <CircleCheck data-icon="inline-start" />
      Fermée
    </Badge>
  );
}

function UserAvatar({ username }: { username: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted/60 font-mono text-[10px] font-semibold uppercase">
      {username.slice(0, 2)}
    </span>
  );
}

function IssueCommentCard({ comment }: { comment: IssueComment }) {
  return (
    <article className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-4 border-b bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar username={comment.author.username} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              @{comment.author.username}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatRelativeDate(comment.createdAt)}
            </p>
          </div>
        </div>
        {comment.webUrl ? (
          <a
            href={comment.webUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
            aria-label="Ouvrir ce commentaire sur le provider"
          >
            <ExternalLink />
          </a>
        ) : null}
      </header>
      <div className="p-4">
        <MarkdownContent>{comment.body}</MarkdownContent>
      </div>
    </article>
  );
}

function IssueDetailDialog({
  projectId,
  selectedIssue,
  onClose,
}: {
  projectId: string;
  selectedIssue: SelectedIssue;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<ProjectIssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getProjectIssue(
      projectId,
      selectedIssue.repositoryId,
      selectedIssue.issueNumber,
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
              : "Impossible de charger cette issue.",
          );
        }
      });
    return () => controller.abort();
  }, [projectId, selectedIssue]);

  const issue = detail?.issue;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="issue-detail-title"
      className="m-auto h-dvh max-h-none w-screen max-w-none overflow-hidden bg-background p-0 text-foreground backdrop:bg-black/70 sm:h-[min(900px,calc(100dvh-48px))] sm:w-[min(1100px,calc(100vw-48px))] sm:rounded-2xl sm:border sm:shadow-2xl"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {detail
                ? `${detail.provider} · ${detail.repositoryName}`
                : "Chargement de l’issue"}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              #{selectedIssue.issueNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {issue ? (
              <a
                href={issue.webUrl}
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
              aria-label="Fermer le détail de l’issue"
              onClick={() => dialogRef.current?.close()}
            >
              <X />
            </Button>
          </div>
        </header>

        {error ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <Card className="max-w-lg">
              <CardContent className="flex gap-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">Issue indisponible</p>
                  <p className="mt-1 text-xs leading-relaxed">{error}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : !issue ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-muted-foreground">
              <LoaderCircle className="mx-auto size-5 animate-spin" />
              <p className="mt-3 text-xs">Chargement du détail…</p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_280px]">
              <main className="min-w-0 p-5 sm:p-7 lg:border-r">
                <div className="flex flex-wrap items-center gap-2">
                  <IssueStateBadge state={issue.state} />
                  {issue.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
                <h2
                  id="issue-detail-title"
                  className="mt-4 font-heading text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
                >
                  {issue.title}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ouverte par @{issue.author.username} · mise à jour{" "}
                  {formatRelativeDate(issue.updatedAt)}
                </p>

                <section className="mt-7 rounded-xl border bg-card p-4 sm:p-6">
                  {issue.body?.trim() ? (
                    <MarkdownContent>{issue.body}</MarkdownContent>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Cette issue ne contient aucune description.
                    </p>
                  )}
                </section>

                <section className="mt-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-base font-semibold">
                      Discussion
                    </h3>
                    <Badge variant="secondary">
                      {issue.comments.length} commentaire
                      {issue.comments.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {issue.comments.length ? (
                    issue.comments.map((comment) => (
                      <IssueCommentCard key={comment.id} comment={comment} />
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed py-10 text-center">
                      <MessageSquare className="mx-auto size-5 text-muted-foreground/60" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Aucun commentaire pour le moment.
                      </p>
                    </div>
                  )}
                </section>
              </main>

              <aside className="space-y-6 bg-muted/15 p-5 sm:p-6">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Auteur
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <UserAvatar username={issue.author.username} />
                    <p className="truncate text-xs font-semibold">
                      @{issue.author.username}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UsersRound className="size-3.5" />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Assignations
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed">
                    {issue.assignees.length
                      ? issue.assignees
                          .map(({ username }) => `@${username}`)
                          .join(", ")
                      : "Aucune assignation"}
                  </p>
                </div>

                <div className="border-t pt-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Temporalité
                    </p>
                  </div>
                  <dl className="mt-3 space-y-3 text-xs">
                    <div>
                      <dt className="text-[10px] text-muted-foreground">
                        Créée
                      </dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDate(issue.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">
                        Mise à jour
                      </dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDate(issue.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

function IssueRow({ issue, onSelect }: { issue: Issue; onSelect: () => void }) {
  return (
    <div className="group flex border-b transition-colors last:border-b-0 hover:bg-muted/30">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-4 py-4 text-left"
        onClick={onSelect}
      >
        <span
          className={cn(
            "mt-1 size-2 shrink-0 rounded-full",
            issue.state === "open" ? "bg-emerald-500" : "bg-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 text-xs leading-relaxed font-semibold group-hover:text-primary">
              <span className="mr-2 font-mono font-normal text-muted-foreground">
                #{issue.number}
              </span>
              {issue.title}
            </p>
            <IssueStateBadge state={issue.state} />
          </div>

          {issue.labels.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {issue.labels.slice(0, 4).map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="h-4 px-1.5 text-[9px] text-muted-foreground"
                >
                  {label}
                </Badge>
              ))}
              {issue.labels.length > 4 ? (
                <span className="text-[10px] text-muted-foreground">
                  +{issue.labels.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserRound className="size-3" />@{issue.author.username}
            </span>
            <span>mise à jour {formatRelativeDate(issue.updatedAt)}</span>
            {issue.assignees.length ? (
              <span>
                assignée à{" "}
                {issue.assignees
                  .map(({ username }) => `@${username}`)
                  .join(", ")}
              </span>
            ) : null}
            {issue.commentCount ? (
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3" />
                {issue.commentCount}
              </span>
            ) : null}
          </div>
        </div>
      </button>
      <a
        href={issue.webUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Ouvrir l’issue #${issue.number} sur le provider`}
        className="flex w-11 shrink-0 cursor-pointer items-center justify-center border-l text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

function RepositoryIssueGroup({
  repository,
  filter,
  onSelectIssue,
}: {
  repository: RepositoryIssues;
  filter: IssueFilter;
  onSelectIssue: (selectedIssue: SelectedIssue) => void;
}) {
  const issues = repository.issues.filter(
    (issue) => filter === "all" || issue.state === filter,
  );

  if (repository.state !== "ready") {
    const needsConnection = repository.state === "connection_required";
    const providerName =
      repository.provider === "github"
        ? "GitHub"
        : repository.provider === "gitlab"
          ? "GitLab"
          : "le provider";

    return (
      <div className="rounded-xl border border-dashed p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
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
          {issues.length} issue{issues.length > 1 ? "s" : ""}
        </span>
      </div>
      {issues.length ? (
        issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            onSelect={() =>
              onSelectIssue({
                repositoryId: repository.repositoryId,
                issueNumber: issue.number,
              })
            }
          />
        ))
      ) : (
        <div className="px-4 py-8 text-center">
          <CircleCheck className="mx-auto size-5 text-emerald-600/70" />
          <p className="mt-2 text-xs text-muted-foreground">
            Aucune issue{" "}
            {filter === "open"
              ? "ouverte"
              : filter === "closed"
                ? "fermée"
                : "récente"}
            .
          </p>
        </div>
      )}
    </div>
  );
}

export function ProjectIssuesPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [view, setView] = useState<ProjectIssues | null>(null);
  const [filter, setFilter] = useState<IssueFilter>("open");
  const [selectedIssue, setSelectedIssue] = useState<SelectedIssue | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void getProjectIssues(projectId, controller.signal)
      .then((data) => {
        setView(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les issues.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [projectId, refreshKey]);

  useEffect(() => {
    const syncFromUrl = () => setSelectedIssue(selectedIssueFromUrl());
    const timeout = window.setTimeout(syncFromUrl, 0);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  const openIssue = useCallback((nextIssue: SelectedIssue) => {
    setSelectedIssue(nextIssue);
    setIssueInUrl(nextIssue);
  }, []);

  const closeIssue = useCallback(() => {
    setSelectedIssue(null);
    setIssueInUrl(null);
  }, []);

  const counts = useMemo(() => {
    const issues =
      view?.repositories.flatMap((repository) => repository.issues) ?? [];
    return {
      all: issues.length,
      open: issues.filter((issue) => issue.state === "open").length,
      closed: issues.filter((issue) => issue.state === "closed").length,
    };
  }, [view]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-heading text-base font-semibold">Issues</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Les 20 issues les plus récemment mises à jour par repository.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/20 p-1">
          {(
            [
              ["open", "Ouvertes"],
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
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
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
                <RepositoryIssueGroup
                  key={repository.repositoryId}
                  repository={repository}
                  filter={filter}
                  onSelectIssue={openIssue}
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

      {selectedIssue ? (
        <IssueDetailDialog
          key={`${selectedIssue.repositoryId}:${selectedIssue.issueNumber}`}
          projectId={projectId}
          selectedIssue={selectedIssue}
          onClose={closeIssue}
        />
      ) : null}
    </section>
  );
}
