"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Clock3,
  FolderKanban,
  GitBranch,
  History,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getActivity,
  listActivity,
  type ActivityCategory,
  type ActivityDetail,
  type ActivityItem,
  type ActivityQuery,
  type ActivityStatus,
} from "@/lib/api";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Period = "all" | "24h" | "7d" | "30d";

const categoryOptions: Array<{
  value: ActivityCategory | "all";
  label: string;
  icon: LucideIcon;
}> = [
  { value: "all", label: "Tout", icon: History },
  { value: "clients", label: "Clients", icon: Users },
  { value: "today", label: "Today", icon: Sun },
  { value: "projects", label: "Projets", icon: FolderKanban },
  { value: "repositories", label: "Repositories", icon: GitBranch },
  { value: "agents", label: "Agents", icon: Bot },
  { value: "integrations", label: "Intégrations", icon: PlugZap },
  { value: "security", label: "Sécurité", icon: ShieldCheck },
  { value: "system", label: "Système", icon: Settings2 },
];

const categoryStyles: Record<
  ActivityCategory,
  { icon: LucideIcon; label: string; className: string }
> = {
  clients: {
    icon: Users,
    label: "Clients",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  today: {
    icon: Sun,
    label: "Today",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  projects: {
    icon: FolderKanban,
    label: "Projets",
    className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  },
  repositories: {
    icon: GitBranch,
    label: "Repositories",
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  agents: {
    icon: Bot,
    label: "Agents",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  integrations: {
    icon: PlugZap,
    label: "Intégrations",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  security: {
    icon: ShieldCheck,
    label: "Sécurité",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  system: {
    icon: Settings2,
    label: "Système",
    className: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  },
};

const selectClassName =
  "h-8 rounded-lg border border-input bg-card px-2.5 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function periodStart(period: Period): string | undefined {
  const durations: Partial<Record<Period, number>> = {
    "24h": 24 * 60 * 60 * 1_000,
    "7d": 7 * 24 * 60 * 60 * 1_000,
    "30d": 30 * 24 * 60 * 60 * 1_000,
  };
  const duration = durations[period];
  return duration ? new Date(Date.now() - duration).toISOString() : undefined;
}

function buildQuery({
  category,
  status,
  search,
  period,
  cursor,
}: {
  category: ActivityCategory | "all";
  status: ActivityStatus | "all";
  search: string;
  period: Period;
  cursor?: string;
}): ActivityQuery {
  return {
    category: category === "all" ? undefined : category,
    status: status === "all" ? undefined : status,
    search: search || undefined,
    from: periodStart(period),
    cursor,
    limit: 40,
  };
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(1)} s`;
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[74px] rounded-xl" />
      ))}
    </div>
  );
}

function PayloadBlock({
  label,
  value,
}: {
  label: string;
  value: unknown | null;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 font-mono text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      {value === null ? (
        <div className="rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
          Aucun payload
        </div>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-lg border bg-background p-3 font-mono text-[10.5px] leading-relaxed text-foreground/80">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ActivityRow({
  item,
  expanded,
  detail,
  detailError,
  isDetailLoading,
  onToggle,
}: {
  item: ActivityItem;
  expanded: boolean;
  detail?: ActivityDetail;
  detailError?: string;
  isDetailLoading: boolean;
  onToggle: () => void;
}) {
  const category = categoryStyles[item.category];
  const CategoryIcon = category.icon;

  return (
    <div className="overflow-hidden rounded-xl border bg-card transition-colors hover:border-border/80">
      <button
        type="button"
        className="grid w-full gap-3 px-4 py-3.5 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            category.className,
          )}
        >
          <CategoryIcon className="size-4" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{item.summary}</p>
            <Badge
              variant={item.status === "error" ? "destructive" : "secondary"}
              className="h-4 px-1.5 text-[9px]"
            >
              {item.status === "error" ? "Erreur" : "Succès"}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
            <span className="font-mono">{item.action}</span>
            <span>{category.label}</span>
            <span className="font-mono">
              {item.method} · {item.httpStatus}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="size-3" />
              {formatDuration(item.durationMs)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">
              {formatRelativeDate(item.createdAt)}
            </p>
            <p className="mt-1 hidden font-mono text-[9px] text-muted-foreground/70 md:block">
              {item.requestId.slice(0, 8)}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded ? (
        <div className="border-t bg-muted/15 px-4 py-4">
          <div className="mb-4 grid gap-3 text-[10.5px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-mono text-[8.5px] tracking-[0.1em] uppercase">
                Route
              </p>
              <p className="mt-1 break-all font-mono text-foreground/80">
                {item.route}
              </p>
            </div>
            <div>
              <p className="font-mono text-[8.5px] tracking-[0.1em] uppercase">
                Date exacte
              </p>
              <p className="mt-1 text-foreground/80">
                {formatDate(item.createdAt)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[8.5px] tracking-[0.1em] uppercase">
                Request ID
              </p>
              <p className="mt-1 break-all font-mono text-foreground/80">
                {item.requestId}
              </p>
            </div>
            <div>
              <p className="font-mono text-[8.5px] tracking-[0.1em] uppercase">
                Cible
              </p>
              <p className="mt-1 break-all font-mono text-foreground/80">
                {item.subject
                  ? `${item.subject.type}:${item.subject.id ?? "—"}`
                  : "—"}
              </p>
            </div>
          </div>

          {isDetailLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Chargement des payloads…
            </div>
          ) : detailError ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3 text-xs text-destructive">
              {detailError}
            </p>
          ) : detail ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <PayloadBlock label="Request" value={detail.request} />
              <PayloadBlock
                label={detail.status === "error" ? "Error" : "Response"}
                value={
                  detail.status === "error" ? detail.error : detail.response
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ActivityLog() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [status, setStatus] = useState<ActivityStatus | "all">("all");
  const [period, setPeriod] = useState<Period>("30d");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ success: 0, error: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ActivityDetail>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch === search) return;
      setIsLoading(true);
      setSearch(nextSearch);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    void listActivity(
      buildQuery({ category, status, search, period }),
      controller.signal,
    )
      .then((result) => {
        setItems(result.items);
        setNextCursor(result.nextCursor);
        setTotal(result.total);
        setCounts(result.counts);
        setExpandedId(null);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger l’activité.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [category, status, search, period, refreshKey]);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await listActivity(
        buildQuery({ category, status, search, period, cursor: nextCursor }),
      );
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
      setTotal(result.total);
      setCounts(result.counts);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger la suite de l’activité.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  function toggleDetails(item: ActivityItem) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);
    if (details[item.id] || loadingDetailId === item.id) return;
    setLoadingDetailId(item.id);
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    void getActivity(item.id)
      .then((detail) =>
        setDetails((current) => ({ ...current, [item.id]: detail })),
      )
      .catch((detailError: unknown) =>
        setDetailErrors((current) => ({
          ...current,
          [item.id]:
            detailError instanceof Error
              ? detailError.message
              : "Impossible de charger les détails.",
        })),
      )
      .finally(() => setLoadingDetailId(null));
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Observabilité locale
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Activity
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Toutes les actions métier de THE BRIDGE, classées et consultables
            quand tu as besoin de comprendre ce qui s’est passé.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setIsLoading(true);
            setRefreshKey((current) => current + 1);
          }}
          disabled={isLoading}
        >
          <RefreshCw
            data-icon="inline-start"
            className={cn(isLoading && "animate-spin")}
          />
          Actualiser
        </Button>
      </section>

      <section className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3">
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground">Événements</p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            {total}
          </p>
        </div>
        <div className="border-t px-5 py-4 sm:border-t-0 sm:border-l">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            Succès
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            {counts.success}
          </p>
        </div>
        <div className="border-t px-5 py-4 sm:border-t-0 sm:border-l">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleX className="size-3.5 text-destructive" />
            Erreurs
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            {counts.error}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => {
            const Icon = option.icon;
            const active = category === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                  active
                    ? "border-primary/30 bg-primary/10 font-medium text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => {
                  setIsLoading(true);
                  setCategory(option.value);
                }}
              >
                <Icon className="size-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-9"
              placeholder="Rechercher une action, une route ou un identifiant"
              aria-label="Rechercher dans l’activité"
            />
          </div>
          <select
            className={selectClassName}
            value={status}
            onChange={(event) => {
              setIsLoading(true);
              setStatus(event.target.value as ActivityStatus | "all");
            }}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="success">Succès</option>
            <option value="error">Erreurs</option>
          </select>
          <select
            className={selectClassName}
            value={period}
            onChange={(event) => {
              setIsLoading(true);
              setPeriod(event.target.value as Period);
            }}
            aria-label="Filtrer par période"
          >
            <option value="24h">24 dernières heures</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="all">Toute la période</option>
          </select>
        </div>
      </section>

      {isLoading ? <ActivitySkeleton /> : null}

      {!isLoading && error ? (
        <Card className="border-destructive/20 bg-destructive/[0.025] text-center">
          <CardContent className="flex flex-col items-center py-10">
            <AlertTriangle className="size-5 text-destructive" />
            <p className="mt-3 font-medium">Activity indisponible</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {error}
            </p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => {
                setIsLoading(true);
                setRefreshKey((current) => current + 1);
              }}
            >
              <RefreshCw data-icon="inline-start" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && !items.length ? (
        <Card className="border-dashed bg-card/60 text-center">
          <CardContent className="flex flex-col items-center py-14">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/50">
              <History className="size-5" />
            </div>
            <h2 className="mt-5 font-heading text-lg font-semibold">
              Aucun événement pour ces filtres
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Les prochaines actions métier apparaîtront ici automatiquement.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && items.length ? (
        <section className="space-y-2">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="font-heading text-sm font-semibold">
              Journal des actions
            </h2>
            <p className="text-xs text-muted-foreground">
              {items.length} sur {total}
            </p>
          </div>
          {items.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              detail={details[item.id]}
              detailError={detailErrors[item.id]}
              isDetailLoading={loadingDetailId === item.id}
              onToggle={() => toggleDetails(item)}
            />
          ))}
          {nextCursor ? (
            <div className="flex justify-center pt-5">
              <Button
                variant="outline"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : null}
                {isLoadingMore ? "Chargement…" : "Charger la suite"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
