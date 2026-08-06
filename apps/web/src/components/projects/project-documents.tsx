"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import { MarkdownContent } from "@/components/projects/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createProjectDocument,
  deleteProjectDocument,
  listProjectDocuments,
  previewProjectDocument,
  type DocumentPreview,
  type ProjectDocument,
  type Repository,
} from "@/lib/api";

export function ProjectDocumentsPanel({
  projectId,
  repositories,
}: {
  projectId: string;
  repositories: Repository[];
}) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDocuments(await listProjectDocuments(projectId));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Chargement impossible.",
      );
    }
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController();
    void listProjectDocuments(projectId, controller.signal)
      .then((result) => setDocuments(result))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error ? caught.message : "Chargement impossible.",
          );
      });
    return () => controller.abort();
  }, [projectId]);

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const kind = String(data.get("kind")) as "file" | "link";
    try {
      await createProjectDocument(projectId, {
        kind,
        category: "other",
        title: String(data.get("title")),
        location: String(data.get("location")),
        repositoryId: kind === "file" ? String(data.get("repositoryId")) : null,
      });
      setAdding(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ajout impossible.");
    }
  }

  async function openDocument(document: ProjectDocument) {
    if (document.kind === "link") {
      window.open(document.location, "_blank", "noopener,noreferrer");
      return;
    }
    if (!document.repositoryId) return;
    try {
      setPreview(
        await previewProjectDocument(
          projectId,
          document.repositoryId,
          document.location,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Prévisualisation impossible.",
      );
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold">Documents</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            README et documentation locale détectés automatiquement, plus vos
            liens de référence.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding((value) => !value)}>
          <Plus /> Ajouter
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {adding ? (
        <Card size="sm">
          <CardContent className="pt-4">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(event.currentTarget);
              }}
            >
              <select
                name="kind"
                className="h-9 cursor-pointer rounded-lg border bg-background px-3 text-xs"
              >
                <option value="link">Lien HTTPS</option>
                <option value="file">Fichier du repository</option>
              </select>
              <select
                name="repositoryId"
                className="h-9 cursor-pointer rounded-lg border bg-background px-3 text-xs"
              >
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name}
                  </option>
                ))}
              </select>
              <Input name="title" required minLength={2} placeholder="Titre" />
              <Input
                name="location"
                required
                placeholder="https://… ou docs/spec.md"
              />
              <div className="sm:col-span-2 flex justify-end">
                <Button size="sm" type="submit">
                  Enregistrer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card size="sm">
        <CardContent className="divide-y p-0">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center gap-3 p-4">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer text-left"
                onClick={() => void openDocument(document)}
              >
                <p className="truncate text-xs font-semibold">
                  {document.title}
                </p>
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                  {document.location}
                </p>
              </button>
              <Badge variant="outline">
                {document.source === "discovered"
                  ? "Détecté"
                  : document.category}
              </Badge>
              {document.kind === "link" ? (
                <ExternalLink className="size-3.5" />
              ) : null}
              {document.source === "managed" ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Retirer"
                  onClick={() =>
                    void deleteProjectDocument(projectId, document.id).then(
                      load,
                    )
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
          {!documents.length ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Aucun document trouvé.
            </p>
          ) : null}
        </CardContent>
      </Card>
      {preview ? (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{preview.title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(null)}
              >
                Fermer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[65vh] overflow-auto pt-6">
            <MarkdownContent>{preview.content}</MarkdownContent>
            {preview.truncated ? (
              <p className="mt-4 text-xs text-amber-600">Aperçu tronqué.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
