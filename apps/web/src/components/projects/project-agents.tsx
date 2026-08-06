"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  LoaderCircle,
  Network,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listAgents,
  listAgentTeams,
  updateAgent,
  updateAgentTeam,
  type Agent,
  type AgentTeam,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function ProjectAgentsPanel({ projectId }: { projectId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      listAgents(controller.signal),
      listAgentTeams(controller.signal),
    ])
      .then(([nextAgents, nextTeams]) => {
        setAgents(nextAgents.filter((agent) => agent.status !== "archived"));
        setTeams(nextTeams.filter((team) => team.status !== "archived"));
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!(
          loadError instanceof DOMException && loadError.name === "AbortError"
        )) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les agents du projet.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const assignedAgents = useMemo(
    () =>
      agents.filter((agent) =>
        agent.projects.some((project) => project.id === projectId),
      ),
    [agents, projectId],
  );
  const assignedTeams = useMemo(
    () =>
      teams.filter((team) =>
        team.projects.some((project) => project.id === projectId),
      ),
    [teams, projectId],
  );

  async function toggleAgent(agent: Agent) {
    setPending(agent.id);
    setError(null);
    const assigned = agent.projects.some((project) => project.id === projectId);
    try {
      const saved = await updateAgent(agent.id, {
        projectIds: assigned
          ? agent.projects
              .filter((project) => project.id !== projectId)
              .map((project) => project.id)
          : [...agent.projects.map((project) => project.id), projectId],
      });
      setAgents((current) =>
        current.map((candidate) =>
          candidate.id === saved.id ? saved : candidate,
        ),
      );
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de modifier le périmètre de l’agent.",
      );
    } finally {
      setPending(null);
    }
  }

  async function toggleTeam(team: AgentTeam) {
    setPending(team.id);
    setError(null);
    const assigned = team.projects.some((project) => project.id === projectId);
    try {
      const saved = await updateAgentTeam(team.id, {
        projectIds: assigned
          ? team.projects
              .filter((project) => project.id !== projectId)
              .map((project) => project.id)
          : [...team.projects.map((project) => project.id), projectId],
      });
      setTeams((current) =>
        current.map((candidate) =>
          candidate.id === saved.id ? saved : candidate,
        ),
      );
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de modifier le périmètre de l’équipe.",
      );
    } finally {
      setPending(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Agents assignés
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Contrôle les identités et équipes autorisées à intervenir sur ce
            projet.
          </p>
        </div>
        <Link
          href="/agents"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Network /> Ouvrir le registre
        </Link>
      </div>

      <div className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3">
        {[
          ["Agents", assignedAgents.length, Bot],
          ["Équipes", assignedTeams.length, UsersRound],
          [
            "Périmètres repo",
            assignedAgents.reduce(
              (total, agent) =>
                total +
                agent.repositories.filter(
                  (repository) => repository.projectId === projectId,
                ).length,
              0,
            ),
            ShieldCheck,
          ],
        ].map(([label, value, Icon], index) => {
          const SummaryIcon = Icon as typeof Bot;
          return (
            <div
              key={label as string}
              className={cn(
                "p-4",
                index > 0 && "border-t sm:border-t-0 sm:border-l",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {label as string}
                </p>
                <SummaryIcon className="size-3.5 text-primary" />
              </div>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {value as number}
              </p>
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((value) => value + 1);
            }}
          >
            <RefreshCw />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="size-4 text-primary" /> Agents individuels
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {agents.length ? (
              agents.map((agent) => {
                const assigned = agent.projects.some(
                  (project) => project.id === projectId,
                );
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <AgentAvatar
                      name={agent.name}
                      avatarDataUrl={agent.avatarDataUrl}
                      className="size-9 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {agent.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {agent.role} ·{" "}
                        {agent.runtime.model ?? "runtime non défini"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={assigned ? "secondary" : "outline"}
                      disabled={pending === agent.id}
                      onClick={() => void toggleAgent(agent)}
                    >
                      {pending === agent.id ? (
                        <LoaderCircle className="animate-spin" />
                      ) : null}
                      {assigned ? "Retirer" : "Assigner"}
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Aucun agent dans le registre.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UsersRound className="size-4 text-primary" /> Équipes
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {teams.length ? (
              teams.map((team) => {
                const assigned = team.projects.some(
                  (project) => project.id === projectId,
                );
                const root = team.assignments.find(
                  (assignment) => !assignment.parentAssignmentId,
                );
                return (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg border bg-primary/8 text-primary">
                      <Network className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {team.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {team.assignments.length} membres
                        {root ? ` · Lead ${root.agent.name}` : ""}
                      </p>
                    </div>
                    {assigned ? (
                      <Badge variant="outline">Assignée</Badge>
                    ) : null}
                    <Button
                      size="sm"
                      variant={assigned ? "secondary" : "outline"}
                      disabled={pending === team.id}
                      onClick={() => void toggleTeam(team)}
                    >
                      {pending === team.id ? (
                        <LoaderCircle className="animate-spin" />
                      ) : null}
                      {assigned ? "Retirer" : "Assigner"}
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Aucune équipe dans le registre.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
