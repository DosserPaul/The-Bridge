"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import {
  Archive,
  Bot,
  BrainCircuit,
  FolderKanban,
  LoaderCircle,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AgentAvatarField } from "@/components/agents/agent-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitShortcutHint } from "@/components/ui/submit-shortcut-hint";
import {
  archiveAgent,
  createAgent,
  updateAgent,
  type Agent,
  type AgentInput,
  type Project,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-8 w-full cursor-pointer rounded-lg border border-input bg-card px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const textareaClassName =
  "min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function optional(value: FormDataEntryValue | null): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function nullable(value: FormDataEntryValue | null): string | null {
  return optional(value) ?? null;
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const normalized = optional(value);
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function AgentEditor({
  agent,
  projects,
  onClose,
  onSaved,
}: {
  agent: Agent | null;
  projects: Project[];
  onClose: () => void;
  onSaved: (agent: Agent) => void;
}) {
  const [avatarDataUrl, setAvatarDataUrl] = useState(
    agent?.avatarDataUrl ?? null,
  );
  const [name, setName] = useState(agent?.name ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const capabilities = String(formData.get("capabilities") ?? "")
      .split(",")
      .map((capability) => capability.trim())
      .filter(Boolean);
    const budgetEuros = numberOrNull(formData.get("monthlyBudget"));
    const concurrency = numberOrNull(formData.get("maxConcurrency"));
    const base = {
      name: name.trim(),
      role: String(formData.get("role") ?? "").trim(),
      status: formData.get("status") as Agent["status"],
      avatarDataUrl,
      capabilities,
      permissionPolicy: formData.get(
        "permissionPolicy",
      ) as Agent["permissionPolicy"],
      approvalPolicy: formData.get("approvalPolicy") as Agent["approvalPolicy"],
      monthlyBudgetCents:
        budgetEuros === null ? null : Math.round(budgetEuros * 100),
      maxConcurrency: concurrency,
      projectIds: formData.getAll("projectIds").map(String),
      repositoryIds: formData.getAll("repositoryIds").map(String),
    } satisfies Partial<AgentInput>;

    const input: AgentInput = agent
      ? {
          ...base,
          name: base.name,
          role: base.role,
          description: nullable(formData.get("description")),
          instructions: nullable(formData.get("instructions")),
          runtimeProvider: nullable(formData.get("runtimeProvider")),
          modelId: nullable(formData.get("modelId")),
          serviceTier: nullable(formData.get("serviceTier")),
          reasoningLevel: nullable(formData.get("reasoningLevel")),
        }
      : {
          ...base,
          name: base.name,
          role: base.role,
          avatarDataUrl: avatarDataUrl ?? undefined,
          monthlyBudgetCents: base.monthlyBudgetCents ?? undefined,
          maxConcurrency: base.maxConcurrency ?? undefined,
          description: optional(formData.get("description")),
          instructions: optional(formData.get("instructions")),
          runtimeProvider: optional(formData.get("runtimeProvider")),
          modelId: optional(formData.get("modelId")),
          serviceTier: optional(formData.get("serviceTier")),
          reasoningLevel: optional(formData.get("reasoningLevel")),
        };

    try {
      const saved = agent
        ? await updateAgent(agent.id, input)
        : await createAgent(input);
      onSaved(saved);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible d’enregistrer cet agent.",
      );
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!agent || !window.confirm(`Archiver l’agent « ${agent.name} » ?`)) {
      return;
    }
    setIsArchiving(true);
    setError(null);
    try {
      onSaved(await archiveAgent(agent.id));
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Impossible d’archiver cet agent.",
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
        aria-label={agent ? `Modifier ${agent.name}` : "Créer un agent"}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-start gap-4 border-b px-5 py-4 sm:px-7">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">
              Agent registry
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">
              {agent ? `Configurer ${agent.name}` : "Nouvel agent"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Identité réutilisable, runtime et garde-fous du futur worker.
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
              <SectionTitle
                icon={Bot}
                title="Identité"
                description="L’agent conserve cette identité dans toutes ses équipes."
              />
              <div className="space-y-4 rounded-xl border bg-card p-4">
                <AgentAvatarField
                  name={name || "Agent"}
                  value={avatarDataUrl}
                  onChange={setAvatarDataUrl}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Nom</Label>
                    <Input
                      id="agent-name"
                      name="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      minLength={2}
                      maxLength={80}
                      required
                      placeholder="API Lead"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-role">Rôle par défaut</Label>
                    <Input
                      id="agent-role"
                      name="role"
                      defaultValue={agent?.role ?? ""}
                      minLength={2}
                      maxLength={100}
                      required
                      placeholder="Technical lead — API"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-status">Statut</Label>
                    <select
                      id="agent-status"
                      name="status"
                      className={selectClassName}
                      defaultValue={agent?.status ?? "draft"}
                    >
                      <option value="draft">Brouillon</option>
                      <option value="active">Actif</option>
                      <option value="paused">En pause</option>
                      <option value="archived">Archivé</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="agent-description">Description</Label>
                    <textarea
                      id="agent-description"
                      name="description"
                      className={textareaClassName}
                      defaultValue={agent?.description ?? ""}
                      maxLength={2_000}
                      placeholder="Responsable de l’architecture et de la qualité de l’API."
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="agent-instructions">Instructions</Label>
                    <textarea
                      id="agent-instructions"
                      name="instructions"
                      className={cn(
                        textareaClassName,
                        "min-h-32 font-mono text-xs",
                      )}
                      defaultValue={agent?.instructions ?? ""}
                      maxLength={20_000}
                      placeholder="Principes, responsabilités et contraintes permanentes…"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle
                icon={BrainCircuit}
                title="Runtime par défaut"
                description="Valeurs libres pour ne pas verrouiller l’agent à un fournisseur."
              />
              <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="runtime-provider">Fournisseur</Label>
                  <Input
                    id="runtime-provider"
                    name="runtimeProvider"
                    defaultValue={agent?.runtime.provider ?? ""}
                    placeholder="openai, anthropic…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-id">Modèle</Label>
                  <Input
                    id="model-id"
                    name="modelId"
                    defaultValue={agent?.runtime.model ?? ""}
                    placeholder="codex, claude-opus…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-tier">Service tier</Label>
                  <Input
                    id="service-tier"
                    name="serviceTier"
                    defaultValue={agent?.runtime.serviceTier ?? ""}
                    placeholder="priority, standard…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reasoning-level">Reasoning</Label>
                  <Input
                    id="reasoning-level"
                    name="reasoningLevel"
                    defaultValue={agent?.runtime.reasoningLevel ?? ""}
                    placeholder="medium, high…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="capabilities">Capabilities</Label>
                  <Input
                    id="capabilities"
                    name="capabilities"
                    defaultValue={agent?.capabilities.join(", ") ?? ""}
                    placeholder="nestjs, architecture, code-review"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Sépare les capabilities par des virgules.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle
                icon={ShieldCheck}
                title="Permissions et validations"
                description="Les politiques sont explicites avant toute future exécution."
              />
              <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="permission-policy">Permission</Label>
                  <select
                    id="permission-policy"
                    name="permissionPolicy"
                    className={selectClassName}
                    defaultValue={agent?.permissionPolicy ?? "supervised"}
                  >
                    <option value="read_only">Lecture seule</option>
                    <option value="supervised">Supervisé</option>
                    <option value="autonomous">Autonome</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approval-policy">Approbation humaine</Label>
                  <select
                    id="approval-policy"
                    name="approvalPolicy"
                    className={selectClassName}
                    defaultValue={agent?.approvalPolicy ?? "destructive"}
                  >
                    <option value="always">Toujours</option>
                    <option value="destructive">Actions sensibles</option>
                    <option value="never">Jamais</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-budget">Budget mensuel (€)</Label>
                  <Input
                    id="monthly-budget"
                    name="monthlyBudget"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue={
                      agent?.monthlyBudgetCents == null
                        ? ""
                        : agent.monthlyBudgetCents / 100
                    }
                    placeholder="Optionnel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-concurrency">Concurrence maximale</Label>
                  <Input
                    id="max-concurrency"
                    name="maxConcurrency"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={agent?.maxConcurrency ?? ""}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionTitle
                icon={FolderKanban}
                title="Périmètre"
                description="Projets et repositories sur lesquels l’agent pourra intervenir."
              />
              <div className="space-y-3 rounded-xl border bg-card p-4">
                {projects.length ? (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-lg border bg-background p-3"
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          name="projectIds"
                          value={project.id}
                          defaultChecked={agent?.projects.some(
                            (scope) => scope.id === project.id,
                          )}
                          className="size-3.5 accent-primary"
                        />
                        {project.name}
                      </label>
                      {project.repositories.length ? (
                        <div className="mt-3 grid gap-2 pl-5 sm:grid-cols-2">
                          {project.repositories.map((repository) => (
                            <label
                              key={repository.id}
                              className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                            >
                              <input
                                type="checkbox"
                                name="repositoryIds"
                                value={repository.id}
                                defaultChecked={agent?.repositories.some(
                                  (scope) => scope.id === repository.id,
                                )}
                                className="size-3.5 accent-primary"
                              />
                              {repository.name}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Aucun projet disponible.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-dashed bg-muted/20 p-4">
              <div className="flex gap-3">
                <SlidersHorizontal className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Exécution à venir</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Missions, runs, délégation, retries et streaming seront
                    reliés à cette configuration dans une prochaine brique.
                  </p>
                </div>
              </div>
            </section>

            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t bg-background px-5 py-4 sm:px-7">
            {agent && agent.status !== "archived" ? (
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
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Save />
              )}
              {agent ? "Enregistrer" : "Créer l’agent"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
