"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  GitPullRequest,
  Inbox,
  ListTodo,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  ServerCrash,
  Sparkles,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addTodayFocus,
  getToday,
  removeTodayFocus,
  updateTodayFocus,
  type TodayFocusItem,
  type TodayFocusPriority,
  type TodaySignal,
  type TodaySignalKind,
  type TodaySignalSeverity,
  type TodayView,
} from "@/lib/api";
import {
  formatCalendarDate,
  formatDate,
  formatRelativeDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type SignalFilter = "all" | "critical" | "dates" | "delivery";

const signalIcons: Record<TodaySignalKind, LucideIcon> = {
  deadline: CalendarClock,
  follow_up: Clock3,
  repository: ServerCrash,
  pipeline: Activity,
  pull_request: GitPullRequest,
  issue: CircleDot,
  priority: TriangleAlert,
};

const severityLabels: Record<TodaySignalSeverity, string> = {
  critical: "Critique",
  warning: "À surveiller",
  info: "Information",
};

const priorityStyles: Record<TodayFocusPriority, string> = {
  critical: "bg-destructive",
  high: "bg-amber-500",
  normal: "bg-primary",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function priorityFromSignal(severity: TodaySignalSeverity): TodayFocusPriority {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "normal";
}

function briefing(view: TodayView): string {
  if (view.summary.critical > 0) {
    return `${view.summary.critical} signal${view.summary.critical > 1 ? "s critiques demandent" : " critique demande"} ton attention aujourd’hui.`;
  }
  if (view.summary.signals > 0) {
    return `${view.summary.signals} point${view.summary.signals > 1 ? "s sont" : " est"} à suivre, sans blocage critique détecté.`;
  }
  return "Tout est sous contrôle. Aucun signal prioritaire détecté.";
}

function TodaySkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-[520px] max-w-full" />
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function SummaryStrip({ view }: { view: TodayView }) {
  const metrics = [
    { label: "Projets actifs", value: view.summary.activeProjects },
    { label: "Signaux", value: view.summary.signals },
    { label: "Critiques", value: view.summary.critical },
    { label: "Dates proches", value: view.summary.dueSoon },
  ];

  return (
    <section className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className={cn(
            "px-5 py-4",
            index > 0 && "border-t sm:border-l",
            index === 2 && metric.value > 0 && "bg-destructive/[0.035]",
            index === 2 && "sm:border-t-0",
            index === 1 && "sm:border-t-0",
            index === 3 && "xl:border-t-0",
          )}
        >
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p
            className={cn(
              "mt-1 font-heading text-2xl font-semibold tracking-tight",
              index === 2 && metric.value > 0 && "text-destructive",
            )}
          >
            {metric.value}
          </p>
        </div>
      ))}
    </section>
  );
}

function FocusItemRow({
  item,
  pending,
  onComplete,
  onRemove,
}: {
  item: TodayFocusItem;
  pending: boolean;
  onComplete: (item: TodayFocusItem, completed: boolean) => Promise<void>;
  onRemove: (item: TodayFocusItem) => Promise<void>;
}) {
  const completed = Boolean(item.completedAt);
  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            priorityStyles[item.priority],
          )}
        />
        <p
          className={cn(
            "truncate text-sm font-medium",
            completed && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-3.5 text-[10.5px] text-muted-foreground">
        {item.project ? <span>{item.project.name}</span> : null}
        {item.project && item.description ? <span>·</span> : null}
        {item.description ? (
          <span className="truncate">{item.description}</span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-background/65 px-3 py-2.5">
      <button
        type="button"
        className={cn(
          "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
          completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-input hover:border-primary hover:text-primary",
        )}
        disabled={pending}
        onClick={() => void onComplete(item, !completed)}
        aria-label={
          completed ? "Restaurer la priorité" : "Terminer la priorité"
        }
      >
        {pending ? (
          <LoaderCircle className="size-3 animate-spin" />
        ) : completed ? (
          <Check className="size-3" />
        ) : null}
      </button>
      {item.href ? (
        <Link
          href={item.href}
          className="min-w-0 flex flex-1 items-center gap-2"
        >
          {content}
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      ) : (
        content
      )}
      <button
        type="button"
        className="cursor-pointer rounded-md p-1 text-muted-foreground opacity-60 hover:bg-muted hover:text-destructive group-hover:opacity-100"
        disabled={pending}
        onClick={() => void onRemove(item)}
        aria-label="Retirer du Focus"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function FocusCard({
  focus,
  pending,
  onAddManual,
  onComplete,
  onRemove,
}: {
  focus: TodayFocusItem[];
  pending: string | null;
  onAddManual: (title: string) => Promise<boolean>;
  onComplete: (item: TodayFocusItem, completed: boolean) => Promise<void>;
  onRemove: (item: TodayFocusItem) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const active = focus.filter((item) => !item.completedAt);
  const completed = focus.filter((item) => item.completedAt).slice(0, 3);

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListTodo className="size-4" />
          </div>
          <div>
            <CardTitle>Focus du jour</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Trois priorités maximum pour garder un cap net.
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline">{active.length}/3</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {active.map((item) => (
          <FocusItemRow
            key={item.id}
            item={item}
            pending={pending === item.id}
            onComplete={onComplete}
            onRemove={onRemove}
          />
        ))}
        {!active.length ? (
          <div className="rounded-lg border border-dashed px-4 py-7 text-center">
            <CheckCircle2 className="mx-auto size-5 text-emerald-500" />
            <p className="mt-2 text-sm font-medium">Focus disponible</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajoute une priorité ou épingle un signal ci-dessous.
            </p>
          </div>
        ) : null}

        <form
          className="flex gap-2 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            const value = title.trim();
            if (!value) return;
            void onAddManual(value).then((created) => {
              if (created) setTitle("");
            });
          }}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ajouter une priorité manuelle…"
            maxLength={200}
            disabled={active.length >= 3 || pending !== null}
          />
          <Button
            type="submit"
            size="icon-sm"
            variant="outline"
            disabled={!title.trim() || active.length >= 3 || pending !== null}
            aria-label="Ajouter au Focus"
          >
            {pending === "new" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus />
            )}
          </Button>
        </form>

        {completed.length ? (
          <div className="space-y-2 pt-2">
            <p className="font-mono text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Terminé récemment
            </p>
            {completed.map((item) => (
              <FocusItemRow
                key={item.id}
                item={item}
                pending={pending === item.id}
                onComplete={onComplete}
                onRemove={onRemove}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SignalRow({
  signal,
  focused,
  disabled,
  onFocus,
}: {
  signal: TodaySignal;
  focused: boolean;
  disabled: boolean;
  onFocus: (signal: TodaySignal) => Promise<void>;
}) {
  const Icon = signalIcons[signal.kind];
  return (
    <div className="group grid gap-3 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          signal.severity === "critical"
            ? "bg-destructive/10 text-destructive"
            : signal.severity === "warning"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4" />
      </div>
      <Link href={signal.href} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{signal.title}</p>
          <Badge
            variant={signal.severity === "critical" ? "destructive" : "outline"}
            className={cn(
              "text-[9px]",
              signal.severity === "warning" &&
                "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-300",
            )}
          >
            {severityLabels[signal.severity]}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {signal.description}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground/80">
          <span>{signal.project.name}</span>
          {signal.repository ? <span>· {signal.repository.name}</span> : null}
          {signal.dueAt ? (
            <span>· {formatCalendarDate(signal.dueAt)}</span>
          ) : null}
        </div>
      </Link>
      <Button
        type="button"
        size="sm"
        variant={focused ? "secondary" : "ghost"}
        className="justify-self-start sm:justify-self-end"
        disabled={focused || disabled}
        onClick={() => void onFocus(signal)}
      >
        {focused ? <Check /> : <Plus />}
        {focused ? "Dans le focus" : "Focus"}
      </Button>
    </div>
  );
}

function SignalsCard({
  signals,
  focus,
  pending,
  onFocus,
}: {
  signals: TodaySignal[];
  focus: TodayFocusItem[];
  pending: string | null;
  onFocus: (signal: TodaySignal) => Promise<void>;
}) {
  const [filter, setFilter] = useState<SignalFilter>("all");
  const activeFocus = focus.filter((item) => !item.completedAt);
  const focusedKeys = new Set(activeFocus.map((item) => item.sourceKey));
  const visible = signals.filter((signal) => {
    if (filter === "critical") return signal.severity === "critical";
    if (filter === "dates")
      return signal.kind === "deadline" || signal.kind === "follow_up";
    if (filter === "delivery")
      return signal.kind === "pipeline" || signal.kind === "pull_request";
    return true;
  });

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>À traiter</CardTitle>
        <CardDescription className="text-xs">
          Signaux classés par impact et échéance.
        </CardDescription>
        <CardAction className="hidden gap-1 sm:flex">
          {(
            [
              ["all", "Tout"],
              ["critical", "Critiques"],
              ["dates", "Dates"],
              ["delivery", "Delivery"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </CardAction>
      </CardHeader>
      <div>
        {visible.slice(0, 15).map((signal) => (
          <SignalRow
            key={signal.id}
            signal={signal}
            focused={focusedKeys.has(signal.id)}
            disabled={activeFocus.length >= 3 || pending !== null}
            onFocus={onFocus}
          />
        ))}
        {!visible.length ? (
          <div className="px-5 py-12 text-center">
            <Inbox className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Aucun signal ici</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cette vue est à jour et ne demande aucune action.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ActivityCard({ view }: { view: TodayView }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Activité récente</CardTitle>
        <CardDescription className="text-xs">
          Les dernières actions enregistrées.
        </CardDescription>
        <CardAction>
          <Link
            href="/activity"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Tout voir <ArrowRight />
          </Link>
        </CardAction>
      </CardHeader>
      <div>
        {view.recentActivity.map((item) => (
          <Link
            key={item.id}
            href="/activity"
            className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40"
          >
            <span
              className={cn(
                "mt-1 size-1.5 shrink-0 rounded-full",
                item.status === "success" ? "bg-emerald-500" : "bg-destructive",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{item.summary}</p>
              <p className="mt-1 font-mono text-[9.5px] text-muted-foreground">
                {formatRelativeDate(item.createdAt)} · {item.durationMs} ms
              </p>
            </div>
          </Link>
        ))}
        {!view.recentActivity.length ? (
          <div className="px-5 py-10 text-center text-xs text-muted-foreground">
            Aucune activité enregistrée.
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function AgentReadyCard() {
  return (
    <Card className="border-primary/20 bg-[linear-gradient(145deg,var(--card),color-mix(in_oklab,var(--primary)_7%,var(--card)))]">
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Bot className="size-4" />
          </div>
          <Badge variant="outline" className="bg-background/70 text-[9px]">
            Agent-ready
          </Badge>
        </div>
        <p className="mt-4 font-heading text-base font-semibold">
          Un briefing structuré, prêt pour la délégation.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Les priorités du Focus pourront ensuite être confiées à toi, à un
          agent autonome ou à une équipe hiérarchique, avec validation et
          journalisation.
        </p>
        <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-primary">
          <Sparkles className="size-3.5" />
          Runtime et modèle resteront configurables par agent
        </div>
      </CardContent>
    </Card>
  );
}

function DegradedSources({ view }: { view: TodayView }) {
  if (!view.degradedSources.length) return null;
  return (
    <Card className="border-amber-500/20 bg-amber-500/[0.035]">
      <CardContent>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-xs font-medium">
              {view.degradedSources.length} source
              {view.degradedSources.length > 1
                ? "s distantes partielles"
                : " distante partielle"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Les signaux locaux restent disponibles. Réessaie plus tard pour
              actualiser CI/CD, PR et issues.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TodayCommandCenter() {
  const [view, setView] = useState<TodayView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getToday(signal);
      setView(result);
      setError(null);
    } catch (caught) {
      if (!isAbortError(caught)) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger le briefing Today.",
        );
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getToday(controller.signal)
      .then((result) => {
        setView(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!isAbortError(caught)) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Impossible de charger le briefing Today.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const activeFocusCount = useMemo(
    () => view?.focus.filter((item) => !item.completedAt).length ?? 0,
    [view?.focus],
  );

  async function mutate(
    key: string,
    operation: () => Promise<void>,
  ): Promise<boolean> {
    setPending(key);
    setMutationError(null);
    try {
      await operation();
      return true;
    } catch (caught) {
      setMutationError(
        caught instanceof Error ? caught.message : "Action Focus impossible.",
      );
      return false;
    } finally {
      setPending(null);
    }
  }

  async function addManual(title: string): Promise<boolean> {
    return mutate("new", async () => {
      const created = await addTodayFocus({ title });
      setView((current) =>
        current ? { ...current, focus: [created, ...current.focus] } : current,
      );
    });
  }

  async function addSignal(signal: TodaySignal) {
    await mutate(signal.id, async () => {
      const created = await addTodayFocus({
        sourceKey: signal.id,
        projectId: signal.project.id,
        title: signal.title,
        description: signal.description,
        href: signal.href,
        priority: priorityFromSignal(signal.severity),
      });
      setView((current) => {
        if (!current) return current;
        const others = current.focus.filter((item) => item.id !== created.id);
        return { ...current, focus: [created, ...others] };
      });
    });
  }

  async function completeFocus(item: TodayFocusItem, completed: boolean) {
    await mutate(item.id, async () => {
      const updated = await updateTodayFocus(item.id, { completed });
      setView((current) =>
        current
          ? {
              ...current,
              focus: current.focus.map((focusItem) =>
                focusItem.id === updated.id ? updated : focusItem,
              ),
            }
          : current,
      );
    });
  }

  async function removeFocus(item: TodayFocusItem) {
    await mutate(item.id, async () => {
      await removeTodayFocus(item.id);
      setView((current) =>
        current
          ? {
              ...current,
              focus: current.focus.filter(
                (focusItem) => focusItem.id !== item.id,
              ),
            }
          : current,
      );
    });
  }

  if (isLoading && !view) return <TodaySkeleton />;

  if (!view || error) {
    return (
      <Card className="border-destructive/20 bg-destructive/[0.025] text-center">
        <CardContent className="flex flex-col items-center py-12">
          <AlertTriangle className="size-5 text-destructive" />
          <p className="mt-3 font-medium">Briefing indisponible</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error ?? "Le Daily Command Center n’a pas pu être chargé."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() => {
              setIsLoading(true);
              void load();
            }}
          >
            <RefreshCw /> Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
            Daily Command Center
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Bonjour Paul.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {briefing(view)}
          </p>
          <p className="mt-2 font-mono text-[9.5px] text-muted-foreground/75">
            Actualisé {formatDate(view.generatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Projets <ExternalLink />
          </Link>
          <Button
            type="button"
            size="sm"
            disabled={isLoading}
            onClick={() => {
              setIsLoading(true);
              void load();
            }}
          >
            <RefreshCw className={cn(isLoading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </section>

      <SummaryStrip view={view} />

      {mutationError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.035] px-3 py-2 text-xs text-destructive"
        >
          <AlertTriangle className="size-3.5" />
          <span className="flex-1">{mutationError}</span>
          <button
            type="button"
            className="cursor-pointer underline underline-offset-2"
            onClick={() => setMutationError(null)}
          >
            Fermer
          </button>
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <div className="space-y-5">
          <FocusCard
            focus={view.focus}
            pending={pending}
            onAddManual={addManual}
            onComplete={completeFocus}
            onRemove={removeFocus}
          />
          <SignalsCard
            signals={view.signals}
            focus={view.focus}
            pending={pending}
            onFocus={addSignal}
          />
        </div>
        <aside className="space-y-5">
          <ActivityCard view={view} />
          <DegradedSources view={view} />
          <AgentReadyCard />
          {activeFocusCount >= 3 ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[10.5px] text-muted-foreground">
              <RotateCcw className="size-3.5" />
              Termine ou retire une priorité pour libérer le Focus.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
