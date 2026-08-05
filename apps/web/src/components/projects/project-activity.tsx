"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleX,
  ExternalLink,
  History,
  LoaderCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getActivity,
  listActivity,
  type ActivityCategory,
  type ActivityDetail,
  type ActivityItem,
} from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const categoryLabels: Record<ActivityCategory, string> = {
  clients: "Clients",
  projects: "Projet",
  repositories: "Repositories",
  integrations: "Intégrations",
  security: "Sécurité",
  system: "Système",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function Payload({ label, value }: { label: string; value: unknown }) {
  if (value === null) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <pre className="max-h-56 overflow-auto rounded-lg border bg-background p-3 font-mono text-[10px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function ProjectActivityPanel({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ActivityDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await listActivity(
          { search: projectId, limit: 40 },
          signal,
        );
        setItems(result.items);
        setError(null);
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger l’activité du projet.",
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

  const visibleItems = useMemo(
    () =>
      category === "all"
        ? items
        : items.filter((item) => item.category === category),
    [category, items],
  );

  function toggle(item: ActivityItem) {
    if (selectedId === item.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(item.id);
    if (details[item.id]) return;
    setDetailLoadingId(item.id);
    void getActivity(item.id)
      .then((detail) =>
        setDetails((current) => ({ ...current, [item.id]: detail })),
      )
      .catch(() => undefined)
      .finally(() => setDetailLoadingId(null));
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Activité du projet
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Les actions et consultations associées uniquement à ce projet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filtrer l’activité par catégorie"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as ActivityCategory | "all")
            }
            className="h-8 cursor-pointer rounded-lg border bg-card px-2.5 text-xs"
          >
            <option value="all">Toutes les catégories</option>
            <option value="projects">Projet</option>
            <option value="repositories">Repositories</option>
            <option value="integrations">Intégrations</option>
          </select>
          <Link
            href="/activity"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink /> Activity globale
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex gap-3 text-sm text-destructive">
            <AlertTriangle className="size-4" /> {error}
          </CardContent>
        </Card>
      ) : visibleItems.length ? (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const expanded = selectedId === item.id;
            const detail = details[item.id];
            return (
              <Card key={item.id} className="overflow-hidden">
                <button
                  type="button"
                  className="grid w-full cursor-pointer gap-3 p-4 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  aria-expanded={expanded}
                  onClick={() => toggle(item)}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      item.status === "error"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-600",
                    )}
                  >
                    {item.status === "error" ? (
                      <CircleX className="size-4" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.summary.replace(` · ${projectId}`, "")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      <span>{categoryLabels[item.category]}</span>
                      <span className="font-mono">{item.action}</span>
                      <span>{formatRelativeDate(item.createdAt)}</span>
                      <span>{item.durationMs} ms</span>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded ? (
                  <CardContent className="border-t bg-muted/[0.12]">
                    {detailLoadingId === item.id ? (
                      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Chargement du détail…
                      </div>
                    ) : detail ? (
                      <div className="grid gap-3 lg:grid-cols-3">
                        <Payload label="Request" value={detail.request} />
                        <Payload label="Response" value={detail.response} />
                        <Payload label="Error" value={detail.error} />
                      </div>
                    ) : (
                      <Badge variant="outline">Détail indisponible</Badge>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <History className="size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Aucune activité trouvée</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les prochaines actions sur le projet apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
