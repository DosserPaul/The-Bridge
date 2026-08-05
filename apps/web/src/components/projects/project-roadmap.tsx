"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Flag,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createProjectMilestone,
  deleteProjectMilestone,
  getProjectIssues,
  listProjectMilestones,
  updateProjectMilestone,
  type Issue,
  type LinkedIssue,
  type MilestoneInput,
  type MilestoneRiskLevel,
  type MilestoneStatus,
  type ProjectIssues,
  type ProjectMilestone,
} from "@/lib/api";
import { formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type IssueOption = LinkedIssue & { state: Issue["state"] };

const statusLabels: Record<MilestoneStatus, string> = {
  planned: "Planifié",
  active: "En cours",
  completed: "Terminé",
  canceled: "Annulé",
};

const riskLabels: Record<MilestoneRiskLevel, string> = {
  low: "Faible",
  medium: "Modéré",
  high: "Élevé",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function flattenIssues(view: ProjectIssues | null): IssueOption[] {
  return (
    view?.repositories.flatMap((repository) =>
      repository.issues.map((issue) => ({
        repositoryId: repository.repositoryId,
        repositoryName: repository.repositoryName,
        number: issue.number,
        title: issue.title,
        webUrl: issue.webUrl,
        state: issue.state,
      })),
    ) ?? []
  );
}

function milestoneProgress(
  milestone: ProjectMilestone,
  issueStates: Map<string, Issue["state"]>,
) {
  if (!milestone.linkedIssues.length) {
    return {
      completed: milestone.status === "completed" ? 1 : 0,
      total: 1,
      percentage: milestone.status === "completed" ? 100 : 0,
      unknown: 0,
    };
  }
  let completed = 0;
  let unknown = 0;
  milestone.linkedIssues.forEach((issue) => {
    const state = issueStates.get(`${issue.repositoryId}:${issue.number}`);
    if (state === "closed") completed += 1;
    if (!state) unknown += 1;
  });
  return {
    completed,
    total: milestone.linkedIssues.length,
    percentage: Math.round((completed / milestone.linkedIssues.length) * 100),
    unknown,
  };
}

function MilestoneDialog({
  milestone,
  issueOptions,
  onClose,
  onSave,
}: {
  milestone: ProjectMilestone | null;
  issueOptions: IssueOption[];
  onClose: () => void;
  onSave: (input: MilestoneInput) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [status, setStatus] = useState<MilestoneStatus>(
    milestone?.status ?? "planned",
  );
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? "");
  const [riskLevel, setRiskLevel] = useState<MilestoneRiskLevel>(
    milestone?.riskLevel ?? "low",
  );
  const [blockers, setBlockers] = useState(milestone?.blockers ?? "");
  const [selectedIssues, setSelectedIssues] = useState(
    new Set(
      milestone?.linkedIssues.map(
        (issue) => `${issue.repositoryId}:${issue.number}`,
      ) ?? [],
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => dialogRef.current?.showModal(), []);

  const allIssueOptions = useMemo(() => {
    const known = new Map(
      issueOptions.map((issue) => [
        `${issue.repositoryId}:${issue.number}`,
        issue,
      ]),
    );
    milestone?.linkedIssues.forEach((issue) => {
      const key = `${issue.repositoryId}:${issue.number}`;
      if (!known.has(key)) known.set(key, { ...issue, state: "open" });
    });
    return [...known.values()];
  }, [issueOptions, milestone]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        title,
        description: description || null,
        status,
        dueDate: dueDate || null,
        riskLevel,
        blockers: blockers || null,
        linkedIssues: allIssueOptions
          .filter((issue) =>
            selectedIssues.has(`${issue.repositoryId}:${issue.number}`),
          )
          .map((issue) => ({
            repositoryId: issue.repositoryId,
            repositoryName: issue.repositoryName,
            number: issue.number,
            title: issue.title,
            webUrl: issue.webUrl,
          })),
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d’enregistrer ce jalon.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={milestone ? "Modifier le jalon" : "Créer un jalon"}
      className="m-auto max-h-[90vh] w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/65"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="flex items-start justify-between border-b p-5">
          <div>
            <h3 className="font-heading text-lg font-semibold">
              {milestone ? "Modifier le jalon" : "Nouveau jalon"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Planning, risques et progression liée aux issues.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="max-h-[calc(90vh-145px)] space-y-5 overflow-y-auto p-5">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="milestone-title">Nom</Label>
            <Input
              id="milestone-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-description">Description</Label>
            <textarea
              id="milestone-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="milestone-status">Statut</Label>
              <select
                id="milestone-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as MilestoneStatus)
                }
                className="h-9 w-full cursor-pointer rounded-lg border bg-background px-3 text-sm"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-due-date">Deadline</Label>
              <Input
                id="milestone-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-risk">Risque</Label>
              <select
                id="milestone-risk"
                value={riskLevel}
                onChange={(event) =>
                  setRiskLevel(event.target.value as MilestoneRiskLevel)
                }
                className="h-9 w-full cursor-pointer rounded-lg border bg-background px-3 text-sm"
              >
                {Object.entries(riskLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-blockers">Risques et blocages</Label>
            <textarea
              id="milestone-blockers"
              value={blockers}
              onChange={(event) => setBlockers(event.target.value)}
              rows={3}
              placeholder="Ce qui peut retarder ou bloquer la livraison…"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Issues liées</Label>
            {allIssueOptions.length ? (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
                {allIssueOptions.map((issue) => {
                  const key = `${issue.repositoryId}:${issue.number}`;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIssues.has(key)}
                        onChange={(event) => {
                          setSelectedIssues((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(key);
                            else next.delete(key);
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 text-xs">
                        <span className="font-mono text-muted-foreground">
                          {issue.repositoryName} #{issue.number}
                        </span>{" "}
                        {issue.title}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                Aucune issue disponible. Le jalon peut être créé sans liaison.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSaving || title.trim().length < 2}>
            {isSaving ? <LoaderCircle className="animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function ProjectRoadmapPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [issues, setIssues] = useState<ProjectIssues | null>(null);
  const [editing, setEditing] = useState<ProjectMilestone | null | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [nextMilestones, nextIssues] = await Promise.all([
          listProjectMilestones(projectId, signal),
          getProjectIssues(projectId, signal).catch(() => null),
        ]);
        setMilestones(nextMilestones);
        setIssues(nextIssues);
        setError(null);
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger la roadmap.",
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
    const timeout = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [load, refreshKey]);

  const issueOptions = useMemo(() => flattenIssues(issues), [issues]);
  const issueStates = useMemo(
    () =>
      new Map(
        issueOptions.map((issue) => [
          `${issue.repositoryId}:${issue.number}`,
          issue.state,
        ]),
      ),
    [issueOptions],
  );

  async function save(input: MilestoneInput) {
    if (editing) {
      const updated = await updateProjectMilestone(
        projectId,
        editing.id,
        input,
      );
      setMilestones((current) =>
        current.map((milestone) =>
          milestone.id === updated.id ? updated : milestone,
        ),
      );
    } else {
      const created = await createProjectMilestone(projectId, input);
      setMilestones((current) => [...current, created]);
    }
  }

  async function remove(milestone: ProjectMilestone) {
    if (!window.confirm(`Supprimer le jalon « ${milestone.title} » ?`)) return;
    try {
      await deleteProjectMilestone(projectId, milestone.id);
      setMilestones((current) =>
        current.filter(({ id }) => id !== milestone.id),
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Impossible de supprimer ce jalon.",
      );
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Milestones & roadmap
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Jalons, progression issue par issue, risques et prochaine livraison.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus /> Nouveau jalon
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex gap-3 text-sm text-destructive">
            <AlertTriangle className="size-4" /> {error}
          </CardContent>
        </Card>
      ) : milestones.length ? (
        <div className="relative space-y-4 before:absolute before:top-7 before:bottom-7 before:left-[15px] before:w-px before:bg-border">
          {milestones.map((milestone) => {
            const progress = milestoneProgress(milestone, issueStates);
            return (
              <div key={milestone.id} className="relative pl-10">
                <span
                  className={cn(
                    "absolute top-5 left-2 z-10 flex size-4 items-center justify-center rounded-full border-2 border-background",
                    milestone.status === "completed"
                      ? "bg-emerald-500"
                      : milestone.riskLevel === "high"
                        ? "bg-destructive"
                        : "bg-primary",
                  )}
                />
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {statusLabels[milestone.status]}
                          </Badge>
                          <Badge
                            variant={
                              milestone.riskLevel === "high"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            Risque{" "}
                            {riskLabels[milestone.riskLevel].toLowerCase()}
                          </Badge>
                          {milestone.dueDate ? (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CalendarClock className="size-3" />
                              {formatCalendarDate(milestone.dueDate)}
                            </span>
                          ) : null}
                        </div>
                        <CardTitle className="mt-2 text-base">
                          {milestone.title}
                        </CardTitle>
                        {milestone.description ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {milestone.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Modifier ${milestone.title}`}
                          onClick={() => setEditing(milestone)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Supprimer ${milestone.title}`}
                          onClick={() => void remove(milestone)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-[10px]">
                        <span className="font-medium">Progression</span>
                        <span className="font-mono text-muted-foreground">
                          {progress.completed}/{progress.total} ·{" "}
                          {progress.percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                      {progress.unknown ? (
                        <p className="mt-1.5 text-[10px] text-amber-600">
                          État indisponible pour {progress.unknown} issue
                          {progress.unknown > 1 ? "s" : ""} liée
                          {progress.unknown > 1 ? "s" : ""}.
                        </p>
                      ) : null}
                    </div>
                    {milestone.blockers ? (
                      <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        <div>
                          <p className="font-semibold">Risques et blocages</p>
                          <p className="mt-1 text-muted-foreground">
                            {milestone.blockers}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {milestone.linkedIssues.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {milestone.linkedIssues.map((issue) => {
                          const state = issueStates.get(
                            `${issue.repositoryId}:${issue.number}`,
                          );
                          return (
                            <a
                              key={`${issue.repositoryId}:${issue.number}`}
                              href={issue.webUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[10px] hover:bg-muted/50"
                            >
                              {state === "closed" ? (
                                <CheckCircle2 className="size-3 text-emerald-600" />
                              ) : (
                                <CircleDot className="size-3 text-muted-foreground" />
                              )}
                              {issue.repositoryName} #{issue.number}
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Flag className="size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Aucun jalon planifié</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Crée la prochaine livraison et lie ses issues pour suivre sa
              progression automatiquement.
            </p>
            <Button className="mt-4" size="sm" onClick={() => setEditing(null)}>
              <Plus /> Créer le premier jalon
            </Button>
          </CardContent>
        </Card>
      )}

      {editing !== undefined ? (
        <MilestoneDialog
          milestone={editing}
          issueOptions={issueOptions}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      ) : null}
    </section>
  );
}
