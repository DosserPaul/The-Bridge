"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  CloudDownload,
  Code2,
  FolderGit2,
  FolderSearch,
  GitBranch,
  Globe2,
  HardDrive,
  LoaderCircle,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { ClientLogoField } from "@/components/clients/client-logo-field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitShortcutHint } from "@/components/ui/submit-shortcut-hint";
import {
  createProject,
  listClients,
  listGitHubConnections,
  listGitLabConnections,
  listRemoteRepositories,
  validateRepositoryPath,
  type Client,
  type GitHubConnection,
  type GitLabConnection,
  type RepositoryPathValidation,
  type RemoteRepository,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;
type RepositoryMode = "local" | "existing" | "create";
type CloneDestinationMode = "exact" | "subfolder";
type Provider = "github" | "gitlab";
type ProviderConnection = GitHubConnection | GitLabConnection;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const textareaClassName =
  "min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const projectTypes = [
  { value: "web", label: "Web", icon: Globe2 },
  { value: "mobile", label: "Mobile", icon: Rocket },
  { value: "backend", label: "Backend / API", icon: Code2 },
  { value: "ai", label: "IA", icon: Bot },
  { value: "desktop", label: "Desktop", icon: HardDrive },
  { value: "data", label: "Data", icon: Sparkles },
  { value: "automation", label: "Automatisation", icon: GitBranch },
  { value: "infrastructure", label: "Infrastructure", icon: ShieldCheck },
  { value: "other", label: "Autre", icon: Plus },
] as const;

const steps = [
  { number: 1 as const, label: "Identité", description: "Contexte du projet" },
  { number: 2 as const, label: "Code", description: "Repository et dossier" },
  { number: 3 as const, label: "Pilotage", description: "Dates et suivi" },
];

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function remoteCloneDirectoryName(
  repository: RemoteRepository | undefined,
): string {
  if (!repository) return "";

  try {
    const pathName = new URL(repository.cloneUrl).pathname;
    const encodedName = pathName.split("/").filter(Boolean).at(-1) ?? "";
    return (
      decodeURIComponent(encodedName).replace(/\.git$/i, "") ||
      slugify(repository.name)
    );
  } catch {
    return slugify(repository.name);
  }
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function ModeCard({
  mode,
  current,
  title,
  description,
  icon: Icon,
  onSelect,
}: {
  mode: RepositoryMode;
  current: RepositoryMode;
  title: string;
  description: string;
  icon: typeof FolderGit2;
  onSelect: (mode: RepositoryMode) => void;
}) {
  const selected = mode === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className={cn(
        "rounded-xl border p-4 text-left transition",
        selected
          ? "border-primary bg-primary/[0.04] ring-2 ring-primary/15"
          : "bg-muted/15 hover:border-foreground/25 hover:bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            selected ? "bg-primary text-primary-foreground" : "bg-background",
          )}
        >
          <Icon className="size-4" />
        </span>
        {selected ? <CheckCircle2 className="size-4 text-primary" /> : null}
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </button>
  );
}

export function NewProjectForm({
  initialClientId,
}: {
  initialClientId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [repositoryResult, setRepositoryResult] = useState<{
    key: string;
    items: RemoteRepository[];
  }>({ key: "", items: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(
    initialClientId ?? "",
  );
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<
    "planned" | "active" | "paused" | "completed" | "archived"
  >("active");
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "critical"
  >("normal");
  const [types, setTypes] = useState<string[]>(["web"]);

  const [repositoryMode, setRepositoryMode] = useState<RepositoryMode>("local");
  const [cloneDestinationMode, setCloneDestinationMode] =
    useState<CloneDestinationMode>("subfolder");
  const [provider, setProvider] = useState<Provider>("github");
  const [connectionId, setConnectionId] = useState("");
  const [remoteRepositoryId, setRemoteRepositoryId] = useState("");
  const [remoteRepositoryName, setRemoteRepositoryName] = useState("");
  const [repositoryVisibility, setRepositoryVisibility] = useState<
    "private" | "public"
  >("private");
  const [initializeReadme, setInitializeReadme] = useState(true);
  const [repositoryPath, setRepositoryPath] = useState("");
  const [pathVerification, setPathVerification] = useState<
    (RepositoryPathValidation & { signature: string }) | null
  >(null);
  const [isVerifyingPath, setIsVerifyingPath] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [technologies, setTechnologies] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      listClients(controller.signal),
      listGitHubConnections(controller.signal),
      listGitLabConnections(controller.signal),
    ])
      .then(([clientItems, githubConnections, gitlabConnections]) => {
        setClients(clientItems);
        setConnections([...githubConnections, ...gitlabConnections]);
        if (!githubConnections.length && gitlabConnections.length) {
          setProvider("gitlab");
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const providerConnections = useMemo(
    () => connections.filter((connection) => connection.provider === provider),
    [connections, provider],
  );
  const effectiveConnectionId = providerConnections.some(
    (item) => item.id === connectionId,
  )
    ? connectionId
    : (providerConnections[0]?.id ?? "");
  const repositoryKey = `${provider}:${effectiveConnectionId}`;
  const remoteRepositories =
    repositoryResult.key === repositoryKey ? repositoryResult.items : [];
  const selectedRemoteRepository = remoteRepositories.find(
    (repository) => repository.id === remoteRepositoryId,
  );
  const isLoadingRepositories =
    repositoryMode === "existing" &&
    Boolean(effectiveConnectionId) &&
    repositoryResult.key !== repositoryKey;
  const cloneDirectoryName =
    repositoryMode === "existing"
      ? remoteCloneDirectoryName(selectedRemoteRepository)
      : remoteRepositoryName.trim();
  const pathVerificationSignature = [
    repositoryMode,
    repositoryPath.trim(),
    repositoryMode === "local" ? "local" : cloneDestinationMode,
    cloneDestinationMode === "subfolder" ? cloneDirectoryName : "",
  ].join(":");
  const verifiedRepositoryPath =
    pathVerification?.signature === pathVerificationSignature
      ? pathVerification.resolvedPath
      : "";
  const isRepositoryPathVerified = Boolean(verifiedRepositoryPath);

  useEffect(() => {
    if (repositoryMode !== "existing" || !effectiveConnectionId) return;

    const controller = new AbortController();
    void listRemoteRepositories(
      provider,
      effectiveConnectionId,
      controller.signal,
    )
      .then((repositories) => {
        setRepositoryResult({ key: repositoryKey, items: repositories });
        setRemoteRepositoryId((current) =>
          repositories.some((repository) => repository.id === current)
            ? current
            : (repositories[0]?.id ?? ""),
        );
      })
      .catch((loadError: unknown) => {
        if (!(
          loadError instanceof DOMException && loadError.name === "AbortError"
        )) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les repositories distants.",
          );
        }
      });
    return () => controller.abort();
  }, [effectiveConnectionId, provider, repositoryKey, repositoryMode]);

  function toggleType(type: string) {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  function selectMode(mode: RepositoryMode) {
    setRepositoryMode(mode);
    setError(null);
    if (mode === "create" && !remoteRepositoryName) {
      setRemoteRepositoryName(slugify(name));
    }
  }

  async function handleVerifyRepositoryPath() {
    if (!repositoryPath.trim()) {
      setError("Indiquez le chemin local à vérifier.");
      return;
    }

    if (
      repositoryMode !== "local" &&
      cloneDestinationMode === "subfolder" &&
      !cloneDirectoryName
    ) {
      setError(
        repositoryMode === "existing"
          ? "Sélectionnez le repository à cloner."
          : "Indiquez un nom de repository valide.",
      );
      return;
    }

    if (
      repositoryMode === "create" &&
      !/^[A-Za-z0-9._-]+$/.test(remoteRepositoryName.trim())
    ) {
      setError(
        "Le nom du repository ne peut contenir que des lettres, chiffres, points, tirets et underscores.",
      );
      return;
    }

    const signature = pathVerificationSignature;
    setError(null);
    setIsVerifyingPath(true);

    try {
      const result = await validateRepositoryPath({
        repositoryMode,
        repositoryPath: repositoryPath.trim(),
        ...(repositoryMode !== "local"
          ? {
              cloneDestinationMode,
              ...(cloneDestinationMode === "subfolder"
                ? { cloneDirectoryName }
                : {}),
            }
          : {}),
      });
      setPathVerification({ ...result, signature });
    } catch (validationError) {
      setPathVerification(null);
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Impossible de vérifier ce chemin.",
      );
    } finally {
      setIsVerifyingPath(false);
    }
  }

  function validateStep(currentStep: Step): boolean {
    if (currentStep === 1) {
      if (name.trim().length < 2) {
        setError("Le nom du projet doit contenir au moins 2 caractères.");
        return false;
      }
      if (!types.length) {
        setError("Sélectionnez au moins une nature de projet.");
        return false;
      }
    }

    if (currentStep === 2) {
      if (!repositoryPath.trim()) {
        setError("Indiquez le chemin local du repository.");
        return false;
      }
      if (repositoryMode !== "local" && !effectiveConnectionId) {
        setError(
          `Connectez un compte ${provider === "github" ? "GitHub" : "GitLab"}.`,
        );
        return false;
      }
      if (repositoryMode === "existing" && !remoteRepositoryId) {
        setError("Sélectionnez un repository distant.");
        return false;
      }
      if (repositoryMode === "create" && !remoteRepositoryName.trim()) {
        setError("Indiquez le nom du repository à créer.");
        return false;
      }
      if (
        repositoryMode === "create" &&
        !/^[A-Za-z0-9._-]+$/.test(remoteRepositoryName.trim())
      ) {
        setError(
          "Le nom du repository ne peut contenir que des lettres, chiffres, points, tirets et underscores.",
        );
        return false;
      }
      if (!isRepositoryPathVerified) {
        setError("Vérifiez le chemin local avant de continuer.");
        return false;
      }
    }

    if (currentStep === 3) {
      if (startDate && deadline && deadline < startDate) {
        setError("La deadline doit être postérieure à la date de début.");
        return false;
      }
      if (followUpNote.trim() && !followUpDate) {
        setError("Ajoutez une date au follow-up ou retirez sa note.");
        return false;
      }
    }

    setError(null);
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(3, current + 1) as Step);
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key !== "Enter" ||
      (!event.metaKey && !event.ctrlKey) ||
      isSubmitting
    ) {
      return;
    }

    event.preventDefault();

    if (step < 3) {
      goNext();
      return;
    }

    event.currentTarget.requestSubmit();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifiedRepositoryPath) {
      setStep(2);
      setError("Vérifiez de nouveau le chemin local avant de créer le projet.");
      return;
    }
    if (!validateStep(3)) return;
    setIsSubmitting(true);

    try {
      const project = await createProject({
        name: name.trim(),
        ...(logoDataUrl ? { logoDataUrl } : {}),
        ...(optional(description) ? { description: description.trim() } : {}),
        status,
        priority,
        types,
        technologies: technologies
          .split(",")
          .map((technology) => technology.trim())
          .filter(Boolean),
        ...(startDate ? { startDate } : {}),
        ...(deadline ? { deadline } : {}),
        ...(followUpDate ? { followUpDate } : {}),
        ...(optional(followUpNote)
          ? { followUpNote: followUpNote.trim() }
          : {}),
        ...(selectedClientId ? { clientId: selectedClientId } : {}),
        repositoryPath: verifiedRepositoryPath,
        repositoryMode,
        ...(repositoryMode !== "local"
          ? {
              provider,
              connectionId: effectiveConnectionId,
              ...(repositoryMode === "existing"
                ? { remoteRepositoryId }
                : {
                    remoteRepositoryName: remoteRepositoryName.trim(),
                    repositoryVisibility,
                    initializeReadme,
                  }),
            }
          : {}),
      });

      router.push(`/projects/${project.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de créer ce projet.",
      );
      setIsSubmitting(false);
    }
  }

  const selectedConnection =
    repositoryMode === "local"
      ? undefined
      : connections.find(
          (connection) => connection.id === effectiveConnectionId,
        );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/projects"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 text-muted-foreground",
        )}
      >
        <ArrowLeft data-icon="inline-start" />
        Retour aux projets
      </Link>

      <div className="mt-7">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Nouveau projet
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          Construire le contexte de mission
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Identité, code et pilotage : THE BRIDGE prépare le projet et vérifie
          son emplacement local avant de l’ajouter au cockpit.
        </p>
      </div>

      <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_290px]">
        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{steps[step - 1].label}</CardTitle>
                  <CardDescription>
                    {steps[step - 1].description}
                  </CardDescription>
                </div>
                <Badge variant="outline">Étape {step} / 3</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {step === 1 ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Nom du projet</Label>
                    <Input
                      id="project-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="JurisLive"
                      minLength={2}
                      maxLength={80}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Logo optionnel</Label>
                    <ClientLogoField
                      fieldId="project-logo"
                      clientName={name || "Nouveau projet"}
                      value={logoDataUrl}
                      onChange={setLogoDataUrl}
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="clientId">Client</Label>
                      <select
                        id="clientId"
                        className={selectClassName}
                        value={selectedClientId}
                        onChange={(event) =>
                          setSelectedClientId(event.target.value)
                        }
                      >
                        <option value="">Projet personnel</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                      <Link
                        href="/clients/new"
                        className="inline-block text-xs text-primary hover:underline"
                      >
                        Créer un nouveau client
                      </Link>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Statut</Label>
                      <select
                        id="status"
                        className={selectClassName}
                        value={status}
                        onChange={(event) =>
                          setStatus(event.target.value as typeof status)
                        }
                      >
                        <option value="planned">Planifié</option>
                        <option value="active">Actif</option>
                        <option value="paused">En pause</option>
                        <option value="completed">Terminé</option>
                        <option value="archived">Archivé</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={5000}
                      placeholder="Objectif, contexte et résultat attendu…"
                      className={textareaClassName}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Nature du projet</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {projectTypes.map(({ value, label, icon: Icon }) => {
                        const selected = types.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleType(value)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition",
                              selected
                                ? "border-primary bg-primary/[0.06] text-primary"
                                : "bg-muted/15 hover:bg-muted/35",
                            )}
                          >
                            <Icon className="size-3.5" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priorité</Label>
                    <select
                      id="priority"
                      className={selectClassName}
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as typeof priority)
                      }
                    >
                      <option value="low">Basse</option>
                      <option value="normal">Normale</option>
                      <option value="high">Haute</option>
                      <option value="critical">Critique</option>
                    </select>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <ModeCard
                      mode="local"
                      current={repositoryMode}
                      title="Repository local"
                      description="Rattacher un repository déjà présent sur ce Mac."
                      icon={FolderGit2}
                      onSelect={selectMode}
                    />
                    <ModeCard
                      mode="existing"
                      current={repositoryMode}
                      title="Cloner un existant"
                      description="Choisir un repository GitHub ou GitLab connecté."
                      icon={CloudDownload}
                      onSelect={selectMode}
                    />
                    <ModeCard
                      mode="create"
                      current={repositoryMode}
                      title="Créer et cloner"
                      description="Créer un repository distant puis le placer en local."
                      icon={Plus}
                      onSelect={selectMode}
                    />
                  </div>

                  {repositoryMode !== "local" ? (
                    <div className="grid gap-5 rounded-xl border bg-muted/15 p-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="provider">Provider</Label>
                        <select
                          id="provider"
                          className={selectClassName}
                          value={provider}
                          onChange={(event) => {
                            setProvider(event.target.value as Provider);
                            setConnectionId("");
                          }}
                        >
                          <option value="github">GitHub</option>
                          <option value="gitlab">GitLab</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="connection">Compte connecté</Label>
                        <select
                          id="connection"
                          className={selectClassName}
                          value={effectiveConnectionId}
                          onChange={(event) =>
                            setConnectionId(event.target.value)
                          }
                        >
                          {!providerConnections.length ? (
                            <option value="">Aucune connexion</option>
                          ) : null}
                          {providerConnections.map((connection) => (
                            <option key={connection.id} value={connection.id}>
                              @{connection.account.username}
                              {connection.provider === "gitlab"
                                ? ` · ${connection.baseUrl}`
                                : ""}
                            </option>
                          ))}
                        </select>
                        {!providerConnections.length ? (
                          <Link
                            href="/settings/integrations"
                            className="inline-block text-xs text-primary hover:underline"
                          >
                            Connecter{" "}
                            {provider === "github" ? "GitHub" : "GitLab"}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {repositoryMode === "existing" ? (
                    <div className="space-y-2">
                      <Label htmlFor="remoteRepository">
                        Repository distant
                      </Label>
                      <select
                        id="remoteRepository"
                        className={selectClassName}
                        value={remoteRepositoryId}
                        disabled={
                          isLoadingRepositories || !effectiveConnectionId
                        }
                        onChange={(event) =>
                          setRemoteRepositoryId(event.target.value)
                        }
                      >
                        {isLoadingRepositories ? (
                          <option value="">Chargement…</option>
                        ) : null}
                        {!isLoadingRepositories &&
                        !remoteRepositories.length ? (
                          <option value="">Aucun repository disponible</option>
                        ) : null}
                        {remoteRepositories.map((repository) => (
                          <option key={repository.id} value={repository.id}>
                            {repository.fullName} · {repository.visibility}
                          </option>
                        ))}
                      </select>
                      {selectedRemoteRepository?.description ? (
                        <p className="text-xs text-muted-foreground">
                          {selectedRemoteRepository.description}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {repositoryMode === "create" ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="remoteRepositoryName">
                          Nom du repository
                        </Label>
                        <Input
                          id="remoteRepositoryName"
                          value={remoteRepositoryName}
                          onChange={(event) =>
                            setRemoteRepositoryName(event.target.value)
                          }
                          placeholder="jurislive"
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="visibility">Visibilité</Label>
                        <select
                          id="visibility"
                          className={selectClassName}
                          value={repositoryVisibility}
                          onChange={(event) =>
                            setRepositoryVisibility(
                              event.target.value as "private" | "public",
                            )
                          }
                        >
                          <option value="private">Privé</option>
                          <option value="public">Public</option>
                        </select>
                      </div>
                      <label className="flex items-start gap-3 rounded-lg border bg-muted/15 p-3 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={initializeReadme}
                          onChange={(event) =>
                            setInitializeReadme(event.target.checked)
                          }
                          className="mt-0.5 size-4 accent-primary"
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            Initialiser avec un README
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Recommandé pour obtenir immédiatement une branche
                            principale clonable.
                          </span>
                        </span>
                      </label>
                      {provider === "gitlab" ? (
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          La création GitLab nécessite un token avec le scope
                          <code className="mx-1">api</code>. Le scope
                          <code className="mx-1">read_api</code> suffit
                          seulement pour sélectionner un repository existant.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {repositoryMode !== "local" ? (
                    <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
                      <div>
                        <p className="text-sm font-semibold">
                          Organisation du dossier local
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Choisissez comment utiliser le chemin indiqué
                          ci-dessous.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          aria-pressed={cloneDestinationMode === "exact"}
                          onClick={() => setCloneDestinationMode("exact")}
                          className={cn(
                            "rounded-lg border p-3 text-left transition",
                            cloneDestinationMode === "exact"
                              ? "border-primary bg-primary/[0.05] ring-2 ring-primary/15"
                              : "bg-background hover:border-foreground/25",
                          )}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">
                              Cloner dans ce dossier
                            </span>
                            {cloneDestinationMode === "exact" ? (
                              <CheckCircle2 className="size-4 text-primary" />
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            Le chemin doit être absent ou pointer vers un
                            dossier vide.
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={cloneDestinationMode === "subfolder"}
                          onClick={() => setCloneDestinationMode("subfolder")}
                          className={cn(
                            "rounded-lg border p-3 text-left transition",
                            cloneDestinationMode === "subfolder"
                              ? "border-primary bg-primary/[0.05] ring-2 ring-primary/15"
                              : "bg-background hover:border-foreground/25",
                          )}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">
                              Créer un sous-dossier
                            </span>
                            {cloneDestinationMode === "subfolder" ? (
                              <CheckCircle2 className="size-4 text-primary" />
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            THE BRIDGE créera{" "}
                            <code>{cloneDirectoryName || "repository"}</code>{" "}
                            dans le dossier parent choisi.
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="repositoryPath">
                      {repositoryMode === "local"
                        ? "Chemin du repository existant"
                        : cloneDestinationMode === "exact"
                          ? "Dossier de destination du clone"
                          : "Dossier parent du clone"}
                    </Label>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="relative">
                        <FolderSearch className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
                        <Input
                          id="repositoryPath"
                          value={repositoryPath}
                          onChange={(event) =>
                            setRepositoryPath(event.target.value)
                          }
                          placeholder={
                            repositoryMode === "local"
                              ? "/Users/paul/Projects/JurisLive"
                              : cloneDestinationMode === "exact"
                                ? "/Users/paul/Projects/jurislive"
                                : "/Users/paul/Projects"
                          }
                          className="pl-9 font-mono text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyRepositoryPath}
                        disabled={isVerifyingPath}
                      >
                        {isVerifyingPath ? (
                          <LoaderCircle
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : isRepositoryPathVerified ? (
                          <CheckCircle2 data-icon="inline-start" />
                        ) : (
                          <FolderSearch data-icon="inline-start" />
                        )}
                        {isVerifyingPath
                          ? "Vérification…"
                          : isRepositoryPathVerified
                            ? "Vérifié"
                            : "Vérifier"}
                      </Button>
                    </div>
                    {isRepositoryPathVerified ? (
                      <div
                        role="status"
                        className="rounded-lg border border-emerald-600/20 bg-emerald-600/[0.06] p-3 text-xs text-emerald-700 dark:text-emerald-400"
                      >
                        <p className="flex items-center gap-2 font-medium">
                          <CheckCircle2 className="size-3.5" />
                          {pathVerification?.repository
                            ? `${pathVerification.repository.name}${pathVerification.repository.branch ? ` · branche ${pathVerification.repository.branch}` : ""}`
                            : "Destination disponible pour le clone"}
                        </p>
                        <p className="mt-1 truncate font-mono text-[11px]">
                          {verifiedRepositoryPath}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {repositoryMode === "local"
                          ? "Le dossier doit exister et appartenir à un repository Git. Vérifiez-le pour détecter sa racine canonique."
                          : cloneDestinationMode === "exact"
                            ? "La destination doit être absente ou vide. Une vérification est obligatoire avant de continuer."
                            : `Le dossier parent doit exister et être accessible. Le clone sera placé dans ${cloneDirectoryName || "un nouveau sous-dossier"}.`}
                      </p>
                    )}
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Date de début</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadline">Deadline</Label>
                      <Input
                        id="deadline"
                        type="date"
                        min={startDate || undefined}
                        value={deadline}
                        onChange={(event) => setDeadline(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border bg-muted/15 p-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-primary" />
                      <p className="text-sm font-semibold">Premier follow-up</p>
                      <Badge variant="outline">Optionnel</Badge>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                      <div className="space-y-2">
                        <Label htmlFor="followUpDate">Date</Label>
                        <Input
                          id="followUpDate"
                          type="date"
                          value={followUpDate}
                          onChange={(event) =>
                            setFollowUpDate(event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="followUpNote">Note</Label>
                        <Input
                          id="followUpNote"
                          value={followUpNote}
                          onChange={(event) =>
                            setFollowUpNote(event.target.value)
                          }
                          placeholder="Faire un point avec le client sur la V1"
                          maxLength={1000}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="technologies">Technologies et tags</Label>
                    <Input
                      id="technologies"
                      value={technologies}
                      onChange={(event) => setTechnologies(event.target.value)}
                      placeholder="Next.js, NestJS, PostgreSQL, OpenAI"
                    />
                    <p className="text-xs text-muted-foreground">
                      Séparez les technologies par des virgules.
                    </p>
                  </div>

                  <div className="rounded-xl border bg-muted/15 p-4">
                    <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                      Récapitulatif
                    </p>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Projet</p>
                        <p className="mt-1 font-medium">{name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Code</p>
                        <p className="mt-1 font-medium">
                          {repositoryMode === "local"
                            ? "Repository local"
                            : repositoryMode === "existing"
                              ? `${provider === "github" ? "GitHub" : "GitLab"} · ${selectedRemoteRepository?.fullName ?? "Repository existant"}`
                              : `${provider === "github" ? "GitHub" : "GitLab"} · nouveau ${remoteRepositoryName}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Compte</p>
                        <p className="mt-1 font-medium">
                          {selectedConnection
                            ? `@${selectedConnection.account.username}`
                            : "Local uniquement"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Emplacement
                        </p>
                        <p className="mt-1 truncate font-mono text-xs font-medium">
                          {repositoryPath}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3.5 text-sm text-destructive"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t pt-5">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setError(null);
                      setStep((current) => (current - 1) as Step);
                    }}
                  >
                    <ArrowLeft data-icon="inline-start" />
                    Précédent
                  </Button>
                ) : (
                  <Link
                    href="/projects"
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    Annuler
                  </Link>
                )}

                <div className="flex items-center gap-3">
                  <SubmitShortcutHint />

                  {step < 3 ? (
                    <Button
                      type="button"
                      size="lg"
                      disabled={
                        step === 2 &&
                        (!isRepositoryPathVerified || isVerifyingPath)
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        goNext();
                      }}
                    >
                      Continuer
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  ) : (
                    <Button type="submit" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <Rocket data-icon="inline-start" />
                      )}
                      {isSubmitting
                        ? "Création et vérification…"
                        : "Créer le projet"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              Progression
            </p>
            <div className="mt-4 space-y-1">
              {steps.map((item) => {
                const complete = item.number < step;
                const active = item.number === step;
                const disabled =
                  item.number > step ||
                  (item.number === 3 && !isRepositoryPathVerified);
                return (
                  <button
                    key={item.number}
                    type="button"
                    disabled={disabled}
                    onClick={() => setStep(item.number)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg p-2.5 text-left",
                      active && "bg-primary/[0.06]",
                      item.number <= step && "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        complete &&
                          "border-emerald-600 bg-emerald-600 text-white",
                        active &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {complete ? <Check className="size-3.5" /> : item.number}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold">
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/25 p-5">
            <ShieldCheck className="size-5 text-emerald-600" />
            <h2 className="mt-4 font-heading text-sm font-semibold">
              Secrets sous contrôle
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Les tokens restent dans le Trousseau macOS. Ils servent au clone
              en mémoire et ne sont jamais ajoutés au remote Git ni à
              l’Activity.
            </p>
          </div>

          <div className="space-y-3 px-1 py-2 text-xs text-muted-foreground">
            {[
              "Validation du chemin local",
              "Détection du provider et du remote",
              "Vérification avant création distante",
              "Activity automatiquement journalisée",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Check className="size-2.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
