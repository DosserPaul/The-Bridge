"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import {
  Archive,
  Crown,
  GitFork,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitShortcutHint } from "@/components/ui/submit-shortcut-hint";
import {
  archiveAgentTeam,
  createAgentTeam,
  replaceAgentTeamAssignments,
  updateAgentTeam,
  type Agent,
  type AgentTeam,
  type Project,
} from "@/lib/api";

interface MemberDraft {
  agentId: string;
  role: string;
  parentAgentId: string | null;
}

const selectClassName =
  "h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const textareaClassName =
  "min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function initialMembers(team: AgentTeam | null): MemberDraft[] {
  if (!team) return [];
  const assignmentsById = new Map(
    team.assignments.map((assignment) => [assignment.id, assignment]),
  );
  return team.assignments.map((assignment) => ({
    agentId: assignment.agent.id,
    role: assignment.role,
    parentAgentId: assignment.parentAssignmentId
      ? (assignmentsById.get(assignment.parentAssignmentId)?.agent.id ?? null)
      : null,
  }));
}

function hierarchyError(members: MemberDraft[]): string | null {
  if (!members.length) return null;
  if (members.filter((member) => !member.parentAgentId).length !== 1) {
    return "Une équipe non vide doit avoir exactement un lead racine.";
  }
  const parents = new Map(
    members.map((member) => [member.agentId, member.parentAgentId]),
  );
  for (const member of members) {
    if (member.parentAgentId === member.agentId) {
      return "Un agent ne peut pas être son propre responsable.";
    }
    if (member.parentAgentId && !parents.has(member.parentAgentId)) {
      return "Tous les responsables doivent appartenir à l’équipe.";
    }
    const visited = new Set<string>();
    let current: string | null = member.agentId;
    while (current) {
      if (visited.has(current)) return "La hiérarchie contient un cycle.";
      visited.add(current);
      current = parents.get(current) ?? null;
    }
  }
  return null;
}

export function TeamEditor({
  team,
  agents,
  projects,
  onClose,
  onSaved,
}: {
  team: AgentTeam | null;
  agents: Agent[];
  projects: Project[];
  onClose: () => void;
  onSaved: (team: AgentTeam) => void;
}) {
  const [members, setMembers] = useState<MemberDraft[]>(() =>
    initialMembers(team),
  );
  const [agentToAdd, setAgentToAdd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const availableAgents = agents.filter(
    (agent) =>
      agent.status !== "archived" &&
      !members.some((member) => member.agentId === agent.id),
  );

  function addMember() {
    const agent = agentsById.get(agentToAdd);
    if (!agent) return;
    setMembers((current) => [
      ...current,
      {
        agentId: agent.id,
        role: agent.role,
        parentAgentId: current[0]?.agentId ?? null,
      },
    ]);
    setAgentToAdd("");
  }

  function updateMember(agentId: string, patch: Partial<MemberDraft>) {
    setMembers((current) =>
      current.map((member) =>
        member.agentId === agentId ? { ...member, ...patch } : member,
      ),
    );
  }

  function removeMember(agentId: string) {
    setMembers((current) =>
      current
        .filter((member) => member.agentId !== agentId)
        .map((member) =>
          member.parentAgentId === agentId
            ? { ...member, parentAgentId: null }
            : member,
        ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = hierarchyError(members);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const input = {
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      status: (formData.get("status") ?? "active") as AgentTeam["status"],
      projectIds: formData.getAll("projectIds").map(String),
    };

    try {
      const savedMetadata = team
        ? await updateAgentTeam(team.id, input)
        : await createAgentTeam({
            name: input.name,
            description: input.description ?? undefined,
            projectIds: input.projectIds,
          });
      const saved = await replaceAgentTeamAssignments(
        savedMetadata.id,
        members.map((member, index) => ({
          ...member,
          sortOrder: index,
        })),
      );
      onSaved(saved);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible d’enregistrer cette équipe.",
      );
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!team || !window.confirm(`Archiver l’équipe « ${team.name} » ?`)) {
      return;
    }
    setIsArchiving(true);
    setError(null);
    try {
      onSaved(await archiveAgentTeam(team.id));
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Impossible d’archiver cette équipe.",
      );
      setIsArchiving(false);
    }
  }

  function handleShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      !event.repeat &&
      !isSubmitting
    ) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-background/70 backdrop-blur-sm"
        aria-label="Fermer l’éditeur"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={team ? `Modifier ${team.name}` : "Créer une équipe"}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-start gap-4 border-b px-5 py-4 sm:px-7">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">
              Agent teams
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">
              {team ? `Configurer ${team.name}` : "Nouvelle équipe"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Une organisation hiérarchique avec un lead racine et des rapports
              explicites.
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
          >
            <X />
            <span className="sr-only">Fermer</span>
          </Button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit}
          onKeyDown={handleShortcut}
        >
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
            <section>
              <div className="mb-4 flex gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <UsersRound className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">
                    Identité de l’équipe
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Le périmètre s’applique à l’équipe, sans modifier les
                    agents.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="team-name">Nom</Label>
                  <Input
                    id="team-name"
                    name="name"
                    defaultValue={team?.name ?? ""}
                    minLength={2}
                    maxLength={80}
                    required
                    placeholder="Product engineering"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-status">Statut</Label>
                  <select
                    id="team-status"
                    name="status"
                    className={selectClassName}
                    defaultValue={team?.status ?? "active"}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archivée</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="team-description">Description</Label>
                  <textarea
                    id="team-description"
                    name="description"
                    className={textareaClassName}
                    defaultValue={team?.description ?? ""}
                    maxLength={2_000}
                    placeholder="Équipe responsable de la livraison produit…"
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <GitFork className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Hiérarchie</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Un seul membre sans responsable représente le lead racine.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex gap-2">
                  <select
                    value={agentToAdd}
                    onChange={(event) => setAgentToAdd(event.target.value)}
                    className={selectClassName}
                    aria-label="Agent à ajouter"
                  >
                    <option value="">Sélectionner un agent…</option>
                    {availableAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} — {agent.role}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addMember}
                    disabled={!agentToAdd}
                  >
                    <Plus />
                    Ajouter
                  </Button>
                </div>

                {members.length ? (
                  <div className="space-y-3 pt-1">
                    {members.map((member) => {
                      const agent = agentsById.get(member.agentId);
                      if (!agent) return null;
                      return (
                        <div
                          key={member.agentId}
                          className="rounded-lg border bg-background p-3"
                        >
                          <div className="flex items-center gap-3">
                            <AgentAvatar
                              name={agent.name}
                              avatarDataUrl={agent.avatarDataUrl}
                              className="size-9"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {agent.name}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {agent.runtime.provider ?? "Runtime non défini"}
                                {agent.runtime.model
                                  ? ` · ${agent.runtime.model}`
                                  : ""}
                              </p>
                            </div>
                            {!member.parentAgentId ? (
                              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                                <Crown className="size-3" /> Lead
                              </span>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeMember(member.agentId)}
                            >
                              <Trash2 />
                              <span className="sr-only">
                                Retirer {agent.name}
                              </span>
                            </Button>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-[11px]">
                                Rôle dans l’équipe
                              </Label>
                              <Input
                                value={member.role}
                                onChange={(event) =>
                                  updateMember(member.agentId, {
                                    role: event.target.value,
                                  })
                                }
                                minLength={2}
                                maxLength={100}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px]">Responsable</Label>
                              <select
                                value={member.parentAgentId ?? ""}
                                onChange={(event) =>
                                  updateMember(member.agentId, {
                                    parentAgentId: event.target.value || null,
                                  })
                                }
                                className={selectClassName}
                              >
                                <option value="">Aucun — lead racine</option>
                                {members
                                  .filter(
                                    (candidate) =>
                                      candidate.agentId !== member.agentId,
                                  )
                                  .map((candidate) => (
                                    <option
                                      key={candidate.agentId}
                                      value={candidate.agentId}
                                    >
                                      {agentsById.get(candidate.agentId)
                                        ?.name ?? "Agent"}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed py-8 text-center">
                    <UsersRound className="mx-auto size-5 text-muted-foreground" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      L’équipe peut être créée vide puis composée plus tard.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-4 flex gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <GitFork className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Projets assignés</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Contexte partagé par l’ensemble de l’équipe.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-2">
                {projects.length ? (
                  projects.map((project) => (
                    <label
                      key={project.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="projectIds"
                        value={project.id}
                        defaultChecked={team?.projects.some(
                          (scope) => scope.id === project.id,
                        )}
                        className="size-3.5 accent-primary"
                      />
                      {project.name}
                    </label>
                  ))
                ) : (
                  <p className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    Aucun projet disponible.
                  </p>
                )}
              </div>
            </section>

            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t bg-background px-5 py-4 sm:px-7">
            {team && team.status !== "archived" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleArchive}
                disabled={isArchiving || isSubmitting}
                className="text-muted-foreground"
              >
                {isArchiving ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Archive />
                )}
                Archiver
              </Button>
            ) : null}
            <div className="flex-1" />
            <SubmitShortcutHint />
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Save />
              )}
              {team ? "Enregistrer" : "Créer l’équipe"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
