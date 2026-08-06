"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  Gavel,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { MarkdownContent } from "@/components/projects/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createProjectDecision,
  deleteProjectDecision,
  listProjectDecisions,
  updateProjectDecision,
  type DecisionInput,
  type DecisionStatus,
  type ProjectDecision,
} from "@/lib/api";
import { formatCalendarDate } from "@/lib/format";

const statusLabels: Record<DecisionStatus, string> = {
  proposed: "Proposée",
  accepted: "Acceptée",
  rejected: "Rejetée",
  superseded: "Remplacée",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function DecisionDialog({
  decision,
  onClose,
  onSave,
}: {
  decision: ProjectDecision | null;
  onClose: () => void;
  onSave: (input: DecisionInput) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(decision?.title ?? "");
  const [status, setStatus] = useState<DecisionStatus>(
    decision?.status ?? "proposed",
  );
  const [context, setContext] = useState(decision?.context ?? "");
  const [decisionText, setDecisionText] = useState(decision?.decision ?? "");
  const [rationale, setRationale] = useState(decision?.rationale ?? "");
  const [alternatives, setAlternatives] = useState(
    decision?.alternatives.join("\n") ?? "",
  );
  const [consequences, setConsequences] = useState(
    decision?.consequences ?? "",
  );
  const [participants, setParticipants] = useState(
    decision?.participants.join(", ") ?? "",
  );
  const [decidedAt, setDecidedAt] = useState(
    decision?.decidedAt ?? new Date().toISOString().slice(0, 10),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => dialogRef.current?.showModal(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        title,
        status,
        context,
        decision: decisionText,
        rationale: rationale || null,
        alternatives: splitLines(alternatives),
        consequences: consequences || null,
        participants: participants
          .split(",")
          .map((participant) => participant.trim())
          .filter(Boolean),
        decidedAt,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d’enregistrer cette décision.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={decision ? "Modifier la décision" : "Créer une décision"}
      className="m-auto max-h-[92vh] w-[min(780px,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/65"
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
              {decision ? "Modifier la décision" : "Nouvelle décision"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Un ADR léger, lisible autant par le produit que par la technique.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="max-h-[calc(92vh-145px)] space-y-5 overflow-y-auto p-5">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="decision-title">Titre</Label>
            <Input
              id="decision-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="decision-status">Statut</Label>
              <select
                id="decision-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as DecisionStatus)
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
              <Label htmlFor="decision-date">Date</Label>
              <Input
                id="decision-date"
                type="date"
                value={decidedAt}
                onChange={(event) => setDecidedAt(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="decision-context">Contexte</Label>
            <textarea
              id="decision-context"
              value={context}
              onChange={(event) => setContext(event.target.value)}
              rows={4}
              required
              placeholder="Quel problème ou quelle contrainte motive cette décision ?"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decision-choice">Décision</Label>
            <textarea
              id="decision-choice"
              value={decisionText}
              onChange={(event) => setDecisionText(event.target.value)}
              rows={4}
              required
              placeholder="Ce qui a été décidé, sans ambiguïté."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decision-rationale">Pourquoi ce choix</Label>
            <textarea
              id="decision-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decision-alternatives">
              Alternatives rejetées · une par ligne
            </Label>
            <textarea
              id="decision-alternatives"
              value={alternatives}
              onChange={(event) => setAlternatives(event.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decision-consequences">Conséquences</Label>
            <textarea
              id="decision-consequences"
              value={consequences}
              onChange={(event) => setConsequences(event.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decision-participants">
              Personnes concernées · séparées par des virgules
            </Label>
            <Input
              id="decision-participants"
              value={participants}
              onChange={(event) => setParticipants(event.target.value)}
              placeholder="Paul, Client, Lead technique"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={
              isSaving ||
              title.trim().length < 2 ||
              context.trim().length < 2 ||
              decisionText.trim().length < 2
            }
          >
            {isSaving ? <LoaderCircle className="animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function ProjectDecisionsPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [editing, setEditing] = useState<ProjectDecision | null | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setDecisions(await listProjectDecisions(projectId, signal));
        setError(null);
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les décisions.",
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

  async function save(input: DecisionInput) {
    if (editing) {
      const updated = await updateProjectDecision(projectId, editing.id, input);
      setDecisions((current) =>
        current.map((decision) =>
          decision.id === updated.id ? updated : decision,
        ),
      );
    } else {
      const created = await createProjectDecision(projectId, input);
      setDecisions((current) => [created, ...current]);
    }
  }

  async function remove(decision: ProjectDecision) {
    if (!window.confirm(`Supprimer la décision « ${decision.title} » ?`))
      return;
    try {
      await deleteProjectDecision(projectId, decision.id);
      setDecisions((current) => current.filter(({ id }) => id !== decision.id));
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Impossible de supprimer cette décision.",
      );
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">Décisions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Le contexte et la raison derrière les choix structurants du projet.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus /> Nouvelle décision
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex gap-3 text-sm text-destructive">
            <AlertTriangle className="size-4" /> {error}
          </CardContent>
        </Card>
      ) : decisions.length ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {decisions.map((decision) => (
            <Card key={decision.id}>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          decision.status === "accepted"
                            ? "default"
                            : decision.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {decision.status === "accepted" ? (
                          <CheckCircle2 data-icon="inline-start" />
                        ) : null}
                        {statusLabels[decision.status]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatCalendarDate(decision.decidedAt)}
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-base">
                      {decision.title}
                    </CardTitle>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Modifier ${decision.title}`}
                      onClick={() => setEditing(decision)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Supprimer ${decision.title}`}
                      onClick={() => void remove(decision)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="mb-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Contexte
                  </p>
                  <MarkdownContent>{decision.context}</MarkdownContent>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.12em] text-primary uppercase">
                    <Gavel className="size-3" /> Décision
                  </p>
                  <MarkdownContent>{decision.decision}</MarkdownContent>
                </div>
                {decision.rationale ? (
                  <div>
                    <p className="mb-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Pourquoi
                    </p>
                    <MarkdownContent>{decision.rationale}</MarkdownContent>
                  </div>
                ) : null}
                {decision.alternatives.length ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      <FileQuestion className="size-3" /> Alternatives rejetées
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {decision.alternatives.map((alternative) => (
                        <li key={alternative}>— {alternative}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {decision.consequences ? (
                  <div>
                    <p className="mb-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Conséquences
                    </p>
                    <MarkdownContent>{decision.consequences}</MarkdownContent>
                  </div>
                ) : null}
                {decision.participants.length ? (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <UsersRound className="size-3.5" />
                    {decision.participants.join(" · ")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Gavel className="size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              Aucune décision documentée
            </p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Capture le pourquoi des choix importants avant que le contexte ne
              disparaisse.
            </p>
            <Button className="mt-4" size="sm" onClick={() => setEditing(null)}>
              <Plus /> Documenter une décision
            </Button>
          </CardContent>
        </Card>
      )}

      {editing !== undefined ? (
        <DecisionDialog
          decision={editing}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      ) : null}
    </section>
  );
}
