"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { ClientLogoField } from "@/components/clients/client-logo-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmitShortcutHint } from "@/components/ui/submit-shortcut-hint";
import {
  getProject,
  listClients,
  updateProject,
  type Client,
  type Project,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-8 w-full cursor-pointer appearance-auto rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const textareaClassName =
  "min-h-28 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const projectTypes = [
  ["web", "Web"],
  ["mobile", "Mobile"],
  ["backend", "Backend / API"],
  ["ai", "IA"],
  ["desktop", "Desktop"],
  ["data", "Data"],
  ["automation", "Automatisation"],
  ["infrastructure", "Infrastructure"],
  ["other", "Autre"],
] as const;

export function EditProjectForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getProject(projectId, controller.signal),
      listClients(controller.signal),
    ])
      .then(([projectData, clientData]) => {
        setProject(projectData);
        setClients(clientData);
      })
      .catch((loadError: unknown) => {
        if (!(
          loadError instanceof DOMException && loadError.name === "AbortError"
        )) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger le projet.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [projectId]);

  function update<K extends keyof Project>(key: K, value: Project[K]) {
    setProject((current) => (current ? { ...current, [key]: value } : current));
  }

  function toggleType(type: string) {
    if (!project) return;
    update(
      "types",
      project.types.includes(type)
        ? project.types.filter((item) => item !== type)
        : [...project.types, type],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || isSaving) return;
    if (project.name.trim().length < 2 || !project.types.length) {
      setError("Renseigne un nom et au moins une nature de projet.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateProject(project.id, {
        name: project.name.trim(),
        logoDataUrl: project.logoDataUrl,
        description: project.description?.trim() || null,
        status: project.status,
        priority: project.priority,
        types: project.types,
        technologies: project.technologies,
        startDate: project.startDate,
        deadline: project.deadline,
        followUpDate: project.followUp?.date ?? null,
        followUpNote: project.followUp?.note?.trim() || null,
        clientId: project.client?.id ?? null,
      });
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d’enregistrer le projet.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  if (isLoading) return <Skeleton className="h-[620px] w-full rounded-xl" />;
  if (!project) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/projects/${project.id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2",
          )}
        >
          <ArrowLeft /> Projet
        </Link>
        <div className="flex items-center gap-3">
          <SubmitShortcutHint />
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
            Enregistrer
          </Button>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Projet
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.035em]">
          Modifier {project.name}
        </h1>
      </div>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" /> {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ClientLogoField
            fieldId="project-logo"
            clientName={project.name}
            value={project.logoDataUrl}
            onChange={(value) => update("logoDataUrl", value)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                value={project.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <select
                id="client"
                className={selectClassName}
                value={project.client?.id ?? ""}
                onChange={(event) => {
                  const client = clients.find(
                    (item) => item.id === event.target.value,
                  );
                  update(
                    "client",
                    client ? { id: client.id, name: client.name } : null,
                  );
                }}
              >
                <option value="">Projet personnel</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className={textareaClassName}
              value={project.description ?? ""}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pilotage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                className={selectClassName}
                value={project.status}
                onChange={(event) =>
                  update("status", event.target.value as Project["status"])
                }
              >
                <option value="planned">Planifié</option>
                <option value="active">Actif</option>
                <option value="paused">En pause</option>
                <option value="completed">Terminé</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <select
                id="priority"
                className={selectClassName}
                value={project.priority}
                onChange={(event) =>
                  update("priority", event.target.value as Project["priority"])
                }
              >
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nature</Label>
            <div className="flex flex-wrap gap-2">
              {projectTypes.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleType(value)}
                  className={cn(
                    "cursor-pointer rounded-lg border px-3 py-2 text-xs transition",
                    project.types.includes(value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="technologies">Technologies</Label>
            <Input
              id="technologies"
              value={project.technologies.join(", ")}
              onChange={(event) =>
                update(
                  "technologies",
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
              placeholder="Next.js, NestJS"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Début</Label>
              <Input
                id="startDate"
                type="date"
                value={project.startDate ?? ""}
                onChange={(event) =>
                  update("startDate", event.target.value || null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={project.deadline ?? ""}
                onChange={(event) =>
                  update("deadline", event.target.value || null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="followUp">Follow-up</Label>
              <Input
                id="followUp"
                type="date"
                value={project.followUp?.date ?? ""}
                onChange={(event) =>
                  update(
                    "followUp",
                    event.target.value
                      ? {
                          date: event.target.value,
                          note: project.followUp?.note ?? null,
                        }
                      : null,
                  )
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="followUpNote">Note de follow-up</Label>
            <Input
              id="followUpNote"
              value={project.followUp?.note ?? ""}
              disabled={!project.followUp}
              onChange={(event) =>
                update(
                  "followUp",
                  project.followUp
                    ? { ...project.followUp, note: event.target.value }
                    : null,
                )
              }
            />
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
