"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getProjectTechnicalHealth,
  launchLocalAction,
  type LocalActionName,
  type ProjectTechnicalHealth,
} from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";

export function ProjectHealthPanel({ projectId }: { projectId: string }) {
  const [health, setHealth] = useState<ProjectTechnicalHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setHealth(await getProjectTechnicalHealth(projectId));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Diagnostic impossible.",
      );
    }
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController();
    void getProjectTechnicalHealth(projectId, controller.signal)
      .then((result) => setHealth(result))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error ? caught.message : "Diagnostic impossible.",
          );
      });
    return () => controller.abort();
  }, [projectId]);
  async function run(repositoryId: string, action: LocalActionName) {
    try {
      await launchLocalAction(projectId, repositoryId, action);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action impossible.");
    }
  }
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Santé technique
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Indicateurs locaux réels, sans audit automatique au chargement.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw /> Actualiser
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {health ? (
        <Card size="sm">
          <CardContent className="pt-4">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Dernière sauvegarde
            </p>
            <p className="mt-2 text-sm font-semibold">
              {health.latestBackupAt
                ? formatRelativeDate(health.latestBackupAt)
                : "Aucune sauvegarde enregistrée"}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {health?.repositories.map((repository) => (
        <Card key={repository.repositoryId} size="sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{repository.repositoryName}</CardTitle>
              <Badge variant="outline">
                {repository.packageManager ?? "Non-JS"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HealthMetric
                label="Dépendances"
                value={repository.dependencyCount?.toString() ?? "—"}
                good={repository.lockfile !== null}
              />
              <HealthMetric
                label="Lockfile"
                value={repository.lockfile ?? "Absent"}
                good={repository.lockfile !== null}
              />
              <HealthMetric
                label="Coverage"
                value={
                  repository.coveragePercent == null
                    ? "Non mesurée"
                    : `${repository.coveragePercent} %`
                }
                good={
                  repository.coveragePercent != null &&
                  repository.coveragePercent >= 70
                }
              />
              <HealthMetric
                label="Branches"
                value={
                  repository.branches
                    .filter((branch) => branch.exists)
                    .map((branch) => branch.name)
                    .join(" + ") || "Absentes"
                }
                good={repository.branches.every((branch) => branch.exists)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["test", "coverage", "audit", "outdated"] as const).map(
                (action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant="secondary"
                    onClick={() => void run(repository.repositoryId, action)}
                  >
                    <ShieldAlert /> {action}
                  </Button>
                ),
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["test", "coverage", "audit", "outdated"] as const).map(
                (action) => {
                  const latest = repository.latestRuns[action];
                  return latest ? (
                    <Badge
                      key={action}
                      variant={
                        latest.status === "failed" ? "destructive" : "outline"
                      }
                    >
                      {action} · {latest.status}
                    </Badge>
                  ) : null;
                },
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {!health ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : null}
    </section>
  );
}

function HealthMetric({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
        {good ? (
          <CheckCircle2 className="size-3 text-emerald-600" />
        ) : (
          <XCircle className="size-3 text-amber-600" />
        )}
        {label}
      </div>
      <p className="mt-2 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}
