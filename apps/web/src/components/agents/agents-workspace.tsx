"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  ChevronRight,
  Crown,
  FolderKanban,
  GitFork,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { AgentEditor } from "@/components/agents/agent-editor";
import { TeamEditor } from "@/components/agents/team-editor";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listAgents,
  listAgentTeams,
  listProjects,
  type Agent,
  type AgentAssignment,
  type AgentStatus,
  type AgentTeam,
  type Project,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type View = "agents" | "teams";
type Editor =
  | { kind: "agent"; value: Agent | null }
  | { kind: "team"; value: AgentTeam | null }
  | null;

const statusStyles: Record<AgentStatus, string> = {
  draft:
    "border-slate-500/15 bg-slate-500/8 text-slate-600 dark:text-slate-400",
  active:
    "border-emerald-500/15 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400",
  paused:
    "border-amber-500/15 bg-amber-500/8 text-amber-700 dark:text-amber-400",
  archived:
    "border-slate-500/15 bg-slate-500/8 text-muted-foreground opacity-75",
};

const statusLabels: Record<AgentStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  paused: "En pause",
  archived: "Archivé",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function RegistrySkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}

function AgentCard({ agent, onOpen }: { agent: Agent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-w-0 cursor-pointer rounded-xl border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-slate-950/5"
    >
      <div className="flex items-start gap-3">
        <AgentAvatar
          name={agent.name}
          avatarDataUrl={agent.avatarDataUrl}
          className="size-12"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate font-heading text-base font-semibold tracking-tight">
              {agent.name}
            </h2>
            <Badge variant="outline" className={statusStyles[agent.status]}>
              {statusLabels[agent.status]}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {agent.role}
          </p>
        </div>
      </div>

      <p className="mt-4 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">
        {agent.description ??
          "Aucune description — précise sa mission et son champ de responsabilité."}
      </p>

      <div className="mt-4 rounded-lg border bg-background p-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="size-3.5 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Runtime
          </span>
        </div>
        <p className="mt-2 truncate font-mono text-[11px] text-foreground/80">
          {agent.runtime.provider ?? "Non configuré"}
          {agent.runtime.model ? ` / ${agent.runtime.model}` : ""}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {agent.capabilities.slice(0, 3).map((capability) => (
          <span
            key={capability}
            className="rounded-md bg-muted px-2 py-1 font-mono text-[9.5px] text-muted-foreground"
          >
            {capability}
          </span>
        ))}
        {agent.capabilities.length > 3 ? (
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-[9.5px] text-muted-foreground">
            +{agent.capabilities.length - 3}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-3 border-t pt-4 text-center">
        {[
          ["Projets", agent.projects.length],
          ["Repos", agent.repositories.length],
          ["Équipes", agent.teams.length],
        ].map(([label, value], index) => (
          <div key={label} className={cn(index > 0 && "border-l")}>
            <p className="font-heading text-base font-semibold">{value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

function TeamNode({
  assignment,
  assignments,
  depth = 0,
}: {
  assignment: AgentAssignment;
  assignments: AgentAssignment[];
  depth?: number;
}) {
  const children = assignments.filter(
    (candidate) => candidate.parentAssignmentId === assignment.id,
  );
  return (
    <div className={cn(depth > 0 && "ml-5 border-l pl-3")}>
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        <AgentAvatar
          name={assignment.agent.name}
          avatarDataUrl={assignment.agent.avatarDataUrl}
          className="size-8 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">
            {assignment.agent.name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {assignment.role}
          </p>
        </div>
        {depth === 0 ? <Crown className="size-3.5 text-primary" /> : null}
      </div>
      {children.length ? (
        <div className="mt-2 space-y-2">
          {children.map((child) => (
            <TeamNode
              key={child.id}
              assignment={child}
              assignments={assignments}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TeamCard({ team, onOpen }: { team: AgentTeam; onOpen: () => void }) {
  const root = team.assignments.find(
    (assignment) => assignment.parentAssignmentId === null,
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-w-0 cursor-pointer rounded-xl border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-slate-950/5"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-primary/8 text-primary">
          <Network className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate font-heading text-base font-semibold tracking-tight">
              {team.name}
            </h2>
            <Badge
              variant="outline"
              className={
                team.status === "active"
                  ? statusStyles.active
                  : statusStyles.archived
              }
            >
              {team.status === "active" ? "Active" : "Archivée"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {team.assignments.length} membre
            {team.assignments.length > 1 ? "s" : ""} · {team.projects.length}{" "}
            projet{team.projects.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <p className="mt-4 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">
        {team.description ??
          "Organisation hiérarchique prête à recevoir ses agents."}
      </p>

      <div className="mt-4 rounded-lg border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Lead racine
          </p>
          <GitFork className="size-3.5 text-primary" />
        </div>
        {root ? (
          <div className="mt-3 flex items-center gap-2">
            <AgentAvatar
              name={root.agent.name}
              avatarDataUrl={root.agent.avatarDataUrl}
              className="size-8 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{root.agent.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {root.role}
              </p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground transition group-hover:translate-x-0.5" />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Aucun membre pour le moment.
          </p>
        )}
      </div>
    </button>
  );
}

export function AgentsWorkspace() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>("agents");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      listAgents(controller.signal),
      listAgentTeams(controller.signal),
      listProjects(controller.signal, { silentActivity: true }),
    ])
      .then(([nextAgents, nextTeams, nextProjects]) => {
        setAgents(nextAgents);
        setTeams(nextTeams);
        setProjects(
          nextProjects.filter((project) => project.status !== "archived"),
        );
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger le registre d’agents.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const summary = useMemo(
    () => ({
      active: agents.filter((agent) => agent.status === "active").length,
      configured: agents.filter(
        (agent) => agent.runtime.provider && agent.runtime.model,
      ).length,
      teams: teams.filter((team) => team.status === "active").length,
      assignments: teams.reduce(
        (total, team) => total + team.assignments.length,
        0,
      ),
    }),
    [agents, teams],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredAgents = agents.filter((agent) =>
    [
      agent.name,
      agent.role,
      agent.runtime.provider,
      agent.runtime.model,
      ...agent.capabilities,
    ].some((value) => value?.toLocaleLowerCase("fr").includes(normalizedQuery)),
  );
  const filteredTeams = teams.filter((team) =>
    [
      team.name,
      team.description,
      ...team.projects.map((project) => project.name),
    ].some((value) => value?.toLocaleLowerCase("fr").includes(normalizedQuery)),
  );

  function saveAgent(saved: Agent) {
    setAgents((current) => {
      const exists = current.some((agent) => agent.id === saved.id);
      return exists
        ? current.map((agent) => (agent.id === saved.id ? saved : agent))
        : [saved, ...current];
    });
    setEditor(null);
    setRefreshKey((current) => current + 1);
  }

  function saveTeam(saved: AgentTeam) {
    setTeams((current) => {
      const exists = current.some((team) => team.id === saved.id);
      return exists
        ? current.map((team) => (team.id === saved.id ? saved : team))
        : [saved, ...current];
    });
    setEditor(null);
    setRefreshKey((current) => current + 1);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
            Control plane
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Agents & Teams
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Compose des identités réutilisables, configure leurs garde-fous et
            organise-les en équipes hiérarchiques avant l’arrivée du moteur
            d’exécution.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setEditor({ kind: "team", value: null })}
          >
            <UsersRound />
            Nouvelle équipe
          </Button>
          <Button
            size="lg"
            onClick={() => setEditor({ kind: "agent", value: null })}
          >
            <Plus />
            Nouvel agent
          </Button>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Agents actifs", summary.active, Bot],
          ["Runtimes configurés", summary.configured, BrainCircuit],
          ["Équipes actives", summary.teams, Network],
          ["Affectations", summary.assignments, GitFork],
        ].map(([label, value, Icon], index) => {
          const MetricIcon = Icon as typeof Bot;
          return (
            <div
              key={label as string}
              className={cn(
                "px-5 py-4",
                index > 0 && "border-t sm:border-t-0 sm:border-l",
                index === 2 && "sm:border-t xl:border-t-0",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {label as string}
                </p>
                <MetricIcon className="size-3.5 text-primary" />
              </div>
              <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
                {value as number}
              </p>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex w-fit rounded-lg border bg-card p-1">
          {[
            ["agents", "Agents", Bot, agents.length],
            ["teams", "Équipes", UsersRound, teams.length],
          ].map(([value, label, Icon, count]) => {
            const TabIcon = Icon as typeof Bot;
            const active = view === value;
            return (
              <button
                key={value as string}
                type="button"
                onClick={() => setView(value as View)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon className="size-3.5" />
                {label as string}
                <span
                  className={cn("font-mono text-[9px]", active && "opacity-70")}
                >
                  {count as number}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder={
              view === "agents"
                ? "Nom, rôle, modèle, capability…"
                : "Nom, description, projet…"
            }
            aria-label="Rechercher dans le registre"
          />
        </div>
      </section>

      {isLoading ? <RegistrySkeleton /> : null}

      {!isLoading && error ? (
        <Card className="border-destructive/20 bg-destructive/[0.025] text-center">
          <CardContent className="flex flex-col items-center py-10">
            <AlertTriangle className="size-5 text-destructive" />
            <p className="mt-3 font-medium">Registre indisponible</p>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              {error} Vérifie que l’API locale est lancée et à jour.
            </p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => {
                setIsLoading(true);
                setRefreshKey((current) => current + 1);
              }}
            >
              <RefreshCw /> Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && view === "agents" ? (
        filteredAgents.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => setEditor({ kind: "agent", value: agent })}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed text-center">
            <CardContent className="flex flex-col items-center py-14">
              <Bot className="size-7 text-primary" />
              <h2 className="mt-4 font-heading text-lg font-semibold">
                {agents.length ? "Aucun agent trouvé" : "Ton registre est vide"}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {agents.length
                  ? "Modifie ta recherche pour retrouver un profil."
                  : "Crée d’abord un agent autonome ou le futur lead d’une équipe."}
              </p>
              {!agents.length ? (
                <button
                  type="button"
                  onClick={() => setEditor({ kind: "agent", value: null })}
                  className={cn(buttonVariants(), "mt-5")}
                >
                  <Plus /> Créer le premier agent
                </button>
              ) : null}
            </CardContent>
          </Card>
        )
      ) : null}

      {!isLoading && !error && view === "teams" ? (
        filteredTeams.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onOpen={() => setEditor({ kind: "team", value: team })}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed text-center">
            <CardContent className="flex flex-col items-center py-14">
              <UsersRound className="size-7 text-primary" />
              <h2 className="mt-4 font-heading text-lg font-semibold">
                {teams.length ? "Aucune équipe trouvée" : "Aucune équipe"}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Assemble un CTO, ses leads et leurs contributeurs dans un
                organigramme explicite.
              </p>
              {!teams.length ? (
                <button
                  type="button"
                  onClick={() => setEditor({ kind: "team", value: null })}
                  className={cn(buttonVariants(), "mt-5")}
                >
                  <Plus /> Créer la première équipe
                </button>
              ) : null}
            </CardContent>
          </Card>
        )
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        {view === "teams" && teams.some((team) => team.assignments.length) ? (
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    Aperçu organisationnel
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Structure de la première équipe active du registre.
                  </p>
                </div>
                <GitFork className="size-4 text-primary" />
              </div>
              {(() => {
                const team = teams.find(
                  (candidate) =>
                    candidate.status === "active" &&
                    candidate.assignments.length,
                );
                const root = team?.assignments.find(
                  (assignment) => assignment.parentAssignmentId === null,
                );
                return team && root ? (
                  <div>
                    <p className="mb-3 font-mono text-[10px] text-muted-foreground">
                      {team.name}
                    </p>
                    <TeamNode
                      assignment={root}
                      assignments={team.assignments}
                    />
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed bg-primary/[0.025]">
            <CardContent className="flex h-full items-start gap-4 p-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Control plane uniquement
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Aucun agent ne peut encore exécuter un outil ou contacter un
                  modèle. Cette branche pose les identités, périmètres et règles
                  d’approbation avant le runtime.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <FolderKanban className="size-4 text-primary" />
              <p className="text-sm font-semibold">Périmètres disponibles</p>
            </div>
            <p className="mt-3 font-heading text-3xl font-semibold">
              {projects.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              projets actifs peuvent recevoir des agents ou des équipes.
            </p>
          </CardContent>
        </Card>
      </section>

      {editor?.kind === "agent" ? (
        <AgentEditor
          key={editor.value?.id ?? "new-agent"}
          agent={editor.value}
          projects={projects}
          onClose={() => setEditor(null)}
          onSaved={saveAgent}
        />
      ) : null}
      {editor?.kind === "team" ? (
        <TeamEditor
          key={editor.value?.id ?? "new-team"}
          team={editor.value}
          agents={agents}
          projects={projects}
          onClose={() => setEditor(null)}
          onSaved={saveTeam}
        />
      ) : null}
    </div>
  );
}
