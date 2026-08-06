"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Archive,
  Database,
  Download,
  HardDrive,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createLocalBackup,
  downloadDataExport,
  getDataStatus,
  listLocalBackups,
  restoreDataBackup,
  restoreLocalBackup,
  type DataStatus,
  type LocalBackup,
} from "@/lib/api";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DataSettings() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [backups, setBackups] = useState<LocalBackup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(signal?: AbortSignal) {
    const [nextStatus, nextBackups] = await Promise.all([
      getDataStatus(signal),
      listLocalBackups(signal),
    ]);
    setStatus(nextStatus);
    setBackups(nextBackups);
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getDataStatus(controller.signal),
      listLocalBackups(controller.signal),
    ])
      .then(([nextStatus, nextBackups]) => {
        setStatus(nextStatus);
        setBackups(nextBackups);
      })
      .catch((loadError: unknown) => {
        if (!(
          loadError instanceof DOMException && loadError.name === "AbortError"
        )) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les réglages de données.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function runAction(action: string, operation: () => Promise<void>) {
    setPendingAction(action);
    setMessage(null);
    setError(null);
    try {
      await operation();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "L’opération a échoué.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function handleExport() {
    void runAction("export", async () => {
      const blob = await downloadDataExport();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `the-bridge-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("L’export portable a été téléchargé.");
    });
  }

  function handleCreateBackup() {
    void runAction("backup", async () => {
      const backup = await createLocalBackup();
      setBackups((current) => [backup, ...current]);
      setMessage("Une sauvegarde locale a été créée dans .data/backups.");
    });
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !window.confirm(
        "Restaurer cet export remplacera les données actuelles. Une sauvegarde de sécurité sera créée automatiquement. Continuer ?",
      )
    ) {
      return;
    }

    void runAction("import", async () => {
      const document = JSON.parse(await file.text()) as unknown;
      const result = await restoreDataBackup(document);
      await refresh();
      setMessage(
        `Restauration terminée. Sauvegarde de sécurité : ${result.safetyBackup.id}.`,
      );
    });
  }

  function handleRestore(backup: LocalBackup) {
    if (
      !window.confirm(
        `Restaurer la sauvegarde du ${formatDate(backup.createdAt)} ? Les données actuelles seront sauvegardées avant le remplacement.`,
      )
    ) {
      return;
    }
    void runAction(backup.id, async () => {
      const result = await restoreLocalBackup(backup.id);
      await refresh();
      setMessage(
        `Restauration terminée. Sauvegarde de sécurité : ${result.safetyBackup.id}.`,
      );
    });
  }

  const recordCount = status
    ? Object.values(status.counts).reduce((total, count) => total + count, 0)
    : 0;

  return (
    <div className="space-y-8">
      <section>
        <Badge variant="outline">Réglages</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          Données & sauvegardes
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Sauvegarde le cockpit local, exporte-le dans un format portable ou
          restaure un état précédent en conservant toujours un filet de
          sécurité.
        </p>
      </section>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <Database className="size-5 text-primary" />
            <CardTitle>Moteur actif</CardTitle>
            <CardDescription>
              La base utilisée par l’API locale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="font-mono text-lg font-semibold uppercase">
                {status?.dialect}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <HardDrive className="size-5 text-primary" />
            <CardTitle>Contenu suivi</CardTitle>
            <CardDescription>
              Enregistrements inclus dans un export.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="font-mono text-lg font-semibold">
                {recordCount} entrées
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle>Secrets exclus</CardTitle>
            <CardDescription>
              Les tokens restent dans le trousseau du système.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Non exportés</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions de sauvegarde</CardTitle>
          <CardDescription>
            Les exports JSON fonctionnent avec SQLite comme avec PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={handleCreateBackup}
            disabled={pendingAction !== null}
          >
            {pendingAction === "backup" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Archive />
            )}
            Sauvegarder dans .data
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={pendingAction !== null}
          >
            {pendingAction === "export" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Download />
            )}
            Exporter
          </Button>
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={pendingAction !== null}
          >
            {pendingAction === "import" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Upload />
            )}
            Restaurer un export
          </Button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sauvegardes locales</CardTitle>
          <CardDescription>
            Fichiers privés stockés dans {status?.dataDirectory ?? ".data"}
            /backups.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : backups.length ? (
            backups.map((backup) => (
              <div
                key={backup.id}
                className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {formatDate(backup.createdAt)}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {backup.sourceDialect} · {formatBytes(backup.sizeBytes)} ·{" "}
                    {backup.id}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingAction !== null}
                  onClick={() => handleRestore(backup)}
                >
                  {pendingAction === backup.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <RotateCcw />
                  )}
                  Restaurer
                </Button>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune sauvegarde locale pour le moment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
