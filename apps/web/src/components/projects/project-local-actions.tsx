"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Play, Square, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  launchLocalAction,
  listLocalActionRuns,
  stopLocalAction,
  type LocalActionName,
  type LocalActionRun,
  type Repository,
} from "@/lib/api";

const actions: Array<[LocalActionName, string]> = [
  ["dev", "Dev"],
  ["test", "Tests"],
  ["lint", "Lint"],
  ["build", "Build"],
  ["coverage", "Coverage"],
  ["audit", "Audit"],
  ["outdated", "Dépendances"],
];

export function ProjectLocalActionsPanel({
  projectId,
  repositories,
}: {
  projectId: string;
  repositories: Repository[];
}) {
  const [runs, setRuns] = useState<LocalActionRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRuns(await listLocalActionRuns(projectId));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Chargement impossible.",
      );
    }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void listLocalActionRuns(projectId, controller.signal)
      .then((result) => setRuns(result))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error ? caught.message : "Chargement impossible.",
          );
      });
    const timer = window.setInterval(() => void load(), 2_500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load, projectId]);

  async function launch(repositoryId: string, action: LocalActionName) {
    setPending(`${repositoryId}:${action}`);
    try {
      await launchLocalAction(projectId, repositoryId, action);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action impossible.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-base font-semibold">
          Actions locales
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ouvrir les outils du poste ou exécuter uniquement les scripts
          autorisés du repository.
        </p>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {repositories.map((repository) => (
        <Card key={repository.id} size="sm">
          <CardHeader className="border-b">
            <CardTitle>{repository.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              {(["editor", "terminal", "finder"] as const).map((action) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  onClick={() => void launch(repository.id, action)}
                  disabled={pending !== null}
                >
                  {action === "finder" ? <FolderOpen /> : <TerminalSquare />}
                  {action === "editor"
                    ? "VS Code"
                    : action === "terminal"
                      ? "Terminal"
                      : "Finder"}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map(([action, label]) => (
                <Button
                  key={action}
                  size="sm"
                  variant="secondary"
                  onClick={() => void launch(repository.id, action)}
                  disabled={pending !== null}
                >
                  <Play /> {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle>Dernières exécutions</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {runs.slice(0, 12).map((run) => (
            <div key={run.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {run.repositoryName} · {run.commandLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      run.status === "failed" ? "destructive" : "outline"
                    }
                  >
                    {run.status}
                  </Badge>
                  {run.status === "running" || run.status === "queued" ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Arrêter"
                      onClick={() =>
                        void stopLocalAction(projectId, run.id).then(load)
                      }
                    >
                      <Square />
                    </Button>
                  ) : null}
                </div>
              </div>
              {run.output ? (
                <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 p-3 font-mono text-[10px] whitespace-pre-wrap">
                  {run.output}
                </pre>
              ) : null}
            </div>
          ))}
          {!runs.length ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              Aucune action exécutée.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
