"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  CircleDot,
  GitPullRequest,
  HardDrive,
  MessageSquareWarning,
  Rocket,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectEnvironments,
  getProjectIssues,
  getProjectPipelines,
  getProjectPullRequests,
  listProjectMilestones,
  type Project,
  type ProjectEnvironments,
  type ProjectIssues,
  type ProjectPipelines,
  type ProjectPullRequests,
  type ProjectMilestone,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type AttentionTab =
  | "repositories"
  | "issues"
  | "changes"
  | "environments"
  | "pipelines"
  | "roadmap";

type AttentionSignal = {
  id: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  tab: AttentionTab;
  icon: typeof AlertTriangle;
};

type RemoteSignals = {
  issues: ProjectIssues | null;
  pipelines: ProjectPipelines | null;
  pullRequests: ProjectPullRequests | null;
  environments: ProjectEnvironments | null;
  milestones: ProjectMilestone[];
};

function daysUntil(date: string): number {
  return Math.ceil(
    (new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86_400_000,
  );
}

export function ProjectAttentionPanel({
  project,
  refreshKey,
  onNavigate,
}: {
  project: Project;
  refreshKey: number;
  onNavigate: (tab: AttentionTab) => void;
}) {
  const [remote, setRemote] = useState<RemoteSignals>({
    issues: null,
    pipelines: null,
    pullRequests: null,
    environments: null,
    milestones: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      getProjectIssues(project.id, controller.signal),
      getProjectPipelines(project.id, controller.signal),
      getProjectPullRequests(project.id, controller.signal),
      getProjectEnvironments(project.id, controller.signal),
      listProjectMilestones(project.id, controller.signal),
    ]).then(([issues, pipelines, pullRequests, environments, milestones]) => {
      if (controller.signal.aborted) return;
      setRemote({
        issues: issues.status === "fulfilled" ? issues.value : null,
        pipelines: pipelines.status === "fulfilled" ? pipelines.value : null,
        pullRequests:
          pullRequests.status === "fulfilled" ? pullRequests.value : null,
        environments:
          environments.status === "fulfilled" ? environments.value : null,
        milestones: milestones.status === "fulfilled" ? milestones.value : [],
      });
      setIsLoading(false);
    });
    return () => controller.abort();
  }, [project.id, refreshKey]);

  const signals = useMemo(() => {
    const next: AttentionSignal[] = [];
    const unavailable = project.repositories.filter(
      ({ state }) => state.availability === "unavailable",
    );
    if (unavailable.length) {
      next.push({
        id: "repository-unavailable",
        severity: "critical",
        title: `${unavailable.length} repository indisponible${unavailable.length > 1 ? "s" : ""}`,
        detail: unavailable.map(({ name }) => name).join(", "),
        tab: "repositories",
        icon: HardDrive,
      });
    }
    const dirty = project.repositories.filter(({ state }) => state.isDirty);
    if (dirty.length) {
      next.push({
        id: "repository-dirty",
        severity: "warning",
        title: `${dirty.length} working tree modifié${dirty.length > 1 ? "s" : ""}`,
        detail: dirty
          .map(({ name, state }) => `${name} · ${state.changedFilesCount}`)
          .join(", "),
        tab: "repositories",
        icon: HardDrive,
      });
    }

    if (project.deadline) {
      const days = daysUntil(project.deadline);
      if (days < 0 || days <= 7) {
        next.push({
          id: "deadline",
          severity: days < 0 ? "critical" : "warning",
          title: days < 0 ? "Deadline dépassée" : "Deadline proche",
          detail:
            days < 0
              ? `${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""} de retard`
              : `Dans ${days} jour${days > 1 ? "s" : ""}`,
          tab: "repositories",
          icon: CalendarClock,
        });
      }
    }
    if (project.followUp && daysUntil(project.followUp.date) < 0) {
      next.push({
        id: "follow-up",
        severity: "warning",
        title: "Follow-up en retard",
        detail: project.followUp.note ?? "Aucune note associée",
        tab: "issues",
        icon: MessageSquareWarning,
      });
    }

    const overdueMilestones = remote.milestones.filter(
      (milestone) =>
        milestone.dueDate &&
        milestone.status !== "completed" &&
        milestone.status !== "canceled" &&
        daysUntil(milestone.dueDate) < 0,
    );
    if (overdueMilestones.length) {
      next.push({
        id: "milestones-overdue",
        severity: "critical",
        title: `${overdueMilestones.length} jalon${overdueMilestones.length > 1 ? "s" : ""} en retard`,
        detail: overdueMilestones.map(({ title }) => title).join(", "),
        tab: "roadmap",
        icon: CalendarClock,
      });
    }
    const riskyMilestones = remote.milestones.filter(
      (milestone) =>
        milestone.status !== "completed" &&
        milestone.status !== "canceled" &&
        (milestone.riskLevel === "high" || Boolean(milestone.blockers)),
    );
    if (riskyMilestones.length) {
      next.push({
        id: "milestones-risky",
        severity: "warning",
        title: `${riskyMilestones.length} jalon${riskyMilestones.length > 1 ? "s" : ""} à risque`,
        detail: riskyMilestones.map(({ title }) => title).join(", "),
        tab: "roadmap",
        icon: AlertTriangle,
      });
    }

    const failedPipelines =
      remote.pipelines?.repositories.filter(
        (repository) => repository.pipelines[0]?.status === "failed",
      ) ?? [];
    if (failedPipelines.length) {
      next.push({
        id: "pipeline-failed",
        severity: "critical",
        title: `${failedPipelines.length} exécution${failedPipelines.length > 1 ? "s" : ""} CI / CD en échec`,
        detail: failedPipelines
          .map(({ repositoryName }) => repositoryName)
          .join(", "),
        tab: "pipelines",
        icon: Workflow,
      });
    }

    const openChanges =
      remote.pullRequests?.repositories.flatMap((repository) =>
        repository.pullRequests.filter(
          (change) => change.state === "open" || change.state === "draft",
        ),
      ) ?? [];
    const conflicted = openChanges.filter((change) => change.hasConflicts);
    if (conflicted.length) {
      next.push({
        id: "changes-conflicted",
        severity: "critical",
        title: `${conflicted.length} PR/MR avec conflits`,
        detail: conflicted
          .slice(0, 3)
          .map(({ title }) => title)
          .join(", "),
        tab: "changes",
        icon: GitPullRequest,
      });
    }
    const awaitingReview = openChanges.filter(
      (change) => !change.hasConflicts && !change.reviewers.length,
    );
    if (awaitingReview.length) {
      next.push({
        id: "changes-review",
        severity: "warning",
        title: `${awaitingReview.length} PR/MR sans reviewer`,
        detail: awaitingReview
          .slice(0, 3)
          .map(({ title }) => title)
          .join(", "),
        tab: "changes",
        icon: GitPullRequest,
      });
    }

    const failedDeployments =
      remote.environments?.repositories.flatMap((repository) =>
        repository.environments.filter(
          (environment) => environment.state === "failed",
        ),
      ) ?? [];
    if (failedDeployments.length) {
      next.push({
        id: "deployment-failed",
        severity: "critical",
        title: `${failedDeployments.length} déploiement${failedDeployments.length > 1 ? "s" : ""} en échec`,
        detail: failedDeployments.map(({ name }) => name).join(", "),
        tab: "environments",
        icon: Rocket,
      });
    }

    const providerGaps = [
      {
        label: "issues",
        tab: "issues" as const,
        repositories: remote.issues?.repositories,
      },
      {
        label: "PR/MR",
        tab: "changes" as const,
        repositories: remote.pullRequests?.repositories,
      },
      {
        label: "CI / CD",
        tab: "pipelines" as const,
        repositories: remote.pipelines?.repositories,
      },
      {
        label: "déploiements",
        tab: "environments" as const,
        repositories: remote.environments?.repositories,
      },
    ].flatMap(({ label, tab, repositories }) =>
      (repositories ?? [])
        .filter(({ state }) => state !== "ready")
        .map(({ repositoryName, message }) => ({
          label,
          tab,
          repositoryName,
          message,
        })),
    );
    if (providerGaps.length) {
      next.push({
        id: "provider-data-incomplete",
        severity: "warning",
        title: "Données provider incomplètes",
        detail: providerGaps
          .slice(0, 3)
          .map(
            ({ label, repositoryName, message }) =>
              `${label} · ${repositoryName}${message ? ` : ${message}` : ""}`,
          )
          .join(", "),
        tab: providerGaps[0].tab,
        icon: AlertTriangle,
      });
    }

    const blockingIssues =
      remote.issues?.repositories.flatMap((repository) =>
        repository.issues.filter(
          (issue) =>
            issue.state === "open" &&
            issue.labels.some((label) =>
              /(?:blocking|critical|priority::high|priority:high)/i.test(label),
            ),
        ),
      ) ?? [];
    if (blockingIssues.length) {
      next.push({
        id: "issues-blocking",
        severity: "warning",
        title: `${blockingIssues.length} issue${blockingIssues.length > 1 ? "s" : ""} prioritaire${blockingIssues.length > 1 ? "s" : ""}`,
        detail: blockingIssues
          .slice(0, 3)
          .map(({ title }) => title)
          .join(", "),
        tab: "issues",
        icon: CircleDot,
      });
    }

    return next.sort((left, right) =>
      left.severity === right.severity
        ? 0
        : left.severity === "critical"
          ? -1
          : 1,
    );
  }, [project, remote]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <Card
      className={cn(
        signals.length
          ? "ring-amber-500/20"
          : "bg-emerald-500/[0.03] ring-emerald-500/20",
      )}
    >
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>À surveiller</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Signaux prioritaires calculés depuis Git, les providers et le
              planning.
            </p>
          </div>
          <Badge variant={signals.length ? "secondary" : "outline"}>
            {signals.length
              ? `${signals.length} ${signals.length > 1 ? "signaux" : "signal"}`
              : "Tout va bien"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {signals.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {signals.slice(0, 6).map((signal) => {
              const Icon = signal.icon;
              return (
                <button
                  key={signal.id}
                  type="button"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/35"
                  onClick={() => onNavigate(signal.tab)}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      signal.severity === "critical"
                        ? "text-destructive"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{signal.title}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                      {signal.detail}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2 text-emerald-700 dark:text-emerald-300">
            <CircleCheck className="size-5" />
            <div>
              <p className="text-sm font-semibold">Aucune attention requise</p>
              <p className="mt-0.5 text-xs opacity-75">
                Repositories, CI, changements et déploiements sont au vert.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
